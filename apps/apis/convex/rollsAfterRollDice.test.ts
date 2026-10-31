// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { guidance } from '@artificer-toolkit/source-data/srd/spells/guidance.js'
import { resistance } from '@artificer-toolkit/source-data/srd/spells/resistance.js'
import { setupCharacterRun } from '../tests/fixtures/encounterCharacter'
import { api } from './_generated/api'
import { createConvexEncounterStore } from './lib/convexEncounterStore'

type HeldSpell = typeof guidance | typeof resistance

/** The spell's one effect, its die authored to be offered after the d20 and limited to `ability` when given. */
function heldAfterRoll(spell: HeldSpell, change: { ability?: 'DEXTERITY'; count?: number } = {}) {
  const effect = structuredClone(spell.effects![0]!)
  for (const path of effect.paths)
    if (path.selectionKind === 'FIXED')
      for (const outcome of path.resultBlock.outcomes)
        if (outcome.effectKind === 'APPLY_GRANT')
          for (const modifier of outcome.grants.modifiers ?? []) {
            if (modifier.modifierKind !== 'ADD_BONUS_DIE') continue
            modifier.payload = {
              ...modifier.payload,
              ...(change.count === undefined ? {} : { count: change.count }),
              timing: 'AFTER_ROLL'
            }
            if (change.ability) modifier.domain = { ability: change.ability }
          }
  return effect
}

async function characterHolding(spell: HeldSpell, change?: Parameters<typeof heldAfterRoll>[1]) {
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
        effect: heldAfterRoll(spell, change),
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
  const sheet = async () =>
    (await player.caller.query(api.characters.sheet.get, { id: character.id }))!
  const abilityCheck = async (ability: 'STRENGTH' | 'CHARISMA') => {
    const { modifier, rollMode } = (await sheet()).overview.abilities.find(
      (row) => row.ability === ability
    )!
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
  const savingThrow = async (ability: 'STRENGTH' | 'DEXTERITY') => {
    const save = (await sheet()).overview.savingThrows.find((row) => row.ability === ability)!
    return player.caller.mutation(api.rolls.execute, {
      characterId: character.id,
      rollMode: save.rollMode,
      expression:
        save.total === 0 ? '1d20' : `1d20 ${save.total > 0 ? '+' : '-'} ${Math.abs(save.total)}`,
      source: { kind: 'SAVING_THROW', label: `${save.label} saving throw` }
    })
  }
  const initiative = async () => {
    const modifier = (await sheet()).overview.initiative
    return player.caller.mutation(api.rolls.execute, {
      characterId: character.id,
      expression:
        modifier === 0 ? '1d20' : `1d20 ${modifier > 0 ? '+' : '-'} ${Math.abs(modifier)}`,
      source: { kind: 'INITIATIVE', label: 'Initiative' }
    })
  }
  const history = () => player.caller.query(api.rolls.history, {})
  return {
    ...base,
    abilityCheck,
    savingThrow,
    initiative,
    effectCount,
    history,
    add: (offer: { id: string; effectId: string; grantId: string }) =>
      player.caller.mutation(api.rolls.addAfterRollDie, offer),
    decline: (id: string) => player.caller.mutation(api.rolls.declineAfterRollDice, { id })
  }
}

const d4Terms = (record: { evidence: { terms: readonly { die: number }[] } }) =>
  record.evidence.terms.filter(({ die }) => die === 4)

/** D168: a die the Character holds for after the roll is offered once the d20 is seen, not rolled with it. */
describe('a held ability-check die offered after a Sheet roll', () => {
  it('rolls the check without the die and offers it, spending nothing', async () => {
    const { abilityCheck, effectCount } = await characterHolding(guidance)
    const record = await abilityCheck('STRENGTH')
    expect(d4Terms(record)).toEqual([])
    expect(record.afterRollOffers).toEqual([
      expect.objectContaining({ label: guidance.label, count: 1, faces: 4, sign: 'ADD' })
    ])
    expect(await effectCount()).toBe(1)
  })

  it('adds the die to the roll when used, spends it and keeps the total consistent', async () => {
    const { abilityCheck, effectCount, add, history } = await characterHolding(guidance)
    const rolled = await abilityCheck('STRENGTH')
    const [offer] = rolled.afterRollOffers!
    const used = await add({ id: rolled.id, effectId: offer!.effectId, grantId: offer!.grantId })

    const [die] = d4Terms(used)
    expect(die).toBeDefined()
    expect(used.normalizedExpression).toMatch(/\+ 1d4$/)
    expect(used.evidence.total).toBe(rolled.evidence.total + die!.subtotal)
    expect(used.evidence.total).toBe(
      used.evidence.terms.reduce((total, term) => total + term.subtotal, used.evidence.modifier)
    )
    expect(used.afterRollOffers).toBeUndefined()
    expect(await effectCount()).toBe(0)
    expect((await history())[0]).toEqual(
      expect.objectContaining({ id: rolled.id, evidence: used.evidence })
    )
  })

  it('keeps the roll and the die when declined, and offers it for the next roll', async () => {
    const { abilityCheck, effectCount, decline } = await characterHolding(guidance)
    const rolled = await abilityCheck('STRENGTH')
    const kept = await decline(rolled.id)
    expect(kept.evidence).toEqual(rolled.evidence)
    expect(kept.afterRollOffers).toBeUndefined()
    expect(await effectCount()).toBe(1)
    expect((await abilityCheck('STRENGTH')).afterRollOffers).toHaveLength(1)
  })

  it('refuses a second use, a die the roll did not offer, a declined roll and an older roll', async () => {
    const { abilityCheck, add, decline } = await characterHolding(guidance)
    const first = await abilityCheck('STRENGTH')
    const [offer] = first.afterRollOffers!
    const ask = (id: string, effectId = offer!.effectId, grantId = offer!.grantId) =>
      add({ id, effectId, grantId })

    await expect(ask(first.id, crypto.randomUUID())).rejects.toThrow('not offered')
    await expect(ask(first.id, offer!.effectId, 'another-grant')).rejects.toThrow('not offered')
    await ask(first.id)
    await expect(ask(first.id)).rejects.toThrow('holds no die')

    const second = await abilityCheck('STRENGTH')
    expect(second.afterRollOffers).toBeUndefined()
    await expect(decline(first.id)).rejects.toThrow('holds no die')
  })

  it('refuses a die once a newer roll has been made', async () => {
    const { abilityCheck, add } = await characterHolding(guidance)
    const older = await abilityCheck('STRENGTH')
    const [offer] = older.afterRollOffers!
    await abilityCheck('CHARISMA')
    await expect(
      add({ id: older.id, effectId: offer!.effectId, grantId: offer!.grantId })
    ).rejects.toThrow('holds no die')
  })

  it('offers a homebrew two-dice die through the same path', async () => {
    const { abilityCheck, add } = await characterHolding(guidance, { count: 2 })
    const rolled = await abilityCheck('STRENGTH')
    const [offer] = rolled.afterRollOffers!
    expect(offer).toEqual(expect.objectContaining({ count: 2, faces: 4 }))
    const used = await add({ id: rolled.id, effectId: offer!.effectId, grantId: offer!.grantId })
    expect(used.evidence.terms.at(-1)).toEqual(
      expect.objectContaining({ count: 2, die: 4, rolls: expect.any(Array) })
    )
    expect(used.evidence.terms.at(-1)!.rolls).toHaveLength(2)
  })

  it('offers nothing on a roll that is not a check or save, or on a save with only a check die held', async () => {
    const { initiative, savingThrow } = await characterHolding(guidance)
    expect((await initiative()).afterRollOffers).toBeUndefined()
    expect((await savingThrow('STRENGTH')).afterRollOffers).toBeUndefined()
  })
})

describe('a held saving-throw die offered after a Sheet roll', () => {
  it('offers and adds the die on a save of its ability, and not on an ability check', async () => {
    const { abilityCheck, savingThrow, add, effectCount } = await characterHolding(resistance, {
      ability: 'DEXTERITY'
    })
    expect((await abilityCheck('STRENGTH')).afterRollOffers).toBeUndefined()
    expect((await savingThrow('STRENGTH')).afterRollOffers).toBeUndefined()

    const rolled = await savingThrow('DEXTERITY')
    const [offer] = rolled.afterRollOffers!
    const used = await add({ id: rolled.id, effectId: offer!.effectId, grantId: offer!.grantId })
    expect(d4Terms(used)).toHaveLength(1)
    expect(await effectCount()).toBe(0)
  })
})
