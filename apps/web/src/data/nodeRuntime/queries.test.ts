import type { NodeRuntimeResolveRequestDto } from '#lib/api'
import { fingerprintNodeRuntimeRequest } from './queries'

describe('fingerprintNodeRuntimeRequest', () => {
  it('ignores copy-only field changes that do not affect node visibility or options', () => {
    const base = {
      mapId: 'race',
      systemId: 'system-5e',
      values: {
        id: 'race-1',
        category: 'BASE',
        label: 'Dragonborn',
        description: '<p>Original copy.</p>',
        ancestry: {
          id: 'ancestry-1',
          label: 'Draconic Ancestry',
          description: '<p>Choose a dragon type.</p>',
          options: [
            {
              id: 'black',
              label: 'Black',
              description: 'Acid line.'
            }
          ]
        }
      }
    } satisfies NodeRuntimeResolveRequestDto

    const editedCopy = {
      ...base,
      values: {
        ...base.values,
        label: 'Dragonborn Copy',
        description: '<p>Edited copy.</p>',
        ancestry: {
          ...base.values.ancestry,
          description: '<p>Edited ancestry copy.</p>',
          options: [
            {
              id: 'black',
              label: 'Black Dragon',
              description: 'Edited option copy.'
            }
          ]
        }
      }
    } satisfies NodeRuntimeResolveRequestDto

    expect(fingerprintNodeRuntimeRequest(editedCopy)).toBe(fingerprintNodeRuntimeRequest(base))
  })

  it('keeps structural field changes in the node-runtime fingerprint', () => {
    const base = {
      mapId: 'race',
      systemId: 'system-5e',
      values: {
        category: 'BASE',
        selectionMode: 'DIRECT'
      }
    } satisfies NodeRuntimeResolveRequestDto

    const changedStructure = {
      ...base,
      values: {
        ...base.values,
        category: 'SUBRACE'
      }
    } satisfies NodeRuntimeResolveRequestDto

    expect(fingerprintNodeRuntimeRequest(changedStructure)).not.toBe(
      fingerprintNodeRuntimeRequest(base)
    )
  })
})
