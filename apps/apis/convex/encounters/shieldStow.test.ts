import { createConvexEncounterStoreReader } from '../lib/convexEncounterStore'
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
import { encounterBasicActionId } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import { planEncounterMechanicsBatch } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { createCharacterResourceOwnerKey } from '@artificer-toolkit/shared/character'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdWolf as wolf } from '../../tests/fixtures/srdCreatures'
import { dagger } from '@artificer-toolkit/source-data/srd/equipment/dagger.js'
import { greatsword } from '@artificer-toolkit/source-data/srd/equipment/greatsword.js'
import { longbow } from '@artificer-toolkit/source-data/srd/equipment/longbow.js'
import { longsword } from '@artificer-toolkit/source-data/srd/equipment/longsword.js'
import { shieldWood } from '@artificer-toolkit/source-data/srd/equipment/shield-wood.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { activateFixtureRun } from '../../tests/fixtures/activeInitiative'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import {
  attachRoomWorker,
  checkpointLiveRoom,
  checkpointRoom,
  executeInRoom,
  expectRedactedRoomRefusal,
  readRoomRollCards,
  roomErrorLogs,
  seedRoomContentSnapshots,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { getNativeActionChoices } from '../../tests/fixtures/nativeDisarm'
import {
  restrictedAction,
  restrictedTo,
  useAnObjectEffectId
} from '../../tests/fixtures/restrictedBasicAction'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { SRD_BASIC_ACTION_DEFINITIONS } from '@artificer-toolkit/source-data/srd/basicActions.js'
import { sourceImportBatches } from '../content/importBatches'
import { api, internal } from '../_generated/api'
import { loadCharacterSheetFacts } from '../characters/sheetFacts'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'
import { prepareActionMechanics } from '@artificer-toolkit/encounter-persistence/actionPreparationReads'
import { requireCampaignAuthority } from '../campaigns/authority'
import {
  readRunActor,
  readRunActors,
  readRunState
} from '@artificer-toolkit/encounter-persistence/documents'
import { readEncounterGmProjection } from '@artificer-toolkit/encounter-persistence/nativeProjection'
import { encounterReadTransaction } from './encounterReadPorts'
import { readMovementTargets } from '../../tests/fixtures/movementTargets'
import { encounterTurnReadTransaction } from './turnReadPorts'

useLocalRoomWorker()
afterEach(() => {
  vi.unstubAllEnvs()
})

/** The room redacts a refusal to the member; its cause is what the room logged as an error. */
async function expectRefusalCause(command: Promise<unknown>, cause: string) {
  await expectRedactedRoomRefusal(command, 'The Encounter command could not be completed.')
  await vi.waitFor(() =>
    expect(roomErrorLogs()).toEqual(expect.arrayContaining([expect.stringContaining(cause)]))
  )
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

/** A System-authored basic action taken only with a free hand. */
const needsFreeHand = restrictedAction(30, 'Pull Free', restrictedTo(30, 'FREE_HAND'))

/**
 * A Character carrying a weapon (a two-handed greatsword by default) and a shield, first in
 * initiative. With `basicActions`, the System also offers its basic actions and `needsFreeHand`.
 */
async function setup({
  weapon = greatsword,
  shieldEquipped = true,
  weaponEquipped = false,
  authoredRange = false,
  basicActions = false
} = {}) {
  const base = await setupCharacterRun({}, authoredRange ? weapon : withUnlimitedRange(weapon))
  await attachRoomWorker(base.t)
  for (const definitions of sourceImportBatches(
    basicActions
      ? [...SRD_RULE_STATE_DEFINITIONS, ...SRD_BASIC_ACTION_DEFINITIONS, needsFreeHand]
      : SRD_RULE_STATE_DEFINITIONS.filter(
          (definition) => definition.id === SRD_ACTION_ALLOWANCE_DEFINITION_ID
        )
  ))
    await base.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions
    })
  await importSeededSubjects(base.t, {
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
  expect(added).not.toHaveProperty('sheet')
  const addedSheet = (await base.player.caller.query(api.characters.sheet.get, {
    id: added.characterId
  }))!
  const shieldItemId = addedSheet.inventory.items.find(
    (item) => item.equipmentId === shieldWood.id
  )?.id
  const weaponItemId = addedSheet.inventory.items.find((item) => item.equipmentId === weapon.id)?.id
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
  await seedRoomContentSnapshots(base.campaign.id)
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
    const state = await activateFixtureRun(
      ctx,
      run.id,
      { automationMode: 'ASSISTED', round: 1, currentActorId: actor.id },
      [actor.id, target.id]
    )
    const mechanics = (
      await readMovementTargets(ctx, {
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
    const rangedActionId = (mechanics?.rulePolicyInput.actionCandidates ?? []).find(
      (candidate) =>
        actionIds.includes(candidate.actionId) &&
        candidate.mechanicFacts.invocation.triggerCode === 'RANGED_WEAPON_ATTACK'
    )?.actionId
    return { state, actionId, actionIds, rangedActionId }
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
    target: { kind: 'ACTOR', actorId: target.id },
    actionId,
    optionalCombatIntent: null,
    sceneContext: null,
    acceptedWieldConflict,
    acknowledgedWarnings: []
  })
  const armorClass = async () => {
    await checkpointLiveRoom(base.campaign.id)
    return base.owner.caller.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', run.id))
        .unique()
      if (!row) throw new Error('Missing shield stow Run.')
      const state = readRunState(row)
      const source = (
        await readMovementTargets(ctx, {
          encounterId: state.id,
          expectedEncounterVersion: state.version,
          targetActorIds: [actor.id]
        })
      ).get(actor.id)
      return source?.effectiveRulePolicyOutput?.derivedStats.armorClass.effective
    })
  }
  const characterRow = async () => {
    await checkpointLiveRoom(base.campaign.id)
    return base.t.run((ctx) => readCharacterRow(ctx, base.character.id))
  }
  return {
    ...base,
    run,
    actor,
    target,
    shieldItemId,
    weaponItemId,
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
      const tx = encounterTurnReadTransaction(ctx)
      const { campaign } = await requireCampaignAuthority(
        ctx,
        base.state.campaignId,
        base.owner.userId
      )
      const actors = await readRunActors(tx, base.state)
      const prepare = (accepted: ReturnType<typeof accept> | null) =>
        prepareActionMechanics(tx, {
          state: base.state,
          campaign,
          actors,
          actor: actors.find((actor) => actor.id === base.actor.id)!,
          target: actors.find((actor) => actor.id === base.target.id)!,
          actionId: base.actionId,
          wieldConflictAcceptance: { kind: 'PROMPTED', accepted, handHolds: 0 },
          overridable: true
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
      const unprompted = await prepareActionMechanics(tx, {
        state: base.state,
        campaign,
        actors,
        actor: actors.find((actor) => actor.id === base.actor.id)!,
        target: actors.find((actor) => actor.id === base.target.id)!,
        actionId: base.actionId,
        wieldConflictAcceptance: { kind: 'UNPROMPTED' },
        overridable: true
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
    await expectRefusalCause(
      executeInRoom(base.owner.caller, {
        command: base.command(accept(base.shieldItemId))
      }),
      'This attack does not stow a shield.'
    )
  }, 60000)

  it('unequips the shield in the same Character version as a resource use', async () => {
    const base = await setup()
    await base.owner.caller.run(async (ctx) => {
      const actor = await readRunActor(
        { db: createConvexEncounterStoreReader(ctx) },
        base.state,
        base.actor.id
      )
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
          expectedCharacterStreamVersion: loaded.active.play.streamVersion,
          applications: [],
          effectiveMaximumHitPoints: loaded.active.play.maximumHitPoints,
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
            expectedStreamVersion: loaded.active.play.streamVersion
          }
        },
        actor,
        userId: base.owner.userId,
        characterFacts: loaded
      })
      expect(plan.shouldAdvance).toBe(true)
      expect(plan.characterStreamVersion).toBe(loaded.active.play.streamVersion + 1)
      expect(plan.updatedActor).toEqual(actor)
      expect(plan.characterUpdate?.character.state.equipment.equipped).not.toContainEqual(
        expect.objectContaining({ itemId: base.shieldItemId })
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
        beforeStreamVersion: loaded.active.play.streamVersion,
        afterStreamVersion: loaded.active.play.streamVersion + 1
      })
    })
  }, 60000)

  it('commits an accepted stow through the Convex action path and replays it exactly', async () => {
    const base = await setup()
    expect(await base.armorClass()).toBe(14)
    await expectRefusalCause(
      executeInRoom(base.owner.caller, {
        command: base.command(null)
      }),
      'confirm it first'
    )
    const before = await base.characterRow()
    const command = base.command(accept(base.shieldItemId))
    const result = await executeInRoom(base.owner.caller, {
      command
    })
    expect(result.occurrence?.status).toBe('COMPLETE')
    const after = await base.characterRow()
    expect(after?.play.streamVersion).toBe(before!.play.streamVersion + 1)
    expect(readCharacterRecord(after!).state.equipment.equipped).not.toContainEqual(
      expect.objectContaining({ itemId: base.shieldItemId })
    )
    expect(await base.armorClass()).toBe(12)
    // Sending the settled command again is a retry: the room's held history answers it.
    expect(await executeInRoom(base.owner.caller, { command })).toEqual(result)
    expect((await base.characterRow())?.play.streamVersion).toBe(after!.play.streamVersion)
  }, 60000)

  it('commits the stow once and the checkpointed projection matches the room result', async () => {
    const base = await setup()
    const before = await base.characterRow()
    const result = await executeInRoom(base.owner.caller, {
      command: base.command(accept(base.shieldItemId))
    })
    await checkpointRoom(base.campaign.id)
    const storedProjection = await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
        .unique()
      return readEncounterGmProjection(encounterReadTransaction(ctx), readRunState(row!))
    })
    expect(storedProjection).toEqual(result.projection)
    const after = await base.characterRow()
    expect(after?.play.streamVersion).toBe(before!.play.streamVersion + 1)
    expect(await base.armorClass()).toBe(12)
  }, 60000)
})

describe('a basic action stows a held weapon for free to free a hand (D152)', () => {
  /** Pull Free on the Character itself, accepting `acceptedWieldConflict`. */
  const pullFree = (
    base: Awaited<ReturnType<typeof setup>>,
    acceptedWieldConflict: ResolveEncounterActionInputDto['acceptedWieldConflict']
  ) => ({
    ...base.command(
      acceptedWieldConflict,
      encounterBasicActionId(base.actor.id, needsFreeHand.id, useAnObjectEffectId)
    ),
    target: { kind: 'ACTOR' as const, actorId: base.actor.id }
  })
  const stow = (itemInstanceId: string) => ({ kind: 'STOW_HELD_WEAPON' as const, itemInstanceId })

  it('offers the stow of the weapon beside a shield and commits only an exact acceptance', async () => {
    const base = await setup({ weapon: longsword, weaponEquipped: true, basicActions: true })
    const choices = await base.owner.caller.query(getNativeActionChoices, {
      encounterId: base.run.id,
      expectedVersion: base.state.version,
      actorId: base.actor.id
    })
    expect(
      choices?.basicActionChoices.find(({ label }) => label === 'Pull Free')?.wieldConflict
    ).toEqual(stow(base.weaponItemId))
    await expectRefusalCause(
      executeInRoom(base.owner.caller, { command: pullFree(base, null) }),
      'This action would stow a held weapon; confirm it first.'
    )
    await expectRefusalCause(
      executeInRoom(base.owner.caller, { command: pullFree(base, stow(base.shieldItemId)) }),
      'This action would stow a held weapon; confirm it first.'
    )
    const before = await base.characterRow()
    const result = await executeInRoom(base.owner.caller, {
      command: pullFree(base, stow(base.weaponItemId))
    })
    expect(result.occurrence?.status).toBe('COMPLETE')
    const after = await base.characterRow()
    expect(after?.play.streamVersion).toBe(before!.play.streamVersion + 1)
    const equipped = readCharacterRecord(after!).state.equipment.equipped
    expect(equipped).not.toContainEqual(expect.objectContaining({ itemId: base.weaponItemId }))
    expect(equipped).toContainEqual(expect.objectContaining({ itemId: base.shieldItemId }))
    expect(await base.armorClass()).toBe(14)
  }, 60000)

  it('refuses a stow while a hand is already free', async () => {
    const base = await setup({ basicActions: true })
    const choices = await base.owner.caller.query(getNativeActionChoices, {
      encounterId: base.run.id,
      expectedVersion: base.state.version,
      actorId: base.actor.id
    })
    expect(
      choices?.basicActionChoices.find(({ label }) => label === 'Pull Free')?.wieldConflict
    ).toBeNull()
    await expectRefusalCause(
      executeInRoom(base.owner.caller, { command: pullFree(base, stow(base.shieldItemId)) }),
      'This action stows nothing.'
    )
  }, 60000)
})

describe('versatile grips', () => {
  it.each([
    {
      weapon: longsword,
      range: { kind: 'WITHIN', distance: { amount: 5, unit: 'FEET' } },
      rangeLabel: '5 ft'
    },
    {
      weapon: longbow,
      range: {
        kind: 'RANGED',
        normal: { amount: 150, unit: 'FEET' },
        long: { amount: 600, unit: 'FEET' }
      },
      rangeLabel: '150/600 ft'
    }
  ])('offers the authored range of a Character $weapon.label attack', async (expected) => {
    const base = await setup({ weapon: expected.weapon, authoredRange: true })
    const weaponChoices = (
      await base.owner.caller.query(getNativeActionChoices, {
        encounterId: base.run.id,
        expectedVersion: base.state.version,
        actorId: base.actor.id
      })
    )?.actions.filter((action) => base.actionIds.includes(action.id))
    expect(weaponChoices?.length).toBeGreaterThan(0)
    for (const action of weaponChoices ?? [])
      expect(action).toMatchObject({ range: expected.range, rangeLabel: expected.rangeLabel })
  })

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
      executeInRoom(base.owner.caller, { command })
    await expectRefusalCause(execute(base.command(null, twoHand.id)), 'confirm it first')
    await expectRefusalCause(
      execute(base.command(accept(base.shieldItemId), oneHand.id)),
      'This attack does not stow a shield.'
    )
    const result = await execute(base.command(accept(base.shieldItemId), twoHand.id))
    expect(result.occurrence?.status).toBe('COMPLETE')
    expect(
      readCharacterRecord((await base.characterRow())!).state.equipment.equipped
    ).not.toContainEqual(expect.objectContaining({ itemId: base.shieldItemId }))
  }, 60000)

  it('undoes a stow by putting the shield back in the off hand it left (D107)', async () => {
    const base = await setup({ weapon: longsword, weaponEquipped: true })
    const handsBefore = readCharacterRecord((await base.characterRow())!).state.equipment.equipped
    expect(handsBefore).toContainEqual({ itemId: base.shieldItemId, slot: 'OFF_HAND' })
    const twoHand = (
      await base.owner.caller.query(getNativeActionChoices, {
        encounterId: base.run.id,
        expectedVersion: base.state.version,
        actorId: base.actor.id
      })
    )?.actions.find(
      (action) => base.actionIds.includes(action.id) && action.grip?.value === 'TWO_HANDED'
    )
    if (!twoHand) throw new Error('Expected a two-hand longsword choice.')
    await executeInRoom(base.owner.caller, {
      command: base.command(accept(base.shieldItemId), twoHand.id)
    })
    expect(
      readCharacterRecord((await base.characterRow())!).state.equipment.equipped
    ).not.toContainEqual(expect.objectContaining({ itemId: base.shieldItemId }))
    await executeInRoom(base.owner.caller, {
      command: {
        type: 'REVERT_LAST_ACTION',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.state.version + 1
      }
    })
    expect(readCharacterRecord((await base.characterRow())!).state.equipment.equipped).toEqual(
      handsBefore
    )
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
      const result = await executeInRoom(base.owner.caller, {
        command
      })
      expect(result.occurrence?.status).toBe('COMPLETE')
      // The attack roll's modifier, as the room reports the roll card to the table.
      const cards = await readRoomRollCards(base.player.caller, base.campaign.id)
      return {
        attackBonus: choice?.attackBonus,
        rolledModifier: cards.find((card) => card.source.kind === 'ATTACK')?.evidence.modifier
      }
    }
    const equipped = await attack(true)
    const carried = await attack(false)
    expect(carried.attackBonus).toEqual(expect.any(Number))
    expect(carried.rolledModifier).toBe(carried.attackBonus)
    expect(carried).toEqual(equipped)
  }, 90000)
})

describe('thrown weapons (D107, ATTACK-19.3)', () => {
  const heldItems = async (base: Awaited<ReturnType<typeof setup>>) =>
    readCharacterRecord((await base.characterRow())!).state.equipment.equipped

  it('throws the wielded dagger out of the hand and undo puts it back', async () => {
    const base = await setup({ weapon: dagger, weaponEquipped: true, shieldEquipped: false })
    expect(await heldItems(base)).toContainEqual({ itemId: base.weaponItemId, slot: 'MAIN_HAND' })
    if (!base.rangedActionId) throw new Error('Expected a thrown dagger action.')
    await executeInRoom(base.owner.caller, { command: base.command(null, base.rangedActionId) })
    expect(await heldItems(base)).not.toContainEqual(
      expect.objectContaining({ itemId: base.weaponItemId })
    )
    await executeInRoom(base.owner.caller, {
      command: {
        type: 'REVERT_LAST_ACTION',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: base.state.version + 1
      }
    })
    expect(await heldItems(base)).toContainEqual({ itemId: base.weaponItemId, slot: 'MAIN_HAND' })
  }, 60000)

  it('keeps the dagger in hand for a melee stab', async () => {
    const base = await setup({ weapon: dagger, weaponEquipped: true, shieldEquipped: false })
    const before = await heldItems(base)
    await executeInRoom(base.owner.caller, { command: base.command(null) })
    expect(await heldItems(base)).toEqual(before)
  }, 60000)
})
