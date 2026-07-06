import { createElement } from 'react'
import { AuthoredPreview } from './AuthoredPreview'
import { createAuthoredPreviewModel } from './authoredPreviewModel'
import type { AuthoredPreviewFactory } from './authoredPreview.types'
import type { AuthoredFormDomain } from '../factories/authoredFormFactories.types'

function createPreviewFactory(): AuthoredPreviewFactory {
  return (context) => {
    const model = createAuthoredPreviewModel(context)
    return model.sections.length ? createElement(AuthoredPreview, { model }) : undefined
  }
}

export const authoredPreviewFactories = {
  background: createPreviewFactory(),
  class: createPreviewFactory(),
  creature: createPreviewFactory(),
  equipment: createPreviewFactory(),
  feat: createPreviewFactory(),
  race: createPreviewFactory(),
  spell: createPreviewFactory(),
  vehicle: createPreviewFactory()
} satisfies Record<AuthoredFormDomain, AuthoredPreviewFactory>
