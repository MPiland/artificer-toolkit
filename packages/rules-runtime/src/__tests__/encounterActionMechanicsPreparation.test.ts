import { describe, expect, it } from 'vitest'

import { featureChargeUsed } from '../encounterActorState.js'
import {
  QUILL_VOLLEY_CHARGE_ID,
  QUILL_VOLLEY_ID,
  creatureActor,
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
  it('rejects an attack-triggered Feature action that authors no ATTACK roll', () => {
    const attack = quillVolley({ charges: 1, cost: 1, rangeFeet: 30 })
    const withRoll = creatureActor({ id: SOURCE_ID, label: 'Quill Beast', features: [attack] })
    const withoutRoll = creatureActor({
      id: SOURCE_ID,
      label: 'Quill Beast',
      features: [{ ...attack, rollDefinitions: [] }]
    })

    expect(featureActionId(withRoll, QUILL_VOLLEY_ID)).toEqual(expect.any(String))
    expect(() => featureActionId(withoutRoll, QUILL_VOLLEY_ID)).toThrow(
      'Encounter feature attack action "Quill Volley" must author exactly one ATTACK roll definition.'
    )
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
