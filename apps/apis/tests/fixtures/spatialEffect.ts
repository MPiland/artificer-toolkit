import { createConvexEncounterStore } from '../../convex/lib/convexEncounterStore'
import { createEncounterSceneFixture } from './encounterScene'
import { createRulesRuntime } from './rulesRuntime'
import { createSpatialRuleEffectStore } from '@artificer-toolkit/encounter-persistence/spatialEffectStore'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { checksumRuleDocument, type RuleGraphDefinition } from '@artificer-toolkit/shared/rules'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
  DND5E_EFFECT_ACTION_FAMILY_KEY,
  DND5E_TARGET_ACTOR_FACT_KEY,
  DND5E_TARGET_STATE_CHECKSUM_FACT_KEY
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/effectActionContracts'
const ids = {
  command: '00000000-0000-4000-8000-000000000101',
  occurrence: '00000000-0000-4000-8000-000000000102'
}
type SpatialEffectFixture = Pick<
  Awaited<ReturnType<typeof createEncounterSceneFixture>>,
  'other' | 'run' | 'sceneId'
>

export async function seedSpatialEffect(
  base: SpatialEffectFixture,
  centerOrRepeatable: { x: number; y: number } | boolean = { x: 5, y: 0 },
  radius = 1,
  repeatable = false
) {
  const center = typeof centerOrRepeatable === 'boolean' ? { x: 5, y: 0 } : centerOrRepeatable
  const isRepeatable = typeof centerOrRepeatable === 'boolean' ? centerOrRepeatable : repeatable
  return base.other.caller.run(async (ctx) => {
    const definitionId = crypto.randomUUID()
    const entryId = crypto.randomUUID()
    const graph = {
      schemaVersion: 1,
      id: definitionId,
      gameSystemId: srdSystemRecord.id,
      definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
      nodes: [
        {
          id: 'damage',
          operation: { key: DND5E_DAMAGE_PROPOSAL_OPERATION_KEY, contractVersion: 1 },
          inputs: {
            targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
            targetStateChecksum: { kind: 'FACT', factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY },
            amount: { kind: 'LITERAL', value: 1 },
            damageTypeId: { kind: 'LITERAL', value: crypto.randomUUID() }
          }
        }
      ],
      outputs: {
        targetActorId: { kind: 'NODE_OUTPUT', nodeId: 'damage', port: 'targetActorId' },
        amount: { kind: 'NODE_OUTPUT', nodeId: 'damage', port: 'amount' },
        damageTypeId: { kind: 'NODE_OUTPUT', nodeId: 'damage', port: 'damageTypeId' }
      },
      sourceEntryBindings: [{ sourceEntryId: entryId, nodeId: 'damage' }]
    } satisfies RuleGraphDefinition
    const runtime = createRulesRuntime(ctx, base.other.userId)
    const prepared = await runtime.executeResolvedWithGraph?.({
      command: {
        definitionId,
        occurrenceId: ids.occurrence,
        facts: {
          [DND5E_TARGET_ACTOR_FACT_KEY]: base.run.actors[0]!.id,
          [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: checksumRuleDocument({
            targetActorId: base.run.actors[0]!.id,
            currentHitPoints: 1,
            temporaryHitPoints: 0,
            maximumHitPoints: 1,
            conditionIds: []
          })
        }
      },
      published: {
        id: definitionId,
        gameSystemId: srdSystemRecord.id,
        definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
        checksum: checksumRuleDocument(graph),
        definition: graph
      }
    })
    if (!prepared) throw new Error('Frozen graph compilation unavailable')
    const definition = activeRuleEffectDefinitionDtoSchema.parse({
      schemaVersion: 2,
      linkedEffectId: null,
      originLevel: null,
      stateContributions: [],
      origin: {
        kind: 'ENCOUNTER',
        sourceAggregateId: base.run.id,
        sourceOccurrenceId: ids.occurrence,
        rootCommandId: ids.command,
        sourceActorId: null
      },
      authoredEffectId: definitionId,
      compiledEntryId: entryId,
      frozenGraphNodeId: 'damage',
      frozenGraph: prepared.graph,
      adapterFacts: {},
      perceptionContributions: [],
      recurrence: {
        recurrenceStage: 'NONE',
        anchor: 'HOLDER',
        endTriggers: [],
        endOnConditionIds: [],
        holderEnd: null,
        lifetimeScope: 'ENCOUNTER',
        expiration: {
          kind: 'TICKS',
          initialRemaining: 3,
          decrementStage: 'END_OF_TURN'
        }
      }
    })
    const scope = await createSpatialRuleEffectStore({ db: createConvexEncounterStore(ctx) }).scope(
      {
        encounterId: base.run.id,
        sceneId: base.sceneId
      }
    )
    if (!scope) throw new Error('Fixture binding missing')
    return scope.create({
      id: crypto.randomUUID(),
      definition,
      lifecycle: { schemaVersion: 1, remainingTicks: 3 },
      spatialState: { schemaVersion: 1, revealed: !isRepeatable },
      placement: {
        schemaVersion: 1,
        anchorKind: 'FIXED',
        sourceTokenId: null,
        geometry: {
          frame: 'SCENE_ABSOLUTE',
          shape: { kind: 'CIRCLE', center, radius }
        },
        triggerModes: ['CROSS'],
        movementKinds: ['VOLUNTARY'],
        activation: isRepeatable ? 'REPEATABLE' : 'ONE_SHOT',
        visibility: isRepeatable ? 'HIDDEN' : 'PUBLIC',
        revealOnTrigger: isRepeatable
      }
    })
  })
}
