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

    if (!speedNode || speedNode.kind !== 'INPUT' || speedNode.type !== 'SELECT_SINGLE') {
      throw new Error('Expected speedId to resolve as a single select.')
    }

    const walkingSpeed = speedOptions.find((option) => option.code === SpeedType.WALKING)

    expect(speedNode.options).toContainEqual({
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
      required: false
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
      required: false
    })
  })

  it('carries map-owned presentation semantics into nested collection nodes', () => {
    const model = createStaticResolvedFormModel('featureGrants')

    expect(getNode(model, 'modifiers')).toMatchObject({
      authoring: {
        collection: {
          rowSummary: 'modifier'
        }
      }
    })
  })

  it('marks system-owned grant discriminators as non-renderable authoring fields', () => {
    const model = createStaticResolvedFormModel('modifierGrant')

    expect(getNode(model, 'grantKind')).toMatchObject({
      authoring: {
        exposure: 'system'
      }
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
