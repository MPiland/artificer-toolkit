import {
  createActiveRuleEffectRepository,
  createCampaignCharacterMechanicsProjectionRepository,
  createCharacterMechanicsProjectionRepository,
  createCharacterRepository,
  createReusableDefinitionRepository,
  type DBLike,
  type EncounterRecord
} from '@artificer-toolkit/db'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import type { SystemVocabularySnapshot } from '@artificer-toolkit/schema/projections/systemVocabulary'
import { serverPublishedRuleDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { v5 as uuidv5 } from 'uuid'

import { advanceCharacterMechanicsProjectionCommandState } from '../character/characterMechanicsCompiler.js'
import {
  checksumCampaignCharacterMechanicalContext,
  resolveCharacterLiveSessionRuleContext
} from '../character/campaignCharacterSheet.js'
import {
  CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION,
  compileCampaignCharacterMechanicsProjection
} from '../campaign/campaignCharacterMechanicsProjection.js'
import { EncounterConflictError } from './encounterErrors.js'
import { EncounterValidationError } from './encounterErrors.js'
import {
  DND5E_CONCENTRATION_CHECK_DEFINITION_ID,
  DND5E_CONSTITUTION_ABILITY_DEFINITION_ID,
  resolveDnd5eConcentrationSaveFacts,
  validateDnd5eConcentrationContributors
} from '../rules/systems/dnd5e/concentrationPolicy.js'
import {
  createRuleExecutionOccurrenceService,
  type RuleExecutionAggregatePort
} from '../rules/ruleExecutionOccurrenceService.js'
import type { RulesRuntimeService } from '../rules/rulesRuntimeService.js'

export interface MaintainedDependentSnapshot {
  activeEffectId: string
  createdOrdinal: number
  definitionChecksum: string
  lifecycleChecksum: string
  owner: string
  version: number
}

export interface ConcentrationPreflight {
  descriptorChecksum: string
  dependents: readonly MaintainedDependentSnapshot[]
  id: string
  maintenanceDefinitionId: string
  ownerActorId: string
  version: number
}

export const DND5E_CONCENTRATION_OCCURRENCE_NAMESPACE = 'd4b06f4e-c014-49b6-8e39-3a2c790f8d57'

export function maintainedDependentSnapshot(
  effect: Awaited<
    ReturnType<ReturnType<typeof createActiveRuleEffectRepository>['listDependentEffects']>
  >[number]
): MaintainedDependentSnapshot {
  return {
    activeEffectId: effect.id,
    createdOrdinal: effect.createdOrdinal,
    definitionChecksum: effect.definitionChecksum,
    lifecycleChecksum: effect.lifecycleChecksum,
    owner:
      effect.owner.kind === 'CHARACTER'
        ? `CHARACTER:${effect.owner.characterId}`
        : `ENCOUNTER_ACTOR:${effect.owner.targetActorId}`,
    version: effect.version
  }
}

export function sameConcentrationPreflight(
  left: ConcentrationPreflight,
  right: ConcentrationPreflight
): boolean {
  return (
    left.id === right.id &&
    left.version === right.version &&
    left.ownerActorId === right.ownerActorId &&
    left.maintenanceDefinitionId === right.maintenanceDefinitionId &&
    left.descriptorChecksum === right.descriptorChecksum &&
    JSON.stringify(left.dependents) === JSON.stringify(right.dependents)
  )
}

export function concentrationChildIdentity(input: {
  parentOccurrenceId: string
  ordinal: number
  sourceNodeId: string
  sourceOperationKey: string
  targetActorId: string
}): string {
  return uuidv5(
    `${input.parentOccurrenceId}:${input.ordinal}:${input.sourceNodeId}:${input.sourceOperationKey}:${input.targetActorId}:concentration-damage-check`,
    DND5E_CONCENTRATION_OCCURRENCE_NAMESPACE
  )
}

export async function cleanupConcentrationMaintainedState(input: {
  db: DBLike
  encounter: EncounterRecord
  attunementSlotOverride: number | null
  concentration: ConcentrationPreflight
}) {
  const activeEffects = createActiveRuleEffectRepository(input.db)
  const state = await activeEffects.lockMaintainedStateById({
    encounterId: input.encounter.id,
    stateId: input.concentration.id
  })
  const dependents = state
    ? await activeEffects.lockDependentEffects({
        stateId: state.id,
        encounterId: input.encounter.id
      })
    : []
  const current = state
    ? {
        id: state.id,
        version: state.version,
        ownerActorId: state.ownerActorId,
        maintenanceDefinitionId: state.maintenanceDefinitionId,
        descriptorChecksum: state.descriptorChecksum,
        dependents: dependents.map(maintainedDependentSnapshot)
      }
    : null
  if (!state || !current || !sameConcentrationPreflight(input.concentration, current)) {
    throw new EncounterConflictError('Concentration state changed before cleanup.')
  }
  for (const dependent of dependents) {
    await activeEffects.deleteCas({
      id: dependent.id,
      owner: dependent.owner,
      expectedVersion: dependent.version
    })
  }
  if (
    state.descriptor.schemaVersion === 1 ||
    state.descriptor.emptyDependentPolicy === 'TERMINATE_WHEN_EMPTY'
  ) {
    await activeEffects.deleteMaintainedStateCas({
      id: state.id,
      encounterId: input.encounter.id,
      ownerActorId: state.ownerActorId,
      expectedVersion: state.version
    })
  }

  const transitions: {
    characterId: string
    beforeStreamVersion: number
    afterStreamVersion: number
  }[] = []
  const characterActorVersions = new Map<string, number>()
  const characterIds = [
    ...new Set(
      dependents.flatMap((dependent) =>
        dependent.owner.kind === 'CHARACTER' ? [dependent.owner.characterId] : []
      )
    )
  ].sort()
  for (const characterId of characterIds) {
    const owner = await input.db
      .selectFrom('characters')
      .select(['id', 'stream_version', 'status'])
      .where('id', '=', characterId)
      .forUpdate()
      .executeTakeFirst()
    if (!owner || owner.status !== 'ACTIVE') {
      throw new EncounterConflictError('A concentration dependent owner is stale.')
    }
    const mechanics = await createCharacterMechanicsProjectionRepository(input.db).requireCurrent({
      characterId,
      expectedStreamVersion: owner.stream_version
    })
    const context = await resolveCharacterLiveSessionRuleContext(input.db, characterId, {
      id: input.encounter.campaignId,
      attunementSlotOverride: input.attunementSlotOverride
    })
    if (!context) throw new EncounterConflictError('A concentration dependent context is stale.')
    const overlay = await createCampaignCharacterMechanicsProjectionRepository(
      input.db
    ).requireCurrent({
      campaignId: input.encounter.campaignId,
      characterId,
      expectedBaseMechanicsProjectionChecksum: mechanics.projectionChecksum,
      expectedCharacterStreamVersion: owner.stream_version,
      expectedMechanicalContextChecksum: checksumCampaignCharacterMechanicalContext({
        adjustments: context.adjustments,
        attunementSlotOverride: context.attunementSlotOverride
      }),
      expectedProjectionSchemaVersion: CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION,
      baseMechanicsProjection: mechanics
    })
    const afterStreamVersion = await createCharacterRepository(input.db).patchSheetState(
      characterId,
      [],
      {
        expectedStreamVersion: owner.stream_version,
        afterPersist: async (trx, nextStreamVersion) => {
          const nextMechanics = advanceCharacterMechanicsProjectionCommandState({
            characterCommandState: mechanics.commandState,
            characterStreamVersion: nextStreamVersion,
            current: mechanics
          })
          await createCharacterMechanicsProjectionRepository(trx).advanceLiveCommandState({
            expectedPriorProjectionChecksum: mechanics.projectionChecksum,
            expectedPriorStreamVersion: mechanics.characterStreamVersion,
            projection: nextMechanics
          })
          await createCampaignCharacterMechanicsProjectionRepository(trx).publish({
            expectedPriorOverlayChecksum: overlay.projectionChecksum,
            projection: compileCampaignCharacterMechanicsProjection({
              campaignId: overlay.campaignId,
              characterId,
              characterStreamVersion: nextStreamVersion,
              baseMechanicsProjectionChecksum: nextMechanics.projectionChecksum,
              mechanicalContextChecksum: overlay.mechanicalContextChecksum,
              manualMaximumModifierOwner: overlay.manualMaximumModifierOwner,
              ...(overlay.kind === 'MATERIALIZED'
                ? {
                    rulePolicyInput: overlay.rulePolicyInput,
                    rulePolicyOutput: overlay.rulePolicyOutput
                  }
                : {})
            })
          })
        }
      }
    )
    transitions.push({ characterId, beforeStreamVersion: owner.stream_version, afterStreamVersion })
    characterActorVersions.set(characterId, afterStreamVersion)
  }
  return {
    maintainedStateId: state.id,
    removedDependentEffectIds: dependents.map((dependent) => dependent.id),
    characterOwnerTransitions: transitions,
    characterActorVersions
  }
}

export interface FinalizedConcentrationDamageApplication {
  ordinal: number
  sourceNodeId: string
  sourceOperationKey: string
  targetActorId: string
  appliedAmount: number
  damageTypeId: string
}

/**
 * Starts receipt-only concentration children after a parent action has
 * committed its damage. The same sealed pending context is consumed by the
 * existing concentration-resume service.
 */
export async function startEncounterConcentrationDamageChecks(input: {
  db: DBLike
  runtime: RulesRuntimeService
  encounter: EncounterRecord
  childOccurrencePort: RuleExecutionAggregatePort
  parentOccurrenceId: string
  parentCommandFingerprint: string
  expectedEncounterVersion: number
  targetCharacter: {
    streamVersion: number
    mechanics: {
      characterStreamVersion: number
      projectionChecksum: string
      systemVocabularySnapshotId: string
      systemVocabularySnapshotVersion: number
      systemVocabularySnapshotChecksum: string
    }
    overlay: {
      projectionChecksum: string
      mechanicalContextChecksum: string
    }
    policyOutput: CharacterRulePolicyOutput
    vocabularySnapshot: SystemVocabularySnapshot
  }
  concentration: ConcentrationPreflight
  applications: readonly FinalizedConcentrationDamageApplication[]
  automationMode: 'AUTOMATIC' | 'ASSISTED'
  attunementSlotOverride: number | null
  rollD20?: () => number
}): Promise<{
  pendingOccurrenceId: string | null
  characterActorVersions: ReadonlyMap<string, number>
}> {
  const damageApplications = input.applications.filter(
    (application) => application.appliedAmount > 0
  )
  if (damageApplications.length === 0) {
    return { pendingOccurrenceId: null, characterActorVersions: new Map() }
  }
  const activeEffects = createActiveRuleEffectRepository(input.db)
  const maintainedState = await activeEffects.lockMaintainedStateById({
    encounterId: input.encounter.id,
    stateId: input.concentration.id
  })
  const dependents = maintainedState
    ? await activeEffects.lockDependentEffects({
        stateId: maintainedState.id,
        encounterId: input.encounter.id
      })
    : []
  const currentConcentration = maintainedState
    ? {
        id: maintainedState.id,
        version: maintainedState.version,
        ownerActorId: maintainedState.ownerActorId,
        maintenanceDefinitionId: maintainedState.maintenanceDefinitionId,
        descriptorChecksum: maintainedState.descriptorChecksum,
        dependents: dependents.map(maintainedDependentSnapshot)
      }
    : null
  if (
    !currentConcentration ||
    !sameConcentrationPreflight(input.concentration, currentConcentration)
  ) {
    throw new EncounterConflictError('Concentration state changed before child execution.')
  }
  const currentDefinition = await createReusableDefinitionRepository(input.db).requireCurrent(
    DND5E_CONCENTRATION_CHECK_DEFINITION_ID
  )
  if (
    currentDefinition.gameSystemId !== input.encounter.gameSystemId ||
    currentDefinition.gameSystemId !== input.targetCharacter.vocabularySnapshot.systemId
  ) {
    throw new EncounterValidationError('The concentration check definition is unavailable.')
  }
  const concentrationPublished = serverPublishedRuleDefinitionDtoSchema.parse({
    id: currentDefinition.id,
    gameSystemId: currentDefinition.gameSystemId,
    definitionFamilyKey: currentDefinition.definitionFamilyKey,
    checksum: currentDefinition.checksum,
    definition: currentDefinition.document
  })
  const bindings = concentrationPublished.definition.vocabularyBindings ?? []
  if (
    bindings.length !== 1 ||
    bindings[0]?.kind !== 'ABILITY' ||
    bindings[0].definitionId !== DND5E_CONSTITUTION_ABILITY_DEFINITION_ID ||
    !('abilities' in input.targetCharacter.vocabularySnapshot.document) ||
    !input.targetCharacter.vocabularySnapshot.document.abilities.some(
      (ability) => ability.id === bindings[0]?.definitionId
    )
  ) {
    throw new EncounterValidationError(
      'The concentration check saving-throw ability is not present in the pinned System vocabulary.'
    )
  }
  const auditPins = {
    concentrationDefinition: {
      id: concentrationPublished.id,
      checksum: concentrationPublished.checksum
    },
    savingThrowAbilityDefinitionId: bindings[0].definitionId,
    systemVocabularySnapshot: {
      id: input.targetCharacter.vocabularySnapshot.snapshotId,
      version: input.targetCharacter.vocabularySnapshot.snapshotVersion,
      checksum: input.targetCharacter.vocabularySnapshot.checksum
    },
    targetCharacter: {
      streamVersion: input.targetCharacter.mechanics.characterStreamVersion,
      baseProjectionChecksum: input.targetCharacter.mechanics.projectionChecksum,
      campaignOverlayChecksum: input.targetCharacter.overlay.projectionChecksum,
      mechanicalContextChecksum: input.targetCharacter.overlay.mechanicalContextChecksum
    }
  } as const
  const envelopeChecksum = checksumRuleDocument(damageApplications)
  const characterActorVersions = new Map<string, number>()
  for (const [index, application] of damageApplications.entries()) {
    const facts = resolveDnd5eConcentrationSaveFacts({
      targetActorId: application.targetActorId,
      appliedDamage: application.appliedAmount,
      rulePolicyOutput: input.targetCharacter.policyOutput
    })
    const context = {
      concentrationDefinition: auditPins.concentrationDefinition,
      savingThrowAbilityDefinitionId: auditPins.savingThrowAbilityDefinitionId,
      systemVocabularySnapshot: auditPins.systemVocabularySnapshot,
      targetCharacter: auditPins.targetCharacter,
      modifier: facts.modifier,
      rollMode: facts.rollMode,
      contributors: [...facts.contributors],
      contributorChecksum: facts.contributorChecksum,
      maintainedState: {
        id: input.concentration.id,
        version: input.concentration.version,
        maintenanceDefinitionId: input.concentration.maintenanceDefinitionId,
        descriptorChecksum: input.concentration.descriptorChecksum
      },
      finalizedDamageApplication: { ...application, maintainedStateId: input.concentration.id },
      finalizedDamageEnvelopeChecksum: envelopeChecksum
    }
    const contextChecksum = checksumRuleDocument(context)
    const childOccurrenceId = concentrationChildIdentity({
      parentOccurrenceId: input.parentOccurrenceId,
      ...application
    })
    const childCommandId = uuidv5(
      `${childOccurrenceId}:command`,
      DND5E_CONCENTRATION_OCCURRENCE_NAMESPACE
    )
    if (input.automationMode === 'ASSISTED') {
      const child = await createRuleExecutionOccurrenceService({
        db: input.db,
        runtime: input.runtime,
        createOccurrenceId: () => childOccurrenceId
      }).executeResolved(input.childOccurrencePort, {
        commandId: childCommandId,
        correlationId:
          index === 0
            ? input.parentOccurrenceId
            : concentrationChildIdentity({
                parentOccurrenceId: input.parentOccurrenceId,
                ...damageApplications[index - 1]!
              }),
        expectedAggregateVersion: input.expectedEncounterVersion,
        intent: {
          parentOccurrenceId: input.parentOccurrenceId,
          applicationOrdinal: application.ordinal,
          applicationIndex: index,
          damageEnvelopeChecksum: envelopeChecksum,
          concentrationContextChecksum: contextChecksum
        },
        allowPaused: true,
        async resolve() {
          return {
            published: concentrationPublished,
            facts: facts.facts,
            allowPaused: true,
            pendingApplicationContext: {
              kind: 'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK' as const,
              schemaVersion: 1 as const,
              parentOccurrenceId: input.parentOccurrenceId,
              parentCommandFingerprint: input.parentCommandFingerprint,
              finalizedDamageEnvelopeChecksum: envelopeChecksum,
              application,
              maintainedState: context.maintainedState,
              concentrationDefinition: auditPins.concentrationDefinition,
              save: {
                savingThrowAbilityDefinitionId: auditPins.savingThrowAbilityDefinitionId,
                modifier: facts.modifier,
                rollMode: facts.rollMode,
                contributors: [...facts.contributors],
                contributorChecksum: facts.contributorChecksum
              },
              targetCharacter: auditPins.targetCharacter,
              systemVocabularySnapshot: auditPins.systemVocabularySnapshot,
              contextChecksum,
              remaining: damageApplications.slice(index + 1).map((remaining) => ({
                ...remaining,
                maintainedStateId: input.concentration.id
              }))
            }
          }
        }
      })
      if (child.status !== 'PAUSED') {
        throw new EncounterConflictError(
          'Assisted concentration did not create a pending occurrence.'
        )
      }
      return { pendingOccurrenceId: child.occurrenceId, characterActorVersions }
    }

    let requestId: string | null = null
    let rawFaces: number[] = []
    const child = await createRuleExecutionOccurrenceService({
      db: input.db,
      runtime: input.runtime,
      createOccurrenceId: () => childOccurrenceId
    }).executeResolved(input.childOccurrencePort, {
      commandId: childCommandId,
      correlationId:
        index === 0
          ? input.parentOccurrenceId
          : concentrationChildIdentity({
              parentOccurrenceId: input.parentOccurrenceId,
              ...damageApplications[index - 1]!
            }),
      expectedAggregateVersion: input.expectedEncounterVersion,
      intent: {
        parentOccurrenceId: input.parentOccurrenceId,
        applicationOrdinal: application.ordinal,
        applicationIndex: index,
        damageEnvelopeChecksum: envelopeChecksum,
        concentrationContextChecksum: contextChecksum
      },
      allowPaused: false,
      async resolve() {
        return { published: concentrationPublished, facts: facts.facts, allowPaused: false }
      },
      resolveAutomaticEvidence: async ({ request }) => {
        if (request.kind !== 'INTEGER_RANGE' || request.min !== 1 || request.max !== 20) {
          throw new EncounterValidationError('The concentration check issued an invalid roll.')
        }
        const roll = input.rollD20 ?? (() => Math.floor(Math.random() * 20) + 1)
        rawFaces = facts.rollMode === 'NORMAL' ? [roll()] : [roll(), roll()]
        if (rawFaces.some((face) => !Number.isInteger(face) || face < 1 || face > 20)) {
          throw new EncounterValidationError('The concentration check roll is invalid.')
        }
        requestId = request.requestId
        return {
          requestId: request.requestId,
          value:
            facts.rollMode === 'ADVANTAGE'
              ? Math.max(...rawFaces)
              : facts.rollMode === 'DISADVANTAGE'
                ? Math.min(...rawFaces)
                : rawFaces[0]!
        }
      },
      completionApplicator: {
        requiresAggregateAdvance: () => false,
        async apply({ db, execution, occurrenceId }) {
          const selectedNatural =
            facts.rollMode === 'ADVANTAGE'
              ? Math.max(...rawFaces)
              : facts.rollMode === 'DISADVANTAGE'
                ? Math.min(...rawFaces)
                : (rawFaces[0] ?? null)
          const dc = execution.outputs.dc
          const total = execution.outputs.total
          const resultPath = execution.outputs.resultPath
          if (
            !requestId ||
            selectedNatural === null ||
            typeof dc !== 'number' ||
            !Number.isInteger(dc) ||
            typeof total !== 'number' ||
            !Number.isInteger(total) ||
            total !== selectedNatural + facts.modifier ||
            (resultPath !== 'ON_SAVE_SUCCESS' && resultPath !== 'ON_SAVE_FAIL') ||
            execution.evidence.source.definitionId !== auditPins.concentrationDefinition.id ||
            execution.evidence.source.checksum !== auditPins.concentrationDefinition.checksum ||
            checksumRuleDocument(context) !== contextChecksum
          ) {
            throw new EncounterValidationError('The concentration check evidence is invalid.')
          }
          try {
            validateDnd5eConcentrationContributors(facts.contributors, facts.contributorChecksum)
          } catch {
            throw new EncounterValidationError(
              'The concentration check contributor evidence is invalid.'
            )
          }
          const d20 = {
            requestId,
            rollMode: facts.rollMode,
            rawFaces,
            selectedNatural,
            modifier: facts.modifier,
            total,
            dc,
            contributors: [...facts.contributors],
            contributorChecksum: facts.contributorChecksum
          }
          if (resultPath === 'ON_SAVE_SUCCESS') {
            return {
              kind: 'CONCENTRATION_CHECK' as const,
              schemaVersion: 1 as const,
              occurrenceId,
              parentOccurrenceId: input.parentOccurrenceId,
              ...auditPins,
              contextChecksum,
              application: { ...application, maintainedStateId: input.concentration.id },
              outcome: 'SAVE_SUCCESS' as const,
              d20,
              cleanup: null,
              nextOccurrenceId:
                index + 1 < damageApplications.length
                  ? concentrationChildIdentity({
                      parentOccurrenceId: input.parentOccurrenceId,
                      ...damageApplications[index + 1]!
                    })
                  : null,
              skipped: []
            }
          }
          const cleanup = await cleanupConcentrationMaintainedState({
            db,
            encounter: input.encounter,
            attunementSlotOverride: input.attunementSlotOverride,
            concentration: input.concentration
          })
          for (const [characterId, version] of cleanup.characterActorVersions) {
            characterActorVersions.set(characterId, version)
          }
          return {
            kind: 'CONCENTRATION_CHECK' as const,
            schemaVersion: 1 as const,
            occurrenceId,
            parentOccurrenceId: input.parentOccurrenceId,
            ...auditPins,
            contextChecksum,
            application: { ...application, maintainedStateId: cleanup.maintainedStateId },
            outcome: 'SAVE_FAILURE' as const,
            d20,
            cleanup: {
              maintainedStateId: cleanup.maintainedStateId,
              removedDependentEffectIds: cleanup.removedDependentEffectIds,
              characterOwnerTransitions: cleanup.characterOwnerTransitions
            },
            nextOccurrenceId: null,
            skipped: damageApplications.slice(index + 1).map((remaining) => ({
              ...remaining,
              maintainedStateId: cleanup.maintainedStateId,
              reason: 'MAINTAINED_STATE_ENDED' as const
            }))
          }
        }
      }
    })
    if (child.status !== 'COMPLETE' || child.applicationOutputs.kind !== 'CONCENTRATION_CHECK') {
      throw new EncounterConflictError('Automatic concentration did not complete.')
    }
    if (child.applicationOutputs.outcome === 'SAVE_FAILURE') break
  }
  return { pendingOccurrenceId: null, characterActorVersions }
}
