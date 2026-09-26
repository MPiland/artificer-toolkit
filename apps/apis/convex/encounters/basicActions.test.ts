import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  EncounterActionChoicesResponseDto,
  GetEncounterActionChoicesInputDto
} from '@artificer-toolkit/schema/api/encounterActionChoices'
import type {
  EncounterSessionStateDto,
  EncounterTimelineDto
} from '@artificer-toolkit/schema/api/encounterData'
import type {
  ResolveRuleOccurrenceInputDto,
  UseEncounterBasicActionInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import { encounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { encounterBasicActionEffects } from '@artificer-toolkit/rules-runtime/encounterBasicActions'
import { SRD_BASIC_ACTION_DEFINITIONS } from '@artificer-toolkit/source-data/srd/basicActions.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_ACTION_ALLOWANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/ruleState.js'
import {
  domainRejection,
  playerControlFixture,
  setActorControllers,
  type PlayerControlFixture
} from '../../tests/fixtures/playerControl'
import {
  executeInRoom,
  insertActiveLiveAuthority,
  withRoomConvex
} from '../../tests/fixtures/liveSessionWorker'
import { planNativeLiveBasicAction } from '../../../session-worker/src/nativeBasicAction'
import { callLiveSessionRoute } from '../../../session-worker/src/liveSessionRoutes'
import { internal } from '../_generated/api'

const actionChoices = makeFunctionReference<
  'query',
  GetEncounterActionChoicesInputDto,
  EncounterActionChoicesResponseDto
>('encounters/actionChoices:get')
const sessionState = makeFunctionReference<
  'query',
  { campaignId: string },
  EncounterSessionStateDto
>('encounters/activeReads:active')
const timeline = makeFunctionReference<'query', { encounterId: string }, EncounterTimelineDto>(
  'encounters/timelineReads:timeline'
)
const pendingRuleOccurrence = makeFunctionReference<
  'query',
  { encounterId: string },
  PendingEncounterRuleOccurrenceSummaryDto | null
>('encounters/pendingReads:pendingRuleOccurrence')

const [dash, disengage, dodge, help, hide] = SRD_BASIC_ACTION_DEFINITIONS

async function basicActionFixture(options: Parameters<typeof playerControlFixture>[0] = {}) {
  const base = await playerControlFixture(options)
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: SRD_BASIC_ACTION_DEFINITIONS
  })
  return base
}

async function useBasicAction(
  base: PlayerControlFixture,
  input: Pick<UseEncounterBasicActionInputDto, 'actorId' | 'definitionId'> &
    Partial<Pick<UseEncounterBasicActionInputDto, 'allyActorId' | 'acknowledgedWarnings'>>
): Promise<UseEncounterBasicActionInputDto> {
  return {
    type: 'USE_BASIC_ACTION',
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: await base.version(),
    allyActorId: null,
    acknowledgedWarnings: [],
    ...input
  }
}

async function actorState(base: PlayerControlFixture, actorId: string) {
  const row = await base.t.run((ctx) =>
    ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id).eq('id', actorId))
      .unique()
  )
  if (!row) throw new Error('Missing Encounter actor.')
  return encounterRunActorStateSchema.parse(JSON.parse(row.stateJson))
}

async function setCurrentActor(base: PlayerControlFixture, actorId: string) {
  return base.gm({
    type: 'SET_CURRENT_ACTOR',
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: await base.version(),
    actorId
  })
}

async function advanceTurn(base: PlayerControlFixture) {
  return base.gm({
    type: 'ADVANCE_TURN',
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: await base.version()
  })
}

async function d20Pending(base: PlayerControlFixture) {
  const pending = await base.owner.caller.query(pendingRuleOccurrence, {
    encounterId: base.run.id
  })
  if (pending?.kind !== 'D20_EVIDENCE') throw new Error('Expected a d20 roll prompt.')
  return pending
}

function enterFaces(
  base: PlayerControlFixture,
  pending: Awaited<ReturnType<typeof d20Pending>>
): ResolveRuleOccurrenceInputDto {
  return {
    type: 'RESOLVE_RULE_OCCURRENCE',
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: pending.encounterVersion,
    correlationId: null,
    occurrenceId: pending.occurrenceId,
    expectedOccurrenceVersion: pending.occurrenceVersion,
    resolution: {
      kind: 'ENTER_DICE',
      requestId: pending.request.requestId,
      rawFaces: pending.request.rollMode === 'NORMAL' ? [10] : [10, 10],
      rollMode: pending.request.rollMode
    }
  }
}

describe('basic combat actions in the room (Q11)', () => {
  it("offers the System's catalogue apart from features and logs an action without mechanics", async () => {
    const base = await basicActionFixture()
    const choices = await base.owner.caller.query(actionChoices, {
      encounterId: base.run.id,
      expectedVersion: await base.version(),
      actorId: base.companion.id
    })
    expect(choices?.actions.map((action) => action.id)).toContain(base.actionId)
    expect(
      choices?.basicActions.map(({ label, actionCost, needsAlly }) => [
        label,
        actionCost,
        needsAlly
      ])
    ).toEqual([
      ['Dash', 'ACTION', false],
      ['Disengage', 'ACTION', false],
      ['Dodge', 'ACTION', false],
      ['Help', 'ACTION', true],
      ['Hide', 'ACTION', false],
      ['Ready', 'ACTION', false],
      ['Search', 'ACTION', false],
      ['Use an Object', 'ACTION', false]
    ])

    const before = await base.version()
    const result = await base.gm(
      await useBasicAction(base, { actorId: base.companion.id, definitionId: hide!.id })
    )
    expect(result.projection.version).toBe(before + 1)
    const companion = await actorState(base, base.companion.id)
    expect(encounterBasicActionEffects(companion)).toEqual([])
    expect(encounterRuleUsageUsed(companion, SRD_ACTION_ALLOWANCE_DEFINITION_ID)).toBe(1)
    const { entries } = await base.owner.caller.query(timeline, { encounterId: base.run.id })
    expect(entries[0]).toMatchObject({ commandType: 'USE_BASIC_ACTION', label: 'Hide' })
  })

  it('Dash spends the action and adds the speed to this turn’s budget; a second one warns first', async () => {
    const base = await basicActionFixture()
    const budget = async () =>
      (
        await base.owner.caller.query(sessionState, { campaignId: base.campaign.id })
      ).turnMovement.find((entry) => entry.actorId === base.companion.id)?.budget
    const walking = await budget()
    expect(walking).toBeGreaterThan(0)

    await base.gm(
      await useBasicAction(base, { actorId: base.companion.id, definitionId: dash!.id })
    )
    expect(await budget()).toBe(walking! * 2)
    expect(
      encounterRuleUsageUsed(
        await actorState(base, base.companion.id),
        SRD_ACTION_ALLOWANCE_DEFINITION_ID
      )
    ).toBe(1)

    // The action is spent: Assisted mode warns, and "Do it anyway" records the override.
    await expect(
      domainRejection(
        base.gm(await useBasicAction(base, { actorId: base.companion.id, definitionId: dash!.id }))
      )
    ).resolves.toMatchObject({
      reason: 'RULE_WARNINGS',
      warnings: [expect.objectContaining({ code: 'ACTION_ECONOMY_UNAVAILABLE' })]
    })
    await base.gm(
      await useBasicAction(base, {
        actorId: base.companion.id,
        definitionId: dash!.id,
        acknowledgedWarnings: ['ACTION_ECONOMY_UNAVAILABLE']
      })
    )
    expect(await budget()).toBe(walking! * 3)
    const { entries } = await base.owner.caller.query(timeline, { encounterId: base.run.id })
    expect(entries[0]).toMatchObject({
      label: 'Dash',
      ruleOverrides: [expect.objectContaining({ code: 'ACTION_ECONOMY_UNAVAILABLE' })]
    })
  })

  it('Dodge gives attacks against the actor disadvantage, reads "Dodge", and ends at its next turn', async () => {
    const base = await basicActionFixture({ bite: 'ATTACK', promptRolls: true })
    await setCurrentActor(base, base.enemy.id)
    await base.gm(await useBasicAction(base, { actorId: base.enemy.id, definitionId: dodge!.id }))
    expect(
      encounterBasicActionEffects(await actorState(base, base.enemy.id)).map(
        (effect) => effect.mechanic
      )
    ).toEqual(['DISADVANTAGE_ON_ATTACKS_AGAINST'])

    await setCurrentActor(base, base.companion.id)
    await base.gm(await base.bite(base.companion.id, base.enemy.id))
    const pending = await d20Pending(base)
    expect(pending.request).toMatchObject({
      rollMode: 'DISADVANTAGE',
      derivedRollModeReasons: ['Dodge']
    })
    await base.gm(enterFaces(base, pending))

    // The enemy's next turn starts: its Dodge ends.
    await advanceTurn(base)
    expect(encounterBasicActionEffects(await actorState(base, base.enemy.id))).toHaveLength(1)
    await advanceTurn(base)
    expect(encounterBasicActionEffects(await actorState(base, base.enemy.id))).toEqual([])
  })

  it("Help gives the ally's next attack roll advantage once", async () => {
    const base = await basicActionFixture({ bite: 'ATTACK', promptRolls: true })
    await setCurrentActor(base, base.enemy.id)
    await base.gm(
      await useBasicAction(base, {
        actorId: base.enemy.id,
        definitionId: help!.id,
        allyActorId: base.companion.id
      })
    )
    await setCurrentActor(base, base.companion.id)

    await base.gm(await base.bite(base.companion.id, base.enemy.id))
    const first = await d20Pending(base)
    expect(first.request).toMatchObject({ rollMode: 'ADVANTAGE', derivedRollModeReasons: ['Help'] })
    await base.gm(enterFaces(base, first))
    expect(encounterBasicActionEffects(await actorState(base, base.enemy.id))).toEqual([])

    await base.gm(
      await base.bite(base.companion.id, base.enemy.id, {
        acknowledgedWarnings: ['ACTION_ECONOMY_UNAVAILABLE']
      })
    )
    expect((await d20Pending(base)).request.rollMode).toBe('NORMAL')
  })

  it('Help needs a chosen ally, and a player may help only an actor they can see', async () => {
    const base = await basicActionFixture()
    await expect(
      base.gm(await useBasicAction(base, { actorId: base.companion.id, definitionId: help!.id }))
    ).rejects.toThrow()
    await expect(
      base.gm(
        await useBasicAction(base, {
          actorId: base.companion.id,
          definitionId: disengage!.id,
          allyActorId: base.enemy.id
        })
      )
    ).rejects.toThrow()
    await base.gm({
      type: 'UPDATE_ACTOR',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: await base.version(),
      actorId: base.lurker.id,
      public: false
    })
    await setActorControllers(base, base.companion.id, [base.other.userId])
    await expect(
      domainRejection(
        executeInRoom(base.other.caller, {
          command: await useBasicAction(base, {
            actorId: base.companion.id,
            definitionId: help!.id,
            allyActorId: base.lurker.id
          })
        })
      )
    ).resolves.toMatchObject({ reason: 'TARGET_UNAVAILABLE' })
  })

  it('Convex records the room plan only: it plans nothing itself and refuses a plan unlike its entry', async () => {
    const base = await basicActionFixture()
    const command = await useBasicAction(base, {
      actorId: base.companion.id,
      definitionId: dodge!.id
    })
    const epoch = crypto.randomUUID()
    const authority = await base.t.run((ctx) =>
      insertActiveLiveAuthority(ctx, {
        campaignId: base.campaign.id,
        epoch,
        createdAt: new Date().toISOString()
      })
    )
    const scope = {
      campaignId: base.campaign.id,
      authorityEpoch: epoch,
      expectedUserId: base.owner.userId,
      expectedRole: 'OWNER' as const
    }
    await withRoomConvex(base.owner.caller, async ({ environment, accessToken }) => {
      // Convex never plans a basic action from a forwarded command.
      await expect(
        callLiveSessionRoute(environment, accessToken, 'encounterCommand', { ...scope, command })
      ).rejects.toThrow()
      const plan = await planNativeLiveBasicAction(
        environment,
        accessToken,
        { ...scope, encounterId: base.run.id, expectedVersion: command.expectedVersion },
        command,
        undefined
      )
      if (plan.kind !== 'PLANNED') throw new Error('Expected a planned basic action.')
      expect(plan.input).toMatchObject({
        speedMovementBonus: false,
        effects: [expect.objectContaining({ mechanic: 'DISADVANTAGE_ON_ATTACKS_AGAINST' })],
        actionEconomy: expect.objectContaining({ beforeUsed: 0, afterUsed: 1 })
      })
      // A plan with an effect its entry lacks is refused without writes.
      await expect(
        callLiveSessionRoute(environment, accessToken, 'encounterBasicActionCommit', {
          ...plan.input,
          effects: [{ ...plan.input.effects[0]!, mechanic: 'NO_OPPORTUNITY_ATTACKS' }]
        })
      ).rejects.toThrow()
      expect(await base.version()).toBe(command.expectedVersion)
      // The room's own plan is what Convex records.
      const recorded = await callLiveSessionRoute(
        environment,
        accessToken,
        'encounterBasicActionCommit',
        plan.input
      )
      expect(recorded.projection.version).toBe(command.expectedVersion + 1)
    })
    await base.t.run((ctx) => ctx.db.delete(authority))
    expect(
      encounterBasicActionEffects(await actorState(base, base.companion.id)).map(
        (effect) => effect.mechanic
      )
    ).toEqual(['DISADVANTAGE_ON_ATTACKS_AGAINST'])
  })
})
