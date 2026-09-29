import { v } from 'convex/values'
import { authoredSourceKindsByTable } from '@artificer-toolkit/authoring/nodeRuntime/authoredSourceFacts'
import type { AuthoredCurrentSourceIdentity } from '@artificer-toolkit/schema/api/authoredPublication'
import { authoredNodeRuntimeSourceFactsSchema } from '@artificer-toolkit/schema/api/nodeRuntimeSources'
import {
  liveSessionCharacterRulesInputSchema,
  liveSessionCharacterRulesResponseSchema,
  type LiveSessionCharacterRulesInput,
  type LiveSessionCharacterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionCharacterRules'
import { liveSessionCharacterRulesScope } from '@artificer-toolkit/schema/api/liveSessionEncounterCaptureBundle'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { QueryCtx } from '../_generated/server'
import { internalQuery } from '../lib/queries'
import type { Doc } from '../_generated/dataModel'
import { requireCampaignAuthority } from '../campaigns/authority'
import {
  readCampaignCharacterState,
  requireCampaignCharacterAuthority
} from '../campaigns/characterState'
import { readCampaignSharedRoot } from '../campaigns/contentAccess'
import { readCampaignCurrencyOptions } from '../campaigns/currencySystemDocuments'
import { readCharacterSheetState } from '../characters/sheetStateDocuments'
import { loadCharacterState } from '../characters/stateDocuments'
import { readCharacterSources, recordCharacterSourceIdentity } from '../characters/sourceReads'
import {
  canReadAuthoredRoot,
  readAuthoredVersion,
  readPublishedDocument
} from '../content/documents'
import { parsePublicationDocument } from '../content/publicationDocumentRead'
import { readVisibleAuthoredRouteId } from '../content/routeIds'
import { requireSystem } from '../content/systemDocuments'
import { isImportRowVisible } from '../imports/visibility'
import { requireIdentity } from '../lib/identity'
import { requireActiveCampaignLiveAuthority } from './authorityGuard'
import { readLiveSessionRulesRevisions } from './rulesRevisions'
import { readLiveConcentrationResponseAdmission } from './concentrationResponseAdmission'
import { readLiveMovementAdmission } from './encounterMovementAdmission'
import { readRunActor, readRunActors } from '@artificer-toolkit/encounter-persistence/documents'
import { readLiveEncounterTurnAdmission } from './encounterTurnAdmission'
import { readLiveEncounterActionScope } from './encounterActionAdmission'

/** Raw stored inputs only; the Session DO owns Character rule preparation and evaluation. */
export async function readCharacterRulesCapture(
  ctx: QueryCtx,
  args: unknown
): Promise<LiveSessionCharacterRulesResponse> {
  const input = liveSessionCharacterRulesInputSchema.parse(args)
  return readAdmittedCharacterCapture(ctx, input, await admitCharacterCaptureScope(ctx, input))
}

/**
 * Admits one Encounter capture scope once for several Character actors' INPUTS (a capture bundle).
 * The scope's authorization does not depend on the Character, so each response is still exactly
 * what its separate read returns. A movement scope names each Character's own actor, so each
 * Character is admitted separately there.
 */
export function admitCharacterInputsCaptures(
  ctx: QueryCtx,
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>
) {
  let admission: Promise<CharacterCaptureScopeAdmission> | undefined
  return async (actor: { id: string; sourceId: string }) => {
    const input = liveSessionCharacterRulesInputSchema.parse({
      ...liveSessionCharacterRulesScope(scope, actor),
      request: { kind: 'INPUTS' }
    })
    const admitted =
      scope.movement || !admission ? admitCharacterCaptureScope(ctx, input) : admission
    admission = admitted
    return readAdmittedCharacterCapture(ctx, input, await admitted)
  }
}

type CharacterCaptureScopeAdmission = Awaited<ReturnType<typeof admitCharacterCaptureScope>>

/**
 * The authorization every Character capture of one scope makes, and the Character sources an
 * admitted command scope covers (null: an owner read covers any assigned Character).
 */
async function admitCharacterCaptureScope(
  ctx: QueryCtx,
  input: Omit<LiveSessionCharacterRulesInput, 'request' | 'characterId'>
) {
  const { userId } = await requireIdentity(ctx)
  if (userId !== input.expectedUserId) throw new Error('Live Session identity mismatch.')
  if (
    [input.movement, input.concentrationResponse, input.turnCommand, input.action].filter(
      (scope) => scope !== undefined
    ).length > 1
  )
    throw new Error('Live Session capture scopes cannot be combined.')
  let characters: { sourceIds: ReadonlySet<string>; refusal: string } | null = null
  const characterSources = (actors: readonly EncounterRunActorState[]) =>
    new Set(actors.flatMap((actor) => (actor.kind === 'CHARACTER' ? [actor.sourceId] : [])))
  const movementAdmission = input.movement
    ? await readLiveMovementAdmission(ctx, { ...input, movement: input.movement })
    : null
  if (movementAdmission && input.movement)
    characters = {
      sourceIds: characterSources([
        await readRunActor(ctx, movementAdmission.state, input.movement.actorId)
      ]),
      refusal: 'Movement Character source is unavailable.'
    }
  const concentrationAdmission = input.concentrationResponse
    ? await readLiveConcentrationResponseAdmission(ctx, {
        campaignId: input.campaignId,
        authorityEpoch: input.authorityEpoch,
        expectedUserId: input.expectedUserId,
        expectedRole: input.expectedRole,
        encounterId: input.concentrationResponse.encounterId.toLowerCase(),
        expectedVersion: input.concentrationResponse.expectedVersion,
        concentrationResponse: input.concentrationResponse
      })
    : null
  if (concentrationAdmission) {
    if (concentrationAdmission.kind !== 'READY')
      throw new Error('Concentration Character is unavailable.')
    characters = {
      sourceIds: characterSources(concentrationAdmission.actors),
      refusal: 'Concentration Character is unavailable.'
    }
  }
  const turnAdmission = input.turnCommand
    ? await readLiveEncounterTurnAdmission(
        ctx,
        {
          ...input,
          encounterId: input.turnCommand.encounterId.toLowerCase(),
          expectedVersion: input.turnCommand.expectedVersion
        },
        input.turnCommand
      )
    : null
  if (turnAdmission && input.turnCommand) {
    if (
      turnAdmission.kind !== 'READY' ||
      turnAdmission.state.id !== input.turnCommand.encounterId.toLowerCase() ||
      turnAdmission.state.version !== input.turnCommand.expectedVersion
    )
      throw new Error('Turn Character source is unavailable.')
    characters = {
      sourceIds: characterSources(await readRunActors(ctx, turnAdmission.state)),
      refusal: 'Turn Character source is unavailable.'
    }
  }
  const actionCommand =
    input.action && 'command' in input.action ? input.action.command : input.action?.response
  const actionAdmission =
    input.action && actionCommand
      ? await readLiveEncounterActionScope(ctx, {
          ...input,
          encounterId: actionCommand.encounterId.toLowerCase(),
          expectedVersion: actionCommand.expectedVersion,
          action: input.action
        })
      : null
  if (actionAdmission)
    characters = {
      sourceIds: characterSources(await readRunActors(ctx, actionAdmission.state)),
      refusal: 'Action Character source is unavailable.'
    }
  const { campaign, membership } =
    movementAdmission ?? (await requireCampaignAuthority(ctx, input.campaignId, userId))
  const admitted = concentrationAdmission || movementAdmission || turnAdmission || actionAdmission
  if (membership.role !== input.expectedRole || (!admitted && membership.role !== 'OWNER'))
    throw new Error('Live Session role mismatch.')
  if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
  if (!movementAdmission) {
    await requireActiveCampaignLiveAuthority(ctx, {
      campaignId: campaign.id,
      epoch: input.authorityEpoch
    })
  }
  return { userId, campaign, admitted: Boolean(admitted), characters }
}

/** One Character capture under its admitted scope: the response its separate read returns. */
async function readAdmittedCharacterCapture(
  ctx: QueryCtx,
  input: LiveSessionCharacterRulesInput,
  { userId, campaign, admitted, characters }: CharacterCaptureScopeAdmission
): Promise<LiveSessionCharacterRulesResponse> {
  if (characters && !characters.sourceIds.has(input.characterId))
    throw new Error(characters.refusal)
  const { assignment } = await requireCampaignCharacterAuthority(
    ctx,
    campaign.id,
    input.characterId,
    admitted ? campaign.ownerUserId : userId
  )
  const { active, draft } = await loadCharacterState(ctx, input.characterId)
  if (!active || active.userId !== assignment.userId)
    throw new Error('Stored Campaign Character assignment mismatch.')
  if (draft && draft.userId !== active.userId)
    throw new Error('Stored Character draft ownership mismatch.')
  if (active.status !== 'ACTIVE')
    throw new Error('Character requires Builder repair before the Sheet can be read.')
  if (active.systemId !== campaign.gameSystemId)
    throw new Error('Stored Campaign Character System mismatch.')
  const route = await readVisibleAuthoredRouteId(ctx, { subjectId: active.id })
  if (!route || route.subjectKind !== 'CHARACTER' || route.ownerUserId !== active.userId)
    throw new Error('Stored Character route identity mismatch.')
  const scope = { input, userId }
  const revisions = await readLiveSessionRulesRevisions(ctx, {
    systemId: active.systemId,
    campaignId: campaign.id,
    characterId: active.id
  })

  if (input.request.kind === 'INPUTS') {
    const response = {
      kind: 'INPUTS' as const,
      owner: active,
      sheetState: readCharacterSheetState(active),
      system: await requireSystem(ctx, active.systemId),
      campaign: {
        id: campaign.id,
        status: campaign.status,
        contentMaturity: campaign.contentMaturity,
        attunementSlotOverride: campaign.attunementSlotOverride,
        state: (await readCampaignCharacterState(ctx, campaign.id, active.id)).state,
        currencyOptions: await readCampaignCurrencyOptions(ctx, campaign)
      }
    }
    return liveSessionCharacterRulesResponseSchema.parse({
      ...response,
      revisions,
      readChecksum: checksumCanonicalJson({ ...scope, response })
    })
  }

  // GM admission never substitutes for the Character owner's source access.
  const access = await readCharacterSources(ctx, active, active.userId)
  const identities = new Map<string, AuthoredCurrentSourceIdentity>()
  if (input.request.kind === 'PUBLICATIONS') {
    const { subjectIds: requestedIds, afterSubjectId } = input.request
    const subjectIds = [...new Set(requestedIds)]
      .sort()
      .filter((id) => afterSubjectId === null || id > afterSubjectId)
    const publications: Extract<
      LiveSessionCharacterRulesResponse,
      { kind: 'PUBLICATIONS' }
    >['publications'] = []
    const checkedIds: string[] = []
    let payloadBytes = 0
    for (const id of subjectIds) {
      // Root metadata also consumes database bytes, even when a source is absent or unreadable.
      if (checkedIds.length === 4 || payloadBytes >= 4 * 1024 * 1024) break
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', id))
        .unique()
      if (
        root &&
        root.systemId === active.systemId &&
        (await isImportRowVisible(ctx, root.importJobId))
      ) {
        const source = access.sources.find((source) => source.id === root.contentSourceId)
        const direct = source && (await canReadAuthoredRoot(ctx, root, active.userId, source))
        const shared = await readCampaignSharedRoot(ctx, campaign, root.subjectKind, root.id, root)
        if (direct || shared) {
          const version = await readAuthoredVersion(ctx, root)
          const byteLength =
            version.documentByteLength ?? new TextEncoder().encode(version.documentJson).byteLength
          if (payloadBytes > 0 && payloadBytes + byteLength > 4 * 1024 * 1024) break
          const publication = parsePublicationDocument(
            root.subjectKind,
            await readPublishedDocument(ctx, root, version)
          )
          payloadBytes += byteLength
          if (!direct && publication.document.status !== 'ACTIVE') {
            checkedIds.push(id)
            continue
          }
          recordCharacterSourceIdentity(identities, root)
          // Source checksum identifies the validated stored version; DTO parsing can normalize JSON.
          publications.push({
            identity: identities.get(root.id)!,
            version: version.version,
            documentJson: JSON.stringify(publication.document),
            campaignShared: !direct,
            campaignParentAllowed:
              (source?.kind === 'PLATFORM' && !!direct) ||
              (shared !== null && publication.document.status === 'ACTIVE'),
            ...(root.subjectKind === 'CLASS' && root.parentClassId !== undefined
              ? { storedParentId: root.parentClassId }
              : root.subjectKind === 'RACE' && root.parentRaceId !== undefined
                ? { storedParentId: root.parentRaceId }
                : root.subjectKind === 'EQUIPMENT' && root.parentEquipmentId !== undefined
                  ? { storedParentId: root.parentEquipmentId }
                  : {})
          })
        }
      }
      checkedIds.push(id)
    }
    const continueAfter = checkedIds.length < subjectIds.length ? checkedIds.at(-1)! : null
    return {
      kind: 'PUBLICATIONS',
      revisions,
      readChecksum: checksumCanonicalJson({
        ...scope,
        checkedIds,
        publications: publications.map(({ documentJson: _documentJson, ...metadata }) => metadata),
        continueAfter
      }),
      continueAfter,
      publications
    }
  }

  const kinds =
    input.request.kind === 'CLASS_CATALOGUE'
      ? (['CLASS'] as const)
      : input.request.kind === 'SPELL_CATALOGUE'
        ? (['SPELL'] as const)
        : (authoredSourceKindsByTable.features ?? [])
  const featureIds =
    input.request.kind === 'FEATURE_SOURCES' ? new Set(input.request.featureIds) : null
  let { kindIndex, sourceIndex, paginationCursor } = input.request.cursor ?? {
    kindIndex: 0,
    sourceIndex: 0,
    paginationCursor: null
  }
  if (kindIndex >= kinds.length || sourceIndex > access.sources.length)
    throw new Error('Character source cursor is invalid.')
  const sources: Extract<LiveSessionCharacterRulesResponse, { kind: 'SOURCE_INDEX' }>['sources'] =
    []
  // Native Convex permits one paginated read per function; even empty sources advance the cursor.
  {
    const kind = kinds[kindIndex]!
    const source = access.sources[sourceIndex]
    const roots: Array<{ root: Doc<'authoredRoots'>; campaignShared: boolean }> = []
    const options = { cursor: paginationCursor, numItems: 4 }
    const page = source
      ? await ctx.db
          .query('authoredRoots')
          .withIndex('by_contentSourceId_subjectKind_ownerUserId', (q) =>
            q
              .eq('contentSourceId', source.id)
              .eq('subjectKind', kind)
              .eq('ownerUserId', source.kind === 'USER' ? source.ownerUserId : undefined)
          )
          .paginate(options)
      : await ctx.db
          .query('campaignContentShares')
          .withIndex('by_campaignId_subjectKind_subjectId', (q) =>
            q.eq('campaignId', campaign.id).eq('subjectKind', kind)
          )
          .paginate(options)
    if (
      page.pageStatus === 'SplitRequired' ||
      (!page.isDone && page.continueCursor === paginationCursor)
    )
      throw new Error('Character source page cannot advance.')
    for (const row of page.page) {
      if ('subjectId' in row) {
        const root = await readCampaignSharedRoot(ctx, campaign, kind, row.subjectId)
        if (root) {
          const directSource = access.sources.find(
            (candidate) => candidate.id === root.contentSourceId
          )
          if (!directSource || !(await canReadAuthoredRoot(ctx, root, active.userId, directSource)))
            roots.push({ root, campaignShared: true })
        }
      } else {
        if (row.systemId !== active.systemId)
          throw new Error('Stored Character source System mismatch.')
        if (source && (await canReadAuthoredRoot(ctx, row, active.userId, source)))
          roots.push({ root: row, campaignShared: false })
      }
    }
    for (const { root, campaignShared } of roots) {
      let matches = true
      if (featureIds) {
        if (!root.authoringSources)
          throw new Error('Character feature source facts are not materialized.')
        const metadata = authoredNodeRuntimeSourceFactsSchema.parse(root.authoringSources)
        if (metadata.checksum !== root.checksum)
          throw new Error('Stored Character feature source checksum mismatch.')
        matches =
          metadata.rows.features?.some(
            (row) => typeof row.id === 'string' && featureIds.has(row.id)
          ) ?? false
      }
      recordCharacterSourceIdentity(identities, root)
      sources.push({ ...identities.get(root.id)!, campaignShared, matches })
    }
    if (page.isDone) {
      sourceIndex++
      paginationCursor = null
      if (sourceIndex > access.sources.length) {
        kindIndex++
        sourceIndex = 0
      }
    } else {
      paginationCursor = page.continueCursor
    }
  }
  const continueCursor =
    kindIndex < kinds.length ? { kindIndex, sourceIndex, paginationCursor } : null
  sources.sort((left, right) => left.subjectId.localeCompare(right.subjectId))
  return {
    kind: 'SOURCE_INDEX',
    revisions,
    readChecksum: checksumCanonicalJson({ ...scope, sources, continueCursor }),
    continueCursor,
    sources
  }
}

// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const capture = internalQuery({
  args: v.any(),
  handler: readCharacterRulesCapture
})
