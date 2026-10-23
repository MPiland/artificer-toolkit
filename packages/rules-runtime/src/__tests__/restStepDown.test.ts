import type { CharacterRestPreviewRequestDto } from '@artificer-toolkit/schema/api/characterSheetCommands'
import { activeRuleEffectStateDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { raiseDead } from '@artificer-toolkit/source-data/srd/spells/raise-dead.js'
import { describe, expect, it } from 'vitest'

import { prepareActiveRuleEffectRecord } from '../activeRuleEffectRecords.js'
import {
  listSteppedDownEffects,
  restStepDownOutcome,
  steppedDownEffectState
} from '../character/restStepDown.js'
import { activeEffectEndsOnRest, buildCharacterRestPreview } from '../character/sheetRest.js'
import {
  prepareFixtureBuilder,
  prepareFixtureSheet,
  readyFighterFixture,
  restParamsFromFixtureSheet
} from '../testing/characterContextFixtures.js'
import { plannedTimedCondition } from '../testing/plannedTimedCondition.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'

const shortRest = {
  restKind: 'SHORT',
  expectedVersion: 1,
  selectedHitDice: [],
  resetMaximumHitPointModifier: false,
  healingMode: 'AUTOMATIC',
  manualHealingAccepted: false,
  selectedCompanionInstanceIds: [],
  requestRoll: false
} satisfies CharacterRestPreviewRequestDto

const longRest = { ...shortRest, restKind: 'LONG' } satisfies CharacterRestPreviewRequestDto

/** The penalty Raise Dead plans against a Character, as the effect store would hold it. */
function returnedFromDeath() {
  const planned = plannedTimedCondition({
    encounterId: testUuid(0xe101),
    sourceActorId: testUuid(0xe102),
    holderActorId: testUuid(0xe103),
    spell: raiseDead,
    lifetimeScope: 'OWNER'
  })
  return prepareActiveRuleEffectRecord({
    id: testUuid(0xe104),
    owner: { kind: 'CHARACTER', characterId: testUuid(0xe103) },
    definition: planned.definition,
    lifecycle: planned.lifecycle,
    currentEffects: [],
    occurredAt: '2026-10-22T00:00:00.000Z'
  })
}

const amountsOf = (effect: ReturnType<typeof returnedFromDeath>) =>
  effect.definition.stateContributions.flatMap((contribution) =>
    contribution.kind === 'MODIFIER_GRANT'
      ? contribution.modifiers.map(({ payload }) =>
          payload && 'amount' in payload ? payload.amount : null
        )
      : []
  )

describe('a grant that steps down with long rests', () => {
  it('starts at the authored amount and counts one rest per step', () => {
    const effect = returnedFromDeath()
    expect(effect.definition.recurrence.restStepDown).toEqual({ trigger: 'LONG_REST', step: 1 })
    expect(effect.lifecycle.restStepsRemaining).toBe(4)
    expect(new Set(amountsOf(effect))).toEqual(new Set([4]))
  })

  it('steps down by one on each long rest and ends on the fourth', () => {
    let effect = returnedFromDeath()
    const seen: Array<{ amounts: number[]; outcome: string | null }> = []
    for (let rest = 0; rest < 4; rest += 1) {
      const outcome = restStepDownOutcome(effect, 'LONG')
      seen.push({ amounts: [...new Set(amountsOf(effect))] as number[], outcome })
      if (outcome === 'END') break
      effect = { ...effect, ...steppedDownEffectState(effect) }
    }
    expect(seen).toEqual([
      { amounts: [4], outcome: 'STEP' },
      { amounts: [3], outcome: 'STEP' },
      { amounts: [2], outcome: 'STEP' },
      { amounts: [1], outcome: 'END' }
    ])
  })

  it('keeps every stepped state a valid stored effect', () => {
    const effect = returnedFromDeath()
    expect(activeRuleEffectStateDtoSchema.safeParse(steppedDownEffectState(effect)).success).toBe(
      true
    )
  })

  it('leaves the effect alone on a short rest', () => {
    const effect = returnedFromDeath()
    expect(restStepDownOutcome(effect, 'SHORT')).toBeNull()
    expect(activeEffectEndsOnRest(effect, 'SHORT')).toBe(false)
    expect(listSteppedDownEffects([effect], 'SHORT')).toEqual([])
  })

  it('deletes the effect only when the last step is taken, and still previews it', () => {
    const effect = returnedFromDeath()
    expect(activeEffectEndsOnRest(effect, 'LONG')).toBe(false)
    expect(listSteppedDownEffects([effect], 'LONG')).toEqual([effect])
    const last = {
      ...effect,
      lifecycle: { ...effect.lifecycle, restStepsRemaining: 1 }
    }
    expect(activeEffectEndsOnRest(last, 'LONG')).toBe(true)
    expect(listSteppedDownEffects([last], 'LONG')).toEqual([last])
  })

  it('refuses to step an effect that does not step down', () => {
    const { definition, lifecycle } = returnedFromDeath()
    const { restStepDown: _removed, ...recurrence } = definition.recurrence
    expect(() =>
      steppedDownEffectState({ definition: { ...definition, recurrence }, lifecycle })
    ).toThrow('does not step down')
  })
})

describe('the rest preview lists stepped-down effects', () => {
  async function fighter() {
    const fixture = readyFighterFixture()
    const { character } = await prepareFixtureBuilder(fixture)
    return restParamsFromFixtureSheet(await prepareFixtureSheet({ ...fixture, character }))
  }

  it('names a penalty a long rest will lift and changes the fingerprint', async () => {
    const params = await fighter()
    const effect = returnedFromDeath()
    const without = await buildCharacterRestPreview({ ...params, input: longRest })
    const preview = await buildCharacterRestPreview({
      ...params,
      activeEffects: [effect],
      input: longRest
    })
    expect(without.steppedDownEffects).toEqual([])
    expect(preview.steppedDownEffects).toEqual([{ id: effect.id, label: 'Raise Dead' }])
    expect(preview.previewFingerprint).not.toBe(without.previewFingerprint)
    expect(preview.canApply).toBe(true)
  })

  it('lists nothing for a short rest', async () => {
    const params = await fighter()
    const preview = await buildCharacterRestPreview({
      ...params,
      activeEffects: [returnedFromDeath()],
      input: shortRest
    })
    expect(preview.steppedDownEffects).toEqual([])
  })
})
