import { describe, expect, it } from 'vitest'
import { authoredRouteStorySystem } from '#domains/authoredRouteStory.fixtures'
import { createStaticResolvedFormModel } from './staticResolvedModel'
import { SpeedType, speedOptions } from '@artificer-toolkit/shared/authored'
import type {
  NodeRuntimeNodeDto,
  NodeRuntimeResolveResponseDto
} from '@artificer-toolkit/schema/api/nodeRuntime'

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

  it('evaluates local visibility and required state when values are provided', () => {
    const model = createStaticResolvedFormModel('charges', {
      values: {
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE'
      }
    })

    expect(getNode(model, 'amount')).toMatchObject({
      visible: true,
      required: true
    })
    expect(getNode(model, 'classId')).toMatchObject({
      visible: false,
      required: true
    })
  })

  it('evaluates parent-scoped visibility for nested static maps', () => {
    const model = createStaticResolvedFormModel('rollTableRow', {
      parentValues: {
        rollTableKind: 'RANGE'
      },
      values: {
        order: 1
      }
    })

    expect(getNode(model, 'rollRangeMin')).toMatchObject({
      visible: true,
      required: true
    })
    expect(getNode(model, 'rollRangeMax')).toMatchObject({
      visible: true,
      required: true
    })
    expect(getNode(model, 'rollValue')).toMatchObject({
      visible: false,
      required: true
    })
  })
})

function getNode(
  model: NodeRuntimeResolveResponseDto | undefined,
  nodeId: string
): NodeRuntimeNodeDto | undefined {
  return model?.steps
    .flatMap((step) => step.sections)
    .flatMap((section) => section.nodes)
    .find((node) => node.id === nodeId)
}
