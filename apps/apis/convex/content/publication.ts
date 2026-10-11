import * as zMini from 'zod/mini'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import { z } from 'zod'
import {
  authoredPublishDraftInputSchema,
  authoredPublicationResultSchema,
  type AuthoredPublicationResult
} from '@artificer-toolkit/schema/api/authoredPublication'
import { creaturePublicationDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { authoredSourceFacts } from '@artificer-toolkit/authoring/nodeRuntime/authoredSourceFacts'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { mutation } from '../lib/mutations'
import { assertCreatureLoadoutHands, readCreatureArmorClass } from './creatureLoadoutHands'
import { compilePublicationDocument } from './publicationDocument'
import {
  assertEquipmentRelationshipsIndexed,
  compileCurrentEquipment,
  recompileEquipmentChildren
} from './equipmentRelationships'
import {
  assertRaceRelationshipsIndexed,
  compileCurrentRace,
  recompileRaceChildren
} from './raceRelationships'
import {
  commitPublication,
  normalizePublicationDocument,
  readPublicationState
} from './publicationPersistence'

const mutationPublishDraftInputSchema = zMini.extend(authoredPublishDraftInputSchema, {
  subjectKind: z.enum(['BACKGROUND', 'CREATURE', 'EQUIPMENT', 'FEAT', 'RACE', 'SPELL', 'VEHICLE'])
})

export const publishDraft = mutation({
  args: zodToConvexFields(mutationPublishDraftInputSchema.shape),
  returns: zodToConvex(authoredPublicationResultSchema),
  handler: async (ctx, args): Promise<AuthoredPublicationResult> => {
    const input = authoredPublishDraftInputSchema.parse(args)
    const state = await readPublicationState(ctx, input)
    if (input.subjectKind === 'EQUIPMENT')
      await assertEquipmentRelationshipsIndexed(ctx, state.draft.systemId)
    if (input.subjectKind === 'RACE')
      await assertRaceRelationshipsIndexed(ctx, state.draft.systemId)
    const subject = await normalizePublicationDocument(ctx, state)
    if (subject.subjectKind === 'CREATURE') {
      const publishable = creaturePublicationDtoSchema.safeParse(subject.document)
      if (!publishable.success)
        throw new Error(publishable.error.issues.map((issue) => issue.message).join(' '))
      await assertCreatureLoadoutHands(ctx, publishable.data, state.userId)
      const armorClass = await readCreatureArmorClass(ctx, publishable.data, state.userId)
      if (armorClass && !armorClass.ok) throw new Error(armorClass.reason)
    }
    if (subject.subjectKind === 'RACE' && subject.document.category === 'SUBRACE') {
      const { systemId, parentRaceId } = subject.document
      const siblings = await ctx.db
        .query('authoredRoots')
        .withIndex('by_system_kind_parentRaceId', (q) =>
          q.eq('systemId', systemId).eq('subjectKind', 'RACE').eq('parentRaceId', parentRaceId)
        )
        .take(500)
      if (siblings.filter((root) => root.id !== subject.document.id).length >= 499)
        throw new Error('Race inheritance exceeds the authoring limit.')
    }
    const equipment =
      subject.subjectKind === 'EQUIPMENT'
        ? await compileCurrentEquipment(ctx, subject.document, state.userId)
        : null
    const race =
      subject.subjectKind === 'RACE'
        ? await compileCurrentRace(ctx, subject.document, state.userId)
        : null
    const compilation =
      equipment?.compilation ?? race?.compilation ?? compilePublicationDocument(subject)
    const checksum = checksumRuleDocument(subject.document)
    const result = await commitPublication(
      ctx,
      state,
      subject,
      compilation,
      authoredSourceFacts({ ...subject, checksum }),
      equipment?.effective
    )
    if (equipment) await recompileEquipmentChildren(ctx, equipment.effective, state.userId)
    if (race?.effective.category === 'BASE')
      await recompileRaceChildren(ctx, race.effective, state.userId)
    return result
  }
})
