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
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
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
import { sourceImportBatches } from '../content/importBatches'

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

/** The player-control Run with the System's rule states (conditions, capabilities) and catalogue. */
async function basicActionFixture(options: Parameters<typeof playerControlFixture>[0] = {}) {
  const base = await playerControlFixture(options)
  for (const definitions of sourceImportBatches([
    ...SRD_RULE_STATE_DEFINITIONS,
    ...SRD_BASIC_ACTION_DEFINITIONS
  ]))
    await base.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions
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

async function revertLastAction(base: PlayerControlFixture) {
  return base.gm({
    type: 'REVERT_LAST_ACTION',
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: await base.version()
  })
}

async function setConditions(base: PlayerControlFixture, actorId: string, conditions: string[]) {
  return base.gm({
    type: 'UPDATE_ACTOR',
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: await base.version(),
    actorId,
    conditions
  })
}

/** The actor's walking-speed budget for the current turn, as the tabletop reads it. */
async function turnBudget(base: PlayerControlFixture, actorId: string) {
  const state = await base.owner.caller.query(sessionState, { campaignId: base.campaign.id })
  return state.turnMovement.find((entry) => entry.actorId === actorId)?.budget
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
    const budget = () => turnBudget(base, base.companion.id)
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
    ).toEqual(['DISADVANTAGE_ON_ATTACKS_AGAINST', 'SAVE_ADVANTAGE'])

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
    expect(encounterBasicActionEffects(await actorState(base, base.enemy.id))).toHaveLength(2)
    await advanceTurn(base)
    expect(encounterBasicActionEffects(await actorState(base, base.enemy.id))).toEqual([])
  })

  it("a player's prompt keeps a hidden dodger's disadvantage but not its name", async () => {
    const base = await basicActionFixture({ bite: 'ATTACK', promptRolls: true })
    await setCurrentActor(base, base.enemy.id)
    await base.gm(await useBasicAction(base, { actorId: base.enemy.id, definitionId: dodge!.id }))
    await base.gm({
      type: 'UPDATE_ACTOR',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: await base.version(),
      actorId: base.enemy.id,
      public: false
    })
    await setActorControllers(base, base.companion.id, [base.player.userId])
    await setCurrentActor(base, base.companion.id)
    await base.gm(await base.bite(base.companion.id, base.enemy.id))

    // The GM sees the source; the player keeps the mechanic under a generic reason.
    expect((await d20Pending(base)).request).toMatchObject({
      rollMode: 'DISADVANTAGE',
      derivedRollModeReasons: ['Dodge']
    })
    const playerPending = await base.player.caller.query(pendingRuleOccurrence, {
      encounterId: base.run.id
    })
    if (playerPending?.kind !== 'D20_EVIDENCE') throw new Error('Expected a player roll prompt.')
    expect(playerPending.request).toMatchObject({
      rollMode: 'DISADVANTAGE',
      derivedRollModeReasons: ['Unseen source']
    })
  })
  it("Dodge gives the dodger's Dexterity saves advantage", async () => {
    const base = await basicActionFixture({ bite: 'SAVE', promptRolls: true })
    await setCurrentActor(base, base.enemy.id)
    await base.gm(await useBasicAction(base, { actorId: base.enemy.id, definitionId: dodge!.id }))
    await setCurrentActor(base, base.companion.id)
    await base.gm(await base.bite(base.companion.id, base.enemy.id))
    expect((await d20Pending(base)).request).toMatchObject({
      rollMode: 'ADVANTAGE',
      derivedRollModeReasons: ['Dodge']
    })
  })

  it('Dodge applies nothing while the dodger is incapacitated, and again once it can act', async () => {
    const base = await basicActionFixture({ bite: 'ATTACK', promptRolls: true })
    const incapacitated = srdSystemRecord.conditionTypes.find(
      (condition) => condition.code === 'INCAPACITATED'
    )
    if (!incapacitated) throw new Error('Missing Incapacitated condition.')
    await setCurrentActor(base, base.enemy.id)
    await base.gm(await useBasicAction(base, { actorId: base.enemy.id, definitionId: dodge!.id }))
    await setConditions(base, base.enemy.id, [incapacitated.id])
    await setCurrentActor(base, base.companion.id)

    await base.gm(await base.bite(base.companion.id, base.enemy.id))
    const suspended = await d20Pending(base)
    expect(suspended.request.rollMode).toBe('NORMAL')
    await base.gm(enterFaces(base, suspended))

    await setConditions(base, base.enemy.id, [])
    await base.gm(
      await base.bite(base.companion.id, base.enemy.id, {
        acknowledgedWarnings: ['ACTION_ECONOMY_UNAVAILABLE']
      })
    )
    expect((await d20Pending(base)).request.rollMode).toBe('DISADVANTAGE')
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

  it("the GM's undo takes a basic action back exactly: its effects, allowance and speed bonus", async () => {
    const base = await basicActionFixture()
    const walking = await turnBudget(base, base.companion.id)
    await base.gm(
      await useBasicAction(base, { actorId: base.companion.id, definitionId: dash!.id })
    )
    expect(await turnBudget(base, base.companion.id)).toBe(walking! * 2)
    await revertLastAction(base)
    expect(await turnBudget(base, base.companion.id)).toBe(walking)
    expect(
      encounterRuleUsageUsed(
        await actorState(base, base.companion.id),
        SRD_ACTION_ALLOWANCE_DEFINITION_ID
      )
    ).toBe(0)

    await base.gm(
      await useBasicAction(base, { actorId: base.companion.id, definitionId: dodge!.id })
    )
    expect(encounterBasicActionEffects(await actorState(base, base.companion.id))).toHaveLength(2)
    await revertLastAction(base)
    const companion = await actorState(base, base.companion.id)
    expect(encounterBasicActionEffects(companion)).toEqual([])
    expect(encounterRuleUsageUsed(companion, SRD_ACTION_ALLOWANCE_DEFINITION_ID)).toBe(0)
    const { entries } = await base.owner.caller.query(timeline, { encounterId: base.run.id })
    expect(entries[0]).toMatchObject({ commandType: 'REVERT_LAST_ACTION' })
    await expect(domainRejection(revertLastAction(base))).resolves.toMatchObject({
      reason: 'REVERT_UNAVAILABLE',
      message: 'The last action was already undone.'
    })
  })

  it('refuses to undo a basic action once a later command changed the Encounter', async () => {
    const base = await basicActionFixture()
    await base.gm(
      await useBasicAction(base, { actorId: base.companion.id, definitionId: dodge!.id })
    )
    await setCurrentActor(base, base.enemy.id)
    await expect(domainRejection(revertLastAction(base))).resolves.toMatchObject({
      reason: 'REVERT_UNAVAILABLE'
    })
    expect(encounterBasicActionEffects(await actorState(base, base.companion.id))).toHaveLength(2)
  })

  it('undoing an attack that used a Help gives the Help back to its helper', async () => {
    const base = await basicActionFixture({ bite: 'ATTACK' })
    await setCurrentActor(base, base.enemy.id)
    await base.gm(
      await useBasicAction(base, {
        actorId: base.enemy.id,
        definitionId: help!.id,
        allyActorId: base.companion.id
      })
    )
    const helped = encounterBasicActionEffects(await actorState(base, base.enemy.id))
    expect(helped).toHaveLength(1)
    await setCurrentActor(base, base.companion.id)
    await base.gm(await base.bite(base.companion.id, base.enemy.id))
    expect(encounterBasicActionEffects(await actorState(base, base.enemy.id))).toEqual([])

    await revertLastAction(base)
    expect(encounterBasicActionEffects(await actorState(base, base.enemy.id))).toEqual(helped)
    expect(
      encounterRuleUsageUsed(
        await actorState(base, base.companion.id),
        SRD_ACTION_ALLOWANCE_DEFINITION_ID
      )
    ).toBe(0)
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
        effects: [
          expect.objectContaining({ mechanic: 'DISADVANTAGE_ON_ATTACKS_AGAINST' }),
          expect.objectContaining({ mechanic: 'SAVE_ADVANTAGE' })
        ],
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
    ).toEqual(['DISADVANTAGE_ON_ATTACKS_AGAINST', 'SAVE_ADVANTAGE'])
  })
})
