import type { DBLike, EncounterRecord } from '@artificer-toolkit/db'
import { checksumCampaignCharacterMechanicalContext } from '../character/campaignCharacterSheet.js'
import type { LockedEncounterActiveEffectTargets } from './encounterActiveEffectTargetState.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  command: '00000000-0000-4000-8000-000000000002',
  encounter: '00000000-0000-4000-8000-000000000003',
  item: '00000000-0000-4000-8000-000000000004',
  itemDefinition: '00000000-0000-4000-8000-000000000005',
  occurrence: '00000000-0000-4000-8000-000000000006',
  sourceCommand: '00000000-0000-4000-8000-000000000007',
  targetActor: '00000000-0000-4000-8000-000000000008',
  targetCharacter: '00000000-0000-4000-8000-000000000009',
  user: '00000000-0000-4000-8000-00000000000a'
}

const mocks = vi.hoisted(() => ({ resolveLiveContext: vi.fn() }))

vi.mock('../character/campaignCharacterSheet.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../character/campaignCharacterSheet.js')>()
  return { ...actual, resolveCharacterLiveSessionRuleContext: mocks.resolveLiveContext }
})

const { withLockedEncounterCharacterOptionalContestContext } =
  await import('./encounterCharacterOptionalContestContext.js')

function encounter() {
  return {
    id: ids.encounter,
    campaignId: ids.campaign,
    actors: [
      {
        id: ids.targetActor,
        kind: 'CHARACTER',
        sourceId: ids.targetCharacter,
        sourceRevision: 4,
        systemId: '00000000-0000-4000-8000-000000000011'
      }
    ]
  } as unknown as Pick<EncounterRecord, 'actors' | 'campaignId'> & { id: string }
}

function targets(input: { equipped?: boolean } = {}) {
  const adjustments: never[] = []
  return {
    lockedCharacters: new Map([
      [
        ids.targetCharacter,
        {
          id: ids.targetCharacter,
          streamVersion: 4,
          actor: encounter().actors[0],
          mechanics: {
            characterStreamVersion: 4,
            projectionChecksum: 'a'.repeat(64),
            commandState: {
              state: { equipment: { equipped: input.equipped === false ? [] : [ids.item] } }
            },
            initiativeActorFacts: {
              effectiveSize: 'MEDIUM',
              checkTotals: { '00000000-0000-4000-8000-000000000012': 6 },
              equippedItems:
                input.equipped === false
                  ? []
                  : [
                      {
                        itemInstanceId: ids.item,
                        equipmentDefinitionId: ids.itemDefinition,
                        properties: ['LIGHT']
                      }
                    ]
            }
          },
          overlay: {
            projectionChecksum: 'b'.repeat(64),
            mechanicalContextChecksum: checksumCampaignCharacterMechanicalContext({
              adjustments,
              attunementSlotOverride: null
            })
          }
        }
      ]
    ])
  } as unknown as LockedEncounterActiveEffectTargets
}

function input(
  overrides: Partial<Parameters<typeof withLockedEncounterCharacterOptionalContestContext>[0]> = {}
) {
  return {
    actorUserId: ids.user,
    attunementSlotOverride: null,
    commandId: ids.command,
    db: {} as DBLike,
    encounter: encounter(),
    liveSessionAuthority: { sessionId: ids.campaign, authorityId: 'test-authority' },
    occurrenceId: ids.occurrence,
    selectedItemId: ids.item,
    sourceCommandId: ids.sourceCommand,
    targetActorId: ids.targetActor,
    targets: targets(),
    ...overrides
  }
}

describe('withLockedEncounterCharacterOptionalContestContext', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('supplies pinned Character facts and the exact internal UNEQUIP capability', async () => {
    mocks.resolveLiveContext.mockResolvedValue({
      adjustments: [],
      additionalConditions: [],
      attunementSlotOverride: null
    })

    const context = await withLockedEncounterCharacterOptionalContestContext(
      input(),
      async (value) => value
    )

    expect(context).toMatchObject({
      targetActorId: ids.targetActor,
      targetCharacterId: ids.targetCharacter,
      targetStreamVersion: 4,
      targetMechanicsProjectionChecksum: 'a'.repeat(64),
      targetCampaignOverlayChecksum: 'b'.repeat(64),
      effectiveSize: 'MEDIUM',
      checkTotals: { '00000000-0000-4000-8000-000000000012': 6 },
      selectedItem: {
        itemId: ids.item,
        equipmentDefinitionId: ids.itemDefinition,
        properties: ['LIGHT'],
        state: 'EQUIPPED'
      }
    })
    expect(context.unequipCapability.command).toEqual({
      type: 'UNEQUIP_ITEM',
      commandId: ids.command,
      expectedVersion: 4,
      itemId: ids.item
    })
  })

  it('rejects a stale selected item before reading the Campaign context or invoking the callback', async () => {
    const callback = vi.fn()
    await expect(
      withLockedEncounterCharacterOptionalContestContext(
        input({ targets: targets({ equipped: false }) }),
        callback
      )
    ).rejects.toThrow('no longer equipped')

    expect(mocks.resolveLiveContext).not.toHaveBeenCalled()
    expect(callback).not.toHaveBeenCalled()
  })
})
