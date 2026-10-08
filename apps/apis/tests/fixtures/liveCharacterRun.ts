import { makeFunctionReference } from 'convex/server'
import { expect } from 'vitest'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterExecuteInput,
  EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import type { CharacterSheetCommandInputDto } from '@artificer-toolkit/schema/api/characterSheetCommandInputs'
import { isCharacterSheetLivePlayCommand } from '@artificer-toolkit/schema/api/characterSheetLiveCommands'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { discoverEncounterFeatureActionCapabilities } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { healersKit10Uses } from '@artificer-toolkit/source-data/srd/equipment/healers-kit-10-uses.js'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { readRunActor, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { createConvexEncounterStoreReader } from '../../convex/lib/convexEncounterStore'
import { api, internal } from '../../convex/_generated/api'
import { loadCharacterSheetFacts } from '../../convex/characters/sheetFacts'
import { readCharacterLiveHold } from '../../convex/liveSessions/authorityGuard'
import { readCharacterRecord, readCharacterRow } from '../../convex/characters/stateDocuments'
import { srdWolf as wolf } from './srdCreatures'
import { importedSubject } from './publication'
import { setupCharacterRun } from './encounterCharacter'
import { createEncounterInitiativeDefinitions } from './encounterInitiative'
import {
  attachRoomWorker,
  checkpointLiveRoom,
  executeInRoom,
  executeSheetInRoom,
  seedRoomContentSnapshots
} from './localRoomWorker'

const createBlueprint = makeFunctionReference<
  'mutation',
  CreateEncounterBlueprintInputDto,
  EncounterBlueprintDto
>('encounters/blueprints:create')
const createRun = makeFunctionReference<
  'mutation',
  CreateEncounterInputDto,
  EncounterGmProjectionDto
>('encounters/runs:create')

const wolfBite = wolf.features?.find((feature) => feature.label === 'Bite')
const wolfBiteEffect = wolfBite?.effects?.[0]
if (!wolfBite || !wolfBiteEffect || wolfBiteEffect.invocation.kind !== 'ACTION')
  throw new Error('Missing Wolf Bite fixture.')
const biteInvocation = wolfBiteEffect.invocation

/** A one-damage, any-range action so the journey needs no Scene geometry. */
function oneDamageBite() {
  return {
    ...structuredClone(wolfBiteEffect!),
    invocation: {
      ...biteInvocation,
      triggerCode: 'ACTIVATED' as const,
      range: { id: biteInvocation.range.id, rangeKind: 'UNLIMITED' as const },
      targeting: { selectionKind: 'SINGLE_TARGET' as const, dispositionKind: 'ANY' as const }
    },
    paths: wolfBiteEffect!.paths?.slice(0, 1).map((path) => {
      if (!('resultBlock' in path)) return path
      return {
        ...path,
        pathCode: 'ON_USE' as const,
        resultBlock: {
          ...path.resultBlock,
          outcomes: path.resultBlock.outcomes.map((outcome) => {
            if (outcome.effectKind !== 'DAMAGE') throw new Error('Expected Bite damage.')
            return {
              id: outcome.id,
              effectKind: 'DAMAGE' as const,
              damageTypeId: outcome.damageTypeId,
              valueKind: 'FIXED' as const,
              scalingKind: 'NONE' as const,
              amount: 1
            }
          })
        }
      }
    })
  }
}

const deafenedCondition = srdSystemRecord.conditionTypes.find(
  (condition) => condition.code === 'DEAFENED'
)
if (!deafenedCondition) throw new Error('Missing Deafened condition.')
export const deafened = deafenedCondition

const creature = {
  ...wolf,
  id: crypto.randomUUID(),
  features: wolf.features?.map((feature) =>
    feature.label === 'Bite' ? { ...feature, effects: [oneDamageBite()] } : feature
  )
}

/**
 * An Assisted Run of one Character and one Creature that bites for one damage. withAlly also seats
 * the GM's own Character, who carries the SRD Healer's Kit.
 */
export async function setup({ withAlly = false } = {}) {
  const characterEffect = oneDamageBite()
  const base = await setupCharacterRun(
    {
      spellcasting: {
        ...wizard.spellcasting!,
        spellLimits: [
          {
            classLevel: 1,
            slots: [{ spellLevel: 1, slotCount: 2 }],
            learnedSpellsLimit: 0,
            cantripsLimit: 0
          }
        ]
      },
      features: [
        {
          ...structuredClone(wolfBite!),
          id: crypto.randomUUID(),
          availableAtLevel: 1,
          effects: [characterEffect]
        }
      ]
    },
    withAlly ? healersKit10Uses : undefined,
    withAlly
  )
  await attachRoomWorker(base.t)
  const initiative = createEncounterInitiativeDefinitions([
    { procedure: 'ACTOR_ROLL', cadence: 'ENCOUNTER_START' }
  ])
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: [
      ...SRD_RULE_STATE_DEFINITIONS.filter(
        (definition) =>
          definition.id === SRD_ACTION_ALLOWANCE_DEFINITION_ID || definition.id === deafened.id
      ),
      ...SRD_BASIC_ACTION_DEFINITIONS.filter(
        (definition) => definition.id === SRD_BASIC_ACTION_IDS.FIRST_AID
      ),
      ...initiative.definitions
    ]
  })
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ ...creature, subjectKind: 'CREATURE', document: creature })]
  })
  const settings = await base.owner.caller.query(api.campaigns.playSettings.get, {
    campaignId: base.campaign.id
  })
  const { version, updatedAt: _updatedAt, ...settingFields } = settings
  await base.owner.caller.mutation(api.campaigns.playSettings.save, {
    ...settingFields,
    expectedVersion: version,
    automationMode: 'ASSISTED',
    initiativePolicyDefinitionId: initiative.policyIds[0]!,
    initiativeTieDefinitionId: null
  })
  await seedRoomContentSnapshots(base.campaign.id)
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: base.campaign.gameSystemId,
    name: 'Live Character state journey',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CREATURE', sourceId: creature.id }]
  })
  const run = await base.owner.caller.mutation(createRun, {
    campaignId: base.campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const hero = run.actors.find((actor) => actor.sourceId === base.character.id)
  const ally = base.gmCharacterId
    ? run.actors.find((actor) => actor.sourceId === base.gmCharacterId)
    : undefined
  if (base.gmCharacterId && !ally) throw new Error('Missing journey ally.')
  const enemy = run.actors.find((actor) => actor.kind === 'CREATURE')
  if (!hero || !enemy) throw new Error('Missing journey actors.')
  const actionIds = await base.t.run(async (ctx) => {
    const facts = await loadCharacterSheetFacts(
      ctx,
      base.owner.userId,
      base.character.id,
      base.campaign.id
    )
    const heroAction = facts?.ruleEvaluation.facts.actionCandidates.find(
      (candidate) => candidate.effectId === characterEffect.id
    )
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', run.id))
      .unique()
    if (!row || !heroAction) throw new Error('Missing journey action sources.')
    const enemyAction = discoverEncounterFeatureActionCapabilities({
      actor: await readRunActor(
        { db: createConvexEncounterStoreReader(ctx) },
        readRunState(row),
        enemy.id
      ),
      conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
      abilityDefinitions: (srdSystemRecord.abilities ?? []).map((ability) => ({
        id: ability.id,
        code: ability.code
      }))
    }).find((capability) => capability.mechanicFacts.invocation.triggerCode === 'ACTIVATED')
    if (!enemyAction) throw new Error('Missing journey Creature action.')
    const kitAction = base.gmCharacterId
      ? (
          await loadCharacterSheetFacts(
            ctx,
            base.owner.userId,
            base.gmCharacterId,
            base.campaign.id
          )
        )?.ruleEvaluation.facts.actionCandidates.find(
          (candidate) =>
            candidate.activationSourceKind === 'ACTIVE_EQUIPMENT' &&
            candidate.effectId === healersKit10Uses.effects?.[0]?.id
        )
      : undefined
    if (base.gmCharacterId && !kitAction) throw new Error('Missing Healer’s Kit action.')
    return {
      hero: heroAction.actionId,
      kit: kitAction?.actionId ?? null,
      enemy: enemyAction.actionId
    }
  })
  return { ...base, run, hero, ally, enemy, actionIds }
}

export type Fixture = Awaited<ReturnType<typeof setup>>

export function execute(
  fixture: Fixture,
  command: (base: { encounterId: string; commandId: string }) => EncounterExecuteInput['command']
) {
  return executeInRoom(fixture.owner.caller, {
    command: command({ encounterId: fixture.run.id, commandId: crypto.randomUUID() })
  })
}

export async function sheetCommand(
  fixture: Fixture,
  command: (base: { commandId: string; expectedVersion: number }) => CharacterSheetCommandInputDto
) {
  // The room holds the Character's play state, so the Sheet version is read after a checkpoint.
  // The held receipt's `targetTransition.before.conditionIds` is asserted in `nativeRoomEffectReceipts.test.ts`.
  await checkpointLiveRoom(fixture.campaign.id)
  const sheet = await fixture.player.caller.query(api.characters.sheet.get, {
    id: fixture.character.id
  })
  if (!sheet) throw new Error('Missing journey Sheet.')
  const input = command({
    commandId: crypto.randomUUID(),
    expectedVersion: sheet.meta.streamVersion
  })
  // Once the room holds the Character, play-state commands go through it; Sheet adjustments and
  // edits made before the Run starts stay Convex-direct.
  const held = await fixture.t.run((ctx) => readCharacterLiveHold(ctx, fixture.character.id))
  if (held && isCharacterSheetLivePlayCommand(input)) {
    await executeSheetInRoom(fixture.player.caller, {
      scope: 'CHARACTER_SHEET',
      characterId: fixture.character.id,
      encounterId: fixture.run.id,
      command: input
    })
    return
  }
  await fixture.player.caller.mutation(api.characters.sheetCommands.execute, {
    id: fixture.character.id,
    command: input
  })
}

export async function storedCharacter(fixture: Fixture) {
  await checkpointLiveRoom(fixture.campaign.id)
  return fixture.t.run(async (ctx) => {
    const row = await readCharacterRow(ctx, fixture.character.id)
    if (!row) throw new Error('Missing journey Character.')
    return characterAuthoredDtoSchema.parse(readCharacterRecord(row)) as CharacterAuthored
  })
}

export type CommandResult = Awaited<ReturnType<typeof execute>>

export function advance(fixture: Fixture, result: CommandResult) {
  const expectedVersion = result.projection.version
  return execute(fixture, (base) => ({ ...base, type: 'ADVANCE_TURN', expectedVersion }))
}

export async function start(fixture: Fixture) {
  let result = await execute(fixture, (base) => ({
    ...base,
    type: 'START',
    expectedVersion: fixture.run.version
  }))
  while (result.occurrence?.status === 'PENDING') {
    const pending = result.occurrence.pending
    if (!pending || pending.kind !== 'INITIATIVE_ORDER' || !pending.optionIds[0])
      throw new Error('Unexpected Automatic initiative decision.')
    const occurrence = result.occurrence
    const expectedVersion = result.projection.version
    result = await execute(fixture, (base) => ({
      ...base,
      type: 'RESOLVE_RULE_OCCURRENCE',
      expectedVersion,
      correlationId: null,
      occurrenceId: occurrence.occurrenceId,
      expectedOccurrenceVersion: occurrence.occurrenceVersion,
      resolution: {
        kind: 'INITIATIVE_ENTITY',
        requestId: pending.requestId,
        entityId: pending.optionIds[0]!
      }
    }))
  }
  expect(result.projection.status).toBe('ACTIVE')
  return result
}

/** Advances turns until ctorId is the current actor. */
export async function toActorTurn(fixture: Fixture, from: CommandResult, actorId: string) {
  let result = await advance(fixture, from)
  while (result.projection.currentActorId !== actorId) result = await advance(fixture, result)
  return result
}

/** Advances turns until the Creature is the current actor. */
export function toEnemyTurn(fixture: Fixture, from: CommandResult) {
  return toActorTurn(fixture, from, fixture.enemy.id)
}

/** Has the Creature bite the Character, once the Creature is the current actor. */
export async function enemyBites(fixture: Fixture, from: CommandResult) {
  const expectedVersion = from.projection.version
  const result = await execute(fixture, (base) => ({
    ...base,
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    acknowledgedWarnings: [],
    expectedVersion,
    actorId: fixture.enemy.id,
    targetActorId: fixture.hero.id,
    actionId: fixture.actionIds.enemy,
    optionalCombatIntent: null,
    sceneContext: null
  }))
  expect(result.occurrence?.status).toBe('COMPLETE')
  return result
}
