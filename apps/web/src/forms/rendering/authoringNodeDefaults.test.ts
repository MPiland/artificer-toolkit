import { describe, expect, it } from 'vitest'
import type {
  NodeRuntimeObjectGroupNodeDto,
  NodeRuntimeResolveResponseDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import { checkDcDtoSchema, checkDtoSchema } from '@artificer-toolkit/schema/effects/check'
import { attackSlotSetDtoSchema } from '@artificer-toolkit/schema/features/attackSlots'
import { brownBear } from '@artificer-toolkit/source-data/srd/creatures/brown-bear.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { resolveFixtureNodeRuntime } from '#test/nodeRuntimeResolver'
import { createDefaultAuthoringObjectItem } from './authoringNodeDefaults'

describe('attack slot default factory', () => {
  it('creates a slot set that the contract accepts, so adding one is publishable at once', async () => {
    const set = createDefaultAuthoringObjectItem(
      findObjectGroup(
        await resolveFixtureNodeRuntime({
          mapId: 'creatureFeature',
          values: {},
          ancestors: [brownBear as unknown as Record<string, unknown>]
        }),
        'attackSlots'
      )
    )

    expect(attackSlotSetDtoSchema.safeParse(set).error?.issues).toBeUndefined()
  })
})

describe('check default factories', () => {
  it('creates an invocation check whose DC parses and whose checks await the author', async () => {
    const check = createDefaultAuthoringObjectItem(
      findObjectGroup(
        await resolveFixtureNodeRuntime({
          mapId: 'invocation',
          values: { kind: 'ACTION', triggerCode: 'CHECK' }
        }),
        'check'
      )
    )
    const skill = srdSystemRecord.skills[0]
    if (!skill) throw new Error('Expected an SRD skill.')

    expect(checkDcDtoSchema.safeParse(check.dc).success).toBe(true)
    expect(checkDtoSchema.safeParse(check).error?.issues.map((issue) => issue.message)).toEqual([
      'Name at least one allowed check.'
    ])
    expect(
      checkDtoSchema.safeParse({
        ...check,
        checks: { skillIds: [skill.id], abilityDefinitionIds: [] }
      }).success
    ).toBe(true)
  })

  it('creates an actor relationship escape DC that parses', async () => {
    const dc = createDefaultAuthoringObjectItem(
      findObjectGroup(
        await resolveFixtureNodeRuntime({
          mapId: 'actorRelationshipModule',
          values: { kind: 'ESCAPE_CHECK' }
        }),
        'dc'
      )
    )

    expect(checkDcDtoSchema.safeParse(dc).success).toBe(true)
  })
})

function findObjectGroup(
  model: NodeRuntimeResolveResponseDto,
  nodeId: string
): NodeRuntimeObjectGroupNodeDto {
  const node = model.steps
    .flatMap((step) => step.sections.flatMap((section) => section.nodes))
    .find((candidate) => candidate.id === nodeId)
  if (!node || node.kind !== 'GROUP' || node.groupKind !== 'OBJECT')
    throw new Error(`Expected ${nodeId} to be an object group.`)
  return node
}
