import { z, lazySchema } from '../zod.js'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'

import { encounterSpatialRuleEffectRecordSchema } from '../projections/spatialRuleEffectPersistence.js'
import { characterMechanicsTargetStateDtoSchema } from './ruleExecutionMechanics.js'
import type {
  MovementConcentrationEndDto,
  MovementConcentrationExecutionDto
} from './ruleExecutionMovementConcentration.js'
import { movementReactionActionExecutionDtoSchema } from './ruleExecutionMovementReactionReceipts.js'
import {
  ruleExecutionAggregateVersionSchema as aggregateVersionSchema,
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
import { MAX_ENCOUNTER_ACTORS } from './authoredLimits.js'
export const movementCompleteRuleExecutionResultDtoSchema = lazySchema(() =>
  z.strictObject({
    /** A reaction-bearing movement completed without any spatial-effect execution. */
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
    reactionExecutions: z._default(
      z.array(movementReactionActionExecutionDtoSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
      []
    ),
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
      reactionExecutions: z._default(
        z.array(movementReactionActionExecutionDtoSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
        []
      ),
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
              message:
                'Spatial and reaction receipts must retain one exact actor to Character binding.'
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
        for (const [index, reaction] of batch.reactionExecutions.entries())
          if (reaction.targetCharacterId !== undefined)
            bindCharacter(reaction.option.candidate.movingActorId, reaction.targetCharacterId, [
              'reactionExecutions',
              index,
              'targetCharacterId'
            ])

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
        const applyConcentrationChildren = (
          children: readonly (MovementConcentrationExecutionDto | MovementConcentrationEndDto)[],
          path: (string | number)[],
          key: 'concentrationEnd' | 'concentrationChecks'
        ) => {
          for (const [index, check] of children.entries()) {
            const checkPath = [...path, key, index]
            const output = check.result.applicationOutputs
            if (output.parentOccurrenceId !== batch.occurrenceId)
              context.addIssue({
                code: 'custom',
                path: [...checkPath, 'result', 'applicationOutputs', 'parentOccurrenceId'],
                message: 'Movement Concentration children must bind their terminal movement batch.'
              })
            if (output.cleanup === null) {
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
              (typeof output.cleanup.characterOwnerTransitions)[number]
            >()
            for (const [
              cleanupIndex,
              cleanupTransition
            ] of output.cleanup.characterOwnerTransitions.entries()) {
              if (
                cleanupTransitions.has(cleanupTransition.characterId) ||
                cleanupTransition.afterStreamVersion !== cleanupTransition.beforeStreamVersion + 1
              )
                context.addIssue({
                  code: 'custom',
                  path: [
                    ...checkPath,
                    'result',
                    'applicationOutputs',
                    'cleanup',
                    'characterOwnerTransitions',
                    cleanupIndex
                  ],
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
                  path: [
                    ...checkPath,
                    'result',
                    'applicationOutputs',
                    'cleanup',
                    'characterOwnerTransitions',
                    cleanupIndex
                  ],
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
                !(key === 'concentrationEnd'
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
        const timeline = [
          ...batch.executions.map((execution, index) => ({
            kind: 'SPATIAL' as const,
            index,
            ordinal: execution.ordinal,
            distance: execution.candidate.candidate.pathDistance,
            value: execution
          })),
          ...batch.reactionExecutions.map((reaction, index) => ({
            kind: 'REACTION' as const,
            index,
            ordinal: reaction.ordinal,
            distance: reaction.option.candidate.pathDistance,
            value: reaction
          }))
        ].sort(
          (left, right) =>
            left.distance - right.distance ||
            (left.kind === right.kind
              ? left.ordinal - right.ordinal
              : left.kind === 'SPATIAL'
                ? -1
                : 1)
        )
        let priorReactionDistance = -1
        for (const [index, reaction] of batch.reactionExecutions.entries()) {
          if (reaction.option.candidate.pathDistance < priorReactionDistance)
            context.addIssue({
              code: 'custom',
              path: ['reactionExecutions', index, 'option', 'candidate', 'pathDistance'],
              message: 'Reaction receipts must retain their sealed chronological contact order.'
            })
          priorReactionDistance = reaction.option.candidate.pathDistance
        }
        for (const event of timeline) {
          if (event.ordinal !== event.index)
            context.addIssue({
              code: 'custom',
              path: [
                event.kind === 'SPATIAL' ? 'executions' : 'reactionExecutions',
                event.index,
                'ordinal'
              ],
              message: 'Movement receipt ordinals must retain their canonical within-kind order.'
            })
          if (event.kind === 'SPATIAL') {
            const execution = event.value
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
                path: ['executions', event.index, 'targetTransition'],
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
              execution.concentrationEnd !== undefined ||
              execution.concentrationChecks !== undefined
            ) {
              finishSpatialGroups()
              applyConcentrationChildren(
                execution.concentrationEnd ? [execution.concentrationEnd] : [],
                ['executions', event.index],
                'concentrationEnd'
              )
              applyConcentrationChildren(
                execution.concentrationChecks ?? [],
                ['executions', event.index],
                'concentrationChecks'
              )
            }
            continue
          }
          finishSpatialGroups()
          const reaction = event.value
          const application = reaction.application
          if (
            application.kind !== 'CHARACTER_MECHANICS_BATCH' &&
            application.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
          ) {
            context.addIssue({
              code: 'custom',
              path: ['reactionExecutions', event.index, 'application'],
              message: 'Mixed spatial timelines require a mechanics batch reaction application.'
            })
            continue
          }
          const sourceActorId = reaction.option.candidate.reactorActorId
          const targetActorId = reaction.option.candidate.movingActorId
          if (
            application.sourceActorId !== sourceActorId ||
            application.targetActorId !== targetActorId
          )
            context.addIssue({
              code: 'custom',
              path: ['reactionExecutions', event.index, 'application'],
              message:
                'Reaction mechanics application must bind the selected source and moving target.'
            })
          if (reaction.option.authority.kind === 'CHARACTER_CONTROLLER')
            bindCharacter(sourceActorId, reaction.option.authority.characterId, [
              'reactionExecutions',
              event.index,
              'option',
              'authority'
            ])
          const targetOwnerKey = actorCharacters.has(targetActorId)
            ? `CHARACTER:${actorCharacters.get(targetActorId)!}`
            : `ENCOUNTER_ACTOR:${targetActorId}`
          const priorTargetState = currentStates.get(targetOwnerKey)
          if (
            priorTargetState !== undefined &&
            !sameState(priorTargetState, application.targetTransition.before)
          )
            context.addIssue({
              code: 'custom',
              path: ['reactionExecutions', event.index, 'application', 'targetTransition'],
              message: `Reaction target transition must bridge the preceding spatial state exactly. PRIOR=${JSON.stringify(priorTargetState)} BEFORE=${JSON.stringify(application.targetTransition.before)}`
            })
          currentStates.set(targetOwnerKey, application.targetTransition.after)
          const expectedTransitions = new Map<string, { before: number; after: number }>()
          const expectCharacterVersion = (characterId: string, before: number) => {
            const currentVersion = currentVersions.get(characterId)
            if (currentVersion !== undefined && currentVersion !== before)
              context.addIssue({
                code: 'custom',
                path: ['reactionExecutions', event.index, 'characterTransitions'],
                message:
                  'Reaction Character versions must continue the proved movement receipt timeline.'
              })
            if (currentVersion === undefined) currentVersions.set(characterId, before)
          }
          if (application.kind === 'CHARACTER_MECHANICS_BATCH') {
            if (
              application.sourceCharacterId !== null &&
              application.sourceCharacterId !== actorCharacters.get(sourceActorId)
            )
              context.addIssue({
                code: 'custom',
                path: ['reactionExecutions', event.index, 'application', 'sourceCharacterId'],
                message:
                  'Reaction source Character identity must match the issued controller authority.'
              })
            if (application.sourceCharacterId !== null)
              bindCharacter(sourceActorId, application.sourceCharacterId, [
                'reactionExecutions',
                event.index,
                'application',
                'sourceCharacterId'
              ])
            if (application.sourceCharacterStreamVersion !== null) {
              if (application.sourceCharacterId === null)
                context.addIssue({
                  code: 'custom',
                  path: [
                    'reactionExecutions',
                    event.index,
                    'application',
                    'sourceCharacterStreamVersion'
                  ],
                  message:
                    'Reaction source Character version requires its immutable Character identity.'
                })
              else
                expectCharacterVersion(
                  application.sourceCharacterId,
                  application.sourceCharacterStreamVersion - 1
                )
              if (application.sourceCharacterId !== null)
                expectedTransitions.set(application.sourceCharacterId, {
                  before: application.sourceCharacterStreamVersion - 1,
                  after: application.sourceCharacterStreamVersion
                })
            }
            const targetCharacterId = actorCharacters.get(targetActorId)
            if (application.targetCharacterStreamVersion !== null) {
              if (!targetCharacterId)
                context.addIssue({
                  code: 'custom',
                  path: [
                    'reactionExecutions',
                    event.index,
                    'application',
                    'targetCharacterStreamVersion'
                  ],
                  message:
                    'Reaction target Character version requires a proved target actor binding.'
                })
              else
                expectCharacterVersion(
                  targetCharacterId,
                  application.targetCharacterStreamVersion - 1
                )
              if (targetCharacterId)
                expectedTransitions.set(targetCharacterId, {
                  before: application.targetCharacterStreamVersion - 1,
                  after: application.targetCharacterStreamVersion
                })
            }
          } else if (application.sourceCharacterStreamVersion !== null) {
            const sourceCharacterId = actorCharacters.get(sourceActorId)
            if (!sourceCharacterId)
              context.addIssue({
                code: 'custom',
                path: [
                  'reactionExecutions',
                  event.index,
                  'application',
                  'sourceCharacterStreamVersion'
                ],
                message: 'Reaction source Character version requires a proved source actor binding.'
              })
            else
              expectCharacterVersion(
                sourceCharacterId,
                application.sourceCharacterStreamVersion - 1
              )
            if (sourceCharacterId)
              expectedTransitions.set(sourceCharacterId, {
                before: application.sourceCharacterStreamVersion - 1,
                after: application.sourceCharacterStreamVersion
              })
          }
          for (const transition of application.maintenanceTransition?.characterOwnerTransitions ??
            []) {
            expectCharacterVersion(transition.characterId, transition.beforeStreamVersion)
            const expected = expectedTransitions.get(transition.characterId)
            if (
              expected &&
              (expected.before !== transition.beforeStreamVersion ||
                expected.after !== transition.afterStreamVersion)
            )
              context.addIssue({
                code: 'custom',
                path: ['reactionExecutions', event.index, 'characterTransitions'],
                message:
                  'Reaction maintenance and mechanics Character spans must agree for shared owners.'
              })
            expectedTransitions.set(transition.characterId, {
              before: transition.beforeStreamVersion,
              after: transition.afterStreamVersion
            })
          }
          for (const transition of reaction.characterTransitions) {
            const expected = expectedTransitions.get(transition.characterId)
            if (
              !expected ||
              transition.beforeStreamVersion !== expected.before ||
              transition.afterStreamVersion !== expected.after
            )
              context.addIssue({
                code: 'custom',
                path: ['reactionExecutions', event.index, 'characterTransitions'],
                message:
                  'Reaction Character transitions must prove each source and target mechanics span.'
              })
            expectedTransitions.delete(transition.characterId)
            currentVersions.set(transition.characterId, transition.afterStreamVersion)
          }
          if (expectedTransitions.size > 0)
            context.addIssue({
              code: 'custom',
              path: ['reactionExecutions', event.index, 'characterTransitions'],
              message: 'Reaction Character transitions must retain every proved mechanics span.'
            })
          for (const [index, transition] of (
            reaction.maintenanceOwnerTransitions ?? []
          ).entries()) {
            if (transition.characterId !== null)
              bindCharacter(transition.targetActorId, transition.characterId, [
                'reactionExecutions',
                event.index,
                'maintenanceOwnerTransitions',
                index
              ])
            const ownerKey =
              transition.characterId === null
                ? `ENCOUNTER_ACTOR:${transition.targetActorId}`
                : `CHARACTER:${transition.characterId}`
            const priorState = currentStates.get(ownerKey)
            if (priorState !== undefined && !sameState(priorState, transition.before))
              context.addIssue({
                code: 'custom',
                path: [
                  'reactionExecutions',
                  event.index,
                  'maintenanceOwnerTransitions',
                  index,
                  'before'
                ],
                message: 'Reaction maintenance cleanup must continue the proved owner state.'
              })
            currentStates.set(ownerKey, transition.after)
          }
          applyConcentrationChildren(
            reaction.concentrationEnd ? [reaction.concentrationEnd] : [],
            ['reactionExecutions', event.index],
            'concentrationEnd'
          )
          applyConcentrationChildren(
            reaction.concentrationChecks ?? [],
            ['reactionExecutions', event.index],
            'concentrationChecks'
          )
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
