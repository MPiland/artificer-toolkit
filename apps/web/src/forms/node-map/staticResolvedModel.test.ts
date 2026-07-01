import { describe, expect, it } from 'vitest'
import { authoredRouteStorySystem } from '#domains/authoredRouteStory.fixtures'
import { createStaticResolvedFormModel } from './staticResolvedModel'
import { SpeedType, speedOptions } from '@artificer-toolkit/shared/authored'

describe('createStaticResolvedFormModel', () => {
  it('marks authored subject names as required', () => {
    const model = createStaticResolvedFormModel('background', { system: authoredRouteStorySystem })
    const labelNode = model?.steps
      .flatMap((step) => step.sections)
      .flatMap((section) => section.nodes)
      .find((node) => node.id === 'label')

    expect(labelNode).toMatchObject({
      label: 'Name',
      required: true
    })
  })

  it('hydrates relationship options from the provided system vocabulary', () => {
    const model = createStaticResolvedFormModel('speed', { system: authoredRouteStorySystem })
    const speedNode = model?.steps
      .flatMap((step) => step.sections)
      .flatMap((section) => section.nodes)
      .find((node) => node.id === 'speedId')

    const walkingSpeed = speedOptions.find((option) => option.code === SpeedType.WALKING)

    expect(speedNode?.options).toContainEqual({
      value: walkingSpeed?.id,
      label: walkingSpeed?.label,
      description: walkingSpeed?.description
    })
  })
})
