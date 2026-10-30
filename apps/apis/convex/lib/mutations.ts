import { customMutation } from 'convex-helpers/server/customFunctions'
import { Triggers } from 'convex-helpers/server/triggers'
import type { GenericDatabaseWriter, GenericMutationCtx } from 'convex/server'
import type { LiveSessionInputScope } from '@artificer-toolkit/schema/api/liveSessions'
import type { SceneVisionRevision } from '@artificer-toolkit/schema/projections/sceneVisionRevisions'
import {
  internalMutation as rawInternalMutation,
  mutation as rawMutation
} from '../_generated/server'
import type { DataModel, Doc, TableNames } from '../_generated/dataModel'
import { syncCampaignClockWithCombat } from '../campaigns/clockCombat'
import { changeCampaignContentUsage } from '../campaigns/contentUsage'
import { markContentSnapshotScope, type ContentSnapshotScopeRef } from '../contentSnapshots/marking'
import { scheduleLiveSessionInputInvalidation } from '../liveSessions/controlScheduling'
import { withDomainRejections } from './domainRejectionTransport'

type SceneVisionScope = Pick<SceneVisionRevision, 'scope' | 'id'>

type TriggerContext = GenericMutationCtx<DataModel> & {
  innerDb: GenericDatabaseWriter<DataModel>
}

type ScopeSelector<TableName extends TableNames> = (
  ctx: TriggerContext,
  doc: Doc<TableName>
) => SceneVisionScope | null | Promise<SceneVisionScope | null>

const triggers = new Triggers<DataModel>()

/**
 * One transaction's trigger memory, keyed by its inner database writer: each Run's Campaign (a Run
 * never changes Campaign) and the scopes already refreshed. A revision is only observable after the
 * transaction commits, so one refresh per scope is enough however many rows change; without this,
 * every Encounter child write re-read its whole Run and rewrote the same revision row.
 */
const transactionTriggerState = new WeakMap<
  GenericDatabaseWriter<DataModel>,
  {
    runCampaignIds: Map<string, string>
    refreshedScopes: Set<string>
    markedContentScopes: Set<string>
    /** Live-room inputs this transaction changed, by Campaign; sent once when it succeeds. */
    liveRoomInputs: Map<string, Set<LiveSessionInputScope>>
    /** Changed Characters, mapped to their Campaign through the assignment when it succeeds. */
    liveRoomCharacterIds: Set<string>
  }
>()

function triggerState(db: GenericDatabaseWriter<DataModel>) {
  let state = transactionTriggerState.get(db)
  if (!state) {
    state = {
      runCampaignIds: new Map(),
      refreshedScopes: new Set(),
      markedContentScopes: new Set(),
      liveRoomInputs: new Map(),
      liveRoomCharacterIds: new Set()
    }
    transactionTriggerState.set(db, state)
  }
  return state
}

function recordLiveRoomInput(
  db: GenericDatabaseWriter<DataModel>,
  campaignId: string,
  scope: LiveSessionInputScope
) {
  const { liveRoomInputs } = triggerState(db)
  const scopes = liveRoomInputs.get(campaignId) ?? new Set<LiveSessionInputScope>()
  scopes.add(scope)
  liveRoomInputs.set(campaignId, scopes)
}

/**
 * Sends one `INVALIDATE_INPUTS` per Campaign whose inputs this transaction changed, only while its
 * room holds `DO_ACTIVE` authority (ADR 0035 Amendment 14). SYSTEM changes are not pushed; the room
 * pulls them. Scheduling here keeps the notice inside the transaction, so a rollback sends nothing.
 */
async function notifyLiveRooms(
  db: GenericDatabaseWriter<DataModel>,
  scheduler: GenericMutationCtx<DataModel>['scheduler']
) {
  const state = transactionTriggerState.get(db)
  if (!state) return
  for (const characterId of state.liveRoomCharacterIds) {
    const assignment = await db
      .query('campaignCharacterAssignments')
      .withIndex('by_characterId', (query) => query.eq('characterId', characterId))
      .unique()
    if (assignment) recordLiveRoomInput(db, assignment.campaignId, 'CHARACTER')
  }
  for (const [campaignId, scopes] of state.liveRoomInputs) {
    const authority = await db
      .query('campaignLiveAuthorities')
      .withIndex('by_campaignId', (query) => query.eq('campaignId', campaignId))
      .unique()
    if (authority?.phase === 'DO_ACTIVE')
      await scheduleLiveSessionInputInvalidation({ scheduler }, campaignId, [...scopes].sort())
  }
}

/** Change tracking for one transaction, with its live-room notices sent when it succeeds. */
function trackedMutation(
  db: (ctx: GenericMutationCtx<DataModel>) => GenericDatabaseWriter<DataModel>
) {
  return {
    args: {},
    input: (ctx: GenericMutationCtx<DataModel>) => {
      const innerDb = db(ctx)
      return {
        ctx: withSceneVisionTracking({ ...ctx, db: innerDb }),
        args: {},
        onSuccess: () => notifyLiveRooms(innerDb, ctx.scheduler)
      }
    }
  }
}

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
  const { refreshedScopes, liveRoomCharacterIds } = triggerState(db)
  if (refreshedScopes.has(`${scope.scope}:${id}`)) return
  refreshedScopes.add(`${scope.scope}:${id}`)
  if (scope.scope === 'CAMPAIGN') recordLiveRoomInput(db, id, 'CAMPAIGN')
  if (scope.scope === 'CHARACTER') liveRoomCharacterIds.add(id)
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

function playScope(campaignId: string): SceneVisionScope {
  return { scope: 'PLAY', id: campaignId }
}

async function playScopeForEncounter(
  ctx: TriggerContext,
  encounterId: string
): Promise<SceneVisionScope | null> {
  const { runCampaignIds } = triggerState(ctx.innerDb)
  const known = runCampaignIds.get(encounterId)
  if (known) return playScope(known)
  const encounter = await ctx.innerDb
    .query('encounterRuns')
    .withIndex('by_publicId', (query) => query.eq('id', encounterId))
    .unique()
  if (!encounter) return null
  runCampaignIds.set(encounterId, encounter.campaignId)
  return playScope(encounter.campaignId)
}

// ponytail: source publications share a System marker; partition by source if measured contention requires it.
registerScope('systems', (_, document) => systemScope(document.id))
registerScope('systemVocabularySnapshots', (_, document) => systemScope(document.systemId))
registerScope('contentSources', (_, document) => systemScope(document.gameSystemId))
registerScope('rulesCatalogues', (_, document) => systemScope(document.gameSystemId))
registerScope('authoredRoots', (_, document) => systemScope(document.systemId))
registerScope('authoredVersions', (_, document) => systemScope(document.systemId))
registerScope('authoredVersionPayloadChunks', (_, document) => systemScope(document.systemId))
registerScope('authoredVersionCompilations', (_, document) => systemScope(document.systemId))
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

// Imported rows are readable only while their job is COMPLETED (`imports/visibility.ts`), so a
// visibility change changes the content of every System the job imported roots into (D34).
triggers.register('importJobs', async (ctx, change) => {
  const visible = (job: Doc<'importJobs'> | null) => job?.status === 'COMPLETED'
  const job = change.newDoc ?? change.oldDoc
  if (!job || visible(change.oldDoc) === visible(change.newDoc)) return
  const systemIds = new Set<string>()
  for await (const root of ctx.innerDb
    .query('authoredRoots')
    .withIndex('by_importJobId_id', (query) => query.eq('importJobId', job.id))) {
    systemIds.add(root.systemId)
    await markAuthoredContent(ctx, root)
  }
  for (const systemId of systemIds) await refreshScope(ctx.innerDb, systemScope(systemId))
})

// Content snapshots (ADR 0036): one mark per scope per transaction; `markContentSnapshotScope`
// bumps the head revision and schedules the coalesced build.
async function markContentScope(
  ctx: TriggerContext,
  ref: ContentSnapshotScopeRef,
  create: boolean
) {
  const { markedContentScopes } = triggerState(ctx.innerDb)
  const key = `${ref.scope}:${ref.scopeId}`
  if (markedContentScopes.has(key)) return
  if (await markContentSnapshotScope({ db: ctx.innerDb, scheduler: ctx.scheduler }, ref, create))
    markedContentScopes.add(key)
}

async function markAuthoredContent(
  ctx: TriggerContext,
  subject: Pick<Doc<'authoredRoots'>, 'contentSourceId' | 'subjectKind' | 'id' | 'ownerUserId'>
) {
  await markContentScope(ctx, { scope: 'SOURCE', scopeId: subject.contentSourceId }, true)
  // Only owned Homebrew can be shared into a Campaign.
  if (subject.ownerUserId === undefined) return
  for await (const share of ctx.innerDb
    .query('campaignContentShares')
    .withIndex('by_subjectKind_subjectId_campaignId', (q) =>
      q.eq('subjectKind', subject.subjectKind).eq('subjectId', subject.id)
    ))
    await markContentScope(ctx, { scope: 'CAMPAIGN', scopeId: share.campaignId }, true)
}

triggers.register('authoredRoots', async (ctx, change) => {
  for (const root of [change.oldDoc, change.newDoc]) if (root) await markAuthoredContent(ctx, root)
})
// Versions change with their root; a version write alone still changes the published document.
triggers.register('authoredVersions', async (ctx, change) => {
  for (const version of [change.oldDoc, change.newDoc])
    if (version)
      await markContentScope(ctx, { scope: 'SOURCE', scopeId: version.contentSourceId }, true)
})
// Snapshots carry each root's compilation, and a recompile (derived sync, a parent's children, the
// compiler migration) writes only this row; a build that found it missing waits for this mark.
triggers.register('authoredVersionCompilations', async (ctx, change) => {
  const { subjectId } = change.newDoc ?? change.oldDoc
  const root = await ctx.innerDb
    .query('authoredRoots')
    .withIndex('by_publicId', (query) => query.eq('id', subjectId))
    .unique()
  if (root) await markAuthoredContent(ctx, root)
})
triggers.register('contentSources', async (ctx, change) => {
  if (change.operation === 'insert') return
  await markContentScope(ctx, { scope: 'SOURCE', scopeId: change.oldDoc.id }, false)
})
triggers.register('campaignContentShares', async (ctx, change) => {
  for (const share of [change.oldDoc, change.newDoc])
    if (share) await markContentScope(ctx, { scope: 'CAMPAIGN', scopeId: share.campaignId }, true)
})
// Share validity reads the System, owner, catalogues and the sharing member's active membership.
triggers.register('campaigns', async (ctx, change) => {
  if (change.operation === 'insert') return
  const { oldDoc, newDoc } = change
  if (
    newDoc &&
    oldDoc.gameSystemId === newDoc.gameSystemId &&
    oldDoc.ownerUserId === newDoc.ownerUserId &&
    oldDoc.primaryRulesCatalogueId === newDoc.primaryRulesCatalogueId &&
    oldDoc.additionalRulesCatalogueIds.join() === newDoc.additionalRulesCatalogueIds.join()
  )
    return
  await markContentScope(ctx, { scope: 'CAMPAIGN', scopeId: oldDoc.id }, false)
})
triggers.register('campaignMemberships', async (ctx, change) => {
  if (change.operation === 'insert') return
  const { oldDoc, newDoc } = change
  if (newDoc && oldDoc.status === newDoc.status && oldDoc.role === newDoc.role) return
  await markContentScope(ctx, { scope: 'CAMPAIGN', scopeId: oldDoc.campaignId }, false)
})

registerScope('campaigns', (_, document) => campaignScope(document.id))
registerScope('campaignMemberships', (_, document) => campaignScope(document.campaignId))
registerScope('campaignCharacterAssignments', (_, document) => campaignScope(document.campaignId))
// Grants of Character control change who may act in open Runs, so play-time readers refresh too.
registerScope('campaignCharacterAssignments', (_, document) => playScope(document.campaignId))
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

// Per-Campaign entry and Scene counters (Q18). Triggers see every insert and delete, including
// cascades, so no create or cleanup path maintains them by hand.
function registerCampaignContentUsage(
  tableName: 'campaignNotebookSections' | 'campaignVehicles' | 'sceneDefinitions',
  resource: 'campaignEntriesPerCampaign' | 'scenesPerCampaign'
) {
  triggers.register(tableName, async (ctx, change) => {
    if (change.operation === 'insert')
      await changeCampaignContentUsage(ctx.innerDb, change.newDoc.campaignId, resource, 1)
    else if (change.operation === 'delete')
      await changeCampaignContentUsage(ctx.innerDb, change.oldDoc.campaignId, resource, -1)
  })
}

registerCampaignContentUsage('campaignNotebookSections', 'campaignEntriesPerCampaign')
registerCampaignContentUsage('campaignVehicles', 'campaignEntriesPerCampaign')
registerCampaignContentUsage('sceneDefinitions', 'scenesPerCampaign')

// Scene vision reads active Characters only. Drafts are left untracked, so an autosave neither
// stales Scene vision nor pays trigger reads of the old and new payload (ADR 0036 S8).
registerScope('characters', (_, document) => characterScope(document.id))
// Every structural write advances the build record's structure clock; the head changes only with identity.
registerScope('characterBuildStates', (_, document) => characterScope(document.characterId))
registerScope('characterPlayStates', (_, document) => characterScope(document.characterId))
registerScope('campaignCharacterStates', (_, document) => characterScope(document.characterId))
registerScope('characterActiveRuleEffects', (_, document) => characterScope(document.characterId))
registerScope('authoredRouteIds', (_, document) =>
  document.subjectKind === 'CHARACTER' ? characterScope(document.subjectId) : null
)

registerScope('campaignScenePresentations', (_, document) => playScope(document.campaignId))
// Play settings are the room's PLAY input; Encounter writes below come from the room's own commands.
registerScope('campaignPlaySettings', (_, document) => playScope(document.campaignId))
triggers.register('campaignPlaySettings', async (ctx, change) => {
  for (const settings of [change.oldDoc, change.newDoc])
    if (settings) recordLiveRoomInput(ctx.innerDb, settings.campaignId, 'PLAY')
})
triggers.register('userProfiles', async (ctx, change) => {
  if (
    change.operation !== 'update' ||
    (change.oldDoc.autoRollDice === change.newDoc.autoRollDice &&
      change.oldDoc.gmRollVisibility === change.newDoc.gmRollVisibility)
  )
    return
  for await (const membership of ctx.innerDb
    .query('campaignMemberships')
    .withIndex('by_userId_status_joinedAt', (query) =>
      query.eq('userId', change.newDoc.userId).eq('status', 'ACTIVE')
    ))
    recordLiveRoomInput(ctx.innerDb, membership.campaignId, 'PREFERENCES')
})
registerScope('encounterRuns', (ctx, document) => {
  triggerState(ctx.innerDb).runCampaignIds.set(document.id, document.campaignId)
  return playScope(document.campaignId)
})
// Combat pauses the Campaign clock, whichever path (command, room checkpoint, deletion) changes a Run.
triggers.register('encounterRuns', async (ctx, change) => {
  if ((change.oldDoc?.status === 'ACTIVE') === (change.newDoc?.status === 'ACTIVE')) return
  const run = change.newDoc ?? change.oldDoc
  if (run) await syncCampaignClockWithCombat(ctx.innerDb, run.campaignId)
})
registerScope('encounterRunActors', (ctx, document) =>
  playScopeForEncounter(ctx, document.encounterId)
)
registerScope('encounterInitiativeRounds', (ctx, document) =>
  playScopeForEncounter(ctx, document.encounterId)
)
registerScope('encounterInitiativeSides', (ctx, document) =>
  playScopeForEncounter(ctx, document.encounterId)
)
registerScope('encounterInitiativeParticipants', (ctx, document) =>
  playScopeForEncounter(ctx, document.encounterId)
)
registerScope('encounterSceneBindings', (ctx, document) =>
  playScopeForEncounter(ctx, document.encounterId)
)
registerScope('encounterActorTokenBindings', (ctx, document) =>
  playScopeForEncounter(ctx, document.encounterId)
)
registerScope('encounterActiveRuleEffects', (ctx, document) =>
  playScopeForEncounter(ctx, document.encounterId)
)
registerScope('encounterMaintainedEffectStates', (ctx, document) =>
  playScopeForEncounter(ctx, document.encounterId)
)
registerScope('encounterSpatialRuleEffects', (ctx, document) =>
  playScopeForEncounter(ctx, document.encounterId)
)
registerScope('encounterRuleOccurrences', (ctx, document) =>
  playScopeForEncounter(ctx, document.encounterId)
)

/**
 * Change tracking alone, for callers that manage their own transaction; it sends no live-room
 * notices, so product writes use `mutation` or `internalMutation`.
 */
export const withSceneVisionTracking = triggers.wrapDB
export const mutation = withDomainRejections(
  customMutation(
    rawMutation,
    trackedMutation((ctx) => ctx.db)
  )
)
export const internalMutation = withDomainRejections(
  customMutation(
    rawInternalMutation,
    trackedMutation((ctx) => ctx.db)
  )
)
/** An internal mutation that applies change tracking to its own context (`withSceneVisionTracking`). */
export const untrackedInternalMutation = withDomainRejections(rawInternalMutation)
