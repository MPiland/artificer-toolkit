import { describe, expect, it } from 'vitest'

import type { EffectAuthored } from '@artificer-toolkit/shared/authored'
import { bard } from '@artificer-toolkit/source-data/srd/classes/bard.js'
import { CLASS_IDS } from '@artificer-toolkit/source-data/srd/ids.js'

import {
  activeAfterRollAbilityCheckDice,
  activeAfterRollSavingThrowDice
} from '../character/activeEffectGrantTotals.js'
import { ENCOUNTER_ID, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { plannedModifierGrant } from '../testing/modifierGrantFixture.js'

/**
 * D168: a die whose size rises with the granting creature's class level is settled when the grant is
 * applied and frozen into the holder's stored grant. The Bardic Inspiration proof runs the SRD
 * feature's own effect; the homebrew proof runs a different die, class and levels through the same code.
 */

const GRANTER_ID = testUuid(0xb001)
const HOLDER_ID = testUuid(0xb002)

const bardicInspiration: EffectAuthored = (() => {
  const effect = bard.features?.find(({ label }) => label === 'Bardic Inspiration')?.effects?.[0]
  if (!effect) throw new Error('The SRD Bardic Inspiration effect is missing.')
  return effect
})()

function grantedTo(effect: EffectAuthored, sourceClassLevels: Record<string, number>) {
  const planned = plannedModifierGrant({
    encounterId: ENCOUNTER_ID,
    sourceActorId: GRANTER_ID,
    holderActorId: HOLDER_ID,
    lifecycle: {},
    effect,
    sourceLabel: 'Inspiration',
    sourceClassLevels
  })
  return [{ id: testUuid(0xb003), definition: planned.definition }]
}

const diceOf = (effects: ReturnType<typeof grantedTo>) => ({
  check: activeAfterRollAbilityCheckDice(effects, 'STRENGTH'),
  save: activeAfterRollSavingThrowDice(effects, 'STRENGTH')
})

describe('Bardic Inspiration die (D168)', () => {
  it.each([
    [1, 6],
    [4, 6],
    [5, 8],
    [9, 8],
    [10, 10],
    [14, 10],
    [15, 12],
    [20, 12]
  ])('a level %i Bard gives a d%i to a check and to a save', (bardLevel, faces) => {
    const { check, save } = diceOf(grantedTo(bardicInspiration, { [CLASS_IDS.BARD]: bardLevel }))
    expect(check).toMatchObject([{ count: 1, faces, sign: 'ADD' }])
    expect(save).toMatchObject([{ count: 1, faces, sign: 'ADD' }])
  })

  it('gives the base die to a granter with no Bard level, and keeps no scaling in the stored grant', () => {
    const effects = grantedTo(bardicInspiration, {})
    expect(diceOf(effects).check).toMatchObject([{ faces: 6 }])
    expect(JSON.stringify(effects[0]!.definition)).not.toContain('facesScaling')
  })

  it('freezes the die: it ignores a later change to the granter level', () => {
    const effects = grantedTo(bardicInspiration, { [CLASS_IDS.BARD]: 5 })
    const frozen = diceOf(effects).check
    expect(frozen).toMatchObject([{ faces: 8 }])
    // Reading again after the Bard has reached 10th level reads the same stored grant.
    expect(diceOf(effects).check).toEqual(frozen)
  })
})

describe('homebrew scaled die through the same path', () => {
  it('rolls two dice that grow with a Cleric, on a save only', () => {
    const homebrew = structuredClone(bardicInspiration)
    for (const path of homebrew.paths)
      if (path.selectionKind === 'FIXED')
        for (const outcome of path.resultBlock.outcomes)
          if (outcome.effectKind === 'APPLY_GRANT') {
            outcome.grants.modifiers = (outcome.grants.modifiers ?? []).filter(
              ({ valueDomainCode }) => valueDomainCode === 'SAVING_THROW_MODIFIER'
            )
            for (const modifier of outcome.grants.modifiers)
              modifier.payload = {
                count: 2,
                faces: 4,
                sign: 'ADD',
                timing: 'AFTER_ROLL',
                facesScaling: {
                  classId: CLASS_IDS.CLERIC,
                  levels: [
                    { level: 3, faces: 6 },
                    { level: 9, faces: 12 }
                  ]
                }
              }
          }
    const at = (clericLevel: number) =>
      diceOf(grantedTo(homebrew, { [CLASS_IDS.CLERIC]: clericLevel, [CLASS_IDS.BARD]: 20 }))
    expect(at(2).save).toMatchObject([{ count: 2, faces: 4 }])
    expect(at(3).save).toMatchObject([{ count: 2, faces: 6 }])
    expect(at(9).save).toMatchObject([{ count: 2, faces: 12 }])
    expect(at(9).check).toEqual([])
  })
})

describe('an unsettled scaled die', () => {
  it('is refused when read, instead of rolling a guessed size', () => {
    const [effect] = grantedTo(bardicInspiration, { [CLASS_IDS.BARD]: 5 })
    const unsettled = structuredClone(effect!)
    for (const contribution of unsettled.definition.stateContributions)
      if (contribution.kind === 'MODIFIER_GRANT')
        for (const modifier of contribution.modifiers)
          if (modifier.payload && 'faces' in modifier.payload)
            modifier.payload = {
              ...modifier.payload,
              facesScaling: { classId: CLASS_IDS.BARD, levels: [{ level: 5, faces: 8 }] }
            }
    expect(() => activeAfterRollAbilityCheckDice([unsettled], 'STRENGTH')).toThrow(
      'die size settled when applied'
    )
  })
})
