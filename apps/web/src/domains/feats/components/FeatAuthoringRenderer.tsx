import type { FeatAuthoringInputDto } from '@artificer-toolkit/schema/subjects/feat'
import { createAuthoringFormRenderer } from '#forms'
import { createEmptyFeat } from '../featAuthoring.utils'

const featRendererDefaults = createEmptyFeat({ systemId: '' })

export const FeatAuthoringRenderer = createAuthoringFormRenderer<FeatAuthoringInputDto>({
  defaultValues: featRendererDefaults
})
