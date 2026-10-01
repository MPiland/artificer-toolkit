import { createConvexEncounterStore } from '../../convex/lib/convexEncounterStore'
import { makeFunctionReference } from 'convex/server'
import type {
  SourceImportBatchResultDto,
  SourceImportDefinitionsInput
} from '@artificer-toolkit/schema/api/sourceImport'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { optionalCombatPassageContinuationDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionOptionalCombatPending'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_OPTIONAL_COMBAT_DEFINITIONS } from '@artificer-toolkit/source-data/srd/optionalCombat.js'
import { SRD_RULE_STATE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { writeRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import { setupCharacterRun } from './encounterCharacter'
import { sourceImportBatches } from '../../convex/content/importBatches'

export const checksum = 'a'.repeat(64)
const importDefinitions = makeFunctionReference<
  'mutation',
  SourceImportDefinitionsInput,
  SourceImportBatchResultDto
>('content/import:importDefinitions')

export function optional(kind: 'OVERRUN' | 'TUMBLE') {
  const definition = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
    (candidate) => candidate.document.kind === kind
  )
  if (!definition) throw new Error(`Missing ${kind} fixture definition.`)
  return definition
}

export function movement(input: {
  encounterId: string
  sourceActorId: string
  blockerActorId: string
}) {
  const sourceTokenId = crypto.randomUUID()
  const blockerTokenId = crypto.randomUUID()
  const path = [
    { x: 0, y: 0 },
    { x: 5, y: 0 }
  ]
  return optionalCombatPassageContinuationDtoSchema.parse({
    root: {
      commandId: crypto.randomUUID(),
      commandFingerprint: checksum,
      initiatorUserId: crypto.randomUUID(),
      correlationId: null,
      encounterId: input.encounterId,
      sceneId: crypto.randomUUID(),
      tokenId: sourceTokenId,
      expectedEncounterVersion: 0,
      expectedSceneVersion: 0,
      currentSceneVersion: 0,
      movementKind: 'VOLUNTARY',
      originalPath: path,
      pathChecksum: checksumRuleDocument(path),
      pathStartDistance: 0,
      currentPosition: path[0],
      terminalPassageStop: null,
      resolutionCommands: []
    },
    blockerActorId: input.blockerActorId,
    blockerTokenId,
    contact: path[0],
    contactPathDistance: 0,
    blockerCurrentnessChecksum: checksum,
    nextPassageStop: null,
    spatialSelectionChecksum: checksum,
    spatialCurrentnessChecksum: checksum,
    completedSpatialExecutions: [],
    appliedSpatialPrefix: null,
    completedReactionExecutions: [],
    remainingSpatialCandidates: [],
    reactionTimeline: []
  })
}

export async function fixture() {
  const base = await setupCharacterRun()
  for (const definitions of sourceImportBatches([
    ...SRD_RULE_STATE_DEFINITIONS,
    optional('OVERRUN'),
    optional('TUMBLE')
  ]))
    await base.t.mutation(importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions
    })
  const overrun = optional('OVERRUN').document.parameters
  const tumble = optional('TUMBLE').document.parameters
  if (overrun.kind !== 'OVERRUN' || tumble.kind !== 'TUMBLE')
    throw new Error('Invalid fixture policy.')
  let blockerId = ''
  await base.t.run(async (ctx) => {
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!run) throw new Error('Missing Run.')
    const state = encounterRunStateSchema.parse(JSON.parse(run.stateJson))
    const blocker = state.actorIds.find((id) => id !== base.actor.id)
    if (!blocker) throw new Error('Missing blocker.')
    blockerId = blocker
    const blockerRow = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', state.id).eq('id', blocker))
      .unique()
    if (!blockerRow) throw new Error('Missing blocker row.')
    const abilityId = srdSystemRecord.abilities?.[0]?.id
    if (!abilityId) throw new Error('Missing System ability.')
    const blockerState = encounterRunActorStateSchema.parse(JSON.parse(blockerRow.stateJson))
    const creature = encounterRunActorStateSchema.parse({
      ...blockerState,
      kind: 'CREATURE',
      sourceId: crypto.randomUUID(),
      sourceRevision: 1,
      snapshot: {
        payload: {
          size: 'MEDIUM',
          damageVulnerabilities: [],
          damageResistances: [],
          damageImmunities: [],
          conditionImmunities: [],
          features: []
        },
        ruleFacts: {
          gameSystemId: srdSystemRecord.id,
          vocabularySnapshotId: crypto.randomUUID(),
          vocabularySnapshotVersion: 1,
          vocabularySnapshotChecksum: checksum,
          abilityScores: { [abilityId]: 10 },
          checkTotals: {
            [overrun.targetCheckDefinitionId]: 0,
            [tumble.targetCheckDefinitionId]: 0
          },
          resourceAbilityScores: {},
          initiativeAbilityDefinitionId: abilityId
        }
      }
    })
    const optionalSnapshot = {
      schemaVersion: 1 as const,
      gameSystemId: state.gameSystemId,
      definitions: [optional('OVERRUN'), optional('TUMBLE')].map((definition) => ({
        definitionId: definition.id,
        contentSourceId: SRD_CONTENT_SOURCE.id,
        definitionVersion: 1,
        definitionChecksum: definition.checksum,
        contractVersion: 1,
        label: definition.label,
        document: definition.document
      }))
    }
    const active = encounterRunStateSchema.parse({
      ...state,
      status: 'ACTIVE',
      automationMode: 'ASSISTED',
      round: 1,
      currentActorId: base.actor.id,
      optionalCombatSnapshot: optionalSnapshot,
      optionalCombatSnapshotChecksum: checksumCanonicalJson(optionalSnapshot)
    })
    await writeRunActor({ db: createConvexEncounterStore(ctx) }, blockerRow._id, creature)
    await ctx.db.patch(run._id, {
      status: 'ACTIVE',
      stateJson: JSON.stringify(active),
      stateChecksum: checksumCanonicalJson(active)
    })
  })
  return { ...base, blockerId }
}
