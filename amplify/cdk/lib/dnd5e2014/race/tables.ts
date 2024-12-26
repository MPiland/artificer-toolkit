import { Stack, RemovalPolicy } from 'aws-cdk-lib'
import { Table, BillingMode, AttributeType } from 'aws-cdk-lib/aws-dynamodb'

export function createMasterRaceTable(stack: Stack): Table {
  return new Table(stack, 'MasterRaceTable', {
    partitionKey: { name: 'id', type: AttributeType.STRING },
    billingMode: BillingMode.PAY_PER_REQUEST,
    removalPolicy: RemovalPolicy.DESTROY, // Use RETAIN in production
  })
}

export function createRaceTable(stack: Stack): Table {
  const table = new Table(stack, 'RaceTable', {
    partitionKey: { name: 'id', type: AttributeType.STRING },
    billingMode: BillingMode.PAY_PER_REQUEST,
    removalPolicy: RemovalPolicy.DESTROY, // Use RETAIN in production
  })

  table.addGlobalSecondaryIndex({
    indexName: 'ownerIndex',
    partitionKey: { name: 'ownerId', type: AttributeType.STRING },
    sortKey: { name: 'label', type: AttributeType.STRING },
  })

  return table
}
