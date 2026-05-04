import { createAuthoringFormRenderer } from '#forms'
import { createEmptyFeat } from '../featAuthoring.utils'

const featRendererDefaults = createEmptyFeat({ systemId: '', userId: '' })

export const FeatAuthoringRenderer = createAuthoringFormRenderer({
  defaultValues: featRendererDefaults
})
