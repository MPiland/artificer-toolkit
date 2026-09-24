import type { ConvexReactClient } from 'convex/react'
import { api } from '@artificer-toolkit/apis/convex/api'
import { authoredDraftCommandInputSchema } from '@artificer-toolkit/schema/api/authoredDrafts'
import { authoredPublishDraftInputSchema } from '@artificer-toolkit/schema/api/authoredPublication'
import type { BackgroundAuthoringInputDto } from '@artificer-toolkit/schema/subjects/background'
import type { ClassAuthoringInputDto } from '@artificer-toolkit/schema/subjects/class'
import type { FeatAuthoringInputDto } from '@artificer-toolkit/schema/subjects/feat'
import type { EquipmentAuthoringInputDto } from '@artificer-toolkit/schema/subjects/equipment'
import type { VehicleAuthoringInputDto } from '@artificer-toolkit/schema/subjects/vehicle'
import type { RaceAuthoringInputDto } from '@artificer-toolkit/schema/subjects/race'
import type { CreatureAuthoringInputDto } from '@artificer-toolkit/schema/subjects/creature'
import type { SpellAuthoringInputDto } from '@artificer-toolkit/schema/subjects/spell'

type AuthoredOperationsSubjectKind =
  | 'BACKGROUND'
  | 'CLASS'
  | 'FEAT'
  | 'EQUIPMENT'
  | 'RACE'
  | 'CREATURE'
  | 'SPELL'
  | 'VEHICLE'
type AuthoredPayload<TSubjectKind extends AuthoredOperationsSubjectKind> =
  TSubjectKind extends 'BACKGROUND'
    ? BackgroundAuthoringInputDto
    : TSubjectKind extends 'CLASS'
      ? ClassAuthoringInputDto
      : TSubjectKind extends 'FEAT'
        ? FeatAuthoringInputDto
        : TSubjectKind extends 'EQUIPMENT'
          ? EquipmentAuthoringInputDto
          : TSubjectKind extends 'RACE'
            ? RaceAuthoringInputDto
            : TSubjectKind extends 'CREATURE'
              ? CreatureAuthoringInputDto
              : TSubjectKind extends 'SPELL'
                ? SpellAuthoringInputDto
                : VehicleAuthoringInputDto

export function createAuthoredOperations<TSubjectKind extends AuthoredOperationsSubjectKind>(
  subjectKind: TSubjectKind,
  client?: ConvexReactClient
) {
  function requireClient() {
    if (!client) throw new Error(`${subjectKind} authoring requires the current Convex client.`)
    return client
  }

  const saveDraft = (payload: AuthoredPayload<TSubjectKind>) =>
    requireClient().mutation(
      api.content.drafts.save,
      authoredDraftCommandInputSchema.parse({
        subjectKind,
        subjectId: payload.id,
        systemId: payload.systemId,
        label: payload.label,
        payload
      })
    )

  return {
    saveDraft,
    async activate(payload: AuthoredPayload<TSubjectKind>) {
      const draft = await saveDraft(payload)
      const publication = authoredPublishDraftInputSchema.parse({
        subjectKind,
        subjectId: draft.subjectId,
        expectedDraftUpdatedAt: draft.updatedAt
      })
      const published =
        subjectKind === 'CLASS'
          ? await requireClient().action(api.content.classPublicationActions.publishDraft, {
              ...publication,
              subjectKind: 'CLASS'
            })
          : await requireClient().mutation(api.content.publication.publishDraft, {
              ...publication,
              subjectKind
            })
      return {
        publicId: published.publicId,
        item: { id: published.subjectId, label: draft.label }
      }
    },
    async deleteActive(subjectId: string) {
      await requireClient().mutation(api.content.deletion.deleteActive, {
        subjectKind,
        subjectId
      })
    },
    async discardDraft(subjectId: string) {
      await requireClient().mutation(api.content.drafts.discard, {
        subjectKind,
        subjectId
      })
    },
    duplicate: (subjectId: string) =>
      requireClient().mutation(api.content.drafts.duplicate, {
        subjectKind,
        subjectId
      })
  }
}
