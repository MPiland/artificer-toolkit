import type { MouseEvent } from 'react'
import type { NodeRuntimeCollectionActionDto } from '@artificer-toolkit/schema/api/nodeRuntime'

type CollectionActionType = NodeRuntimeCollectionActionDto['type']

type CollectionActionHandlers = Partial<
  Record<CollectionActionType, (event: MouseEvent<HTMLButtonElement>) => void>
>

export function dispatchCollectionAction(
  action: NodeRuntimeCollectionActionDto,
  event: MouseEvent<HTMLButtonElement>,
  handlers: CollectionActionHandlers
): void {
  const actionType = getActionType(action)
  const handler = handlers[actionType]
  if (!handler) {
    throw new Error(`No web handler is registered for authoring action: ${actionType}`)
  }
  handler(event)
}

function getActionType(action: NodeRuntimeCollectionActionDto): CollectionActionType {
  switch (action.type) {
    case 'collection.add':
      return action.type
    case 'collection.edit':
      return action.type
    case 'collection.duplicate':
      return action.type
    case 'collection.remove':
      return action.type
    default:
      return assertNever(action)
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported authoring action: ${JSON.stringify(value)}`)
}
