import { makeFunctionReference } from 'convex/server'
import { actionTargetActorId } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { readTestActor } from './storedActors'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterCommandInputDto,
  EncounterGmProjectionDto,
  ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  EncounterActionChoicesResponseDto,
  EncounterOptionalActionChoicesDto,
  GetEncounterActionChoicesInputDto,
  GetEncounterOptionalActionChoicesInputDto
} from '@artificer-toolkit/schema/api/encounterActionChoices'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { discoverEncounterFeatureActionCapabilities } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { srdWolf as wolf } from './srdCreatures'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { dagger } from '@artificer-toolkit/source-data/srd/equipment/dagger.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_OPTIONAL_COMBAT_DEFINITIONS } from '@artificer-toolkit/source-data/srd/optionalCombat.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_ACTOR_ACTION_CAPABILITY_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import {
  SRD_ATHLETICS_SKILL_ID,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api, internal } from '../../convex/_generated/api'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ServerContestCheckPendingApplicationContextDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  prepareEncounterDisarmContest,
  readEncounterDisarmSelection,
  requireEncounterDisarmDefinition
} from '@artificer-toolkit/rules-runtime/encounterDisarmPreparation'
import { encounterFacingRule } from '@artificer-toolkit/rules-runtime/encounterFacing'
import type { QueryCtx } from '../../convex/_generated/server'
import { rejectDomain } from '@artificer-toolkit/encounter-persistence/domainRejections'
import { readPendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import { readCharacterRow } from '../../convex/characters/stateDocuments'
import { readReceiptHeaders } from '../../convex/lib/receiptLedgers'
import { createConvexEncounterStoreReader } from '../../convex/lib/convexEncounterStore'
import {
  prepareActionEconomy,
  prepareActionMechanics,
  readActionSceneContext
} from '@artificer-toolkit/encounter-persistence/actionPreparationReads'
import { requireCampaignAuthority } from '../../convex/campaigns/authority'
import { encounterTurnReadTransaction } from '../../convex/encounters/turnReadPorts'
import { readMovementTargets } from './movementTargets'
import { seedActiveInitiative } from './activeInitiative'
import { setupCharacterRun } from './encounterCharacter'
import { importedSubject, importSeededSubjects } from './publication'

import {
  createDisarmCreature,
  createDisarmWeapon,
  disarmHeldEntryId,
  disarmShieldEntryId
} from './disarmCreature'
import { shieldWood } from '@artificer-toolkit/source-data/srd/equipment/shield-wood.js'
import { setAutoRollDice, type FixtureRolls } from './rollPreferences'
import {
  attachFixtureRoom,
  closeRoom,
  executeInRoom,
  readEncounterHistory,
  type RoomCaller
} from './localRoomWorker'
export { disarmHeldEntryId, disarmOtherEntryId, disarmShieldEntryId } from './disarmCreature'
export const getNativeActionChoices = makeFunctionReference<
  'query',
  GetEncounterActionChoicesInputDto,
  EncounterActionChoicesResponseDto
>('encounters/actionChoices:get')
export const getNativeOptionalActionChoices = makeFunctionReference<
  'query',
  GetEncounterOptionalActionChoicesInputDto,
  EncounterOptionalActionChoicesDto
>('encounters/actionChoices:optional')

export async function nativeDisarmFixture(
  rolls: FixtureRolls = 'AUTO_ROLL',
  characterTarget = false,
  characterSource = false,
  shieldTarget = false
) {
  if (characterTarget && characterSource)
    throw new Error('Disarm fixture requires a Creature participant.')
  const weapon = createDisarmWeapon(characterSource ? club.id : undefined)
  const base = await setupCharacterRun({}, characterSource ? weapon : undefined)
  // Each roll follows its actor's controller: the GM for Creatures, the player for the Character.
  for (const userId of [base.owner.userId, base.player.userId])
    await setAutoRollDice(base.t, userId, rolls === 'AUTO_ROLL')
  const sheet = await base.player.caller.query(api.characters.sheet.get, {
    id: base.character.id
  })
  const item = sheet?.inventory.items.find((entry) => entry.equipmentId === club.id)
  if (!sheet || !item) throw new Error('Missing Character club.')
  await base.player.caller.mutation(api.characters.sheetCommands.execute, {
    id: base.character.id,
    command: {
      type: 'EQUIP_ITEM',
      commandId: crypto.randomUUID(),
      expectedVersion: sheet.meta.streamVersion,
      itemId: item.id
    }
  })
  const bite = wolf.features?.find((feature) => feature.label === 'Bite')
  if (!bite) throw new Error('Missing Wolf Bite.')
  const creature = createDisarmCreature(weapon, undefined, shieldTarget)
  const optional = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
    (definition) => definition.document.kind === 'DISARM'
  )
  if (!optional) throw new Error('Missing published Disarm.')
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: [
      optional,
      // A Help reads the actors' choices, which check whether each holder can act.
      ...SRD_RULE_STATE_DEFINITIONS.filter(
        (definition) =>
          definition.id === SRD_ACTION_ALLOWANCE_DEFINITION_ID ||
          definition.id === SRD_ACTOR_ACTION_CAPABILITY_DEFINITION_ID
      )
    ]
  })
  await importSeededSubjects(base.t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({
        ...creature,
        subjectKind: 'CREATURE',
        document: creature
      }),
      importedSubject({
        ...weapon,
        subjectKind: 'EQUIPMENT',
        document: weapon
      }),
      importedSubject({
        ...dagger,
        subjectKind: 'EQUIPMENT',
        document: dagger
      }),
      ...(shieldTarget
        ? [importedSubject({ ...shieldWood, subjectKind: 'EQUIPMENT', document: shieldWood })]
        : [])
    ]
  })
  const blueprint = await base.owner.caller.mutation(
    makeFunctionReference<'mutation', CreateEncounterBlueprintInputDto, EncounterBlueprintDto>(
      'encounters/blueprints:create'
    ),
    {
      gameSystemId: base.campaign.gameSystemId,
      name: 'Native Disarm',
      commandId: crypto.randomUUID(),
      enemies: [
        { kind: 'CREATURE', sourceId: creature.id },
        { kind: 'CREATURE', sourceId: creature.id }
      ]
    }
  )
  const run = await base.owner.caller.mutation(
    makeFunctionReference<'mutation', CreateEncounterInputDto, EncounterGmProjectionDto>(
      'encounters/runs:create'
    ),
    {
      campaignId: base.campaign.id,
      blueprintId: blueprint.id,
      commandId: crypto.randomUUID()
    }
  )
  const creatures = run.actors.filter((actor) => actor.kind === 'CREATURE')
  const actor = characterSource
    ? run.actors.find((candidate) => candidate.kind === 'CHARACTER')
    : creatures[0]
  const target = characterTarget
    ? run.actors.find((candidate) => candidate.kind === 'CHARACTER')
    : creatures[1]
  if (!actor || !target) throw new Error('Missing Disarm participants.')
  await attachFixtureRoom(base.t, base.campaign.id)
  await executeInRoom(base.owner.caller, {
    command: {
      type: 'REPLACE_OPTIONAL_COMBAT_RULES',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: run.version,
      definitionIds: [optional.id]
    }
  })
  // The room holds the Run until it closes; the Run is then started in Convex below, and the first
  // command's room hydrates from it.
  await closeRoom(base.campaign.id)
  const prepared = await base.owner.caller.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', run.id))
      .unique()
    if (!row) throw new Error('Missing Disarm Run.')
    const state = encounterRunStateSchema.parse({
      ...JSON.parse(row.stateJson),
      status: 'ACTIVE',
      automationMode: 'ASSISTED',
      round: 1,
      currentActorId: actor.id
    })
    await ctx.db.patch(row._id, {
      status: 'ACTIVE',
      stateJson: JSON.stringify(state),
      stateChecksum: checksumCanonicalJson(state)
    })
    await seedActiveInitiative(ctx, state, [
      actor.id,
      ...run.actors
        .filter((candidate) => candidate.id !== actor.id)
        .map((candidate) => candidate.id)
    ])
    const rows = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id))
      .collect()
    const actors = await Promise.all(rows.map((value) => readTestActor(ctx, value)))
    const sourceState = actors.find((value) => value.id === actor.id)!
    const targetState = actors.find((value) => value.id === target.id)!
    const actionId = characterSource
      ? await (async () => {
          const targets = await readMovementTargets(ctx, {
            encounterId: state.id,
            expectedEncounterVersion: state.version,
            targetActorIds: [actor.id, target.id],
            includeReactionSources: true
          })
          const mechanics = targets.get(actor.id)?.characterReactionSource?.mechanics
          return mechanics?.rulePolicyInput.actionCandidates.find(
            (candidate) =>
              candidate.equipment?.equipmentId === club.id &&
              candidate.equipment.equipped &&
              candidate.mechanicFacts.invocation.triggerCode === 'MELEE_WEAPON_ATTACK' &&
              mechanics.compiledActionEntryPoints.some(
                (entry) =>
                  entry.actionId === candidate.actionId &&
                  entry.effectId === candidate.effectId &&
                  entry.kind === 'CHARACTER_ACTION' &&
                  entry.compilation.kind === 'COMPILED'
              )
          )?.actionId
        })()
      : discoverEncounterFeatureActionCapabilities({
          spells: new Map(),
          actor: sourceState,
          conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
          abilityDefinitions: (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({
            id,
            code
          }))
        }).find((candidate) => candidate.ownerFeatureId === bite.id)?.actionId
    if (!actionId) throw new Error('Missing equipped Disarm action.')
    const choices = await ctx.runQuery(getNativeActionChoices, {
      encounterId: state.id,
      expectedVersion: state.version,
      actorId: actor.id
    })
    if (!choices?.actions.some((action) => action.id === actionId))
      throw new Error('Public discovery did not offer the equipped Disarm action.')
    const definition = choices.optionalRules.find((value) => value.definitionId === optional.id)
    if (!definition) throw new Error('Public discovery did not offer Disarm.')
    const heldItemId = characterTarget
      ? item.id
      : shieldTarget
        ? disarmShieldEntryId
        : disarmHeldEntryId
    const descriptor = await ctx.runQuery(getNativeOptionalActionChoices, {
      encounterId: state.id,
      expectedVersion: state.version,
      actionId,
      actorId: actor.id,
      targetActorId: target.id,
      definitionId: definition.definitionId,
      sceneContext: null
    })
    const command: ResolveEncounterActionInputDto = {
      type: 'RESOLVE_ACTION',
      acceptedWieldConflict: null,
      acknowledgedWarnings: [],
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: state.version,
      actorId: actor.id,
      target: { kind: 'ACTOR', actorId: target.id },
      actionId,
      sceneContext: null,
      optionalCombatIntent: {
        definitionId: descriptor.definitionId,
        optionId: descriptor.optionId,
        selectionContract: descriptor.selectionContract,
        selections: descriptor.fields.map((field) => {
          const selected = field.options.find(
            (option) => option.id === heldItemId || option.id === SRD_ATHLETICS_SKILL_ID
          )
          if (!selected)
            throw new Error('Public discovery did not offer the expected Disarm selection.')
          return {
            fieldId: field.fieldId,
            value: {
              kind: 'ENTITY' as const,
              entityId: selected.id
            }
          }
        })
      }
    }
    const preparation = await prepareStoredDisarm(ctx, {
      state,
      actors,
      actor: sourceState,
      target: targetState,
      command,
      campaignOwnerUserId: base.owner.userId
    })
    return { command, contest: preparation.contest }
  })
  return {
    ...base,
    run,
    actor,
    target,
    heldItemId: characterTarget ? item.id : shieldTarget ? disarmShieldEntryId : disarmHeldEntryId,
    ...prepared
  }
}

/** Sends a command through the real room as `member`. */
export function disarmInRoom(member: { caller: RoomCaller }, command: EncounterCommandInputDto) {
  return executeInRoom(member.caller, { command })
}

export async function disarmRecords(base: Awaited<ReturnType<typeof nativeDisarmFixture>>) {
  return base.t.run(async (ctx) => {
    const history = await readEncounterHistory(ctx)
    const occurrences = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (q) => q.eq('encounterId', base.run.id))
      .collect()
    const actorRows = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id))
      .collect()
    return {
      run: await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
        .unique(),
      actors: actorRows,
      actorStates: await Promise.all(actorRows.map((row) => readTestActor(ctx, row))),
      occurrences,
      pendingSnapshots: await Promise.all(
        occurrences.map((occurrence) =>
          readPendingSnapshot({ db: createConvexEncounterStoreReader(ctx) }, occurrence)
        )
      ),
      receipts: await history
        .query('encounterRuleReceipts')
        .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', base.run.id))
        .collect(),
      commands: await history
        .query('encounterRunCommands')
        .withIndex('by_encounterId', (q) => q.eq('encounterId', base.run.id))
        .collect(),
      character: await readCharacterRow(ctx, base.character.id),
      characterReceipts: await readReceiptHeaders(
        ctx,
        'characterCommandReceipts',
        await ctx.db
          .query('characterCommandReceipts')
          .withIndex('by_characterId_commandId', (q) => q.eq('characterId', base.character.id))
          .collect()
      )
    }
  })
}

/** The sealed Disarm contest current stored facts produce, as the room plans it; rolls and writes nothing. */
export async function prepareStoredDisarm(
  ctx: QueryCtx,
  input: {
    state: EncounterRunState
    actors: EncounterRunActorState[]
    actor: EncounterRunActorState
    target: EncounterRunActorState
    command: ResolveEncounterActionInputDto
    campaignOwnerUserId: string
    priorContest?: ServerContestCheckPendingApplicationContextDto
  }
) {
  const { state, actor, target, command } = input
  const intent = command.optionalCombatIntent
  if (!intent) throw new Error('Optional combat Disarm is unavailable.')
  const targetActorId = actionTargetActorId(command.target)
  const definition = requireEncounterDisarmDefinition({
    ...input,
    command: {
      ...command,
      targetActorId,
      definitionId: intent.definitionId
    }
  })
  const tx = encounterTurnReadTransaction(ctx)
  const { campaign } = await requireCampaignAuthority(
    ctx,
    state.campaignId,
    input.campaignOwnerUserId
  )
  const prepared = await prepareActionMechanics(tx, {
    state,
    campaign,
    actors: input.actors,
    actor,
    target,
    actionId: command.actionId,
    wieldConflictAcceptance: { kind: 'UNPROMPTED' },
    overridable: false
  })
  const sceneContext = await readActionSceneContext(tx, state, {
    actorId: command.actorId,
    targetActorId,
    sceneContext: command.sceneContext
  })
  const selection = readEncounterDisarmSelection({
    actor,
    target,
    actionId: command.actionId,
    definition,
    prepared,
    sceneContext,
    facing: encounterFacingRule(state),
    rejectTarget: () => rejectDomain('TARGET_UNAVAILABLE', 'Optional combat target is unavailable.')
  })
  const actionEconomy = await prepareActionEconomy(tx, {
    state,
    campaign,
    actor,
    activation: { code: 'ACTION', amount: 1 },
    target: prepared.sourceFacts
  })
  const { contest, graph, currentnessChecksum } = prepareEncounterDisarmContest({
    ...input,
    definition,
    prepared,
    sceneContext,
    selection,
    system: await tx.ports.requireSystem(state.gameSystemId),
    actionEconomy
  })
  return { prepared, contest, graph, actionEconomy, currentnessChecksum, sceneContext }
}
