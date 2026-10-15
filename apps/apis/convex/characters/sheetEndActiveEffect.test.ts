// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import type { EffectAuthored } from '@artificer-toolkit/shared/authored'
import { barbarian } from '@artificer-toolkit/source-data/srd/classes/barbarian.js'
import {
  aidAtSecondLevel,
  plannedModifierGrant
} from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { api } from '../_generated/api'
import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { readCharacterRecord } from './stateDocuments'

/** D99: the Campaign owner ends one of a Character's active effects by hand. */
describe('END_ACTIVE_EFFECT', () => {
  async function grantedCharacter() {
    const base = await setupCharacterRun()
    const { t, run, actor, character } = base
    const effect = await t.run((ctx) =>
      createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).create({
        id: crypto.randomUUID(),
        owner: { kind: 'CHARACTER', characterId: character.id },
        definition: plannedModifierGrant({
          encounterId: run.id,
          sourceActorId: actor.id,
          holderActorId: actor.id,
          lifecycle: {},
          effect: aidAtSecondLevel(),
          rounds: 30,
          lifetimeScope: 'OWNER'
        }).definition,
        lifecycle: { schemaVersion: 1, remainingTicks: 30 }
      })
    )
    const sheet = () => base.player.caller.query(api.characters.sheet.get, { id: character.id })
    const storedCurrent = async () =>
      readCharacterRecord((await base.readState()).character!).state.hitpoints.current
    const effectIds = () =>
      t.run(async (ctx) =>
        (
          await ctx.db
            .query('characterActiveRuleEffects')
            .withIndex('by_characterId_id', (q) => q.eq('characterId', character.id))
            .collect()
        ).map(({ id }) => id)
      )
    return { ...base, effect, sheet, storedCurrent, effectIds }
  }

  it('ends the grant, and a lowered maximum pulls current hit points down to it', async () => {
    const fixture = await grantedCharacter()
    const { owner, player, campaign, character, effect } = fixture
    const boosted = (await fixture.sheet())!.overview.maxHitPoints
    const normal = boosted - 5
    const set = await owner.caller.mutation(api.campaigns.characterSheet.execute, {
      campaignId: campaign.id,
      characterId: character.id,
      command: {
        type: 'SET_HIT_POINTS',
        commandId: crypto.randomUUID(),
        expectedVersion: fixture.characterStreamVersion,
        current: boosted
      }
    })
    expect(await fixture.storedCurrent()).toBe(boosted)

    const command = {
      type: 'END_ACTIVE_EFFECT' as const,
      commandId: crypto.randomUUID(),
      expectedVersion: set.streamVersion,
      effectId: effect.id
    }
    // The Character's own player cannot end it, nor can anyone end an effect the Character lacks.
    await expect(
      player.caller.mutation(api.characters.sheetCommands.execute, {
        id: character.id,
        command
      })
    ).rejects.toThrow('Only the Campaign owner can end an active effect.')
    await expect(
      owner.caller.mutation(api.campaigns.characterSheet.execute, {
        campaignId: campaign.id,
        characterId: character.id,
        command: { ...command, commandId: crypto.randomUUID(), effectId: crypto.randomUUID() }
      })
    ).rejects.toThrow('Active effect is unavailable.')
    expect(await fixture.effectIds()).toEqual([effect.id])

    const ended = await owner.caller.mutation(api.campaigns.characterSheet.execute, {
      campaignId: campaign.id,
      characterId: character.id,
      command
    })
    expect(ended.streamVersion).toBe(set.streamVersion + 1)
    expect(await fixture.effectIds()).toEqual([])
    expect((await fixture.sheet())!.overview.maxHitPoints).toBe(normal)
    expect(await fixture.storedCurrent()).toBe(normal)
  })

  it('lets the Character’s own player end a grant that carries a holder-end option (Rage) outside an Encounter, and no other', async () => {
    const base = await setupCharacterRun()
    const { t, player, run, actor, character } = base
    const rage = barbarian.features?.find(({ label }) => label === 'Rage')?.effects?.[0]
    const hold = (effect?: EffectAuthored) =>
      t.run((ctx) =>
        createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).create({
          id: crypto.randomUUID(),
          owner: { kind: 'CHARACTER', characterId: character.id },
          definition: plannedModifierGrant({
            encounterId: run.id,
            sourceActorId: actor.id,
            holderActorId: actor.id,
            lifecycle: {},
            effect,
            rounds: 10,
            lifetimeScope: 'OWNER'
          }).definition,
          lifecycle: { schemaVersion: 1, remainingTicks: 10 }
        })
      )
    const raging = await hold(rage)
    const aided = await hold(aidAtSecondLevel())
    const effectIds = () =>
      t.run(async (ctx) =>
        (
          await ctx.db
            .query('characterActiveRuleEffects')
            .withIndex('by_characterId_id', (q) => q.eq('characterId', character.id))
            .collect()
        ).map(({ id }) => id)
      )
    const end = async (effectId: string) =>
      player.caller.mutation(api.characters.sheetCommands.execute, {
        id: character.id,
        command: {
          type: 'END_ACTIVE_EFFECT',
          commandId: crypto.randomUUID(),
          expectedVersion: (await base.readState()).character!.play.streamVersion,
          effectId
        }
      })

    await expect(end(aided.id)).rejects.toThrow('Only the Campaign owner can end an active effect.')
    expect(await effectIds()).toEqual(expect.arrayContaining([raging.id, aided.id]))

    // The end gate is specific to END_ACTIVE_EFFECT: the player's other commands still pass.
    await player.caller.mutation(api.characters.sheetCommands.execute, {
      id: character.id,
      command: {
        type: 'SET_INSPIRATION',
        commandId: crypto.randomUUID(),
        expectedVersion: (await base.readState()).character!.play.streamVersion,
        inspired: true
      }
    })

    await end(raging.id)
    expect(await effectIds()).toEqual([aided.id])
  })

  it('lets the Campaign owner end a grant on their own assigned Character, and still refuses a player', async () => {
    const base = await setupCharacterRun({}, undefined, true)
    const { t, owner, player, run, actor } = base
    const characterId = base.gmCharacterId
    if (!characterId) throw new Error('Fixture GM Character is unavailable.')
    const effect = await t.run((ctx) =>
      createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).create({
        id: crypto.randomUUID(),
        owner: { kind: 'CHARACTER', characterId },
        definition: plannedModifierGrant({
          encounterId: run.id,
          sourceActorId: actor.id,
          holderActorId: actor.id,
          lifecycle: {},
          effect: aidAtSecondLevel(),
          rounds: 30,
          lifetimeScope: 'OWNER'
        }).definition,
        lifecycle: { schemaVersion: 1, remainingTicks: 30 }
      })
    )
    const effectIds = () =>
      t.run(async (ctx) =>
        (
          await ctx.db
            .query('characterActiveRuleEffects')
            .withIndex('by_characterId_id', (q) => q.eq('characterId', characterId))
            .collect()
        ).map(({ id }) => id)
      )
    const version = async () =>
      (await owner.caller.query(api.characters.sheet.get, { id: characterId }))!.meta.streamVersion
    const end = async () => ({
      type: 'END_ACTIVE_EFFECT' as const,
      commandId: crypto.randomUUID(),
      expectedVersion: await version(),
      effectId: effect.id
    })

    await expect(
      player.caller.mutation(api.characters.sheetCommands.execute, {
        id: characterId,
        command: await end()
      })
    ).rejects.toThrow()
    expect(await effectIds()).toEqual([effect.id])

    await owner.caller.mutation(api.characters.sheetCommands.execute, {
      id: characterId,
      command: await end()
    })
    expect(await effectIds()).toEqual([])
  })
})
