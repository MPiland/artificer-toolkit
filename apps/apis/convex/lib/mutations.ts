import { customCtx, customMutation } from 'convex-helpers/server/customFunctions'
import { Triggers } from 'convex-helpers/server/triggers'
import type { GenericDatabaseWriter, GenericMutationCtx } from 'convex/server'
import type { SceneVisionRevision } from '@artificer-toolkit/schema/projections/sceneVisionRevisions'
import {
  internalMutation as rawInternalMutation,
  mutation as rawMutation
} from '../_generated/server'
import type { DataModel, Doc, TableNames } from '../_generated/dataModel'

type SceneVisionScope = Pick<SceneVisionRevision, 'scope' | 'id'>

type TriggerContext = GenericMutationCtx<DataModel> & {
  innerDb: GenericDatabaseWriter<DataModel>
}

type ScopeSelector<TableName extends TableNames> = (
  ctx: TriggerContext,
  doc: Doc<TableName>
) => SceneVisionScope | null | Promise<SceneVisionScope | null>

const triggers = new Triggers<DataModel>()

function registerScope<TableName extends TableNames>(
  tableName: TableName,
  selectScope: ScopeSelector<TableName>
) {
  triggers.register(tableName, async (ctx, change) => {
    const scopes = new Map<string, SceneVisionScope>()
    for (const document of [change.oldDoc, change.newDoc]) {
      if (!document) continue
      const scope = await selectScope(ctx, document)
      if (scope) scopes.set(`${scope.scope}:${scope.id}`, scope)
    }
    for (const scope of scopes.values()) await refreshScope(ctx.innerDb, scope)
  })
}

async function refreshScope(db: GenericDatabaseWriter<DataModel>, scope: SceneVisionScope) {
  const id = scope.id.toLowerCase()
  const current = await db
    .query('sceneVisionRevisions')
    .withIndex('by_scope_id', (query) => query.eq('scope', scope.scope).eq('id', id))
    .unique()
  const revision = crypto.randomUUID()
  if (current) {
    await db.patch(current._id, { revision })
    return
  }
  await db.insert('sceneVisionRevisions', { scope: scope.scope, id, revision })
}

function systemScope(id: string): SceneVisionScope {
  return { scope: 'SYSTEM', id }
}

function campaignScope(id: string): SceneVisionScope {
  return { scope: 'CAMPAIGN', id }
}

function characterScope(id: string): SceneVisionScope {
  return { scope: 'CHARACTER', id }
}

function sessionScope(id: string): SceneVisionScope {
  return { scope: 'SESSION', id }
}

async function sessionScopeForEncounter(
  ctx: TriggerContext,
  encounterId: string
): Promise<SceneVisionScope | null> {
  const encounter = await ctx.innerDb
    .query('encounterRuns')
    .withIndex('by_publicId', (query) => query.eq('id', encounterId))
    .unique()
  return encounter ? sessionScope(encounter.sessionId) : null
}

// ponytail: source publications share a System marker; partition by source if measured contention requires it.
registerScope('systems', (_, document) => systemScope(document.id))
registerScope('systemVocabularySnapshots', (_, document) => systemScope(document.systemId))
registerScope('contentSources', (_, document) => systemScope(document.gameSystemId))
registerScope('rulesCatalogues', (_, document) => systemScope(document.gameSystemId))
registerScope('authoredRoots', (_, document) => systemScope(document.systemId))
registerScope('authoredVersions', (_, document) => systemScope(document.systemId))
registerScope('authoredVersionPayloadChunks', (_, document) => systemScope(document.systemId))
registerScope('authoredDraftPayloads', async (ctx, document) => {
  if (document.systemId !== undefined) return systemScope(document.systemId)
  const draft = await ctx.innerDb
    .query('authoredDrafts')
    .withIndex('by_subjectId', (query) => query.eq('subjectId', document.subjectId))
    .unique()
  return draft ? systemScope(draft.systemId) : null
})
registerScope('authoredDraftPayloadChunks', (_, document) => systemScope(document.systemId))
registerScope('reusableDefinitions', (_, document) => systemScope(document.gameSystemId))

registerScope('campaigns', (_, document) => campaignScope(document.id))
registerScope('campaignMemberships', (_, document) => campaignScope(document.campaignId))
registerScope('campaignCharacterAssignments', (_, document) => campaignScope(document.campaignId))
registerScope('campaignContentShares', (_, document) => campaignScope(document.campaignId))

triggers.register('campaignNotebookSections', async (ctx, change) => {
  const campaignIds = new Set(
    [change.oldDoc, change.newDoc].flatMap((document) => (document ? [document.campaignId] : []))
  )
  for (const campaignId of campaignIds) {
    const campaign = await ctx.innerDb
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', campaignId))
      .unique()
    if (campaign) await ctx.innerDb.patch(campaign._id, { notebookRevision: crypto.randomUUID() })
  }
})

registerScope('characters', (_, document) => characterScope(document.id))
registerScope('characterDrafts', (_, document) => characterScope(document.characterId))
registerScope('characterDraftPayloads', (_, document) => characterScope(document.characterId))
registerScope('campaignCharacterStates', (_, document) => characterScope(document.characterId))
registerScope('characterActiveRuleEffects', (_, document) => characterScope(document.characterId))
registerScope('authoredRouteIds', (_, document) =>
  document.subjectKind === 'CHARACTER' ? characterScope(document.subjectId) : null
)

registerScope('campaignSessions', (_, document) => sessionScope(document.id))
registerScope('campaignSessionAttendance', (_, document) => sessionScope(document.sessionId))
registerScope('campaignScenePresentations', (_, document) => sessionScope(document.sessionId))
registerScope('encounterRuns', (_, document) => sessionScope(document.sessionId))
registerScope('encounterRunActors', (ctx, document) =>
  sessionScopeForEncounter(ctx, document.encounterId)
)
registerScope('encounterInitiativeRounds', (ctx, document) =>
  sessionScopeForEncounter(ctx, document.encounterId)
)
registerScope('encounterInitiativeSides', (ctx, document) =>
  sessionScopeForEncounter(ctx, document.encounterId)
)
registerScope('encounterInitiativeParticipants', (ctx, document) =>
  sessionScopeForEncounter(ctx, document.encounterId)
)
registerScope('encounterSceneBindings', (ctx, document) =>
  sessionScopeForEncounter(ctx, document.encounterId)
)
registerScope('encounterActorTokenBindings', (ctx, document) =>
  sessionScopeForEncounter(ctx, document.encounterId)
)
registerScope('encounterActiveRuleEffects', (ctx, document) =>
  sessionScopeForEncounter(ctx, document.encounterId)
)
registerScope('encounterMaintainedEffectStates', (ctx, document) =>
  sessionScopeForEncounter(ctx, document.encounterId)
)
registerScope('encounterSpatialRuleEffects', (ctx, document) =>
  sessionScopeForEncounter(ctx, document.encounterId)
)
registerScope('encounterRuleOccurrences', (ctx, document) =>
  sessionScopeForEncounter(ctx, document.encounterId)
)

export const withSceneVisionTracking = triggers.wrapDB
export const mutation = customMutation(rawMutation, customCtx(withSceneVisionTracking))
export const internalMutation = customMutation(
  rawInternalMutation,
  customCtx(withSceneVisionTracking)
)
