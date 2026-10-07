import { describe, expect, it } from 'vitest'
import { api } from '../_generated/api'
import { activateFixtureRun } from '../../tests/fixtures/activeInitiative'
import {
  domainRejection,
  playerControlFixture,
  setActorControllers
} from '../../tests/fixtures/playerControl'
import {
  bindPresentedScene,
  createEncounterSceneFixture,
  publishSceneSource
} from '../../tests/fixtures/encounterScene'
import {
  getNativeActionChoices,
  getNativeOptionalActionChoices,
  nativeDisarmFixture
} from '../../tests/fixtures/nativeDisarm'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  executeInRoom,
  readRoomEncounter,
  readRoomEncounterSession,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

/**
 * The Encounter session the room pushes a subscribed member is the same read the Convex queries
 * serve (ADR 0035): built by the shared `encounter-persistence` readers, so projection, privacy and
 * the timeline cannot drift between the two transports.
 */
describe('Room-pushed Encounter session', () => {
  useLocalRoomWorker()

  async function pausedAction() {
    const base = await playerControlFixture({ bite: 'ATTACK', promptRolls: true })
    await setActorControllers(base, base.companion.id, [base.player.userId])
    await executeInRoom(base.owner.caller, {
      command: {
        type: 'UPDATE_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: await base.version(),
        actorId: base.enemy.id,
        currentHitPoints: 7
      }
    })
    await executeInRoom(base.player.caller, {
      command: await base.bite(base.companion.id, base.enemy.id)
    })
    return base
  }

  it('matches the Convex reads for the GM, a controlling player and a bystander', async () => {
    const base = await pausedAction()
    const campaignId = base.campaign.id
    const encounterId = base.run.id
    // Convex serves the room's committed Run once it checkpoints.
    await checkpointLiveRoom(campaignId)
    for (const member of [base.owner, base.player, base.other]) {
      const frame = await readRoomEncounterSession(member.caller, campaignId, { timeline: true })
      if (!frame.held) throw new Error('The room should hold the active Run.')
      expect(frame.state).toEqual(
        await member.caller.query(api.encounters.activeReads.active, { campaignId })
      )
      expect(frame.preparedPending).toEqual(
        await member.caller.query(api.encounters.projectionReads.pendingPrepared, { campaignId })
      )
      // Every command here is PRIVATE, so only the GM's timeline shows them.
      if (member === base.owner) expect(frame.timeline?.entries.length).toBe(3)
      else expect(frame.timeline?.entries).toEqual([])
      expect(frame.actorSides).toEqual(
        member === base.owner
          ? await member.caller.query(api.encounters.projectionReads.actorSides, {
              encounterId,
              expectedVersion: frame.version
            })
          : null
      )
      expect(frame.version).toBe(await base.version())
    }
  })

  it('answers the latest evidence rolls for the roller and the GM', async () => {
    const base = await pausedAction()
    await checkpointLiveRoom(base.campaign.id)
    const pending = (
      await base.player.caller.query(api.encounters.activeReads.active, {
        campaignId: base.campaign.id
      })
    ).pending
    if (pending?.kind !== 'D20_EVIDENCE') throw new Error('Expected a d20 roll prompt.')
    await executeInRoom(base.player.caller, {
      command: {
        type: 'ROLL_RULE_EVIDENCE',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: pending.encounterVersion,
        occurrenceId: pending.occurrenceId,
        expectedOccurrenceVersion: pending.occurrenceVersion,
        requestId: pending.request.requestId,
        rollMode: null
      }
    })
    for (const member of [base.player, base.owner]) {
      const reply = await readRoomEncounter(member.caller, base.campaign.id, {
        kind: 'LATEST_EVIDENCE_ROLLS',
        input: { encounterId: base.run.id }
      })
      if (reply.kind !== 'LATEST_EVIDENCE_ROLLS')
        throw new Error('Expected the latest evidence rolls.')
      // Only the roller has an app roll; the GM's own list is empty.
      expect(reply.result.length > 0).toBe(member === base.player)
    }
  })

  it('answers the turn choices like the Convex queries for the GM and a controlling player', async () => {
    const base = await nativeDisarmFixture('PROMPT')
    const granted = await executeInRoom(base.owner.caller, {
      command: {
        type: 'UPDATE_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.command.expectedVersion,
        actorId: base.actor.id,
        controllerUserIds: [base.player.userId]
      }
    })
    const expectedVersion = granted.projection.version
    if (!base.command.optionalCombatIntent) throw new Error('Missing Disarm intent.')
    const catalogue = { encounterId: base.run.id, actorId: base.actor.id }
    const optional = {
      ...catalogue,
      actionId: base.command.actionId,
      targetActorId: base.target.id,
      definitionId: base.command.optionalCombatIntent.definitionId,
      sceneContext: base.command.sceneContext
    }
    await checkpointLiveRoom(base.campaign.id)
    for (const member of [base.owner, base.player]) {
      expect(
        await readRoomEncounter(member.caller, base.campaign.id, {
          kind: 'ACTION_CHOICES',
          input: catalogue
        })
      ).toMatchObject({
        kind: 'ACTION_CHOICES',
        result: await member.caller.query(getNativeActionChoices, {
          ...catalogue,
          expectedVersion
        })
      })
      expect(
        await readRoomEncounter(member.caller, base.campaign.id, {
          kind: 'OPTIONAL_ACTION_CHOICES',
          input: optional
        })
      ).toMatchObject({
        kind: 'OPTIONAL_ACTION_CHOICES',
        result: await member.caller.query(getNativeOptionalActionChoices, {
          ...optional,
          expectedVersion
        })
      })
    }
  }, 30000)

  it('refuses a member who does not control the actor as the Convex query does', async () => {
    const base = await nativeDisarmFixture('PROMPT')
    // A read never loads the Run, so a first command makes the room hold it.
    const held = await executeInRoom(base.owner.caller, {
      command: {
        type: 'UPDATE_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.command.expectedVersion,
        actorId: base.actor.id,
        currentHitPoints: 1
      }
    })
    await checkpointLiveRoom(base.campaign.id)
    await expect(
      domainRejection(
        readRoomEncounter(base.player.caller, base.campaign.id, {
          kind: 'ACTION_CHOICES',
          input: { encounterId: base.run.id, actorId: base.actor.id }
        })
      )
    ).resolves.toMatchObject({ reason: 'NOT_ACTOR_CONTROLLER' })
    await expect(
      domainRejection(
        base.player.caller.query(getNativeActionChoices, {
          encounterId: base.run.id,
          actorId: base.actor.id,
          expectedVersion: held.projection.version
        })
      )
    ).resolves.toMatchObject({ reason: 'NOT_ACTOR_CONTROLLER' })
  }, 30000)

  it('answers the Scene binding like the Convex query, from the room Scene', async () => {
    const base = await createEncounterSceneFixture()
    await publishSceneSource(base)
    await base.other.caller.run((ctx) =>
      bindPresentedScene(ctx, {
        type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
        commandId: crypto.randomUUID(),
        encounterId: base.run.id
      })
    )
    // D87: a player reads only the ACTIVE Encounter.
    await base.t.run((ctx) => activateFixtureRun(ctx, base.run.id))
    await attachFixtureRoom(base.t, base.campaign.id)
    const input = { encounterId: base.run.id, sceneId: base.sceneId }
    for (const member of [base.other, base.owner]) {
      const query = await member.caller.query(api.encounters.sceneBindings.get, input)
      expect(query).not.toBeNull()
      expect(
        await readRoomEncounter(member.caller, base.campaign.id, { kind: 'SCENE_BINDING', input })
      ).toMatchObject({ kind: 'SCENE_BINDING', result: query })
    }
  }, 30000)

  it('shows a player only the table timeline', async () => {
    const base = await pausedAction()
    const gm = await readRoomEncounterSession(base.owner.caller, base.campaign.id, {
      timeline: true
    })
    const bystander = await readRoomEncounterSession(base.other.caller, base.campaign.id, {
      timeline: true
    })
    if (!gm.held || !bystander.held) throw new Error('The room should hold the active Run.')
    expect(gm.timeline?.entries.length).toBeGreaterThan(0)
    expect(bystander.timeline?.entries.every((entry) => entry.visibility === 'TABLE')).toBe(true)
  })

  it('omits the timeline unless the socket asked for it', async () => {
    const base = await playerControlFixture()
    await executeInRoom(base.owner.caller, {
      command: {
        type: 'UPDATE_ACTOR',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: await base.version(),
        actorId: base.enemy.id,
        currentHitPoints: 7
      }
    })
    const frame = await readRoomEncounterSession(base.owner.caller, base.campaign.id, {
      timeline: false
    })
    if (!frame.held) throw new Error('The room should hold the active Run.')
    expect(frame.timeline).toBeNull()
  })
})
