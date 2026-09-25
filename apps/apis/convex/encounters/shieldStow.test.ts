// @vitest-environment node
import { makeFunctionReference } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterGmProjectionDto,
  ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { createPlatformRulesRuntime } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { planEncounterMechanicsBatch } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { createCharacterResourceOwnerKey } from '@artificer-toolkit/shared/character'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import { greatsword } from '@artificer-toolkit/source-data/srd/equipment/greatsword.js'
import { longsword } from '@artificer-toolkit/source-data/srd/equipment/longsword.js'
import { shieldWood } from '@artificer-toolkit/source-data/srd/equipment/shield-wood.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import {
  commitNativeLiveEncounterAction,
  planNativeLiveEncounterAction
} from '../../../session-worker/src/nativeEncounterRules'
import { seedActiveInitiative } from '../../tests/fixtures/activeInitiative'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import {
  insertActiveLiveAuthority,
  stubLiveSessionFetch,
  workerEnvironment
} from '../../tests/fixtures/liveSessionWorker'
import { getNativeActionChoices } from '../../tests/fixtures/nativeDisarm'
import { importedSubject } from '../../tests/fixtures/publication'
import { api, internal } from '../_generated/api'
import { loadCharacterSheetFacts } from '../characters/sheetFacts'
import { prepareNativeEncounterActionMechanics } from './actionMechanicsPreparation'
import { readRunActor, readRunActors, readRunState } from './documents'
import { loadMovementTargets } from './movementTargets'

const workerSecret = 'private-shield-stow-test-secret-at-least-32-bytes'
const planningOptions = {
  runtime: createPlatformRulesRuntime({
    continuationIntegrityKey: new Uint8Array(32).fill(1),
    definitions: {
      async requireCurrent() {
        throw new Error('Definitions are resolved by sealed action graphs.')
      }
    }
  }),
  random: (maximum: number) => maximum - 1
}

/** Unlimited range keeps the fixture free of Scene positions; grips and properties are unchanged. */
function withUnlimitedRange(weapon: typeof greatsword) {
  return {
    ...weapon,
    effects: weapon.effects?.map((effect) => ({
      ...effect,
      invocation: {
        ...effect.invocation,
        range: { id: effect.invocation.range.id, rangeKind: 'UNLIMITED' as const }
      }
    }))
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

/** A Character carrying a weapon (a two-handed greatsword by default) and a shield, first in initiative. */
async function setup({ weapon = greatsword, shieldEquipped = true, weaponEquipped = false } = {}) {
  const base = await setupCharacterRun({}, withUnlimitedRange(weapon))
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: SRD_RULE_STATE_DEFINITIONS.filter(
      (definition) => definition.id === SRD_ACTION_ALLOWANCE_DEFINITION_ID
    )
  })
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({ ...shieldWood, subjectKind: 'EQUIPMENT', document: shieldWood }),
      importedSubject({ ...wolf, subjectKind: 'CREATURE', document: wolf })
    ]
  })
  const added = await base.player.caller.mutation(api.characters.sheetCommands.execute, {
    id: base.character.id,
    command: {
      type: 'ADD_INVENTORY_ITEM',
      commandId: crypto.randomUUID(),
      expectedVersion: base.characterStreamVersion,
      equipmentId: shieldWood.id,
      quantity: 1
    }
  })
  const shieldItemId = added.sheet.inventory.items.find(
    (item) => item.equipmentId === shieldWood.id
  )?.id
  const weaponItemId = added.sheet.inventory.items.find(
    (item) => item.equipmentId === weapon.id
  )?.id
  if (!shieldItemId || !weaponItemId) throw new Error('Missing shield stow fixture items.')
  const equippedItemIds = [
    ...(weaponEquipped ? [weaponItemId] : []),
    ...(shieldEquipped ? [shieldItemId] : [])
  ]
  for (const [index, itemId] of equippedItemIds.entries())
    await base.player.caller.mutation(api.characters.sheetCommands.execute, {
      id: base.character.id,
      command: {
        type: 'EQUIP_ITEM',
        commandId: crypto.randomUUID(),
        expectedVersion: base.characterStreamVersion + 1 + index,
        itemId
      }
    })
  const blueprint = await base.owner.caller.mutation(
    makeFunctionReference<'mutation', CreateEncounterBlueprintInputDto, EncounterBlueprintDto>(
      'encounters/blueprints:create'
    ),
    {
      gameSystemId: base.campaign.gameSystemId,
      name: 'Shield stow',
      commandId: crypto.randomUUID(),
      enemies: [{ kind: 'CREATURE', sourceId: wolf.id }]
    }
  )
  const run = await base.owner.caller.mutation(
    makeFunctionReference<'mutation', CreateEncounterInputDto, EncounterGmProjectionDto>(
      'encounters/runs:create'
    ),
    { campaignId: base.campaign.id, blueprintId: blueprint.id, commandId: crypto.randomUUID() }
  )
  const actor = run.actors.find((candidate) => candidate.kind === 'CHARACTER')
  const target = run.actors.find((candidate) => candidate.kind === 'CREATURE')
  if (!actor || !target) throw new Error('Missing shield stow participants.')
  const prepared = await base.owner.caller.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', run.id))
      .unique()
    if (!row) throw new Error('Missing shield stow Run.')
    const state = encounterRunStateSchema.parse({
      ...readRunState(row),
      status: 'ACTIVE',
      automationMode: 'AUTOMATIC',
      round: 1,
      currentActorId: actor.id
    })
    const projection = encounterGmProjectionDtoSchema.parse({
      ...JSON.parse(row.projectionJson),
      status: state.status,
      automationMode: state.automationMode,
      round: state.round,
      currentActorId: state.currentActorId
    })
    await ctx.db.patch(row._id, {
      status: state.status,
      stateJson: JSON.stringify(state),
      stateChecksum: checksumCanonicalJson(state),
      projectionJson: JSON.stringify(projection),
      projectionChecksum: checksumCanonicalJson(projection)
    })
    await seedActiveInitiative(ctx, state, [actor.id, target.id])
    const mechanics = (
      await loadMovementTargets(ctx, {
        encounterId: state.id,
        expectedEncounterVersion: state.version,
        targetActorIds: [actor.id],
        includeReactionSources: true
      })
    ).get(actor.id)?.characterReactionSource?.mechanics
    const actionIds = (mechanics?.rulePolicyInput.actionCandidates ?? [])
      .filter(
        (candidate) =>
          candidate.equipment?.equipmentId === weapon.id &&
          mechanics?.compiledActionEntryPoints.some(
            (entry) =>
              entry.actionId === candidate.actionId &&
              entry.kind === 'CHARACTER_ACTION' &&
              entry.compilation.kind === 'COMPILED'
          )
      )
      .map((candidate) => candidate.actionId)
    const actionId = actionIds[0]
    if (!actionId) throw new Error('Missing weapon action.')
    return { state, actionId, actionIds }
  })
  const command = (
    acceptedWieldConflict: ResolveEncounterActionInputDto['acceptedWieldConflict'],
    actionId = prepared.actionId
  ): ResolveEncounterActionInputDto => ({
    type: 'RESOLVE_ACTION',
    encounterId: run.id,
    commandId: crypto.randomUUID(),
    expectedVersion: prepared.state.version,
    actorId: actor.id,
    targetActorId: target.id,
    actionId,
    optionalCombatIntent: null,
    sceneContext: null,
    acceptedWieldConflict
  })
  const armorClass = () =>
    base.owner.caller.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', run.id))
        .unique()
      if (!row) throw new Error('Missing shield stow Run.')
      const state = readRunState(row)
      const source = (
        await loadMovementTargets(ctx, {
          encounterId: state.id,
          expectedEncounterVersion: state.version,
          targetActorIds: [actor.id]
        })
      ).get(actor.id)
      return source?.effectiveRulePolicyOutput?.derivedStats.armorClass.effective
    })
  const characterRow = () =>
    base.t.run((ctx) =>
      ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', base.character.id))
        .unique()
    )
  return {
    ...base,
    run,
    actor,
    target,
    shieldItemId,
    ...prepared,
    command,
    armorClass,
    characterRow
  }
}

const accept = (shieldItemInstanceId: string) => ({
  kind: 'STOW_SHIELD' as const,
  shieldItemInstanceId
})

describe('shield stow on two-handed attacks', () => {
  it('offers the conflict and enforces an exact acceptance in shared preparation', async () => {
    const base = await setup()
    const choices = await base.owner.caller.query(getNativeActionChoices, {
      encounterId: base.run.id,
      expectedVersion: base.state.version,
      actorId: base.actor.id
    })
    expect(choices?.actions.find((action) => action.id === base.actionId)?.wieldConflict).toEqual({
      kind: 'STOW_SHIELD',
      shieldItemInstanceId: base.shieldItemId,
      armorClassDelta: -2
    })
    await base.owner.caller.run(async (ctx) => {
      const actors = await readRunActors(ctx, base.state)
      const prepare = (accepted: ReturnType<typeof accept> | null) =>
        prepareNativeEncounterActionMechanics(ctx, {
          state: base.state,
          actors,
          actor: actors.find((actor) => actor.id === base.actor.id)!,
          target: actors.find((actor) => actor.id === base.target.id)!,
          actionId: base.actionId,
          wieldConflictAcceptance: { kind: 'PROMPTED', accepted },
          campaignOwnerUserId: base.owner.userId
        })
      await expect(prepare(null)).rejects.toThrow(
        'This attack would stow a shield; confirm it first.'
      )
      await expect(prepare(accept(crypto.randomUUID()))).rejects.toThrow('confirm it first')
      expect((await prepare(accept(base.shieldItemId))).acceptedWieldConflict).toEqual({
        kind: 'STOW_SHIELD',
        shieldItemInstanceId: base.shieldItemId,
        armorClassDelta: -2
      })
      const unprompted = await prepareNativeEncounterActionMechanics(ctx, {
        state: base.state,
        actors,
        actor: actors.find((actor) => actor.id === base.actor.id)!,
        target: actors.find((actor) => actor.id === base.target.id)!,
        actionId: base.actionId,
        wieldConflictAcceptance: { kind: 'UNPROMPTED' },
        campaignOwnerUserId: base.owner.userId
      })
      expect(unprompted.acceptedWieldConflict).toBeNull()
    })
  }, 60000)

  it('rejects an acceptance when the attack does not stow a shield', async () => {
    const base = await setup({ shieldEquipped: false })
    const choices = await base.owner.caller.query(getNativeActionChoices, {
      encounterId: base.run.id,
      expectedVersion: base.state.version,
      actorId: base.actor.id
    })
    expect(choices?.actions.find((action) => action.id === base.actionId)?.wieldConflict).toBeNull()
    await expect(
      base.owner.caller.mutation(internal.encounters.commands.execute, {
        command: base.command(accept(base.shieldItemId))
      })
    ).rejects.toThrow('This attack does not stow a shield.')
  }, 60000)

  it('unequips the shield in the same Character version as a resource use', async () => {
    const base = await setup()
    await base.owner.caller.run(async (ctx) => {
      const actor = await readRunActor(ctx, base.state, base.actor.id)
      const loaded = await loadCharacterSheetFacts(
        ctx,
        base.owner.userId,
        base.character.id,
        base.campaign.id
      )
      if (!loaded) throw new Error('Missing shield stow Character.')
      const owner = { kind: 'AUTHORED_GRANT' as const, resourceGrantId: crypto.randomUUID() }
      const plan = planEncounterMechanicsBatch({
        batch: {
          encounterId: base.run.id,
          targetActorId: actor.id,
          expectedEncounterVersion: base.state.version,
          occurrenceId: crypto.randomUUID(),
          sourceCommandId: crypto.randomUUID(),
          commandId: crypto.randomUUID(),
          occurredAt: '2026-09-24T00:00:00.000Z',
          expectedCharacterStreamVersion: loaded.active.streamVersion,
          applications: [],
          effectiveMaximumHitPoints: loaded.active.maximumHitPoints,
          forceVersionAdvance: false,
          stowEquippedItemInstanceId: base.shieldItemId,
          characterResourceConsumption: {
            poolId: createCharacterResourceOwnerKey(owner),
            chargeId: crypto.randomUUID(),
            cost: 1,
            owner,
            usageId: crypto.randomUUID(),
            beforeUsed: 0,
            afterUsed: 1,
            beforeRemaining: 1,
            afterRemaining: 0,
            characterId: loaded.active.id,
            expectedStreamVersion: loaded.active.streamVersion
          }
        },
        actor,
        userId: base.owner.userId,
        characterFacts: loaded
      })
      expect(plan.shouldAdvance).toBe(true)
      expect(plan.characterStreamVersion).toBe(loaded.active.streamVersion + 1)
      expect(plan.updatedActor).toEqual(actor)
      expect(plan.characterUpdate?.character.state.equipment.equipped).not.toContain(
        base.shieldItemId
      )
      expect(plan.characterUpdate?.sheetState?.resourceUsage).toEqual([
        expect.objectContaining({ used: 1 })
      ])
      expect(plan.itemUseStateTransition).toMatchObject({
        kind: 'CHARACTER_ITEM_USE_STATE',
        characterId: loaded.active.id,
        itemInstanceId: base.shieldItemId,
        fromState: 'EQUIPPED',
        toState: 'CARRIED',
        beforeStreamVersion: loaded.active.streamVersion,
        afterStreamVersion: loaded.active.streamVersion + 1
      })
    })
  }, 60000)

  it('commits an accepted stow through the Convex action path and replays it exactly', async () => {
    const base = await setup()
    expect(await base.armorClass()).toBe(14)
    await expect(
      base.owner.caller.mutation(internal.encounters.commands.execute, {
        command: base.command(null)
      })
    ).rejects.toThrow('confirm it first')
    const before = await base.characterRow()
    const command = base.command(accept(base.shieldItemId))
    const result = await base.owner.caller.mutation(internal.encounters.commands.execute, {
      command
    })
    expect(result.occurrence?.status).toBe('COMPLETE')
    const after = await base.characterRow()
    expect(after?.streamVersion).toBe(before!.streamVersion + 1)
    expect(JSON.parse(after!.documentJson).state.equipment.equipped).not.toContain(
      base.shieldItemId
    )
    expect(await base.armorClass()).toBe(12)
    expect(
      await base.owner.caller.mutation(internal.encounters.commands.execute, { command })
    ).toEqual(result)
    expect((await base.characterRow())?.streamVersion).toBe(after!.streamVersion)
  }, 60000)

  it('plans the stow in the room and commits it once through the live action commit', async () => {
    const base = await setup()
    const authorityEpoch = crypto.randomUUID()
    await base.t.run((ctx) =>
      insertActiveLiveAuthority(ctx, {
        campaignId: base.campaign.id,
        epoch: authorityEpoch,
        createdAt: base.campaign.createdAt
      })
    )
    vi.stubEnv('LIVE_SESSION_WORKER_SECRET', workerSecret)
    const environment = workerEnvironment(workerSecret)
    stubLiveSessionFetch((pathname, init) => base.owner.caller.fetch(pathname, init))
    const scope = {
      campaignId: base.campaign.id,
      authorityEpoch,
      expectedUserId: base.owner.userId,
      expectedRole: 'OWNER' as const,
      encounterId: base.run.id,
      expectedVersion: base.state.version
    }
    await expect(
      planNativeLiveEncounterAction(
        environment,
        'fixture-access-token',
        scope,
        base.command(null),
        planningOptions
      )
    ).rejects.toThrow('confirm it first')
    const command = base.command(accept(base.shieldItemId))
    const plan = await planNativeLiveEncounterAction(
      environment,
      'fixture-access-token',
      scope,
      command,
      planningOptions
    )
    if (plan.kind !== 'PLANNED') throw new Error('Expected a completed shield stow plan.')
    // The room's own post-action facts already reflect the stow before Convex commits it.
    expect(
      plan.settlement.projectedTargets.get(base.actor.id)?.effectiveRulePolicyOutput?.derivedStats
        .armorClass.effective
    ).toBe(12)
    const before = await base.characterRow()
    const committed = await commitNativeLiveEncounterAction(
      environment,
      'fixture-access-token',
      scope,
      plan
    )
    const runRow = await base.t.run((ctx) =>
      ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
        .unique()
    )
    expect(JSON.parse(runRow!.projectionJson)).toEqual(committed.projection)
    expect(
      await commitNativeLiveEncounterAction(environment, 'fixture-access-token', scope, plan)
    ).toEqual(committed)
    const after = await base.characterRow()
    expect(after?.streamVersion).toBe(before!.streamVersion + 1)
    expect(JSON.parse(after!.documentJson).state.equipment.equipped).not.toContain(
      base.shieldItemId
    )
    expect(await base.armorClass()).toBe(12)
    const receipt = await base.t.run((ctx) =>
      ctx.db
        .query('encounterRuleReceipts')
        .withIndex('by_campaignId_commandId', (q) =>
          q.eq('campaignId', base.campaign.id).eq('commandId', command.commandId)
        )
        .unique()
    )
    const stored = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt!.resultJson))
    expect(stored).toEqual(plan.storedExecution)
    expect(
      stored.status === 'COMPLETE' &&
        stored.applicationOutputs.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
        ? stored.applicationOutputs.sourceItemUseStateTransition
        : null
    ).toMatchObject({
      itemInstanceId: base.shieldItemId,
      beforeStreamVersion: before!.streamVersion,
      afterStreamVersion: after!.streamVersion
    })
  }, 60000)
})

describe('versatile grips', () => {
  it('offers one- and two-hand longsword attacks; only the two-hand grip stows the shield', async () => {
    const base = await setup({ weapon: longsword })
    const choices = (
      await base.owner.caller.query(getNativeActionChoices, {
        encounterId: base.run.id,
        expectedVersion: base.state.version,
        actorId: base.actor.id
      })
    )?.actions.filter((action) => base.actionIds.includes(action.id))
    const oneHand = choices?.find((action) => action.grip?.value === 'ONE_HANDED')
    const twoHand = choices?.find((action) => action.grip?.value === 'TWO_HANDED')
    expect(choices).toHaveLength(2)
    if (!oneHand || !twoHand) throw new Error('Expected one- and two-hand longsword choices.')
    expect(oneHand).toMatchObject({
      damageLabel: expect.stringMatching(/^1d8 /),
      wieldConflict: null
    })
    expect(twoHand).toMatchObject({
      damageLabel: expect.stringMatching(/^1d10 /),
      grip: { attackKey: oneHand.grip?.attackKey },
      wieldConflict: { kind: 'STOW_SHIELD', shieldItemInstanceId: base.shieldItemId }
    })
    const execute = (command: ResolveEncounterActionInputDto) =>
      base.owner.caller.mutation(internal.encounters.commands.execute, { command })
    await expect(execute(base.command(null, twoHand.id))).rejects.toThrow('confirm it first')
    await expect(execute(base.command(accept(base.shieldItemId), oneHand.id))).rejects.toThrow(
      'This attack does not stow a shield.'
    )
    const result = await execute(base.command(accept(base.shieldItemId), twoHand.id))
    expect(result.occurrence?.status).toBe('COMPLETE')
    expect(
      JSON.parse((await base.characterRow())!.documentJson).state.equipment.equipped
    ).not.toContain(base.shieldItemId)
  }, 60000)
})

describe('drawn weapons', () => {
  it('attacks with a carried weapon using the same modifiers as when it is equipped', async () => {
    const attack = async (weaponEquipped: boolean) => {
      const base = await setup({ shieldEquipped: false, weaponEquipped })
      const choice = (
        await base.owner.caller.query(getNativeActionChoices, {
          encounterId: base.run.id,
          expectedVersion: base.state.version,
          actorId: base.actor.id
        })
      )?.actions.find((action) => action.id === base.actionId)
      const command = base.command(null)
      const result = await base.owner.caller.mutation(internal.encounters.commands.execute, {
        command
      })
      expect(result.occurrence?.status).toBe('COMPLETE')
      const receipt = await base.t.run((ctx) =>
        ctx.db
          .query('encounterRuleReceipts')
          .withIndex('by_campaignId_commandId', (q) =>
            q.eq('campaignId', base.campaign.id).eq('commandId', command.commandId)
          )
          .unique()
      )
      const stored = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt!.resultJson))
      if (
        stored.status !== 'COMPLETE' ||
        stored.applicationOutputs.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
      )
        throw new Error('Expected a completed Creature-target attack.')
      return {
        attackBonus: choice?.attackBonus,
        rolledModifier: stored.applicationOutputs.d20?.modifier
      }
    }
    const equipped = await attack(true)
    const carried = await attack(false)
    expect(carried.attackBonus).toEqual(expect.any(Number))
    expect(carried.rolledModifier).toBe(carried.attackBonus)
    expect(carried).toEqual(equipped)
  }, 90000)
})
