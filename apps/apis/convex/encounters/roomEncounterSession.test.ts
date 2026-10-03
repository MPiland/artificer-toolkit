import { describe, expect, it } from 'vitest'
import { api } from '../_generated/api'
import {
  domainRejection,
  playerControlFixture,
  setActorControllers
} from '../../tests/fixtures/playerControl'
import {
  createEncounterSceneFixture,
  publishSceneSource
} from '../../tests/fixtures/encounterScene'
import {
  getNativeActionChoices,
  getNativeOptionalActionChoices,
  nativeDisarmFixture
} from '../../tests/fixtures/nativeDisarm'
import {
  executeInRoom,
  readEncounterInRoom,
  readEncounterSessionInRoom
} from '../../tests/fixtures/liveSessionWorker'

/**
 * The Encounter session the room pushes a subscribed member is the same read the Convex queries
 * serve (ADR 0035): built by the shared `encounter-persistence` readers, so projection, privacy and
 * the timeline cannot drift between the two transports.
 */
describe('Room-pushed Encounter session', () => {
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
    for (const member of [base.owner, base.player, base.other]) {
      const frame = await readEncounterSessionInRoom(member.caller, encounterId, { timeline: true })
      if (!frame.held) throw new Error('The room should hold the active Run.')
      expect(frame.state).toEqual(
        await member.caller.query(api.encounters.activeReads.active, { campaignId })
      )
      expect(frame.preparedPending).toEqual(
        await member.caller.query(api.encounters.projectionReads.pendingPrepared, { campaignId })
      )
      expect(frame.timeline).toEqual(
        await member.caller.query(api.encounters.timelineReads.timeline, {
          encounterId,
          limit: 50
        })
      )
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

  it('answers the latest evidence rolls like the Convex query for the roller and the GM', async () => {
    const base = await pausedAction()
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
      const query = await member.caller.query(api.encounters.evidenceRolls.latest, {
        encounterId: base.run.id
      })
      const reply = await readEncounterInRoom(member.caller, base.run.id, {
        kind: 'LATEST_EVIDENCE_ROLLS',
        input: { encounterId: base.run.id }
      })
      expect(reply).toMatchObject({
        type: 'ENCOUNTER_READ_RESULT',
        version: await base.version(),
        result: { kind: 'LATEST_EVIDENCE_ROLLS', result: query }
      })
      // Only the roller has an app roll; the GM's own list is empty.
      expect(query.length > 0).toBe(member === base.player)
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
    for (const member of [base.owner, base.player]) {
      expect(
        await readEncounterInRoom(member.caller, base.run.id, {
          kind: 'ACTION_CHOICES',
          input: catalogue
        })
      ).toMatchObject({
        type: 'ENCOUNTER_READ_RESULT',
        version: expectedVersion,
        result: {
          kind: 'ACTION_CHOICES',
          result: await member.caller.query(getNativeActionChoices, {
            ...catalogue,
            expectedVersion
          })
        }
      })
      expect(
        await readEncounterInRoom(member.caller, base.run.id, {
          kind: 'OPTIONAL_ACTION_CHOICES',
          input: optional
        })
      ).toMatchObject({
        type: 'ENCOUNTER_READ_RESULT',
        version: expectedVersion,
        result: {
          kind: 'OPTIONAL_ACTION_CHOICES',
          result: await member.caller.query(getNativeOptionalActionChoices, {
            ...optional,
            expectedVersion
          })
        }
      })
    }
  }, 30000)

  it('refuses a member who does not control the actor as the Convex query does', async () => {
    const base = await nativeDisarmFixture('PROMPT')
    const reply = await readEncounterInRoom(base.player.caller, base.run.id, {
      kind: 'ACTION_CHOICES',
      input: { encounterId: base.run.id, actorId: base.actor.id }
    })
    expect(reply).toMatchObject({
      type: 'ENCOUNTER_READ_REJECTED',
      code: 'DOMAIN_REJECTED',
      reason: 'NOT_ACTOR_CONTROLLER'
    })
    await expect(
      domainRejection(
        base.player.caller.query(getNativeActionChoices, {
          encounterId: base.run.id,
          actorId: base.actor.id,
          expectedVersion: base.command.expectedVersion
        })
      )
    ).resolves.toMatchObject({ reason: 'NOT_ACTOR_CONTROLLER' })
  }, 30000)

  it('answers the Scene binding like the Convex query, from the room Scene', async () => {
    const base = await createEncounterSceneFixture()
    await publishSceneSource(base)
    await base.other.caller.mutation(api.encounters.sceneBindings.bind, {
      type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
      commandId: crypto.randomUUID(),
      encounterId: base.run.id
    })
    const input = { encounterId: base.run.id, sceneId: base.sceneId }
    for (const member of [base.other, base.owner]) {
      const query = await member.caller.query(api.encounters.sceneBindings.get, input)
      expect(query).not.toBeNull()
      expect(
        await readEncounterInRoom(member.caller, base.run.id, { kind: 'SCENE_BINDING', input })
      ).toMatchObject({
        type: 'ENCOUNTER_READ_RESULT',
        result: { kind: 'SCENE_BINDING', result: query }
      })
    }
  }, 30000)

  it('shows a player only the table timeline', async () => {
    const base = await pausedAction()
    const gm = await readEncounterSessionInRoom(base.owner.caller, base.run.id, { timeline: true })
    const bystander = await readEncounterSessionInRoom(base.other.caller, base.run.id, {
      timeline: true
    })
    if (!gm.held || !bystander.held) throw new Error('The room should hold the active Run.')
    expect(gm.timeline?.entries.length).toBeGreaterThan(0)
    expect(bystander.timeline?.entries.every((entry) => entry.visibility === 'TABLE')).toBe(true)
  })

  it('omits the timeline unless the socket asked for it', async () => {
    const base = await playerControlFixture()
    const frame = await readEncounterSessionInRoom(base.owner.caller, base.run.id, {
      timeline: false
    })
    if (!frame.held) throw new Error('The room should hold the active Run.')
    expect(frame.timeline).toBeNull()
  })
})
