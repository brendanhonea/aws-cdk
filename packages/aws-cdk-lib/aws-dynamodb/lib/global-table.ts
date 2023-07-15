import { Construct } from 'constructs';
import { CfnGlobalTable } from './dynamodb.generated';
import {
  TableClass, SchemaOptions, GlobalSecondaryIndexProps, LocalSecondaryIndexProps,
} from './table';
import { IStream } from '../../aws-kinesis';
import { IKey } from '../../aws-kms';
import { IResource, Resource, RemovalPolicy, Duration } from '../../core';

/**
 * Options to configure provisioned throughput for a table.
 */
export interface ThroughputOptions {
  /**
   * The read capacity for read operations on the table.
   *
   * @default 5
   */
  readonly readCapacity?: Capacity;

  /**
   * The write capacity for write operations on the table.
   *
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
 * Options used to configure the capacity modes.
 */
export interface CapacityOptions {
  /**
   *
   */
  readonly units?: number;

  /**
   *
   */
  readonly autoScalingOptions?: CapacityAutoScalingOptions;
}

/**
 * Options used to configure the server-side table encryption types.
 */
export interface TableEncryptionOptions {
  /**
   *
   */
  readonly tableKey?: IKey;

  /**
   *
   */
  readonly replicaKeyArns?: { [region: string]: string };
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
   * Whether or not CloudWatch contributor insights is enabled for the index.
   *
   * @default false
   */
  readonly contributorInsightsEnabled?: boolean;
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
   * @default 5
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
   * @default BillingMode.onDemand()
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

export interface IGlobalTable extends IResource {
  /**
   * The ARN of the replica in the region that the stack is deployed to.
   *
   * @attribute
   */
  readonly tableArn: string;

  /**
   * The name of the all replicas in the global table.
   *
   * @attribute
   */
  readonly tableName: string;

  /**
   * The ID of the replica in the region that the stack is deployed to.
   *
   * @attribute
   */
  readonly tableId: string;

  /**
   * The ARN of the stream of the replica in the region that the stack is deployed to.
   *
   * @attribute
   */
  readonly tableStreamArn: string;
}

export interface GlobalTableAttributes {}

/**
 * Base class for a global table.
 */
abstract class GlobalTableBase extends Resource implements IGlobalTable {
  /**
   * The ARN of the replica in the region that the stack is deployed to.
   *
   * @attribute
   */
  public abstract tableArn: string;

  /**
   * The name of the all replicas in the global table.
   *
   * @attribute
   */
  public abstract tableName: string;

  /**
   * The ID of the replica in the region that the stack is deployed to.
   *
   * @attribute
   */
  public abstract tableId: string;

  /**
   * The ARN of the stream of the replica in the region that the stack is deployed to.
   *
   * @attribute
   */
  public abstract tableStreamArn: string;
}

export class GlobalTable extends GlobalTableBase {
  public static fromTableName(scope: Construct, id: string, tableName: string) {}

  public static fromTableArn(scope: Construct, id: string, tableArn: string) {}

  public static fromTableAttributes(scope: Construct, id: string, attrs: GlobalTableAttributes) {}

  /**
   * Returns the ARN of the replica in the region that the stack is deployed to.
   *
   * @attribute
   */
  public readonly tableArn: string;

  /**
   * Returns the name of the all replicas in the global table.
   *
   * @attribute
   */
  public readonly tableName: string;

  /**
   * Returns the ID of the replica in the region that the stack is deployed to.
   *
   * @attribute
   */
  public readonly tableId: string;

  /**
   * Returns the ARN of the stream of the replica in the region that the stack is deployed to.
   *
   * @attribute
   */
  public readonly tableStreamArn: string;

  private readonly resource: CfnGlobalTable;

  constructor(scope: Construct, id: string, props: GlobalTableProps) {
    super(scope, id, { physicalName: props.tableName });

    this.resource = new CfnGlobalTable(this, 'Resource', {});

    this.tableArn = this.getResourceArnAttribute(this.resource.attrArn, {
      service: 'dynamodb',
      resource: 'table',
      resourceName: this.physicalName,
    });
    this.tableName = this.getResourceNameAttribute(this.resource.ref);
    this.tableId = this.resource.attrTableId;
    this.tableStreamArn = this.resource.attrStreamArn;
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
    return new Capacity('FIXED', { units });
  }

  /**
   * Autoscaled capacity mode.
   */
  public static autoscaled(options: CapacityAutoScalingOptions) {
    return new Capacity('AUTOSCALED', { autoScalingOptions: options });
  }

  /**
   * The capacity mode being used.
   */
  public readonly mode: string;

  /**
   * The capacity units selected if the capacity mode is FIXED.
   */
  public readonly units?: number;

  /**
   * Capacity auto scaling configuration options.
   */
  public readonly autoScalingOptions?: CapacityAutoScalingOptions;

  private constructor(mode: string, options: CapacityOptions = {}) {
    this.mode = mode;
    this.units = options.units;
    this.autoScalingOptions = options.autoScalingOptions;
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
  public static provisioned(options: ThroughputOptions = {}) {
    return new BillingMode('PROVISIONED', options);
  }

  /**
   * The billing mode.
   */
  public readonly mode: string;

  /**
   * The read capacity.
   */
  public readonly readCapacity?: Capacity;

  /**
   * The write capacity.
   */
  public readonly writeCapacity?: Capacity;

  private constructor(mode: string, options: ThroughputOptions = {}) {
    this.mode = mode;
    this.readCapacity = options.readCapacity;
    this.writeCapacity = options.writeCapacity;
  }
}

/**
 * The server-side encryption that will be applied to the replicas in the global table.
 */
export class TableEncryption {
  /**
   * Server-side KMS encryption with a master key owned by DynamoDB.
   */
  public static dynamoOwnedKey() {
    return new TableEncryption('DYNAMO_OWNED');
  }

  /**
   * Server-side KMS encryption with a master key managed by AWS.
   */
  public static awsManagedKey() {
    return new TableEncryption('AWS_MANAGED');
  }

  /**
   * Server-side KMS encryption with a master key managed by the customer.
   */
  public static customerManagedKey(tableKey: IKey, replicaKeyArns?: { [region: string]: string }) {
    return new TableEncryption('CUSTOMER_MANAGED', { tableKey, replicaKeyArns });
  }

  /**
   * The table encryption type.
   */
  public readonly encryptionType: string;

  /**
   *
   */
  public readonly tableKey?: IKey;

  /**
   *
   */
  public readonly replicaKeyArns?: { [region: string]: string };

  private constructor(encryptionType: string, options: TableEncryptionOptions = {}) {
    this.encryptionType = encryptionType;
    this.tableKey = options.tableKey;
    this.replicaKeyArns = options.replicaKeyArns;
  }
}
