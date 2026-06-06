import { AuthoredDetailProse } from '#app/components/AuthoredDetail'
import { ContextCard } from '#forms/components/ContextCard/ContextCard'
import * as contextStyles from '#forms/components/ContextCard/ContextCard.css'
import type { RaceFormValues } from '../raceAuthoring.utils'

type RaceAuthoringPreviewProps = {
  values: RaceFormValues
}

export function RaceAuthoringPreview({ values }: RaceAuthoringPreviewProps) {
  const description = values.description?.trim() ?? ''
  const label = values.label?.trim() || 'Untitled Race'
  const quote = values.quote?.trim() ?? ''

  return (
    <ContextCard
      header={{ emphasized: true }}
      title='Race preview'
      titleId='race-authoring-preview'
    >
      <p className={contextStyles.previewText}>
        <strong>{label}</strong>
      </p>
      {quote
        ? <p className={contextStyles.previewText}>{quote}</p>
        : null}
      <AuthoredDetailProse html={description} fallback='Add a race description to preview how this will read.' />
    </ContextCard>
  )
}
