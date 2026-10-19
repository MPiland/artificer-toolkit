// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { guidance } from '@artificer-toolkit/source-data/srd/spells/guidance.js'
import { setupCharacterRun } from '../tests/fixtures/encounterCharacter'
import { api } from './_generated/api'
import { createConvexEncounterStore } from './lib/convexEncounterStore'

/** D156: a die the Character carries (Guidance) joins its next ability check, and that check spends it. */
describe('a carried ability-check die on a Sheet roll', () => {
  async function guidedCharacter() {
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
          effect: guidance.effects![0],
          sourceLabel: 'Guidance',
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
    return { effectCount, strengthCheck, initiative }
  }

  const d4Terms = (record: { evidence: { terms: readonly { die: number }[] } }) =>
    record.evidence.terms.filter(({ die }) => die === 4)

  it('adds the die to the first ability check and spends it', async () => {
    const { effectCount, strengthCheck } = await guidedCharacter()
    expect(await effectCount()).toBe(1)

    const first = await strengthCheck()
    const [die] = d4Terms(first)
    expect(die).toBeDefined()
    expect(first.normalizedExpression).toMatch(/\+ 1d4$/)
    expect(first.evidence.subtotal).toBe(
      first.evidence.terms.reduce((total, term) => total + term.subtotal, 0)
    )
    expect(first.evidence.total).toBe(first.evidence.subtotal + first.evidence.modifier)
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
