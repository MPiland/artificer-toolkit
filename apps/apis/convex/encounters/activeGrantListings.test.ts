import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { describe, expect, it } from 'vitest'
import { activateFixtureRun } from '../../tests/fixtures/activeInitiative'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  executeInRoom,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { api } from '../_generated/api'
import { createConvexEncounterStore } from '../lib/convexEncounterStore'

/**
 * D99: an active grant is listed on the token, the turn tracker and the Sheet with its source and
 * time left, a hidden source's label stays with the GM, and the GM ends a Creature's grant by hand.
 */
describe('Active grant listings (D99)', () => {
  useLocalRoomWorker()

  it('lists grants with their label to the GM and without a hidden label to a player, and the GM ends an enemy grant', async () => {
    const base = await setupCharacterRun()
    const enemy = base.run.actors.find((actor) => actor.kind === 'CUSTOM')!
    // A player reads only a started Run.
    const active = await base.t.run((ctx) => activateFixtureRun(ctx, base.run.id))
    const seed = (input: {
      holderActorId: string
      owner: Parameters<ReturnType<typeof createActiveRuleEffectStore>['create']>[0]['owner']
      lifetimeScope: 'ENCOUNTER' | 'OWNER'
      sourceLabel: string
      sourceHidden: boolean
      rounds: number
    }) =>
      base.t.run(async (ctx) => {
        const planned = plannedModifierGrant({
          encounterId: base.run.id,
          sourceActorId: input.holderActorId,
          holderActorId: input.holderActorId,
          lifecycle: {},
          sourceLabel: input.sourceLabel,
          sourceHidden: input.sourceHidden,
          rounds: input.rounds,
          lifetimeScope: input.lifetimeScope
        })
        return createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).create({
          id: crypto.randomUUID(),
          owner: input.owner,
          definition: planned.definition,
          lifecycle: planned.lifecycle,
          maintainedEffectStateId: null
        })
      })
    const shown = await seed({
      holderActorId: enemy.id,
      owner: { kind: 'ENCOUNTER_ACTOR', encounterId: base.run.id, targetActorId: enemy.id },
      lifetimeScope: 'ENCOUNTER',
      sourceLabel: 'Antitoxin (vial)',
      sourceHidden: false,
      rounds: 3
    })
    const hidden = await seed({
      holderActorId: enemy.id,
      owner: { kind: 'ENCOUNTER_ACTOR', encounterId: base.run.id, targetActorId: enemy.id },
      lifetimeScope: 'ENCOUNTER',
      sourceLabel: 'Hidden trap blessing',
      sourceHidden: true,
      rounds: 5
    })
    const secret = await seed({
      holderActorId: base.actor.id,
      owner: { kind: 'CHARACTER', characterId: base.character.id },
      lifetimeScope: 'OWNER',
      sourceLabel: 'Secret boon',
      sourceHidden: true,
      rounds: 10
    })

    const grantsOf = async (member: typeof base.owner, actorId: string) =>
      (
        await member.caller.query(api.encounters.projectionReads.get, {
          encounterId: base.run.id
        })
      ).actors.find((actor) => actor.id === actorId)?.activeGrants
    const listing = (
      effect: { id: string },
      label: string | null,
      sourceActorId: string | null,
      sourceHidden: boolean,
      remainingTicks: number
    ) => ({
      effectId: effect.id,
      label,
      sourceHidden,
      sourceActorId,
      remainingTicks,
      expiresAtCampaignMinute: null,
      polarity: 'BENEFICIAL' as const
    })

    // The GM's turn tracker and token read every label.
    expect(await grantsOf(base.owner, enemy.id)).toEqual([
      listing(shown, 'Antitoxin (vial)', enemy.id, false, 3),
      listing(hidden, 'Hidden trap blessing', enemy.id, true, 5)
    ])
    expect(await grantsOf(base.owner, base.actor.id)).toEqual([
      listing(secret, 'Secret boon', base.actor.id, true, 10)
    ])
    // A player sees the grants and their time, never what a hidden source was.
    expect(await grantsOf(base.player, enemy.id)).toEqual([
      listing(shown, 'Antitoxin (vial)', enemy.id, false, 3),
      listing(hidden, null, null, true, 5)
    ])
    expect(await grantsOf(base.player, base.actor.id)).toEqual([
      listing(secret, null, null, true, 10)
    ])

    // The Sheet lists the Character's grants the same way.
    const playerSheet = await base.player.caller.query(api.characters.sheet.get, {
      id: base.character.id
    })
    expect(playerSheet?.overview.activeGrants).toEqual([listing(secret, null, null, true, 10)])
    expect(JSON.stringify(playerSheet)).not.toContain('Secret boon')
    const gmSheet = await base.owner.caller.query(api.campaigns.characterSheet.get, {
      campaignId: base.campaign.id,
      characterId: base.character.id
    })
    expect(gmSheet.overview.activeGrants).toEqual([
      listing(secret, 'Secret boon', base.actor.id, true, 10)
    ])

    // The GM ends a Creature's grant by hand, in the room.
    await attachFixtureRoom(base.t, base.campaign.id)
    const ended = await executeInRoom(base.owner.caller, {
      command: {
        type: 'UPDATE_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: active.version,
        actorId: enemy.id,
        endActiveEffectId: hidden.id
      }
    })
    expect(ended.projection.actors.find((actor) => actor.id === enemy.id)?.activeGrants).toEqual([
      listing(shown, 'Antitoxin (vial)', enemy.id, false, 3)
    ])

    // Only the GM ends one, only a grant of that actor, and a Character's ends on its Sheet.
    const refused = (caller: typeof base.owner.caller, actorId: string, effectId: string) =>
      executeInRoom(caller, {
        command: {
          type: 'UPDATE_ACTOR',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: ended.projection.version,
          actorId,
          endActiveEffectId: effectId
        }
      })
    await expect(refused(base.player.caller, enemy.id, shown.id)).rejects.toThrow()
    await expect(refused(base.owner.caller, enemy.id, hidden.id)).rejects.toThrow()
    await expect(refused(base.owner.caller, base.actor.id, secret.id)).rejects.toThrow()

    // A finished Run lists no grants: its view reads only the Run's own documents (Amendment 30),
    // though the Character still holds its OWNER grant.
    await executeInRoom(base.owner.caller, {
      command: {
        type: 'COMPLETE',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: ended.projection.version
      }
    })
    await checkpointLiveRoom(base.campaign.id)
    expect(await grantsOf(base.owner, enemy.id)).toEqual([])
    expect(await grantsOf(base.owner, base.actor.id)).toEqual([])
  }, 60000)
})
