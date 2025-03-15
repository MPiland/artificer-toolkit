import { Stack, RemovalPolicy } from 'aws-cdk-lib'
import { Table, BillingMode, AttributeType } from 'aws-cdk-lib/aws-dynamodb'

interface TableConfig {
  name: string
  addOwnerIndex?: boolean
}

export function createTable(stack: Stack, config: TableConfig): Table {
  const table = new Table(stack, config.name, {
    partitionKey: { name: 'id', type: AttributeType.STRING },
    billingMode: BillingMode.PAY_PER_REQUEST,
    removalPolicy: RemovalPolicy.DESTROY, // Use RETAIN in production
  })

  if (config.addOwnerIndex) {
    table.addGlobalSecondaryIndex({
      indexName: 'ownerIndex',
      partitionKey: { name: 'ownerId', type: AttributeType.STRING },
      sortKey: { name: 'label', type: AttributeType.STRING },
    })
  }

  return table
}
