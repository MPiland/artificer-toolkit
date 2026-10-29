// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { bless } from '@artificer-toolkit/source-data/srd/spells/bless.js'
import { glibness } from '@artificer-toolkit/source-data/srd/spells/glibness.js'
import { guidance } from '@artificer-toolkit/source-data/srd/spells/guidance.js'
import { resistance } from '@artificer-toolkit/source-data/srd/spells/resistance.js'
import { equipAllCharacterItems, setupCharacterRun } from '../tests/fixtures/encounterCharacter'
import { api } from './_generated/api'
import { createConvexEncounterStore } from './lib/convexEncounterStore'

type CarriedSpell = typeof guidance | typeof resistance | typeof glibness | typeof bless

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
  const abilityCheck = async (ability: 'STRENGTH' | 'CHARISMA') => {
    const sheet = (await player.caller.query(api.characters.sheet.get, { id: character.id }))!
    const { modifier, rollMode } = sheet.overview.abilities.find((row) => row.ability === ability)!
    return player.caller.mutation(api.rolls.execute, {
      characterId: character.id,
      rollMode,
      expression:
        modifier === 0 ? '1d20' : `1d20 ${modifier > 0 ? '+' : '-'} ${Math.abs(modifier)}`,
      source: {
        kind: 'ABILITY_CHECK',
        label: `${ability === 'STRENGTH' ? 'Strength' : 'Charisma'} check`
      }
    })
  }
  const strengthCheck = () => abilityCheck('STRENGTH')
  const initiative = async () => {
    const sheet = (await player.caller.query(api.characters.sheet.get, { id: character.id }))!
    const modifier = sheet.overview.initiative
    return player.caller.mutation(api.rolls.execute, {
      characterId: character.id,
      rollMode: sheet.overview.initiativeRollMode,
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
      rollMode: save.rollMode,
      expression:
        save.total === 0 ? '1d20' : `1d20 ${save.total > 0 ? '+' : '-'} ${Math.abs(save.total)}`,
      source: { kind: 'SAVING_THROW', label: `${save.label} saving throw` }
    })
  }
  const attackRow = async () => {
    const sheet = (await player.caller.query(api.characters.sheet.get, { id: character.id }))!
    const row = sheet.actions.items.find((action) => action.mechanic?.attackBonus != null)
    if (row?.mechanic?.attackBonus == null) throw new Error('The Character has no attack row.')
    return { label: row.label, mechanic: row.mechanic, attackBonus: row.mechanic.attackBonus }
  }
  const attack = async () => {
    const { label, mechanic, attackBonus } = await attackRow()
    return player.caller.mutation(api.rolls.execute, {
      characterId: character.id,
      rollMode: mechanic.attackRollMode,
      expression:
        attackBonus === 0 ? '1d20' : `1d20 ${attackBonus > 0 ? '+' : '-'} ${Math.abs(attackBonus)}`,
      source: { kind: 'ATTACK', label: `${label} attack` }
    })
  }
  const equipWeapons = () => equipAllCharacterItems(base)
  return {
    effectCount,
    abilityCheck,
    strengthCheck,
    initiative,
    savingThrow,
    equipWeapons,
    attackRow,
    attack
  }
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

/** SPELLS-4.T2c3: a floor the Character carries (Glibness) lifts its d20 on the checks it names, and is not spent. */
describe('a carried d20 floor on a Sheet roll', () => {
  const d20Of = (
    record: Awaited<ReturnType<Awaited<ReturnType<typeof characterCarrying>>['strengthCheck']>>
  ) => record.evidence.terms.find(({ die }) => die === 20)!

  it('counts a Charisma check’s d20 as at least the floor and records the floor', async () => {
    const { abilityCheck, effectCount } = await characterCarrying(glibness)
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const record = await abilityCheck('CHARISMA')
      const d20 = d20Of(record)
      expect(d20.subtotal).toBe(Math.max(d20.rolls[0]!, 15))
      expect(record.evidence.total).toBe(
        record.evidence.terms.reduce(
          (total, term) => total + term.subtotal,
          record.evidence.modifier
        )
      )
      expect(record.ruleCheck).toEqual(
        d20.rolls[0]! < 15 ? { kind: 'D20_MINIMUM_ROLL', amount: 15, label: 'Glibness' } : undefined
      )
    }
    expect(await effectCount()).toBe(1)
  })

  it('leaves a check of another ability, and a saving throw, as rolled', async () => {
    const { abilityCheck, savingThrow } = await characterCarrying(glibness)
    for (const record of [await abilityCheck('STRENGTH'), await savingThrow('STRENGTH')]) {
      expect(d20Of(record).subtotal).toBe(d20Of(record).rolls[0])
      expect(record.ruleCheck).toBeUndefined()
    }
  })
})

/** SPELLS-8.6: the Sheet's attack row shows the die an active grant (Bless) adds, and its roll adds it. */
describe('an active attack-roll die on the Sheet', () => {
  it('shows the die on the attack row and adds it to every attack roll, unspent', async () => {
    const { equipWeapons, attackRow, attack, effectCount } = await characterCarrying(bless)
    await equipWeapons()
    expect((await attackRow()).mechanic.attackAddedDice).toEqual([
      { label: 'Bless', count: 1, faces: 4, sign: 'ADD' }
    ])
    for (const record of [await attack(), await attack()]) {
      expect(d4Terms(record)).toHaveLength(1)
      expect(record.normalizedExpression).toMatch(/\+ 1d4$/)
    }
    expect(await effectCount()).toBe(1)
  })
})
