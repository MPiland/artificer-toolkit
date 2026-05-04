import { createAuthoringFormRenderer } from '#forms'
import { createEmptyBackground } from '../backgroundAuthoring.utils'

const backgroundRendererDefaults = createEmptyBackground({ systemId: '', userId: '' })

export const BackgroundAuthoringRenderer = createAuthoringFormRenderer({
  defaultValues: backgroundRendererDefaults
})
