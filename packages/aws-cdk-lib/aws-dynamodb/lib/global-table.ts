import { Construct } from 'constructs';
import {
  TableClass, SchemaOptions, GlobalSecondaryIndexProps, LocalSecondaryIndexProps,
} from './table';
import { IStream } from '../../aws-kinesis';
import { IResource, Resource, RemovalPolicy, Duration } from '../../core';

export interface CapacityOptions {
  /**
   * @default 5
   */
  readonly readCapacity?: Capacity;

  /**
   * @default 5
   */
  readonly writeCapacity?: Capacity;
}

/**
 * Options for configuring an auto scaling capacity strategy.
 */
export interface CapacityAutoScalingOptions {
  /**
   * The maximum provisioned capacity units for the global table.
   */
  readonly maxCapacity: number;

  /**
   * The minimum provisioned capacity units for the global table.
   */
  readonly minCapacity: number;

  /**
   * Defines a target value for the scaling policy.
   */
  readonly targetValue: number;

  /**
   *
   */
  readonly seedCapacity?: number;

  /**
   * Indicates whether scale in by the target tracking scaling policy is disabled.
   *
   * @default false
   */
  readonly disableScaleIn?: boolean;

  /**
   * The amount of time after a scale-in activity completes before another scale-in
   * activity can start.
   *
   * @default
   */
  readonly scaleInCooldown?: Duration;

  /**
   * The amount of time after a scale-out activity completes before another scale-out
   * activity can start.
   *
   * @default
   */
  readonly scaleOutCooldown?: Duration;
}

/**
 * Properties for configuring global secondary indexes at the replica level.
 */
export interface ReplicaGlobalSecondaryIndexProps {
  /**
   *
   */
  readonly indexName: string;

  /**
   *
   */
  readonly readCapacity?: Capacity;

  /**
   *
   */
  readonly contributorInsightsEnbaled?: boolean;
}

/**
 * Common table properties between global tables and replica tables.
 */
export interface TableOptions {
  /**
   * Whether or not CloudWatch contributor insights is enabled.
   *
   * NOTE: This property is configurable on a per-replica basis.
   *
   * @default false
   */
  readonly contributorInsightsEnabled?: boolean;

  /**
   * Whether or not deletion protection is enabled.
   *
   * NOTE: This property is configurable on a per-replica basis.
   *
   * @default false
   */
  readonly deletionProtection?: boolean;

  /**
   * Whether or not point-in-time recovery is enabled.
   *
   * NOTE: This property is configurable on a per-replica basis.
   *
   * @default false
   */
  readonly pointInTimeRecovery?: boolean;

  /**
   * The table class.
   *
   * NOTE: This property is configurable on a per-replica basis.
   *
   * @default TableClass.STANDARD
   */
  readonly tableClass?: TableClass;
}

/**
 * Properties for replica tables.
 */
export interface ReplicaTableProps extends TableOptions {
  /**
   * The region in which the replica exists.
   */
  readonly region: string;

  /**
   * Kinesis Data Stream configuration to capture item-level changes for the replica.
   *
   * @default - no Kinesis Data Stream
   */
  readonly kinesisStream?: IStream;

  /**
   * The read capacity for the replica.
   *
   * @default
   */
  readonly readCapacity?: Capacity;

  /**
   * Global secondary indexes for the replica.
   *
   * @default
   */
  readonly globalSecondaryIndexes?: ReplicaGlobalSecondaryIndexProps[];
}

/**
 * Properties for global tables.
 */
export interface GlobalTableProps extends TableOptions, SchemaOptions {
  /**
   * The name of all replicas in the global table.
   *
   * NOTE: If you specify a name, you cannot perform updates that require replacement of this
   * resource. You can perform updates that require no or some interruption. If you must replace
   * the resource, specify a new name.
   *
   * @default - generated by Cloudformation
   */
  readonly tableName?: string;

  /**
   * The name of the TTL attribute for all replicas in the global table.
   *
   * @default - TTL is disabled
   */
  readonly timeToLiveAttribute?: string;

  /**
   * The removal policy to apply to all replicas in the global table.
   *
   * @default RemovalPolicy.RETAIN
   */
  readonly removalPolicy?: RemovalPolicy;

  /**
   * The billing mode used for all replicas in the global table. The billing mode is used to
   * specify how you are charged for read and write throughput and how you manage capacity.
   *
   * @default
   */
  readonly billingMode?: BillingMode;

  /**
   * The list of replicas in the global table.
   *
   * NOTE: You can create a new global table with as many replicas as needed. You can add or
   * remove replicas after table creation, but you can only add or remove a single replica in
   * each update.
   *
   * @default - a single replica will exist in the region associated with the deployment stack
   */
  readonly replicas?: ReplicaTableProps[];

  /**
   * Global secondary indexes to be created on all replicas in the global table.
   *
   * NOTE: You can create up to 20 global secondary indexes. You can only create or delete one global
   * secondary index in a single stack operation. By default, each replica in your global table will
   * have the same global secondary index settings. However, the `readCapacity` of a global secondary
   * index can be set on a per-replica basis.
   *
   * @default - no global secondary indexes
   */
  readonly globalSecondaryIndexes: GlobalSecondaryIndexProps[];

  /**
   * Local secondary indexes to be created on all replicas in the global table.
   *
   * NOTE: You can create up to five local secondary indexes. Each index is scoped to a given hash
   * key value. The size of each hash key can be up to 10 gigabytes. Each replica in your global
   * table will have the same local secondary index settings.
   *
   * @default - no local secondary indexes
   */
  readonly localSecondaryIndexes: LocalSecondaryIndexProps[];

  /**
   *
   */
  readonly encryption?: TableEncryption;
}

export interface IGlobalTable extends IResource {}

export interface GlobalTableAttributes {}

/**
 * Base class for a global table.
 */
abstract class GlobalTableBase extends Resource implements IGlobalTable {}

export class GlobalTable extends GlobalTableBase {
  public static fromTableName(scope: Construct, id: string, tableName: string) {}

  public static fromTableArn(scope: Construct, id: string, tableArn: string) {}

  public static fromTableAttributes(scope: Construct, id: string, attrs: GlobalTableAttributes) {}

  constructor(scope: Construct, id: string, props: GlobalTableProps) {
    super(scope, id, { physicalName: props.tableName });
  }

  public addReplica(replica: ReplicaTableProps) {}

  public addGlobalSecondaryIndex(globalSecondaryIndex: GlobalSecondaryIndexProps) {}

  public addLocalSecondaryIndex(localSecondaryIndex: LocalSecondaryIndexProps) {}

  public replica(region: string) {}
}

/**
 * The capacity mode to use for table read and write throughput.
 */
export class Capacity {
  /**
   * Fixed capacity mode.
   */
  public static fixed(units: number) {
    return new Capacity('FIXED', units);
  }

  /**
   * Autoscaled capacity mode.
   */
  public static autoscaled(options: CapacityAutoScalingOptions) {
    return new Capacity('AUTOSCALED', undefined, options);
  }

  /**
   * The capacity mode being used.
   */
  public readonly mode: string;

  /**
   * The capacity units selected if the capacity mode is FIXED.
   *
   * NOTE: this value will be undefined if the capacity mode is AUTOSCALED.
   */
  public readonly units: number | undefined;

  /**
   * Capacity auto scaling configuration options.
   */
  public readonly options?: CapacityAutoScalingOptions;

  private constructor(mode: string, units: number | undefined, options?: CapacityAutoScalingOptions) {
    this.mode = mode;
    this.units = units;
    this.options = options;
  }
}

/**
 * Represents the billing mode used to specify how you are charged for read and write
 * throughput and how you manage capacity.
 */
export class BillingMode {
  /**
   * On demand billing mode.
   */
  public static onDemand() {
    return new BillingMode('PAY_PER_REQUEST');
  }

  /**
   * Provisioned billing mode.
   */
  public static provisioned(options: CapacityOptions = {}) {
    return new BillingMode('PROVISIONED', options);
  }

  /**
   * The billing mode.
   */
  public readonly mode: string;

  /**
   * The read and write capacity if the billing mode is provisioned.
   */
  public readonly options?: CapacityOptions;

  private constructor(mode: string, options?: CapacityOptions) {
    this.mode = mode;
    this.options = options;
  }
}

export class TableEncryption {}
