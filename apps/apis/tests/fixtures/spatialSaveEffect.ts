import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { serverPublishedRuleDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import { checksumRuleDocument, type RuleGraphDefinition } from '@artificer-toolkit/shared/rules'
import {
  SRD_ABILITY_DEFINITION_IDS,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY,
  DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY,
  DND5E_EFFECT_ACTION_FAMILY_KEY,
  DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY,
  DND5E_SAVE_DC_FACT_KEY,
  DND5E_SAVE_MODIFIER_FACT_KEY,
  DND5E_SAVE_TEST_OPERATION_KEY,
  DND5E_TARGET_ACTOR_FACT_KEY,
  DND5E_TARGET_STATE_CHECKSUM_FACT_KEY,
  DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/effectActionCompiler'
import { createRulesRuntime } from '../../convex/rules/runtime'
import { createSpatialRuleEffectStore } from '../../convex/rules/spatialEffectStore'
import { setupAutomaticSceneMovement } from './automaticSceneMovement'

type SceneFixture = Awaited<ReturnType<typeof setupAutomaticSceneMovement>>

export async function seedSpatialSaveEffect(
  base: Pick<SceneFixture, 'owner' | 'sceneId'> & { base: Pick<SceneFixture['base'], 'run'> },
  input: { center: { x: number; y: number }; radius: number; targetActorId: string }
) {
  return base.owner.caller.run(async (ctx) => {
    const definitionId = crypto.randomUUID()
    const entryId = crypto.randomUUID()
    const occurrenceId = crypto.randomUUID()
    const graph = {
      schemaVersion: 1,
      id: definitionId,
      gameSystemId: srdSystemRecord.id,
      definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
      nodes: [
        {
          id: 'd20',
          operation: { key: 'evidence.integer-range', contractVersion: 1 },
          inputs: { min: { kind: 'LITERAL', value: 1 }, max: { kind: 'LITERAL', value: 20 } }
        },
        {
          id: 'test',
          operation: { key: DND5E_SAVE_TEST_OPERATION_KEY, contractVersion: 1 },
          inputs: {
            targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
            naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'd20', port: 'value' },
            modifier: { kind: 'FACT', factKey: DND5E_SAVE_MODIFIER_FACT_KEY },
            threshold: { kind: 'FACT', factKey: DND5E_SAVE_DC_FACT_KEY },
            contributorChecksum: { kind: 'FACT', factKey: DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY }
          }
        },
        {
          id: 'proposal-on_save_fail',
          operation: { key: DND5E_TEST_DAMAGE_PROPOSAL_OPERATION_KEY, contractVersion: 1 },
          inputs: {
            targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
            resolvedPath: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'resultPath' },
            authoredPath: { kind: 'LITERAL', value: 'ON_SAVE_FAIL' },
            targetStateChecksum: { kind: 'FACT', factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY },
            amount: { kind: 'LITERAL', value: 1 },
            damageTypeId: { kind: 'LITERAL', value: crypto.randomUUID() }
          }
        }
      ],
      outputs: {
        targetActorId: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'targetActorId' },
        naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'naturalD20' },
        total: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'total' },
        resultPath: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'resultPath' },
        contributorChecksum: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'contributorChecksum' }
      },
      sourceEntryBindings: [{ sourceEntryId: entryId, nodeId: 'proposal-on_save_fail' }]
    } satisfies RuleGraphDefinition
    const runtime = await createRulesRuntime(ctx, base.owner.userId)
    const prepared = await runtime.executeResolvedWithGraph?.({
      command: {
        definitionId,
        occurrenceId,
        facts: {
          [DND5E_TARGET_ACTOR_FACT_KEY]: input.targetActorId,
          [DND5E_SAVE_MODIFIER_FACT_KEY]: 0,
          [DND5E_SAVE_DC_FACT_KEY]: 30,
          [DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]: checksumRuleDocument([]),
          [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: checksumRuleDocument({
            targetActorId: input.targetActorId,
            currentHitPoints: 10,
            temporaryHitPoints: 0,
            maximumHitPoints: 10,
            conditionIds: []
          })
        }
      },
      published: serverPublishedRuleDefinitionDtoSchema.parse({
        id: definitionId,
        gameSystemId: srdSystemRecord.id,
        definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
        checksum: checksumRuleDocument(graph),
        definition: graph
      })
    })
    if (!prepared) throw new Error('Frozen graph compilation unavailable')
    const scope = await createSpatialRuleEffectStore(ctx).scope({
      encounterId: base.base.run.id,
      sceneId: base.sceneId
    })
    if (!scope) throw new Error('Fixture binding missing')
    return scope.create({
      id: crypto.randomUUID(),
      definition: activeRuleEffectDefinitionDtoSchema.parse({
        schemaVersion: 1,
        origin: {
          kind: 'ENCOUNTER',
          sourceAggregateId: base.base.run.id,
          sourceOccurrenceId: occurrenceId,
          rootCommandId: crypto.randomUUID(),
          sourceActorId: null
        },
        authoredEffectId: definitionId,
        compiledEntryId: entryId,
        frozenGraphNodeId: 'proposal-on_save_fail',
        frozenGraph: prepared.graph,
        adapterFacts: {
          [DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY]:
            SRD_ABILITY_DEFINITION_IDS.DEXTERITY,
          [DND5E_ACTIVE_EFFECT_SAVE_REQUEST_NODE_FACT_KEY]: 'd20',
          [DND5E_SAVE_DC_FACT_KEY]: 30
        },
        perceptionContributions: [],
        recurrence: {
          recurrenceStage: 'NONE',
          consumeOnFirstEvent: null,
          endOnEvents: [],
          lifetimeScope: 'ENCOUNTER',
          expiration: { kind: 'INDEFINITE' }
        }
      }),
      lifecycle: { schemaVersion: 1, remainingTicks: null },
      spatialState: { schemaVersion: 1, revealed: true },
      placement: {
        schemaVersion: 1,
        anchorKind: 'FIXED',
        sourceTokenId: null,
        geometry: {
          frame: 'SCENE_ABSOLUTE',
          shape: { kind: 'CIRCLE', center: input.center, radius: input.radius }
        },
        triggerModes: ['CROSS'],
        movementKinds: ['VOLUNTARY'],
        activation: 'ONE_SHOT',
        visibility: 'PUBLIC',
        revealOnTrigger: false
      }
    })
  })
}
