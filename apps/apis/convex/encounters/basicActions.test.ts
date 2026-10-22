import { makeFunctionReference } from 'convex/server'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { describe, expect, it } from 'vitest'
import type {
  EncounterActionChoicesResponseDto,
  GetEncounterActionChoicesInputDto
} from '@artificer-toolkit/schema/api/encounterActionChoices'
import type { EncounterSessionStateDto } from '@artificer-toolkit/schema/api/encounterData'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounters'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import { encounterBasicActionId } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import { encounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
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
  storeRunAutomationMode,
  type PlayerControlFixture
} from '../../tests/fixtures/playerControl'
import {
  attachFixtureRoom,
  checkpointLiveRoom,
  executeInRoom,
  readRoomTimeline,
  roomErrorLogs,
  type RoomCaller,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
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
const pendingRuleOccurrence = makeFunctionReference<
  'query',
  { encounterId: string },
  PendingEncounterRuleOccurrenceSummaryDto | null
>('encounters/pendingReads:pendingRuleOccurrence')

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
  await attachFixtureRoom(base.t, base.campaign.id)
  return base
}

/**
 * RESOLVE_ACTION for one of the actor's authored basic actions, found in the choices the actor is
 * offered (a self-targeted action).
 */
async function resolveBasicAction(
  base: PlayerControlFixture,
  actorId: string,
  label: string,
  overrides: Partial<ResolveEncounterActionInputDto> = {}
): Promise<ResolveEncounterActionInputDto> {
  const expectedVersion = await base.version()
  const choices = await base.owner.caller.query(actionChoices, {
    encounterId: base.run.id,
    expectedVersion,
    actorId
  })
  const choice = choices?.basicActionChoices.find((entry) => entry.label === label)
  if (!choice) throw new Error(`The actor is not offered the ${label} basic action.`)
  return {
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    acknowledgedWarnings: [],
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion,
    actorId,
    target: { kind: 'ACTOR', actorId },
    actionId: choice.id,
    optionalCombatIntent: null,
    sceneContext: null,
    ...overrides
  }
}

/** The helper's Help on the ally (an authored basic action aimed at another creature). */
async function resolveHelp(
  base: PlayerControlFixture,
  helperId: string,
  allyId: string,
  overrides: Partial<ResolveEncounterActionInputDto> = {}
) {
  return resolveBasicAction(base, helperId, 'Help', {
    target: { kind: 'ACTOR', actorId: allyId },
    ...overrides
  })
}

/** The Active Effects the Encounter actor holds (Dodge's grant while it lasts). */
async function activeEffects(base: PlayerControlFixture, actorId: string) {
  await checkpointLiveRoom(base.campaign.id)
  return base.t.run((ctx) =>
    ctx.db
      .query('encounterActiveRuleEffects')
      .withIndex('by_encounterId_targetActorId_createdOrdinal_id', (q) =>
        q.eq('encounterId', base.run.id).eq('targetActorId', actorId)
      )
      .collect()
  )
}

async function activeEffectCount(base: PlayerControlFixture, actorId: string) {
  return (await activeEffects(base, actorId)).length
}

/** What each stored Active Effect on the actor grants: its authored effect, label and modifiers. */
async function storedGrants(base: PlayerControlFixture, actorId: string) {
  return (await activeEffects(base, actorId)).map((effect) => {
    const definition = JSON.parse(effect.definitionJson) as {
      authoredEffectId: string
      stateContributions: {
        sourceLabel: string
        modifiers: {
          valueDomainCode: string
          modifierKind: string
          payload?: unknown
          domain: unknown
          restrictions: { conditions: { kind: string }[] }[]
        }[]
      }[]
    }
    return {
      authoredEffectId: definition.authoredEffectId,
      grants: definition.stateContributions.map((contribution) => ({
        sourceLabel: contribution.sourceLabel,
        modifiers: contribution.modifiers.map((modifier) => ({
          valueDomainCode: modifier.valueDomainCode,
          modifierKind: modifier.modifierKind,
          ...(modifier.payload === undefined ? {} : { payload: modifier.payload }),
          domain: modifier.domain,
          conditions: modifier.restrictions.map((group) =>
            group.conditions.map((condition) => condition.kind)
          )
        }))
      }))
    }
  })
}

const firstAidDefinition = SRD_BASIC_ACTION_DEFINITIONS.find(
  ({ id }) => id === SRD_BASIC_ACTION_IDS.FIRST_AID
)
if (firstAidDefinition?.document.kind !== 'BASIC_ACTION')
  throw new Error('Missing First Aid fixture.')

const dodgeDefinition = SRD_BASIC_ACTION_DEFINITIONS.find(
  ({ id }) => id === SRD_BASIC_ACTION_IDS.DODGE
)
if (dodgeDefinition?.document.kind !== 'BASIC_ACTION') throw new Error('Missing Dodge fixture.')

/** Dodge's restriction groups: one per holder kind, each needing it can act and move (D152). */
const dodgeConditions = [
  ['HOLDER_KIND', 'CAN_ACT', 'SPEED_ABOVE_ZERO'],
  ['HOLDER_KIND', 'CAN_ACT', 'SPEED_ABOVE_ZERO']
]

/** The one Active Effect Dodge leaves: its authored effect, with disadvantage against attacks and Dexterity save advantage. */
const dodgeGrant = {
  authoredEffectId: dodgeDefinition.document.effects[0]!.id,
  grants: [
    {
      sourceLabel: 'Dodge',
      modifiers: [
        ...['MELEE', 'RANGED', 'SPELL', 'UNARMED'].map((attackDomain) => ({
          valueDomainCode: 'ATTACKS_AGAINST',
          modifierKind: 'ROLL_INFLUENCE',
          payload: { influence: 'DISADVANTAGE' },
          domain: { attackDomain, requiresHolderSeesAttacker: true },
          conditions: dodgeConditions
        })),
        {
          valueDomainCode: 'SAVING_THROW_MODIFIER',
          modifierKind: 'ROLL_INFLUENCE',
          payload: { influence: 'ADVANTAGE' },
          domain: { ability: 'DEXTERITY' },
          conditions: dodgeConditions
        }
      ]
    }
  ]
}

/** The actor as the room last published it: the room holds the Run until it checkpoints (D85). */
async function actorState(base: PlayerControlFixture, actorId: string) {
  await checkpointLiveRoom(base.campaign.id)
  const row = await base.t.run((ctx) =>
    ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id).eq('id', actorId))
      .unique()
  )
  if (!row) throw new Error('Missing Encounter actor.')
  return readStoredRunActor(row)
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
  await checkpointLiveRoom(base.campaign.id)
  const state = await base.owner.caller.query(sessionState, { campaignId: base.campaign.id })
  return state.turnMovement
    .find((entry) => entry.actorId === actorId)
    ?.allowances.find((allowance) => allowance.code === 'WALK')?.budget
}

async function advanceTurn(base: PlayerControlFixture) {
  return base.gm({
    type: 'ADVANCE_TURN',
    encounterId: base.run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: await base.version()
  })
}

async function pendingFor(base: PlayerControlFixture, caller: RoomCaller) {
  await checkpointLiveRoom(base.campaign.id)
  return caller.query(pendingRuleOccurrence, { encounterId: base.run.id })
}

async function d20Pending(base: PlayerControlFixture) {
  const pending = await pendingFor(base, base.owner.caller)
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
  useLocalRoomWorker()

  it("offers the System's catalogue apart from features and logs an action without mechanics", async () => {
    const base = await basicActionFixture()
    const choices = await base.owner.caller.query(actionChoices, {
      encounterId: base.run.id,
      expectedVersion: await base.version(),
      actorId: base.companion.id
    })
    expect(choices?.actions.map((action) => action.id)).toContain(base.actionId)
    // First Aid is an authored basic action like the others (a CHECK action), not a closed mechanic entry.
    expect(choices?.basicActionChoices.map(({ label }) => label)).toEqual([
      'Dash',
      'Disengage',
      'Dodge',
      'First Aid',
      'Grapple',
      'Help',
      'Hide',
      'Ready',
      'Rouse',
      'Search',
      'Shove',
      'Use an Object'
    ])
    // First Aid costs an Action and refuses its user as the target; Dash only affects its user.
    expect(
      choices?.basicActionChoices
        .filter(({ label }) => label === 'First Aid' || label === 'Dash')
        .map(({ label, actionCost, target }) => [label, actionCost, target])
    ).toEqual([
      ['Dash', 'ACTION', { kind: 'SELF' }],
      ['First Aid', 'ACTION', { kind: 'ACTOR', self: 'REFUSED' }]
    ])

    const before = await base.version()
    const budgetBefore = await turnBudget(base, base.companion.id)
    const result = await base.gm(await resolveBasicAction(base, base.companion.id, 'Use an Object'))
    expect(result.projection.version).toBe(before + 1)
    const companion = await actorState(base, base.companion.id)
    expect(await activeEffectCount(base, base.companion.id)).toBe(0)
    expect(await turnBudget(base, base.companion.id)).toBe(budgetBefore)
    expect(encounterRuleUsageUsed(companion, SRD_ACTION_ALLOWANCE_DEFINITION_ID)).toBe(1)
    const entries = await readRoomTimeline(base.owner.caller, base.campaign.id)
    expect(entries[0]).toMatchObject({ commandType: 'RESOLVE_ACTION', label: 'Use an Object' })
  })

  it('Dash spends the action and adds the speed to this turn’s budget; a second one warns first', async () => {
    const base = await basicActionFixture()
    const budget = () => turnBudget(base, base.companion.id)
    const walking = await budget()
    expect(walking).toBeGreaterThan(0)

    await base.gm(await resolveBasicAction(base, base.companion.id, 'Dash'))
    expect(await budget()).toBe(walking! * 2)
    // The bonus lives in this turn's budget only; Dash leaves no lasting effect.
    expect(await activeEffectCount(base, base.companion.id)).toBe(0)
    expect(
      encounterRuleUsageUsed(
        await actorState(base, base.companion.id),
        SRD_ACTION_ALLOWANCE_DEFINITION_ID
      )
    ).toBe(1)

    // The action is spent: Assisted mode warns, and "Do it anyway" records the override.
    await expect(
      domainRejection(base.gm(await resolveBasicAction(base, base.companion.id, 'Dash')))
    ).resolves.toMatchObject({
      reason: 'RULE_WARNINGS',
      warnings: [expect.objectContaining({ code: 'ACTION_ECONOMY_UNAVAILABLE' })]
    })
    await base.gm(
      await resolveBasicAction(base, base.companion.id, 'Dash', {
        acknowledgedWarnings: ['ACTION_ECONOMY_UNAVAILABLE']
      })
    )
    expect(await budget()).toBe(walking! * 3)
    const entries = await readRoomTimeline(base.owner.caller, base.campaign.id)
    expect(entries[0]).toMatchObject({
      label: 'Dash',
      ruleOverrides: [expect.objectContaining({ code: 'ACTION_ECONOMY_UNAVAILABLE' })]
    })
    // Restrained sets the speed to 0 (D94), so every Dash adds nothing; removing it restores it.
    const restrained = srdSystemRecord.conditionTypes.find((value) => value.code === 'RESTRAINED')
    if (!restrained) throw new Error('Missing Restrained condition fixture.')
    await setConditions(base, base.companion.id, [restrained.id])
    expect(await budget()).toBe(0)
    await setConditions(base, base.companion.id, [])
    expect(await budget()).toBe(walking! * 3)
  })

  it('Disengage aimed at another creature warns first, and "Do it anyway" bends the rule onto that creature', async () => {
    const base = await basicActionFixture()
    const atEnemy = { target: { kind: 'ACTOR' as const, actorId: base.enemy.id } }
    await expect(
      domainRejection(
        base.gm(await resolveBasicAction(base, base.companion.id, 'Disengage', atEnemy))
      )
    ).resolves.toMatchObject({
      reason: 'RULE_WARNINGS',
      warnings: [{ code: 'TARGET_OUT_OF_RANGE', message: 'This action can only target its user.' }]
    })
    await base.gm(
      await resolveBasicAction(base, base.companion.id, 'Disengage', {
        ...atEnemy,
        acknowledgedWarnings: ['TARGET_OUT_OF_RANGE']
      })
    )
    // A self-range target is a bendable rule like any authored action's: the override applies it as chosen.
    expect(await activeEffectCount(base, base.companion.id)).toBe(0)
    expect(await activeEffectCount(base, base.enemy.id)).toBe(1)
  })

  it('Dash aimed at another creature warns that it can only target its user', async () => {
    const base = await basicActionFixture()
    await expect(
      domainRejection(
        base.gm(
          await resolveBasicAction(base, base.companion.id, 'Dash', {
            target: { kind: 'ACTOR', actorId: base.enemy.id }
          })
        )
      )
    ).resolves.toMatchObject({
      reason: 'RULE_WARNINGS',
      warnings: [{ code: 'TARGET_OUT_OF_RANGE', message: 'This action can only target its user.' }]
    })
  })

  it('Dodge gives attacks against the actor disadvantage, reads "Dodge", and ends at its next turn', async () => {
    const base = await basicActionFixture({ bite: 'ATTACK', promptRolls: true })
    await setCurrentActor(base, base.enemy.id)
    await base.gm(await resolveBasicAction(base, base.enemy.id, 'Dodge'))
    expect(await storedGrants(base, base.enemy.id)).toEqual([dodgeGrant])

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
    expect(await storedGrants(base, base.enemy.id)).toEqual([dodgeGrant])
    await advanceTurn(base)
    expect(await activeEffectCount(base, base.enemy.id)).toBe(0)
  })

  it('an attack entry in the timeline reads the label of the attack', async () => {
    const base = await basicActionFixture({ bite: 'ATTACK' })
    await setCurrentActor(base, base.companion.id)
    await base.gm(await base.bite(base.companion.id, base.enemy.id))
    const entries = await readRoomTimeline(base.owner.caller, base.campaign.id)
    expect(entries[0]).toMatchObject({ commandType: 'RESOLVE_ACTION', label: 'Bite' })
  })

  it('an Invisible attacker its Character target cannot see rolls with advantage, named "Unseen attacker"', async () => {
    const base = await basicActionFixture({ bite: 'ATTACK', promptRolls: true })
    const invisible = srdSystemRecord.conditionTypes.find((value) => value.code === 'INVISIBLE')
    if (!invisible) throw new Error('Missing Invisible condition fixture.')
    await setConditions(base, base.companion.id, [invisible.id])
    await base.gm(await base.bite(base.companion.id, base.character.id))
    expect((await d20Pending(base)).request).toMatchObject({
      rollMode: 'ADVANTAGE',
      derivedRollModeReasons: ['Unseen attacker']
    })
  })

  it("Dodge's disadvantage does not apply against an attacker the dodger cannot see", async () => {
    const base = await basicActionFixture({ bite: 'ATTACK', promptRolls: true })
    const invisible = srdSystemRecord.conditionTypes.find((value) => value.code === 'INVISIBLE')
    if (!invisible) throw new Error('Missing Invisible condition fixture.')
    await setCurrentActor(base, base.character.id)
    await base.gm(await resolveBasicAction(base, base.character.id, 'Dodge'))
    await setConditions(base, base.companion.id, [invisible.id])
    await setCurrentActor(base, base.companion.id)
    await base.gm(await base.bite(base.companion.id, base.character.id))
    expect((await d20Pending(base)).request).toMatchObject({
      rollMode: 'ADVANTAGE',
      derivedRollModeReasons: ['Unseen attacker']
    })
  })

  it("a player's prompt keeps a hidden dodger's disadvantage but not its name", async () => {
    const base = await basicActionFixture({ bite: 'ATTACK', promptRolls: true })
    await setCurrentActor(base, base.enemy.id)
    await base.gm(await resolveBasicAction(base, base.enemy.id, 'Dodge'))
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
    const playerPending = await pendingFor(base, base.player.caller)
    if (playerPending?.kind !== 'D20_EVIDENCE') throw new Error('Expected a player roll prompt.')
    expect(playerPending.request).toMatchObject({
      rollMode: 'DISADVANTAGE',
      derivedRollModeReasons: ['Unseen source']
    })
  })
  it("Dodge gives the dodger's Dexterity saves advantage", async () => {
    const base = await basicActionFixture({ bite: 'SAVE', promptRolls: true })
    await setCurrentActor(base, base.enemy.id)
    await base.gm(await resolveBasicAction(base, base.enemy.id, 'Dodge'))
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
    await base.gm(await resolveBasicAction(base, base.enemy.id, 'Dodge'))
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

  it("Help gives the ally's next attack roll advantage once and leaves the helper unaffected", async () => {
    const base = await basicActionFixture({ bite: 'ATTACK', promptRolls: true })
    await setCurrentActor(base, base.enemy.id)
    await base.gm(await resolveHelp(base, base.enemy.id, base.companion.id))
    expect(await activeEffectCount(base, base.enemy.id)).toBe(0)
    expect(await activeEffectCount(base, base.character.id)).toBe(0)
    expect(await activeEffectCount(base, base.companion.id)).toBe(1)
    await setCurrentActor(base, base.companion.id)

    await base.gm(await base.bite(base.companion.id, base.enemy.id))
    const first = await d20Pending(base)
    expect(first.request).toMatchObject({ rollMode: 'ADVANTAGE', derivedRollModeReasons: ['Help'] })
    await base.gm(enterFaces(base, first))
    expect(await activeEffectCount(base, base.companion.id)).toBe(0)

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
    await base.gm(await resolveBasicAction(base, base.companion.id, 'Dash'))
    expect(await turnBudget(base, base.companion.id)).toBe(walking! * 2)
    await revertLastAction(base)
    expect(await turnBudget(base, base.companion.id)).toBe(walking)
    expect(
      encounterRuleUsageUsed(
        await actorState(base, base.companion.id),
        SRD_ACTION_ALLOWANCE_DEFINITION_ID
      )
    ).toBe(0)

    await base.gm(await resolveBasicAction(base, base.companion.id, 'Dodge'))
    expect(await storedGrants(base, base.companion.id)).toEqual([dodgeGrant])
    await revertLastAction(base)
    const companion = await actorState(base, base.companion.id)
    expect(await activeEffectCount(base, base.companion.id)).toBe(0)
    expect(encounterRuleUsageUsed(companion, SRD_ACTION_ALLOWANCE_DEFINITION_ID)).toBe(0)
    const entries = await readRoomTimeline(base.owner.caller, base.campaign.id)
    expect(entries[0]).toMatchObject({ commandType: 'REVERT_LAST_ACTION' })
    await expect(domainRejection(revertLastAction(base))).resolves.toMatchObject({
      reason: 'REVERT_UNAVAILABLE',
      message: 'The last action was already undone.'
    })
  })

  it('refuses to undo a basic action once a later command changed the Encounter', async () => {
    const base = await basicActionFixture()
    await base.gm(await resolveBasicAction(base, base.companion.id, 'Dodge'))
    await setCurrentActor(base, base.enemy.id)
    await expect(domainRejection(revertLastAction(base))).resolves.toMatchObject({
      reason: 'REVERT_UNAVAILABLE'
    })
    expect(await storedGrants(base, base.companion.id)).toEqual([dodgeGrant])
  })

  it('undoing an attack that used a Help gives the Help back to the ally', async () => {
    const base = await basicActionFixture({ bite: 'ATTACK' })
    await setCurrentActor(base, base.enemy.id)
    await base.gm(await resolveHelp(base, base.enemy.id, base.companion.id))
    const helped = await activeEffects(base, base.companion.id)
    expect(helped).toHaveLength(1)
    const helpedGrants = await storedGrants(base, base.companion.id)
    await setCurrentActor(base, base.companion.id)
    await base.gm(await base.bite(base.companion.id, base.enemy.id))
    expect(await activeEffectCount(base, base.companion.id)).toBe(0)

    await revertLastAction(base)
    expect(await storedGrants(base, base.companion.id)).toEqual(helpedGrants)
    expect(
      (await activeEffects(base, base.companion.id)).map(({ id, definitionJson }) => [
        id,
        definitionJson
      ])
    ).toEqual(helped.map(({ id, definitionJson }) => [id, definitionJson]))
    expect(
      encounterRuleUsageUsed(
        await actorState(base, base.companion.id),
        SRD_ACTION_ALLOWANCE_DEFINITION_ID
      )
    ).toBe(0)
  })

  it("an unused Help survives the ally's turn and the helper's end of turn, and ends when the helper's next turn starts", async () => {
    const base = await basicActionFixture()
    await setCurrentActor(base, base.enemy.id)
    await base.gm(await resolveHelp(base, base.enemy.id, base.companion.id))
    expect(await activeEffectCount(base, base.companion.id)).toBe(1)

    let turn = await advanceTurn(base)
    let sawAllyTurn = false
    for (let steps = 0; turn.projection.currentActorId !== base.enemy.id; steps += 1) {
      if (steps > 6) throw new Error('The turn order never returned to the helper.')
      sawAllyTurn ||= turn.projection.currentActorId === base.companion.id
      // The grant is still held through the helper's end of turn and the ally's whole turn.
      expect(await activeEffectCount(base, base.companion.id)).toBe(1)
      turn = await advanceTurn(base)
    }
    expect(sawAllyTurn).toBe(true)
    expect(await activeEffectCount(base, base.companion.id)).toBe(0)
  })
  it("undoing a Help removes the grant and returns the helper's Action", async () => {
    const base = await basicActionFixture()
    await setCurrentActor(base, base.enemy.id)
    await base.gm(await resolveHelp(base, base.enemy.id, base.companion.id))
    expect(await activeEffectCount(base, base.companion.id)).toBe(1)
    expect(
      encounterRuleUsageUsed(
        await actorState(base, base.enemy.id),
        SRD_ACTION_ALLOWANCE_DEFINITION_ID
      )
    ).toBe(1)

    await revertLastAction(base)
    expect(await activeEffectCount(base, base.companion.id)).toBe(0)
    expect(
      encounterRuleUsageUsed(
        await actorState(base, base.enemy.id),
        SRD_ACTION_ALLOWANCE_DEFINITION_ID
      )
    ).toBe(0)
  })

  it('Help refuses to be aimed at oneself, and a player may help only an actor they can see', async () => {
    const base = await basicActionFixture()
    await expect(
      domainRejection(base.gm(await resolveBasicAction(base, base.companion.id, 'Help')))
    ).resolves.toMatchObject({ reason: 'TARGET_UNAVAILABLE' })
    await expect(
      domainRejection(
        base.gm(
          await resolveBasicAction(base, base.companion.id, 'Disengage', {
            target: { kind: 'ACTOR', actorId: base.enemy.id }
          })
        )
      )
    ).resolves.toMatchObject({
      reason: 'RULE_WARNINGS',
      warnings: [{ code: 'TARGET_OUT_OF_RANGE', message: 'This action can only target its user.' }]
    })
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
          command: await resolveHelp(base, base.companion.id, base.lurker.id)
        })
      )
    ).resolves.toMatchObject({ reason: 'TARGET_UNAVAILABLE' })
  })

  it('Help on a hostile target warns, and "Do it anyway" applies the grant to it alone', async () => {
    const base = await basicActionFixture()
    await setCurrentActor(base, base.character.id)
    await expect(
      domainRejection(base.gm(await resolveHelp(base, base.character.id, base.companion.id)))
    ).resolves.toMatchObject({
      reason: 'RULE_WARNINGS',
      warnings: [{ code: 'TARGET_DISPOSITION', message: 'This action needs a willing target.' }]
    })
    expect(await activeEffectCount(base, base.companion.id)).toBe(0)

    await base.gm(
      await resolveHelp(base, base.character.id, base.companion.id, {
        acknowledgedWarnings: ['TARGET_DISPOSITION']
      })
    )
    expect(await storedGrants(base, base.companion.id)).toMatchObject([
      { grants: [{ sourceLabel: 'Help' }] }
    ])
    expect(await activeEffectCount(base, base.character.id)).toBe(0)
    expect(await activeEffectCount(base, base.enemy.id)).toBe(0)
  })

  it('refuses First Aid, whose action carries a check, in a Manual Run (ENCOUNTER-2)', async () => {
    const base = await basicActionFixture()
    const command = await resolveBasicAction(base, base.companion.id, 'First Aid', {
      target: { kind: 'ACTOR', actorId: base.character.id }
    })
    await storeRunAutomationMode(base.t, base.run.id, 'MANUAL')
    const before = await base.version()
    await expect(domainRejection(base.gm(command))).resolves.toMatchObject({
      reason: 'ASSISTED_ONLY'
    })
    expect(await base.version()).toBe(before)
  })

  it('refuses First Aid from a custom actor, which has no check facts', async () => {
    const base = await basicActionFixture()
    const firstAid = await resolveBasicAction(base, base.companion.id, 'First Aid', {
      actorId: base.lurker.id,
      actionId: encounterBasicActionId(
        base.lurker.id,
        SRD_BASIC_ACTION_IDS.FIRST_AID,
        firstAidDefinition.document.effects[0]!.id
      ),
      target: { kind: 'ACTOR', actorId: base.character.id },
      acknowledgedWarnings: ['TARGET_DISPOSITION', 'TARGET_NOT_DYING', 'TARGET_RANGE_UNCHECKED']
    })
    await setCurrentActor(base, base.lurker.id)
    const before = await base.version()
    await expect(base.gm({ ...firstAid, expectedVersion: before })).rejects.toThrow()
    expect(roomErrorLogs().join('\n')).toContain('A custom actor has no check to make.')
    expect(await base.version()).toBe(before)
  })

  it('the room commits a Dodge once, checkpointing its effects and exactly one version', async () => {
    const base = await basicActionFixture()
    const command = await resolveBasicAction(base, base.companion.id, 'Dodge')
    const committed = await executeInRoom(base.owner.caller, { command })
    expect(committed.projection.version).toBe(command.expectedVersion + 1)
    expect(await base.version()).toBe(command.expectedVersion + 1)
    expect(await storedGrants(base, base.companion.id)).toEqual([dodgeGrant])
  })
})
