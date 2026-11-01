import type { SpellAuthored } from '@artificer-toolkit/shared'
import { describe, expect, it } from 'vitest'
import { srdBaselineContent } from './index.js'
import { SRD_CHALLENGE_RATINGS, SRD_CREATURE_TYPES } from './vocabulary.js'
import { conjureAnimals } from './spells/conjure-animals.js'
import { conjureMinorElementals } from './spells/conjure-minor-elementals.js'
import { conjureWoodlandBeings } from './spells/conjure-woodland-beings.js'

const crValue = (id: string | undefined) => {
  const rating = SRD_CHALLENGE_RATINGS.find((candidate) => candidate.id === id)
  if (!rating) throw new Error('A Creature has no challenge rating.')
  return rating.value
}
const typeId = (code: string) => {
  const type = SRD_CREATURE_TYPES.find((candidate) => candidate.code === code)
  if (!type) throw new Error(`Creature type ${code} is missing.`)
  return type.id
}
/** How many of a creature one cast conjures: the SRD's challenge rating budget of one CR 2. */
const groupSize = (value: number) => (value >= 2 ? 1 : value >= 1 ? 2 : value >= 0.5 ? 4 : 8)

function forms(spell: SpellAuthored) {
  const outcome = spell.effects
    ?.flatMap((effect) => effect.paths)
    .flatMap((path) => (path.selectionKind === 'FIXED' ? path.resultBlock.outcomes : []))
    .find((candidate) => candidate.effectKind === 'MANIFEST' && candidate.manifestKind === 'SUMMON')
  if (outcome?.effectKind !== 'MANIFEST') throw new Error(`${spell.label} has no summon.`)
  return outcome.forms ?? []
}

describe('multi-creature Conjure forms (SPELLS-35.T7)', () => {
  it.each([
    { spell: conjureAnimals, type: 'BEAST' },
    { spell: conjureMinorElementals, type: 'ELEMENTAL' },
    { spell: conjureWoodlandBeings, type: 'FEY' }
  ])(
    '$spell.label offers every $type of challenge rating 2 or lower, in groups sized by that rating',
    ({ spell, type }) => {
      const expected = srdBaselineContent.subjects.creatures
        .filter(
          (creature) =>
            creature.creatureTypeId === typeId(type) && crValue(creature.challengeRatingId) <= 2
        )
        .map((creature) => ({
          creatureId: creature.id,
          label: creature.label,
          maxTargets: groupSize(crValue(creature.challengeRatingId))
        }))
      const offered = forms(spell).map(({ creatureId, label, maxTargets }) => ({
        creatureId,
        label,
        maxTargets
      }))
      const byLabel = (left: { label: string }, right: { label: string }) =>
        left.label.localeCompare(right.label)
      expect(offered.sort(byLabel)).toEqual(expected.sort(byLabel))
    }
  )
})
