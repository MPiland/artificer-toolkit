// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { api } from '../_generated/api'
import { createConvexEncounterStore } from '../lib/convexEncounterStore'

/** SPELLS-17.3: a Sheet heal outside any Encounter mechanics batch ends "until healed" grants. */
describe('Sheet healing and grants that last until hit points are regained', () => {
  async function fixture() {
    const base = await setupCharacterRun()
    const { t, run, actor, character, owner, campaign } = base
    const grant = (endEvents: 'ON_HIT_POINTS_REGAINED'[]) => {
      const planned = plannedModifierGrant({
        encounterId: run.id,
        sourceActorId: actor.id,
        holderActorId: actor.id,
        lifecycle: {
          endTriggers: endEvents.map((code) => ({
            event: 'LIFECYCLE' as const,
            timing: 'END' as const,
            code
          }))
        },
        lifetimeScope: 'OWNER'
      })
      return t.run((ctx) =>
        createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).create({
          id: crypto.randomUUID(),
          owner: { kind: 'CHARACTER', characterId: character.id },
          definition: planned.definition,
          lifecycle: planned.lifecycle
        })
      )
    }
    const untilHealed = await grant(['ON_HIT_POINTS_REGAINED'])
    const lasting = await grant([])
    const effectIds = () =>
      t.run(async (ctx) =>
        (
          await ctx.db
            .query('characterActiveRuleEffects')
            .withIndex('by_characterId_id', (q) => q.eq('characterId', character.id))
            .collect()
        ).map(({ id }) => id)
      )
    let version = base.characterStreamVersion
    const sheet = async (
      command:
        | { type: 'SET_HIT_POINTS'; current: number }
        | { type: 'ADJUST_HIT_POINTS'; mode: 'HEAL' | 'DAMAGE'; amount: number }
    ) => {
      const answer = await owner.caller.mutation(api.campaigns.characterSheet.execute, {
        campaignId: campaign.id,
        characterId: character.id,
        command: {
          commandId: crypto.randomUUID(),
          expectedVersion: version,
          ...command
        }
      })
      version = answer.streamVersion
    }
    return { sheet, effectIds, untilHealed, lasting }
  }

  it('ends the grant when a heal restores hit points, and keeps the others', async () => {
    const { sheet, effectIds, untilHealed, lasting } = await fixture()
    await sheet({ type: 'SET_HIT_POINTS', current: 1 })
    expect(await effectIds()).toEqual(expect.arrayContaining([untilHealed.id, lasting.id]))

    await sheet({ type: 'ADJUST_HIT_POINTS', mode: 'HEAL', amount: 3 })

    expect(await effectIds()).toEqual([lasting.id])
  })

  it('keeps the grant through damage, a heal at full hit points and a heal of nothing', async () => {
    const { sheet, effectIds, untilHealed, lasting } = await fixture()
    await sheet({ type: 'ADJUST_HIT_POINTS', mode: 'HEAL', amount: 5 })
    await sheet({ type: 'ADJUST_HIT_POINTS', mode: 'DAMAGE', amount: 1 })
    await sheet({ type: 'ADJUST_HIT_POINTS', mode: 'HEAL', amount: 0 })

    expect(await effectIds()).toEqual(expect.arrayContaining([untilHealed.id, lasting.id]))
    expect(await effectIds()).toHaveLength(2)
  })

  it('ends the grant when the hit points are set higher by hand', async () => {
    const { sheet, effectIds, lasting } = await fixture()
    await sheet({ type: 'SET_HIT_POINTS', current: 1 })
    await sheet({ type: 'SET_HIT_POINTS', current: 2 })

    expect(await effectIds()).toEqual([lasting.id])
  })
})
