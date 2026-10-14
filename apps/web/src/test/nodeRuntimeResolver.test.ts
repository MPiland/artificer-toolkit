import { describe, expect, it } from 'vitest'
import type {
  NodeRuntimeNodeDto,
  NodeRuntimeResolveResponseDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { resolveFixtureNodeRuntime } from './nodeRuntimeResolver'

describe('fixture node-runtime resolver', () => {
  it('marks authored subject names as required', async () => {
    const model = await resolveFixtureNodeRuntime({ mapId: 'background', values: {} })

    expect(getNode(model, 'label')).toMatchObject({ label: 'Name', required: true })
  })

  it('serves the System vocabulary the server serves for relationship options', async () => {
    const model = await resolveFixtureNodeRuntime({ mapId: 'speed', values: {} })
    const speedNode = getNode(model, 'speedId')

    if (!speedNode || speedNode.kind !== 'INPUT' || speedNode.type !== 'SELECT_SINGLE') {
      throw new Error('Expected speedId to resolve as a single select.')
    }

    const walking = srdSystemRecord.speeds.find((option) => option.code === 'WALK')
    expect(walking).toBeDefined()
    expect(speedNode.options).toContainEqual(
      expect.objectContaining({
        value: walking?.id,
        label: walking?.label,
        description: walking?.description
      })
    )
    expect(speedNode.options).toHaveLength(srdSystemRecord.speeds.length)
  })

  it('serves every SRD class, not an embedded sample, for class references', async () => {
    const model = await resolveFixtureNodeRuntime({
      mapId: 'charges',
      values: { limitKind: 'CLASS_LEVEL' }
    })
    const classNode = getNode(model, 'classId')

    if (!classNode || classNode.kind !== 'INPUT' || classNode.type !== 'SELECT_SINGLE') {
      throw new Error('Expected classId to resolve as a single select.')
    }

    const srdClasses = srdBaselineContent.subjects.classes.filter(
      (srdClass) => srdClass.category === 'BASE'
    )
    expect(classNode.options.map((option) => option.value)).toEqual(
      expect.arrayContaining(srdClasses.map((srdClass) => srdClass.id))
    )
    expect(classNode.options.map((option) => option.label)).toContain('Fighter')
  })

  it('evaluates local visibility and required state from the supplied values', async () => {
    const model = await resolveFixtureNodeRuntime({
      mapId: 'charges',
      values: { limitKind: 'FIXED_AMOUNT', scalingKind: 'NONE' }
    })

    expect(getNode(model, 'amount')).toMatchObject({ visible: true, required: true })
    expect(getNode(model, 'classId')).toMatchObject({ visible: false, required: false })
  })

  it('evaluates parent-scoped visibility for nested maps', async () => {
    const model = await resolveFixtureNodeRuntime({
      mapId: 'rollTableRow',
      parentValues: { rollTableKind: 'RANGE' },
      values: { order: 1 }
    })

    expect(getNode(model, 'rollRangeMin')).toMatchObject({ visible: true, required: true })
    expect(getNode(model, 'rollRangeMax')).toMatchObject({ visible: true, required: true })
    expect(getNode(model, 'rollValue')).toMatchObject({ visible: false, required: false })
  })

  it('carries map-owned presentation semantics into nested collection nodes', async () => {
    const model = await resolveFixtureNodeRuntime({ mapId: 'featureGrants', values: {} })

    expect(getNode(model, 'modifiers')).toMatchObject({
      authoring: { collection: { rowSummary: 'modifier' } }
    })
  })

  it('marks system-owned grant discriminators as non-renderable authoring fields', async () => {
    const model = await resolveFixtureNodeRuntime({ mapId: 'modifierGrant', values: {} })

    expect(getNode(model, 'grantKind')).toMatchObject({ authoring: { exposure: 'system' } })
  })
})

function getNode(
  model: NodeRuntimeResolveResponseDto,
  nodeId: string
): NodeRuntimeNodeDto | undefined {
  return model.steps
    .flatMap((step) => step.sections)
    .flatMap((section) => section.nodes)
    .find((node) => node.id === nodeId)
}
