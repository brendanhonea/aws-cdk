import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';

import { Construct, IConstruct } from 'constructs';
import { ConstructInfo, constructInfoFromConstruct } from './runtime-info';
import { ArtifactType } from '../../../cloud-assembly-schema';
import { Annotations } from '../annotations';
import { Stack } from '../stack';
import { ISynthesisSession } from '../stack-synthesizers';
import { IInspectable, TreeInspector } from '../tree';

const FILE_PATH = 'tree.json';

/**
 * Maps from hash to path
 */
export interface SynthDiff {
  readonly removed: Record<string, string>;
  readonly added: Record<string, string>;
}

/**
 * Construct that is automatically attached to the top-level `App`.
 * This generates, as part of synthesis, a file containing the construct tree and the metadata for each node in the tree.
 * The output is in a tree format so as to preserve the construct hierarchy.
 *
 */
export class TreeMetadata extends Construct {
  private _tree?: { [path: string]: Node };
  constructor(scope: Construct) {
    super(scope, 'Tree');
  }

  /**
   * Create tree.json
   * @internal
   */
  public _synthesizeTree(session: ISynthesisSession): SynthDiff {
    const lookup: { [path: string]: Node } = { };

    const visit = (construct: IConstruct): Node => {
      const children = construct.node.children.map((c) => {
        try {
          return visit(c);
        } catch (e) {
          Annotations.of(this).addWarning(`Failed to render tree metadata for node [${c.node.id}]. Reason: ${e}`);
          return undefined;
        }
      });
      const childrenMap = children
        .filter((child) => child !== undefined)
        .reduce((map, child) => Object.assign(map, { [child!.id]: child }), {});

      const parent = construct.node.scope;
      const attributes = this.synthAttributes(construct);

      const sortedChildrenHashes = construct.node.children.map(child => {
        return lookup[child.node.path].hash;
      });
      sortedChildrenHashes.sort();

      const node: Node = {
        id: construct.node.id || 'App',
        path: construct.node.path,
        parent: parent && parent.node.path ? {
          id: parent.node.id,
          path: parent.node.path,
          constructInfo: constructInfoFromConstruct(parent),
          hash: '',
        } : undefined,
        children: Object.keys(childrenMap).length === 0 ? undefined : childrenMap,
        attributes: attributes,
        hash: attributes != null ? computeStringHash(canonicalize(attributes)) : computeStringHash(sortedChildrenHashes.join()),
        constructInfo: constructInfoFromConstruct(construct),
      };

      lookup[node.path] = node;

      return node;
    };

    const tree = {
      version: 'tree-0.1',
      tree: visit(this.node.root),
    };
    this._tree = lookup;

    const builder = session.assembly;

    let result: SynthDiff = {
      removed: {},
      added: {},
    };

    if (fs.existsSync(path.join(session.outdir, 'tree.json'))) {
      const oldTree = fs.readJSONSync(path.join(session.outdir, 'tree.json')).tree as Node;
      const newTree = tree.tree;

      result = {
        removed: treeDifference(oldTree, newTree),
        added: treeDifference(newTree, oldTree),
      };
    }

    fs.writeFileSync(path.join(builder.outdir, FILE_PATH), JSON.stringify(tree, (key: string, value: any) => {
      // we are adding in the `parent` attribute for internal use
      // and it doesn't make much sense to include it in the
      // tree.json
      if (key === 'parent') return undefined;
      return value;
    }, 2), { encoding: 'utf-8' });

    builder.addArtifact('Tree', {
      type: ArtifactType.CDK_TREE,
      properties: {
        file: FILE_PATH,
      },
    });

    return result;
  }

  /**
   * Each node will only have 1 level up (node.parent.parent will always be undefined)
   * so we need to reconstruct the node making sure the parents are set
   */
  private getNodeWithParents(node: Node): Node {
    if (!this._tree) {
      throw new Error(`attempting to get node branch for ${node.path}, but the tree has not been created yet!`);
    }
    let tree = node;
    if (node.parent) {
      tree = {
        ...node,
        parent: this.getNodeWithParents(this._tree[node.parent.path]),
      };
    }
    return tree;
  }

  /**
   * Construct a new tree with only the nodes that we care about.
   * Normally each node can contain many child nodes, but we only care about the
   * tree that leads to a specific construct so drop any nodes not in that path
   *
   * @param node Node the current tree node
   * @param child Node the previous tree node and the current node's child node
   * @returns Node the new tree
   */
  private renderTreeWithChildren(node: Node, child?: Node): Node {
    if (node.parent) {
      return this.renderTreeWithChildren(node.parent, node);
    } else if (child) {
      return {
        ...node,
        children: {
          [child.id]: child,
        },
      };
    }
    return node;
  }

  /**
   * This gets a specific "branch" of the tree for a given construct path.
   * It will return the root Node of the tree with non-relevant branches filtered
   * out (i.e. node children that don't traverse to the given construct path)
   *
   * @internal
   */
  public _getNodeBranch(constructPath: string): Node | undefined {
    if (!this._tree) {
      throw new Error(`attempting to get node branch for ${constructPath}, but the tree has not been created yet!`);
    }
    const tree = this._tree[constructPath];
    const treeWithParents = this.getNodeWithParents(tree);
    return this.renderTreeWithChildren(treeWithParents);
  }

  private synthAttributes(construct: IConstruct): { [key: string]: any } | undefined {
    // check if a construct implements IInspectable
    function canInspect(inspectable: any): inspectable is IInspectable {
      return inspectable.inspect !== undefined;
    }

    const inspector = new TreeInspector();

    // get attributes from the inspector
    if (canInspect(construct)) {
      construct.inspect(inspector);
      return Stack.of(construct).resolve(inspector.attributes);
    }
    return undefined;
  }
}

type HashMap = { [key: string]: any };
type Pair = { key: string, value: any };

function canonicalize(obj: HashMap) {
  let pairs: Pair[] = [];
  for (const key in obj) {
      const value = obj[key];
      pairs.push({ key, value });
  }
  pairs.sort((a, b) => {
      if (a.key < b.key)
          return -1;
      else if (a.key > b.key)
          return 1;
      else
          return 0;
  });
  const members = pairs.reduce((text, pair) => {
      if (text.length > 0)
          text += ',';
      text += '"' + pair.key + '":' + serialize(pair.value);
      return text;
  }, '');
  return '{' + members + '}';
}

function serialize(value: any) {
  if (typeof(value) === 'object') {
      if (value instanceof Date) {
          return 'Date.parse("' + value.toISOString() + '")';
      }
      else if (Array.isArray(value)) {
          const values = value.reduce((text, element) => {
              if (text.length > 0)
                  text += ',';
              text += serialize(element);
              return text;
          }, '');
          return '[' + values + ']';
      }
      else {
          return canonicalize(value);
      }
  }
  else {
      return JSON.stringify(value);
  }
}

function computeStringHash(str: string) {
  const bytes = Buffer.from(str, 'utf-8').toString();
  return crypto.createHash('sha256').update(bytes).digest('base64');
}

function treeDifference(t1: Node, t2: Node): Record<string, string> {
  const m1 = foo(t1);
  const m2 = foo(t2);

  Object.entries(m1).forEach(([hash, path]) => {
    if (Object.values(m2).includes(path)) {
      delete m1[hash];
    }
  });

  return m1;
}

/**
 * Returns a map from hash to path
 */
function foo(node: Node): Record<string, string> {
  const result: Record<string, string> = {};
  recur(node);
  return result;

  function recur(n: Node) {
    if (n.children == null || Object.keys(n.children).length === 0) {
      result[n.hash] = n.path;
    } else {
      Object.values(n.children ?? {}).forEach(recur);
    }
  }
}

export interface Node {
  readonly id: string;
  readonly path: string;
  readonly parent?: Node;
  readonly children?: { [key: string]: Node };
  readonly attributes?: { [key: string]: any };
  readonly hash: string;

  /**
   * Information on the construct class that led to this node, if available
   */
  readonly constructInfo?: ConstructInfo;
}
