import { z, lazySchema } from '../zod.js'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'

import { encounterSpatialRuleEffectRecordSchema } from '../projections/spatialRuleEffectPersistence.js'
import { characterMechanicsTargetStateDtoSchema } from './ruleExecutionMechanics.js'
import {
  movementDamageSaveChildren,
  type MovementConcentrationEndDto,
  type MovementConcentrationExecutionDto,
  type MovementRepeatSaveExecutionDto
} from './ruleExecutionMovementConcentration.js'
import {
  ruleExecutionAggregateVersionSchema as aggregateVersionSchema,
  ruleExecutionPositiveIntegerSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'
import {
  compareSpatialPendingCandidates,
  spatialEffectCurrentnessPinDtoSchema,
  spatialPendingCandidateDtoSchema
} from './ruleExecutionSpatial.js'
import {
  refineSpatialEffectTransition,
  spatialEffectTransitionEntryDtoSchema,
  spatialMovementCharacterTransitionDtoSchema,
  spatialMovementEncounterActorTransitionDtoSchema,
  spatialMovementExecutionDtoSchema
} from './ruleExecutionEffectEvidence.js'
import {
  MAX_SPATIAL_CANDIDATES,
  spatialMovementKindDtoSchema,
  spatialPointDtoSchema
} from './spatialFacts.js'
import { MAX_SPATIAL_RULE_EFFECTS_PER_SCENE } from './spatial.js'
export const movementCompleteRuleExecutionResultDtoSchema = lazySchema(() =>
  z.strictObject({
    /** A move completed without any spatial-effect execution. */
    status: z.literal('MOVEMENT_COMPLETE'),
    schemaVersion: z.literal(1),
    occurrenceId: uuidSchema,
    occurrenceVersion: aggregateVersionSchema,
    encounterId: uuidSchema,
    encounterVersion: aggregateVersionSchema,
    sceneId: uuidSchema,
    sceneVersion: aggregateVersionSchema,
    tokenId: uuidSchema,
    movementKind: spatialMovementKindDtoSchema,
    terminalPosition: spatialPointDtoSchema
  })
)

export const encounterSpatialMovementBatchRuleExecutionResultDtoSchema = lazySchema(() =>
  z
    .strictObject({
      status: z.literal('BATCH_COMPLETE'),
      batchKind: z.literal('ENCOUNTER_SPATIAL_MOVEMENT'),
      schemaVersion: z.literal(1),
      occurrenceId: uuidSchema,
      occurrenceVersion: aggregateVersionSchema,
      encounterId: uuidSchema,
      encounterVersion: aggregateVersionSchema,
      sceneId: uuidSchema,
      sceneVersion: aggregateVersionSchema,
      tokenId: uuidSchema,
      movementKind: spatialMovementKindDtoSchema,
      terminalPosition: spatialPointDtoSchema,
      executions: z
        .array(spatialMovementExecutionDtoSchema)
        .check(z.minLength(1))
        .check(z.maxLength(MAX_SPATIAL_CANDIDATES)),
      spatialEffectTransitions: z
        .array(spatialEffectTransitionEntryDtoSchema)
        .check(z.minLength(1))
        .check(z.maxLength(MAX_SPATIAL_CANDIDATES)),
      characterTransitions: z
        .array(spatialMovementCharacterTransitionDtoSchema)
        .check(z.maxLength(MAX_SPATIAL_CANDIDATES)),
      encounterActorTransitions: z
        .array(spatialMovementEncounterActorTransitionDtoSchema)
        .check(z.maxLength(MAX_SPATIAL_CANDIDATES)),
      /** Server-only original records for deleted roots still needed by frozen later contacts. */
      consumedSpatialEffects: z.optional(
        z
          .array(encounterSpatialRuleEffectRecordSchema)
          .check(z.maxLength(MAX_SPATIAL_RULE_EFFECTS_PER_SCENE))
      ),
      /**
       * How many spatial executions had settled each time a reaction child of the move committed
       * (D219). The child's own receipt proves what it changed, so the timeline proof below starts
       * again at the execution with that ordinal.
       */
      reactionChildBoundaries: z.optional(
        z.array(ruleExecutionPositiveIntegerSchema).check(z.maxLength(MAX_SPATIAL_CANDIDATES))
      )
    })
    .check(
      z.superRefine((batch, context) => {
        const ownerKeys = new Set<string>()
        const transitions = new Map<
          string,
          {
            targetActorId: string
            before: z.infer<typeof characterMechanicsTargetStateDtoSchema>
            after: z.infer<typeof characterMechanicsTargetStateDtoSchema>
            beforeStreamVersion?: number
            afterStreamVersion?: number
          }
        >()
        const actorIds = new Set<string>()
        let priorCharacterId = ''
        for (const [index, transition] of batch.characterTransitions.entries()) {
          if (
            transition.afterStreamVersion <= transition.beforeStreamVersion ||
            ownerKeys.has(transition.characterId) ||
            actorIds.has(transition.targetActorId) ||
            transition.characterId <= priorCharacterId
          )
            context.addIssue({
              code: 'custom',
              path: ['characterTransitions', index],
              message:
                'Spatial Character transitions must be unique, ordered, and retain a proved positive span.'
            })
          ownerKeys.add(transition.characterId)
          actorIds.add(transition.targetActorId)
          transitions.set(`CHARACTER:${transition.characterId}`, transition)
          priorCharacterId = transition.characterId
        }
        let priorActorId = ''
        for (const [index, transition] of batch.encounterActorTransitions.entries()) {
          if (actorIds.has(transition.targetActorId) || transition.targetActorId <= priorActorId)
            context.addIssue({
              code: 'custom',
              path: ['encounterActorTransitions', index],
              message: 'Spatial Encounter actor transitions must be unique and ordered.'
            })
          actorIds.add(transition.targetActorId)
          transitions.set(`ENCOUNTER_ACTOR:${transition.targetActorId}`, transition)
          priorActorId = transition.targetActorId
        }
        const candidateKeys = new Set<string>()
        const effects = new Map<string, z.infer<typeof spatialEffectCurrentnessPinDtoSchema>>()
        let prior: z.infer<typeof spatialPendingCandidateDtoSchema> | null = null
        for (const [index, execution] of batch.executions.entries()) {
          const candidate = execution.candidate
          const key = `${candidate.candidate.pathDistance}:${candidate.candidate.effectId}:${candidate.candidate.targetActorId}:${candidate.candidate.trigger}:${candidate.candidate.sourceActorId ?? ''}:${candidate.candidate.sourceMoved}`
          if (
            execution.ordinal !== index ||
            candidate.ordinal !== index ||
            candidateKeys.has(key) ||
            (prior !== null && compareSpatialPendingCandidates(prior, candidate) >= 0)
          )
            context.addIssue({
              code: 'custom',
              path: ['executions', index],
              message:
                'Spatial terminal executions must retain the strict ordered candidate sequence.'
            })
          candidateKeys.add(key)
          prior = candidate
          const priorEffect = effects.get(candidate.effect.effectId)
          if (
            priorEffect !== undefined &&
            JSON.stringify(priorEffect) !== JSON.stringify(candidate.effect)
          )
            context.addIssue({
              code: 'custom',
              path: ['executions', index, 'candidate', 'effect'],
              message:
                'Spatial executions for one root must retain an identical frozen currentness snapshot.'
            })
          effects.set(candidate.effect.effectId, candidate.effect)
        }
        let priorEffectId = ''
        const transitionedEffectIds = new Set<string>()
        const transitionsByEffectId = new Map<
          string,
          z.infer<typeof spatialEffectTransitionEntryDtoSchema>['transition']
        >()
        for (const [index, entry] of batch.spatialEffectTransitions.entries()) {
          const effect = effects.get(entry.effectId)
          if (
            transitionedEffectIds.has(entry.effectId) ||
            entry.effectId <= priorEffectId ||
            effect === undefined
          )
            context.addIssue({
              code: 'custom',
              path: ['spatialEffectTransitions', index],
              message:
                'Spatial root transitions must be unique, canonical, and match executed roots.'
            })
          if (effect !== undefined)
            refineSpatialEffectTransition(effect, entry.transition, context, [
              'spatialEffectTransitions',
              index,
              'transition'
            ])
          transitionedEffectIds.add(entry.effectId)
          transitionsByEffectId.set(entry.effectId, entry.transition)
          priorEffectId = entry.effectId
        }
        if (
          transitionedEffectIds.size !== effects.size ||
          [...effects.keys()].some((effectId) => !transitionedEffectIds.has(effectId))
        )
          context.addIssue({
            code: 'custom',
            path: ['spatialEffectTransitions'],
            message:
              'Spatial terminal batches must retain exactly one root transition per executed effect.'
          })
        let priorConsumedEffectId = ''
        for (const [index, record] of (batch.consumedSpatialEffects ?? []).entries()) {
          const effect = effects.get(record.id)
          const transition = transitionsByEffectId.get(record.id)
          const definition = record.definition
          if (
            record.id <= priorConsumedEffectId ||
            record.encounterId !== batch.encounterId ||
            record.sceneId !== batch.sceneId ||
            effect === undefined ||
            transition?.kind !== 'DELETE' ||
            record.version !== effect.version ||
            record.definitionChecksum !== effect.definitionChecksum ||
            record.lifecycleChecksum !== effect.lifecycleChecksum ||
            record.placementChecksum !== effect.placementChecksum ||
            record.spatialStateChecksum !== effect.spatialStateChecksum ||
            definition.authoredEffectId !== effect.authoredEffectId ||
            definition.compiledEntryId !== effect.compiledEntryId ||
            definition.frozenGraphNodeId !== effect.frozenGraphNodeId ||
            definition.frozenGraph.source.definitionId !== effect.authoredEffectId ||
            definition.frozenGraph.source.checksum !== effect.frozenSourceChecksum ||
            definition.frozenGraph.capabilityContractVersion !== effect.capabilityContractVersion ||
            checksumRuleDocument(definition) !== record.definitionChecksum ||
            checksumRuleDocument(record.lifecycle) !== record.lifecycleChecksum ||
            checksumRuleDocument(record.placement) !== record.placementChecksum ||
            checksumRuleDocument(record.spatialState) !== record.spatialStateChecksum
          )
            context.addIssue({
              code: 'custom',
              path: ['consumedSpatialEffects', index],
              message:
                'Consumed spatial roots must retain the exact deleted, executed Encounter/Scene record.'
            })
          priorConsumedEffectId = record.id
        }
        /**
         * Death saves are not chained here: a later contact can change them after an earlier
         * Concentration end was planned, and the movement settlement carries them (D96).
         */
        const sameState = (
          left: z.infer<typeof characterMechanicsTargetStateDtoSchema>,
          right: z.infer<typeof characterMechanicsTargetStateDtoSchema>
        ) =>
          JSON.stringify({ ...left, deathSaves: null }) ===
          JSON.stringify({ ...right, deathSaves: null })
        /**
         * The persisted state an end observes may carry conditions the System derived from the
         * contact's hit point change (D63), which the contact's own transition does not list.
         */
        const continuesWithDerivedConditions = (
          prior: z.infer<typeof characterMechanicsTargetStateDtoSchema>,
          observed: z.infer<typeof characterMechanicsTargetStateDtoSchema>
        ) =>
          sameState({ ...observed, conditionIds: prior.conditionIds }, prior) &&
          prior.conditionIds.every((id) => observed.conditionIds.includes(id))
        const actorCharacters = new Map<string, string>()
        const characterActors = new Map<string, string>()
        const bindCharacter = (actorId: string, characterId: string, path: (string | number)[]) => {
          if (
            (actorCharacters.has(actorId) && actorCharacters.get(actorId) !== characterId) ||
            (characterActors.has(characterId) && characterActors.get(characterId) !== actorId)
          )
            context.addIssue({
              code: 'custom',
              path,
              message: 'Spatial receipts must retain one exact actor to Character binding.'
            })
          actorCharacters.set(actorId, characterId)
          characterActors.set(characterId, actorId)
        }
        for (const execution of batch.executions)
          if (execution.candidate.target.kind === 'CHARACTER')
            bindCharacter(
              execution.candidate.candidate.targetActorId,
              execution.candidate.target.characterId,
              ['executions', execution.ordinal, 'candidate', 'target']
            )
        for (const transition of batch.characterTransitions)
          bindCharacter(transition.targetActorId, transition.characterId, ['characterTransitions'])

        const currentStates = new Map<
          string,
          z.infer<typeof characterMechanicsTargetStateDtoSchema>
        >()
        const currentVersions = new Map<string, number>()
        const spatialSummaries = new Map<
          string,
          {
            before: z.infer<typeof characterMechanicsTargetStateDtoSchema>
            after: z.infer<typeof characterMechanicsTargetStateDtoSchema>
            beforeVersion: number | null
            afterVersion: number | null
            changed: boolean
          }
        >()
        const openSpatialGroups = new Map<
          string,
          {
            actorId: string
            characterId: string | null
            before: z.infer<typeof characterMechanicsTargetStateDtoSchema>
            after: z.infer<typeof characterMechanicsTargetStateDtoSchema>
            version: number | null
          }
        >()
        const finishSpatialGroups = () => {
          for (const [ownerKey, group] of openSpatialGroups) {
            const changed = !sameState(group.before, group.after)
            const beforeVersion = group.version
            const afterVersion =
              group.characterId === null || beforeVersion === null
                ? null
                : beforeVersion + (changed ? 1 : 0)
            if (group.characterId !== null && afterVersion !== null)
              currentVersions.set(group.characterId, afterVersion)
            const summary = spatialSummaries.get(ownerKey)
            // A contact that changes nothing adds nothing to the cumulative span; what happened
            // since (such as a Concentration end) is proved by its own transitions.
            if (summary) {
              if (changed) {
                summary.after = group.after
                summary.afterVersion = afterVersion
                summary.changed = true
              }
            } else
              spatialSummaries.set(ownerKey, {
                before: group.before,
                after: group.after,
                beforeVersion,
                afterVersion,
                changed
              })
            currentStates.set(ownerKey, group.after)
          }
          openSpatialGroups.clear()
        }
        /** A contact's children in the order they settled; `release` is the cleanup each one retained. */
        const applyMovementChildren = (
          children: readonly {
            path: (string | number)[]
            releasePath: string[]
            check:
              | MovementConcentrationExecutionDto
              | MovementConcentrationEndDto
              | MovementRepeatSaveExecutionDto
            release: MovementRepeatSaveExecutionDto['release']
            /** A release changes derived conditions; a Concentration check keeps the exact state. */
            derivesConditions: boolean
          }[]
        ) => {
          for (const {
            path: checkPath,
            releasePath,
            check,
            release,
            derivesConditions
          } of children) {
            const output = check.result.applicationOutputs
            if (output.parentOccurrenceId !== batch.occurrenceId)
              context.addIssue({
                code: 'custom',
                path: [...checkPath, 'result', 'applicationOutputs', 'parentOccurrenceId'],
                message: 'Movement Concentration children must bind their terminal movement batch.'
              })
            if (release === null) {
              if (check.ownerTransitions.length > 0)
                context.addIssue({
                  code: 'custom',
                  path: [...checkPath, 'ownerTransitions'],
                  message:
                    'Successful Concentration checks cannot retain cleanup owner transitions.'
                })
              continue
            }
            const cleanupTransitions = new Map<
              string,
              (typeof release.characterOwnerTransitions)[number]
            >()
            for (const [
              cleanupIndex,
              cleanupTransition
            ] of release.characterOwnerTransitions.entries()) {
              if (
                cleanupTransitions.has(cleanupTransition.characterId) ||
                cleanupTransition.afterStreamVersion !== cleanupTransition.beforeStreamVersion + 1
              )
                context.addIssue({
                  code: 'custom',
                  path: [...checkPath, ...releasePath, 'characterOwnerTransitions', cleanupIndex],
                  message:
                    'Concentration cleanup Character transitions must be unique and advance exactly once.'
                })
              const currentVersion = currentVersions.get(cleanupTransition.characterId)
              if (
                currentVersion !== undefined &&
                currentVersion !== cleanupTransition.beforeStreamVersion
              )
                context.addIssue({
                  code: 'custom',
                  path: [...checkPath, ...releasePath, 'characterOwnerTransitions', cleanupIndex],
                  message:
                    'Concentration cleanup Character versions must continue the movement receipt timeline.'
                })
              cleanupTransitions.set(cleanupTransition.characterId, cleanupTransition)
              currentVersions.set(
                cleanupTransition.characterId,
                cleanupTransition.afterStreamVersion
              )
            }
            const ownerTransitions = new Map<string, (typeof check.ownerTransitions)[number]>()
            for (const [ownerIndex, ownerTransition] of check.ownerTransitions.entries()) {
              const ownerPath = [...checkPath, 'ownerTransitions', ownerIndex]
              ownerTransitions.set(ownerTransition.targetActorId, ownerTransition)
              if (ownerTransition.characterId !== null) {
                if (!cleanupTransitions.has(ownerTransition.characterId))
                  context.addIssue({
                    code: 'custom',
                    path: ownerPath,
                    message:
                      'Concentration Character actor changes must bind cleanup version evidence.'
                  })
                bindCharacter(ownerTransition.targetActorId, ownerTransition.characterId, ownerPath)
              } else if (actorCharacters.has(ownerTransition.targetActorId))
                context.addIssue({
                  code: 'custom',
                  path: [...ownerPath, 'characterId'],
                  message: 'Concentration actor changes must retain their proved Character binding.'
                })
              const ownerKey =
                ownerTransition.characterId === null
                  ? `ENCOUNTER_ACTOR:${ownerTransition.targetActorId}`
                  : `CHARACTER:${ownerTransition.characterId}`
              const priorState = currentStates.get(ownerKey)
              if (
                priorState !== undefined &&
                !(derivesConditions
                  ? continuesWithDerivedConditions(priorState, ownerTransition.before)
                  : sameState(priorState, ownerTransition.before))
              )
                context.addIssue({
                  code: 'custom',
                  path: [...ownerPath, 'before'],
                  message: 'Concentration cleanup must continue the proved owner state.'
                })
              currentStates.set(ownerKey, ownerTransition.after)
            }
            for (const characterId of cleanupTransitions.keys()) {
              const actorId = characterActors.get(characterId)
              if (
                actorId !== undefined &&
                ownerTransitions.get(actorId)?.characterId !== characterId
              )
                context.addIssue({
                  code: 'custom',
                  path: [...checkPath, 'ownerTransitions'],
                  message:
                    'Concentration cleanup must retain a proved actor transition for represented Characters.'
                })
            }
          }
        }
        const reactionChildBoundaries = new Set(batch.reactionChildBoundaries)
        if (
          (batch.reactionChildBoundaries ?? []).some(
            (boundary, index, boundaries) =>
              boundary > batch.executions.length ||
              (index > 0 && boundary <= boundaries[index - 1]!)
          )
        )
          context.addIssue({
            code: 'custom',
            path: ['reactionChildBoundaries'],
            message: 'Reaction child boundaries must be ordered and lie within the executions.'
          })
        for (const [index, execution] of batch.executions.entries()) {
          if (reactionChildBoundaries.has(execution.ordinal)) {
            finishSpatialGroups()
            currentStates.clear()
            currentVersions.clear()
            // An owner no contact had changed starts its span after the child.
            for (const [ownerKey, summary] of spatialSummaries)
              if (!summary.changed) spatialSummaries.delete(ownerKey)
          }
          const actorId = execution.candidate.candidate.targetActorId
          const characterId =
            execution.candidate.target.kind === 'CHARACTER'
              ? execution.candidate.target.characterId
              : null
          const ownerKey =
            characterId === null ? `ENCOUNTER_ACTOR:${actorId}` : `CHARACTER:${characterId}`
          const pinVersion =
            execution.candidate.target.kind === 'CHARACTER'
              ? execution.candidate.target.streamVersion
              : null
          let currentVersion = characterId === null ? undefined : currentVersions.get(characterId)
          const open = openSpatialGroups.get(ownerKey)
          if (
            open &&
            (open.version !== pinVersion ||
              !sameState(open.after, execution.targetTransition.before))
          ) {
            finishSpatialGroups()
            currentVersion = characterId === null ? undefined : currentVersions.get(characterId)
          }
          const priorState = openSpatialGroups.get(ownerKey)?.after ?? currentStates.get(ownerKey)
          if (
            (priorState !== undefined &&
              !sameState(priorState, execution.targetTransition.before)) ||
            (currentVersion !== undefined && currentVersion !== pinVersion)
          )
            context.addIssue({
              code: 'custom',
              path: ['executions', index, 'targetTransition'],
              message: 'Spatial target pins must continue the proved movement receipt timeline.'
            })
          if (!openSpatialGroups.has(ownerKey))
            openSpatialGroups.set(ownerKey, {
              actorId,
              characterId,
              before: execution.targetTransition.before,
              after: execution.targetTransition.after,
              version: pinVersion
            })
          else openSpatialGroups.get(ownerKey)!.after = execution.targetTransition.after
          if (characterId !== null && currentVersion === undefined)
            currentVersions.set(characterId, pinVersion!)
          if (
            execution.concentrationEnds !== undefined ||
            execution.concentrationChecks !== undefined ||
            execution.repeatSaves !== undefined
          ) {
            finishSpatialGroups()
            applyMovementChildren([
              ...(execution.concentrationEnds ?? []).map((check, childIndex) => ({
                path: ['executions', index, 'concentrationEnds', childIndex],
                releasePath: ['result', 'applicationOutputs', 'cleanup'],
                check,
                release: check.result.applicationOutputs.cleanup,
                derivesConditions: true
              })),
              ...movementDamageSaveChildren(execution).map((child) => ({
                path: ['executions', index, child.field, child.index],
                releasePath:
                  child.kind === 'CONCENTRATION'
                    ? ['result', 'applicationOutputs', 'cleanup']
                    : ['release'],
                check: child.execution,
                release: child.release,
                derivesConditions: child.kind === 'REPEAT_SAVE'
              }))
            ])
          }
        }
        finishSpatialGroups()
        for (const [ownerKey, summary] of spatialSummaries) {
          const transition = transitions.get(ownerKey)
          if (
            (summary.changed && transition === undefined) ||
            (!summary.changed && transition !== undefined) ||
            (transition !== undefined &&
              (!sameState(transition.before, summary.before) ||
                !sameState(transition.after, summary.after) ||
                (summary.beforeVersion !== null &&
                  (transition.beforeStreamVersion !== summary.beforeVersion ||
                    transition.afterStreamVersion !== summary.afterVersion)) ||
                transition.targetActorId !==
                  (ownerKey.startsWith('CHARACTER:')
                    ? characterActors.get(ownerKey.slice('CHARACTER:'.length))
                    : ownerKey.slice('ENCOUNTER_ACTOR:'.length))))
          )
            context.addIssue({
              code: 'custom',
              path: ['characterTransitions'],
              message:
                'Spatial summaries must retain exact cumulative spatial endpoints and proved versions.'
            })
        }
        for (const ownerKey of transitions.keys())
          if (!spatialSummaries.has(ownerKey))
            context.addIssue({
              code: 'custom',
              path: ['characterTransitions'],
              message: 'Spatial summaries must not claim owners without spatial execution evidence.'
            })
      })
    )
)
