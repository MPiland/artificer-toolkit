import { z, lazySchema } from '../zod.js'

import {
  characterRulePolicyInputSchema,
  characterRulePolicyOutputSchema,
  characterRuleSenseRangeSchema
} from '../api/characterRules.js'
import { characterAuthoredDtoSchema } from '../subjects/character.js'
import { characterProvenanceDtoSchema } from '../subjects/characterIntent.js'
import { rangeDtoSchema } from '../shared/range.js'
import { shapeDtoSchema } from '../shared/shape.js'
import { targetingDtoSchema } from '../effects/targeting.js'
import { ruleValueDtoSchema } from '../api/rulesRuntime.js'
import {
  combatPerceptionContributionsDtoSchema,
  senseReusableDefinitionDocumentDtoSchema
} from '../shared/combatPerception.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  authoredVersionVectorSchema,
  jsonValueSchema,
  projectionChecksumSchema,
  projectionIdentifierSchema,
  projectionSchemaVersionSchema
} from './identity.js'
import {
  serverPublishedRuleDefinitionDtoSchema,
  ruleGraphSourceIdentityDtoSchema
} from '../shared/ruleExecutionCore.js'
import { serverUuidIdentityDtoSchema } from '../shared/serverUuidIdentity.js'
import { characterInitiativeActorFactsSchema } from './characterInitiativeFacts.js'
import { actorRelationshipModuleDtoSchema } from '../effects/actorRelationship.js'
import { characterResourcePoolIdentitySchema } from '../shared/characterResourceIdentity.js'

const nonNegativeStreamVersionSchema = lazySchema(() => z.number().check(z.int()).check(z.gte(0)))
const compiledActionResourceIdentitySchema = lazySchema(() =>
  z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240))
)

/**
 * Server-only source retained by a freshly compiled Character action.  It is
 * intentionally a source document, not a second executable graph: the
 * System compiler specializes its bounded TEST/OUTCOME phases only after the
 * Encounter command locks actor, target, cast, and scaling facts.
 */
const compiledActionCompilerSourceSchema = lazySchema(() =>
  z
    .strictObject({
      schemaVersion: z.literal(1),
      sourceId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240)),
      entryPointDefinitionId: serverUuidIdentityDtoSchema,
      effectId: serverUuidIdentityDtoSchema,
      conditionDefinitionIds: z.array(serverUuidIdentityDtoSchema).check(z.maxLength(1_000)),
      savingThrowAbilityDefinitionId: z.nullable(serverUuidIdentityDtoSchema),
      /** The exact compiler-normalized Effect; never exposed by a recipient projection. */
      compiledEffect: jsonValueSchema,
      compiledEffectChecksum: projectionChecksumSchema,
      capabilityContractVersion: z.number().check(z.int()).check(z.positive()).check(z.lte(10_000)),
      compilerSourceChecksum: projectionChecksumSchema
    })
    .check(
      z.superRefine((source, context) => {
        const sortedIds = [...source.conditionDefinitionIds].sort((left, right) =>
          left.localeCompare(right)
        )
        if (
          source.conditionDefinitionIds.some((id, index) => id !== sortedIds[index]) ||
          new Set(source.conditionDefinitionIds).size !== source.conditionDefinitionIds.length
        ) {
          context.addIssue({
            code: 'custom',
            path: ['conditionDefinitionIds'],
            message: 'Compiled action condition definition identities must be sorted and unique.'
          })
        }
        if (source.entryPointDefinitionId !== source.effectId) {
          context.addIssue({
            code: 'custom',
            path: ['entryPointDefinitionId'],
            message: 'Compiled action source entry point must equal its authored Effect identity.'
          })
        }
        if (checksumRuleDocument(source.compiledEffect) !== source.compiledEffectChecksum) {
          context.addIssue({
            code: 'custom',
            path: ['compiledEffectChecksum'],
            message: 'Compiled action source effect checksum is invalid.'
          })
        }
        const { compilerSourceChecksum: _checksum, ...checksummed } = source
        if (checksumRuleDocument(checksummed) !== source.compilerSourceChecksum) {
          context.addIssue({
            code: 'custom',
            path: ['compilerSourceChecksum'],
            message: 'Compiled action compiler-source checksum is invalid.'
          })
        }
      })
    )
)
export type CompiledActionCompilerSource = z.infer<typeof compiledActionCompilerSourceSchema>

export const pinnedSenseDefinitionSchema = lazySchema(() =>
  z.strictObject({
    senseDefinitionId: serverUuidIdentityDtoSchema,
    definitionVersion: z.number().check(z.int()).check(z.positive()),
    definitionContractVersion: z.number().check(z.int()).check(z.positive()).check(z.lte(10_000)),
    definitionChecksum: z.string().check(z.regex(/^[a-f0-9]{64}$/)),
    document: senseReusableDefinitionDocumentDtoSchema,
    range: characterRuleSenseRangeSchema
  })
)
export type PinnedSenseDefinition = z.infer<typeof pinnedSenseDefinitionSchema>

export {
  characterInitiativeActorFactsSchema,
  type CharacterInitiativeActorFacts
} from './characterInitiativeFacts.js'

const compiledActionResourceBindingSchema = lazySchema(() =>
  z.strictObject({
    poolId: characterResourcePoolIdentitySchema,
    chargeId: compiledActionResourceIdentitySchema,
    cost: z.number().check(z.int()).check(z.gte(1)).check(z.lte(Number.MAX_SAFE_INTEGER))
  })
)
const compiledActionActiveEffectPlanSchema = lazySchema(() =>
  z.strictObject({
    authoredEffectId: serverUuidIdentityDtoSchema,
    compiledEntryId: serverUuidIdentityDtoSchema,
    frozenGraphNodeId: z.string().check(z.regex(/^[a-z][a-z0-9_-]{0,79}$/)),
    frozenGraph: serverPublishedRuleDefinitionDtoSchema,
    capabilityContractVersion: z.number().check(z.int()).check(z.positive()).check(z.lte(10_000)),
    recurrenceStage: z.enum(['NONE', 'START_OF_TURN', 'END_OF_TURN']),
    initialRemaining: z.nullable(z.number().check(z.int()).check(z.gte(1)).check(z.lte(10_000))),
    adapterFacts: z.record(
      z.string().check(z.regex(/^[a-z][a-z0-9.-]{0,79}$/)),
      ruleValueDtoSchema
    ),
    perceptionContributions: combatPerceptionContributionsDtoSchema,
    conditionContribution: z._default(
      z.nullable(z.strictObject({ conditionId: serverUuidIdentityDtoSchema })),
      null
    ),
    actorRelationshipContribution: z._default(
      z.nullable(
        z.strictObject({
          relationshipOutcomeId: serverUuidIdentityDtoSchema,
          modules: z
            .array(actorRelationshipModuleDtoSchema)
            .check(z.minLength(1))
            .check(z.maxLength(32)),
          conditionIds: z.array(serverUuidIdentityDtoSchema).check(z.maxLength(32)),
          capabilitySuppressions: z
            .array(
              z.strictObject({
                contributionId: serverUuidIdentityDtoSchema,
                capabilityDefinitionIds: z
                  .array(serverUuidIdentityDtoSchema)
                  .check(z.minLength(1))
                  .check(z.maxLength(32))
              })
            )
            .check(z.maxLength(32))
        })
      ),
      null
    ),
    maintenance: z._default(
      z.nullable(
        z.strictObject({
          definitionId: serverUuidIdentityDtoSchema,
          /** Resolved under the Encounter transaction before any aggregate mutation. */
          definitionChecksum: z.nullable(z.string().check(z.regex(/^[a-f0-9]{64}$/))),
          owner: z.literal('SOURCE_ACTOR'),
          replacementPolicy: z.literal('REPLACE_SAME_DEFINITION'),
          emptyDependentPolicy: z.enum(['TERMINATE_WHEN_EMPTY', 'RETAIN_UNTIL_TERMINAL'])
        })
      ),
      null
    )
  })
)

const compiledActionTemplateIdentitySchema = ruleGraphSourceIdentityDtoSchema

const compiledActionTestOutcomePlanSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('TEST_OUTCOME'),
      compilerSource: compiledActionCompilerSourceSchema,
      test: z.strictObject({
        published: serverPublishedRuleDefinitionDtoSchema,
        template: compiledActionTemplateIdentitySchema
      }),
      outcomes: z
        .array(
          z.strictObject({
            pathCode: projectionIdentifierSchema,
            template: compiledActionTemplateIdentitySchema
          })
        )
        .check(z.minLength(1))
        .check(z.maxLength(32))
    })
    .check(
      z.superRefine((plan, context) => {
        if (
          plan.test.published.id !== plan.test.template.definitionId ||
          plan.test.published.gameSystemId !== plan.test.template.gameSystemId ||
          plan.test.published.definitionFamilyKey !== plan.test.template.definitionFamilyKey ||
          plan.test.published.checksum !== plan.test.template.checksum
        ) {
          context.addIssue({
            code: 'custom',
            path: ['test'],
            message: 'The TEST template must identify its exact published graph.'
          })
        }
        const paths = new Set<string>()
        for (const [index, outcome] of plan.outcomes.entries()) {
          if (paths.has(outcome.pathCode)) {
            context.addIssue({
              code: 'custom',
              path: ['outcomes', index, 'pathCode'],
              message: 'TEST_OUTCOME paths must be unique.'
            })
          }
          paths.add(outcome.pathCode)
          if (
            outcome.template.definitionId !== plan.compilerSource.effectId ||
            outcome.template.gameSystemId !== plan.test.published.gameSystemId ||
            outcome.template.definitionFamilyKey !== plan.test.published.definitionFamilyKey
          ) {
            context.addIssue({
              code: 'custom',
              path: ['outcomes', index, 'template'],
              message: 'An OUTCOME template must remain in the TEST action family.'
            })
          }
        }
      })
    )
)

const compiledActionExecutionPlanSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('SINGLE_GRAPH'),
      published: serverPublishedRuleDefinitionDtoSchema
    }),
    compiledActionTestOutcomePlanSchema
  ])
)

/**
 * Server-only authored targeting facts retained with a compiled action. This
 * is an identity/audit carrier; the System adapter decides which exact
 * policies are executable.
 */
export const compiledActionTargetPolicySchema = lazySchema(() =>
  z.strictObject({
    range: rangeDtoSchema,
    targeting: z.nullable(targetingDtoSchema),
    shape: z.nullable(shapeDtoSchema),
    pathOverrides: z
      .array(
        z.strictObject({
          entryId: projectionIdentifierSchema,
          pathGroupId: projectionIdentifierSchema,
          pathCode: projectionIdentifierSchema,
          pathOrder: z.number().check(z.int()).check(z.gte(0)).check(z.lte(9_999)),
          entryOrder: z.number().check(z.int()).check(z.gte(0)).check(z.lte(9_999_999)),
          range: z.nullable(rangeDtoSchema),
          targeting: z.nullable(targetingDtoSchema)
        })
      )
      .check(z.maxLength(1_000))
  })
)
export type CompiledActionTargetPolicy = z.infer<typeof compiledActionTargetPolicySchema>

const compiledActionEntryPointSchema = lazySchema(() =>
  z.union([
    z.strictObject({
      schemaVersion: z.literal(1),
      kind: z.literal('CHARACTER_ACTION'),
      actionId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240)),
      effectId: serverUuidIdentityDtoSchema,
      targetPolicy: z.optional(compiledActionTargetPolicySchema),
      compilation: z.strictObject({
        kind: z.literal('COMPILED'),
        published: serverPublishedRuleDefinitionDtoSchema
      })
    }),
    z.strictObject({
      schemaVersion: z.literal(4),
      kind: z.literal('CHARACTER_SPELL_CAST'),
      /** The exact current Character spell-cast candidate identity. */
      actionId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(1_000)),
      effectId: serverUuidIdentityDtoSchema,
      spell: z.strictObject({
        spellId: projectionIdentifierSchema,
        versionId: projectionIdentifierSchema,
        version: projectionSchemaVersionSchema,
        checksum: projectionChecksumSchema,
        sourceKind: z.enum([
          'BACKGROUND',
          'CLASS',
          'FEAT',
          'FEATURE',
          'ITEM',
          'OPTION',
          'RACE',
          'SUBCLASS'
        ]),
        sourceInstanceId: projectionIdentifierSchema,
        castLevel: z.number().check(z.int()).check(z.gte(0)).check(z.lte(9)),
        castMode: z.enum(['SPELL_SLOT', 'AT_WILL', 'RITUAL', 'FIXED_LEVEL', 'LIMITED_USE']),
        slotKey: z.nullable(projectionIdentifierSchema),
        resourceOwnerKey: z.nullable(characterResourcePoolIdentitySchema)
      }),
      targetPolicy: compiledActionTargetPolicySchema,
      compilation: z.strictObject({
        kind: z.literal('COMPILED'),
        activeEffectPlan: z.nullable(compiledActionActiveEffectPlanSchema),
        executionPlan: compiledActionExecutionPlanSchema
      })
    }),
    z.strictObject({
      schemaVersion: z.literal(4),
      kind: z.literal('CHARACTER_ACTION'),
      actionId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240)),
      effectId: serverUuidIdentityDtoSchema,
      targetPolicy: z.optional(compiledActionTargetPolicySchema),
      compilation: z.strictObject({
        kind: z.literal('COMPILED'),
        resourceBinding: z.nullable(compiledActionResourceBindingSchema),
        activeEffectPlan: z.nullable(compiledActionActiveEffectPlanSchema),
        executionPlan: compiledActionExecutionPlanSchema
      })
    }),
    z.strictObject({
      schemaVersion: z.literal(2),
      kind: z.literal('CHARACTER_ACTION'),
      actionId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240)),
      effectId: serverUuidIdentityDtoSchema,
      targetPolicy: z.optional(compiledActionTargetPolicySchema),
      compilation: z.strictObject({
        kind: z.literal('COMPILED'),
        published: serverPublishedRuleDefinitionDtoSchema,
        resourceBinding: z.nullable(compiledActionResourceBindingSchema),
        activeEffectPlan: z.nullable(compiledActionActiveEffectPlanSchema)
      })
    }),
    z.strictObject({
      schemaVersion: z.literal(3),
      kind: z.literal('CHARACTER_ACTION'),
      actionId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240)),
      effectId: serverUuidIdentityDtoSchema,
      targetPolicy: z.optional(compiledActionTargetPolicySchema),
      compilation: z.strictObject({
        kind: z.literal('COMPILED'),
        /** Legacy compiled graph retained for non-phased fixed/recurring actions. */
        published: serverPublishedRuleDefinitionDtoSchema,
        resourceBinding: z.nullable(compiledActionResourceBindingSchema),
        activeEffectPlan: z.nullable(compiledActionActiveEffectPlanSchema),
        compilerSource: compiledActionCompilerSourceSchema
      })
    }),
    z.strictObject({
      schemaVersion: z.literal(1),
      kind: z.literal('CHARACTER_ACTION'),
      actionId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240)),
      effectId: serverUuidIdentityDtoSchema,
      targetPolicy: z.optional(compiledActionTargetPolicySchema),
      compilation: z.strictObject({
        kind: z.literal('MANUAL'),
        reasonCode: z.enum(['SYSTEM_CAPABILITY_UNAVAILABLE', 'NOT_NORMALIZED'])
      })
    })
  ])
)

export const compiledActionEntryPointsSchema = lazySchema(() =>
  z.array(compiledActionEntryPointSchema).check(z.maxLength(1_000))
)
export type CompiledActionEntryPoint = z.infer<typeof compiledActionEntryPointSchema>

const characterMechanicsContentRefSchema = lazySchema(() =>
  z.strictObject({
    definitionId: projectionIdentifierSchema,
    binding: z.discriminatedUnion('kind', [
      z.strictObject({ kind: z.literal('ACTIVE') }),
      z.strictObject({
        kind: z.literal('REVISION'),
        revisionId: projectionIdentifierSchema
      })
    ]),
    systemId: projectionIdentifierSchema
  })
)

export const characterMechanicsRuleSnapshotSchema = lazySchema(() =>
  z.strictObject({
    characterId: projectionIdentifierSchema,
    systemId: projectionIdentifierSchema,
    classes: z.array(
      z.strictObject({
        classId: projectionIdentifierSchema,
        subclassId: z.optional(projectionIdentifierSchema)
      })
    ),
    features: z.array(
      z.strictObject({
        featureId: projectionIdentifierSchema,
        source: characterProvenanceDtoSchema
      })
    ),
    equipmentItems: z.array(
      z.strictObject({
        instanceId: projectionIdentifierSchema,
        contentRef: characterMechanicsContentRefSchema,
        compiledItem: z.strictObject({
          category: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(80))
        })
      })
    )
  })
)

export type CharacterMechanicsRuleSnapshot = z.infer<typeof characterMechanicsRuleSnapshotSchema>

const characterMechanicsProjectionObjectSchema = lazySchema(() =>
  z.strictObject({
    characterId: projectionIdentifierSchema,
    commandState: characterAuthoredDtoSchema,
    commandStateChecksum: projectionChecksumSchema,
    commandLaneChecksum: projectionChecksumSchema,
    projectionSchemaVersion: z.literal(2),
    projectionChecksum: projectionChecksumSchema,
    characterStreamVersion: nonNegativeStreamVersionSchema,
    authoredVersionVector: authoredVersionVectorSchema,
    systemVocabularySnapshotId: projectionIdentifierSchema,
    systemVocabularySnapshotVersion: projectionSchemaVersionSchema,
    systemVocabularySnapshotChecksum: projectionChecksumSchema,
    ruleRevisionId: projectionIdentifierSchema,
    ruleRevisionChecksum: projectionChecksumSchema,
    evaluatorVersion: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(80)),
    modelContractVersion: z.number().check(z.int()).check(z.gte(1)).check(z.lte(10_000)),
    ruleSnapshot: characterMechanicsRuleSnapshotSchema,
    rulePolicyInput: characterRulePolicyInputSchema,
    rulePolicyOutput: characterRulePolicyOutputSchema,
    initiativeActorFacts: z._default(characterInitiativeActorFactsSchema, {
      effectiveSize: null,
      checkTotals: {},
      equippedItems: []
    }),
    pinnedSenseDefinitions: z.array(pinnedSenseDefinitionSchema).check(z.maxLength(100)),
    ruleRegistry: z.record(z.string(), jsonValueSchema),
    compiledActionEntryPoints: compiledActionEntryPointsSchema
  })
)

export const characterMechanicsProjectionSchema = lazySchema(() =>
  characterMechanicsProjectionObjectSchema.check(
    z.superRefine((projection, ctx) => {
      const senses = projection.rulePolicyOutput.senses
      if (projection.pinnedSenseDefinitions.length !== senses.length) {
        ctx.addIssue({
          code: 'custom',
          message: 'Pinned sense definitions must align with final Character senses.',
          path: ['pinnedSenseDefinitions']
        })
      }
      const expectedSenseIds = senses.map((sense) => sense.senseDefinitionId)
      const pinnedSenseIds = projection.pinnedSenseDefinitions.map((pin) => pin.senseDefinitionId)
      const sortedPinnedSenseIds = [...pinnedSenseIds].sort((left, right) =>
        left.localeCompare(right)
      )
      if (pinnedSenseIds.some((id, index) => id !== sortedPinnedSenseIds[index])) {
        ctx.addIssue({
          code: 'custom',
          message: 'Pinned sense definitions must use canonical identity order.',
          path: ['pinnedSenseDefinitions']
        })
      }
      const expectedSenseIdSet = new Set(expectedSenseIds)
      const pinnedSenseIdSet = new Set(pinnedSenseIds)
      if (
        expectedSenseIdSet.size !== expectedSenseIds.length ||
        pinnedSenseIdSet.size !== pinnedSenseIds.length ||
        expectedSenseIdSet.size !== pinnedSenseIdSet.size ||
        [...expectedSenseIdSet].some((id) => !pinnedSenseIdSet.has(id))
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'Pinned sense definition identities must exactly match final Character senses.',
          path: ['pinnedSenseDefinitions']
        })
      }
      for (const [index, pin] of projection.pinnedSenseDefinitions.entries()) {
        const sense = senses.find(
          (candidate) => candidate.senseDefinitionId === pin.senseDefinitionId
        )
        if (
          pin.document.id !== pin.senseDefinitionId ||
          pin.document.gameSystemId !== projection.commandState.systemId ||
          checksumRuleDocument(pin.document) !== pin.definitionChecksum ||
          !sense ||
          checksumRuleDocument(pin.range) !== checksumRuleDocument(sense.range)
        ) {
          ctx.addIssue({
            code: 'custom',
            message:
              'Pinned sense definition must match its Character System and final sense range.',
            path: ['pinnedSenseDefinitions', index]
          })
        }
      }
      const candidates = projection.rulePolicyInput.actionCandidates
      const entries = projection.compiledActionEntryPoints
      const actionEntries = entries.filter((entry) => entry.kind === 'CHARACTER_ACTION')
      const spellEntries = entries.filter((entry) => entry.kind === 'CHARACTER_SPELL_CAST')
      if (actionEntries.length !== candidates.length) {
        ctx.addIssue({
          code: 'custom',
          message: 'Compiled action entries must align with action candidates.',
          path: ['compiledActionEntryPoints']
        })
        return
      }
      const seenActionIds = new Set<string>()
      for (const [index, entry] of actionEntries.entries()) {
        const candidate = candidates[index]
        if (
          !candidate ||
          entry.actionId !== candidate.actionId ||
          entry.effectId !== candidate.effectId
        ) {
          ctx.addIssue({
            code: 'custom',
            message: 'Compiled action entry identity must match its ordered action candidate.',
            path: ['compiledActionEntryPoints', index]
          })
        }
        if (seenActionIds.has(entry.actionId)) {
          ctx.addIssue({
            code: 'custom',
            message: 'Compiled action entry identities must be unique.',
            path: ['compiledActionEntryPoints', index]
          })
        }
        seenActionIds.add(entry.actionId)
        const published =
          entry.compilation.kind !== 'COMPILED'
            ? null
            : entry.schemaVersion === 4
              ? entry.compilation.executionPlan.kind === 'SINGLE_GRAPH'
                ? entry.compilation.executionPlan.published
                : entry.compilation.executionPlan.test.published
              : entry.compilation.published
        if (
          published &&
          (published.id !== entry.effectId ||
            published.gameSystemId !== projection.commandState.systemId)
        ) {
          ctx.addIssue({
            code: 'custom',
            message: 'Compiled action graph identity must match its Effect and Character System.',
            path: ['compiledActionEntryPoints', index, 'compilation']
          })
        }
        if (entry.schemaVersion === 2 && entry.compilation.kind === 'COMPILED') {
          const binding = entry.compilation.resourceBinding
          const activeEffectPlan = entry.compilation.activeEffectPlan
          const resourceUse = candidate.resourceUse
          const bindingMatches =
            (resourceUse === null && binding === null) ||
            (resourceUse !== null &&
              resourceUse.poolId !== null &&
              binding !== null &&
              binding.poolId === resourceUse.poolId &&
              binding.chargeId === resourceUse.chargeId &&
              binding.cost === resourceUse.cost)
          if (!bindingMatches) {
            ctx.addIssue({
              code: 'custom',
              message: 'Compiled action resource binding must match its exact action candidate.',
              path: ['compiledActionEntryPoints', index, 'compilation', 'resourceBinding']
            })
          }
          if (
            activeEffectPlan &&
            (activeEffectPlan.authoredEffectId !== entry.effectId ||
              (activeEffectPlan.initialRemaining !== null && activeEffectPlan.initialRemaining < 1))
          ) {
            ctx.addIssue({
              code: 'custom',
              message: 'Compiled active-effect plan must match its exact Effect.',
              path: ['compiledActionEntryPoints', index, 'compilation', 'activeEffectPlan']
            })
          }
          if (
            activeEffectPlan?.perceptionContributions.some(
              (contribution) =>
                contribution.kind === 'SENSE_GRANT' &&
                contribution.document.gameSystemId !== entry.compilation.published.gameSystemId
            )
          )
            ctx.addIssue({
              code: 'custom',
              message: 'Compiled active-effect sense grants must belong to the action Game System.',
              path: ['compiledActionEntryPoints', index, 'compilation', 'activeEffectPlan']
            })
        }
        if (
          entry.schemaVersion === 1 &&
          entry.compilation.kind === 'COMPILED' &&
          candidate.resourceUse !== null
        ) {
          ctx.addIssue({
            code: 'custom',
            message:
              'Historical compiled action entries are resource-free and cannot align with a resource-bound action candidate.',
            path: ['compiledActionEntryPoints', index]
          })
        }
      }
      const spellCandidates = projection.rulePolicyInput.spellCastCandidates
      const spellMechanics = projection.rulePolicyOutput.spellCastMechanics
      const spellDecisions = projection.rulePolicyOutput.spellCastDecisions
      const expectedSpellEntries = new Map(
        spellCandidates.map((candidate) => [candidate.candidateId, candidate])
      )
      for (const [index, entry] of spellEntries.entries()) {
        const candidate = expectedSpellEntries.get(entry.actionId)
        const mechanics = spellMechanics.find((value) => value.candidateId === entry.actionId)
        const decision = spellDecisions.find((value) => value.candidateId === entry.actionId)
        const published =
          entry.compilation.executionPlan.kind === 'SINGLE_GRAPH'
            ? entry.compilation.executionPlan.published
            : entry.compilation.executionPlan.test.published
        if (
          !candidate ||
          !mechanics ||
          !decision ||
          candidate.spellId !== entry.spell.spellId ||
          candidate.source.sourceKind !== entry.spell.sourceKind ||
          candidate.source.sourceInstanceId !== entry.spell.sourceInstanceId ||
          candidate.castLevel !== entry.spell.castLevel ||
          candidate.castMode !== entry.spell.castMode ||
          candidate.resourceOwnerKey !== entry.spell.resourceOwnerKey ||
          decision.slotKey !== entry.spell.slotKey ||
          mechanics.mechanics.filter((value) => value.effectId === entry.effectId).length !== 1 ||
          published.id !== entry.effectId ||
          published.gameSystemId !== projection.commandState.systemId
        ) {
          ctx.addIssue({
            code: 'custom',
            message:
              'Compiled spell action entry must match one current spell-cast candidate, decision, and Effect.',
            path: ['compiledActionEntryPoints', actionEntries.length + index]
          })
        }
        expectedSpellEntries.delete(entry.actionId)
      }
    })
  )
)

export type CharacterMechanicsProjection = z.infer<typeof characterMechanicsProjectionSchema>

/**
 * The bounded durable identity required to reuse a room's already-validated
 * mechanics snapshot without reading its large rule payload on every command.
 */
export const characterMechanicsProjectionMetadataSchema = lazySchema(() =>
  z.pick(characterMechanicsProjectionObjectSchema, {
    characterId: true,
    commandState: true,
    commandStateChecksum: true,
    commandLaneChecksum: true,
    projectionSchemaVersion: true,
    projectionChecksum: true,
    characterStreamVersion: true,
    authoredVersionVector: true,
    systemVocabularySnapshotId: true,
    systemVocabularySnapshotVersion: true,
    systemVocabularySnapshotChecksum: true,
    ruleRevisionId: true,
    ruleRevisionChecksum: true,
    evaluatorVersion: true,
    modelContractVersion: true
  })
)

export type CharacterMechanicsProjectionMetadata = z.infer<
  typeof characterMechanicsProjectionMetadataSchema
>
