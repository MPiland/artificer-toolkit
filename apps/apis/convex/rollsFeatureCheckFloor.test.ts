// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { rogue } from '@artificer-toolkit/source-data/srd/classes/rogue.js'
import { halfOrc } from '@artificer-toolkit/source-data/srd/races/half-orc.js'
import { SRD_SKILLS } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { readySheetFixture } from '../tests/fixtures/readyCharacter'
import { api } from './_generated/api'

function srdFeature<T extends { label: string }>(
  features: readonly T[] | undefined,
  label: string
) {
  const found = features?.find((entry) => entry.label === label)
  if (!found) throw new Error(`The SRD has no ${label}.`)
  return structuredClone(found)
}

/** Reliable Talent at 1st level, beside full Intimidation (Menacing) and half Persuasion. */
async function reliableCharacter() {
  const reliableTalent = { ...srdFeature(rogue.features, 'Reliable Talent'), availableAtLevel: 1 }
  const menacing = srdFeature(halfOrc.features, 'Menacing')
  const [grant] = menacing.grants?.proficiencies ?? []
  if (grant?.proficiencyKind !== 'SKILL' || !('skillIds' in grant))
    throw new Error('Menacing must grant a skill proficiency.')
  const persuasion = SRD_SKILLS.find(({ code }) => code === 'PERSUASION')!.id
  const halfPersuasion = {
    ...menacing,
    id: crypto.randomUUID(),
    label: 'Half Persuasion',
    grants: {
      proficiencies: [
        { ...grant, id: crypto.randomUUID(), level: 'HALF' as const, skillIds: [persuasion] }
      ]
    }
  }
  const base = await readySheetFixture({ features: [reliableTalent, menacing, halfPersuasion] })
  const { owner, character } = base
  const skillCheck = async (label: string) => {
    const sheet = (await owner.caller.query(api.characters.sheet.get, { id: character.id }))!
    const skill = sheet.overview.skills.find((row) => row.label === label)!
    return {
      proficiency: skill.proficiency,
      record: await owner.caller.mutation(api.rolls.execute, {
        characterId: character.id,
        rollMode: skill.rollMode,
        expression:
          skill.total === 0
            ? '1d20'
            : `1d20 ${skill.total > 0 ? '+' : '-'} ${Math.abs(skill.total)}`,
        source: { kind: 'SKILL_CHECK', label: `${skill.label} check` }
      })
    }
  }
  return { skillCheck }
}

const d20Of = (record: {
  evidence: { terms: readonly { die: number; subtotal: number; rolls: readonly number[] }[] }
}) => record.evidence.terms.find(({ die }) => die === 20)!

/** SPELLS-31.T5c: a feature's floor (Reliable Talent) lifts only checks that add full proficiency. */
describe("a Character feature's d20 floor on a Sheet roll", () => {
  it('counts a proficient skill check’s d20 as at least 10 and records Reliable Talent', async () => {
    const { skillCheck } = await reliableCharacter()
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const { proficiency, record } = await skillCheck('Intimidation')
      expect(proficiency).toBe('FULL')
      const d20 = d20Of(record)
      expect(d20.subtotal).toBe(Math.max(d20.rolls[0]!, 10))
      expect(record.ruleCheck).toEqual(
        d20.rolls[0]! < 10
          ? { kind: 'D20_MINIMUM_ROLL', amount: 10, label: 'Reliable Talent' }
          : undefined
      )
    }
  })

  it('leaves a half-proficient and a non-proficient skill check as rolled', async () => {
    const { skillCheck } = await reliableCharacter()
    const half = await skillCheck('Persuasion')
    expect(half.proficiency).toBe('HALF')
    const none = await skillCheck('Deception')
    expect(none.proficiency).toBe('NONE')
    for (const { record } of [half, none]) {
      expect(d20Of(record).subtotal).toBe(d20Of(record).rolls[0])
      expect(record.ruleCheck).toBeUndefined()
    }
  })
})
