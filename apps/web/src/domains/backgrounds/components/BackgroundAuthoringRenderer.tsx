import type { BackgroundAuthoringInputDto } from '@artificer-toolkit/schema/subjects/background'
import { createAuthoringFormRenderer } from '#forms'
import { createEmptyBackground } from '../backgroundAuthoring.utils'

const backgroundRendererDefaults = createEmptyBackground({ systemId: '' })

export const BackgroundAuthoringRenderer = createAuthoringFormRenderer<BackgroundAuthoringInputDto>({
  defaultValues: backgroundRendererDefaults
})
