import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { v, type Validator } from 'convex/values'
import {
  characterBuilderPayloadDtoSchema,
  type CharacterBuilderIntentCacheDto,
  type CharacterBuilderPayloadDto
} from '@artificer-toolkit/schema/api/characterBuilder'
import {
  characterBuilderResolveInputSchema,
  characterBuilderPreviewOutputSchema,
  type CharacterBuilderPreviewOutput
} from '@artificer-toolkit/schema/api/characterBuilderQueries'
import { characterDraftLookupInputSchema } from '@artificer-toolkit/schema/api/characterDrafts'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { resolveFeatureOptionEligibility } from '@artificer-toolkit/rules-runtime/character/builderEligibility'
import { resolveCharacterBuilder } from '@artificer-toolkit/rules-runtime/character/builderResolution'
import {
  stripCharacterBuilderResolution,
  toCharacterBuilderPayload
} from '@artificer-toolkit/rules-runtime/character/characterBuilderView'
import { evaluateCharacterRules } from '@artificer-toolkit/rules-runtime/character/characterRuleEvaluation'
import { createCharacterBuilderChangePreview } from '@artificer-toolkit/rules-runtime/character/builderPresentation'
import { presentCampaignCharacterText } from '@artificer-toolkit/rules-runtime/character/campaignCharacterPresentation'
import { createEmptyCharacterAuthored } from '@artificer-toolkit/shared/character'
import { query, type QueryCtx } from '../_generated/server'
import { requireIdentity } from '../lib/identity'
import { readVisibleAuthoredRouteId } from '../content/routeIds'
import { loadCharacterBuilderContext } from './builderContext'
import { prepareCharacterBuilder } from './builderPreparation'
import {
  loadCharacterState,
  loadCharacterDraftCandidate,
  readCharacterDraft,
  readCharacterRecord,
  resolveCharacterId
} from './documents'

async function resolvePayload(
  ctx: QueryCtx,
  input: {
    character: CharacterAuthored
    mode: 'create' | 'edit'
    previousCharacter: CharacterAuthored | null
    builderIntent?: CharacterBuilderIntentCacheDto
    publicId: string
    baseActiveUpdatedAt: string | null
  }
): Promise<CharacterBuilderPayloadDto> {
  const character = {
    ...input.character,
    state: input.previousCharacter?.state ?? createEmptyCharacterAuthored(input.character).state
  }
  const context = await loadCharacterBuilderContext(ctx, character, character.userId)
  const resolution = await resolveCharacterBuilder({
    character,
    mode: input.mode,
    context,
    previousCharacter: input.previousCharacter,
    resolveFeatureOptions: (options) =>
      resolveFeatureOptionEligibility({
        ...options,
        evaluate: async (character, eligibilityFacets) =>
          evaluateCharacterRules({
            character,
            context,
            eligibilityFacets,
            spellDocumentsById: context.spellDocumentsById
          })
      })
  })
  const payload = toCharacterBuilderPayload(
    character,
    resolution,
    input.builderIntent,
    input.baseActiveUpdatedAt,
    input.publicId
  )
  return characterBuilderPayloadDtoSchema.parse({
    ...payload,
    ...presentCampaignCharacterText(
      { resolution: payload.resolution, references: payload.references, view: payload.view },
      context.sourceAccess.campaign?.contentMaturity ?? null,
      'CHARACTER_OWNER'
    )
  })
}

export const get = query({
  args: zodToConvexFields(characterDraftLookupInputSchema.shape),
  get returns(): Validator<CharacterBuilderPayloadDto | null, 'required', string> {
    return v.union(v.null(), zodToConvex(characterBuilderPayloadDtoSchema))
  },
  handler: async (ctx, args): Promise<CharacterBuilderPayloadDto | null> => {
    const { userId } = await requireIdentity(ctx)
    const { id: lookupId } = characterDraftLookupInputSchema.parse(args)
    const id = await resolveCharacterId(ctx, lookupId)
    if (!id) return null
    const { active, draft } = await loadCharacterState(ctx, id)
    if (
      (!active && !draft) ||
      (active && active.userId !== userId) ||
      (draft && draft.userId !== userId)
    )
      return null
    const route = await readVisibleAuthoredRouteId(ctx, { subjectId: id })
    if (!route || route.subjectKind !== 'CHARACTER' || route.ownerUserId !== userId)
      throw new Error('Stored Character route identity mismatch.')
    const current = active ? readCharacterRecord(active) : null
    const working = draft ? await readCharacterDraft(ctx, draft, active) : null
    const character = working?.payload.character ?? current
    if (!character) return null
    // Validated Character DTOs use literal starting-equipment sources for the authored string enum.
    return resolvePayload(ctx, {
      character: character as CharacterAuthored,
      mode: active ? 'edit' : 'create',
      previousCharacter: current as CharacterAuthored | null,
      builderIntent: working?.payload.builderIntent,
      publicId: route.publicId,
      baseActiveUpdatedAt: working
        ? (working.baseActiveUpdatedAt ?? null)
        : (active?.updatedAt ?? null)
    })
  }
})

export const resolve = query({
  get args() {
    return zodToConvexFields(characterBuilderResolveInputSchema.shape)
  },
  get returns(): Validator<CharacterBuilderPayloadDto, 'required', string> {
    return zodToConvex(characterBuilderPayloadDtoSchema)
  },
  handler: async (ctx, args): Promise<CharacterBuilderPayloadDto> => {
    const { userId } = await requireIdentity(ctx)
    const input = characterBuilderResolveInputSchema.parse(args)
    const { character, current, draft } = await loadCharacterDraftCandidate(ctx, userId, input)
    return resolvePayload(ctx, {
      character: character as CharacterAuthored,
      mode: input.mode,
      previousCharacter: current as CharacterAuthored | null,
      builderIntent: draft.payload.builderIntent,
      publicId: draft.publicId,
      baseActiveUpdatedAt: draft.baseActiveUpdatedAt ?? null
    })
  }
})

export const preview = query({
  get args() {
    return zodToConvexFields(characterBuilderResolveInputSchema.shape)
  },
  get returns(): Validator<CharacterBuilderPreviewOutput, 'required', string> {
    return zodToConvex(characterBuilderPreviewOutputSchema)
  },
  handler: async (ctx, args): Promise<CharacterBuilderPreviewOutput> => {
    const { userId } = await requireIdentity(ctx)
    const input = characterBuilderResolveInputSchema.parse(args)
    const { character, current } = await loadCharacterDraftCandidate(ctx, userId, input)
    const {
      candidate,
      character: reconciled,
      context,
      resolution
    } = await prepareCharacterBuilder(ctx, {
      character: character as CharacterAuthored,
      current: current as CharacterAuthored | null,
      mode: input.mode
    })
    const predictedStatus = resolution.readiness.ready ? 'ACTIVE' : 'DRAFT'
    return characterBuilderPreviewOutputSchema.parse({
      character: { ...reconciled, status: predictedStatus },
      ...presentCampaignCharacterText(
        {
          resolution: stripCharacterBuilderResolution(resolution),
          preview: createCharacterBuilderChangePreview({
            previousCharacter: (current ?? candidate) as CharacterAuthored,
            nextCharacter: reconciled,
            predictedStatus,
            context
          })
        },
        context.sourceAccess.campaign?.contentMaturity ?? null,
        'CHARACTER_OWNER'
      )
    })
  }
})
