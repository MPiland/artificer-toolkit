import { actionEconomyCapabilityRegistry } from '@artificer-toolkit/rules-runtime/platformPolicyModules'
import {
  ESCAPE_GRAPPLE_MODULE_ID,
  escapeGrappleEffectDefinition
} from '@artificer-toolkit/rules-runtime/testing/escapeGrappleEffectFixture'
import { encounterEscapeCheckPendingContextDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionDirectActionPendingContexts'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_ATHLETICS_SKILL_ID,
  SRD_MEDICINE_SKILL_ID,
  SRD_SYSTEM_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { settleEncounterEscapeCheck } from '../escapeCheckSettlement.js'
import {
  ESCAPE_EFFECT_MISMATCH,
  findStoredEscape,
  requireEscapeAllowance
} from '../escapeEffectVerification.js'

/**
 * The room plans an Escape, but the relationship effect it came from owns the DC, the allowed
 * checks and the activation: a commit whose plan differs from the stored effect is refused.
 */

const findById = vi.hoisted(() => vi.fn())
vi.mock('../effectStore.js', () => ({ createActiveRuleEffectStore: () => ({ findById }) }))

const ENCOUNTER_ID = '00000000-0000-4000-8000-0000000000a1'
const HOLDER_ID = '00000000-0000-4000-8000-0000000000a2'
const EFFECT_ID = '00000000-0000-4000-8000-0000000000a3'
const ATHLETICS = SRD_ATHLETICS_SKILL_ID
const DC = 13
const GRAPPLED_ID = '00000000-0000-4000-8000-0000000000b3'
const holder = { id: HOLDER_ID, kind: 'CREATURE' as const, sourceId: null }
const ctx = { db: {} } as Parameters<typeof findStoredEscape>[0]

function storedEffect(options: Partial<Parameters<typeof escapeGrappleEffectDefinition>[0]> = {}) {
  return {
    definition: escapeGrappleEffectDefinition({
      encounterId: ENCOUNTER_ID,
      grapplerId: '00000000-0000-4000-8000-0000000000a4',
      conditionIds: [],
      dc: DC,
      ...options
    })
  }
}

function escapeContext(check: { checkDefinitionId?: string; dc?: number } = {}) {
  return encounterEscapeCheckPendingContextDtoSchema.parse({
    kind: 'ENCOUNTER_ESCAPE_CHECK',
    schemaVersion: 1,
    commandId: '00000000-0000-4000-8000-0000000000a5',
    commandFingerprint: 'b'.repeat(64),
    actionLabel: 'Escape',
    actorId: HOLDER_ID,
    activeEffectId: EFFECT_ID,
    escapeSourceId: ESCAPE_GRAPPLE_MODULE_ID,
    check: { checkDefinitionId: ATHLETICS, dc: DC, label: 'Strength (Athletics)', ...check },
    d20: {
      rollMode: 'NORMAL',
      keep: 'FIRST',
      contributors: [],
      contributorChecksum: checksumRuleDocument([]),
      modifier: 4
    },
    consumedGrants: []
  })
}

function find(context = escapeContext()) {
  return findStoredEscape(ctx, { encounterId: ENCOUNTER_ID, holder, context })
}

beforeEach(() => {
  findById.mockReset()
  findById.mockResolvedValue(storedEffect())
})

describe('findStoredEscape', () => {
  it('reads the holder’s own effect and returns the escape a matching plan came from', async () => {
    await expect(find()).resolves.toMatchObject({
      dc: DC,
      escapeSourceId: ESCAPE_GRAPPLE_MODULE_ID
    })
    expect(findById).toHaveBeenCalledWith(
      { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId: HOLDER_ID },
      EFFECT_ID
    )
  })

  it('refuses a plan whose DC differs from the effect’s', async () => {
    await expect(find(escapeContext({ dc: DC - 8 }))).rejects.toThrow(ESCAPE_EFFECT_MISMATCH)
  })

  it('refuses a check the effect does not allow, and one only the other module allows', async () => {
    await expect(find(escapeContext({ checkDefinitionId: SRD_MEDICINE_SKILL_ID }))).rejects.toThrow(
      ESCAPE_EFFECT_MISMATCH
    )
    findById.mockResolvedValue(
      storedEffect({
        checks: { skillIds: [], abilityDefinitionIds: [SRD_ABILITY_DEFINITION_IDS.STRENGTH] }
      })
    )
    await expect(find()).rejects.toThrow(ESCAPE_EFFECT_MISMATCH)
    await expect(
      find(escapeContext({ checkDefinitionId: SRD_ABILITY_DEFINITION_IDS.STRENGTH }))
    ).resolves.toMatchObject({ dc: DC })
  })

  it('refuses a plan naming another escape source', async () => {
    await expect(
      find({ ...escapeContext(), escapeSourceId: '00000000-0000-4000-8000-0000000000a6' })
    ).rejects.toThrow(ESCAPE_EFFECT_MISMATCH)
  })

  it('refuses an effect the holder itself cannot escape', async () => {
    findById.mockResolvedValue(storedEffect({ actorKinds: ['CREATURE_WITHIN_REACH'] }))
    await expect(find()).rejects.toThrow(ESCAPE_EFFECT_MISMATCH)
  })

  it('finds nothing once the effect has ended', async () => {
    findById.mockResolvedValue(null)
    await expect(find()).resolves.toBeNull()
  })
})

describe('settleEncounterEscapeCheck against the stored effect', () => {
  const OCCURRENCE_ID = '00000000-0000-4000-8000-0000000000b1'
  const context = escapeContext()
  const actors = [{ id: HOLDER_ID, kind: 'CREATURE', label: 'Wolf', conditions: [] }]

  /** A planned result whose d20 reaches the DC, carrying `outcome` and what it removes. */
  function settle(outcome: string, removedConditionIds: string[] = []) {
    return settleEncounterEscapeCheck(
      {} as Parameters<typeof settleEncounterEscapeCheck>[0],
      {
        state: { id: ENCOUNTER_ID, gameSystemId: SRD_SYSTEM_ID },
        actors,
        rootCommandId: context.commandId,
        occurrenceVersion: 2,
        settlement: {
          context,
          appRollId: '00000000-0000-4000-8000-0000000000b2',
          execution: {
            status: 'COMPLETE',
            occurrenceId: OCCURRENCE_ID,
            occurrenceVersion: 2,
            applicationOutputs: {
              kind: 'ESCAPE_CHECK',
              occurrenceId: OCCURRENCE_ID,
              commandId: context.commandId,
              actorId: HOLDER_ID,
              activeEffectId: EFFECT_ID,
              check: { checkDefinitionId: context.check.checkDefinitionId, dc: context.check.dc },
              d20: {
                selectedNatural: 9,
                total: 9 + context.d20.modifier,
                modifier: context.d20.modifier,
                derivedRollMode: context.d20.rollMode,
                contributorChecksum: context.d20.contributorChecksum
              },
              outcome,
              removedConditionIds
            }
          }
        },
        campaign: {},
        initiatorUserId: 'user',
        occurredAt: '2026-10-08T00:00:00.000Z'
      } as unknown as Parameters<typeof settleEncounterEscapeCheck>[1]
    )
  }

  it('reports an effect that ended while the roll waited, and removes nothing', async () => {
    findById.mockResolvedValue(null)
    const settled = await settle('ALREADY_ENDED')
    expect(settled.output.outcome).toBe('ALREADY_ENDED')
    expect(settled.actors).toEqual(actors)
  })

  it('refuses a plan that frees or fails a holder whose effect already ended', async () => {
    findById.mockResolvedValue(null)
    await expect(settle('ESCAPED', [GRAPPLED_ID])).rejects.toThrow(
      'Live Session escape check scope mismatch.'
    )
    await expect(settle('FAILED')).rejects.toThrow('Live Session escape check scope mismatch.')
  })

  it('refuses a plan that reports an effect still held as ended', async () => {
    await expect(settle('ALREADY_ENDED')).rejects.toThrow(
      'Live Session escape check scope mismatch.'
    )
  })
})

describe('requireEscapeAllowance', () => {
  const actionBinding = actionEconomyCapabilityRegistry
    .require(SRD_SYSTEM_ID)
    .resolveActionEconomyCapability({
      activationKind: 'ACTION',
      activationAmount: 1
    })
  if (actionBinding.kind !== 'REQUIRED') throw new Error('The Action must bind an allowance.')
  const action = { definitionId: actionBinding.capabilityDefinitionId }
  const state = { gameSystemId: SRD_SYSTEM_ID }

  async function escapeFor(
    activation: NonNullable<Parameters<typeof escapeGrappleEffectDefinition>[0]['activation']>
  ) {
    findById.mockResolvedValue({
      definition: escapeGrappleEffectDefinition({
        encounterId: ENCOUNTER_ID,
        grapplerId: HOLDER_ID,
        conditionIds: [],
        activation
      })
    })
    const escape = await find()
    if (!escape) throw new Error('The fixture escape must be held.')
    return escape
  }

  it('accepts the allowance the authored activation binds to', async () => {
    const escape = await escapeFor({ code: 'ACTION', amount: 1 })
    expect(() => requireEscapeAllowance(state, escape, action)).not.toThrow()
  })

  it('refuses a plan that spent no allowance, or the wrong one', async () => {
    const escape = await escapeFor({ code: 'ACTION', amount: 1 })
    expect(() => requireEscapeAllowance(state, escape, null)).toThrow(ESCAPE_EFFECT_MISMATCH)
    const bonus = await escapeFor({ code: 'BONUS_ACTION', amount: 1 })
    expect(() => requireEscapeAllowance(state, bonus, action)).toThrow(ESCAPE_EFFECT_MISMATCH)
  })

  it('spends nothing for a free activation', async () => {
    const free = await escapeFor({ code: 'FREE' })
    expect(() => requireEscapeAllowance(state, free, null)).not.toThrow()
    expect(() => requireEscapeAllowance(state, free, action)).toThrow(ESCAPE_EFFECT_MISMATCH)
  })
})
