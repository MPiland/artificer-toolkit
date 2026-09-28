import {
  createReusableDefinitionInputDtoSchema,
  getReusableDefinitionInputDtoSchema,
  listReusableDefinitionsPageInputDtoSchema,
  publishReusableDefinitionDraftInputDtoSchema,
  reusableDefinitionListPageDtoSchema,
  reusableDefinitionSummaryDtoSchema,
  reusableDefinitionWorkspaceDtoSchema,
  saveReusableDefinitionDraftInputDtoSchema,
  type ReusableDefinitionWorkspaceDto
} from '@artificer-toolkit/schema/api/reusableDefinitions'
import { createReusableDefinitionService } from '@artificer-toolkit/authoring/reusableDefinitions'
import { REUSABLE_DEFINITION_AUTHORING_FAMILY_KEYS } from '@artificer-toolkit/schema/shared/reusableDefinitionIdentity'
import {
  installedGameSystemRuleCapabilities,
  installedGameSystemRuleOperations,
  requireInstalledGameSystemRuleCapability
} from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { mergedStream } from 'convex-helpers/server/stream'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { query } from '../lib/queries'
import { mutation } from '../lib/mutations'
import type { MutationCtx } from '../_generated/server'
import { contentStream } from './streams'
import { requireIdentity } from '../lib/identity'
import { requireDefaultUserContentSource } from './sources'
import {
  createConvexReusableDefinitionStore,
  readDefinitionDraft,
  readDefinitionRoot
} from './definitionStore'
import { readSystem } from './systemDocuments'

async function workspace(ctx: Parameters<typeof readDefinitionRoot>[0], id: string, actor: string) {
  const root = await readDefinitionRoot(ctx, id, actor)
  if (!root) throw new Error('Reusable definition unavailable.')
  const draft = await readDefinitionDraft(ctx, root)
  return reusableDefinitionWorkspaceDtoSchema.parse({
    ...summary(root, actor),
    current: root.current,
    draft: draft?.draft ?? null
  })
}

function summary(root: NonNullable<Awaited<ReturnType<typeof readDefinitionRoot>>>, actor: string) {
  return reusableDefinitionSummaryDtoSchema.parse({
    id: root.id,
    gameSystemId: root.gameSystemId,
    contentSourceId: root.contentSourceId,
    definitionFamilyKey: root.definitionFamilyKey,
    label: root.label,
    description: root.description,
    version: root.version,
    sourceKind: root.sourceKind,
    editable: root.sourceKind === 'USER' && root.sourceOwnerUserId === actor,
    currentVersion: root.current?.version ?? null,
    draftVersion: root.draftVersion
  })
}

function publisher(ctx: MutationCtx, actorUserId: string) {
  return createReusableDefinitionService({
    store: createConvexReusableDefinitionStore(ctx, actorUserId),
    capabilities: installedGameSystemRuleCapabilities,
    operations: installedGameSystemRuleOperations,
    resolveSystemVocabulary: async (gameSystemId) => {
      const system = await ctx.db
        .query('systems')
        .withIndex('by_publicId', (q) => q.eq('id', gameSystemId))
        .unique()
      if (!system) throw new Error('Game System is unavailable.')
      return readSystem(system)
    }
  })
}

export const get = query({
  args: zodToConvexFields(getReusableDefinitionInputDtoSchema.shape),
  returns: zodToConvex(reusableDefinitionWorkspaceDtoSchema),
  handler: async (ctx, args): Promise<ReusableDefinitionWorkspaceDto> => {
    const { userId } = await requireIdentity(ctx)
    return workspace(ctx, getReusableDefinitionInputDtoSchema.parse(args).definitionId, userId)
  }
})

export const list = query({
  args: zodToConvexFields(listReusableDefinitionsPageInputDtoSchema.shape),
  returns: zodToConvex(reusableDefinitionListPageDtoSchema),
  handler: async (ctx, args) => {
    const { userId } = await requireIdentity(ctx)
    const input = listReusableDefinitionsPageInputDtoSchema.parse(args)
    requireInstalledGameSystemRuleCapability(input.gameSystemId)
    const ranges = [undefined, userId].map((owner) =>
      contentStream(ctx.db)
        .query('reusableDefinitions')
        .withIndex('by_gameSystemId_owner_family_label_id', (q) =>
          q.eq('gameSystemId', input.gameSystemId).eq('ownerUserId', owner)
        )
    )
    const result = await mergedStream(ranges, ['definitionFamilyKey', 'label', 'id'])
      .map(async (record) => {
        const root = await readDefinitionRoot(ctx, record.id, userId)
        if (!root) throw new Error('Reusable definition unavailable.')
        return summary(root, userId)
      })
      .paginate({
        cursor: input.cursor,
        numItems: input.limit,
        maximumRowsRead: 48,
        maximumBytesRead: 2 * 1024 * 1024
      })
    return reusableDefinitionListPageDtoSchema.parse({
      page: result.page,
      isDone: result.isDone,
      continueCursor: result.continueCursor
    })
  }
})

export const create = mutation({
  args: zodToConvexFields(createReusableDefinitionInputDtoSchema.shape),
  returns: zodToConvex(reusableDefinitionWorkspaceDtoSchema),
  handler: async (ctx, args): Promise<ReusableDefinitionWorkspaceDto> => {
    const { userId } = await requireIdentity(ctx)
    const input = createReusableDefinitionInputDtoSchema.parse(args)
    const capability = requireInstalledGameSystemRuleCapability(input.gameSystemId)
    if (
      !capability.definitionFamilyKeys.includes(input.definitionFamilyKey) ||
      !REUSABLE_DEFINITION_AUTHORING_FAMILY_KEYS.some(
        (family) => family === input.definitionFamilyKey
      )
    )
      throw new Error('Reusable definition family is unavailable.')
    const system = await ctx.db
      .query('systems')
      .withIndex('by_publicId', (q) => q.eq('id', input.gameSystemId))
      .unique()
    if (!system) throw new Error('Game System is unavailable.')
    readSystem(system)
    const contentSourceId = await requireDefaultUserContentSource(ctx, input.gameSystemId, userId)
    const id = crypto.randomUUID()
    await ctx.db.insert('reusableDefinitions', {
      id,
      gameSystemId: input.gameSystemId,
      contentSourceId,
      definitionFamilyKey: input.definitionFamilyKey,
      label: input.label,
      description: input.description,
      version: 0,
      ownerUserId: userId
    })
    return workspace(ctx, id, userId)
  }
})

export const saveDraft = mutation({
  args: zodToConvexFields(saveReusableDefinitionDraftInputDtoSchema.shape),
  returns: zodToConvex(reusableDefinitionWorkspaceDtoSchema),
  handler: async (ctx, args): Promise<ReusableDefinitionWorkspaceDto> => {
    const { userId } = await requireIdentity(ctx)
    const input = saveReusableDefinitionDraftInputDtoSchema.parse(args)
    await publisher(ctx, userId).saveDraft({ ...input, actorUserId: userId })
    return workspace(ctx, input.definitionId, userId)
  }
})

export const publish = mutation({
  args: zodToConvexFields(publishReusableDefinitionDraftInputDtoSchema.shape),
  returns: zodToConvex(reusableDefinitionWorkspaceDtoSchema),
  handler: async (ctx, args): Promise<ReusableDefinitionWorkspaceDto> => {
    const { userId } = await requireIdentity(ctx)
    const input = publishReusableDefinitionDraftInputDtoSchema.parse(args)
    await publisher(ctx, userId).publishDraft({ ...input, actorUserId: userId })
    return workspace(ctx, input.definitionId, userId)
  }
})
