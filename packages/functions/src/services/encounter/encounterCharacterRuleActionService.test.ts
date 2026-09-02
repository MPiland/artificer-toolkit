import { describe, expect, it, vi } from 'vitest'

function assistedD20Request(input: {
  readonly status: 'PENDING'
  readonly request?: { readonly requestId: string }
}): { readonly requestId: string } {
  if (!input.request) throw new Error('Expected a d20 action pause.')
  return input.request
}

const ids = {
  action: '00000000-0000-4000-8000-000000000001',
  actor: '00000000-0000-4000-8000-000000000002',
  targetActor: '00000000-0000-4000-8000-000000000025',
  user: '00000000-0000-4000-8000-000000000003',
  targetUser: '00000000-0000-4000-8000-000000000026',
  command: '00000000-0000-4000-8000-000000000004',
  encounter: '00000000-0000-4000-8000-000000000005',
  character: '00000000-0000-4000-8000-000000000006',
  targetCharacter: '00000000-0000-4000-8000-000000000027',
  thirdActor: '00000000-0000-4000-8000-000000000028',
  thirdCharacter: '00000000-0000-4000-8000-000000000029',
  maintenanceDefinition: '00000000-0000-4000-8000-000000000030',
  otherMaintenanceDefinition: '00000000-0000-4000-8000-000000000031',
  maintainedState: '00000000-0000-4000-8000-000000000032',
  replacementState: '00000000-0000-4000-8000-000000000033',
  priorCharacterEffect: '00000000-0000-4000-8000-000000000034',
  priorThirdCharacterEffect: '00000000-0000-4000-8000-000000000035',
  priorEncounterEffect: '00000000-0000-4000-8000-000000000036',
  campaign: '00000000-0000-4000-8000-000000000007',
  system: '00000000-0000-0000-0000-000000000001',
  effect: '00000000-0000-4000-8000-000000000008',
  condition: '00000000-0000-4000-8000-000000000009'
}

const state = vi.hoisted(() => {
  const receipts = new Map<string, Record<string, unknown>>()
  const encounterEvents = new Map<string, Record<string, unknown>>()
  const characterEvents: Array<Record<string, unknown>> = []
  const occurrences = new Map<string, Record<string, unknown>>()
  const maintainedStates = new Map<string, Record<string, unknown>>()
  const maintainedDependents: Array<Record<string, unknown>> = []
  const mechanicsCasKeys = new Set<string>()
  const overlayCasKeys = new Set<string>()
  const assignmentLocks: string[] = []
  const calls = {
    appendCharacterEvent: vi.fn(async (input: Record<string, unknown>) => {
      characterEvents.push(input)
    }),
    appendEncounterEvent: vi.fn(async (input: Record<string, unknown>) => {
      encounterEvents.set(String(input.commandId), input)
    }),
    actionEvaluation: vi.fn(),
    advanceMechanics: vi.fn(async (_input: unknown) => undefined),
    createActiveRuleEffect: vi.fn(),
    createMaintainedState: vi.fn(),
    deleteActiveRuleEffect: vi.fn(),
    deleteMaintainedState: vi.fn(),
    findMaintainedState: vi.fn(),
    listDependentEffects: vi.fn(),
    lockDependentEffects: vi.fn(),
    lockActiveEffects: vi.fn(),
    lockMaintainedState: vi.fn(),
    lockMaintainedStateById: vi.fn(),
    requireMaintenanceDefinition: vi.fn(),
    context: vi.fn(),
    lock: vi.fn(),
    listResourceUsage: vi.fn(),
    patchHitPoints: vi.fn(),
    patchSheetState: vi.fn(),
    publishEncounter: vi.fn(async () => undefined),
    publishOverlay: vi.fn(async (_input: unknown) => undefined),
    runtime: vi.fn(),
    setResourceUsage: vi.fn(async () => undefined),
    updateActor: vi.fn(async (_input: unknown) => undefined)
  }
  return {
    calls,
    mechanicsCasKeys,
    occurrences,
    maintainedStates,
    maintainedDependents,
    overlayCasKeys,
    assignmentLocks,
    receipts,
    encounterEvents,
    characterEvents,
    characterVersions: new Map<string, number>(),
    transaction: {} as { selectFrom(table: string): unknown },
    mechanics: {} as {
      characterStreamVersion: number
      projectionChecksum: string
      commandState: {
        systemId: string
        state: {
          conditions?: Array<{ conditionTypeId: string }>
          hitpoints: { current: number; temp: number }
        }
      }
      compiledActionEntryPoints: unknown[]
      systemVocabularySnapshotId?: string
      systemVocabularySnapshotVersion?: number
      systemVocabularySnapshotChecksum?: string
      rulePolicyInput?: Record<string, unknown>
      rulePolicyOutput?: Record<string, unknown>
    },
    targetMechanics: null as null | {
      characterStreamVersion: number
      projectionChecksum: string
      commandState: {
        systemId: string
        state: {
          conditions?: Array<{ conditionTypeId: string }>
          hitpoints: { current: number; temp: number }
        }
      }
      compiledActionEntryPoints: unknown[]
      rulePolicyInput?: Record<string, unknown>
      rulePolicyOutput?: Record<string, unknown>
    },
    thirdMechanics: null as null | {
      characterStreamVersion: number
      projectionChecksum: string
      commandState: {
        systemId: string
        state: {
          conditions?: Array<{ conditionTypeId: string }>
          hitpoints: { current: number; temp: number }
        }
      }
      compiledActionEntryPoints: unknown[]
      rulePolicyInput?: Record<string, unknown>
      rulePolicyOutput?: Record<string, unknown>
    },
    overlay: {} as {
      campaignId: string
      kind: string
      mechanicalContextChecksum: string
      manualMaximumModifierOwner: null
      projectionChecksum: string
      rulePolicyInput: Record<string, unknown>
      rulePolicyOutput: {
        derivedStats: { abilities: unknown[]; maxHitPoints: { effective: number } }
        defenses: Array<{
          damageTypeId: string
          kind: 'IMMUNITY' | 'RESISTANCE' | 'VULNERABILITY'
        }>
        actionDecisions?: unknown[]
        resources?: unknown[]
        savingThrowDefinitions?: unknown[]
      }
    },
    targetOverlay: null as null | {
      campaignId: string
      kind: string
      mechanicalContextChecksum: string
      manualMaximumModifierOwner: null
      projectionChecksum: string
      rulePolicyInput: Record<string, unknown>
      rulePolicyOutput: {
        derivedStats: { abilities: unknown[]; maxHitPoints: { effective: number } }
        defenses: Array<{
          damageTypeId: string
          kind: 'IMMUNITY' | 'RESISTANCE' | 'VULNERABILITY'
        }>
        actionDecisions?: unknown[]
        resources?: unknown[]
        savingThrowDefinitions?: unknown[]
      }
    },
    thirdOverlay: null as null | {
      campaignId: string
      kind: string
      mechanicalContextChecksum: string
      manualMaximumModifierOwner: null
      projectionChecksum: string
      rulePolicyInput: Record<string, unknown>
      rulePolicyOutput: {
        derivedStats: { abilities: unknown[]; maxHitPoints: { effective: number } }
        defenses: Array<{
          damageTypeId: string
          kind: 'IMMUNITY' | 'RESISTANCE' | 'VULNERABILITY'
        }>
        actionDecisions?: unknown[]
        resources?: unknown[]
      }
    },
    encounter: {} as {
      actors: Array<Record<string, unknown>>
      automationMode: 'ASSISTED' | 'AUTOMATIC' | 'MANUAL'
      manualReminderMode?: 'OFF' | 'SUBTLE'
      campaignId: string
      currentActorId: string
      gameSystemId: string
      id: string
      sessionId: string
      status: string
      version: number
    },
    currentProjection: {} as Record<string, unknown>,
    vocabularySnapshot: null as null | Record<string, unknown>,
    vocabularySnapshots: new Map<string, Record<string, unknown>>()
  }
})

vi.mock('@artificer-toolkit/db', () => {
  const repository = {
    findReceipt: vi.fn(
      async (_kind: string, aggregateId: string, commandId: string) =>
        state.receipts.get(`${aggregateId}:${commandId}`) ?? null
    ),
    lockOccurrence: vi.fn(async (_kind: string, aggregateId: string, occurrenceId: string) => {
      const occurrence = state.occurrences.get(occurrenceId)
      return occurrence?.aggregateId === aggregateId ? occurrence : null
    }),
    lockPendingEncounter: vi.fn(
      async (aggregateId: string) =>
        [...state.occurrences.values()].find(
          (occurrence) => occurrence.aggregateId === aggregateId && occurrence.state === 'PENDING'
        ) ?? null
    ),
    createPending: vi.fn(async (input: Record<string, unknown>) => {
      const occurrence = {
        id: input.occurrenceId,
        aggregateKind: input.aggregateKind,
        aggregateId: input.aggregateId,
        rootCommandId: input.rootCommandId,
        commandFingerprint: input.commandFingerprint,
        state: 'PENDING',
        version: 0,
        expectedAggregateVersion: input.expectedAggregateVersion,
        pendingSnapshot: input.pendingSnapshot,
        completedAt: null,
        createdAt: '2026-08-25T00:00:00.000Z',
        updatedAt: '2026-08-25T00:00:00.000Z'
      }
      state.occurrences.set(String(input.occurrenceId), occurrence)
      return occurrence
    }),
    createCompleted: vi.fn(async (input: Record<string, unknown>) => {
      const occurrence = {
        id: input.occurrenceId,
        aggregateKind: input.aggregateKind,
        aggregateId: input.aggregateId,
        rootCommandId: input.rootCommandId,
        state: 'COMPLETED',
        version: 0,
        expectedAggregateVersion: input.aggregateVersion,
        pendingSnapshot: null,
        completedAt: '2026-08-25T00:00:00.000Z',
        createdAt: '2026-08-25T00:00:00.000Z',
        updatedAt: '2026-08-25T00:00:00.000Z'
      }
      state.occurrences.set(String(input.occurrenceId), occurrence)
      return occurrence
    }),
    advancePending: vi.fn(async (input: Record<string, unknown>) => {
      const occurrence = state.occurrences.get(String(input.occurrenceId))
      if (!occurrence) throw new Error('Missing occurrence.')
      const next = {
        ...occurrence,
        pendingSnapshot: input.pendingSnapshot,
        version: Number(occurrence.version) + 1
      }
      state.occurrences.set(String(input.occurrenceId), next)
      return next
    }),
    complete: vi.fn(async (input: Record<string, unknown>) => {
      const occurrence = state.occurrences.get(String(input.occurrenceId))
      if (!occurrence) throw new Error('Missing occurrence.')
      const next = {
        ...occurrence,
        state: 'COMPLETED',
        pendingSnapshot: null,
        version: Number(occurrence.version) + 1,
        completedAt: '2026-08-25T00:00:00.000Z'
      }
      state.occurrences.set(String(input.occurrenceId), next)
      return next
    }),
    appendReceipt: vi.fn(async (input: Record<string, unknown>) => {
      state.receipts.set(`${input.aggregateId}:${input.commandId}`, input)
    })
  }
  return {
    withTransaction: async (_db: unknown, run: (db: object) => Promise<unknown>) =>
      run(state.transaction),
    createRuleOccurrenceRepository: () => repository,
    createCharacterRepository: () => ({
      patchLiveHitPoints: state.calls.patchHitPoints,
      patchSheetState: state.calls.patchSheetState
    }),
    createReusableDefinitionRepository: () => ({
      requireCurrent: state.calls.requireMaintenanceDefinition
    }),
    createActiveRuleEffectRepository: () => ({
      findMaintainedState: state.calls.findMaintainedState,
      lockMaintainedState: state.calls.lockMaintainedState,
      lockMaintainedStateById: state.calls.lockMaintainedStateById,
      listDependentEffects: state.calls.listDependentEffects,
      lockDependentEffects: state.calls.lockDependentEffects,
      lockByOwner: state.calls.lockActiveEffects,
      createMaintainedState: state.calls.createMaintainedState,
      deleteCas: state.calls.deleteActiveRuleEffect,
      deleteMaintainedStateCas: state.calls.deleteMaintainedState,
      create: async (input: Record<string, unknown>) => {
        state.calls.createActiveRuleEffect(input)
        const definition = input.definition as Record<string, unknown>
        const lifecycle = input.lifecycle as Record<string, unknown>
        return {
          id: input.id,
          owner: input.owner,
          sourceEncounterId: ids.encounter,
          createdOrdinal: 1,
          version: 1,
          definition,
          definitionChecksum: 'e'.repeat(64),
          lifecycle,
          lifecycleChecksum: 'f'.repeat(64),
          maintainedEffectStateId: input.maintainedEffectStateId ?? null,
          createdAt: '2026-08-25T00:00:00.000Z',
          updatedAt: '2026-08-25T00:00:00.000Z'
        }
      }
    }),
    createCharacterMechanicsProjectionRepository: () => ({
      requireCurrent: async ({ characterId }: { characterId: string }) =>
        characterId === ids.thirdCharacter
          ? (state.thirdMechanics ?? state.mechanics)
          : characterId === ids.targetCharacter
            ? (state.targetMechanics ?? state.mechanics)
            : state.mechanics,
      advanceLiveCommandState: state.calls.advanceMechanics
    }),
    createCampaignCharacterMechanicsProjectionRepository: () => ({
      requireCurrent: async ({ characterId }: { characterId: string }) =>
        characterId === ids.thirdCharacter
          ? (state.thirdOverlay ?? state.overlay)
          : characterId === ids.targetCharacter
            ? (state.targetOverlay ?? state.overlay)
            : state.overlay,
      publish: state.calls.publishOverlay
    }),
    createEncounterRepository: () => ({
      requireCurrentProjection: async () => state.currentProjection,
      findEventByCampaignCommand: async (_campaignId: string, commandId: string) =>
        state.encounterEvents.get(commandId) ?? null,
      updateActor: state.calls.updateActor,
      publishCurrentProjection: state.calls.publishEncounter,
      appendEvent: state.calls.appendEncounterEvent
    }),
    createCharacterEventRepository: () => ({
      append: state.calls.appendCharacterEvent
    }),
    createCharacterSheetPlayStateRepository: () => ({
      listResourceUsage: state.calls.listResourceUsage,
      setResourceUsage: state.calls.setResourceUsage
    }),
    createSystemVocabularySnapshotRepository: () => ({
      findById: async (snapshotId: string) =>
        state.vocabularySnapshots.size === 0
          ? state.vocabularySnapshot
          : (state.vocabularySnapshots.get(snapshotId) ?? null)
    })
  }
})

vi.mock('kysely', () => ({
  sql: <T>(strings: TemplateStringsArray, ...values: unknown[]) => ({
    execute: async () => {
      if (strings.join('').includes('campaign_character_assignments')) {
        const characterId = values.find(
          (value): value is string =>
            value === ids.character || value === ids.targetCharacter || value === ids.thirdCharacter
        )
        if (characterId) state.assignmentLocks.push(characterId)
        return {
          rows: [
            {
              user_id: characterId === ids.targetCharacter ? ids.targetUser : ids.user
            }
          ]
        } as T
      }
      return { rows: [{ role: 'PLAYER', status: 'ACTIVE' }] } as T
    }
  })
}))

vi.mock('./encounterRuleExecutionCommandContext.js', () => ({
  lockEncounterRuleExecutionCommandContext: state.calls.context
}))
vi.mock('../character/campaignCharacterSheet.js', () => ({
  checksumCampaignCharacterMechanicalContext: () => 'a'.repeat(64),
  resolveCharacterLiveSessionRuleContext: async () => ({
    adjustments: [],
    attunementSlotOverride: null
  })
}))
vi.mock('../character/characterMechanicsCompiler.js', () => ({
  advanceCharacterMechanicsProjectionCommandState: ({
    current,
    characterStreamVersion
  }: {
    current: Record<string, unknown>
    characterStreamVersion: number
  }) => ({
    ...current,
    characterStreamVersion,
    projectionChecksum: 'c'.repeat(64)
  }),
  advanceCharacterMechanicsProjectionActionState: ({
    current,
    characterStreamVersion,
    rulePolicyInput,
    rulePolicyOutput
  }: {
    current: Record<string, unknown>
    characterStreamVersion: number
    rulePolicyInput: unknown
    rulePolicyOutput: unknown
  }) => ({
    ...current,
    characterStreamVersion,
    rulePolicyInput,
    rulePolicyOutput,
    projectionChecksum: 'c'.repeat(64)
  })
}))
vi.mock('../character/characterActionEvaluation.js', () => ({
  evaluateCharacterActionStateChange: state.calls.actionEvaluation
}))
vi.mock('../campaign/campaignCharacterMechanicsProjection.js', () => ({
  CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION: 1,
  compileCampaignCharacterMechanicsProjection: (input: Record<string, unknown>) => ({
    ...state.overlay,
    ...input,
    projectionChecksum: 'd'.repeat(64)
  })
}))
vi.mock('./encounterActorRuleEvaluation.js', () => ({
  refreshEncounterActorRuleSnapshot: (snapshot: unknown) => snapshot
}))
vi.mock('../rules/actionEconomyCapabilityRegistry.default.js', () => ({
  actionEconomyCapabilityRegistry: {
    resolveActionEconomyCapability: () => ({ kind: 'NONE' as const })
  }
}))
vi.mock('./encounterProjection.js', () => ({
  compileEncounterCurrentProjection: (projection: unknown) => projection,
  projectGm: (encounter: unknown) => encounter
}))
vi.mock('@artificer-toolkit/schema/projections/encounter', () => ({
  encounterProjectionEventSchema: { parse: <T>(value: T) => value }
}))

import { compileEffect } from '@artificer-toolkit/shared/compilers'
import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  ACTIVATION_CODE,
  EFFECT_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TRIGGER
} from '@artificer-toolkit/shared/core'
import { createDnd5eCharacterActionRuntime } from '../rules/systems/dnd5e/characterActionRuntime.js'
import type { CharacterActionCapabilityDescriptor } from '../rules/characterActionCapabilityDiscovery.js'
import type { CharacterRuleActionExecutionPlan } from '../rules/characterRuleActionSystemAdapter.js'
import { compileCharacterActionEntryPoints } from '../rules/characterActionEntryPointCompiler.js'
import { characterRuleActionSystemAdapterRegistry } from '../rules/characterRuleActionSystemAdapterRegistry.js'
import {
  createDnd5eConcentrationCheckDefinition,
  DND5E_CONSTITUTION_ABILITY_DEFINITION_ID,
  DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
} from '../rules/systems/dnd5e/concentrationPolicy.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  type EncounterCharacterRuleActionResult,
  executeEncounterCharacterRuleAction,
  getPendingEncounterConcentrationRuleOccurrence,
  resolveEncounterConcentrationRuleOccurrence,
  resumeEncounterCharacterRuleAction
} from './encounterCharacterRuleActionService.js'
import {
  compileDnd5eEffectAction,
  DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
  DND5E_TARGET_ACTOR_FACT_KEY,
  DND5E_TARGET_STATE_CHECKSUM_FACT_KEY,
  DND5E_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY
} from '../rules/systems/dnd5e/effectActionCompiler.js'

function publishedHeal(conditionId?: string) {
  const action = {
    kind: 'CHARACTER_ACTION',
    gameSystemId: ids.system,
    automationMode: 'AUTOMATIC',
    authoredRootKind: 'effect',
    entryPointDefinitionId: ids.effect,
    effectId: ids.effect,
    actionId: `${ids.effect}:ACTION:${ids.action}`,
    sourceId: ids.effect,
    source: {
      kind: 'AUTHORED',
      sourceKind: 'FEATURE',
      definitionId: ids.effect,
      sourceInstanceId: ids.effect
    },
    mechanicsOwner: { kind: 'FEATURE', id: ids.effect },
    activationSourceKind: 'ACTIVE_SOURCE',
    conditionDefinitionIds: conditionId ? [conditionId] : [],
    compiledEffect: compileEffect({
      id: ids.effect,
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.ACTIVATED,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: { id: 'range-id', rangeKind: RANGE_KIND.SELF },
        targeting: { selectionKind: 'SELF' }
      },
      paths: [
        {
          id: 'path-id',
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          selectionKind: 'FIXED',
          resultBlock: {
            id: 'result-id',
            resultKind: 'SINGLE',
            outcomes: [
              conditionId
                ? {
                    id: 'condition-id',
                    effectKind: EFFECT_KIND.CONDITION,
                    conditionId
                  }
                : {
                    id: 'heal-id',
                    effectKind: EFFECT_KIND.HEAL,
                    valueKind: 'FIXED',
                    scalingKind: 'NONE',
                    amount: 7
                  }
            ]
          }
        }
      ]
    })
  } as never
  return compileDnd5eEffectAction({ action })
}

function publishedDirectOutcome(
  input:
    | { amount: number; damageTypeId: string; kind: 'DAMAGE' }
    | { amount: number; kind: 'TEMPORARY_HIT_POINTS' }
) {
  const action = {
    kind: 'CHARACTER_ACTION',
    gameSystemId: ids.system,
    authoredRootKind: 'effect',
    entryPointDefinitionId: ids.effect,
    effectId: ids.effect,
    actionId: `${ids.effect}:ACTION:${ids.action}`,
    sourceId: ids.effect,
    source: {
      kind: 'AUTHORED',
      sourceKind: 'FEATURE',
      definitionId: ids.effect,
      sourceInstanceId: ids.effect
    },
    mechanicsOwner: { kind: 'FEATURE', id: ids.effect },
    activationSourceKind: 'ACTIVE_SOURCE',
    compiledEffect: compileEffect({
      id: ids.effect,
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.ACTIVATED,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: { id: 'range-id', rangeKind: RANGE_KIND.SELF },
        targeting: { selectionKind: 'SELF' }
      },
      paths: [
        {
          id: 'path-id',
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          selectionKind: 'FIXED',
          resultBlock: {
            id: 'result-id',
            resultKind: 'SINGLE',
            outcomes: [
              input.kind === 'DAMAGE'
                ? {
                    id: 'damage-id',
                    effectKind: EFFECT_KIND.DAMAGE,
                    damageTypeId: input.damageTypeId,
                    valueKind: 'FIXED',
                    scalingKind: 'NONE',
                    amount: input.amount
                  }
                : {
                    id: 'temporary-id',
                    effectKind: EFFECT_KIND.HEAL,
                    temporary: true,
                    valueKind: 'FIXED',
                    scalingKind: 'NONE',
                    amount: input.amount
                  }
            ]
          }
        }
      ]
    })
  } as never
  return compileDnd5eEffectAction({ action })
}

function publishedAttack(includeCriticalPath = false, criticalConditionId?: string) {
  const action = {
    kind: 'CHARACTER_ACTION',
    gameSystemId: ids.system,
    authoredRootKind: 'effect',
    entryPointDefinitionId: ids.effect,
    effectId: ids.effect,
    actionId: `${ids.effect}:ACTION:${ids.action}`,
    sourceId: ids.effect,
    source: {
      kind: 'AUTHORED',
      sourceKind: 'FEATURE',
      definitionId: ids.effect,
      sourceInstanceId: ids.effect
    },
    mechanicsOwner: { kind: 'FEATURE', id: ids.effect },
    activationSourceKind: 'ACTIVE_SOURCE',
    conditionDefinitionIds: criticalConditionId ? [criticalConditionId] : [],
    compiledEffect: compileEffect({
      id: ids.effect,
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: { id: 'range-id', rangeKind: RANGE_KIND.UNLIMITED },
        targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
      },
      paths: [
        {
          id: 'path-id',
          order: 1,
          pathCode: PATH_CODE.ON_HIT,
          groupType: PATH_GROUP_TYPE.SINGLE,
          selectionKind: 'FIXED',
          resultBlock: {
            id: 'result-id',
            resultKind: 'SINGLE',
            outcomes: [
              {
                id: 'damage-id',
                effectKind: EFFECT_KIND.DAMAGE,
                damageTypeId: ids.effect,
                valueKind: 'FIXED',
                scalingKind: 'NONE',
                amount: 4
              }
            ]
          }
        },
        ...(includeCriticalPath
          ? [
              {
                id: 'critical-path-id',
                order: 2,
                pathCode: PATH_CODE.ON_CRIT,
                groupType: PATH_GROUP_TYPE.SINGLE,
                selectionKind: 'FIXED' as const,
                resultBlock: {
                  id: 'critical-result-id',
                  resultKind: 'SINGLE' as const,
                  outcomes: [
                    criticalConditionId
                      ? {
                          id: 'critical-condition-id',
                          effectKind: EFFECT_KIND.CONDITION,
                          conditionId: criticalConditionId
                        }
                      : {
                          id: 'critical-damage-id',
                          effectKind: EFFECT_KIND.DAMAGE,
                          damageTypeId: ids.effect,
                          valueKind: 'FIXED' as const,
                          scalingKind: 'NONE' as const,
                          amount: 2
                        }
                  ]
                }
              }
            ]
          : [])
      ]
    })
  } as never
  return compileDnd5eEffectAction({ action })
}

function publishedSave(conditionId?: string) {
  const action = {
    kind: 'CHARACTER_ACTION',
    gameSystemId: ids.system,
    authoredRootKind: 'effect',
    entryPointDefinitionId: ids.effect,
    effectId: ids.effect,
    actionId: `${ids.effect}:ACTION:${ids.action}`,
    sourceId: ids.effect,
    source: {
      kind: 'AUTHORED',
      sourceKind: 'FEATURE',
      definitionId: ids.effect,
      sourceInstanceId: ids.effect
    },
    mechanicsOwner: { kind: 'FEATURE', id: ids.effect },
    activationSourceKind: 'ACTIVE_SOURCE',
    conditionDefinitionIds: conditionId ? [conditionId] : [],
    compiledEffect: compileEffect({
      id: ids.effect,
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.SAVING_THROW,
        savingThrow: {
          id: 'save-id',
          abilityDefinitionId: '00000000-0000-0000-0011-000200000000',
          dcMethod: 'FIXED_DC',
          baseDc: 15
        },
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: { id: 'range-id', rangeKind: RANGE_KIND.UNLIMITED },
        targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
      },
      paths: [
        {
          id: 'path-id',
          order: 1,
          pathCode: PATH_CODE.ON_SAVE_FAIL,
          groupType: PATH_GROUP_TYPE.SINGLE,
          selectionKind: 'FIXED',
          resultBlock: {
            id: 'result-id',
            resultKind: 'SINGLE',
            outcomes: [
              conditionId
                ? {
                    id: 'condition-id',
                    effectKind: EFFECT_KIND.CONDITION,
                    conditionId
                  }
                : {
                    id: 'damage-id',
                    effectKind: EFFECT_KIND.DAMAGE,
                    damageTypeId: ids.effect,
                    valueKind: 'FIXED',
                    scalingKind: 'NONE',
                    amount: 4
                  }
            ]
          }
        }
      ]
    })
  } as never
  return compileDnd5eEffectAction({ action })
}

function reset({
  current = 4,
  maximum = 10,
  entry = true,
  persistedVersion = 4
}: {
  current?: number
  maximum?: number
  entry?: boolean
  persistedVersion?: number
} = {}) {
  state.receipts.clear()
  state.encounterEvents.clear()
  state.characterEvents.length = 0
  state.occurrences.clear()
  state.maintainedStates.clear()
  state.maintainedDependents.length = 0
  state.mechanicsCasKeys.clear()
  state.overlayCasKeys.clear()
  state.assignmentLocks.length = 0
  state.characterVersions.clear()
  Object.values(state.calls).forEach((mock) => mock.mockClear())
  state.calls.lockActiveEffects.mockResolvedValue([])
  state.calls.listResourceUsage.mockResolvedValue([])
  state.calls.requireMaintenanceDefinition.mockResolvedValue({
    gameSystemId: ids.system,
    checksum: 'a'.repeat(64)
  })
  const maintainedKey = (input: Record<string, unknown>) =>
    `${input.encounterId}:${input.ownerActorId}:${input.maintenanceDefinitionId}`
  state.calls.findMaintainedState.mockImplementation(
    async (input: Record<string, unknown>) =>
      state.maintainedStates.get(maintainedKey(input)) ?? null
  )
  state.calls.lockMaintainedState.mockImplementation(
    async (input: Record<string, unknown>) =>
      state.maintainedStates.get(maintainedKey(input)) ?? null
  )
  state.calls.lockMaintainedStateById.mockImplementation(
    async (input: Record<string, unknown>) =>
      [...state.maintainedStates.values()].find(
        (candidate) => candidate.id === input.stateId && candidate.encounterId === input.encounterId
      ) ?? null
  )
  state.calls.listDependentEffects.mockImplementation(async (input: Record<string, unknown>) =>
    state.maintainedDependents.filter((effect) => effect.maintainedEffectStateId === input.stateId)
  )
  state.calls.lockDependentEffects.mockImplementation(async (input: Record<string, unknown>) =>
    state.maintainedDependents.filter((effect) => effect.maintainedEffectStateId === input.stateId)
  )
  state.calls.deleteActiveRuleEffect.mockImplementation(async (input: Record<string, unknown>) => {
    const index = state.maintainedDependents.findIndex((effect) => effect.id === input.id)
    if (index < 0 || state.maintainedDependents[index]!.version !== input.expectedVersion)
      throw new Error('stale active effect')
    state.maintainedDependents.splice(index, 1)
  })
  state.calls.deleteMaintainedState.mockImplementation(async (input: Record<string, unknown>) => {
    const current = [...state.maintainedStates.values()].find(
      (candidate) =>
        candidate.id === input.id &&
        candidate.encounterId === input.encounterId &&
        candidate.ownerActorId === input.ownerActorId
    )
    if (!current || current.id !== input.id || current.version !== input.expectedVersion)
      throw new Error('stale maintained state')
    state.maintainedStates.delete(maintainedKey(current))
  })
  state.calls.createMaintainedState.mockImplementation(async (input: Record<string, unknown>) => {
    const descriptor = input.descriptor as Record<string, unknown>
    const created = {
      id: state.maintainedStates.size === 0 ? ids.replacementState : input.id,
      version: 1,
      encounterId: input.encounterId,
      ownerActorId: input.ownerActorId,
      maintenanceDefinitionId: descriptor.maintenanceDefinitionId,
      descriptor,
      descriptorChecksum: 'b'.repeat(64)
    }
    state.maintainedStates.set(maintainedKey(created), created)
    return created
  })
  state.calls.actionEvaluation.mockImplementation(async ({ committed }) => ({
    ruleEvaluation: committed,
    zenEvaluationMs: 0
  }))
  state.calls.advanceMechanics.mockImplementation(async (value: unknown) => {
    const input = value as {
      expectedPriorProjectionChecksum: string
      expectedPriorStreamVersion: number
      projection: typeof state.mechanics & {
        rulePolicyOutput?: { resources?: unknown[] }
      }
    }
    const key = `${input.expectedPriorProjectionChecksum}:${input.expectedPriorStreamVersion}:${JSON.stringify(
      input.projection.rulePolicyOutput?.resources ?? []
    )}`
    if (state.mechanicsCasKeys.has(key)) throw new Error('duplicate mechanics CAS')
    state.mechanicsCasKeys.add(key)
    if (input.expectedPriorProjectionChecksum === state.mechanics.projectionChecksum)
      state.mechanics = input.projection
    else state.targetMechanics = input.projection
  })
  state.calls.publishOverlay.mockImplementation(async (value: unknown) => {
    const input = value as {
      expectedPriorOverlayChecksum: string
      projection: typeof state.overlay & {
        rulePolicyOutput?: { resources?: unknown[] }
      }
    }
    const key = `${input.expectedPriorOverlayChecksum}:${JSON.stringify(
      input.projection.rulePolicyOutput?.resources ?? []
    )}`
    if (state.overlayCasKeys.has(key)) throw new Error('duplicate overlay CAS')
    state.overlayCasKeys.add(key)
    if (input.expectedPriorOverlayChecksum === state.overlay.projectionChecksum)
      state.overlay = input.projection
    else state.targetOverlay = input.projection
  })
  state.vocabularySnapshot = {
    snapshotId: ids.effect,
    systemId: ids.system,
    snapshotVersion: 1,
    checksum: 'c'.repeat(64),
    document: {
      abilities: [{ id: DND5E_CONSTITUTION_ABILITY_DEFINITION_ID, code: 'CONSTITUTION' }]
    }
  }
  state.vocabularySnapshots.clear()
  state.targetMechanics = null
  state.targetOverlay = null
  state.thirdMechanics = null
  state.thirdOverlay = null
  const published = publishedHeal()
  const actionId = `${ids.effect}:ACTION:${ids.action}`
  const source = {
    kind: 'AUTHORED',
    sourceKind: 'FEATURE',
    definitionId: ids.effect,
    sourceInstanceId: ids.effect
  }
  const candidate = {
    sequence: 0,
    actionId,
    effectId: ids.effect,
    sourceId: ids.effect,
    source,
    mechanicsOwner: { kind: 'FEATURE', id: ids.effect },
    activationSourceKind: 'ACTIVE_SOURCE',
    equipment: null,
    resourceUse: null,
    mechanicFacts: {}
  }
  const decision = {
    sequence: 0,
    actionId,
    effectId: ids.effect,
    sourceId: ids.effect,
    source,
    mechanicsOwner: { kind: 'FEATURE', id: ids.effect },
    status: 'AVAILABLE',
    reasonCode: null,
    resourcePoolId: null,
    resourceCost: null,
    mechanic: {}
  }
  state.mechanics = {
    characterStreamVersion: 3,
    projectionChecksum: 'b'.repeat(64),
    systemVocabularySnapshotId: ids.effect,
    systemVocabularySnapshotVersion: 1,
    systemVocabularySnapshotChecksum: 'c'.repeat(64),
    commandState: {
      systemId: ids.system,
      state: { hitpoints: { current, temp: 2 } }
    },
    compiledActionEntryPoints: entry
      ? [
          {
            schemaVersion: 1,
            kind: 'CHARACTER_ACTION',
            actionId,
            effectId: ids.effect,
            targetPolicy: {
              range: { id: 'range-id', rangeKind: RANGE_KIND.SELF },
              targeting: { selectionKind: 'SELF' },
              shape: null,
              pathOverrides: []
            },
            compilation: { kind: 'COMPILED', published }
          }
        ]
      : [],
    rulePolicyInput: {
      abilityDefinitions: [{ id: DND5E_CONSTITUTION_ABILITY_DEFINITION_ID, code: 'CONSTITUTION' }],
      actionCandidates: [candidate]
    },
    rulePolicyOutput: { actionDecisions: [decision], resources: [] }
  }
  state.overlay = {
    kind: 'MATERIALIZED',
    campaignId: ids.campaign,
    projectionChecksum: 'e'.repeat(64),
    mechanicalContextChecksum: 'a'.repeat(64),
    manualMaximumModifierOwner: null,
    rulePolicyInput: {
      ...state.mechanics.rulePolicyInput,
      actionCandidates: [candidate]
    },
    rulePolicyOutput: {
      derivedStats: {
        abilities: [
          {
            abilityId: 'CONSTITUTION',
            score: { effective: 10 }
          }
        ],
        maxHitPoints: { effective: maximum }
      },
      defenses: [],
      actionDecisions: [decision],
      resources: [],
      savingThrowDefinitions: [
        {
          abilityDefinitionId: DND5E_CONSTITUTION_ABILITY_DEFINITION_ID,
          modifier: 3,
          rollMode: 'NORMAL',
          contributors: []
        }
      ]
    }
  }
  const actor = {
    id: ids.actor,
    kind: 'CHARACTER',
    sourceId: ids.character,
    sourceRevision: 3,
    systemId: ids.system,
    currentHitPoints: current,
    tempHitPoints: 2,
    maxHitPoints: maximum,
    conditions: []
  }
  state.encounter = {
    id: ids.encounter,
    campaignId: ids.campaign,
    sessionId: 'session',
    version: 5,
    gameSystemId: ids.system,
    automationMode: 'AUTOMATIC',
    status: 'ACTIVE',
    currentActorId: ids.actor,
    actors: [actor]
  }
  state.characterVersions.set(ids.character, state.mechanics.characterStreamVersion)
  state.currentProjection = { ruleSnapshot: { output: {} } }
  state.calls.context.mockImplementation(async () => {
    state.calls.lock()
    return {
      encounter: state.encounter,
      context: {
        encounterId: ids.encounter,
        campaignId: ids.campaign,
        actorUserId: ids.user,
        assignedCharacterId: ids.character,
        role: 'PLAYER',
        currentVersion: state.encounter.version,
        attunementSlotOverride: null,
        advanceVersion: async (expected: number) => {
          if (expected !== state.encounter.version) throw new Error('version mismatch')
          state.encounter.version += 1
          return state.encounter.version
        },
        createReceiptOnlyChildOccurrencePort: () => ({
          withLockedAuthorized: async (
            _db: unknown,
            run: (aggregate: Record<string, unknown>) => Promise<unknown>
          ) =>
            run({
              aggregateKind: 'ENCOUNTER',
              aggregateId: ids.encounter,
              campaignId: ids.campaign,
              actorUserId: ids.user,
              currentVersion: state.encounter.version,
              advanceVersion: async () => {
                throw new Error('child occurrence cannot advance the Encounter')
              }
            })
        })
      }
    }
  })
  state.transaction = {
    selectFrom(table: string) {
      let whereValue: unknown
      const chain = {
        select: () => chain,
        where: (_column: string, _operator: string, value: unknown) => {
          whereValue = value
          return chain
        },
        forUpdate: () => chain,
        executeTakeFirst: async () =>
          table === 'characters'
            ? whereValue === ids.targetCharacter || whereValue === ids.thirdCharacter
              ? {
                  id: whereValue,
                  system_id: ids.system,
                  stream_version: state.characterVersions.get(String(whereValue)) ?? 3,
                  status: 'ACTIVE'
                }
              : {
                  id: ids.character,
                  system_id: ids.system,
                  stream_version:
                    state.characterVersions.get(ids.character) ??
                    state.mechanics.characterStreamVersion,
                  status: 'ACTIVE'
                }
            : table === 'character_hitpoint_state'
              ? whereValue === ids.thirdCharacter
                ? {
                    current: state.thirdMechanics?.commandState.state.hitpoints.current,
                    temp: state.thirdMechanics?.commandState.state.hitpoints.temp
                  }
                : whereValue === ids.targetCharacter
                  ? {
                      current: state.targetMechanics?.commandState.state.hitpoints.current,
                      temp: state.targetMechanics?.commandState.state.hitpoints.temp
                    }
                  : {
                      current: state.mechanics.commandState.state.hitpoints.current,
                      temp: state.mechanics.commandState.state.hitpoints.temp
                    }
              : undefined
      }
      return chain
    }
  }
  state.calls.patchHitPoints.mockImplementation(
    async (
      id: string,
      input: {
        afterPersist: (db: object, version: number) => Promise<void>
        next: { current: number; temp: number }
      }
    ) => {
      const nextVersion =
        persistedVersion < 0 ? persistedVersion : (state.characterVersions.get(id) ?? 3) + 1
      await input.afterPersist(state.transaction, nextVersion)
      if (persistedVersion >= 0) state.characterVersions.set(id, nextVersion)
      if (id === ids.targetCharacter && state.targetMechanics) {
        state.targetMechanics.commandState.state.hitpoints = input.next
      }
      return nextVersion
    }
  )
  state.calls.patchSheetState.mockImplementation(
    async (
      id: string,
      patches: Array<{ kind: string; value: unknown }>,
      input: { afterPersist: (db: object, version: number) => Promise<void> }
    ) => {
      const nextVersion =
        persistedVersion < 0 ? persistedVersion : (state.characterVersions.get(id) ?? 3) + 1
      await input.afterPersist(state.transaction, nextVersion)
      if (persistedVersion >= 0) state.characterVersions.set(id, nextVersion)
      const mechanics =
        id === ids.thirdCharacter
          ? state.thirdMechanics
          : id === ids.targetCharacter
            ? state.targetMechanics
            : state.mechanics
      if (mechanics) {
        for (const patch of patches) {
          if (patch.kind === 'HITPOINTS')
            mechanics.commandState.state.hitpoints = patch.value as {
              current: number
              temp: number
            }
          if (patch.kind === 'CONDITIONS')
            mechanics.commandState.state.conditions = patch.value as Array<{
              conditionTypeId: string
            }>
        }
      }
      return nextVersion
    }
  )
  state.calls.updateActor.mockImplementation(async (value: unknown) => {
    const nextActor = value as Record<string, unknown>
    state.encounter.actors = state.encounter.actors.map((actor) =>
      actor.id === nextActor.id ? nextActor : actor
    )
  })
  state.calls.runtime.mockImplementation(
    async ({
      published: actual,
      command
    }: {
      published: unknown
      command: { facts: Record<string, unknown> }
    }) => ({
      status: 'COMPLETE',
      outputs: {
        targetActorId: command.facts[DND5E_TARGET_ACTOR_FACT_KEY],
        amount: 7,
        applicationCandidate: true,
        authorized: true,
        targetStateChecksum: command.facts[DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]
      },
      evidence: {
        source: {
          definitionId: (actual as { id: string }).id,
          gameSystemId: ids.system,
          definitionFamilyKey: 'effect-action',
          checksum: (actual as { checksum: string }).checksum
        },
        capabilityContractVersion: 1,
        facts: command.facts,
        sourceEntryBindings: (
          actual as {
            definition: {
              sourceEntryBindings?: Array<{
                sourceEntryId: string
                nodeId: string
              }>
            }
          }
        ).definition.sourceEntryBindings,
        trace: [
          {
            nodeId: 'heal',
            operation: { key: 'dnd5e.heal-proposal', contractVersion: 1 },
            inputs: {},
            outputs: {
              targetActorId: command.facts[DND5E_TARGET_ACTOR_FACT_KEY],
              amount: 7,
              applicationCandidate: true,
              authorized: true,
              targetStateChecksum: command.facts[DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]
            }
          }
        ],
        outputs: {
          targetActorId: command.facts[DND5E_TARGET_ACTOR_FACT_KEY],
          amount: 7
        }
      }
    })
  )
  return { actionId, published }
}

function perceptionContributions() {
  const document = {
    schemaVersion: 1 as const,
    kind: 'SENSE' as const,
    id: '00000000-0000-4000-8000-000000000041',
    gameSystemId: ids.system,
    capabilities: [
      {
        channel: 'VISUAL' as const,
        accessGrade: 'PRECISE' as const,
        satisfies: ['SEE' as const],
        illuminationAccess: 'ORDINARY_DARKNESS' as const,
        obscurementAccess: 'NONE' as const,
        perceivesInvisible: false,
        physicalConstraints: []
      }
    ]
  }
  return [
    {
      id: '00000000-0000-4000-8000-000000000040',
      order: 0,
      kind: 'SENSE_GRANT',
      senseDefinitionId: '00000000-0000-4000-8000-000000000041',
      definitionVersion: 1,
      definitionContractVersion: 1,
      definitionChecksum: checksumRuleDocument(document),
      document,
      range: { amount: 60, unit: 'FEET' }
    }
  ]
}

function configureRecurringActiveEffect(
  actionId: string,
  contributions: ReturnType<typeof perceptionContributions> = []
) {
  const entry = state.mechanics.compiledActionEntryPoints[0] as {
    effectId: string
    kind: 'CHARACTER_ACTION'
    targetPolicy: unknown
    compilation: { published: unknown }
  }
  const published = entry.compilation.published as {
    checksum: string
    definition: Record<string, unknown>
  }
  const definition = {
    ...published.definition,
    sourceEntryBindings: [
      {
        sourceEntryId: '00000000-0000-4000-8000-000000000010',
        nodeId: 'heal'
      }
    ]
  }
  published.definition = definition
  published.checksum = checksumRuleDocument(definition)
  state.mechanics = {
    ...state.mechanics,
    compiledActionEntryPoints: [
      {
        schemaVersion: 2,
        kind: entry.kind,
        actionId,
        effectId: entry.effectId,
        targetPolicy: entry.targetPolicy,
        compilation: {
          kind: 'COMPILED',
          published: entry.compilation.published,
          resourceBinding: null,
          activeEffectPlan: {
            authoredEffectId: ids.effect,
            compiledEntryId: '00000000-0000-4000-8000-000000000010',
            frozenGraphNodeId: 'heal',
            capabilityContractVersion: 1,
            recurrenceStage: 'START_OF_TURN',
            initialRemaining: 2,
            frozenGraph: entry.compilation.published,
            adapterFacts: {},
            perceptionContributions: contributions
          }
        }
      }
    ]
  }
}

function configureMaintainedRecurringActiveEffect(
  actionId: string,
  definitionId = ids.maintenanceDefinition
) {
  configureRecurringActiveEffect(actionId)
  const entry = state.mechanics.compiledActionEntryPoints[0] as {
    schemaVersion: 2
    compilation: { activeEffectPlan: Record<string, unknown> }
  }
  entry.compilation.activeEffectPlan.maintenance = {
    definitionId,
    definitionChecksum: 'a'.repeat(64),
    replacementPolicy: 'REPLACE_SAME_DEFINITION',
    emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY'
  }
}

function seedMaintainedReplacement(
  definitionId = ids.maintenanceDefinition,
  dependents: Array<Record<string, unknown>> = []
) {
  const stateRecord = {
    id: ids.maintainedState,
    version: 2,
    encounterId: ids.encounter,
    ownerActorId: ids.actor,
    maintenanceDefinitionId: definitionId,
    descriptor: {
      schemaVersion: 1,
      maintenanceDefinitionId: definitionId,
      definitionChecksum: 'a'.repeat(64),
      sourceActionId: 'prior-action',
      sourceOccurrenceId: '00000000-0000-4000-8000-000000000037',
      sourceActorId: ids.actor,
      replacementPolicy: 'REPLACE_SAME_DEFINITION',
      emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY'
    },
    descriptorChecksum: 'b'.repeat(64)
  }
  state.maintainedStates.set(`${ids.encounter}:${ids.actor}:${definitionId}`, stateRecord)
  state.maintainedDependents.push(
    ...dependents.map((effect) => ({
      maintainedEffectStateId: ids.maintainedState,
      createdOrdinal: 1,
      version: 1,
      definitionChecksum: 'a'.repeat(64),
      lifecycleChecksum: 'b'.repeat(64),
      ...effect
    }))
  )
}

function maintainedCharacterDependent(id: string, characterId: string, createdOrdinal = 1) {
  return {
    id,
    owner: { kind: 'CHARACTER', characterId },
    createdOrdinal
  }
}

function maintainedActorDependent(id: string, targetActorId: string) {
  return {
    id,
    owner: {
      kind: 'ENCOUNTER_ACTOR',
      encounterId: ids.encounter,
      targetActorId
    }
  }
}

function command(actionId: string, overrides: Record<string, unknown> = {}) {
  return {
    actionId,
    actorId: ids.actor,
    actorUserId: ids.user,
    commandId: ids.command,
    correlationId: null,
    encounterId: ids.encounter,
    expectedEncounterVersion: 5,
    targetActorId: ids.actor,
    ...overrides
  }
}

function configureUnlimitedSingleCharacterTarget() {
  const entry = state.mechanics.compiledActionEntryPoints[0] as Record<string, unknown>
  if (!entry) throw new Error('Expected a compiled Character action entry.')
  entry.targetPolicy = {
    range: { id: 'target-range-id', rangeKind: 'UNLIMITED' },
    targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' },
    shape: null,
    pathOverrides: []
  }
  state.targetMechanics = {
    ...state.mechanics,
    characterStreamVersion: 3,
    projectionChecksum: 'f'.repeat(64),
    commandState: {
      ...state.mechanics.commandState,
      state: { hitpoints: { current: 3, temp: 1 } }
    }
  }
  state.targetOverlay = {
    ...state.overlay,
    projectionChecksum: 'g'.repeat(64),
    rulePolicyOutput: {
      ...state.overlay.rulePolicyOutput,
      derivedStats: {
        ...state.overlay.rulePolicyOutput.derivedStats,
        maxHitPoints: { effective: 12 }
      }
    }
  }
  state.encounter.actors.push({
    id: ids.targetActor,
    kind: 'CHARACTER',
    sourceId: ids.targetCharacter,
    sourceRevision: 3,
    systemId: ids.system,
    currentHitPoints: 3,
    tempHitPoints: 1,
    maxHitPoints: 12,
    conditions: []
  })
}

function configureRuntimeOutcome(
  input:
    | { amount: number; damageTypeId: string; kind: 'DAMAGE' }
    | { amount: number; kind: 'TEMPORARY_HIT_POINTS' }
) {
  const entry = state.mechanics.compiledActionEntryPoints[0] as {
    compilation: { published: unknown }
  }
  entry.compilation.published = publishedDirectOutcome(input)
  const operation =
    input.kind === 'DAMAGE'
      ? DND5E_DAMAGE_PROPOSAL_OPERATION_KEY
      : DND5E_TEMPORARY_HIT_POINTS_PROPOSAL_OPERATION_KEY
  state.calls.runtime.mockImplementation(
    async ({
      command: runtimeCommand,
      published
    }: {
      command: { facts: Record<string, unknown> }
      published: { checksum: string; id: string }
    }) => {
      const outputs = {
        targetActorId: runtimeCommand.facts[DND5E_TARGET_ACTOR_FACT_KEY],
        amount: input.amount,
        applicationCandidate: true,
        authorized: true,
        targetStateChecksum: runtimeCommand.facts[DND5E_TARGET_STATE_CHECKSUM_FACT_KEY],
        ...(input.kind === 'DAMAGE' ? { damageTypeId: input.damageTypeId } : {})
      }
      return {
        status: 'COMPLETE',
        outputs,
        evidence: {
          source: {
            definitionId: published.id,
            gameSystemId: ids.system,
            definitionFamilyKey: 'effect-action',
            checksum: published.checksum
          },
          capabilityContractVersion: 1,
          facts: runtimeCommand.facts,
          trace: [
            {
              nodeId: input.kind.toLowerCase(),
              operation: { key: operation, contractVersion: 1 },
              inputs: {},
              outputs
            }
          ],
          outputs
        }
      }
    }
  )
}

function configureCriticalAttackConcentration(dependents: Array<Record<string, unknown>> = []) {
  const published = publishedAttack(true)
  const entry = state.mechanics.compiledActionEntryPoints[0] as {
    compilation: { published: unknown }
  }
  entry.compilation.published = published
  const decisions = state.overlay.rulePolicyOutput.actionDecisions as Array<Record<string, unknown>>
  decisions[0] = {
    ...decisions[0],
    mechanic: { attackBonus: 5, attackRollMode: 'NORMAL', save: null }
  }
  ;(
    state.mechanics.rulePolicyOutput as {
      actionDecisions: Array<Record<string, unknown>>
    }
  ).actionDecisions[0] = decisions[0]!
  ;(state.overlay.rulePolicyOutput.derivedStats as Record<string, unknown>).armorClass = {
    effective: 10
  }
  ;(state.overlay.rulePolicyOutput as Record<string, unknown>).savingThrowDefinitions = [
    {
      abilityDefinitionId: DND5E_CONSTITUTION_ABILITY_DEFINITION_ID,
      modifier: 3,
      rollMode: 'NORMAL',
      contributors: []
    }
  ]
  seedMaintainedReplacement(DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID, dependents)
  const concentration = createDnd5eConcentrationCheckDefinition()
  state.calls.requireMaintenanceDefinition.mockResolvedValue({
    id: concentration.id,
    gameSystemId: concentration.gameSystemId,
    definitionFamilyKey: concentration.definitionFamilyKey,
    checksum: concentration.checksum,
    document: concentration.definition
  })
  return createDnd5eCharacterActionRuntime({
    continuationIntegrityKey: new Uint8Array(32).fill(11),
    definitions: {
      requireCurrent: async (definitionId: string) =>
        definitionId === concentration.id ? concentration : published
    }
  })
}

function moveConcentrationStateToTargetActor() {
  const stateRecord = state.maintainedStates.get(
    `${ids.encounter}:${ids.actor}:${DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID}`
  )
  if (!stateRecord) throw new Error('Expected a seeded concentration state.')
  state.maintainedStates.delete(
    `${ids.encounter}:${ids.actor}:${DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID}`
  )
  state.maintainedStates.set(
    `${ids.encounter}:${ids.targetActor}:${DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID}`,
    { ...stateRecord, ownerActorId: ids.targetActor }
  )
}

function useEncounterControllerContext(input: {
  actorUserId: string
  assignedCharacterId: string | null
  role?: 'OWNER' | 'PLAYER'
}) {
  state.calls.context.mockImplementationOnce(async () => ({
    encounter: state.encounter,
    context: {
      encounterId: ids.encounter,
      campaignId: ids.campaign,
      actorUserId: input.actorUserId,
      assignedCharacterId: input.assignedCharacterId,
      role: input.role ?? 'PLAYER',
      currentVersion: state.encounter.version,
      attunementSlotOverride: null,
      advanceVersion: async () => state.encounter.version,
      createReceiptOnlyChildOccurrencePort: () => ({
        withLockedAuthorized: async (
          _db: unknown,
          run: (aggregate: Record<string, unknown>) => Promise<unknown>
        ) =>
          run({
            aggregateKind: 'ENCOUNTER',
            aggregateId: ids.encounter,
            campaignId: ids.campaign,
            actorUserId: input.actorUserId,
            currentVersion: state.encounter.version,
            advanceVersion: async () => {
              throw new Error('A concentration child cannot advance the Encounter.')
            }
          })
      })
    }
  }))
}

function concentrationReceiptInputs() {
  return [...state.receipts.values()]
    .filter((receipt) => {
      const payload = receipt.resultPayload as Record<string, unknown> | undefined
      return (
        (payload?.applicationOutputs as Record<string, unknown> | undefined)?.kind ===
        'CONCENTRATION_CHECK'
      )
    })
    .sort((left, right) => {
      const leftPayload = left.resultPayload as Record<string, unknown>
      const rightPayload = right.resultPayload as Record<string, unknown>
      const leftApplication = leftPayload.applicationOutputs as {
        application: { ordinal: number }
      }
      const rightApplication = rightPayload.applicationOutputs as {
        application: { ordinal: number }
      }
      return leftApplication.application.ordinal - rightApplication.application.ordinal
    })
}

async function createAssistedConcentrationPending(
  input: {
    rollMode?: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE'
  } = {}
) {
  const { actionId } = reset({ current: 10 })
  state.encounter = { ...state.encounter, automationMode: 'ASSISTED' }
  const runtime = configureCriticalAttackConcentration()
  const savingThrows = state.overlay.rulePolicyOutput.savingThrowDefinitions as Array<
    Record<string, unknown>
  >
  savingThrows[0] = {
    ...savingThrows[0],
    rollMode: input.rollMode ?? 'NORMAL'
  }
  const actionPending = await executeEncounterCharacterRuleAction({
    db: {} as never,
    runtime,
    command: command(actionId)
  })
  if (actionPending.status !== 'PENDING') throw new Error('Expected an Assisted action pause.')
  const parentResult = await resumeEncounterCharacterRuleAction({
    db: {} as never,
    runtime,
    command: {
      actorUserId: ids.user,
      commandId: '00000000-0000-4000-8000-000000000093',
      correlationId: null,
      encounterId: ids.encounter,
      expectedEncounterVersion: 5,
      expectedOccurrenceVersion: actionPending.occurrenceVersion,
      occurrenceId: actionPending.occurrenceId,
      resolution: {
        kind: 'PHYSICAL',
        requestId: assistedD20Request(actionPending).requestId,
        rawFaces: [20]
      }
    }
  })
  const occurrence = [...state.occurrences.values()].find(
    (candidate) =>
      candidate.state === 'PENDING' &&
      (candidate.pendingSnapshot as { applicationContext?: { kind?: string } }).applicationContext
        ?.kind === 'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK'
  )
  if (!occurrence) throw new Error('Expected a concentration occurrence.')
  const request = (occurrence.pendingSnapshot as { request: { requestId: string } }).request
  return { occurrence, parentResult, requestId: request.requestId, runtime }
}

function configureResourceBoundAction() {
  const poolId =
    'ITEM_INSTANCE:00000000-0000-4000-8000-000000000022:00000000-0000-4000-8000-000000000021'
  const chargeId = '00000000-0000-4000-8000-000000000021'
  const priorCandidate = (
    state.mechanics.rulePolicyInput as {
      actionCandidates: Array<Record<string, unknown>>
    }
  ).actionCandidates[0]
  const priorDecision = (
    state.mechanics.rulePolicyOutput as {
      actionDecisions: Array<Record<string, unknown>>
    }
  ).actionDecisions[0]
  if (!priorCandidate || !priorDecision)
    throw new Error('Expected an aligned action candidate and decision.')
  const candidate = {
    ...priorCandidate,
    resourceUse: { poolId, chargeId, cost: 1 }
  }
  const decision = {
    ...priorDecision,
    resourcePoolId: poolId,
    resourceCost: 1
  }
  const resource = {
    ownerKind: 'ITEM_INSTANCE',
    poolId,
    chargeId,
    state: 'RESOLVED',
    rawUsed: 2,
    remaining: 3,
    itemInstanceId: '00000000-0000-4000-8000-000000000022'
  }
  const priorEntry = state.mechanics.compiledActionEntryPoints[0] as {
    actionId: string
    effectId: string
    kind: 'CHARACTER_ACTION'
    targetPolicy: unknown
  }
  if (!priorEntry) throw new Error('Expected a compiled action entry.')
  state.mechanics = {
    ...state.mechanics,
    compiledActionEntryPoints: [
      {
        actionId: priorEntry.actionId,
        effectId: priorEntry.effectId,
        kind: priorEntry.kind,
        targetPolicy: priorEntry.targetPolicy,
        schemaVersion: 2,
        compilation: {
          kind: 'COMPILED',
          published: publishedHeal(),
          resourceBinding: { poolId, chargeId, cost: 1 }
        }
      }
    ],
    rulePolicyInput: {
      ...state.mechanics.rulePolicyInput,
      actionCandidates: [candidate]
    },
    rulePolicyOutput: { actionDecisions: [decision], resources: [resource] }
  }
  state.overlay = {
    ...state.overlay,
    rulePolicyInput: { actionCandidates: [candidate] },
    rulePolicyOutput: {
      ...state.overlay.rulePolicyOutput,
      actionDecisions: [decision],
      resources: [resource]
    }
  }
  state.calls.listResourceUsage.mockResolvedValue([
    {
      id: '00000000-0000-4000-8000-000000000023',
      characterId: ids.character,
      owner: {
        kind: 'ITEM_INSTANCE',
        itemInstanceId: '00000000-0000-4000-8000-000000000022',
        chargeId
      },
      used: 2,
      createdBy: ids.user,
      updatedBy: ids.user,
      createdAt: '2026-08-25T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z'
    }
  ])
  state.calls.actionEvaluation.mockImplementation(async ({ committed }) => ({
    ruleEvaluation: {
      ...committed,
      output: {
        ...committed.output,
        actionDecisions: [
          {
            ...decision,
            status: 'UNAVAILABLE',
            reasonCode: 'INSUFFICIENT_RESOURCE'
          }
        ],
        resources: [{ ...resource, rawUsed: 3, effectiveUsed: 3, remaining: 2 }]
      }
    },
    zenEvaluationMs: 0
  }))
  return { chargeId, poolId }
}

function configureV4TestOutcomeAction(input: {
  readonly kind: 'ATTACK' | 'SAVE'
  readonly conditionId?: string
  readonly critical?: boolean
  readonly diceConfig?: '1d8' | '2d8'
  readonly nestedSave?: boolean
}) {
  const diceConfig = input.diceConfig ?? '1d8'
  const actionId = `${ids.effect}:ACTION:${ids.action}`
  const source = {
    kind: 'AUTHORED' as const,
    sourceKind: 'FEATURE' as const,
    definitionId: ids.effect,
    sourceInstanceId: ids.effect
  }
  const mechanicFacts = {
    invocation: {
      triggerCode: input.kind === 'ATTACK' ? 'MELEE_WEAPON_ATTACK' : 'SAVING_THROW',
      activation: { code: 'ACTION', amount: 1 },
      range: { rangeKind: 'UNLIMITED', amount: null, unit: null },
      savingThrow:
        input.kind === 'SAVE'
          ? {
              dcMethod: 'FIXED_DC' as const,
              abilityDefinitionId: '00000000-0000-0000-0011-000200000000',
              baseDc: 15,
              bonuses: []
            }
          : null,
      reactionMovementTrigger: null
    },
    outcomes: [
      {
        kind: 'DAMAGE' as const,
        pathCode: input.kind === 'ATTACK' ? 'ON_HIT' : 'ON_SAVE_FAIL',
        label: null,
        damageTypeId: ids.effect,
        valueKind: 'DICE' as const,
        scalingKind: 'NONE' as const,
        scalingSource: null,
        classId: null,
        amountKind: null,
        amountMultiplier: null,
        values: [
          {
            level: null,
            order: 0,
            amount: null,
            dice: diceConfig,
            multiplier: null,
            minimum: null,
            maximum: null
          }
        ],
        bonuses: []
      }
    ]
  }
  const candidate: CharacterActionCandidate = {
    sequence: 0,
    actionId,
    effectId: ids.effect,
    sourceId: ids.effect,
    source,
    mechanicsOwner: { kind: 'FEATURE', id: ids.effect },
    activationSourceKind: 'ACTIVE_SOURCE',
    equipment: null,
    resourceUse: null,
    mechanicFacts
  }
  const invocation =
    input.kind === 'ATTACK'
      ? {
          kind: 'ACTION' as const,
          triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
          activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
          range: { id: 'range-id', rangeKind: RANGE_KIND.UNLIMITED },
          targeting: {
            selectionKind: 'SINGLE_TARGET' as const,
            dispositionKind: 'ANY' as const
          }
        }
      : {
          kind: 'ACTION' as const,
          triggerCode: TRIGGER.SAVING_THROW,
          activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
          range: { id: 'range-id', rangeKind: RANGE_KIND.UNLIMITED },
          targeting: {
            selectionKind: 'SINGLE_TARGET' as const,
            dispositionKind: 'ANY' as const
          },
          savingThrow: {
            id: 'save-id',
            abilityDefinitionId: '00000000-0000-0000-0011-000200000000',
            dcMethod: 'FIXED_DC' as const,
            baseDc: 15
          }
        }
  const compiledEffect = compileEffect({
    id: ids.effect,
    order: 1,
    invocation,
    paths: [
      {
        id: '00000000-0000-4000-8000-000000000013',
        order: 1,
        pathCode: input.kind === 'ATTACK' ? PATH_CODE.ON_HIT : PATH_CODE.ON_SAVE_FAIL,
        groupType: input.nestedSave ? PATH_GROUP_TYPE.SEQUENTIAL : PATH_GROUP_TYPE.SINGLE,
        selectionKind: 'FIXED',
        resultBlock: {
          id: '00000000-0000-4000-8000-000000000014',
          resultKind: input.nestedSave ? ('SEQUENCE' as const) : ('SINGLE' as const),
          outcomes: [
            input.conditionId
              ? {
                  id: '00000000-0000-4000-8000-000000000015',
                  effectKind: EFFECT_KIND.CONDITION,
                  conditionId: input.conditionId
                }
              : {
                  id: '00000000-0000-4000-8000-000000000015',
                  effectKind: EFFECT_KIND.DAMAGE,
                  damageTypeId: ids.effect,
                  valueKind: 'DICE',
                  scalingKind: 'NONE',
                  diceConfig
                },
            ...(input.nestedSave
              ? [
                  {
                    id: '00000000-0000-4000-8000-000000000023',
                    effectKind: EFFECT_KIND.FOLLOW_UP_SAVE,
                    timing: 'IMMEDIATE' as const,
                    savingThrow: {
                      id: '00000000-0000-4000-8000-000000000024',
                      dcMethod: 'FIXED_DC' as const,
                      abilityDefinitionId: DND5E_CONSTITUTION_ABILITY_DEFINITION_ID,
                      baseDc: 13
                    },
                    attempts: { kind: 'ONCE' as const },
                    onFailure: {
                      kind: 'OUTCOMES' as const,
                      endCurrent: false,
                      resultKind: 'SINGLE' as const,
                      outcomes: [
                        {
                          id: '00000000-0000-4000-8000-000000000025',
                          effectKind: EFFECT_KIND.DAMAGE,
                          damageTypeId: ids.effect,
                          valueKind: 'DICE' as const,
                          scalingKind: 'NONE' as const,
                          diceConfig: '7d8'
                        }
                      ]
                    },
                    onSuccess: {
                      kind: 'OUTCOMES' as const,
                      endCurrent: false,
                      resultKind: 'SINGLE' as const,
                      outcomes: [
                        {
                          id: '00000000-0000-4000-8000-000000000026',
                          effectKind: EFFECT_KIND.DAMAGE,
                          damageTypeId: ids.effect,
                          valueKind: 'DICE' as const,
                          scalingKind: 'NONE' as const,
                          diceConfig: '7d8',
                          multiplier: 0.5
                        }
                      ]
                    }
                  }
                ]
              : [])
          ]
        }
      },
      ...(input.critical || input.conditionId
        ? [
            {
              id: '00000000-0000-4000-8000-000000000016',
              order: 2,
              pathCode: PATH_CODE.ON_CRIT,
              groupType: PATH_GROUP_TYPE.SINGLE,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: '00000000-0000-4000-8000-000000000017',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  input.conditionId
                    ? {
                        id: '00000000-0000-4000-8000-000000000018',
                        effectKind: EFFECT_KIND.CONDITION,
                        conditionId: input.conditionId
                      }
                    : {
                        id: '00000000-0000-4000-8000-000000000018',
                        effectKind: EFFECT_KIND.DAMAGE,
                        damageTypeId: ids.effect,
                        valueKind: 'DICE' as const,
                        scalingKind: 'NONE' as const,
                        diceConfig
                      }
                ]
              }
            }
          ]
        : [])
    ]
  })
  const descriptor: CharacterActionCapabilityDescriptor = {
    kind: 'CHARACTER_ACTION',
    gameSystemId: ids.system,
    authoredRootKind: 'effect',
    entryPointDefinitionId: ids.effect,
    effectId: ids.effect,
    actionId,
    sourceId: ids.effect,
    source,
    mechanicsOwner: candidate.mechanicsOwner,
    activationSourceKind: 'ACTIVE_SOURCE',
    mechanicFacts,
    conditionDefinitionIds: input.conditionId ? [input.conditionId] : [],
    compiledEffect
  }
  const entry = compileCharacterActionEntryPoints({
    gameSystemId: ids.system,
    candidates: [candidate],
    descriptors: [descriptor]
  })[0]
  if (
    !entry ||
    entry.schemaVersion !== 4 ||
    entry.compilation.kind !== 'COMPILED' ||
    entry.compilation.executionPlan.kind !== 'TEST_OUTCOME'
  ) {
    const actual = entry?.compilation.kind === 'MANUAL' ? entry.compilation.reasonCode : 'UNKNOWN'
    throw new Error(`Expected a v4 TEST_OUTCOME entry, received ${actual}.`)
  }
  const decision = {
    sequence: 0,
    actionId,
    effectId: ids.effect,
    sourceId: ids.effect,
    source,
    mechanicsOwner: candidate.mechanicsOwner,
    status: 'AVAILABLE' as const,
    reasonCode: null,
    resourcePoolId: null,
    resourceCost: null,
    mechanic:
      input.kind === 'ATTACK'
        ? {
            effectId: ids.effect,
            trigger: 'MELEE_WEAPON_ATTACK',
            activation: { kind: 'ACTION', amount: 1 },
            rangeLabel: null,
            attackBonus: 5,
            attackRollMode: 'NORMAL' as const,
            save: null,
            outcomes: []
          }
        : {
            effectId: ids.effect,
            trigger: 'SAVING_THROW',
            activation: { kind: 'ACTION', amount: 1 },
            rangeLabel: null,
            attackBonus: null,
            attackRollMode: null,
            save: { ability: 'DEXTERITY', dc: 15 },
            outcomes: []
          }
  }
  state.mechanics = {
    ...state.mechanics,
    compiledActionEntryPoints: [entry],
    rulePolicyInput: {
      ...state.mechanics.rulePolicyInput,
      actionCandidates: [candidate]
    },
    rulePolicyOutput: { actionDecisions: [decision], resources: [] }
  }
  state.overlay = {
    ...state.overlay,
    rulePolicyInput: { actionCandidates: [candidate] },
    rulePolicyOutput: {
      ...state.overlay.rulePolicyOutput,
      actionDecisions: [decision],
      resources: []
    }
  }
  configureUnlimitedSingleCharacterTarget()
  if (input.kind === 'ATTACK') {
    ;(state.targetOverlay!.rulePolicyOutput.derivedStats as Record<string, unknown>).armorClass = {
      effective: 15
    }
  }
  if (input.kind === 'SAVE' || input.nestedSave) {
    ;(state.targetOverlay!.rulePolicyOutput as Record<string, unknown>).savingThrowDefinitions = [
      {
        abilityDefinitionId: input.nestedSave
          ? DND5E_CONSTITUTION_ABILITY_DEFINITION_ID
          : '00000000-0000-0000-0011-000200000000',
        modifier: 0,
        rollMode: 'NORMAL',
        contributors: []
      }
    ]
  }
  return entry
}

function requireV4TestOutcomePlan(entry: {
  compilation: { executionPlan: CharacterRuleActionExecutionPlan }
}): Extract<CharacterRuleActionExecutionPlan, { kind: 'TEST_OUTCOME' }> {
  const plan = entry.compilation.executionPlan
  if (plan.kind !== 'TEST_OUTCOME') throw new Error('Expected a v4 TEST_OUTCOME entry.')
  return plan
}

function requireOutcomeEvidencePause(
  result: EncounterCharacterRuleActionResult
): Extract<EncounterCharacterRuleActionResult, { status: 'PENDING'; phase: 'OUTCOME' }> {
  if (result.status !== 'PENDING' || !('phase' in result) || result.phase !== 'OUTCOME') {
    throw new Error('Expected an OUTCOME roll pause.')
  }
  return result
}

function configureV4ConditionVocabularies() {
  const source = {
    snapshotId: ids.effect,
    systemId: ids.system,
    snapshotVersion: 1,
    checksum: 'c'.repeat(64),
    document: {
      abilities: [{ id: DND5E_CONSTITUTION_ABILITY_DEFINITION_ID }],
      conditionTypes: [{ id: ids.condition, label: 'Poisoned' }]
    }
  }
  const target = {
    snapshotId: ids.targetCharacter,
    systemId: ids.system,
    snapshotVersion: 1,
    checksum: 'd'.repeat(64),
    document: {
      abilities: [{ id: DND5E_CONSTITUTION_ABILITY_DEFINITION_ID }],
      conditionTypes: [{ id: ids.condition, label: 'Poisoned' }]
    }
  }
  state.vocabularySnapshots.clear()
  state.vocabularySnapshots.set(source.snapshotId, source)
  state.vocabularySnapshots.set(target.snapshotId, target)
  state.vocabularySnapshot = source
  ;(state.mechanics as Record<string, unknown>).systemVocabularySnapshotId = source.snapshotId
  ;(state.mechanics as Record<string, unknown>).systemVocabularySnapshotVersion =
    source.snapshotVersion
  ;(state.mechanics as Record<string, unknown>).systemVocabularySnapshotChecksum = source.checksum
  ;(state.targetMechanics as Record<string, unknown>).systemVocabularySnapshotId = target.snapshotId
  ;(state.targetMechanics as Record<string, unknown>).systemVocabularySnapshotVersion =
    target.snapshotVersion
  ;(state.targetMechanics as Record<string, unknown>).systemVocabularySnapshotChecksum =
    target.checksum
  return { source, target }
}

function isDamageDefenseKind(value: string): value is 'IMMUNITY' | 'RESISTANCE' | 'VULNERABILITY' {
  return value === 'IMMUNITY' || value === 'RESISTANCE' || value === 'VULNERABILITY'
}

describe('executeEncounterCharacterRuleAction', () => {
  it('completes a v4 attack miss with TEST-only evidence and no outcome mutation', async () => {
    const { actionId } = reset()
    const entry = configureV4TestOutcomeAction({ kind: 'ATTACK' })
    const test = requireV4TestOutcomePlan(entry).test
    const runtime = createDnd5eCharacterActionRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(21),
      definitions: { requireCurrent: async () => test.published }
    })

    const result = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      rollD20: () => 1,
      command: command(actionId, { targetActorId: ids.targetActor })
    })

    expect(result).toMatchObject({ status: 'COMPLETE', applications: [] })
    expect(state.calls.patchHitPoints).not.toHaveBeenCalled()
    expect(state.calls.setResourceUsage).not.toHaveBeenCalled()
    expect(state.calls.createActiveRuleEffect).not.toHaveBeenCalled()
    const terminalReceipt = [...state.receipts.values()].find(
      (receipt) =>
        typeof receipt.resultPayload === 'object' &&
        receipt.resultPayload !== null &&
        (receipt.resultPayload as { status?: unknown }).status === 'COMPLETE'
    )
    expect(terminalReceipt?.resultPayload).toMatchObject({
      phaseReceipts: [expect.objectContaining({ phase: 'TEST' })]
    })
  })

  it('rejects a known v4 outcome path when specialization omits its sealed template', async () => {
    const { actionId } = reset()
    const entry = configureV4TestOutcomeAction({ kind: 'ATTACK' })
    const adapter = characterRuleActionSystemAdapterRegistry.get(ids.system)
    if (!adapter) throw new Error('Expected the D&D Character action adapter.')
    const adapterLookup = vi
      .spyOn(characterRuleActionSystemAdapterRegistry, 'get')
      .mockReturnValue({
        ...adapter,
        specializeOutcomeTemplate: () => null
      })
    const runtime = createDnd5eCharacterActionRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(28),
      definitions: {
        requireCurrent: async () => requireV4TestOutcomePlan(entry).test.published
      }
    })

    try {
      await expect(
        executeEncounterCharacterRuleAction({
          db: {} as never,
          runtime,
          rollD20: () => 15,
          command: command(actionId, { targetActorId: ids.targetActor })
        })
      ).rejects.toThrow('requires its sealed OUTCOME graph')
    } finally {
      adapterLookup.mockRestore()
    }
    expect(state.calls.runtime).not.toHaveBeenCalled()
    expect(state.calls.patchSheetState).not.toHaveBeenCalled()
    expect(state.calls.setResourceUsage).not.toHaveBeenCalled()
    expect(state.calls.createActiveRuleEffect).not.toHaveBeenCalled()
    expect(state.receipts).toHaveLength(0)
  })

  it('validates specialized v4 condition outcomes against both pinned vocabularies', async () => {
    const { actionId } = reset()
    const entry = configureV4TestOutcomeAction({
      kind: 'ATTACK',
      critical: true,
      conditionId: ids.condition
    })
    configureV4ConditionVocabularies()
    const runtime = createDnd5eCharacterActionRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(25),
      definitions: {
        requireCurrent: async () => requireV4TestOutcomePlan(entry).test.published
      }
    })

    await expect(
      executeEncounterCharacterRuleAction({
        db: {} as never,
        runtime,
        rollD20: () => 20,
        command: command(actionId, { targetActorId: ids.targetActor })
      })
    ).resolves.toMatchObject({
      status: 'COMPLETE',
      applications: expect.arrayContaining([
        expect.objectContaining({
          outcomeKind: 'CONDITION_APPLY',
          applied: true
        })
      ])
    })
    expect(state.calls.patchSheetState).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['source vocabulary is missing', 'SOURCE_MISSING'],
    ['source vocabulary is stale', 'SOURCE_STALE'],
    ['target vocabulary is missing', 'TARGET_MISSING'],
    ['target vocabulary is stale', 'TARGET_STALE']
  ] as const)('rejects a specialized v4 condition outcome when the %s', async (_label, failure) => {
    const { actionId } = reset()
    const entry = configureV4TestOutcomeAction({
      kind: 'ATTACK',
      critical: true,
      conditionId: ids.condition
    })
    const { source, target } = configureV4ConditionVocabularies()
    if (failure === 'SOURCE_MISSING') state.vocabularySnapshots.delete(source.snapshotId)
    if (failure === 'SOURCE_STALE') {
      state.vocabularySnapshots.set(source.snapshotId, {
        ...source,
        checksum: 'e'.repeat(64)
      })
    }
    if (failure === 'TARGET_MISSING') state.vocabularySnapshots.delete(target.snapshotId)
    if (failure === 'TARGET_STALE') {
      state.vocabularySnapshots.set(target.snapshotId, {
        ...target,
        checksum: 'f'.repeat(64)
      })
    }
    const runtime = createDnd5eCharacterActionRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(26),
      definitions: {
        requireCurrent: async () => requireV4TestOutcomePlan(entry).test.published
      }
    })
    const rollD20 = vi.fn(() => 20)

    await expect(
      executeEncounterCharacterRuleAction({
        db: {} as never,
        runtime,
        rollD20,
        command: command(actionId, { targetActorId: ids.targetActor })
      })
    ).rejects.toThrow('System vocabulary snapshot is stale')
    expect(state.calls.patchSheetState).not.toHaveBeenCalled()
    expect(state.calls.patchHitPoints).not.toHaveBeenCalled()
    expect(state.calls.appendEncounterEvent).not.toHaveBeenCalled()
    expect(state.receipts).toHaveLength(0)
  })

  it.each([
    ['source mechanical context', () => (state.overlay.mechanicalContextChecksum = '1'.repeat(64))],
    [
      'target mechanical context',
      () => (state.targetOverlay!.mechanicalContextChecksum = '2'.repeat(64))
    ],
    ['source Character stream', () => (state.mechanics.characterStreamVersion += 1)],
    [
      'target Character projection',
      () => (state.targetMechanics!.projectionChecksum = '3'.repeat(64))
    ]
  ] as const)(
    'rejects an outcome resume when the sealed %s changes without changing bound attack facts',
    async (_label, mutate) => {
      const { actionId } = reset()
      state.encounter = { ...state.encounter, automationMode: 'ASSISTED' }
      const entry = configureV4TestOutcomeAction({
        kind: 'ATTACK',
        diceConfig: '2d8'
      })
      const rollInteger = vi.fn(() => 4)
      const runtime = createDnd5eCharacterActionRuntime({
        continuationIntegrityKey: new Uint8Array(32).fill(27),
        definitions: {
          requireCurrent: async () => requireV4TestOutcomePlan(entry).test.published
        }
      })
      const initial = await executeEncounterCharacterRuleAction({
        db: {} as never,
        runtime,
        rollInteger,
        command: command(actionId, { targetActorId: ids.targetActor })
      })
      if (initial.status !== 'PENDING') throw new Error('Expected a TEST roll pause.')
      const outcome = await resumeEncounterCharacterRuleAction({
        db: {} as never,
        runtime,
        rollInteger,
        command: {
          actorUserId: ids.user,
          commandId: '00000000-0000-4000-8000-000000000405',
          correlationId: null,
          encounterId: ids.encounter,
          expectedEncounterVersion: 5,
          expectedOccurrenceVersion: initial.occurrenceVersion,
          occurrenceId: initial.occurrenceId,
          resolution: {
            kind: 'PHYSICAL',
            requestId: assistedD20Request(initial).requestId,
            rawFaces: [20]
          }
        }
      })
      const outcomePause = requireOutcomeEvidencePause(outcome)
      mutate()

      await expect(
        resumeEncounterCharacterRuleAction({
          db: {} as never,
          runtime,
          rollInteger,
          command: {
            actorUserId: ids.user,
            commandId: '00000000-0000-4000-8000-000000000406',
            correlationId: null,
            encounterId: ids.encounter,
            expectedEncounterVersion: 5,
            expectedOccurrenceVersion: outcomePause.occurrenceVersion,
            occurrenceId: outcomePause.occurrenceId,
            resolution: {
              kind: 'PHYSICAL_OUTCOME',
              values: [{ requestId: outcomePause.requests[0]!.requestId, value: 4 }]
            }
          }
        })
      ).rejects.toThrow('pending action source changed')
      expect(rollInteger).not.toHaveBeenCalled()
      expect(state.calls.patchHitPoints).not.toHaveBeenCalled()
      expect(state.calls.patchSheetState).not.toHaveBeenCalled()
    }
  )

  it('persists TEST roll evidence through sequential Assisted v4 outcome requests', async () => {
    const { actionId } = reset()
    state.encounter = { ...state.encounter, automationMode: 'ASSISTED' }
    const entry = configureV4TestOutcomeAction({
      kind: 'ATTACK',
      diceConfig: '2d8'
    })
    const runtime = createDnd5eCharacterActionRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(22),
      definitions: {
        requireCurrent: async () => requireV4TestOutcomePlan(entry).test.published
      }
    })
    const initial = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      command: command(actionId, { targetActorId: ids.targetActor })
    })
    if (initial.status !== 'PENDING') throw new Error('Expected a TEST roll pause.')
    expect(state.calls.patchHitPoints).not.toHaveBeenCalled()

    const firstOutcome = await resumeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      command: {
        actorUserId: ids.user,
        commandId: '00000000-0000-4000-8000-000000000401',
        correlationId: null,
        encounterId: ids.encounter,
        expectedEncounterVersion: 5,
        expectedOccurrenceVersion: initial.occurrenceVersion,
        occurrenceId: initial.occurrenceId,
        resolution: {
          kind: 'PHYSICAL',
          requestId: assistedD20Request(initial).requestId,
          rawFaces: [15]
        }
      }
    })
    const firstOutcomePause = requireOutcomeEvidencePause(firstOutcome)
    expect(state.calls.patchHitPoints).not.toHaveBeenCalled()

    const secondOutcome = await resumeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      command: {
        actorUserId: ids.user,
        commandId: '00000000-0000-4000-8000-000000000402',
        correlationId: null,
        encounterId: ids.encounter,
        expectedEncounterVersion: 5,
        expectedOccurrenceVersion: firstOutcomePause.occurrenceVersion,
        occurrenceId: firstOutcomePause.occurrenceId,
        resolution: {
          kind: 'PHYSICAL_OUTCOME',
          values: [{ requestId: firstOutcomePause.requests[0]!.requestId, value: 4 }]
        }
      }
    })
    const secondOutcomePause = requireOutcomeEvidencePause(secondOutcome)
    expect(state.calls.patchHitPoints).not.toHaveBeenCalled()

    const completed = await resumeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      command: {
        actorUserId: ids.user,
        commandId: '00000000-0000-4000-8000-000000000403',
        correlationId: null,
        encounterId: ids.encounter,
        expectedEncounterVersion: 5,
        expectedOccurrenceVersion: secondOutcomePause.occurrenceVersion,
        occurrenceId: secondOutcomePause.occurrenceId,
        resolution: {
          kind: 'PHYSICAL_OUTCOME',
          values: [{ requestId: secondOutcomePause.requests[0]!.requestId, value: 5 }]
        }
      }
    })
    expect(completed).toMatchObject({
      status: 'COMPLETE',
      applications: [expect.objectContaining({ outcomeKind: 'DAMAGE', appliedAmount: 4 })]
    })
    expect(state.calls.patchSheetState).toHaveBeenCalledTimes(1)
    const terminalOutcomeReceipt = [...state.receipts.values()].find(
      (receipt) =>
        typeof receipt.resultPayload === 'object' &&
        receipt.resultPayload !== null &&
        (receipt.resultPayload as { status?: unknown }).status === 'COMPLETE'
    )
    expect(terminalOutcomeReceipt?.resultPayload).toMatchObject({
      phaseReceipts: [
        expect.objectContaining({ phase: 'TEST' }),
        expect.objectContaining({ phase: 'OUTCOME' })
      ],
      applicationOutputs: expect.objectContaining({
        d20: expect.objectContaining({ rawFaces: [15], selectedNatural: 15 }),
        applications: [expect.objectContaining({ requestedAmount: 9, appliedAmount: 4 })],
        targetTransition: expect.objectContaining({
          after: expect.objectContaining({
            currentHitPoints: 0,
            temporaryHitPoints: 0
          })
        })
      })
    })
  })

  it('resolves an Assisted nested save after primary damage and replays without mutation', async () => {
    const { actionId } = reset({ current: 100, maximum: 100 })
    state.encounter = { ...state.encounter, automationMode: 'ASSISTED' }
    const entry = configureV4TestOutcomeAction({
      kind: 'ATTACK',
      nestedSave: true
    })
    state.targetMechanics!.commandState.state.hitpoints = {
      current: 100,
      temp: 0
    }
    ;(state.targetOverlay!.rulePolicyOutput.derivedStats as Record<string, unknown>).maxHitPoints =
      {
        effective: 100
      }
    state.encounter.actors = state.encounter.actors.map((actor) =>
      actor.id === ids.targetActor
        ? {
            ...actor,
            currentHitPoints: 100,
            tempHitPoints: 0,
            maxHitPoints: 100
          }
        : actor
    )
    const savingThrowDefinitions = (
      state.targetOverlay!.rulePolicyOutput as {
        savingThrowDefinitions: Array<{
          rollMode: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE'
          contributors: Array<{
            sourceId: string
            grantId: null
            domainKey: string
            influence: 'ADVANTAGE' | 'DISADVANTAGE'
          }>
        }>
      }
    ).savingThrowDefinitions
    savingThrowDefinitions[0]!.rollMode = 'ADVANTAGE'
    savingThrowDefinitions[0]!.contributors = [
      {
        sourceId: ids.effect,
        grantId: null,
        domainKey: 'nested-save-test',
        influence: 'ADVANTAGE'
      }
    ]
    const runtime = createDnd5eCharacterActionRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(28),
      definitions: {
        requireCurrent: async () => requireV4TestOutcomePlan(entry).test.published
      }
    })
    const initial = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      command: command(actionId, { targetActorId: ids.targetActor })
    })
    if (initial.status !== 'PENDING') throw new Error('Expected an Assisted TEST pause.')
    let commandOrdinal = 500
    const nextCommandId = () =>
      `00000000-0000-4000-8000-${String(++commandOrdinal).padStart(12, '0')}`
    const primaryDamage = await resumeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      command: {
        actorUserId: ids.user,
        commandId: nextCommandId(),
        correlationId: null,
        encounterId: ids.encounter,
        expectedEncounterVersion: 5,
        expectedOccurrenceVersion: initial.occurrenceVersion,
        occurrenceId: initial.occurrenceId,
        resolution: {
          kind: 'PHYSICAL',
          requestId: assistedD20Request(initial).requestId,
          rawFaces: [15]
        }
      }
    })
    const primaryDamagePause = requireOutcomeEvidencePause(primaryDamage)
    const nestedSave = await resumeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      command: {
        actorUserId: ids.user,
        commandId: nextCommandId(),
        correlationId: null,
        encounterId: ids.encounter,
        expectedEncounterVersion: 5,
        expectedOccurrenceVersion: primaryDamagePause.occurrenceVersion,
        occurrenceId: primaryDamagePause.occurrenceId,
        resolution: {
          kind: 'PHYSICAL_OUTCOME',
          values: [{ requestId: primaryDamagePause.requests[0]!.requestId, value: 4 }]
        }
      }
    })
    if (nestedSave.status !== 'PENDING' || !('request' in nestedSave)) {
      throw new Error('Expected the nested d20 pause.')
    }
    expect(nestedSave).toMatchObject({
      rollMode: 'ADVANTAGE',
      controls: ['SYSTEM', 'PHYSICAL']
    })
    savingThrowDefinitions[0]!.rollMode = 'DISADVANTAGE'
    savingThrowDefinitions[0]!.contributors = [
      {
        sourceId: ids.effect,
        grantId: null,
        domainKey: 'nested-save-test',
        influence: 'DISADVANTAGE'
      }
    ]
    await expect(
      resumeEncounterCharacterRuleAction({
        db: {} as never,
        runtime,
        command: {
          actorUserId: ids.user,
          commandId: nextCommandId(),
          correlationId: null,
          encounterId: ids.encounter,
          expectedEncounterVersion: 5,
          expectedOccurrenceVersion: nestedSave.occurrenceVersion,
          occurrenceId: nestedSave.occurrenceId,
          resolution: {
            kind: 'PHYSICAL',
            requestId: nestedSave.request.requestId,
            rawFaces: [3, 17]
          }
        }
      })
    ).rejects.toThrow('nested save policy changed before resume')
    savingThrowDefinitions[0]!.rollMode = 'ADVANTAGE'
    savingThrowDefinitions[0]!.contributors = [
      {
        sourceId: ids.effect,
        grantId: null,
        domainKey: 'nested-save-test',
        influence: 'ADVANTAGE'
      }
    ]
    await expect(
      resumeEncounterCharacterRuleAction({
        db: {} as never,
        runtime,
        command: {
          actorUserId: ids.user,
          commandId: nextCommandId(),
          correlationId: null,
          encounterId: ids.encounter,
          expectedEncounterVersion: 5,
          expectedOccurrenceVersion: nestedSave.occurrenceVersion,
          occurrenceId: nestedSave.occurrenceId,
          resolution: {
            kind: 'PHYSICAL',
            requestId: `${nestedSave.request.requestId}:wrong`,
            rawFaces: [3, 17]
          }
        }
      })
    ).rejects.toThrow('nested save request does not match')
    let current = await resumeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      command: {
        actorUserId: ids.user,
        commandId: nextCommandId(),
        correlationId: null,
        encounterId: ids.encounter,
        expectedEncounterVersion: 5,
        expectedOccurrenceVersion: nestedSave.occurrenceVersion,
        occurrenceId: nestedSave.occurrenceId,
        resolution: {
          kind: 'PHYSICAL',
          requestId: nestedSave.request.requestId,
          rawFaces: [3, 17]
        }
      }
    })
    let finalReplayInput: Parameters<typeof resumeEncounterCharacterRuleAction>[0] | null = null
    for (let index = 0; index < 7; index += 1) {
      const damagePause = requireOutcomeEvidencePause(current)
      const resumeInput = {
        db: {} as never,
        runtime,
        command: {
          actorUserId: ids.user,
          commandId: nextCommandId(),
          correlationId: null,
          encounterId: ids.encounter,
          expectedEncounterVersion: 5,
          expectedOccurrenceVersion: damagePause.occurrenceVersion,
          occurrenceId: damagePause.occurrenceId,
          resolution: {
            kind: 'PHYSICAL_OUTCOME' as const,
            values: [{ requestId: damagePause.requests[0]!.requestId, value: 4 }]
          }
        }
      }
      if (index === 6) finalReplayInput = resumeInput
      current = await resumeEncounterCharacterRuleAction(resumeInput)
    }
    expect(current).toMatchObject({
      status: 'COMPLETE',
      applications: [
        expect.objectContaining({ outcomeKind: 'DAMAGE', appliedAmount: 4 }),
        expect.objectContaining({ outcomeKind: 'DAMAGE', appliedAmount: 14 })
      ]
    })
    if (!finalReplayInput) throw new Error('Expected a terminal replay input.')
    expect(
      state.receipts.get(`${ids.encounter}:${finalReplayInput.command.commandId}`)?.resultPayload
    ).toMatchObject({
      applicationOutputs: {
        nestedD20: {
          requestNodeId: 'nested-save-d20',
          rawFaces: [3, 17],
          selectedNatural: 17,
          rollMode: 'ADVANTAGE',
          modifier: 0,
          defenseOrDc: 13,
          resultPath: 'ON_SAVE_SUCCESS'
        }
      }
    })
    const nestedReceipt = structuredClone(
      state.receipts.get(`${ids.encounter}:${finalReplayInput.command.commandId}`)?.resultPayload
    ) as Record<string, unknown>
    const phaseReceipts = nestedReceipt.phaseReceipts as Array<Record<string, unknown>>
    const outcomeReceipt = phaseReceipts.find((receipt) => receipt.phase === 'OUTCOME')
    const outcomeExecution = outcomeReceipt?.execution as Record<string, unknown>
    const outcomeEvidence = outcomeExecution.evidence as Record<string, unknown>
    const nestedRequest = (outcomeEvidence.trace as Array<Record<string, unknown>>).find(
      (trace) => trace.nodeId === 'nested-save-d20'
    )
    if (!nestedRequest) throw new Error('Expected nested save request trace.')
    // It retains the same d20 value but is now an unrelated nested damage request.
    nestedRequest.nodeId = 'nested-save-damage-d20'
    expect(() => storedRuleExecutionResultDtoSchema.parse(nestedReceipt)).toThrow()
    const mutationCount = state.calls.patchSheetState.mock.calls.length
    await expect(resumeEncounterCharacterRuleAction(finalReplayInput)).resolves.toEqual(current)
    expect(state.calls.patchSheetState).toHaveBeenCalledTimes(mutationCount)
  })

  it('resolves the same nested save automatically and replays without rerolling', async () => {
    const { actionId } = reset({ current: 100, maximum: 100 })
    const entry = configureV4TestOutcomeAction({
      kind: 'ATTACK',
      nestedSave: true
    })
    state.targetMechanics!.commandState.state.hitpoints = {
      current: 100,
      temp: 0
    }
    ;(state.targetOverlay!.rulePolicyOutput.derivedStats as Record<string, unknown>).maxHitPoints =
      {
        effective: 100
      }
    state.encounter.actors = state.encounter.actors.map((actor) =>
      actor.id === ids.targetActor
        ? {
            ...actor,
            currentHitPoints: 100,
            tempHitPoints: 0,
            maxHitPoints: 100
          }
        : actor
    )
    const savingThrowDefinitions = (
      state.targetOverlay!.rulePolicyOutput as {
        savingThrowDefinitions: Array<{
          rollMode: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE'
          contributors: Array<{
            sourceId: string
            grantId: null
            domainKey: string
            influence: 'ADVANTAGE' | 'DISADVANTAGE'
          }>
        }>
      }
    ).savingThrowDefinitions
    savingThrowDefinitions[0]!.rollMode = 'ADVANTAGE'
    savingThrowDefinitions[0]!.contributors = [
      {
        sourceId: ids.effect,
        grantId: null,
        domainKey: 'nested-save-test',
        influence: 'ADVANTAGE'
      }
    ]
    const runtime = createDnd5eCharacterActionRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(29),
      definitions: {
        requireCurrent: async () => requireV4TestOutcomePlan(entry).test.published
      }
    })
    const rollD20 = vi.fn().mockReturnValueOnce(15).mockReturnValueOnce(3).mockReturnValueOnce(17)
    const rollInteger = vi.fn(() => 4)
    const input = {
      db: {} as never,
      runtime,
      rollD20,
      rollInteger,
      command: command(actionId, { targetActorId: ids.targetActor })
    }
    const completed = await executeEncounterCharacterRuleAction(input)
    expect(completed).toMatchObject({
      status: 'COMPLETE',
      applications: [
        expect.objectContaining({ outcomeKind: 'DAMAGE', appliedAmount: 4 }),
        expect.objectContaining({ outcomeKind: 'DAMAGE', appliedAmount: 14 })
      ]
    })
    expect(rollD20).toHaveBeenCalledTimes(3)
    expect(rollInteger).toHaveBeenCalledTimes(8)
    expect(state.receipts.get(`${ids.encounter}:${ids.command}`)?.resultPayload).toMatchObject({
      applicationOutputs: {
        nestedD20: {
          requestNodeId: 'nested-save-d20',
          rawFaces: [3, 17],
          selectedNatural: 17,
          rollMode: 'ADVANTAGE',
          resultPath: 'ON_SAVE_SUCCESS'
        }
      }
    })
    const mutationCount = state.calls.patchSheetState.mock.calls.length
    await expect(executeEncounterCharacterRuleAction(input)).resolves.toEqual(completed)
    expect(rollD20).toHaveBeenCalledTimes(3)
    expect(rollInteger).toHaveBeenCalledTimes(8)
    expect(state.calls.patchSheetState).toHaveBeenCalledTimes(mutationCount)
  })

  it('creates an Assisted concentration occurrence without child RNG or cleanup', async () => {
    const { actionId } = reset({ current: 10 })
    state.encounter = { ...state.encounter, automationMode: 'ASSISTED' }
    const runtime = configureCriticalAttackConcentration()
    const rollD20 = vi.fn(() => 20)

    const actionPending = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      rollD20,
      command: command(actionId)
    })
    if (actionPending.status !== 'PENDING') throw new Error('Expected an Assisted action pause.')
    const parentResult = await resumeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      rollD20,
      command: {
        actorUserId: ids.user,
        commandId: '00000000-0000-4000-8000-000000000090',
        correlationId: null,
        encounterId: ids.encounter,
        expectedEncounterVersion: 5,
        expectedOccurrenceVersion: actionPending.occurrenceVersion,
        occurrenceId: actionPending.occurrenceId,
        resolution: {
          kind: 'PHYSICAL',
          requestId: assistedD20Request(actionPending).requestId,
          rawFaces: [20]
        }
      }
    })

    const pending = [...state.occurrences.values()].find(
      (occurrence) => occurrence.state === 'PENDING'
    )
    expect(pending).toMatchObject({
      aggregateId: ids.encounter,
      expectedAggregateVersion: 6,
      pendingSnapshot: {
        applicationContext: { kind: 'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK' }
      }
    })
    expect(parentResult).toMatchObject({
      status: 'COMPLETE',
      pending: {
        occurrenceId: pending?.id,
        occurrenceVersion: pending?.version,
        encounterVersion: 6,
        request: { min: 1, max: 20, rollMode: 'NORMAL' },
        allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
      }
    })
    expect(rollD20).not.toHaveBeenCalled()
    expect(state.calls.deleteMaintainedState).not.toHaveBeenCalled()
  })

  it('settles a current controller physical concentration check receipt-only and replays without work', async () => {
    const { actionId } = reset({ current: 10 })
    state.encounter = { ...state.encounter, automationMode: 'ASSISTED' }
    const runtime = configureCriticalAttackConcentration()
    const actionPending = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      rollD20: vi.fn(() => 20),
      command: command(actionId)
    })
    if (actionPending.status !== 'PENDING') throw new Error('Expected an Assisted action pause.')
    await resumeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      command: {
        actorUserId: ids.user,
        commandId: '00000000-0000-4000-8000-000000000091',
        correlationId: null,
        encounterId: ids.encounter,
        expectedEncounterVersion: 5,
        expectedOccurrenceVersion: actionPending.occurrenceVersion,
        occurrenceId: actionPending.occurrenceId,
        resolution: {
          kind: 'PHYSICAL',
          requestId: assistedD20Request(actionPending).requestId,
          rawFaces: [20]
        }
      }
    })
    const pending = [...state.occurrences.values()].find(
      (occurrence) =>
        occurrence.state === 'PENDING' &&
        (
          occurrence.pendingSnapshot as {
            applicationContext?: { kind?: string }
          }
        ).applicationContext?.kind === 'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK'
    )!
    expect(pending.pendingSnapshot).toMatchObject({
      request: { requestId: expect.any(String) }
    })
    const requestId = (pending.pendingSnapshot as { request: { requestId: string } }).request
      .requestId
    const first = await resolveEncounterConcentrationRuleOccurrence({
      db: {} as never,
      runtime,
      command: {
        actorUserId: ids.user,
        commandId: '00000000-0000-4000-8000-000000000092',
        correlationId: null,
        encounterId: ids.encounter,
        expectedEncounterVersion: 6,
        expectedOccurrenceVersion: 0,
        occurrenceId: String(pending.id),
        resolution: { kind: 'ENTER_DICE', requestId, rawFaces: [20] }
      }
    })
    expect(first.result).toMatchObject({
      status: 'COMPLETE',
      applicationOutputs: {
        kind: 'CONCENTRATION_CHECK',
        outcome: 'SAVE_SUCCESS'
      }
    })
    expect(first.replayed).toBe(false)
    expect(first.pending).toMatchObject({
      encounterVersion: 6,
      request: { min: 1, max: 20 },
      allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
    })
    expect(state.encounter.version).toBe(6)
    expect(state.encounterEvents.has('00000000-0000-4000-8000-000000000092')).toBe(false)
    const replay = await resolveEncounterConcentrationRuleOccurrence({
      db: {} as never,
      runtime,
      command: {
        actorUserId: ids.user,
        commandId: '00000000-0000-4000-8000-000000000092',
        correlationId: null,
        encounterId: ids.encounter,
        expectedEncounterVersion: 6,
        expectedOccurrenceVersion: 0,
        occurrenceId: String(pending.id),
        resolution: { kind: 'ENTER_DICE', requestId, rawFaces: [20] }
      }
    })
    expect(replay.result).toEqual(first.result)
    expect(replay.replayed).toBe(true)
    expect(replay.pending).toEqual(first.pending)
    expect(state.calls.deleteMaintainedState).not.toHaveBeenCalled()
  })

  it.each([
    ['NORMAL', [7], 7, '00000000-0000-4000-8000-000000000101'],
    ['ADVANTAGE', [7, 18], 18, '00000000-0000-4000-8000-000000000102'],
    ['DISADVANTAGE', [7, 18], 7, '00000000-0000-4000-8000-000000000103']
  ] as const)(
    'uses the frozen %s physical face count and selected die',
    async (rollMode, rawFaces, selectedNatural, commandId) => {
      const { occurrence, requestId, runtime } = await createAssistedConcentrationPending({
        rollMode
      })
      const settled = await resolveEncounterConcentrationRuleOccurrence({
        db: {} as never,
        runtime,
        command: {
          actorUserId: ids.user,
          commandId,
          correlationId: null,
          encounterId: ids.encounter,
          expectedEncounterVersion: 6,
          expectedOccurrenceVersion: 0,
          occurrenceId: String(occurrence.id),
          resolution: { kind: 'ENTER_DICE', requestId, rawFaces }
        }
      })
      expect(settled.result).toMatchObject({
        applicationOutputs: { d20: { rawFaces, selectedNatural, rollMode } }
      })
    }
  )

  it.each([
    ['NORMAL', [12], '00000000-0000-4000-8000-000000000201'],
    ['ADVANTAGE', [12, 18], '00000000-0000-4000-8000-000000000202'],
    ['DISADVANTAGE', [12, 18], '00000000-0000-4000-8000-000000000203']
  ] as const)(
    'uses server RNG exactly once per frozen %s concentration face and never on replay',
    async (rollMode, faces, commandId) => {
      const { occurrence, requestId, runtime } = await createAssistedConcentrationPending({
        rollMode
      })
      const rollD20 = vi.fn()
      for (const face of faces) rollD20.mockReturnValueOnce(face)
      const command = {
        actorUserId: ids.user,
        commandId,
        correlationId: null,
        encounterId: ids.encounter,
        expectedEncounterVersion: 6,
        expectedOccurrenceVersion: 0,
        occurrenceId: String(occurrence.id),
        resolution: { kind: 'SYSTEM_ROLL' as const, requestId }
      }
      await resolveEncounterConcentrationRuleOccurrence({
        db: {} as never,
        runtime,
        rollD20,
        command
      })
      expect(rollD20).toHaveBeenCalledTimes(faces.length)
      await resolveEncounterConcentrationRuleOccurrence({
        db: {} as never,
        runtime,
        rollD20,
        command
      })
      expect(rollD20).toHaveBeenCalledTimes(faces.length)
    }
  )

  it('rejects an invalid concentration request or frozen face count before cleanup', async () => {
    const { occurrence, requestId, runtime } = await createAssistedConcentrationPending({
      rollMode: 'ADVANTAGE'
    })
    await expect(
      resolveEncounterConcentrationRuleOccurrence({
        db: {} as never,
        runtime,
        command: {
          actorUserId: ids.user,
          commandId: '00000000-0000-4000-8000-000000000240',
          correlationId: null,
          encounterId: ids.encounter,
          expectedEncounterVersion: 6,
          expectedOccurrenceVersion: 0,
          occurrenceId: String(occurrence.id),
          resolution: { kind: 'ENTER_DICE', requestId, rawFaces: [12] }
        }
      })
    ).rejects.toThrow('dice count')
    expect(state.calls.deleteMaintainedState).not.toHaveBeenCalled()
  })

  it('rejects a concentration occurrence through the action-specific resume path', async () => {
    const { occurrence, requestId, runtime } = await createAssistedConcentrationPending()
    await expect(
      resumeEncounterCharacterRuleAction({
        db: {} as never,
        runtime,
        command: {
          actorUserId: ids.user,
          commandId: '00000000-0000-4000-8000-000000000250',
          correlationId: null,
          encounterId: ids.encounter,
          expectedEncounterVersion: 6,
          expectedOccurrenceVersion: 0,
          occurrenceId: String(occurrence.id),
          resolution: {
            kind: 'PHYSICAL',
            requestId: 'request',
            rawFaces: [20]
          }
        }
      })
    ).rejects.toThrow('invalid application context')
    expect(requestId).toEqual(expect.any(String))
  })

  it('uses the shared failed-save cleanup path once and advances one Encounter projection', async () => {
    const { occurrence, requestId, runtime } = await createAssistedConcentrationPending()
    const priorEventCalls = state.calls.appendEncounterEvent.mock.calls.length
    const settled = await resolveEncounterConcentrationRuleOccurrence({
      db: {} as never,
      runtime,
      command: {
        actorUserId: ids.user,
        commandId: '00000000-0000-4000-8000-000000000260',
        correlationId: null,
        encounterId: ids.encounter,
        expectedEncounterVersion: 6,
        expectedOccurrenceVersion: 0,
        occurrenceId: String(occurrence.id),
        resolution: { kind: 'ENTER_DICE', requestId, rawFaces: [1] }
      }
    })
    expect(settled.result).toMatchObject({
      applicationOutputs: {
        outcome: 'SAVE_FAILURE',
        cleanup: expect.any(Object)
      }
    })
    expect(state.calls.deleteMaintainedState).toHaveBeenCalledTimes(1)
    expect(state.encounter.version).toBe(7)
    expect(state.calls.appendEncounterEvent).toHaveBeenCalledTimes(priorEventCalls + 1)
  })

  it('hands a successful concentration check to the next child before a later failure cleans up once', async () => {
    const { occurrence, requestId, runtime } = await createAssistedConcentrationPending()
    const first = await resolveEncounterConcentrationRuleOccurrence({
      db: {} as never,
      runtime,
      command: {
        actorUserId: ids.user,
        commandId: '00000000-0000-4000-8000-000000000261',
        correlationId: null,
        encounterId: ids.encounter,
        expectedEncounterVersion: 6,
        expectedOccurrenceVersion: 0,
        occurrenceId: String(occurrence.id),
        resolution: { kind: 'ENTER_DICE', requestId, rawFaces: [20] }
      }
    })
    if (first.result.status !== 'COMPLETE')
      throw new Error('Expected the first concentration child to complete.')
    const firstOutputs = first.result.applicationOutputs
    if (firstOutputs.kind !== 'CONCENTRATION_CHECK' || !firstOutputs.nextOccurrenceId)
      throw new Error('Expected the successful check to create its deterministic next child.')
    const next = state.occurrences.get(firstOutputs.nextOccurrenceId)
    if (!next || next.state !== 'PENDING')
      throw new Error('Expected the next concentration child to remain pending.')
    const nextRequestId = (next.pendingSnapshot as { request: { requestId: string } }).request
      .requestId

    const second = await resolveEncounterConcentrationRuleOccurrence({
      db: {} as never,
      runtime,
      command: {
        actorUserId: ids.user,
        commandId: '00000000-0000-4000-8000-000000000262',
        correlationId: firstOutputs.nextOccurrenceId,
        encounterId: ids.encounter,
        expectedEncounterVersion: 6,
        expectedOccurrenceVersion: 0,
        occurrenceId: firstOutputs.nextOccurrenceId,
        resolution: {
          kind: 'ENTER_DICE',
          requestId: nextRequestId,
          rawFaces: [1]
        }
      }
    })

    expect(second.result).toMatchObject({
      applicationOutputs: { outcome: 'SAVE_FAILURE', nextOccurrenceId: null }
    })
    expect(state.calls.deleteMaintainedState).toHaveBeenCalledTimes(1)
    expect(state.encounter.version).toBe(7)
  })

  it('allows the GM but denies a controller assigned to a different Character before concentration RNG', async () => {
    const { occurrence, requestId, runtime } = await createAssistedConcentrationPending()
    state.calls.context.mockImplementationOnce(async () => ({
      encounter: state.encounter,
      context: {
        encounterId: ids.encounter,
        campaignId: ids.campaign,
        actorUserId: ids.user,
        assignedCharacterId: null,
        role: 'OWNER' as const,
        currentVersion: state.encounter.version,
        attunementSlotOverride: null,
        advanceVersion: async () => state.encounter.version,
        createReceiptOnlyChildOccurrencePort: () => ({
          withLockedAuthorized: async (
            _db: unknown,
            run: (aggregate: Record<string, unknown>) => Promise<unknown>
          ) =>
            run({
              aggregateKind: 'ENCOUNTER',
              aggregateId: ids.encounter,
              campaignId: ids.campaign,
              actorUserId: ids.user,
              currentVersion: state.encounter.version,
              advanceVersion: async () => {
                throw new Error('A concentration child cannot advance the Encounter.')
              }
            })
        })
      }
    }))
    await expect(
      resolveEncounterConcentrationRuleOccurrence({
        db: {} as never,
        runtime,
        command: {
          actorUserId: ids.user,
          commandId: '00000000-0000-4000-8000-000000000271',
          correlationId: null,
          encounterId: ids.encounter,
          expectedEncounterVersion: 6,
          expectedOccurrenceVersion: 0,
          occurrenceId: String(occurrence.id),
          resolution: { kind: 'ENTER_DICE', requestId, rawFaces: [20] }
        }
      })
    ).resolves.toMatchObject({
      result: { applicationOutputs: { outcome: 'SAVE_SUCCESS' } }
    })

    const {
      occurrence: deniedOccurrence,
      requestId: deniedRequestId,
      runtime: deniedRuntime
    } = await createAssistedConcentrationPending()
    await expect(
      resolveEncounterConcentrationRuleOccurrence({
        db: {} as never,
        runtime: deniedRuntime,
        rollD20: vi.fn(() => 20),
        command: {
          actorUserId: ids.targetUser,
          commandId: '00000000-0000-4000-8000-000000000272',
          correlationId: null,
          encounterId: ids.encounter,
          expectedEncounterVersion: 6,
          expectedOccurrenceVersion: 0,
          occurrenceId: String(deniedOccurrence.id),
          resolution: { kind: 'SYSTEM_ROLL', requestId: deniedRequestId }
        }
      })
    ).rejects.toThrow('Rule occurrence is unavailable')
    expect(state.calls.deleteMaintainedState).not.toHaveBeenCalled()
  })

  it('denies an unassigned player before resolving concentration evidence', async () => {
    const { occurrence, requestId, runtime } = await createAssistedConcentrationPending()
    state.calls.context.mockImplementationOnce(async () => ({
      encounter: state.encounter,
      context: {
        encounterId: ids.encounter,
        campaignId: ids.campaign,
        actorUserId: ids.user,
        assignedCharacterId: null,
        role: 'PLAYER' as const,
        currentVersion: state.encounter.version,
        attunementSlotOverride: null,
        advanceVersion: async () => state.encounter.version,
        createReceiptOnlyChildOccurrencePort: () => ({
          withLockedAuthorized: async () => {
            throw new Error('The denied player must not create a child occurrence.')
          }
        })
      }
    }))
    await expect(
      resolveEncounterConcentrationRuleOccurrence({
        db: {} as never,
        runtime,
        rollD20: vi.fn(() => 20),
        command: {
          actorUserId: ids.user,
          commandId: '00000000-0000-4000-8000-000000000270',
          correlationId: null,
          encounterId: ids.encounter,
          expectedEncounterVersion: 6,
          expectedOccurrenceVersion: 0,
          occurrenceId: String(occurrence.id),
          resolution: { kind: 'SYSTEM_ROLL', requestId }
        }
      })
    ).rejects.toThrow('Rule occurrence is unavailable')
    expect(state.calls.deleteMaintainedState).not.toHaveBeenCalled()
    state.calls.context.mockImplementationOnce(async () => ({
      encounter: state.encounter,
      context: {
        encounterId: ids.encounter,
        campaignId: ids.campaign,
        actorUserId: ids.user,
        assignedCharacterId: null,
        role: 'PLAYER' as const,
        currentVersion: state.encounter.version,
        attunementSlotOverride: null,
        advanceVersion: async () => state.encounter.version,
        createReceiptOnlyChildOccurrencePort: () => {
          throw new Error('Reconnect does not create child occurrences.')
        }
      }
    }))
    await expect(
      getPendingEncounterConcentrationRuleOccurrence({
        db: {} as never,
        actorUserId: ids.user,
        encounterId: ids.encounter
      })
    ).resolves.toBeNull()
  })

  it('hides a cross-controller parent concentration child while reconnect exposes it to the target controller and GM', async () => {
    const { actionId } = reset({ current: 10 })
    configureUnlimitedSingleCharacterTarget()
    state.encounter = { ...state.encounter, automationMode: 'ASSISTED' }
    const runtime = configureCriticalAttackConcentration()
    ;(state.targetOverlay!.rulePolicyOutput.derivedStats as Record<string, unknown>).armorClass = {
      effective: 10
    }
    moveConcentrationStateToTargetActor()

    const actionPending = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      command: command(actionId, { targetActorId: ids.targetActor })
    })
    if (actionPending.status !== 'PENDING') throw new Error('Expected an Assisted action pause.')
    const parent = await resumeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      command: {
        actorUserId: ids.user,
        commandId: '00000000-0000-4000-8000-000000000275',
        correlationId: null,
        encounterId: ids.encounter,
        expectedEncounterVersion: 5,
        expectedOccurrenceVersion: actionPending.occurrenceVersion,
        occurrenceId: actionPending.occurrenceId,
        resolution: {
          kind: 'PHYSICAL',
          requestId: assistedD20Request(actionPending).requestId,
          rawFaces: [20]
        }
      }
    })
    expect(parent).toMatchObject({ status: 'COMPLETE', pending: null })
    const occurrence = [...state.occurrences.values()].find(
      (candidate) =>
        candidate.state === 'PENDING' &&
        (
          candidate.pendingSnapshot as {
            applicationContext?: { kind?: string }
          }
        ).applicationContext?.kind === 'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK'
    )
    if (!occurrence) throw new Error('Expected the target concentration occurrence.')
    const request = (occurrence.pendingSnapshot as { request: { requestId: string } }).request
    const expected = {
      kind: 'D20_EVIDENCE',
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version,
      encounterVersion: 6,
      request: {
        requestId: request.requestId,
        min: 1,
        max: 20,
        rollMode: 'NORMAL'
      },
      allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
    }
    const cleanupCalls = state.calls.deleteMaintainedState.mock.calls.length
    useEncounterControllerContext({
      actorUserId: ids.targetUser,
      assignedCharacterId: ids.targetCharacter
    })
    await expect(
      getPendingEncounterConcentrationRuleOccurrence({
        db: {} as never,
        actorUserId: ids.targetUser,
        encounterId: ids.encounter
      })
    ).resolves.toEqual(expected)
    useEncounterControllerContext({
      actorUserId: ids.user,
      assignedCharacterId: null,
      role: 'OWNER'
    })
    await expect(
      getPendingEncounterConcentrationRuleOccurrence({
        db: {} as never,
        actorUserId: ids.user,
        encounterId: ids.encounter
      })
    ).resolves.toEqual(expected)
    expect(state.calls.deleteMaintainedState).toHaveBeenCalledTimes(cleanupCalls)
  })

  it('returns only the compact pending request to the current controller and hides it after settlement', async () => {
    const { occurrence, requestId, runtime } = await createAssistedConcentrationPending({
      rollMode: 'ADVANTAGE'
    })
    const pending = await getPendingEncounterConcentrationRuleOccurrence({
      db: {} as never,
      actorUserId: ids.user,
      encounterId: ids.encounter
    })
    expect(pending).toEqual({
      kind: 'D20_EVIDENCE',
      occurrenceId: occurrence.id,
      occurrenceVersion: 0,
      encounterVersion: 6,
      request: { requestId, min: 1, max: 20, rollMode: 'ADVANTAGE' },
      allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
    })
    expect(pending).not.toHaveProperty('contextChecksum')
    expect(pending).not.toHaveProperty('targetCharacter')

    const first = await resolveEncounterConcentrationRuleOccurrence({
      db: {} as never,
      runtime,
      command: {
        actorUserId: ids.user,
        commandId: '00000000-0000-4000-8000-000000000273',
        correlationId: null,
        encounterId: ids.encounter,
        expectedEncounterVersion: 6,
        expectedOccurrenceVersion: 0,
        occurrenceId: String(occurrence.id),
        resolution: { kind: 'ENTER_DICE', requestId, rawFaces: [20, 20] }
      }
    })
    const next = await getPendingEncounterConcentrationRuleOccurrence({
      db: {} as never,
      actorUserId: ids.user,
      encounterId: ids.encounter
    })
    expect(next).toEqual(first.pending)
    if (!next) throw new Error('Expected the deterministic next concentration child.')
    if (next.kind !== 'D20_EVIDENCE') throw new Error('Expected a d20 concentration decision.')
    await resolveEncounterConcentrationRuleOccurrence({
      db: {} as never,
      runtime,
      command: {
        actorUserId: ids.user,
        commandId: '00000000-0000-4000-8000-000000000274',
        correlationId: next.occurrenceId,
        encounterId: ids.encounter,
        expectedEncounterVersion: 6,
        expectedOccurrenceVersion: next.occurrenceVersion,
        occurrenceId: next.occurrenceId,
        resolution: {
          kind: 'ENTER_DICE',
          requestId: next.request.requestId,
          rawFaces: [1, 1]
        }
      }
    })
    await expect(
      getPendingEncounterConcentrationRuleOccurrence({
        db: {} as never,
        actorUserId: ids.user,
        encounterId: ids.encounter
      })
    ).resolves.toBeNull()
  })

  it('rejects stale occurrence versions and non-concentration pending occurrences before cleanup', async () => {
    const { occurrence, requestId, runtime } = await createAssistedConcentrationPending()
    await expect(
      resolveEncounterConcentrationRuleOccurrence({
        db: {} as never,
        runtime,
        command: {
          actorUserId: ids.user,
          commandId: '00000000-0000-4000-8000-000000000280',
          correlationId: null,
          encounterId: ids.encounter,
          expectedEncounterVersion: 6,
          expectedOccurrenceVersion: 1,
          occurrenceId: String(occurrence.id),
          resolution: { kind: 'ENTER_DICE', requestId, rawFaces: [20] }
        }
      })
    ).rejects.toThrow('not current')
    expect(state.calls.deleteMaintainedState).not.toHaveBeenCalled()

    const { actionId } = reset({ current: 10 })
    state.encounter = { ...state.encounter, automationMode: 'ASSISTED' }
    const actionRuntime = configureCriticalAttackConcentration()
    const actionPending = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime: actionRuntime,
      command: command(actionId)
    })
    if (actionPending.status !== 'PENDING') throw new Error('Expected an Assisted action pause.')
    await expect(
      resolveEncounterConcentrationRuleOccurrence({
        db: {} as never,
        runtime: actionRuntime,
        command: {
          actorUserId: ids.user,
          commandId: '00000000-0000-4000-8000-000000000281',
          correlationId: null,
          encounterId: ids.encounter,
          expectedEncounterVersion: 5,
          expectedOccurrenceVersion: actionPending.occurrenceVersion,
          occurrenceId: actionPending.occurrenceId,
          resolution: {
            kind: 'ENTER_DICE',
            requestId: assistedD20Request(actionPending).requestId,
            rawFaces: [20]
          }
        }
      })
    ).rejects.toThrow('Rule occurrence is unavailable')
  })

  it('records an automatic successful concentration child without advancing the Encounter again', async () => {
    const { actionId } = reset({ current: 10 })
    configureRuntimeOutcome({
      kind: 'DAMAGE',
      amount: 6,
      damageTypeId: ids.effect
    })
    seedMaintainedReplacement(DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID)
    const concentration = createDnd5eConcentrationCheckDefinition()
    state.calls.requireMaintenanceDefinition.mockResolvedValue({
      id: concentration.id,
      gameSystemId: concentration.gameSystemId,
      definitionFamilyKey: concentration.definitionFamilyKey,
      checksum: concentration.checksum,
      document: concentration.definition
    })
    ;(state.overlay.rulePolicyOutput as Record<string, unknown>).savingThrowDefinitions = [
      {
        abilityDefinitionId: DND5E_CONSTITUTION_ABILITY_DEFINITION_ID,
        modifier: 3,
        rollMode: 'NORMAL',
        contributors: []
      }
    ]
    const entry = state.mechanics.compiledActionEntryPoints[0] as {
      compilation: { published: unknown }
    }
    const direct = entry.compilation.published as ReturnType<typeof publishedDirectOutcome>
    const runtime = createDnd5eCharacterActionRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(9),
      definitions: {
        requireCurrent: async (definitionId: string) =>
          definitionId === concentration.id ? concentration : direct
      }
    })

    const rollD20 = vi.fn(() => 12)
    const result = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      rollD20,
      command: command(actionId)
    })
    const replay = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      rollD20,
      command: command(actionId)
    })

    expect(result).toMatchObject({
      applications: [expect.objectContaining({ appliedAmount: 6 })]
    })
    expect(replay).toEqual(result)
    expect(state.encounter.version).toBe(6)
    expect(state.maintainedStates.size).toBe(1)
    expect(state.occurrences.size).toBe(2)
    expect(rollD20).toHaveBeenCalledTimes(1)
    expect([...state.receipts.values()]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resultPayload: expect.objectContaining({
            applicationOutputs: expect.objectContaining({
              kind: 'CONCENTRATION_CHECK',
              outcome: 'SAVE_SUCCESS',
              d20: expect.objectContaining({
                rawFaces: [12],
                selectedNatural: 12,
                total: 15
              })
            })
          })
        })
      ])
    )
  })

  it('cleans up a failed concentration child from the post-action Character version', async () => {
    const { actionId } = reset({ current: 10 })
    configureRuntimeOutcome({
      kind: 'DAMAGE',
      amount: 6,
      damageTypeId: ids.effect
    })
    seedMaintainedReplacement(DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID, [
      maintainedCharacterDependent(ids.priorCharacterEffect, ids.character)
    ])
    const concentration = createDnd5eConcentrationCheckDefinition()
    state.calls.requireMaintenanceDefinition.mockResolvedValue({
      id: concentration.id,
      gameSystemId: concentration.gameSystemId,
      definitionFamilyKey: concentration.definitionFamilyKey,
      checksum: concentration.checksum,
      document: concentration.definition
    })
    ;(state.overlay.rulePolicyOutput as Record<string, unknown>).savingThrowDefinitions = [
      {
        abilityDefinitionId: DND5E_CONSTITUTION_ABILITY_DEFINITION_ID,
        modifier: 3,
        rollMode: 'NORMAL',
        contributors: []
      }
    ]
    const entry = state.mechanics.compiledActionEntryPoints[0] as {
      compilation: { published: unknown }
    }
    const direct = entry.compilation.published as ReturnType<typeof publishedDirectOutcome>
    const runtime = createDnd5eCharacterActionRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(8),
      definitions: {
        requireCurrent: async (definitionId: string) =>
          definitionId === concentration.id ? concentration : direct
      }
    })

    const result = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      rollD20: () => 1,
      command: command(actionId)
    })

    expect(result).toMatchObject({
      applications: [expect.objectContaining({ outcomeKind: 'DAMAGE', appliedAmount: 6 })]
    })
    expect(state.maintainedStates).toHaveLength(0)
    expect(state.maintainedDependents).toHaveLength(0)
    expect(state.occurrences).toHaveLength(2)
    expect(state.encounter.version).toBe(6)
    expect(state.calls.patchSheetState).toHaveBeenCalledTimes(2)
    expect(state.calls.appendCharacterEvent).toHaveBeenCalledTimes(1)
    const childReceipt = [...state.receipts.values()].find((receipt) => {
      const payload = receipt.resultPayload as Record<string, unknown> | undefined
      return (
        (payload?.applicationOutputs as Record<string, unknown> | undefined)?.kind ===
        'CONCENTRATION_CHECK'
      )
    })
    expect(childReceipt?.resultPayload).toMatchObject({
      applicationOutputs: {
        outcome: 'SAVE_FAILURE',
        d20: { rawFaces: [1], selectedNatural: 1, total: 4, dc: 10 },
        cleanup: {
          characterOwnerTransitions: [
            {
              characterId: ids.character,
              beforeStreamVersion: 4,
              afterStreamVersion: 5
            }
          ]
        }
      }
    })
  })

  it.each([
    ['ADVANTAGE', [4, 17], 17],
    ['DISADVANTAGE', [17, 4], 4]
  ] as const)('audits two-face concentration %s selection', async (rollMode, faces, selected) => {
    const { actionId } = reset({ current: 10 })
    configureRuntimeOutcome({
      kind: 'DAMAGE',
      amount: 6,
      damageTypeId: ids.effect
    })
    seedMaintainedReplacement(DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID)
    const concentration = createDnd5eConcentrationCheckDefinition()
    state.calls.requireMaintenanceDefinition.mockResolvedValue({
      id: concentration.id,
      gameSystemId: concentration.gameSystemId,
      definitionFamilyKey: concentration.definitionFamilyKey,
      checksum: concentration.checksum,
      document: concentration.definition
    })
    ;(state.overlay.rulePolicyOutput as Record<string, unknown>).savingThrowDefinitions = [
      {
        abilityDefinitionId: DND5E_CONSTITUTION_ABILITY_DEFINITION_ID,
        modifier: 3,
        rollMode,
        contributors: [
          {
            sourceId: ids.effect,
            grantId: null,
            domainKey: 'test',
            influence: rollMode
          }
        ]
      }
    ]
    const entry = state.mechanics.compiledActionEntryPoints[0] as {
      compilation: { published: unknown }
    }
    const direct = entry.compilation.published as ReturnType<typeof publishedDirectOutcome>
    const runtime = createDnd5eCharacterActionRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(10),
      definitions: {
        requireCurrent: async (definitionId: string) =>
          definitionId === concentration.id ? concentration : direct
      }
    })
    await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      rollD20: vi.fn().mockReturnValueOnce(faces[0]).mockReturnValueOnce(faces[1]),
      command: command(actionId)
    })
    const childReceipt = [...state.receipts.values()].find((receipt) => {
      const payload = receipt.resultPayload as Record<string, unknown> | undefined
      return (
        (payload?.applicationOutputs as Record<string, unknown> | undefined)?.kind ===
        'CONCENTRATION_CHECK'
      )
    })
    expect(childReceipt?.resultPayload).toMatchObject({
      applicationOutputs: {
        d20: {
          rawFaces: faces,
          selectedNatural: selected,
          modifier: 3,
          total: selected + 3
        }
      }
    })
  })

  it('does not require a concentration saving-throw binding when no positive damage applied', async () => {
    const { actionId } = reset({ current: 10 })
    seedMaintainedReplacement(DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID)

    await expect(
      executeEncounterCharacterRuleAction({
        db: {} as never,
        runtime: { executeResolved: state.calls.runtime } as never,
        command: command(actionId)
      })
    ).resolves.toMatchObject({
      applications: [expect.objectContaining({ outcomeKind: 'HEAL', appliedAmount: 0 })]
    })

    expect(state.occurrences.size).toBe(1)
    expect(state.maintainedStates.size).toBe(1)
    expect(state.calls.requireMaintenanceDefinition).not.toHaveBeenCalled()
  })

  it('rejects a v1 vocabulary without the concentration ability before child RNG or cleanup', async () => {
    const { actionId } = reset({ current: 10 })
    const runtime = configureCriticalAttackConcentration([
      maintainedCharacterDependent(ids.priorCharacterEffect, ids.character)
    ])
    state.vocabularySnapshot = {
      ...state.vocabularySnapshot!,
      document: { conditionTypes: [{ id: ids.condition, label: 'Poisoned' }] }
    }
    const rollD20 = vi.fn(() => 20)

    await expect(
      executeEncounterCharacterRuleAction({
        db: {} as never,
        runtime,
        rollD20,
        command: command(actionId)
      })
    ).rejects.toThrow('saving-throw ability is not present in the pinned System vocabulary')

    expect(rollD20).toHaveBeenCalledTimes(1)
    expect(concentrationReceiptInputs()).toHaveLength(0)
    expect(state.calls.deleteMaintainedState).not.toHaveBeenCalled()
  })

  it('persists two successful concentration children with an exact occurrence correlation chain', async () => {
    const { actionId } = reset({ current: 10 })
    const runtime = configureCriticalAttackConcentration([
      maintainedCharacterDependent(ids.priorCharacterEffect, ids.character)
    ])
    const rollD20 = vi.fn().mockReturnValueOnce(20).mockReturnValueOnce(12).mockReturnValueOnce(12)

    await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      rollD20,
      command: command(actionId)
    })

    const [first, second] = concentrationReceiptInputs()
    expect(first).toBeDefined()
    expect(second).toBeDefined()
    const firstOutputs = (first!.resultPayload as { applicationOutputs: Record<string, unknown> })
      .applicationOutputs
    const secondOutputs = (second!.resultPayload as { applicationOutputs: Record<string, unknown> })
      .applicationOutputs
    expect(first!.occurrenceId).toBe(firstOutputs.occurrenceId)
    expect(second!.occurrenceId).toBe(secondOutputs.occurrenceId)
    expect(state.occurrences.has(String(first!.occurrenceId))).toBe(true)
    expect(state.occurrences.has(String(second!.occurrenceId))).toBe(true)
    expect(second!.correlationId).toBe(first!.occurrenceId)
    expect(firstOutputs.nextOccurrenceId).toBe(second!.occurrenceId)
    expect(secondOutputs.nextOccurrenceId).toBeNull()
    expect(rollD20).toHaveBeenCalledTimes(3)
    const firstContextChecksum = firstOutputs.contextChecksum
    await expect(
      executeEncounterCharacterRuleAction({
        db: {} as never,
        runtime,
        rollD20,
        command: command(actionId)
      })
    ).resolves.toMatchObject({ status: 'COMPLETE' })
    expect(rollD20).toHaveBeenCalledTimes(3)
    expect(
      (
        concentrationReceiptInputs()[0]!.resultPayload as {
          applicationOutputs: Record<string, unknown>
        }
      ).applicationOutputs.contextChecksum
    ).toBe(firstContextChecksum)
  })

  it('skips the remaining direct-action damage application after the first concentration failure', async () => {
    const { actionId } = reset({ current: 10 })
    const runtime = configureCriticalAttackConcentration([
      maintainedCharacterDependent(ids.priorCharacterEffect, ids.character)
    ])
    const rollD20 = vi.fn().mockReturnValueOnce(20).mockReturnValueOnce(1)

    await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      rollD20,
      command: command(actionId)
    })

    const [first] = concentrationReceiptInputs()
    const outputs = (first!.resultPayload as { applicationOutputs: Record<string, unknown> })
      .applicationOutputs
    expect(concentrationReceiptInputs()).toHaveLength(1)
    expect(outputs).toMatchObject({
      outcome: 'SAVE_FAILURE',
      nextOccurrenceId: null,
      skipped: [expect.objectContaining({ reason: 'MAINTAINED_STATE_ENDED' })]
    })
    expect(state.maintainedStates).toHaveLength(0)
    expect(rollD20).toHaveBeenCalledTimes(2)
  })

  it('runs the second direct-action concentration child after the first succeeds and cleans up once on failure', async () => {
    const { actionId } = reset({ current: 10 })
    const runtime = configureCriticalAttackConcentration()
    const rollD20 = vi.fn().mockReturnValueOnce(20).mockReturnValueOnce(12).mockReturnValueOnce(1)

    await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      rollD20,
      command: command(actionId)
    })

    const [first, second] = concentrationReceiptInputs()
    expect(first!.resultPayload).toMatchObject({
      applicationOutputs: {
        outcome: 'SAVE_SUCCESS',
        nextOccurrenceId: second!.occurrenceId
      }
    })
    expect(second!.resultPayload).toMatchObject({
      applicationOutputs: { outcome: 'SAVE_FAILURE', nextOccurrenceId: null }
    })
    expect(state.calls.deleteMaintainedState).toHaveBeenCalledTimes(1)
    expect(state.calls.deleteActiveRuleEffect).not.toHaveBeenCalled()
    expect(rollD20).toHaveBeenCalledTimes(3)
  })

  it('retains post-damage hit points when failed concentration cleanup advances the same Character', async () => {
    const { actionId } = reset({ current: 10 })
    const runtime = configureCriticalAttackConcentration([
      maintainedCharacterDependent(ids.priorCharacterEffect, ids.character)
    ])

    await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      rollD20: vi.fn().mockReturnValueOnce(20).mockReturnValueOnce(1),
      command: command(actionId)
    })

    const finalActor = state.calls.updateActor.mock.calls.at(-1)?.[0] as Record<string, unknown>
    expect(finalActor).toMatchObject({
      id: ids.actor,
      sourceRevision: 5,
      currentHitPoints: 6,
      tempHitPoints: 0
    })
    const encounterEvent = state.encounterEvents.get(ids.command)
    expect(encounterEvent?.resultPayload).toMatchObject({
      currentProjection: {
        actors: [
          expect.objectContaining({
            id: ids.actor,
            sourceRevision: 5,
            currentHitPoints: 6,
            tempHitPoints: 0
          })
        ]
      }
    })
  })

  it('records Manual OFF as an idempotent receipt without executing or mutating mechanics', async () => {
    const { actionId } = reset({ current: 10 })
    state.encounter = { ...state.encounter, automationMode: 'MANUAL' }
    const runtime = { executeResolved: state.calls.runtime } as never
    const first = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      command: command(actionId)
    })
    const replay = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      command: command(actionId)
    })

    expect(first).toEqual({
      status: 'MANUAL',
      occurrenceId: expect.any(String),
      reminder: null
    })
    expect(replay).toEqual(first)
    expect(state.calls.runtime).not.toHaveBeenCalled()
    expect(state.calls.patchSheetState).not.toHaveBeenCalled()
    expect(state.calls.patchHitPoints).not.toHaveBeenCalled()
    expect(state.calls.updateActor).not.toHaveBeenCalled()
    expect(state.calls.publishEncounter).not.toHaveBeenCalled()
    expect(state.calls.appendEncounterEvent).not.toHaveBeenCalled()
    expect(state.calls.appendCharacterEvent).not.toHaveBeenCalled()
    expect(state.encounter.version).toBe(5)
    expect(state.receipts.get(`${ids.encounter}:${ids.command}`)?.resultPayload).toEqual(
      expect.objectContaining({ status: 'MANUAL', reminder: null })
    )
  })

  it('returns only a generic Manual SUBTLE reminder after recognizing the exact action', async () => {
    const { actionId } = reset({ current: 10 })
    state.encounter = {
      ...state.encounter,
      automationMode: 'MANUAL',
      manualReminderMode: 'SUBTLE'
    }
    const result = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime: { executeResolved: state.calls.runtime } as never,
      command: command(actionId)
    })

    expect(result).toEqual({
      status: 'MANUAL',
      occurrenceId: expect.any(String),
      reminder: { kind: 'MANUAL_RULE_REVIEW' }
    })
    const publicPayload = JSON.stringify(result)
    for (const privateValue of [
      actionId,
      ids.actor,
      ids.targetActor,
      ids.character,
      ids.targetCharacter,
      ids.effect
    ]) {
      expect(publicPayload).not.toContain(privateValue)
    }
    expect(publicPayload).not.toContain('provenance')
    expect(publicPayload).not.toContain('facts')
    expect(state.calls.runtime).not.toHaveBeenCalled()
    expect(state.calls.patchSheetState).not.toHaveBeenCalled()
    expect(state.encounter.version).toBe(5)
  })

  it('records a resource-bound Manual action without constructing prospective consumption', async () => {
    const { actionId } = reset({ current: 10 })
    configureResourceBoundAction()
    state.encounter = { ...state.encounter, automationMode: 'MANUAL' }

    await expect(
      executeEncounterCharacterRuleAction({
        db: {} as never,
        runtime: { executeResolved: state.calls.runtime } as never,
        command: command(actionId)
      })
    ).resolves.toMatchObject({ status: 'MANUAL', reminder: null })

    expect(state.calls.listResourceUsage).toHaveBeenCalledTimes(1)
    expect(state.calls.actionEvaluation).not.toHaveBeenCalled()
    expect(state.calls.runtime).not.toHaveBeenCalled()
    expect(state.calls.patchSheetState).not.toHaveBeenCalled()
    expect(state.calls.setResourceUsage).not.toHaveBeenCalled()
    expect(state.calls.appendCharacterEvent).not.toHaveBeenCalled()
    expect(state.calls.appendEncounterEvent).not.toHaveBeenCalled()
    expect(state.encounter.version).toBe(5)
  })

  it('binds locked D&D attack facts and completes an automatic selected d20 exactly once', async () => {
    const { actionId } = reset({ current: 10 })
    configureUnlimitedSingleCharacterTarget()
    state.targetMechanics!.commandState.state.hitpoints = {
      current: 10,
      temp: 0
    }
    state.encounter.actors = state.encounter.actors.map((actor) =>
      actor.id === ids.targetActor ? { ...actor, currentHitPoints: 10, tempHitPoints: 0 } : actor
    )
    const published = publishedAttack()
    const entry = state.mechanics.compiledActionEntryPoints[0] as {
      compilation: { published: unknown }
    }
    entry.compilation.published = published
    const decisions = state.overlay.rulePolicyOutput.actionDecisions as Array<
      Record<string, unknown>
    >
    decisions[0] = {
      ...decisions[0],
      mechanic: { attackBonus: 5, attackRollMode: 'ADVANTAGE', save: null }
    }
    ;(
      state.mechanics.rulePolicyOutput as {
        actionDecisions: Array<Record<string, unknown>>
      }
    ).actionDecisions[0] = decisions[0]!
    ;(state.targetOverlay!.rulePolicyOutput.derivedStats as Record<string, unknown>).armorClass = {
      effective: 17
    }
    ;(state.overlay.rulePolicyOutput as Record<string, unknown>).rollContributorEvidence = {
      attacks: {
        MELEE: [
          {
            sourceId: ids.effect,
            grantId: ids.action,
            domainKey: 'flanking',
            influence: 'ADVANTAGE'
          },
          {
            sourceId: ids.effect,
            grantId: ids.effect,
            domainKey: 'cover',
            influence: 'ADVANTAGE'
          }
        ]
      }
    }
    const runtime = createDnd5eCharacterActionRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(1),
      definitions: { requireCurrent: async () => published }
    })
    const rollD20 = vi.fn().mockReturnValueOnce(12).mockReturnValueOnce(18)
    const first = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      rollD20,
      command: command(actionId, { targetActorId: ids.targetActor })
    })
    const replay = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      rollD20,
      command: command(actionId, { targetActorId: ids.targetActor })
    })
    expect(first.status).toBe('COMPLETE')
    if (first.status !== 'COMPLETE') throw new Error('Expected automatic action completion.')
    expect(first.applications).toContainEqual(
      expect.objectContaining({ outcomeKind: 'DAMAGE', appliedAmount: 4 })
    )
    expect(replay).toEqual(first)
    expect(rollD20).toHaveBeenCalledTimes(2)
    expect(state.calls.patchSheetState).toHaveBeenCalledTimes(1)
    state.encounter = {
      ...state.encounter,
      actors: state.encounter.actors.filter((actor) => actor.id !== ids.actor)
    }
    await expect(
      executeEncounterCharacterRuleAction({
        db: {} as never,
        runtime,
        rollD20,
        command: command(actionId, { targetActorId: ids.targetActor })
      })
    ).resolves.toEqual(first)
    expect(rollD20).toHaveBeenCalledTimes(2)
    expect(state.calls.patchSheetState).toHaveBeenCalledTimes(1)
    const receipt = state.receipts.get(`${ids.encounter}:${ids.command}`)
    expect(receipt?.resultPayload).toMatchObject({
      applicationOutputs: {
        kind: 'CHARACTER_MECHANICS_BATCH',
        d20: {
          rollMode: 'ADVANTAGE',
          rawFaces: [12, 18],
          selectedNatural: 18,
          modifier: 5,
          total: 23,
          defenseOrDc: 17,
          contributors: [
            {
              sourceId: ids.effect,
              grantId: ids.action,
              domainKey: 'flanking',
              influence: 'ADVANTAGE'
            },
            {
              sourceId: ids.effect,
              grantId: ids.effect,
              domainKey: 'cover',
              influence: 'ADVANTAGE'
            }
          ]
        }
      }
    })
    const resultPayload = receipt?.resultPayload as Record<string, unknown>
    const originalOutputs = structuredClone(resultPayload.applicationOutputs) as Record<
      string,
      unknown
    >
    const replayWith = async (mutate: (outputs: Record<string, unknown>) => void) => {
      const outputs = structuredClone(originalOutputs) as Record<string, unknown>
      mutate(outputs)
      resultPayload.applicationOutputs = outputs
      await expect(
        executeEncounterCharacterRuleAction({
          db: {} as never,
          runtime,
          rollD20,
          command: command(actionId, { targetActorId: ids.targetActor })
        })
      ).rejects.toThrow(
        /(?:Stored rule-execution receipt has an invalid result shape|Encounter rule-action replay receipt is invalid\.)/
      )
      expect(rollD20).toHaveBeenCalledTimes(2)
      expect(state.calls.runtime).not.toHaveBeenCalled()
      expect(state.calls.patchSheetState).toHaveBeenCalledTimes(1)
    }
    await replayWith((outputs) => {
      ;(outputs.d20 as Record<string, unknown>).rawFaces = [21, 18]
    })
    await replayWith((outputs) => {
      ;(outputs.d20 as Record<string, unknown>).requestId = 'forged-request'
    })
    await replayWith((outputs) => {
      ;(outputs.d20 as Record<string, unknown>).modifier = 6
    })
    await replayWith((outputs) => {
      ;(outputs.d20 as Record<string, unknown>).defenseOrDc = 18
    })
    await replayWith((outputs) => {
      ;(outputs.d20 as Record<string, unknown>).resultPath = 'ON_MISS'
    })
    await replayWith((outputs) => {
      const d20 = outputs.d20 as Record<string, unknown>
      d20.contributors = [
        ...((d20.contributors as readonly unknown[]) ?? []),
        ...((d20.contributors as readonly unknown[]) ?? [])
      ]
    })
    await replayWith((outputs) => {
      ;(outputs.d20 as Record<string, unknown>).rollMode = 'NORMAL'
    })
    await replayWith((outputs) => {
      ;(outputs.d20 as Record<string, unknown>).contributorChecksum = 'f'.repeat(64)
    })
    await replayWith((outputs) => {
      outputs.sourceCharacterId = ids.targetCharacter
    })
    await replayWith((outputs) => {
      const d20 = outputs.d20 as Record<string, unknown>
      d20.contributors = [...(d20.contributors as readonly unknown[])].reverse()
    })
    await replayWith((outputs) => {
      const applications = outputs.applications as Array<Record<string, unknown>>
      applications[0]!.appliedAmount = 3
    })
    await replayWith((outputs) => {
      const applications = outputs.applications as Array<Record<string, unknown>>
      applications[0]!.sourceNodeId = 'forged-node'
    })
    await replayWith((outputs) => {
      ;(outputs.applications as Array<Record<string, unknown>>).splice(0, 1)
    })
    await replayWith((outputs) => {
      const transition = outputs.targetTransition as Record<string, unknown>
      ;(transition.after as Record<string, unknown>).currentHitPoints = 7
    })
    await replayWith((outputs) => {
      const transition = outputs.targetTransition as Record<string, unknown>
      ;(transition.before as Record<string, unknown>).conditionIds = [ids.condition]
    })
    await replayWith((outputs) => {
      outputs.targetCharacterStreamVersion = null
    })
  })

  it('creates one Character-owned recurring effect only after automatic completion and replays before UUID creation', async () => {
    const { actionId, published } = reset({ current: 4 })
    configureRecurringActiveEffect(actionId)
    const runtime = createDnd5eCharacterActionRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(7),
      definitions: { requireCurrent: async () => published }
    })
    const createActiveEffectId = vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000011')

    await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      createActiveEffectId,
      command: command(actionId)
    })
    await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      createActiveEffectId,
      command: command(actionId)
    })

    expect(createActiveEffectId).toHaveBeenCalledTimes(1)
    expect(state.calls.createActiveRuleEffect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '00000000-0000-4000-8000-000000000011',
        owner: { kind: 'CHARACTER', characterId: ids.character },
        definition: expect.objectContaining({
          frozenGraph: expect.objectContaining({
            source: expect.objectContaining({ checksum: published.checksum }),
            nodes: published.definition.nodes
          })
        })
      })
    )
    expect(state.receipts.get(`${ids.encounter}:${ids.command}`)?.resultPayload).toMatchObject({
      applicationOutputs: {
        activeEffectTransitions: [
          expect.objectContaining({
            kind: 'CREATE',
            activeEffectId: '00000000-0000-4000-8000-000000000011',
            frozenGraphNodeId: 'heal',
            recurrenceStage: 'START_OF_TURN',
            remainingTicks: 2
          })
        ]
      }
    })
  })

  it('creates a maintained state and dependent effect, then seals the full result checksum into the Encounter event', async () => {
    const { actionId, published } = reset({ current: 4 })
    configureMaintainedRecurringActiveEffect(actionId)
    const runtime = createDnd5eCharacterActionRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(7),
      definitions: { requireCurrent: async () => published }
    })

    await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      createActiveEffectId: () => '00000000-0000-4000-8000-000000000011',
      command: command(actionId)
    })

    expect(state.calls.requireMaintenanceDefinition).toHaveBeenCalledWith(ids.maintenanceDefinition)
    expect(state.calls.createMaintainedState).toHaveBeenCalledWith(
      expect.objectContaining({
        encounterId: ids.encounter,
        ownerActorId: ids.actor,
        descriptor: expect.objectContaining({
          maintenanceDefinitionId: ids.maintenanceDefinition,
          replacementPolicy: 'REPLACE_SAME_DEFINITION'
        })
      })
    )
    expect(state.calls.createActiveRuleEffect).toHaveBeenCalledWith(
      expect.objectContaining({
        maintainedEffectStateId: ids.replacementState
      })
    )
    const stored = state.receipts.get(`${ids.encounter}:${ids.command}`)?.resultPayload as Record<
      string,
      unknown
    >
    const output = stored.applicationOutputs as Record<string, unknown>
    expect(output.maintenanceTransition).toMatchObject({
      kind: 'REPLACE_SAME_DEFINITION',
      priorState: null,
      createdState: { id: ids.replacementState },
      createdDependentEffectIds: ['00000000-0000-4000-8000-000000000011']
    })
    expect(state.encounterEvents.get(ids.command)?.resultPayload).toMatchObject({
      ruleReceipt: {
        occurrenceId: expect.any(String),
        resultChecksum: checksumRuleDocument(stored)
      }
    })
  })

  it('carries compiled perception contributions unchanged into the frozen active-effect definition', async () => {
    const { actionId, published } = reset({ current: 4 })
    const contributions = perceptionContributions()
    configureRecurringActiveEffect(actionId, contributions)
    const runtime = createDnd5eCharacterActionRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(7),
      definitions: { requireCurrent: async () => published }
    })

    await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      createActiveEffectId: () => '00000000-0000-4000-8000-000000000011',
      command: command(actionId)
    })

    expect(state.calls.createActiveRuleEffect).toHaveBeenCalledWith(
      expect.objectContaining({
        definition: expect.objectContaining({
          perceptionContributions: contributions
        })
      })
    )
  })

  it('replaces only the same maintenance definition in canonical dependent deletion order', async () => {
    const { actionId, published } = reset({ current: 4 })
    configureMaintainedRecurringActiveEffect(actionId)
    seedMaintainedReplacement(ids.maintenanceDefinition, [
      maintainedCharacterDependent(ids.priorCharacterEffect, ids.character, 2),
      maintainedActorDependent(ids.priorEncounterEffect, ids.actor)
    ])

    await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime: createDnd5eCharacterActionRuntime({
        continuationIntegrityKey: new Uint8Array(32).fill(7),
        definitions: { requireCurrent: async () => published }
      }),
      createActiveEffectId: () => '00000000-0000-4000-8000-000000000011',
      command: command(actionId)
    })

    expect(state.calls.deleteActiveRuleEffect.mock.calls.map(([input]) => input.id)).toEqual([
      ids.priorCharacterEffect,
      ids.priorEncounterEffect
    ])
    expect(state.calls.deleteMaintainedState).toHaveBeenCalledWith(
      expect.objectContaining({ id: ids.maintainedState, expectedVersion: 2 })
    )
    const resultPayload = state.receipts.get(`${ids.encounter}:${ids.command}`)?.resultPayload
    if (!resultPayload) throw new Error('Expected a stored rule-action result payload.')
    const output = (resultPayload as Record<string, Record<string, unknown>>).applicationOutputs
    expect(output.maintenanceTransition).toMatchObject({
      priorState: { id: ids.maintainedState, version: 2 },
      removedDependentEffects: [
        {
          activeEffectId: ids.priorCharacterEffect,
          kind: 'CHARACTER',
          characterId: ids.character
        },
        {
          activeEffectId: ids.priorEncounterEffect,
          kind: 'ENCOUNTER_ACTOR',
          targetActorId: ids.actor
        }
      ],
      characterOwnerTransitions: [
        {
          characterId: ids.character,
          beforeStreamVersion: 3,
          afterStreamVersion: 4
        }
      ]
    })
  })

  it('retains the source Character stream transition when cross-target maintenance removes its prior dependent without a resource cost', async () => {
    const { actionId, published } = reset({ current: 4 })
    configureUnlimitedSingleCharacterTarget()
    configureMaintainedRecurringActiveEffect(actionId)
    seedMaintainedReplacement(ids.maintenanceDefinition, [
      maintainedCharacterDependent(ids.priorCharacterEffect, ids.character)
    ])

    await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime: createDnd5eCharacterActionRuntime({
        continuationIntegrityKey: new Uint8Array(32).fill(7),
        definitions: { requireCurrent: async () => published }
      }),
      createActiveEffectId: () => '00000000-0000-4000-8000-000000000011',
      command: command(actionId, { targetActorId: ids.targetActor })
    })

    const resultPayload = state.receipts.get(`${ids.encounter}:${ids.command}`)?.resultPayload
    if (!resultPayload) throw new Error('Expected a stored rule-action result payload.')
    const output = (resultPayload as Record<string, Record<string, unknown>>).applicationOutputs
    expect(output).toMatchObject({
      sourceCharacterStreamVersion: 4,
      targetCharacterStreamVersion: 4,
      resourceConsumption: null,
      maintenanceTransition: {
        characterOwnerTransitions: [
          {
            characterId: ids.character,
            beforeStreamVersion: 3,
            afterStreamVersion: 4
          }
        ]
      }
    })
  })

  it('replaces mixed dependents with sorted third-Character locks and updates its Encounter mirror before publication', async () => {
    const { actionId, published } = reset({ current: 4 })
    configureMaintainedRecurringActiveEffect(actionId)
    state.thirdMechanics = {
      ...state.mechanics,
      projectionChecksum: '1'.repeat(64),
      commandState: {
        ...state.mechanics.commandState,
        state: { hitpoints: { current: 6, temp: 0 } }
      }
    }
    state.thirdOverlay = {
      ...state.overlay,
      projectionChecksum: '2'.repeat(64)
    }
    state.encounter.actors.push({
      id: ids.thirdActor,
      kind: 'CHARACTER',
      sourceId: ids.thirdCharacter,
      sourceRevision: 3,
      systemId: ids.system,
      currentHitPoints: 6,
      tempHitPoints: 0,
      maxHitPoints: 10,
      conditions: []
    })
    seedMaintainedReplacement(ids.maintenanceDefinition, [
      maintainedCharacterDependent(ids.priorCharacterEffect, ids.character, 1),
      maintainedCharacterDependent(ids.priorThirdCharacterEffect, ids.thirdCharacter, 1),
      maintainedActorDependent(ids.priorEncounterEffect, ids.actor)
    ])

    await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime: createDnd5eCharacterActionRuntime({
        continuationIntegrityKey: new Uint8Array(32).fill(7),
        definitions: { requireCurrent: async () => published }
      }),
      createActiveEffectId: () => '00000000-0000-4000-8000-000000000011',
      command: command(actionId)
    })

    expect(state.assignmentLocks).toEqual([ids.character, ids.thirdCharacter])
    expect(state.calls.deleteActiveRuleEffect.mock.calls.map(([input]) => input.id)).toEqual([
      ids.priorCharacterEffect,
      ids.priorThirdCharacterEffect,
      ids.priorEncounterEffect
    ])
    expect(
      state.calls.patchSheetState.mock.calls.filter(
        ([characterId]) => characterId === ids.thirdCharacter
      )
    ).toHaveLength(1)
    const thirdMirrorCall = state.calls.updateActor.mock.calls.find(
      ([actor]) => (actor as Record<string, unknown>).id === ids.thirdActor
    )
    if (!thirdMirrorCall) throw new Error('Expected the third Character mirror to be updated.')
    expect(thirdMirrorCall[0]).toMatchObject({ sourceRevision: 4 })
    const thirdMirrorIndex = state.calls.updateActor.mock.calls.indexOf(thirdMirrorCall)
    expect(state.calls.updateActor.mock.invocationCallOrder[thirdMirrorIndex]!).toBeLessThan(
      state.calls.publishEncounter.mock.invocationCallOrder[0]!
    )
    const resultPayload = state.receipts.get(`${ids.encounter}:${ids.command}`)?.resultPayload
    if (!resultPayload) throw new Error('Expected a stored rule-action result payload.')
    const output = (resultPayload as Record<string, Record<string, unknown>>).applicationOutputs
    expect(output.maintenanceTransition).toMatchObject({
      characterOwnerTransitions: [
        {
          characterId: ids.character,
          beforeStreamVersion: 3,
          afterStreamVersion: 4
        },
        {
          characterId: ids.thirdCharacter,
          beforeStreamVersion: 3,
          afterStreamVersion: 4
        }
      ],
      removedDependentEffects: [
        { activeEffectId: ids.priorCharacterEffect },
        { activeEffectId: ids.priorThirdCharacterEffect },
        { activeEffectId: ids.priorEncounterEffect }
      ]
    })
  })

  it('does not replace a maintained state owned by a different definition', async () => {
    const { actionId, published } = reset({ current: 4 })
    configureMaintainedRecurringActiveEffect(actionId)
    seedMaintainedReplacement(ids.otherMaintenanceDefinition, [
      maintainedCharacterDependent(ids.priorCharacterEffect, ids.character)
    ])

    await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime: createDnd5eCharacterActionRuntime({
        continuationIntegrityKey: new Uint8Array(32).fill(7),
        definitions: { requireCurrent: async () => published }
      }),
      createActiveEffectId: () => '00000000-0000-4000-8000-000000000011',
      command: command(actionId)
    })

    expect(state.calls.deleteActiveRuleEffect).not.toHaveBeenCalled()
    expect(state.calls.deleteMaintainedState).not.toHaveBeenCalled()
    expect(
      state.maintainedStates.has(`${ids.encounter}:${ids.actor}:${ids.otherMaintenanceDefinition}`)
    ).toBe(true)
  })

  it('rejects a changed locked maintained dependency before terminal receipt or mutation', async () => {
    const { actionId, published } = reset({ current: 4 })
    configureMaintainedRecurringActiveEffect(actionId)
    seedMaintainedReplacement(ids.maintenanceDefinition, [
      maintainedCharacterDependent(ids.priorCharacterEffect, ids.character)
    ])
    state.calls.lockDependentEffects.mockResolvedValueOnce([
      {
        ...state.maintainedDependents[0],
        version: 2
      }
    ])

    await expect(
      executeEncounterCharacterRuleAction({
        db: {} as never,
        runtime: createDnd5eCharacterActionRuntime({
          continuationIntegrityKey: new Uint8Array(32).fill(7),
          definitions: { requireCurrent: async () => published }
        }),
        command: command(actionId)
      })
    ).rejects.toThrow('Maintained effect dependencies changed before Character locks')
    expect(state.calls.deleteActiveRuleEffect).not.toHaveBeenCalled()
    expect(state.calls.createMaintainedState).not.toHaveBeenCalled()
    expect(state.receipts).toHaveLength(0)
    expect(state.encounterEvents).toHaveLength(0)
  })

  it('replays a valid maintained result before runtime, maintenance, Character, or effect work', async () => {
    const { actionId, published } = reset({ current: 4 })
    configureMaintainedRecurringActiveEffect(actionId)
    const runtime = createDnd5eCharacterActionRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(7),
      definitions: { requireCurrent: async () => published }
    })
    const first = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      createActiveEffectId: () => '00000000-0000-4000-8000-000000000011',
      command: command(actionId)
    })
    const calls = {
      runtime: state.calls.runtime.mock.calls.length,
      definition: state.calls.requireMaintenanceDefinition.mock.calls.length,
      maintained: state.calls.createMaintainedState.mock.calls.length,
      effect: state.calls.createActiveRuleEffect.mock.calls.length,
      character: state.calls.patchSheetState.mock.calls.length
    }

    expect(
      await executeEncounterCharacterRuleAction({
        db: {} as never,
        runtime,
        command: command(actionId)
      })
    ).toEqual(first)
    expect(state.calls.runtime).toHaveBeenCalledTimes(calls.runtime)
    expect(state.calls.requireMaintenanceDefinition).toHaveBeenCalledTimes(calls.definition)
    expect(state.calls.createMaintainedState).toHaveBeenCalledTimes(calls.maintained)
    expect(state.calls.createActiveRuleEffect).toHaveBeenCalledTimes(calls.effect)
    expect(state.calls.patchSheetState).toHaveBeenCalledTimes(calls.character)
  })

  it.each([
    'event fingerprint',
    'event version',
    'stored result checksum',
    'maintenance created dependency'
  ])('rejects a tampered maintained replay %s without mutation', async (tamper) => {
    const { actionId, published } = reset({ current: 4 })
    configureMaintainedRecurringActiveEffect(actionId)
    const runtime = createDnd5eCharacterActionRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(7),
      definitions: { requireCurrent: async () => published }
    })
    await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      createActiveEffectId: () => '00000000-0000-4000-8000-000000000011',
      command: command(actionId)
    })
    const event = state.encounterEvents.get(ids.command)!
    const receipt = state.receipts.get(`${ids.encounter}:${ids.command}`)!
    if (tamper === 'event fingerprint') event.commandFingerprint = 'f'.repeat(64)
    if (tamper === 'event version') event.version = 999
    if (tamper === 'stored result checksum') {
      const result = receipt.resultPayload as Record<string, unknown>
      result.evidence = {
        ...(result.evidence as Record<string, unknown>),
        outputs: { forged: true }
      }
    }
    if (tamper === 'maintenance created dependency') {
      const outputs = (receipt.resultPayload as Record<string, Record<string, unknown>>)
        .applicationOutputs
      ;(outputs.maintenanceTransition as Record<string, unknown>).createdDependentEffectIds = [
        ids.priorCharacterEffect
      ]
    }

    await expect(
      executeEncounterCharacterRuleAction({
        db: {} as never,
        runtime,
        command: command(actionId)
      })
    ).rejects.toThrow()
    expect(state.calls.createMaintainedState).toHaveBeenCalledTimes(1)
    expect(state.calls.createActiveRuleEffect).toHaveBeenCalledTimes(1)
  })

  it.each(['OFF', 'SUBTLE'] as const)(
    'does not load or mutate maintenance state for Manual %s actions',
    async (manualReminderMode) => {
      const { actionId, published } = reset({ current: 4 })
      configureMaintainedRecurringActiveEffect(actionId)
      state.encounter = {
        ...state.encounter,
        automationMode: 'MANUAL',
        manualReminderMode
      }

      await executeEncounterCharacterRuleAction({
        db: {} as never,
        runtime: createDnd5eCharacterActionRuntime({
          continuationIntegrityKey: new Uint8Array(32).fill(7),
          definitions: { requireCurrent: async () => published }
        }),
        command: command(actionId)
      })

      expect(state.calls.requireMaintenanceDefinition).not.toHaveBeenCalled()
      expect(state.calls.findMaintainedState).not.toHaveBeenCalled()
      expect(state.calls.lockMaintainedState).not.toHaveBeenCalled()
      expect(state.calls.createMaintainedState).not.toHaveBeenCalled()
      expect(state.calls.createActiveRuleEffect).not.toHaveBeenCalled()
    }
  )

  it('does not create a recurring active effect in Manual mode', async () => {
    const { actionId, published } = reset({ current: 4 })
    configureRecurringActiveEffect(actionId)
    state.encounter = { ...state.encounter, automationMode: 'MANUAL' }
    const createActiveEffectId = vi.fn()

    const result = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime: createDnd5eCharacterActionRuntime({
        continuationIntegrityKey: new Uint8Array(32).fill(7),
        definitions: { requireCurrent: async () => published }
      }),
      createActiveEffectId,
      command: command(actionId)
    })

    expect(result).toMatchObject({ status: 'MANUAL' })
    expect(createActiveEffectId).not.toHaveBeenCalled()
    expect(state.calls.createActiveRuleEffect).not.toHaveBeenCalled()
    expect(state.calls.runtime).not.toHaveBeenCalled()
  })

  it.each([
    [
      'authored Effect identity',
      (transition: Record<string, unknown>) => {
        transition.authoredEffectId = '00000000-0000-4000-8000-000000000099'
      }
    ],
    [
      'compiled result-block identity',
      (transition: Record<string, unknown>) => {
        transition.compiledEntryId = '00000000-0000-4000-8000-000000000099'
      }
    ],
    [
      'frozen graph node identity',
      (transition: Record<string, unknown>) => {
        transition.frozenGraphNodeId = 'forged'
      }
    ],
    [
      'frozen source checksum',
      (transition: Record<string, unknown>) => {
        transition.frozenSourceChecksum = 'f'.repeat(64)
      }
    ],
    [
      'capability contract version',
      (transition: Record<string, unknown>) => {
        transition.capabilityContractVersion = 2
      }
    ],
    [
      'multiple active-effect creates',
      (transition: Record<string, unknown>, outputs: Record<string, unknown>) => {
        outputs.activeEffectTransitions = [transition, structuredClone(transition)]
      }
    ]
  ])('rejects a stored active-effect receipt with a forged %s', async (_label, mutate) => {
    const { actionId, published } = reset({ current: 4 })
    configureRecurringActiveEffect(actionId)
    const runtime = createDnd5eCharacterActionRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(7),
      definitions: { requireCurrent: async () => published }
    })

    await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      createActiveEffectId: () => '00000000-0000-4000-8000-000000000011',
      command: command(actionId)
    })
    const resultPayload = state.receipts.get(`${ids.encounter}:${ids.command}`)
      ?.resultPayload as Record<string, unknown>
    const outputs = resultPayload.applicationOutputs as Record<string, unknown>
    const transition = structuredClone(
      (outputs.activeEffectTransitions as Array<Record<string, unknown>>)[0]!
    )
    mutate(transition, outputs)
    if (
      !outputs.activeEffectTransitions ||
      (outputs.activeEffectTransitions as Array<unknown>).length === 1
    )
      outputs.activeEffectTransitions = [transition]

    await expect(
      executeEncounterCharacterRuleAction({
        db: {} as never,
        runtime,
        command: command(actionId)
      })
    ).rejects.toThrow('Stored rule-execution receipt has an invalid result shape')
    expect(state.calls.createActiveRuleEffect).toHaveBeenCalledTimes(1)
  })

  it('rejects a stored CREATE receipt with two source entries bound to one node', async () => {
    const { actionId, published } = reset({ current: 4 })
    configureRecurringActiveEffect(actionId)
    const runtime = createDnd5eCharacterActionRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(7),
      definitions: { requireCurrent: async () => published }
    })

    await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      createActiveEffectId: () => '00000000-0000-4000-8000-000000000011',
      command: command(actionId)
    })
    const resultPayload = state.receipts.get(`${ids.encounter}:${ids.command}`)?.resultPayload as {
      evidence: Record<string, unknown>
    }
    const bindings = resultPayload.evidence.sourceEntryBindings as Array<Record<string, unknown>>
    resultPayload.evidence.sourceEntryBindings = [
      ...bindings,
      {
        sourceEntryId: '00000000-0000-4000-8000-000000000099',
        nodeId: 'heal'
      }
    ]

    await expect(
      executeEncounterCharacterRuleAction({
        db: {} as never,
        runtime,
        command: command(actionId)
      })
    ).rejects.toThrow('Stored rule-execution receipt has an invalid result shape')
  })

  it('resumes an Assisted attack with server dice exactly once and replays before RNG or writes', async () => {
    const { actionId } = reset({ current: 10 })
    state.encounter = { ...state.encounter, automationMode: 'ASSISTED' }
    configureUnlimitedSingleCharacterTarget()
    const published = publishedAttack()
    const entry = state.mechanics.compiledActionEntryPoints[0] as {
      compilation: { published: unknown }
    }
    entry.compilation.published = published
    const decisions = state.overlay.rulePolicyOutput.actionDecisions as Array<
      Record<string, unknown>
    >
    decisions[0] = {
      ...decisions[0],
      mechanic: { attackBonus: 5, attackRollMode: 'ADVANTAGE', save: null }
    }
    ;(
      state.mechanics.rulePolicyOutput as {
        actionDecisions: Array<Record<string, unknown>>
      }
    ).actionDecisions[0] = decisions[0]!
    ;(state.targetOverlay!.rulePolicyOutput.derivedStats as Record<string, unknown>).armorClass = {
      effective: 17
    }
    ;(state.overlay.rulePolicyOutput as Record<string, unknown>).rollContributorEvidence = {
      attacks: {
        MELEE: [
          {
            sourceId: ids.effect,
            grantId: ids.action,
            domainKey: 'flanking',
            influence: 'ADVANTAGE'
          }
        ]
      }
    }
    const runtime = createDnd5eCharacterActionRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(1),
      definitions: { requireCurrent: async () => published }
    })
    const rollD20 = vi.fn().mockReturnValueOnce(12).mockReturnValueOnce(18)
    const pending = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      rollD20,
      command: command(actionId, { targetActorId: ids.targetActor })
    })
    if (pending.status !== 'PENDING') throw new Error('Expected an Assisted action pause.')
    const resumeCommand = {
      actorUserId: ids.user,
      commandId: '00000000-0000-4000-8000-000000000099',
      correlationId: null,
      encounterId: ids.encounter,
      expectedEncounterVersion: 5,
      expectedOccurrenceVersion: pending.occurrenceVersion,
      occurrenceId: pending.occurrenceId,
      resolution: {
        kind: 'SYSTEM',
        requestId: assistedD20Request(pending).requestId
      }
    }
    const complete = await resumeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      rollD20,
      command: resumeCommand
    })
    const runtimeCalls = state.calls.runtime.mock.calls.length
    const replay = await resumeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      rollD20,
      command: resumeCommand
    })
    expect(complete.status).toBe('COMPLETE')
    expect(replay).toEqual(complete)
    expect(rollD20).toHaveBeenCalledTimes(2)
    expect(state.calls.runtime).toHaveBeenCalledTimes(runtimeCalls)
    expect(state.calls.patchSheetState).toHaveBeenCalledTimes(1)
    expect(
      state.receipts.get(`${ids.encounter}:${resumeCommand.commandId}`)?.resultPayload
    ).toMatchObject({
      applicationOutputs: { d20: { rawFaces: [12, 18], selectedNatural: 18 } }
    })
  })

  it('rejects invalid Assisted physical d20 faces before applying an action', async () => {
    const { actionId } = reset({ current: 10 })
    state.encounter = { ...state.encounter, automationMode: 'ASSISTED' }
    configureUnlimitedSingleCharacterTarget()
    const published = publishedAttack()
    const entry = state.mechanics.compiledActionEntryPoints[0] as {
      compilation: { published: unknown }
    }
    entry.compilation.published = published
    const decisions = state.overlay.rulePolicyOutput.actionDecisions as Array<
      Record<string, unknown>
    >
    decisions[0] = {
      ...decisions[0],
      mechanic: { attackBonus: 5, attackRollMode: 'ADVANTAGE', save: null }
    }
    ;(
      state.mechanics.rulePolicyOutput as {
        actionDecisions: Array<Record<string, unknown>>
      }
    ).actionDecisions[0] = decisions[0]!
    ;(state.targetOverlay!.rulePolicyOutput.derivedStats as Record<string, unknown>).armorClass = {
      effective: 17
    }
    const runtime = createDnd5eCharacterActionRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(1),
      definitions: { requireCurrent: async () => published }
    })
    const pending = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      command: command(actionId, { targetActorId: ids.targetActor })
    })
    if (pending.status !== 'PENDING') throw new Error('Expected an Assisted action pause.')
    await expect(
      resumeEncounterCharacterRuleAction({
        db: {} as never,
        runtime,
        command: {
          actorUserId: ids.user,
          commandId: '00000000-0000-4000-8000-000000000098',
          correlationId: null,
          encounterId: ids.encounter,
          expectedEncounterVersion: 5,
          expectedOccurrenceVersion: pending.occurrenceVersion,
          occurrenceId: pending.occurrenceId,
          resolution: {
            kind: 'PHYSICAL',
            requestId: assistedD20Request(pending).requestId,
            rawFaces: [20, 0]
          }
        }
      })
    ).rejects.toThrow()
    expect(state.calls.patchSheetState).not.toHaveBeenCalled()
  })

  it('resumes an Assisted normal attack from exact physical dice without server RNG', async () => {
    const { actionId } = reset({ current: 10 })
    state.encounter = { ...state.encounter, automationMode: 'ASSISTED' }
    configureUnlimitedSingleCharacterTarget()
    const published = publishedAttack()
    const entry = state.mechanics.compiledActionEntryPoints[0] as {
      compilation: { published: unknown }
    }
    entry.compilation.published = published
    const decisions = state.overlay.rulePolicyOutput.actionDecisions as Array<
      Record<string, unknown>
    >
    decisions[0] = {
      ...decisions[0],
      mechanic: { attackBonus: 5, attackRollMode: 'NORMAL', save: null }
    }
    ;(
      state.mechanics.rulePolicyOutput as {
        actionDecisions: Array<Record<string, unknown>>
      }
    ).actionDecisions[0] = decisions[0]!
    ;(state.targetOverlay!.rulePolicyOutput.derivedStats as Record<string, unknown>).armorClass = {
      effective: 10
    }
    const runtime = createDnd5eCharacterActionRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(1),
      definitions: { requireCurrent: async () => published }
    })
    const rollD20 = vi.fn()
    const pending = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      rollD20,
      command: command(actionId, { targetActorId: ids.targetActor })
    })
    if (pending.status !== 'PENDING') throw new Error('Expected an Assisted action pause.')
    const complete = await resumeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      rollD20,
      command: {
        actorUserId: ids.user,
        commandId: '00000000-0000-4000-8000-000000000096',
        correlationId: null,
        encounterId: ids.encounter,
        expectedEncounterVersion: 5,
        expectedOccurrenceVersion: pending.occurrenceVersion,
        occurrenceId: pending.occurrenceId,
        resolution: {
          kind: 'PHYSICAL',
          requestId: assistedD20Request(pending).requestId,
          rawFaces: [20]
        }
      }
    })
    expect(complete).toMatchObject({ status: 'COMPLETE' })
    expect(rollD20).not.toHaveBeenCalled()
    expect(state.calls.patchSheetState).toHaveBeenCalledTimes(1)
  })

  it('rejects an Assisted resume after an overlay-only mechanics change', async () => {
    const { actionId } = reset({ current: 10 })
    state.encounter = { ...state.encounter, automationMode: 'ASSISTED' }
    configureUnlimitedSingleCharacterTarget()
    const published = publishedAttack()
    const entry = state.mechanics.compiledActionEntryPoints[0] as {
      compilation: { published: unknown }
    }
    entry.compilation.published = published
    const decisions = state.overlay.rulePolicyOutput.actionDecisions as Array<
      Record<string, unknown>
    >
    decisions[0] = {
      ...decisions[0],
      mechanic: { attackBonus: 5, attackRollMode: 'NORMAL', save: null }
    }
    ;(
      state.mechanics.rulePolicyOutput as {
        actionDecisions: Array<Record<string, unknown>>
      }
    ).actionDecisions[0] = decisions[0]!
    ;(state.targetOverlay!.rulePolicyOutput.derivedStats as Record<string, unknown>).armorClass = {
      effective: 10
    }
    const runtime = createDnd5eCharacterActionRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(1),
      definitions: { requireCurrent: async () => published }
    })
    const rollD20 = vi.fn().mockReturnValue(15)
    const pending = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      rollD20,
      command: command(actionId, { targetActorId: ids.targetActor })
    })
    if (pending.status !== 'PENDING') throw new Error('Expected an Assisted action pause.')
    const runtimeCalls = state.calls.runtime.mock.calls.length
    const writes = state.calls.patchSheetState.mock.calls.length
    state.overlay = {
      ...state.overlay,
      mechanicalContextChecksum: 'f'.repeat(64)
    }
    await expect(
      resumeEncounterCharacterRuleAction({
        db: {} as never,
        runtime,
        rollD20,
        command: {
          actorUserId: ids.user,
          commandId: '00000000-0000-4000-8000-000000000097',
          correlationId: null,
          encounterId: ids.encounter,
          expectedEncounterVersion: 5,
          expectedOccurrenceVersion: pending.occurrenceVersion,
          occurrenceId: pending.occurrenceId,
          resolution: {
            kind: 'SYSTEM',
            requestId: assistedD20Request(pending).requestId
          }
        }
      })
    ).rejects.toThrow()
    expect(rollD20).not.toHaveBeenCalled()
    expect(state.calls.runtime).toHaveBeenCalledTimes(runtimeCalls)
    expect(state.calls.patchSheetState).toHaveBeenCalledTimes(writes)
    expect(state.occurrences.get(pending.occurrenceId)).toMatchObject({
      state: 'PENDING'
    })
  })

  it('locks source and target assignments in sorted, deduplicated order', async () => {
    const { actionId } = reset({ current: 10 })
    configureUnlimitedSingleCharacterTarget()
    await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime: { executeResolved: state.calls.runtime } as never,
      command: command(actionId, { targetActorId: ids.targetActor })
    })
    expect(state.assignmentLocks).toEqual([ids.character, ids.targetCharacter])
    expect(new Set(state.assignmentLocks).size).toBe(state.assignmentLocks.length)
    expect(state.assignmentLocks).toEqual([...state.assignmentLocks].sort())
  })

  it('applies natural-twenty ON_HIT then ON_CRIT in authored order with one target patch and event', async () => {
    const { actionId } = reset({ current: 10 })
    configureUnlimitedSingleCharacterTarget()
    state.targetMechanics!.commandState.state.hitpoints = {
      current: 10,
      temp: 0
    }
    state.encounter.actors = state.encounter.actors.map((actor) =>
      actor.id === ids.targetActor ? { ...actor, currentHitPoints: 10, tempHitPoints: 0 } : actor
    )
    configureResourceBoundAction()
    const published = publishedAttack(true, ids.condition)
    const entry = state.mechanics.compiledActionEntryPoints[0] as {
      compilation: { published: unknown }
    }
    entry.compilation.published = published
    const decisions = state.overlay.rulePolicyOutput.actionDecisions as Array<
      Record<string, unknown>
    >
    decisions[0] = {
      ...decisions[0],
      mechanic: { attackBonus: 5, attackRollMode: 'NORMAL', save: null }
    }
    ;(
      state.mechanics.rulePolicyOutput as {
        actionDecisions: Array<Record<string, unknown>>
      }
    ).actionDecisions[0] = decisions[0]!
    ;(state.targetOverlay!.rulePolicyOutput.derivedStats as Record<string, unknown>).armorClass = {
      effective: 17
    }
    const vocabulary = {
      systemId: ids.system,
      snapshotVersion: 1,
      checksum: 'v'.repeat(64),
      document: { conditionTypes: [{ id: ids.condition, label: 'Poisoned' }] }
    }
    state.vocabularySnapshot = vocabulary
    for (const mechanics of [state.mechanics, state.targetMechanics!] as Array<
      Record<string, unknown>
    >) {
      mechanics.systemVocabularySnapshotId = ids.effect
      mechanics.systemVocabularySnapshotVersion = 1
      mechanics.systemVocabularySnapshotChecksum = vocabulary.checksum
    }
    const runtime = createDnd5eCharacterActionRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(4),
      definitions: { requireCurrent: async () => published }
    })
    const first = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      rollD20: () => 20,
      command: command(actionId, { targetActorId: ids.targetActor })
    })
    expect(first).toMatchObject({
      applications: [
        { ordinal: 0, outcomeKind: 'DAMAGE', appliedAmount: 4 },
        { ordinal: 1, outcomeKind: 'CONDITION_APPLY', applied: true }
      ]
    })
    const receipt = state.receipts.get(`${ids.encounter}:${ids.command}`)
    expect(receipt?.resultPayload).toMatchObject({
      applicationOutputs: {
        applications: [
          { ordinal: 0, requestedAmount: 4, appliedAmount: 4 },
          {
            ordinal: 1,
            kind: 'CONDITION_APPLY',
            conditionId: ids.condition,
            applied: true
          }
        ]
      }
    })
    const replay = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      rollD20: () => 1,
      command: command(actionId, { targetActorId: ids.targetActor })
    })
    expect(replay).toEqual(first)
    expect(state.calls.setResourceUsage).toHaveBeenCalledTimes(1)
    expect(state.calls.patchSheetState).toHaveBeenCalledTimes(2)
    expect(state.calls.appendCharacterEvent).toHaveBeenCalledTimes(1)

    const resultPayload = receipt?.resultPayload as Record<string, unknown>
    const outputs = resultPayload.applicationOutputs as Record<string, unknown>
    ;(outputs.applications as Array<Record<string, unknown>>).splice(1, 1)
    await expect(
      executeEncounterCharacterRuleAction({
        db: {} as never,
        runtime,
        rollD20: () => 1,
        command: command(actionId, { targetActorId: ids.targetActor })
      })
    ).rejects.toThrow('Stored rule-execution receipt has an invalid result shape')
    expect(state.calls.setResourceUsage).toHaveBeenCalledTimes(1)
    expect(state.calls.patchSheetState).toHaveBeenCalledTimes(2)
  })

  it('fails closed before child concentration work when one action applies damage and a condition', async () => {
    const { actionId } = reset({ current: 10 })
    configureUnlimitedSingleCharacterTarget()
    const published = publishedAttack(true, ids.condition)
    const entry = state.mechanics.compiledActionEntryPoints[0] as {
      compilation: { published: unknown }
    }
    entry.compilation.published = published
    const decisions = state.overlay.rulePolicyOutput.actionDecisions as Array<
      Record<string, unknown>
    >
    decisions[0] = {
      ...decisions[0],
      mechanic: { attackBonus: 5, attackRollMode: 'NORMAL', save: null }
    }
    ;(
      state.mechanics.rulePolicyOutput as {
        actionDecisions: Array<Record<string, unknown>>
      }
    ).actionDecisions[0] = decisions[0]!
    ;(state.targetOverlay!.rulePolicyOutput.derivedStats as Record<string, unknown>).armorClass = {
      effective: 10
    }
    state.vocabularySnapshot = {
      snapshotId: ids.effect,
      systemId: ids.system,
      snapshotVersion: 1,
      checksum: 'c'.repeat(64),
      document: {
        abilities: [{ id: DND5E_CONSTITUTION_ABILITY_DEFINITION_ID }],
        conditionTypes: [{ id: ids.condition, label: 'Poisoned' }]
      }
    }
    seedMaintainedReplacement(DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID)
    const concentrationState = state.maintainedStates.get(
      `${ids.encounter}:${ids.actor}:${DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID}`
    )!
    state.maintainedStates.delete(
      `${ids.encounter}:${ids.actor}:${DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID}`
    )
    concentrationState.ownerActorId = ids.targetActor
    state.maintainedStates.set(
      `${ids.encounter}:${ids.targetActor}:${DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID}`,
      concentrationState
    )
    const concentration = createDnd5eConcentrationCheckDefinition()
    const runtime = createDnd5eCharacterActionRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(15),
      definitions: {
        requireCurrent: async (id) => (id === concentration.id ? concentration : published)
      }
    })
    const rollD20 = vi.fn(() => 20)

    await expect(
      executeEncounterCharacterRuleAction({
        db: {} as never,
        runtime,
        rollD20,
        command: command(actionId, { targetActorId: ids.targetActor })
      })
    ).rejects.toThrow(
      'Automatic concentration cannot prospectively evaluate a condition applied by the same action.'
    )

    expect(rollD20).toHaveBeenCalledTimes(1)
    // The parent occurrence begins before its completion applicator; no child
    // concentration occurrence may be created after this fail-closed check.
    expect(state.occurrences).toHaveLength(1)
    expect(
      [...state.occurrences.values()].some((occurrence) => occurrence.rootCommandId !== ids.command)
    ).toBe(false)
    expect(state.calls.deleteMaintainedState).not.toHaveBeenCalled()
    expect(state.calls.patchSheetState).not.toHaveBeenCalled()
    expect(state.calls.appendEncounterEvent).not.toHaveBeenCalled()
  })

  it('binds the locked target save modifier and applies an authorized condition failure branch', async () => {
    const { actionId } = reset()
    configureUnlimitedSingleCharacterTarget()
    const published = publishedSave(ids.condition)
    const entry = state.mechanics.compiledActionEntryPoints[0] as {
      compilation: { published: unknown }
    }
    entry.compilation.published = published
    const decisions = state.overlay.rulePolicyOutput.actionDecisions as Array<
      Record<string, unknown>
    >
    decisions[0] = {
      ...decisions[0],
      mechanic: {
        attackBonus: null,
        attackRollMode: null,
        save: {
          abilityDefinitionId: '00000000-0000-0000-0011-000200000000',
          dc: 15
        }
      }
    }
    ;(
      state.mechanics.rulePolicyOutput as {
        actionDecisions: Array<Record<string, unknown>>
      }
    ).actionDecisions[0] = decisions[0]!
    ;(state.targetOverlay!.rulePolicyOutput as Record<string, unknown>).rollModes = {
      savingThrows: { DEXTERITY: 'DISADVANTAGE' }
    }
    ;(state.targetOverlay!.rulePolicyOutput.derivedStats as Record<string, unknown>).savingThrows =
      [{ abilityId: 'DEXTERITY', total: { effective: 3 } }]
    ;(state.targetOverlay!.rulePolicyOutput as Record<string, unknown>).rollContributorEvidence = {
      savingThrows: {
        DEXTERITY: [
          {
            sourceId: ids.condition,
            grantId: null,
            domainKey: 'frightened',
            influence: 'DISADVANTAGE'
          }
        ]
      }
    }
    state.targetOverlay!.rulePolicyOutput.savingThrowDefinitions = [
      {
        abilityDefinitionId: '00000000-0000-0000-0011-000200000000',
        modifier: 3,
        rollMode: 'DISADVANTAGE',
        contributors: [
          {
            sourceId: ids.condition,
            grantId: null,
            domainKey: 'frightened',
            influence: 'DISADVANTAGE'
          }
        ]
      }
    ]
    const vocabulary = {
      systemId: ids.system,
      snapshotVersion: 1,
      checksum: 'v'.repeat(64),
      document: { conditionTypes: [{ id: ids.condition, label: 'Poisoned' }] }
    }
    state.vocabularySnapshot = vocabulary
    for (const mechanics of [state.mechanics, state.targetMechanics!] as Array<
      Record<string, unknown>
    >) {
      mechanics.systemVocabularySnapshotId = ids.effect
      mechanics.systemVocabularySnapshotVersion = 1
      mechanics.systemVocabularySnapshotChecksum = vocabulary.checksum
    }
    const runtime = createDnd5eCharacterActionRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(2),
      definitions: { requireCurrent: async () => published }
    })
    const rollD20 = vi.fn().mockReturnValueOnce(18).mockReturnValueOnce(1)
    await expect(
      executeEncounterCharacterRuleAction({
        db: {} as never,
        runtime,
        rollD20,
        command: command(actionId, { targetActorId: ids.targetActor })
      })
    ).resolves.toMatchObject({
      applications: [
        expect.objectContaining({
          outcomeKind: 'CONDITION_APPLY',
          applied: true
        })
      ]
    })
    expect(rollD20).toHaveBeenCalledTimes(2)
    expect(state.calls.patchSheetState).toHaveBeenCalledTimes(1)
    expect(state.receipts.get(`${ids.encounter}:${ids.command}`)?.resultPayload).toMatchObject({
      applicationOutputs: {
        d20: {
          rollMode: 'DISADVANTAGE',
          rawFaces: [18, 1],
          selectedNatural: 1,
          modifier: 3,
          total: 4,
          defenseOrDc: 15,
          contributors: [
            {
              sourceId: ids.condition,
              grantId: null,
              domainKey: 'frightened',
              influence: 'DISADVANTAGE'
            }
          ]
        }
      }
    })
  })

  it('settles a normal successful save with no authorized application or target Character write', async () => {
    const { actionId } = reset()
    configureUnlimitedSingleCharacterTarget()
    const published = publishedSave()
    const entry = state.mechanics.compiledActionEntryPoints[0] as {
      compilation: { published: unknown }
    }
    entry.compilation.published = published
    const decisions = state.overlay.rulePolicyOutput.actionDecisions as Array<
      Record<string, unknown>
    >
    decisions[0] = {
      ...decisions[0],
      mechanic: {
        attackBonus: null,
        attackRollMode: null,
        save: {
          abilityDefinitionId: '00000000-0000-0000-0011-000200000000',
          dc: 15
        }
      }
    }
    ;(
      state.mechanics.rulePolicyOutput as {
        actionDecisions: Array<Record<string, unknown>>
      }
    ).actionDecisions[0] = decisions[0]!
    ;(state.targetOverlay!.rulePolicyOutput.derivedStats as Record<string, unknown>).savingThrows =
      [{ abilityId: 'DEXTERITY', total: { effective: 3 } }]
    ;(state.targetOverlay!.rulePolicyOutput as Record<string, unknown>).rollModes = {
      savingThrows: { DEXTERITY: 'NORMAL' }
    }
    state.targetOverlay!.rulePolicyOutput.savingThrowDefinitions = [
      {
        abilityDefinitionId: '00000000-0000-0000-0011-000200000000',
        modifier: 3,
        rollMode: 'NORMAL',
        contributors: []
      }
    ]
    const runtime = createDnd5eCharacterActionRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(3),
      definitions: { requireCurrent: async () => published }
    })
    const rollD20 = vi.fn().mockReturnValueOnce(12)
    await expect(
      executeEncounterCharacterRuleAction({
        db: {} as never,
        runtime,
        rollD20,
        command: command(actionId, { targetActorId: ids.targetActor })
      })
    ).resolves.toMatchObject({ applications: [] })
    expect(rollD20).toHaveBeenCalledTimes(1)
    expect(state.calls.patchSheetState).not.toHaveBeenCalled()
    expect(state.calls.appendCharacterEvent).not.toHaveBeenCalled()
    expect(state.calls.updateActor).not.toHaveBeenCalled()
    expect(state.calls.publishEncounter).toHaveBeenCalledTimes(1)
    expect(state.calls.appendEncounterEvent).toHaveBeenCalledTimes(1)
    expect(state.receipts.get(`${ids.encounter}:${ids.command}`)?.resultPayload).toMatchObject({
      applicationOutputs: {
        kind: 'CHARACTER_MECHANICS_BATCH',
        targetCharacterStreamVersion: null,
        applications: [],
        d20: {
          rollMode: 'NORMAL',
          rawFaces: [12],
          selectedNatural: 12,
          modifier: 3,
          total: 15,
          defenseOrDc: 15,
          contributors: []
        }
      }
    })
  })

  it('consumes a resource once for a zero-application save and replays without target writes', async () => {
    const { actionId } = reset()
    configureUnlimitedSingleCharacterTarget()
    configureResourceBoundAction()
    const published = publishedSave()
    const entry = state.mechanics.compiledActionEntryPoints[0] as {
      compilation: { published: unknown }
    }
    entry.compilation.published = published
    const decisions = state.overlay.rulePolicyOutput.actionDecisions as Array<
      Record<string, unknown>
    >
    decisions[0] = {
      ...decisions[0],
      mechanic: {
        attackBonus: null,
        attackRollMode: null,
        save: {
          abilityDefinitionId: '00000000-0000-0000-0011-000200000000',
          dc: 15
        }
      }
    }
    ;(
      state.mechanics.rulePolicyOutput as {
        actionDecisions: Array<Record<string, unknown>>
      }
    ).actionDecisions[0] = decisions[0]!
    ;(state.targetOverlay!.rulePolicyOutput.derivedStats as Record<string, unknown>).savingThrows =
      [{ abilityId: 'DEXTERITY', total: { effective: 3 } }]
    ;(state.targetOverlay!.rulePolicyOutput as Record<string, unknown>).rollModes = {
      savingThrows: { DEXTERITY: 'NORMAL' }
    }
    state.targetOverlay!.rulePolicyOutput.savingThrowDefinitions = [
      {
        abilityDefinitionId: '00000000-0000-0000-0011-000200000000',
        modifier: 3,
        rollMode: 'NORMAL',
        contributors: []
      }
    ]
    const runtime = createDnd5eCharacterActionRuntime({
      continuationIntegrityKey: new Uint8Array(32).fill(5),
      definitions: { requireCurrent: async () => published }
    })
    const first = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      rollD20: () => 12,
      command: command(actionId, { targetActorId: ids.targetActor })
    })
    const replay = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime,
      rollD20: () => 1,
      command: command(actionId, { targetActorId: ids.targetActor })
    })
    expect(first).toMatchObject({ applications: [] })
    expect(replay).toEqual(first)
    expect(state.calls.setResourceUsage).toHaveBeenCalledTimes(1)
    expect(state.calls.patchSheetState).toHaveBeenCalledTimes(1)
    expect(state.calls.appendCharacterEvent).not.toHaveBeenCalled()
    expect(state.calls.updateActor).toHaveBeenCalledWith(
      expect.objectContaining({ id: ids.actor, sourceRevision: 4 })
    )
    expect(state.calls.publishEncounter).toHaveBeenCalledTimes(1)
    expect(state.calls.appendEncounterEvent).toHaveBeenCalledTimes(1)
  })

  it('applies an unlimited ANY single-target action to an offline cross-owner Character without exposing target Sheet state', async () => {
    const { actionId } = reset()
    configureUnlimitedSingleCharacterTarget()

    const result = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime: { executeResolved: state.calls.runtime } as never,
      command: command(actionId, { targetActorId: ids.targetActor })
    })

    expect(result).toEqual({
      status: 'COMPLETE',
      occurrenceId: expect.any(String),
      pending: null,
      applications: [{ ordinal: 0, outcomeKind: 'HEAL', appliedAmount: 7 }]
    })
    expect(state.calls.patchSheetState).toHaveBeenCalledWith(
      ids.targetCharacter,
      expect.any(Array),
      expect.objectContaining({ expectedStreamVersion: 3 })
    )
    expect(JSON.stringify(result)).not.toContain(ids.targetCharacter)
    expect(JSON.stringify(result)).not.toContain('StreamVersion')
    expect(JSON.stringify(result)).not.toContain('rawFaces')
    expect(JSON.stringify(result)).not.toContain('contributors')
    expect(JSON.stringify(result)).not.toContain('resource')
    expect(JSON.stringify(result)).not.toContain('conditions')
  })

  it('uses the target maximum for cross-target capped healing and damage receipts', async () => {
    const { actionId } = reset()
    configureUnlimitedSingleCharacterTarget()
    state.targetMechanics!.commandState.state.hitpoints.current = 12
    state.encounter.actors.find((actor) => actor.id === ids.targetActor)!.currentHitPoints = 12

    await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime: { executeResolved: state.calls.runtime } as never,
      command: command(actionId, { targetActorId: ids.targetActor })
    })
    const cappedReceipt = state.receipts.get(`${ids.encounter}:${ids.command}`)
    expect(cappedReceipt?.resultPayload).toMatchObject({
      applicationOutputs: {
        kind: 'CHARACTER_MECHANICS_BATCH',
        applications: [expect.objectContaining({ kind: 'HEAL', appliedAmount: 0 })]
      }
    })

    const damageCommandId = '00000000-0000-4000-8000-000000000028'
    state.mechanicsCasKeys.clear()
    state.overlayCasKeys.clear()
    configureRuntimeOutcome({
      kind: 'DAMAGE',
      amount: 7,
      damageTypeId: ids.effect
    })
    await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime: { executeResolved: state.calls.runtime } as never,
      command: command(actionId, {
        commandId: damageCommandId,
        expectedEncounterVersion: 6,
        targetActorId: ids.targetActor
      })
    })
    const damageReceipt = state.receipts.get(`${ids.encounter}:${damageCommandId}`)
    expect(damageReceipt?.resultPayload).toMatchObject({
      applicationOutputs: {
        kind: 'CHARACTER_MECHANICS_BATCH',
        applications: [expect.objectContaining({ kind: 'DAMAGE' })]
      }
    })
  })

  it('advances both Encounter Character mirrors when a cross-target action consumes a source resource', async () => {
    const { actionId } = reset()
    configureUnlimitedSingleCharacterTarget()
    configureResourceBoundAction()

    const first = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime: { executeResolved: state.calls.runtime } as never,
      command: command(actionId, { targetActorId: ids.targetActor })
    })
    const replay = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime: { executeResolved: state.calls.runtime } as never,
      command: command(actionId, { targetActorId: ids.targetActor })
    })

    expect(replay).toEqual(first)
    expect(state.calls.setResourceUsage).toHaveBeenCalledTimes(1)
    expect(state.calls.advanceMechanics).toHaveBeenCalledTimes(2)
    expect(state.calls.publishOverlay).toHaveBeenCalledTimes(2)
    expect(state.calls.updateActor).toHaveBeenCalledWith(
      expect.objectContaining({ id: ids.actor, sourceRevision: 4 })
    )
    expect(state.calls.updateActor).toHaveBeenCalledWith(
      expect.objectContaining({ id: ids.targetActor, sourceRevision: 4 })
    )
    const sourceDecision = (
      state.mechanics.rulePolicyOutput as {
        actionDecisions: Array<Record<string, unknown>>
      }
    ).actionDecisions[0]
    const sourceOverlayDecision = (
      state.overlay.rulePolicyOutput as {
        actionDecisions: Array<Record<string, unknown>>
      }
    ).actionDecisions![0]
    sourceDecision.status = 'AVAILABLE'
    sourceDecision.reasonCode = null
    sourceOverlayDecision.status = 'AVAILABLE'
    sourceOverlayDecision.reasonCode = null
    state.calls.listResourceUsage.mockResolvedValue([
      {
        id: '00000000-0000-4000-8000-000000000023',
        characterId: ids.character,
        owner: {
          kind: 'ITEM_INSTANCE',
          itemInstanceId: '00000000-0000-4000-8000-000000000022',
          chargeId: '00000000-0000-4000-8000-000000000021'
        },
        used: 3,
        createdBy: ids.user,
        updatedBy: ids.user,
        createdAt: '2026-08-25T00:00:00.000Z',
        updatedAt: '2026-08-25T00:00:00.000Z'
      }
    ])
    state.mechanicsCasKeys.clear()
    state.overlayCasKeys.clear()
    state.calls.actionEvaluation.mockImplementation(async ({ committed }) => ({
      ruleEvaluation: committed,
      zenEvaluationMs: 0
    }))

    await expect(
      executeEncounterCharacterRuleAction({
        db: {} as never,
        runtime: { executeResolved: state.calls.runtime } as never,
        command: command(actionId, {
          commandId: '00000000-0000-4000-8000-000000000029',
          expectedEncounterVersion: 6,
          targetActorId: ids.targetActor
        })
      })
    ).resolves.toMatchObject({ applications: [expect.any(Object)] })
  })

  it.each([
    ['willing target', { selectionKind: 'SINGLE_TARGET', dispositionKind: 'WILLING' }],
    ['distance range', { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }]
  ])('rejects unsupported %s policy before runtime or mutation', async (_label, targeting) => {
    const { actionId } = reset()
    configureUnlimitedSingleCharacterTarget()
    const entry = state.mechanics.compiledActionEntryPoints[0] as {
      targetPolicy: { range: Record<string, unknown>; targeting: unknown }
    }
    entry.targetPolicy = {
      ...entry.targetPolicy,
      range:
        _label === 'distance range'
          ? {
              id: 'distance-range-id',
              rangeKind: 'DISTANCE',
              amount: 30,
              unit: 'FEET'
            }
          : entry.targetPolicy.range,
      targeting
    }

    await expect(
      executeEncounterCharacterRuleAction({
        db: {} as never,
        runtime: { executeResolved: state.calls.runtime } as never,
        command: command(actionId, { targetActorId: ids.targetActor })
      })
    ).rejects.toThrow('not permitted')
    expect(state.calls.runtime).not.toHaveBeenCalled()
    expect(state.calls.patchSheetState).not.toHaveBeenCalled()
    expect(state.calls.updateActor).not.toHaveBeenCalled()
  })

  it('consumes an exact composite item resource once and advances the Character and Campaign projections', async () => {
    const { actionId } = reset()
    const { chargeId, poolId } = configureResourceBoundAction()

    const first = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime: { executeResolved: state.calls.runtime } as never,
      command: command(actionId)
    })
    const replay = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime: { executeResolved: state.calls.runtime } as never,
      command: command(actionId)
    })

    expect(replay).toEqual(first)
    expect(state.calls.runtime).toHaveBeenCalledTimes(1)
    expect(state.calls.setResourceUsage).toHaveBeenCalledTimes(1)
    expect(state.calls.setResourceUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        used: 3,
        owner: expect.objectContaining({ chargeId })
      })
    )
    expect(state.calls.advanceMechanics).toHaveBeenCalledWith(
      expect.objectContaining({
        projection: expect.objectContaining({
          rulePolicyOutput: expect.objectContaining({
            resources: [expect.objectContaining({ poolId, remaining: 2 })]
          })
        })
      })
    )
    expect(state.calls.publishOverlay).toHaveBeenCalledWith(
      expect.objectContaining({
        projection: expect.objectContaining({
          rulePolicyOutput: expect.objectContaining({
            actionDecisions: [expect.objectContaining({ status: 'UNAVAILABLE' })]
          })
        })
      })
    )
    expect(state.calls.advanceMechanics).toHaveBeenCalledTimes(1)
    expect(state.calls.publishOverlay).toHaveBeenCalledTimes(1)
    const receipt = state.receipts.get(`${ids.encounter}:${ids.command}`)
    expect(receipt?.resultPayload).toMatchObject({
      applicationOutputs: {
        kind: 'CHARACTER_MECHANICS_BATCH',
        resourceConsumption: {
          poolId,
          chargeId,
          cost: 1,
          beforeUsed: 2,
          afterUsed: 3,
          beforeRemaining: 3,
          afterRemaining: 2
        }
      }
    })
  })

  it.each([
    [
      'insufficient remaining resource',
      (poolId: string) => {
        const resources = state.overlay.rulePolicyOutput.resources as Array<{
          poolId: string
          remaining: number
        }>
        resources.find((resource) => resource.poolId === poolId)!.remaining = 0
      }
    ],
    [
      'mismatched committed binding',
      () => {
        const entry = state.mechanics.compiledActionEntryPoints[0] as {
          compilation: { resourceBinding: { chargeId: string } }
        }
        entry.compilation.resourceBinding.chargeId = '00000000-0000-4000-8000-000000000024'
      }
    ]
  ])('rejects %s before runtime or mutation', async (_label, change) => {
    const { actionId } = reset()
    const { poolId } = configureResourceBoundAction()
    change(poolId)

    await expect(
      executeEncounterCharacterRuleAction({
        db: {} as never,
        runtime: { executeResolved: state.calls.runtime } as never,
        command: command(actionId)
      })
    ).rejects.toThrow()
    expect(state.calls.runtime).not.toHaveBeenCalled()
    expect(state.calls.patchSheetState).not.toHaveBeenCalled()
    expect(state.calls.setResourceUsage).not.toHaveBeenCalled()
    expect(state.calls.appendEncounterEvent).not.toHaveBeenCalled()
  })

  it.each([
    ['v1', false],
    ['v2 resource-free', true]
  ])('rejects an unavailable %s action before runtime or mutation', async (_label, v2) => {
    const { actionId } = reset()
    state.encounter = { ...state.encounter, automationMode: 'MANUAL' }
    if (v2) {
      const entry = state.mechanics.compiledActionEntryPoints[0] as {
        actionId: string
        compilation: { published: unknown }
        effectId: string
        kind: 'CHARACTER_ACTION'
      }
      state.mechanics.compiledActionEntryPoints = [
        {
          schemaVersion: 2,
          kind: entry.kind,
          actionId: entry.actionId,
          effectId: entry.effectId,
          compilation: {
            kind: 'COMPILED',
            published: entry.compilation.published,
            resourceBinding: null
          }
        }
      ]
    }
    for (const policyOutput of [
      state.mechanics.rulePolicyOutput,
      state.overlay.rulePolicyOutput
    ] as Array<{ actionDecisions: Array<Record<string, unknown>> }>) {
      policyOutput.actionDecisions[0] = {
        ...policyOutput.actionDecisions[0],
        status: 'UNAVAILABLE',
        reasonCode: 'SOURCE_NOT_EQUIPPED'
      }
    }

    await expect(
      executeEncounterCharacterRuleAction({
        db: {} as never,
        runtime: { executeResolved: state.calls.runtime } as never,
        command: command(actionId)
      })
    ).rejects.toThrow()
    expect(state.calls.runtime).not.toHaveBeenCalled()
    expect(state.calls.patchSheetState).not.toHaveBeenCalled()
    expect(state.calls.setResourceUsage).not.toHaveBeenCalled()
    expect(state.calls.appendEncounterEvent).not.toHaveBeenCalled()
    expect(state.receipts.size).toBe(0)
  })

  it('rejects a resolved resource whose owner key does not match the compiled pool binding', async () => {
    const { actionId } = reset()
    configureResourceBoundAction()
    const resources = state.overlay.rulePolicyOutput.resources as Array<{
      itemInstanceId: string
    }>
    resources[0]!.itemInstanceId = '00000000-0000-4000-8000-000000000024'

    await expect(
      executeEncounterCharacterRuleAction({
        db: {} as never,
        runtime: { executeResolved: state.calls.runtime } as never,
        command: command(actionId)
      })
    ).rejects.toThrow()
    expect(state.calls.runtime).not.toHaveBeenCalled()
    expect(state.calls.patchSheetState).not.toHaveBeenCalled()
    expect(state.calls.listResourceUsage).not.toHaveBeenCalled()
    expect(state.calls.setResourceUsage).not.toHaveBeenCalled()
  })

  it('preserves existing spell-slot usage while consuming a resource-bound action', async () => {
    const { actionId } = reset()
    configureResourceBoundAction()
    ;(state.mechanics.commandState.state as Record<string, unknown>).spellSlots = [
      { slotKey: 'STANDARD:1', used: 1 }
    ]

    await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime: { executeResolved: state.calls.runtime } as never,
      command: command(actionId)
    })

    expect(state.calls.actionEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({
        spellSlotUsage: [{ slotKey: 'STANDARD:1', used: 1 }]
      })
    )
  })

  it('executes a committed composite action exactly once and returns bounded application outputs', async () => {
    const { actionId, published } = reset()
    const result = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime: { executeResolved: state.calls.runtime } as never,
      command: command(actionId)
    })
    expect(state.calls.runtime).toHaveBeenCalledWith(
      expect.objectContaining({
        published,
        command: expect.objectContaining({
          facts: {
            [DND5E_TARGET_ACTOR_FACT_KEY]: ids.actor,
            [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: expect.any(String)
          }
        })
      })
    )
    expect(result).toEqual({
      status: 'COMPLETE',
      occurrenceId: expect.any(String),
      pending: null,
      applications: [{ ordinal: 0, outcomeKind: 'HEAL', appliedAmount: 6 }]
    })
    expect(state.calls.lock).toHaveBeenCalledTimes(1)
    expect(state.calls.advanceMechanics).toHaveBeenCalledTimes(1)
    expect(state.calls.publishOverlay).toHaveBeenCalledTimes(1)
    expect(state.calls.updateActor).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceRevision: 4,
        currentHitPoints: 10,
        maxHitPoints: 10
      })
    )
    expect(state.calls.publishEncounter).toHaveBeenCalledTimes(1)
    expect(state.calls.appendEncounterEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        commandId: ids.command,
        commandType: 'RESOLVE_RULE_ACTION',
        version: 6
      })
    )
    expect(state.calls.appendCharacterEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CHARACTER_RULE_OUTCOME_APPLIED',
        commandId: result.occurrenceId,
        applications: [expect.objectContaining({ outcome: 'HEAL', appliedAmount: 6 })]
      })
    )
  })

  it('reauthorizes matching replay without resolving or mutating and rejects a mismatched root', async () => {
    const { actionId } = reset()
    const first = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime: { executeResolved: state.calls.runtime } as never,
      command: command(actionId)
    })
    const replay = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime: { executeResolved: state.calls.runtime } as never,
      command: command(actionId)
    })
    expect(replay).toEqual(first)
    expect(state.calls.lock).toHaveBeenCalledTimes(2)
    expect(state.calls.runtime).toHaveBeenCalledTimes(1)
    expect(state.calls.patchSheetState).toHaveBeenCalledTimes(1)
    expect(state.calls.publishEncounter).toHaveBeenCalledTimes(1)
    expect(state.calls.appendEncounterEvent).toHaveBeenCalledTimes(1)
    expect(state.calls.appendCharacterEvent).toHaveBeenCalledTimes(1)
    await expect(
      executeEncounterCharacterRuleAction({
        db: {} as never,
        runtime: { executeResolved: state.calls.runtime } as never,
        command: command(actionId, { targetActorId: ids.character })
      })
    ).rejects.toThrow()
    expect(state.calls.runtime).toHaveBeenCalledTimes(1)
  })

  it('rejects a stored receipt with noncontiguous application ordinals without applying twice', async () => {
    const { actionId } = reset()
    await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime: { executeResolved: state.calls.runtime } as never,
      command: command(actionId)
    })
    const receipt = state.receipts.get(`${ids.encounter}:${ids.command}`)
    if (!receipt) throw new Error('Expected a stored rule-action receipt.')
    const resultPayload = receipt.resultPayload
    if (!resultPayload || typeof resultPayload !== 'object' || Array.isArray(resultPayload))
      throw new Error('Expected a stored rule-action result.')
    const mutableResultPayload = resultPayload as Record<string, unknown>
    const outputs = mutableResultPayload.applicationOutputs
    if (!outputs || typeof outputs !== 'object' || Array.isArray(outputs))
      throw new Error('Expected stored application outputs.')
    mutableResultPayload.applicationOutputs = {
      ...(outputs as Record<string, unknown>),
      applications: [
        {
          ...(outputs as { applications: readonly Record<string, unknown>[] }).applications[0]!,
          ordinal: 1
        }
      ]
    }

    await expect(
      executeEncounterCharacterRuleAction({
        db: {} as never,
        runtime: { executeResolved: state.calls.runtime } as never,
        command: command(actionId)
      })
    ).rejects.toThrow('Stored rule-execution receipt has an invalid result shape')
    expect(state.calls.runtime).toHaveBeenCalledTimes(1)
    expect(state.calls.patchSheetState).toHaveBeenCalledTimes(1)
    expect(state.calls.appendCharacterEvent).toHaveBeenCalledTimes(1)
  })

  it('does not expose a stored receipt when replay authorization is denied', async () => {
    const { actionId } = reset()
    await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime: { executeResolved: state.calls.runtime } as never,
      command: command(actionId)
    })
    state.calls.context.mockImplementationOnce(async () => {
      throw new Error('inactive member')
    })
    await expect(
      executeEncounterCharacterRuleAction({
        db: {} as never,
        runtime: { executeResolved: state.calls.runtime } as never,
        command: command(actionId)
      })
    ).rejects.toThrow('inactive member')
    expect(state.calls.runtime).toHaveBeenCalledTimes(1)
    expect(state.calls.patchSheetState).toHaveBeenCalledTimes(1)
    expect(state.calls.appendEncounterEvent).toHaveBeenCalledTimes(1)
  })

  it('preserves a zero applied amount at maximum while advancing both aggregates once', async () => {
    const { actionId, published } = reset({ current: 10 })
    configureRecurringActiveEffect(actionId)
    const result = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime: createDnd5eCharacterActionRuntime({
        continuationIntegrityKey: new Uint8Array(32).fill(7),
        definitions: { requireCurrent: async () => published }
      }),
      createActiveEffectId: () => '00000000-0000-4000-8000-000000000011',
      command: command(actionId)
    })
    expect(result.status).toBe('COMPLETE')
    if (result.status !== 'COMPLETE') throw new Error('Expected automatic action completion.')
    expect(result.applications).toContainEqual(
      expect.objectContaining({ outcomeKind: 'HEAL', appliedAmount: 0 })
    )
    expect(state.calls.updateActor).toHaveBeenCalledWith(
      expect.objectContaining({ id: ids.actor, sourceRevision: 4 })
    )
    expect(state.calls.appendCharacterEvent).not.toHaveBeenCalled()
    expect(state.calls.patchSheetState).toHaveBeenCalledTimes(1)
    expect(state.calls.createActiveRuleEffect).toHaveBeenCalledTimes(1)
  })

  it('uses temporary hit points as a maximum, not an additive pool', async () => {
    const { actionId } = reset()
    configureRuntimeOutcome({ kind: 'TEMPORARY_HIT_POINTS', amount: 7 })

    await expect(
      executeEncounterCharacterRuleAction({
        db: {} as never,
        runtime: { executeResolved: state.calls.runtime } as never,
        command: command(actionId)
      })
    ).resolves.toMatchObject({
      applications: [expect.objectContaining({ appliedAmount: 5 })]
    })
    expect(state.calls.updateActor).toHaveBeenCalledWith(
      expect.objectContaining({ currentHitPoints: 4, tempHitPoints: 7 })
    )
    expect(state.calls.appendCharacterEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        applications: [
          expect.objectContaining({
            outcome: 'TEMPORARY_HIT_POINTS',
            appliedAmount: 5
          })
        ]
      })
    )
  })

  it('rejects an invalid application receipt inside the completion applicator', async () => {
    const { actionId } = reset({ persistedVersion: -1 })

    await expect(
      executeEncounterCharacterRuleAction({
        db: {} as never,
        runtime: { executeResolved: state.calls.runtime } as never,
        command: command(actionId)
      })
    ).rejects.toThrow('receipt is invalid')
    expect(state.receipts.size).toBe(0)
  })

  it('rejects vulnerable damage that would exceed the safe integer range', async () => {
    const { actionId } = reset({ current: 10 })
    state.overlay.rulePolicyOutput.defenses = [{ kind: 'VULNERABILITY', damageTypeId: ids.effect }]
    configureRuntimeOutcome({
      kind: 'DAMAGE',
      amount: Number.MAX_SAFE_INTEGER,
      damageTypeId: ids.effect
    })

    await expect(
      executeEncounterCharacterRuleAction({
        db: {} as never,
        runtime: { executeResolved: state.calls.runtime } as never,
        command: command(actionId)
      })
    ).rejects.toThrow('safe integer range')
    expect(state.calls.patchSheetState).not.toHaveBeenCalled()
  })

  it.each([
    ['normal damage', [], 7, 5, 0, 7, 'NORMAL'],
    ['immunity', ['IMMUNITY'], 0, 10, 2, 0, 'IMMUNE'],
    ['resistance rounds down', ['RESISTANCE'], 3, 9, 0, 3, 'RESISTANT'],
    ['vulnerability', ['VULNERABILITY'], 14, 0, 0, 12, 'VULNERABLE'],
    [
      'resistance and vulnerability cancel',
      ['RESISTANCE', 'VULNERABILITY'],
      7,
      5,
      0,
      7,
      'CANCELLED'
    ]
  ])(
    'applies %s with temporary hit points absorbed before current hit points',
    async (
      _label,
      defenseKinds,
      resolvedAmount,
      currentHitPoints,
      tempHitPoints,
      appliedAmount,
      damageDisposition
    ) => {
      const { actionId } = reset({ current: 10 })
      state.overlay.rulePolicyOutput.defenses = defenseKinds.flatMap((kind) =>
        isDamageDefenseKind(kind) ? [{ kind, damageTypeId: ids.effect }] : []
      )
      configureRuntimeOutcome({
        kind: 'DAMAGE',
        amount: 7,
        damageTypeId: ids.effect
      })

      await expect(
        executeEncounterCharacterRuleAction({
          db: {} as never,
          runtime: { executeResolved: state.calls.runtime } as never,
          command: command(actionId)
        })
      ).resolves.toMatchObject({
        applications: [expect.objectContaining({ outcomeKind: 'DAMAGE', appliedAmount })]
      })
      if (appliedAmount === 0) {
        expect(state.calls.updateActor).not.toHaveBeenCalled()
        expect(state.calls.appendCharacterEvent).not.toHaveBeenCalled()
      } else {
        expect(state.calls.updateActor).toHaveBeenCalledWith(
          expect.objectContaining({ currentHitPoints, tempHitPoints })
        )
        expect(state.calls.appendCharacterEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            applications: [
              expect.objectContaining({
                outcome: 'DAMAGE',
                damageTypeId: ids.effect,
                appliedAmount
              })
            ]
          })
        )
      }
      const receipt = state.receipts.get(`${ids.encounter}:${ids.command}`)
      const resultPayload = receipt?.resultPayload
      if (!resultPayload || typeof resultPayload !== 'object' || Array.isArray(resultPayload))
        throw new Error('Expected a stored rule-action result.')
      expect((resultPayload as Record<string, unknown>).applicationOutputs).toMatchObject({
        kind: 'CHARACTER_MECHANICS_BATCH',
        applications: [expect.objectContaining({ resolvedAmount, damageDisposition })]
      })
    }
  )

  it('preserves full existing Character and Encounter condition metadata during a damage-only action', async () => {
    const { actionId } = reset({ current: 10 })
    const existingCharacterCondition = {
      conditionTypeId: ids.condition,
      notes: 'keep this note'
    }
    const existingActorCondition = {
      ...existingCharacterCondition,
      label: 'Poisoned',
      description: 'A retained mirror description.'
    }
    ;(state.mechanics.commandState.state as { conditions?: unknown[] }).conditions = [
      existingCharacterCondition
    ]
    state.encounter.actors[0].conditions = [existingActorCondition]
    configureRuntimeOutcome({
      kind: 'DAMAGE',
      amount: 3,
      damageTypeId: ids.effect
    })

    await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime: { executeResolved: state.calls.runtime } as never,
      command: command(actionId)
    })

    expect(state.calls.patchSheetState).toHaveBeenCalledWith(
      ids.character,
      [
        expect.objectContaining({ kind: 'HITPOINTS' }),
        { kind: 'CONDITIONS', value: [existingCharacterCondition] }
      ],
      expect.any(Object)
    )
    expect(state.calls.updateActor).toHaveBeenCalledWith(
      expect.objectContaining({ conditions: [existingActorCondition] })
    )
  })

  it.each([
    ['missing compiled entry', () => reset({ entry: false })],
    [
      'stale maximum mirror',
      () => {
        const fixture = reset()
        state.encounter.actors[0].maxHitPoints = 9
        return fixture
      }
    ],
    [
      'three-way hit-point mismatch',
      () => {
        const fixture = reset()
        state.encounter.actors[0].tempHitPoints = 1
        return fixture
      }
    ]
  ])('rejects %s before runtime', async (_name, setup) => {
    const { actionId } = setup()
    await expect(
      executeEncounterCharacterRuleAction({
        db: {} as never,
        runtime: { executeResolved: state.calls.runtime } as never,
        command: command(actionId)
      })
    ).rejects.toThrow()
    expect(state.calls.runtime).not.toHaveBeenCalled()
  })

  it('applies a self condition through Character sheet state and stores closed evidence', async () => {
    const { actionId } = reset()
    const campaignCondition = {
      conditionTypeId: '00000000-0000-4000-8000-000000000010',
      label: 'Campaign condition',
      notes: 'visible Campaign note'
    }
    state.encounter.actors[0].conditions = [campaignCondition]
    const published = publishedHeal(ids.condition)
    state.vocabularySnapshot = {
      systemId: ids.system,
      snapshotVersion: 1,
      checksum: 'v'.repeat(64),
      document: { conditionTypes: [{ id: ids.condition, label: 'Poisoned' }] }
    }
    const entry = state.mechanics.compiledActionEntryPoints[0] as {
      compilation: Record<string, unknown>
    }
    entry.compilation = { kind: 'COMPILED', published }
    ;(state.mechanics as Record<string, unknown>).systemVocabularySnapshotId = ids.effect
    ;(state.mechanics as Record<string, unknown>).systemVocabularySnapshotVersion = 1
    ;(state.mechanics as Record<string, unknown>).systemVocabularySnapshotChecksum = 'v'.repeat(64)
    state.calls.patchSheetState.mockImplementation(
      async (
        _id: string,
        _patches: unknown,
        input: { afterPersist: (db: object, version: number) => Promise<void> }
      ) => input.afterPersist(state.transaction, 4)
    )
    state.calls.runtime.mockImplementation(async ({ command: runtimeCommand }) => ({
      status: 'COMPLETE',
      outputs: {
        targetActorId: runtimeCommand.facts[DND5E_TARGET_ACTOR_FACT_KEY],
        conditionId: ids.condition
      },
      evidence: {
        source: {
          definitionId: ids.effect,
          gameSystemId: ids.system,
          definitionFamilyKey: 'effect-action',
          checksum: published.checksum
        },
        capabilityContractVersion: 1,
        facts: runtimeCommand.facts,
        trace: [
          {
            nodeId: 'condition_apply',
            operation: {
              key: 'dnd5e.condition-apply-proposal',
              contractVersion: 1
            },
            inputs: {},
            outputs: {
              targetActorId: ids.actor,
              conditionId: ids.condition,
              applicationCandidate: true,
              authorized: true,
              targetStateChecksum: runtimeCommand.facts[DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]
            }
          }
        ],
        outputs: { targetActorId: ids.actor, conditionId: ids.condition }
      }
    }))

    await expect(
      executeEncounterCharacterRuleAction({
        db: {} as never,
        runtime: { executeResolved: state.calls.runtime } as never,
        command: command(actionId)
      })
    ).resolves.toMatchObject({
      applications: [
        expect.objectContaining({
          outcomeKind: 'CONDITION_APPLY',
          applied: true
        })
      ]
    })
    expect(state.calls.patchSheetState).toHaveBeenCalledWith(
      ids.character,
      [
        expect.objectContaining({ kind: 'HITPOINTS' }),
        { kind: 'CONDITIONS', value: [{ conditionTypeId: ids.condition }] }
      ],
      expect.any(Object)
    )
    expect(state.calls.updateActor).toHaveBeenCalledWith(
      expect.objectContaining({
        conditions: [campaignCondition, { conditionTypeId: ids.condition, label: 'Poisoned' }]
      })
    )
    expect(state.calls.appendCharacterEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        applications: [
          expect.objectContaining({
            outcome: 'CONDITION_APPLY',
            applied: true
          })
        ]
      })
    )
  })

  it('rejects a condition missing from the pinned vocabulary before runtime or writes', async () => {
    const { actionId } = reset()
    const published = publishedHeal(ids.condition)
    const entry = state.mechanics.compiledActionEntryPoints[0] as {
      compilation: Record<string, unknown>
    }
    entry.compilation = { kind: 'COMPILED', published }
    state.vocabularySnapshot = {
      systemId: ids.system,
      snapshotVersion: 1,
      checksum: 'v'.repeat(64),
      document: { conditionTypes: [] }
    }
    ;(state.mechanics as Record<string, unknown>).systemVocabularySnapshotId = ids.effect
    ;(state.mechanics as Record<string, unknown>).systemVocabularySnapshotVersion = 1
    ;(state.mechanics as Record<string, unknown>).systemVocabularySnapshotChecksum = 'v'.repeat(64)

    await expect(
      executeEncounterCharacterRuleAction({
        db: {} as never,
        runtime: { executeResolved: state.calls.runtime } as never,
        command: command(actionId)
      })
    ).rejects.toThrow('pinned System vocabulary')
    expect(state.calls.runtime).not.toHaveBeenCalled()
    expect(state.calls.patchSheetState).not.toHaveBeenCalled()
    expect(state.calls.patchHitPoints).not.toHaveBeenCalled()
  })

  it('preserves an existing condition object and replays its settled result without writes', async () => {
    const { actionId } = reset()
    const existingCondition = {
      conditionTypeId: ids.condition,
      notes: 'keep this note'
    }
    const existingProjectedCondition = {
      ...existingCondition,
      label: 'Poisoned'
    }
    ;(state.mechanics.commandState.state as { conditions?: unknown[] }).conditions = [
      existingCondition
    ]
    state.encounter.actors[0].conditions = [existingProjectedCondition]
    const published = publishedHeal(ids.condition)
    const entry = state.mechanics.compiledActionEntryPoints[0] as {
      compilation: Record<string, unknown>
    }
    entry.compilation = { kind: 'COMPILED', published }
    state.vocabularySnapshot = {
      systemId: ids.system,
      snapshotVersion: 1,
      checksum: 'v'.repeat(64),
      document: { conditionTypes: [{ id: ids.condition, label: 'Poisoned' }] }
    }
    ;(state.mechanics as Record<string, unknown>).systemVocabularySnapshotId = ids.effect
    ;(state.mechanics as Record<string, unknown>).systemVocabularySnapshotVersion = 1
    ;(state.mechanics as Record<string, unknown>).systemVocabularySnapshotChecksum = 'v'.repeat(64)
    state.calls.patchSheetState.mockImplementation(
      async (
        _id: string,
        _patches: unknown,
        input: { afterPersist: (db: object, version: number) => Promise<void> }
      ) => input.afterPersist(state.transaction, 4)
    )
    state.calls.runtime.mockImplementation(async ({ command: runtimeCommand }) => ({
      status: 'COMPLETE',
      outputs: {
        targetActorId: ids.actor,
        conditionId: ids.condition,
        applicationCandidate: true,
        authorized: true,
        targetStateChecksum: runtimeCommand.facts[DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]
      },
      evidence: {
        source: {
          definitionId: ids.effect,
          gameSystemId: ids.system,
          definitionFamilyKey: 'effect-action',
          checksum: published.checksum
        },
        capabilityContractVersion: 1,
        facts: runtimeCommand.facts,
        trace: [
          {
            nodeId: 'condition_apply',
            operation: {
              key: 'dnd5e.condition-apply-proposal',
              contractVersion: 1
            },
            inputs: {},
            outputs: {
              targetActorId: ids.actor,
              conditionId: ids.condition,
              applicationCandidate: true,
              authorized: true,
              targetStateChecksum: runtimeCommand.facts[DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]
            }
          }
        ],
        outputs: {
          targetActorId: ids.actor,
          conditionId: ids.condition,
          applicationCandidate: true,
          authorized: true,
          targetStateChecksum: runtimeCommand.facts[DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]
        }
      }
    }))
    const first = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime: { executeResolved: state.calls.runtime } as never,
      command: command(actionId)
    })
    expect(first).toMatchObject({
      applications: [
        expect.objectContaining({
          outcomeKind: 'CONDITION_APPLY',
          applied: false
        })
      ]
    })
    expect(state.calls.patchSheetState).not.toHaveBeenCalled()
    expect(state.calls.updateActor).not.toHaveBeenCalled()
    const writes = state.calls.patchSheetState.mock.calls.length
    const runtimeCalls = state.calls.runtime.mock.calls.length
    const replay = await executeEncounterCharacterRuleAction({
      db: {} as never,
      runtime: { executeResolved: state.calls.runtime } as never,
      command: command(actionId)
    })
    expect(replay).toEqual(first)
    expect(state.calls.patchSheetState).toHaveBeenCalledTimes(writes)
    expect(state.calls.runtime).toHaveBeenCalledTimes(runtimeCalls)
  })
})
