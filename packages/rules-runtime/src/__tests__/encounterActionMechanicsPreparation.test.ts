import {
  SRD_ABILITIES,
  SRD_SYSTEM_ID,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { shamblingMound } from '@artificer-toolkit/source-data/srd/creatures/shambling-mound.js'
import { describe, expect, it } from 'vitest'

import type { ProjectableCharacterFacts } from '../encounterActionProjection.js'
import { resolveEncounterActionSource } from '../encounterActionSources.js'
import { summonBody } from '../encounterActorBody.js'
import { featureChargeUsed } from '../encounterActorState.js'
import { discoverEncounterFeatureActions } from '../encounterFeatureActionCapabilityDiscoveryRegistry.js'
import { EncounterValidationError } from '../encounterErrors.js'
import { buildEncounterMovementReactionFacts } from '../encounterMovementReactionFacts.js'
import {
  QUILL_VOLLEY_CHARGE_ID,
  QUILL_VOLLEY_ID,
  creatureActor,
  creatureEncounter,
  featureActionId,
  prepareCreatureAction,
  quillVolley,
  settleCreatureAction
} from './encounterCreatureAction.js'

const SOURCE_ID = '00000000-0000-4000-8000-0000000c0001'
const TARGET_ID = '00000000-0000-4000-8000-0000000c0002'

function prepare(input: { charges: number; cost: number; used: number; overridable: boolean }) {
  const actor = creatureActor({
    id: SOURCE_ID,
    label: 'Quill Beast',
    features: [quillVolley(input)],
    featureChargesUsed: { [QUILL_VOLLEY_ID]: input.used }
  })
  const target = creatureActor({ id: TARGET_ID, label: 'Wolf', features: [] })
  return prepareCreatureAction({
    actor,
    target,
    featureId: QUILL_VOLLEY_ID,
    overridable: input.overridable
  })
}

describe('encounter action mechanics preparation: Feature charges', () => {
  it('spends the full cost with no warning while enough charges remain', async () => {
    const prepared = await prepare({ charges: 3, cost: 1, used: 0, overridable: true })

    expect(prepared.resourceUse).toEqual({ chargeId: QUILL_VOLLEY_CHARGE_ID, cost: 1 })
    expect(prepared.featureUsed).toBe(0)
    expect(prepared.featureResource).toMatchObject({
      maximum: 3,
      used: 0,
      rawUsed: 0,
      remaining: 3
    })
    expect(prepared.featureSpent).toBe(1)
    expect(prepared.ruleWarnings).toEqual([])
  })

  it('accepts a cost equal to the remaining charges even when the action is not overridable', async () => {
    const prepared = await prepare({ charges: 3, cost: 2, used: 1, overridable: false })

    expect(prepared.featureSpent).toBe(2)
    expect(prepared.ruleWarnings).toEqual([])
  })

  it('clamps an overridden spend to the remaining charges and warns with the exact shortfall', async () => {
    const prepared = await prepare({ charges: 3, cost: 2, used: 2, overridable: true })

    expect(prepared.featureSpent).toBe(1)
    expect(prepared.ruleWarnings).toEqual([
      { code: 'RESOURCE_UNAVAILABLE', message: 'Not enough charges left: needs 2, has 1.' }
    ])
  })

  it('spends nothing from an exhausted Feature and reports zero charges left', async () => {
    const prepared = await prepare({ charges: 3, cost: 1, used: 3, overridable: true })

    expect(prepared.featureSpent).toBe(0)
    expect(prepared.ruleWarnings).toEqual([
      { code: 'RESOURCE_UNAVAILABLE', message: 'Not enough charges left: needs 1, has 0.' }
    ])
  })

  it('refuses a shortfall outright when the caller cannot override (reactions, Disarm)', async () => {
    await expect(prepare({ charges: 3, cost: 2, used: 2, overridable: false })).rejects.toThrow(
      'The selected Encounter feature action resource is unavailable.'
    )
    await expect(prepare({ charges: 3, cost: 1, used: 3, overridable: false })).rejects.toThrow(
      'The selected Encounter feature action resource is unavailable.'
    )
  })

  it('settles exactly the clamped spend and records its receipt', async () => {
    const prepared = await prepare({ charges: 3, cost: 2, used: 2, overridable: true })
    const { mechanics } = await settleCreatureAction({ prepared, rolls: [] })

    expect(featureChargeUsed(mechanics.settledSource, QUILL_VOLLEY_ID)).toBe(3)
    expect(mechanics.featureResourceReceipt).toEqual({
      ownerActorId: SOURCE_ID,
      ownerFeatureId: QUILL_VOLLEY_ID,
      chargeId: QUILL_VOLLEY_CHARGE_ID,
      cost: 1,
      beforeUsed: 2,
      afterUsed: 3,
      beforeRemaining: 1,
      afterRemaining: 0
    })
    expect(mechanics.targetPlan.updatedActor).toMatchObject({ currentHitPoints: 8 })
  })

  it('settles an exhausted override with no charge change and no receipt, but still resolves', async () => {
    const prepared = await prepare({ charges: 3, cost: 1, used: 3, overridable: true })
    const { mechanics } = await settleCreatureAction({ prepared, rolls: [] })

    expect(featureChargeUsed(mechanics.settledSource, QUILL_VOLLEY_ID)).toBe(3)
    expect(mechanics.featureResourceReceipt).toBeNull()
    expect(mechanics.targetPlan.updatedActor).toMatchObject({ currentHitPoints: 8 })
  })
})

describe('encounter action discovery: attack rolls', () => {
  const missingAttackRoll =
    'Encounter feature attack action "Quill Volley" must author exactly one ATTACK roll definition.'
  const systemBindings = {
    conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
    abilityDefinitions: SRD_ABILITIES.map(({ id, code }) => ({ id, code }))
  }

  it('makes an attack-triggered Feature action that authors no ATTACK roll unavailable, with the reason', () => {
    const attack = quillVolley({ charges: 1, cost: 1, rangeFeet: 30 })
    const withRoll = creatureActor({ id: SOURCE_ID, label: 'Quill Beast', features: [attack] })
    const withoutRoll = creatureActor({
      id: SOURCE_ID,
      label: 'Quill Beast',
      features: [{ ...attack, rollDefinitions: [] }]
    })

    expect(featureActionId(withRoll, QUILL_VOLLEY_ID)).toEqual(expect.any(String))
    const discovery = discoverEncounterFeatureActions({
      spells: new Map(),
      actor: withoutRoll,
      ...systemBindings
    })
    expect(discovery.available).toEqual([])
    expect(discovery.unavailable).toEqual([
      {
        actionId: expect.stringContaining(QUILL_VOLLEY_ID),
        ownerFeatureId: QUILL_VOLLEY_ID,
        label: 'Quill Volley',
        reason: missingAttackRoll
      }
    ])
    expect(() =>
      resolveEncounterActionSource({
        spells: new Map(),
        actor: withoutRoll,
        actionId: discovery.unavailable[0]!.actionId,
        gameSystemId: SRD_SYSTEM_ID,
        system: srdSystemRecord
      })
    ).toThrow(`Quill Volley is unavailable: ${missingAttackRoll}`)
  })

  it('offers no opportunity attack from a Creature its summon says cannot attack', () => {
    const attack = quillVolley({ charges: 1, cost: 1, rangeFeet: 30 })
    const familiar = creatureActor({ id: SOURCE_ID, label: 'Familiar', features: [attack] })
    const free = creatureActor({ id: TARGET_ID, label: 'Quill Beast', features: [attack] })
    const { state, movementTargets } = creatureEncounter<ProjectableCharacterFacts>([
      {
        ...familiar,
        snapshot: {
          ...(familiar.snapshot as Record<string, unknown>),
          body: summonBody({ occupiesSpace: true }, true)
        }
      },
      free
    ])
    const reactionFacts = buildEncounterMovementReactionFacts({
      spells: new Map(),
      state,
      userId: SOURCE_ID,
      campaignOwnerUserId: SOURCE_ID,
      targets: movementTargets,
      system: srdSystemRecord,
      definitions: {
        requireCurrent: async () => {
          throw new Error('No reusable definitions are read.')
        }
      }
    })
    expect(
      reactionFacts.encounterFeatureCapabilities.map((capability) => capability.encounterActorId)
    ).toEqual([TARGET_ID])
  })

  it("keeps one Creature's invalid action from stopping the rest of the Encounter moving and acting", async () => {
    const attack = quillVolley({ charges: 1, cost: 1, rangeFeet: 30 })
    const broken = creatureActor({
      id: SOURCE_ID,
      label: 'Homebrew Beast',
      features: [{ ...attack, rollDefinitions: [] }]
    })
    const working = creatureActor({ id: TARGET_ID, label: 'Quill Beast', features: [attack] })
    const { state, movementTargets } = creatureEncounter<ProjectableCharacterFacts>([
      broken,
      working
    ])

    const reactionFacts = buildEncounterMovementReactionFacts({
      spells: new Map(),
      state,
      userId: SOURCE_ID,
      campaignOwnerUserId: SOURCE_ID,
      targets: movementTargets,
      system: srdSystemRecord,
      definitions: {
        requireCurrent: async () => {
          throw new Error('No reusable definitions are read.')
        }
      }
    })
    expect(
      reactionFacts.encounterFeatureCapabilities.map((capability) => capability.encounterActorId)
    ).toEqual([TARGET_ID])

    const prepared = await prepareCreatureAction({
      actor: working,
      target: broken,
      featureId: QUILL_VOLLEY_ID,
      overridable: true
    })
    const { mechanics } = await settleCreatureAction({ prepared, rolls: [14] })
    expect(mechanics.targetPlan.updatedActor).toMatchObject({ currentHitPoints: 8 })
  })

  it('needs no ATTACK roll for an action that is not an attack', () => {
    const actor = creatureActor({
      id: SOURCE_ID,
      label: 'Quill Beast',
      features: [quillVolley({ charges: 1, cost: 1 })]
    })

    expect(featureActionId(actor, QUILL_VOLLEY_ID)).toEqual(expect.any(String))
  })
})

describe('encounter action mechanics preparation: held-only targeting (ATTACK-7.2)', () => {
  it('refuses a target the user does not hold', async () => {
    const engulf = shamblingMound.features.find(({ label }) => label === 'Engulf')
    if (!engulf) throw new Error('The Shambling Mound authors no Engulf.')
    const actor = creatureActor({
      id: SOURCE_ID,
      label: 'Shambling Mound',
      statBlock: shamblingMound,
      features: shamblingMound.features
    })
    const target = creatureActor({ id: TARGET_ID, label: 'Wolf', features: [] })

    await expect(
      prepareCreatureAction({ actor, target, featureId: engulf.id, overridable: true })
    ).rejects.toThrow(EncounterValidationError)
  })
})
