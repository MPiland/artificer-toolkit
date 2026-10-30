import { authoredSubjectKindDtoSchema } from '@artificer-toolkit/schema/api/content'
import { MediaImageControl } from '#app/components/MediaImage'
import { useAuthoringActions, useAuthoringSession } from '#forms/layout/AuthoringFormContext'

export function AuthoringArtworkControl() {
  const { authoredSession, readOnly } = useAuthoringSession()
  const { saveDraft } = useAuthoringActions()
  if (!authoredSession) return null

  const subjectKind = authoredSubjectKindDtoSchema.parse(authoredSession.domain.toUpperCase())
  const subjectId = authoredSession.subjectId

  return (
    <MediaImageControl
      beforeChange={saveDraft}
      disabled={readOnly || !subjectId}
      label='Add an image'
      mode='decorative'
      profile='AUTHORED_IMAGE'
      target={
        subjectId
          ? {
              lookup: {
                type: 'AUTHORED_IMAGE',
                subjectKind,
                subjectId,
                scope: readOnly ? 'ACTIVE' : 'DRAFT'
              },
              attach: { type: 'AUTHORED_IMAGE', subjectKind, subjectId }
            }
          : undefined
      }
    />
  )
}
