// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { guidance } from '@artificer-toolkit/source-data/srd/spells/guidance.js'
import { resistance } from '@artificer-toolkit/source-data/srd/spells/resistance.js'
import { setupCharacterRun } from '../tests/fixtures/encounterCharacter'
import { api } from './_generated/api'
import { createConvexEncounterStore } from './lib/convexEncounterStore'

type CarriedSpell = typeof guidance | typeof resistance

/** The spell's one effect, its die limited to `ability` when given. */
function carriedEffect(spell: CarriedSpell, ability?: 'DEXTERITY') {
  const effect = structuredClone(spell.effects![0]!)
  for (const path of effect.paths)
    if (path.selectionKind === 'FIXED')
      for (const outcome of path.resultBlock.outcomes)
        if (outcome.effectKind === 'APPLY_GRANT' && ability)
          for (const modifier of outcome.grants.modifiers ?? []) modifier.domain = { ability }
  return effect
}

async function characterCarrying(spell: CarriedSpell, ability?: 'DEXTERITY') {
  const base = await setupCharacterRun()
  const { t, run, actor, character, player } = base
  await t.run((ctx) =>
    createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).create({
      id: crypto.randomUUID(),
      owner: { kind: 'CHARACTER', characterId: character.id },
      definition: plannedModifierGrant({
        encounterId: run.id,
        sourceActorId: actor.id,
        holderActorId: actor.id,
        lifecycle: {},
        effect: carriedEffect(spell, ability),
        sourceLabel: spell.label,
        rounds: 10,
        lifetimeScope: 'OWNER'
      }).definition,
      lifecycle: { schemaVersion: 1, remainingTicks: 10 }
    })
  )
  const effectCount = () =>
    t.run(
      async (ctx) =>
        (
          await ctx.db
            .query('characterActiveRuleEffects')
            .withIndex('by_characterId_id', (q) => q.eq('characterId', character.id))
            .collect()
        ).length
    )
  const strengthCheck = async () => {
    const sheet = (await player.caller.query(api.characters.sheet.get, { id: character.id }))!
    const modifier = sheet.overview.abilities.find(
      ({ ability }) => ability === 'STRENGTH'
    )!.modifier
    return player.caller.mutation(api.rolls.execute, {
      characterId: character.id,
      expression:
        modifier === 0 ? '1d20' : `1d20 ${modifier > 0 ? '+' : '-'} ${Math.abs(modifier)}`,
      source: { kind: 'ABILITY_CHECK', label: 'Strength check' }
    })
  }
  const initiative = async () => {
    const sheet = (await player.caller.query(api.characters.sheet.get, { id: character.id }))!
    const modifier = sheet.overview.initiative
    return player.caller.mutation(api.rolls.execute, {
      characterId: character.id,
      expression:
        modifier === 0 ? '1d20' : `1d20 ${modifier > 0 ? '+' : '-'} ${Math.abs(modifier)}`,
      source: { kind: 'INITIATIVE', label: 'Initiative' }
    })
  }
  const savingThrow = async (ability: 'STRENGTH' | 'DEXTERITY') => {
    const sheet = (await player.caller.query(api.characters.sheet.get, { id: character.id }))!
    const save = sheet.overview.savingThrows.find((row) => row.ability === ability)!
    return player.caller.mutation(api.rolls.execute, {
      characterId: character.id,
      expression:
        save.total === 0 ? '1d20' : `1d20 ${save.total > 0 ? '+' : '-'} ${Math.abs(save.total)}`,
      source: { kind: 'SAVING_THROW', label: `${save.label} saving throw` }
    })
  }
  return { effectCount, strengthCheck, initiative, savingThrow }
}

const d4Terms = (record: { evidence: { terms: readonly { die: number }[] } }) =>
  record.evidence.terms.filter(({ die }) => die === 4)

/** D156: a die the Character carries (Guidance) joins its next ability check, and that check spends it. */
describe('a carried ability-check die on a Sheet roll', () => {
  const guidedCharacter = () => characterCarrying(guidance)

  it('adds the die to the first ability check and spends it', async () => {
    const { effectCount, strengthCheck } = await guidedCharacter()
    expect(await effectCount()).toBe(1)

    const first = await strengthCheck()
    const [die] = d4Terms(first)
    expect(die).toBeDefined()
    expect(first.normalizedExpression).toMatch(/\+ 1d4$/)
    expect(first.evidence.total).toBe(
      first.evidence.terms.reduce((total, term) => total + term.subtotal, first.evidence.modifier)
    )
    expect(await effectCount()).toBe(0)

    expect(d4Terms(await strengthCheck())).toEqual([])
  })

  it('keeps the die through a roll that is not an ability check', async () => {
    const { effectCount, initiative, strengthCheck } = await guidedCharacter()
    expect(d4Terms(await initiative())).toEqual([])
    expect(await effectCount()).toBe(1)
    expect(d4Terms(await strengthCheck())).toHaveLength(1)
  })
})

/** D156: a die the Character carries (Resistance) joins its next saving throw, and that save spends it. */
describe('a carried saving-throw die on a Sheet roll', () => {
  it('adds the die to the first saving throw and spends it', async () => {
    const { effectCount, savingThrow } = await characterCarrying(resistance)
    expect(await effectCount()).toBe(1)

    const first = await savingThrow('STRENGTH')
    expect(d4Terms(first)).toHaveLength(1)
    expect(first.normalizedExpression).toMatch(/\+ 1d4$/)
    expect(await effectCount()).toBe(0)

    expect(d4Terms(await savingThrow('STRENGTH'))).toEqual([])
  })

  it('keeps a Dexterity-only die through a Strength save, and spends it on a Dexterity save', async () => {
    const { effectCount, savingThrow } = await characterCarrying(resistance, 'DEXTERITY')
    expect(d4Terms(await savingThrow('STRENGTH'))).toEqual([])
    expect(await effectCount()).toBe(1)
    expect(d4Terms(await savingThrow('DEXTERITY'))).toHaveLength(1)
    expect(await effectCount()).toBe(0)
  })

  it('keeps a saving-throw die through an ability check', async () => {
    const { effectCount, strengthCheck } = await characterCarrying(resistance)
    expect(d4Terms(await strengthCheck())).toEqual([])
    expect(await effectCount()).toBe(1)
  })
})
