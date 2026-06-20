import { AuthoredDetailProse } from '#app/components/AuthoredDetail'
import { ContextCard } from '#app/ui/components/ContextCard/ContextCard'
import * as contextStyles from '#ui/components/ContextCard/ContextCard.css'
import type { RaceFormValues } from '../raceAuthoring.utils'

type RaceAuthoringPreviewProps = {
  values: RaceFormValues
}

export function RaceAuthoringPreview({ values }: RaceAuthoringPreviewProps) {
  const description = values.description?.trim() ?? ''
  const quote = values.quote?.trim() ?? ''

  return (
    <ContextCard title='Description' titleId='race-authoring-preview'>
      <AuthoredDetailProse
        html={description}
        fallback='Add a race description to preview how this will read.'
      >
        {quote && <p className={contextStyles.body}>{quote}</p>}
      </AuthoredDetailProse>
    </ContextCard>
  )
}
