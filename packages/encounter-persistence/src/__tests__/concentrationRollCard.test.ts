import { describe, expect, it } from 'vitest'
import type { GmCampaignRollDto, RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import type { StoredRuleExecutionResultDto } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { concentrationCheckApplicationOutputDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'
import {
  CAMPAIGN_ID,
  creatureActor,
  srdEncounterState
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { recordConcentrationCheckRoll } from '../concentrationRollPersistence.js'
import { insertRunActor } from '../documents.js'
import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import type { EncounterDocument } from '../store.js'

const OWNER_ID = '00000000-0000-4000-8000-0000000c1001'
const PLAYER_ID = '00000000-0000-4000-8000-0000000c1002'
const ACTOR_ID = '00000000-0000-4000-8000-0000000c1003'
const OCCURRENCE_ID = '00000000-0000-4000-8000-0000000c1004'
const PARENT_ID = '00000000-0000-4000-8000-0000000c1005'
const DEFINITION_ID = '00000000-0000-4000-8000-0000000c1006'
const ABILITY_ID = '00000000-0000-4000-8000-0000000c1007'
const VOCABULARY_ID = '00000000-0000-4000-8000-0000000c1008'
const STATE_ID = '00000000-0000-4000-8000-0000000c1009'
const CHECKSUM = 'a'.repeat(64)
const OCCURRED_AT = '2026-10-15T00:00:00.000Z'

const checkOutput = concentrationCheckApplicationOutputDtoSchema.parse({
  kind: 'DAMAGE_SAVE_CHECK',
  source: 'CONCENTRATION',
  schemaVersion: 1,
  occurrenceId: OCCURRENCE_ID,
  parentOccurrenceId: PARENT_ID,
  concentrationDefinition: { id: DEFINITION_ID, checksum: CHECKSUM },
  savingThrowAbilityDefinitionId: ABILITY_ID,
  systemVocabularySnapshot: {
    id: VOCABULARY_ID,
    version: 1,
    checksum: CHECKSUM
  },
  targetCharacter: null,
  application: {
    ordinal: 0,
    sourceNodeId: 'damage_0',
    sourceOperationKey: 'effect.damage',
    targetActorId: ACTOR_ID,
    appliedAmount: 4,
    damageTypeId: null,
    maintainedStateId: STATE_ID
  },
  trigger: { sourceLabel: 'Bite', damageTypeLabel: null, dc: 10 },
  outcome: 'SAVE_SUCCESS',
  d20: {
    requestId: 'request',
    rollMode: 'NORMAL',
    keep: 'FIRST',
    derivedRollMode: 'NORMAL',
    rawFaces: [15],
    selectedNatural: 15,
    modifier: 1,
    total: 16,
    dc: 10,
    contributors: [],
    contributorChecksum: CHECKSUM
  },
  contextChecksum: CHECKSUM,
  cleanup: null,
  nextOccurrenceId: null,
  skipped: []
})

/** Records the check of a hidden Creature against a stored Run, holding what each user retained. */
async function recordHiddenCheck(options: {
  controllerUserIds: string[]
  controllerStatus?: string
}) {
  const memory = createMemoryEncounterStore()
  const actor = {
    ...creatureActor({ id: ACTOR_ID, kind: 'CUSTOM', snapshot: {} }),
    public: false,
    controllerUserIds: options.controllerUserIds
  }
  await insertRunActor({ db: memory.store }, actor)
  memory.load(
    'campaignMemberships',
    [
      {
        _id: 'membership',
        _creationTime: 1,
        campaignId: CAMPAIGN_ID,
        userId: PLAYER_ID,
        status: options.controllerStatus ?? 'ACTIVE'
      }
    ] as unknown as EncounterDocument<'campaignMemberships'>[],
    { validate: false }
  )
  const retained: {
    userId: string
    roll: RollRecordDto
    binding: GmCampaignRollDto | null
  }[] = []
  const ctx = {
    db: memory.store,
    ports: {
      requireCampaignAuthority: async () => ({
        campaign: {
          id: CAMPAIGN_ID,
          ownerUserId: OWNER_ID,
          contentMaturity: 'GENERAL'
        }
      }),
      requireSystem: async () => ({
        id: 'system',
        rulesetCode: 'dnd5e',
        rulesetVersion: '1'
      }),
      readGmRollVisibility: async () => 'PRIVATE',
      retainPrivateRoll: async (
        userId: string,
        roll: RollRecordDto,
        binding: GmCampaignRollDto | null
      ) => {
        retained.push({ userId, roll, binding })
      }
    }
  } as unknown as Parameters<typeof recordConcentrationCheckRoll>[0]
  const entry = await recordConcentrationCheckRoll(ctx, {
    state: srdEncounterState({ actors: [actor], currentActorId: null }),
    result: {
      status: 'COMPLETE',
      applicationOutputs: checkOutput
    } as unknown as StoredRuleExecutionResultDto,
    authorUserId: OWNER_ID,
    occurredAt: OCCURRED_AT
  })
  return { entry, retained }
}

describe('recordConcentrationCheckRoll for a hidden Creature', () => {
  it('keeps the GM’s card with the creature and gives the controlling player the generic roll', async () => {
    const { entry, retained } = await recordHiddenCheck({
      controllerUserIds: [PLAYER_ID]
    })
    expect(entry).toBeNull()
    expect(retained.map(({ userId }) => userId)).toEqual([OWNER_ID, PLAYER_ID])
    const [gm, player] = retained
    expect(gm!.binding).toMatchObject({
      campaignId: CAMPAIGN_ID,
      creature: { encounterId: expect.any(String), actorId: ACTOR_ID },
      revealedAt: null,
      noticedAt: null
    })
    expect(player!.binding).toBeNull()
    expect(player!.roll).toEqual(gm!.roll)
  })

  it('keeps a GM-controlled hidden Creature’s card for the GM alone', async () => {
    const { entry, retained } = await recordHiddenCheck({
      controllerUserIds: []
    })
    expect(entry).toBeNull()
    expect(retained.map(({ userId }) => userId)).toEqual([OWNER_ID])
  })

  it('falls back to the GM alone once the controlling player left the Campaign', async () => {
    const { retained } = await recordHiddenCheck({
      controllerUserIds: [PLAYER_ID],
      controllerStatus: 'LEFT'
    })
    expect(retained.map(({ userId }) => userId)).toEqual([OWNER_ID])
  })
})
