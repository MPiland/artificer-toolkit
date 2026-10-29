/**
 * Read-only F12 inspection retains known IDs so deleted roots cannot hide orphan descendants.
 */
import type { PaginationResult } from 'convex/server'
import { convexToJson } from 'convex/values'
import { zodToConvex } from 'convex-helpers/server/zod4'
import { components } from './_generated/api'
import type { QueryCtx } from './_generated/server'
import { internalQuery } from './lib/queries'
import {
  developmentAccountDeletionInspectInputSchema,
  developmentAccountDeletionInspectResultSchema,
  type DevelopmentAccountDeletionKnown
} from '@artificer-toolkit/schema/api/developmentAccountDeletion'
import { requireFixtureAccount } from './lib/developmentFixtures'
import { readReceiptHeaders } from './lib/receiptLedgers'
import { authoredSubjectKindSchema } from '@artificer-toolkit/schema/projections/identity'

const emptyKnown = (): DevelopmentAccountDeletionKnown => ({
  characterIds: [],
  sourceIds: [],
  campaignIds: [],
  rootReferences: [],
  dependentRootReferences: [],
  definitionIds: [],
  blueprintIds: [],
  copyDestinationIds: [],
  mediaAssetIds: [],
  socialProfileId: null
})
type Row = { _id: string }
type Tables = Record<string, Row[]>

async function bounded<T extends Row>(
  query: { take: (count: number) => Promise<T[]> },
  maximum: number,
  label: string
) {
  const result = await query.take(maximum + 1)
  if (result.length > maximum) throw new Error(label + ' exceeds its fixture inspection bound.')
  return result.sort((left, right) => left._id.localeCompare(right._id))
}
function union(current: string[], known: string[]) {
  return [...new Set([...current, ...known])].sort()
}
function rows(tables: Tables, name: string) {
  return tables[name] ?? []
}
function ids(rows: Row[], field: string) {
  return rows.flatMap((row) => {
    const value = (row as Row & Record<string, unknown>)[field]
    return typeof value === 'string' ? [value] : []
  })
}
function uniqueRows<T extends Row>(value: T[]) {
  return [...new Map(value.map((row) => [row._id, row])).values()].sort((left, right) =>
    left._id.localeCompare(right._id)
  )
}
type RootReference = DevelopmentAccountDeletionKnown['rootReferences'][number]
function rootReferences(rows: Row[]) {
  const result = new Map<string, RootReference>()
  for (const row of rows) {
    const value = row as Row & Record<string, unknown>
    const subjectKind = authoredSubjectKindSchema.safeParse(value.subjectKind)
    if (typeof value.id !== 'string' || typeof value.systemId !== 'string' || !subjectKind.success)
      throw new Error('Observed authored root reference is malformed.')
    const reference = { id: value.id, systemId: value.systemId, subjectKind: subjectKind.data }
    const existing = result.get(reference.id)
    if (
      existing &&
      (existing.systemId !== reference.systemId || existing.subjectKind !== reference.subjectKind)
    )
      throw new Error('Observed authored root references disagree about a root identity.')
    result.set(reference.id, reference)
  }
  return [...result.values()].sort((left, right) => left.id.localeCompare(right.id))
}
function draftRootReferences(rows: Row[]) {
  const result = new Map<string, RootReference>()
  for (const row of rows) {
    const value = row as Row & Record<string, unknown>
    const subjectKind = authoredSubjectKindSchema.safeParse(value.subjectKind)
    if (
      typeof value.subjectId !== 'string' ||
      typeof value.systemId !== 'string' ||
      !subjectKind.success
    )
      throw new Error('Observed authored draft root reference is malformed.')
    const reference = {
      id: value.subjectId,
      systemId: value.systemId,
      subjectKind: subjectKind.data
    }
    const existing = result.get(reference.id)
    if (
      existing &&
      (existing.systemId !== reference.systemId || existing.subjectKind !== reference.subjectKind)
    )
      throw new Error('Observed authored draft references disagree about a root identity.')
    result.set(reference.id, reference)
  }
  return [...result.values()].sort((left, right) => left.id.localeCompare(right.id))
}
function mergeRootReferences(current: RootReference[], prior: RootReference[]) {
  const result = new Map<string, RootReference>()
  for (const reference of [...prior, ...current]) {
    const existing = result.get(reference.id)
    if (
      existing &&
      (existing.systemId !== reference.systemId || existing.subjectKind !== reference.subjectKind)
    )
      throw new Error('Known authored root references disagree about a root identity.')
    result.set(reference.id, reference)
  }
  return [...result.values()].sort((left, right) => left.id.localeCompare(right.id))
}
function subjectDraftRootReferences(rows: Row[], userId: string) {
  const owned = rows.filter((row) => (row as Row & Record<string, unknown>).userId === userId)
  return draftRootReferences(owned)
}
function sourceVersionRootReferences(rows: Row[], sourceIds: string[]) {
  const sourceSet = new Set(sourceIds)
  const owned: Row[] = []
  for (const row of rows) {
    const contentSourceId = (row as Row & Record<string, unknown>).contentSourceId
    if (typeof contentSourceId !== 'string')
      throw new Error('Observed authored version source identity is malformed.')
    if (sourceSet.has(contentSourceId)) owned.push(row)
  }
  return rootReferences(owned)
}
function rejectOwnedDependentReferences(owned: RootReference[], dependent: RootReference[]) {
  const ownedIds = new Set(owned.map((reference) => reference.id))
  if (dependent.some((reference) => ownedIds.has(reference.id)))
    throw new Error('An authored dependency is also classified as subject-owned.')
  return dependent
}
function derivedKnown(
  tables: Tables,
  prior: DevelopmentAccountDeletionKnown,
  userId: string
): DevelopmentAccountDeletionKnown {
  const socialProfileIds = ids(rows(tables, 'socialProfiles'), 'id')
  if (socialProfileIds.length > 1)
    throw new Error('Social profile inspection found more than one subject profile.')
  const sourceIds = union(ids(rows(tables, 'contentSources'), 'id'), prior.sourceIds)
  const ownedReferences = mergeRootReferences(
    mergeRootReferences(
      rootReferences(rows(tables, 'authoredRoots')),
      subjectDraftRootReferences(rows(tables, 'authoredDrafts'), userId)
    ),
    sourceVersionRootReferences(rows(tables, 'authoredVersions'), sourceIds)
  )
  const knownOwnedRootReferences = mergeRootReferences(ownedReferences, prior.rootReferences)
  const observedDependents = rootReferences(rows(tables, 'authoredDependentRoots')).filter(
    (reference) => !knownOwnedRootReferences.some((owned) => owned.id === reference.id)
  )
  const dependentRootReferences = rejectOwnedDependentReferences(
    knownOwnedRootReferences,
    mergeRootReferences(observedDependents, prior.dependentRootReferences)
  )
  return {
    characterIds: union(
      [
        ...ids(rows(tables, 'characters'), 'id'),
        ...ids(rows(tables, 'characterDrafts'), 'characterId')
      ],
      prior.characterIds
    ),
    sourceIds,
    campaignIds: union(
      [
        ...ids(rows(tables, 'campaigns'), 'id'),
        ...ids(rows(tables, 'campaignMemberships'), 'campaignId'),
        ...ids(rows(tables, 'campaignCharacterAssignments'), 'campaignId'),
        ...ids(rows(tables, 'campaignContentShares'), 'campaignId')
      ],
      prior.campaignIds
    ),
    rootReferences: knownOwnedRootReferences,
    dependentRootReferences,
    definitionIds: union(ids(rows(tables, 'reusableDefinitions'), 'id'), prior.definitionIds),
    blueprintIds: union(
      [
        ...ids(rows(tables, 'encounterBlueprints'), 'id'),
        ...ids(rows(tables, 'encounterBlueprintUpdates'), 'blueprintId')
      ],
      prior.blueprintIds
    ),
    copyDestinationIds: union(
      ids(rows(tables, 'campaignCopyJobs'), 'destinationCampaignId'),
      prior.copyDestinationIds
    ),
    mediaAssetIds: union(ids(rows(tables, 'mediaAssets'), 'id'), prior.mediaAssetIds),
    socialProfileId: socialProfileIds[0] ?? prior.socialProfileId
  }
}
function stateJson(tables: Tables) {
  const result = JSON.stringify(convexToJson(tables))
  if (new TextEncoder().encode(result).byteLength > 8 * 1024 * 1024)
    throw new Error('Account fixture inspection exceeds its retained CLI byte bound.')
  return result
}
function requireKnown(known: DevelopmentAccountDeletionKnown | undefined) {
  if (!known)
    throw new Error('Deleted account inspection requires its previously captured known identities.')
  return known
}

async function validateKnownBefore(
  ctx: QueryCtx,
  userId: string,
  known: DevelopmentAccountDeletionKnown
) {
  const socialProfileId = known.socialProfileId
  const [
    characters,
    characterDrafts,
    sources,
    ownedRoots,
    ownedDrafts,
    ownedVersions,
    dependentRoots,
    definitions,
    blueprints,
    campaigns,
    memberships,
    socialProfiles,
    copyJobs,
    mediaAssets
  ] = await Promise.all([
    Promise.all(
      known.characterIds.map((id) =>
        ctx.db
          .query('characters')
          .withIndex('by_publicId', (q) => q.eq('id', id))
          .unique()
      )
    ),
    Promise.all(
      known.characterIds.map((id) =>
        bounded(
          ctx.db
            .query('characterDrafts')
            .withIndex('by_characterId', (q) => q.eq('characterId', id)),
          8,
          'known Character drafts'
        )
      )
    ),
    Promise.all(
      known.sourceIds.map((id) =>
        ctx.db
          .query('contentSources')
          .withIndex('by_publicId', (q) => q.eq('id', id))
          .unique()
      )
    ),
    Promise.all(
      known.rootReferences.map((reference) =>
        ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', reference.id))
          .unique()
      )
    ),
    Promise.all(
      known.rootReferences.map((reference) =>
        bounded(
          ctx.db
            .query('authoredDrafts')
            .withIndex('by_subjectId', (q) => q.eq('subjectId', reference.id)),
          32,
          'known authored drafts'
        )
      )
    ),
    Promise.all(
      known.rootReferences.map((reference) =>
        bounded(
          ctx.db
            .query('authoredVersions')
            .withIndex('by_id_version', (q) => q.eq('id', reference.id)),
          32,
          'known authored versions'
        )
      )
    ),
    Promise.all(
      known.dependentRootReferences.map((reference) =>
        ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', reference.id))
          .unique()
      )
    ),
    Promise.all(
      known.definitionIds.map((id) =>
        ctx.db
          .query('reusableDefinitions')
          .withIndex('by_publicId', (q) => q.eq('id', id))
          .unique()
      )
    ),
    Promise.all(
      known.blueprintIds.map((id) =>
        ctx.db
          .query('encounterBlueprints')
          .withIndex('by_publicId', (q) => q.eq('id', id))
          .unique()
      )
    ),
    Promise.all(
      known.campaignIds.map((id) =>
        ctx.db
          .query('campaigns')
          .withIndex('by_publicId', (q) => q.eq('id', id))
          .unique()
      )
    ),
    Promise.all(
      known.campaignIds.map((id) =>
        ctx.db
          .query('campaignMemberships')
          .withIndex('by_campaignId_userId', (q) => q.eq('campaignId', id).eq('userId', userId))
          .unique()
      )
    ),
    socialProfileId
      ? ctx.db
          .query('socialProfiles')
          .withIndex('by_publicId', (q) => q.eq('id', socialProfileId))
          .unique()
      : Promise.resolve(null),
    bounded(
      ctx.db
        .query('campaignCopyJobs')
        .withIndex('by_ownerUserId_createdAt_id', (q) => q.eq('ownerUserId', userId)),
      32,
      'campaignCopyJobs'
    ),
    Promise.all(
      known.mediaAssetIds.map((id) =>
        ctx.db
          .query('mediaAssets')
          .withIndex('by_publicId', (q) => q.eq('id', id))
          .unique()
      )
    )
  ])
  for (let index = 0; index < known.characterIds.length; index += 1) {
    const character = characters[index]
    const drafts = characterDrafts[index] ?? []
    if (
      (!character || character.userId !== userId) &&
      !drafts.some((draft) => draft.userId === userId)
    )
      throw new Error('Known Character is not owned by the alive fixture account.')
  }
  if (sources.some((row) => !row || row.ownerUserId !== userId))
    throw new Error('Known content source is not owned by the alive fixture account.')
  const sourceIds = new Set(known.sourceIds)
  for (let index = 0; index < known.rootReferences.length; index += 1) {
    const reference = known.rootReferences[index]
    const root = ownedRoots[index]
    const drafts = ownedDrafts[index] ?? []
    const versions = ownedVersions[index] ?? []
    if (!reference) throw new Error('Known authored root reference is missing.')
    const activeMatch =
      root &&
      root.ownerUserId === userId &&
      root.systemId === reference.systemId &&
      root.subjectKind === reference.subjectKind
    const draftMatch = drafts.some(
      (draft) =>
        draft.userId === userId &&
        draft.systemId === reference.systemId &&
        draft.subjectKind === reference.subjectKind
    )
    const versionMatch = versions.some(
      (version) =>
        sourceIds.has(version.contentSourceId) &&
        version.systemId === reference.systemId &&
        version.subjectKind === reference.subjectKind
    )
    if (!activeMatch && !draftMatch && !versionMatch)
      throw new Error('Known authored root reference does not match the alive fixture state.')
  }
  for (let index = 0; index < known.dependentRootReferences.length; index += 1) {
    const reference = known.dependentRootReferences[index]
    const root = dependentRoots[index]
    if (
      !reference ||
      !root ||
      root.systemId !== reference.systemId ||
      root.subjectKind !== reference.subjectKind ||
      root.ownerUserId === userId
    )
      throw new Error('Known authored dependent reference does not match the alive fixture state.')
  }
  if (definitions.some((row) => !row || !sourceIds.has(row.contentSourceId)))
    throw new Error('Known reusable definition is outside the alive fixture source scope.')
  if (blueprints.some((row) => !row || row.ownerUserId !== userId))
    throw new Error('Known encounter blueprint is not owned by the alive fixture account.')
  if (campaigns.some((row, index) => !row || (row.ownerUserId !== userId && !memberships[index])))
    throw new Error('Known Campaign is outside the alive fixture scope.')
  if (socialProfiles && socialProfiles.userId !== userId)
    throw new Error('Known Social profile is outside the alive fixture scope.')
  const destinationIds = new Set(copyJobs.map((row) => row.destinationCampaignId))
  if (known.copyDestinationIds.some((id) => !destinationIds.has(id)))
    throw new Error('Known copy destination is outside the alive fixture scope.')
  if (mediaAssets.some((row) => !row || row.ownerUserId !== userId))
    throw new Error('Known media asset is outside the alive fixture scope.')
}
/** Every query below is indexed and bounded; promotion must retain those exact index names. */
export const inspect = internalQuery({
  args: zodToConvex(developmentAccountDeletionInspectInputSchema),
  returns: zodToConvex(developmentAccountDeletionInspectResultSchema),
  handler: async (ctx: QueryCtx, raw) => {
    if (process.env.SITE_URL !== 'http://localhost:3000')
      throw new Error('Account fixture inspection requires the development application origin.')
    const input = developmentAccountDeletionInspectInputSchema.parse(raw)
    await requireFixtureAccount(ctx, input.auditorUserId)

    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', input.subjectUserId))
      .unique()
    const authUser = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: 'user',
      where: [{ field: '_id', value: input.authUserId }]
    })
    if (profile || authUser) {
      if (
        !profile ||
        !authUser ||
        profile.authUserId !== input.authUserId ||
        authUser.email !== input.email
      )
        throw new Error('Subject profile/provider identity mismatch.')
      // A staged deletion (ADR 0040) removes owned rows before the account itself.
      const deleting = await ctx.db
        .query('accountDeletionJobs')
        .withIndex('by_userId', (q) => q.eq('userId', input.subjectUserId))
        .unique()
      if (!deleting)
        await validateKnownBefore(ctx, input.subjectUserId, input.known ?? emptyKnown())
    } else {
      requireKnown(input.known)
    }

    const known = input.known ?? emptyKnown()
    const tables = await readScope(ctx, input.scope, input.subjectUserId, input.authUserId, known)
    const result = developmentAccountDeletionInspectResultSchema.parse({
      stateJson: stateJson(tables),
      known: derivedKnown(tables, known, input.subjectUserId)
    })
    return result
  }
})

async function readScope(
  ctx: QueryCtx,
  scope: string,
  userId: string,
  authUserId: string,
  known: DevelopmentAccountDeletionKnown
): Promise<Tables> {
  if (scope === 'IDENTITY') return readIdentity(ctx, userId, authUserId, known)
  if (scope === 'CHARACTERS') return readCharacters(ctx, userId, known)
  if (scope === 'AUTHORED') return readAuthored(ctx, userId, known)
  return readDeferred(ctx, userId, known)
}

async function providerRows(
  ctx: QueryCtx,
  model: 'account' | 'session',
  authUserId: string
): Promise<Row[]> {
  const result: Row[] = []
  const cursors = new Set<string>()
  let cursor: string | null = null
  for (;;) {
    const page: PaginationResult<Row> = await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model,
      where: [{ field: 'userId', value: authUserId }],
      paginationOpts: { cursor, numItems: 32 }
    })
    result.push(...page.page)
    if (result.length > 100)
      throw new Error('Provider catalogue exceeds its fixture inspection bound.')
    if (page.isDone) return result.sort((left, right) => left._id.localeCompare(right._id))
    if (cursors.has(page.continueCursor))
      throw new Error('Provider catalogue cursor does not advance.')
    cursors.add(page.continueCursor)
    cursor = page.continueCursor
  }
}

async function readIdentity(
  ctx: QueryCtx,
  userId: string,
  authUserId: string,
  known: DevelopmentAccountDeletionKnown
): Promise<Tables> {
  const [
    profile,
    entitlement,
    usage,
    campaigns,
    activeMemberships,
    leftMemberships,
    blueprints,
    ownerBlueprintUpdates,
    providerAccounts,
    providerSessions
  ] = await Promise.all([
    bounded(
      ctx.db.query('userProfiles').withIndex('by_userId', (q) => q.eq('userId', userId)),
      1,
      'userProfiles'
    ),
    bounded(
      ctx.db.query('accountEntitlements').withIndex('by_userId', (q) => q.eq('userId', userId)),
      1,
      'accountEntitlements'
    ),
    bounded(
      ctx.db
        .query('accountUsageEntries')
        .withIndex('by_ownerUserId', (q) => q.eq('ownerUserId', userId)),
      64,
      'accountUsageEntries'
    ),
    bounded(
      ctx.db
        .query('campaigns')
        .withIndex('by_ownerUserId_status', (q) => q.eq('ownerUserId', userId)),
      32,
      'owned Campaigns'
    ),
    bounded(
      ctx.db
        .query('campaignMemberships')
        .withIndex('by_userId_status_joinedAt', (q) =>
          q.eq('userId', userId).eq('status', 'ACTIVE')
        ),
      32,
      'active Campaign memberships'
    ),
    bounded(
      ctx.db
        .query('campaignMemberships')
        .withIndex('by_userId_status_joinedAt', (q) => q.eq('userId', userId).eq('status', 'LEFT')),
      32,
      'left Campaign memberships'
    ),
    bounded(
      ctx.db
        .query('encounterBlueprints')
        .withIndex('by_ownerUserId_commandId', (q) => q.eq('ownerUserId', userId)),
      8,
      'encounterBlueprints'
    ),
    bounded(
      ctx.db
        .query('encounterBlueprintUpdates')
        .withIndex('by_ownerUserId_commandId', (q) => q.eq('ownerUserId', userId)),
      32,
      'encounterBlueprintUpdates'
    ),
    providerRows(ctx, 'account', authUserId),
    providerRows(ctx, 'session', authUserId)
  ])
  const memberships = [...activeMemberships, ...leftMemberships].sort((a, b) =>
    a._id.localeCompare(b._id)
  )
  const campaignIds = union(
    [...campaigns.map((row) => row.id), ...memberships.map((row) => row.campaignId)],
    known.campaignIds
  )
  const blueprintIds = union(
    [...blueprints.map((row) => row.id), ...ownerBlueprintUpdates.map((row) => row.blueprintId)],
    known.blueprintIds
  )
  const [knownBlueprints, assignments, shares, knownBlueprintUpdates, providerUser] =
    await Promise.all([
      Promise.all(
        blueprintIds.map((id) =>
          bounded(
            ctx.db.query('encounterBlueprints').withIndex('by_publicId', (q) => q.eq('id', id)),
            1,
            'encounterBlueprints by public ID'
          )
        )
      ),
      Promise.all(
        campaignIds.map((id) =>
          bounded(
            ctx.db
              .query('campaignCharacterAssignments')
              .withIndex('by_campaignId_userId', (q) =>
                q.eq('campaignId', id).eq('userId', userId)
              ),
            8,
            'Campaign assignments'
          )
        )
      ),
      Promise.all(
        campaignIds.map((id) =>
          bounded(
            ctx.db
              .query('campaignContentShares')
              .withIndex('by_campaignId_sharedBy', (q) =>
                q.eq('campaignId', id).eq('sharedBy', userId)
              ),
            32,
            'Campaign shares'
          )
        )
      ),
      Promise.all(
        blueprintIds.map((id) =>
          bounded(
            ctx.db
              .query('encounterBlueprintUpdates')
              .withIndex('by_blueprintId', (q) => q.eq('blueprintId', id)),
            32,
            'encounterBlueprintUpdates by blueprint'
          )
        )
      ),
      ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: 'user',
        where: [{ field: '_id', value: authUserId }]
      })
    ])
  const allBlueprints = uniqueRows([...blueprints, ...knownBlueprints.flat()])
  if (allBlueprints.some((row) => row.ownerUserId !== userId))
    throw new Error('Known encounter blueprint collides with another account.')
  return {
    userProfiles: profile,
    accountEntitlements: entitlement,
    accountUsageEntries: usage,
    campaigns,
    campaignMemberships: memberships,
    campaignCharacterAssignments: assignments.flat().sort((a, b) => a._id.localeCompare(b._id)),
    campaignContentShares: shares.flat().sort((a, b) => a._id.localeCompare(b._id)),
    encounterBlueprints: allBlueprints,
    encounterBlueprintUpdates: uniqueRows([
      ...ownerBlueprintUpdates,
      ...knownBlueprintUpdates.flat()
    ]),
    providerUsers: providerUser ? [providerUser] : [],
    providerAccounts,
    providerSessions
  }
}
async function readCharacters(
  ctx: QueryCtx,
  userId: string,
  known: DevelopmentAccountDeletionKnown
): Promise<Tables> {
  const [current, drafts, rolls] = await Promise.all([
    bounded(
      ctx.db.query('characters').withIndex('by_userId', (q) => q.eq('userId', userId)),
      8,
      'characters'
    ),
    bounded(
      ctx.db
        .query('characterDrafts')
        .withIndex('by_userId_updatedAt', (q) => q.eq('userId', userId)),
      8,
      'characterDrafts'
    ),
    bounded(
      ctx.db
        .query('userRollHistory')
        .withIndex('by_userId_createdAt_id', (q) => q.eq('userId', userId)),
      32,
      'userRollHistory'
    )
  ])
  const characterIds = union(
    [...current.map((row) => row.id), ...drafts.map((row) => row.characterId)],
    known.characterIds
  )
  const [knownCharacters, plays, payloads, routes, assignments, receipts, effects] =
    await Promise.all([
      Promise.all(
        characterIds.map((id) =>
          bounded(
            ctx.db.query('characters').withIndex('by_publicId', (q) => q.eq('id', id)),
            1,
            'characters by public ID'
          )
        )
      ),
      Promise.all(
        characterIds.map((id) =>
          bounded(
            ctx.db
              .query('characterPlayStates')
              .withIndex('by_characterId', (q) => q.eq('characterId', id)),
            1,
            'Character play states'
          )
        )
      ),
      Promise.all(
        characterIds.map((id) =>
          bounded(
            ctx.db
              .query('characterDraftPayloads')
              .withIndex('by_characterId_id', (q) => q.eq('characterId', id)),
            8,
            'Character draft payloads'
          )
        )
      ),
      Promise.all(
        characterIds.map((id) =>
          bounded(
            ctx.db
              .query('authoredRouteIds')
              .withIndex('by_subjectId', (q) => q.eq('subjectId', id)),
            1,
            'Character routes'
          )
        )
      ),
      Promise.all(
        characterIds.map((id) =>
          bounded(
            ctx.db
              .query('campaignCharacterAssignments')
              .withIndex('by_characterId', (q) => q.eq('characterId', id)),
            8,
            'Character assignments'
          )
        )
      ),
      Promise.all(
        characterIds.map((id) =>
          bounded(
            ctx.db
              .query('characterCommandReceipts')
              .withIndex('by_characterId_commandId', (q) => q.eq('characterId', id)),
            32,
            'Character receipts'
          )
        )
      ),
      Promise.all(
        characterIds.map((id) =>
          bounded(
            ctx.db
              .query('characterActiveRuleEffects')
              .withIndex('by_characterId_createdOrdinal_id', (q) => q.eq('characterId', id)),
            32,
            'Character effects'
          )
        )
      )
    ])
  const characters = uniqueRows([...current, ...knownCharacters.flat()])
  if (characters.some((row) => row.userId !== userId))
    throw new Error('Known Character identity collides with another account.')
  const operational: Tables = {
    characterBuildStates: uniqueRows(
      (
        await Promise.all(
          characterIds.map((id) =>
            bounded(
              ctx.db
                .query('characterBuildStates')
                .withIndex('by_characterId', (q) => q.eq('characterId', id)),
              1,
              'Character build states'
            )
          )
        )
      ).flat()
    )
  }
  for (const table of [
    'characterInventoryItems',
    'characterCurrencyGroups',
    'characterClassSpellStates',
    'characterSpellCustomizations',
    'characterCreatureInstances',
    'characterVehicleInstances',
    'characterNotes',
    'characterNoteGroups',
    'characterExtraEquipment'
  ] as const) {
    operational[table] = uniqueRows(
      (
        await Promise.all(
          characterIds.map((id) =>
            bounded(
              ctx.db
                .query(table)
                .withIndex('by_characterId_position', (q) => q.eq('characterId', id)),
              32,
              table
            )
          )
        )
      ).flat()
    )
  }
  operational.characterSheetDerivations = uniqueRows(
    (
      await Promise.all(
        characterIds.map((id) =>
          bounded(
            ctx.db
              .query('characterSheetDerivations')
              .withIndex('by_characterId', (q) => q.eq('characterId', id)),
            1,
            'Character Sheet derivations'
          )
        )
      )
    ).flat()
  )
  operational.characterSheetSections = uniqueRows(
    (
      await Promise.all(
        characterIds.map((id) =>
          bounded(
            ctx.db
              .query('characterSheetSections')
              .withIndex('by_characterId_viewer_section', (q) => q.eq('characterId', id)),
            512,
            'Character Sheet sections'
          )
        )
      )
    ).flat()
  )
  return {
    ...operational,
    characters,
    characterPlayStates: plays.flat().sort((a, b) => a._id.localeCompare(b._id)),
    characterDrafts: drafts,
    characterDraftPayloads: payloads.flat().sort((a, b) => a._id.localeCompare(b._id)),
    userRollHistory: rolls,
    authoredRouteIds: routes.flat().sort((a, b) => a._id.localeCompare(b._id)),
    campaignCharacterAssignments: assignments.flat().sort((a, b) => a._id.localeCompare(b._id)),
    characterCommandReceipts: (
      await readReceiptHeaders(ctx, 'characterCommandReceipts', receipts.flat())
    ).sort((a, b) => a._id.localeCompare(b._id)),
    characterActiveRuleEffects: effects.flat().sort((a, b) => a._id.localeCompare(b._id))
  }
}
async function readAuthored(
  ctx: QueryCtx,
  userId: string,
  known: DevelopmentAccountDeletionKnown
): Promise<Tables> {
  const [sources, currentOwnedRoots, currentDrafts, imports] = await Promise.all([
    bounded(
      ctx.db
        .query('contentSources')
        .withIndex('by_ownerUserId', (q) => q.eq('ownerUserId', userId)),
      8,
      'contentSources'
    ),
    bounded(
      ctx.db.query('authoredRoots').withIndex('by_ownerUserId', (q) => q.eq('ownerUserId', userId)),
      32,
      'authoredRoots'
    ),
    bounded(
      ctx.db.query('authoredDrafts').withIndex('by_userId', (q) => q.eq('userId', userId)),
      32,
      'authoredDrafts'
    ),
    bounded(
      ctx.db
        .query('authoredImportRefs')
        .withIndex('by_userId_subjectKind_subjectId_createdAt', (q) => q.eq('userId', userId)),
      32,
      'authoredImportRefs'
    )
  ])
  const sourceIds = union(
    sources.map((row) => row.id),
    known.sourceIds
  )
  const currentReferences = mergeRootReferences(
    rootReferences(currentOwnedRoots),
    draftRootReferences(currentDrafts)
  )
  const ownedReferences = mergeRootReferences(currentReferences, known.rootReferences)
  const [knownSources, knownOwnedRoots, sourceVersions] = await Promise.all([
    Promise.all(
      sourceIds.map((id) =>
        bounded(
          ctx.db.query('contentSources').withIndex('by_publicId', (q) => q.eq('id', id)),
          1,
          'contentSources by public ID'
        )
      )
    ),
    Promise.all(
      ownedReferences.map((reference) =>
        bounded(
          ctx.db.query('authoredRoots').withIndex('by_publicId', (q) => q.eq('id', reference.id)),
          1,
          'authoredRoots by public ID'
        )
      )
    ),
    Promise.all(
      sourceIds.map((id) =>
        bounded(
          ctx.db
            .query('authoredVersions')
            .withIndex('by_contentSourceId', (q) => q.eq('contentSourceId', id)),
          32,
          'authoredVersions by source'
        )
      )
    )
  ])
  const allSources = uniqueRows([...sources, ...knownSources.flat()])
  const ownedRoots = uniqueRows([...currentOwnedRoots, ...knownOwnedRoots.flat()])
  if (
    allSources.some((row) => row.ownerUserId !== userId) ||
    ownedRoots.some((row) => row.ownerUserId !== userId)
  )
    throw new Error('Known authored identity collides with another account.')
  const historicalReferences = rootReferences(sourceVersions.flat())
  const parentReferences = mergeRootReferences(
    mergeRootReferences(rootReferences(ownedRoots), draftRootReferences(currentDrafts)),
    known.rootReferences
  )
  const [classChildren, raceChildren, equipmentChildren, knownDependentRoots] = await Promise.all([
    Promise.all(
      parentReferences
        .filter((reference) => reference.subjectKind === 'CLASS')
        .map((reference) =>
          bounded(
            ctx.db
              .query('authoredRoots')
              .withIndex('by_system_kind_parentClassId', (q) =>
                q
                  .eq('systemId', reference.systemId)
                  .eq('subjectKind', 'CLASS')
                  .eq('parentClassId', reference.id)
              ),
            32,
            'Class child roots'
          )
        )
    ),
    Promise.all(
      parentReferences
        .filter((reference) => reference.subjectKind === 'RACE')
        .map((reference) =>
          bounded(
            ctx.db
              .query('authoredRoots')
              .withIndex('by_system_kind_parentRaceId', (q) =>
                q
                  .eq('systemId', reference.systemId)
                  .eq('subjectKind', 'RACE')
                  .eq('parentRaceId', reference.id)
              ),
            32,
            'Race child roots'
          )
        )
    ),
    Promise.all(
      parentReferences
        .filter((reference) => reference.subjectKind === 'EQUIPMENT')
        .map((reference) =>
          bounded(
            ctx.db
              .query('authoredRoots')
              .withIndex('by_system_kind_parentEquipmentId', (q) =>
                q
                  .eq('systemId', reference.systemId)
                  .eq('subjectKind', 'EQUIPMENT')
                  .eq('parentEquipmentId', reference.id)
              ),
            32,
            'Equipment child roots'
          )
        )
    ),
    Promise.all(
      known.dependentRootReferences.map((reference) =>
        bounded(
          ctx.db.query('authoredRoots').withIndex('by_publicId', (q) => q.eq('id', reference.id)),
          1,
          'dependent authoredRoots by public ID'
        )
      )
    )
  ])
  const initialDependentRoots = uniqueRows([
    ...classChildren.flat(),
    ...raceChildren.flat(),
    ...equipmentChildren.flat(),
    ...knownDependentRoots.flat()
  ])
  const initialRootIds = union(
    [
      ...ownedReferences.map((reference) => reference.id),
      ...historicalReferences.map((reference) => reference.id),
      ...initialDependentRoots.map((row) => row.id)
    ],
    []
  )
  const initialSpellClasses = await Promise.all(
    initialRootIds.map((id) =>
      Promise.all([
        bounded(
          ctx.db.query('authoredSpellClasses').withIndex('by_spellId', (q) => q.eq('spellId', id)),
          32,
          'authoredSpellClasses by spell'
        ),
        bounded(
          ctx.db.query('authoredSpellClasses').withIndex('by_classId', (q) => q.eq('classId', id)),
          32,
          'authoredSpellClasses by class'
        )
      ])
    )
  )
  const spellClasses = initialSpellClasses.flat(2)
  const relatedSpellIds = union(
    [...spellClasses.map((row) => row.spellId), ...spellClasses.map((row) => row.classId)],
    []
  )
  const relatedSpellRoots = await Promise.all(
    relatedSpellIds.map((id) =>
      bounded(
        ctx.db.query('authoredRoots').withIndex('by_publicId', (q) => q.eq('id', id)),
        1,
        'Spell-related authoredRoots by public ID'
      )
    )
  )
  const dependentRoots = uniqueRows([...initialDependentRoots, ...relatedSpellRoots.flat()])
  const allRootIds = union(
    [
      ...ownedReferences.map((reference) => reference.id),
      ...historicalReferences.map((reference) => reference.id),
      ...dependentRoots.map((row) => row.id)
    ],
    []
  )
  const [
    versionsByRoot,
    definitions,
    catalogueCounts,
    catalogueOwners,
    routes,
    allDrafts,
    additionalSpellClasses
  ] = await Promise.all([
    Promise.all(
      allRootIds.map((id) =>
        bounded(
          ctx.db.query('authoredVersions').withIndex('by_id_version', (q) => q.eq('id', id)),
          32,
          'authoredVersions by root'
        )
      )
    ),
    Promise.all(
      sourceIds.map((id) =>
        bounded(
          ctx.db
            .query('reusableDefinitions')
            .withIndex('by_contentSourceId', (q) => q.eq('contentSourceId', id)),
          32,
          'reusableDefinitions'
        )
      )
    ),
    Promise.all(
      sourceIds.map((id) =>
        bounded(
          ctx.db
            .query('authoredCatalogueCounts')
            .withIndex('by_source_kind', (q) => q.eq('contentSourceId', id)),
          32,
          'authoredCatalogueCounts'
        )
      )
    ),
    Promise.all(
      authoredSubjectKindSchema.options.map((subjectKind) =>
        bounded(
          ctx.db
            .query('authoredCatalogueOwnerCounts')
            .withIndex('by_subjectKind_ownerUserId', (q) =>
              q.eq('subjectKind', subjectKind).eq('ownerUserId', userId)
            ),
          32,
          'authoredCatalogueOwnerCounts'
        )
      )
    ),
    Promise.all(
      allRootIds.map((id) =>
        bounded(
          ctx.db.query('authoredRouteIds').withIndex('by_subjectId', (q) => q.eq('subjectId', id)),
          1,
          'authored routes'
        )
      )
    ),
    Promise.all(
      allRootIds.map((id) =>
        bounded(
          ctx.db.query('authoredDrafts').withIndex('by_subjectId', (q) => q.eq('subjectId', id)),
          32,
          'authored drafts by subject'
        )
      )
    ),
    Promise.all(
      relatedSpellIds.map((id) =>
        Promise.all([
          bounded(
            ctx.db
              .query('authoredSpellClasses')
              .withIndex('by_spellId', (q) => q.eq('spellId', id)),
            32,
            'related authoredSpellClasses by spell'
          ),
          bounded(
            ctx.db
              .query('authoredSpellClasses')
              .withIndex('by_classId', (q) => q.eq('classId', id)),
            32,
            'related authoredSpellClasses by class'
          )
        ])
      )
    )
  ])
  const definitionIds = union(
    definitions.flat().map((row) => row.id),
    known.definitionIds
  )
  const [knownDefinitions, definitionDrafts] = await Promise.all([
    Promise.all(
      definitionIds.map((id) =>
        bounded(
          ctx.db.query('reusableDefinitions').withIndex('by_publicId', (q) => q.eq('id', id)),
          1,
          'reusableDefinitions by public ID'
        )
      )
    ),
    Promise.all(
      definitionIds.map((id) =>
        bounded(
          ctx.db
            .query('reusableDefinitionDrafts')
            .withIndex('by_definitionId', (q) => q.eq('definitionId', id)),
          1,
          'reusableDefinitionDrafts'
        )
      )
    )
  ])
  return {
    contentSources: allSources,
    authoredRoots: ownedRoots,
    authoredDependentRoots: dependentRoots.filter(
      (row) =>
        row.ownerUserId !== userId && !ownedReferences.some((reference) => reference.id === row.id)
    ),
    authoredDrafts: uniqueRows([...currentDrafts, ...allDrafts.flat()]),
    authoredImportRefs: imports,
    authoredVersions: uniqueRows([...sourceVersions.flat(), ...versionsByRoot.flat()]),
    reusableDefinitions: uniqueRows([...definitions.flat(), ...knownDefinitions.flat()]),
    reusableDefinitionDrafts: definitionDrafts.flat().sort((a, b) => a._id.localeCompare(b._id)),
    authoredCatalogueCounts: catalogueCounts.flat().sort((a, b) => a._id.localeCompare(b._id)),
    authoredCatalogueOwnerCounts: catalogueOwners.flat().sort((a, b) => a._id.localeCompare(b._id)),
    authoredRouteIds: routes.flat().sort((a, b) => a._id.localeCompare(b._id)),
    authoredSpellClasses: uniqueRows([...spellClasses, ...additionalSpellClasses.flat(2)])
  }
}
async function readDeferred(
  ctx: QueryCtx,
  userId: string,
  known: DevelopmentAccountDeletionKnown
): Promise<Tables> {
  const [ownedAssets, socialProfiles, feed, intents, copyJobs] = await Promise.all([
    bounded(
      ctx.db.query('mediaAssets').withIndex('by_ownerUserId', (q) => q.eq('ownerUserId', userId)),
      32,
      'mediaAssets'
    ),
    bounded(
      ctx.db.query('socialProfiles').withIndex('by_userId', (q) => q.eq('userId', userId)),
      1,
      'socialProfiles'
    ),
    bounded(
      ctx.db
        .query('notificationFeedItems')
        .withIndex('by_userId_occurredAt_id', (q) => q.eq('userId', userId)),
      64,
      'notificationFeedItems'
    ),
    bounded(
      ctx.db
        .query('notificationDeliveryIntents')
        .withIndex('by_recipientUserId_workflowKey_sourcePublicId', (q) =>
          q.eq('recipientUserId', userId)
        ),
      64,
      'notificationDeliveryIntents'
    ),
    bounded(
      ctx.db
        .query('campaignCopyJobs')
        .withIndex('by_ownerUserId_createdAt_id', (q) => q.eq('ownerUserId', userId)),
      32,
      'campaignCopyJobs'
    ),
    Promise.all(
      known.mediaAssetIds.map((id) =>
        ctx.db
          .query('mediaAssets')
          .withIndex('by_publicId', (q) => q.eq('id', id))
          .unique()
      )
    )
  ])
  // Retention gives Campaign owners copies that share a known asset's stored objects.
  const retainedCopies = await Promise.all(
    union(
      ownedAssets.map((row) => row.id),
      known.mediaAssetIds
    ).map((id) =>
      bounded(
        ctx.db
          .query('mediaAssets')
          .withIndex('by_storageAssetId', (q) => q.eq('storageAssetId', id)),
        8,
        'mediaAssets by stored objects'
      )
    )
  )
  const assetIds = union(
    [...ownedAssets, ...retainedCopies.flat()].map((row) => row.id),
    known.mediaAssetIds
  )
  const profileIds = union(
    socialProfiles.map((row) => row.id),
    known.socialProfileId ? [known.socialProfileId] : []
  )
  const destinationIds = union(
    copyJobs.map((row) => row.destinationCampaignId),
    known.copyDestinationIds
  )
  const [
    knownAssets,
    portraits,
    sceneDefinitions,
    campaignScenes,
    imageSlots,
    blocks,
    invitesCreated,
    invitesReceived,
    applications,
    reports,
    staged
  ] = await Promise.all([
    Promise.all(
      assetIds.map((id) =>
        bounded(
          ctx.db.query('mediaAssets').withIndex('by_publicId', (q) => q.eq('id', id)),
          1,
          'mediaAssets by public ID'
        )
      )
    ),
    Promise.all(
      assetIds.map((id) =>
        bounded(
          ctx.db
            .query('characters')
            .withIndex('by_portraitAssetId', (q) => q.eq('portraitAssetId', id)),
          32,
          'Character portraits'
        )
      )
    ),
    Promise.all(
      assetIds.map((id) =>
        bounded(
          ctx.db
            .query('sceneDefinitions')
            .withIndex('by_mapAssetId', (q) => q.eq('map.assetId', id)),
          32,
          'Scene definitions'
        )
      )
    ),
    Promise.all(
      assetIds.map((id) =>
        bounded(
          ctx.db.query('campaignScenes').withIndex('by_mapAssetId', (q) => q.eq('map.assetId', id)),
          32,
          'Campaign scenes'
        )
      )
    ),
    Promise.all(
      assetIds.map((id) =>
        bounded(
          ctx.db.query('authoredImageSlots').withIndex('by_assetId', (q) => q.eq('assetId', id)),
          32,
          'authoredImageSlots'
        )
      )
    ),
    Promise.all(
      profileIds.map((id) =>
        Promise.all([
          bounded(
            ctx.db
              .query('socialBlocks')
              .withIndex('by_blockerProfileId_blockedProfileId', (q) =>
                q.eq('blockerProfileId', id)
              ),
            32,
            'socialBlocks outgoing'
          ),
          bounded(
            ctx.db
              .query('socialBlocks')
              .withIndex('by_blockedProfileId_blockerProfileId', (q) =>
                q.eq('blockedProfileId', id)
              ),
            32,
            'socialBlocks incoming'
          )
        ])
      )
    ),
    bounded(
      ctx.db
        .query('campaignInvites')
        .withIndex('by_createdBy_id', (q) => q.eq('createdBy', userId)),
      32,
      'campaignInvites created'
    ),
    bounded(
      ctx.db
        .query('campaignInvites')
        .withIndex('by_recipientUserId_status_createdAt_id', (q) =>
          q.eq('recipientUserId', userId)
        ),
      32,
      'campaignInvites received'
    ),
    Promise.all(
      profileIds.map((id) =>
        bounded(
          ctx.db
            .query('socialApplications')
            .withIndex('by_applicantProfileId_status_submittedAt_id', (q) =>
              q.eq('applicantProfileId', id)
            ),
          32,
          'socialApplications'
        )
      )
    ),
    Promise.all(
      profileIds.map((id) =>
        bounded(
          ctx.db
            .query('socialReports')
            .withIndex('by_reporterProfileId', (q) => q.eq('reporterProfileId', id)),
          32,
          'socialReports'
        )
      )
    ),
    Promise.all(
      destinationIds.map((id) =>
        bounded(
          ctx.db
            .query('campaignNotebookSections')
            .withIndex('by_campaignId_id', (q) => q.eq('campaignId', id)),
          32,
          'campaign copy staged notebook sections'
        )
      )
    )
  ])
  const hostApplicationIntents = await Promise.all(
    uniqueRows(applications.flat()).map((application) =>
      bounded(
        ctx.db
          .query('notificationDeliveryIntents')
          .withIndex('by_sourcePublicId_workflowKey', (q) =>
            q.eq('sourcePublicId', application.id).eq('workflowKey', 'social-application-submitted')
          ),
        64,
        'host Social application notification intents'
      )
    )
  )
  const allReports = uniqueRows(reports.flat())
  const moderationActions = await Promise.all(
    allReports.map((report) =>
      bounded(
        ctx.db
          .query('socialModerationActions')
          .withIndex('by_reportId_createdAt_id', (q) => q.eq('reportId', report.id)),
        32,
        'socialModerationActions'
      )
    )
  )
  return {
    mediaAssets: uniqueRows([...ownedAssets, ...knownAssets.flat()]),
    charactersWithPortrait: uniqueRows(portraits.flat()),
    sceneDefinitions: uniqueRows(sceneDefinitions.flat()),
    campaignScenes: uniqueRows(campaignScenes.flat()),
    authoredImageSlots: uniqueRows(imageSlots.flat()),
    socialProfiles,
    socialBlocks: uniqueRows(blocks.flat(2)),
    campaignInvites: uniqueRows([...invitesCreated, ...invitesReceived]),
    socialApplications: uniqueRows(applications.flat()),
    socialReports: allReports,
    socialModerationActions: uniqueRows(moderationActions.flat()),
    notificationFeedItems: feed,
    notificationDeliveryIntents: uniqueRows([...intents, ...hostApplicationIntents.flat()]),
    campaignCopyJobs: copyJobs,
    campaignCopyStagedNotebookSections: uniqueRows(staged.flat())
  }
}
