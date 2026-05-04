import { createAuthoringFormRenderer } from '#forms'
import {
  createEmptyClass,
  type ClassFormValues
} from '../classAuthoring.utils'

const classRendererDefaults = createEmptyClass({ systemId: '' })

export const ClassAuthoringRenderer = createAuthoringFormRenderer<ClassFormValues>({
  defaultValues: classRendererDefaults
})
