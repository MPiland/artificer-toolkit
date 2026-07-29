import { describe, expect, it, vi } from 'vitest'
import type { MouseEvent } from 'react'
import { actionPresentationPresets } from '@artificer-toolkit/design-system'
import type { NodeRuntimeCollectionActionDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import { dispatchCollectionAction } from './authoringActionDispatcher'

const actionTypes = [
  'collection.add',
  'collection.edit',
  'collection.duplicate',
  'collection.remove'
] as const

describe('authoring action dispatcher', () => {
  it.each(actionTypes)('dispatches %s to its semantic handler', (type) => {
    const handler = vi.fn()
    const event = {} as MouseEvent<HTMLButtonElement>
    const action = {
      type,
      label: type,
      presentation: actionPresentationPresets.button
    } satisfies NodeRuntimeCollectionActionDto

    dispatchCollectionAction(action, event, { [type]: handler })

    expect(handler).toHaveBeenCalledWith(event)
  })

  it('fails fast when the current client has no handler for an action', () => {
    const action = {
      type: 'collection.edit',
      label: 'Edit',
      presentation: actionPresentationPresets.icon
    } satisfies NodeRuntimeCollectionActionDto

    expect(() => dispatchCollectionAction(action, {} as MouseEvent<HTMLButtonElement>, {})).toThrow(
      'No web handler is registered for authoring action: collection.edit'
    )
  })
})
