import { srdBaselineContent } from '@artificer-toolkit/db'
import { createHash } from 'node:crypto'
import {
  assertCompiledSubjectMechanicsIndex,
  compileSubjectWithMechanicsIndex,
  resolveRaceAuthored
} from '@artificer-toolkit/shared/subjects/compilers'
import type { RaceAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { describe, expect, it } from 'vitest'

function descriptorChecksum(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function mutateOwnedRecord(
  value: unknown,
  id: string,
  mutate: (record: Record<string, unknown>) => void
): boolean {
  if (Array.isArray(value)) return value.some((entry) => mutateOwnedRecord(entry, id, mutate))
  if (typeof value !== 'object' || value === null) return false

  const record = value as Record<string, unknown>
  if (record.id === id) {
    mutate(record)
    return true
  }
  return Object.values(record).some((entry) => mutateOwnedRecord(entry, id, mutate))
}

describe('compiled subject mechanics index', () => {
  it('keeps explicit root semantics and excludes unrecognized display fields', () => {
    const spell = srdBaselineContent.subjects.spells[0]
    if (!spell) throw new Error('SRD spell fixture is missing.')
    const compilation = compileSubjectWithMechanicsIndex({
      subjectKind: 'SPELL',
      authored: { ...spell, futureDisplayLabel: 'Never indexed' }
    })
    const root = compilation.mechanicsIndex.nodes[0]
    if (!root || root.kind !== 'ROOT_COMPILED_SEMANTICS') throw new Error('Root node is missing.')

    expect(root.semanticDescriptor.fields.some((field) => field.key === 'level')).toBe(true)
    expect(root.semanticDescriptor.fields.some((field) => field.key === 'futureDisplayLabel')).toBe(
      false
    )
  })

  it('indexes UUID-owned class resources, nested feature grants, and starting equipment explicitly', () => {
    const classWithMechanics = srdBaselineContent.subjects.classes.find(
      (candidate) => candidate.resources && candidate.features?.some((feature) => feature.grants)
    )
    if (!classWithMechanics) throw new Error('SRD class mechanics fixture is missing.')
    const index = compileSubjectWithMechanicsIndex({
      subjectKind: 'CLASS',
      authored: classWithMechanics
    }).mechanicsIndex

    expect(index.nodes.some((node) => node.nodeKind === 'CLASS_RESOURCE')).toBe(true)
    expect(index.nodes.some((node) => node.nodeKind === 'STARTING_EQUIPMENT_ITEM')).toBe(true)
    expect(index.nodes.some((node) => node.nodeKind === 'FEATURE')).toBe(true)
    expect(index.nodes.some((node) => node.nodeKind.endsWith('_GRANT'))).toBe(true)
  })

  it('retains modifier and vehicle mechanics through explicit descriptor builders', () => {
    const modifierFixture = srdBaselineContent.subjects.classes
      .map((authored) => ({
        authored,
        modifier: compileSubjectWithMechanicsIndex({
          subjectKind: 'CLASS',
          authored
        }).mechanicsIndex.nodes.find((node) => node.nodeKind === 'MODIFIER_GRANT')
      }))
      .find(
        (
          candidate
        ): candidate is typeof candidate & { modifier: NonNullable<typeof candidate.modifier> } =>
          candidate.modifier?.kind === 'UUID_COMPILED_SEMANTICS'
      )
    const modifier = modifierFixture?.modifier
    const vehicle = srdBaselineContent.subjects.vehicles.find(
      (candidate) => candidate.cost !== undefined
    )
    if (!modifier || !vehicle) throw new Error('SRD descriptor fixtures are missing.')
    const vehicleRoot = compileSubjectWithMechanicsIndex({
      subjectKind: 'VEHICLE',
      authored: vehicle
    }).mechanicsIndex.nodes[0]
    if (
      modifier.kind !== 'UUID_COMPILED_SEMANTICS' ||
      !vehicleRoot ||
      vehicleRoot.kind !== 'ROOT_COMPILED_SEMANTICS'
    ) {
      throw new Error('Compiled descriptor nodes are missing.')
    }

    expect(modifier.semanticDescriptor.fields.map((field) => field.key)).toEqual(
      expect.arrayContaining(['modifierKind', 'scope', 'payload'])
    )
    expect(vehicleRoot.semanticDescriptor.fields.map((field) => field.key)).toEqual(
      expect.arrayContaining(['cost'])
    )
    const changedVehicleRoot = compileSubjectWithMechanicsIndex({
      subjectKind: 'VEHICLE',
      authored: { ...vehicle, speed: (vehicle.speed ?? 0) + 5 }
    }).mechanicsIndex.nodes[0]
    expect(changedVehicleRoot).toBeDefined()
    expect(changedVehicleRoot?.kind).toBe('ROOT_COMPILED_SEMANTICS')
    if (
      changedVehicleRoot?.kind === 'ROOT_COMPILED_SEMANTICS' &&
      vehicleRoot.kind === 'ROOT_COMPILED_SEMANTICS'
    ) {
      expect(changedVehicleRoot.semanticDescriptor).not.toEqual(vehicleRoot.semanticDescriptor)
    }

    if (!modifierFixture || modifier?.kind !== 'UUID_COMPILED_SEMANTICS') {
      throw new Error('SRD modifier fixture is missing.')
    }
    const changedClass = structuredClone(modifierFixture.authored)
    expect(
      mutateOwnedRecord(changedClass, modifier.nodeId, (record) => {
        record.modifierKind = record.modifierKind === 'BONUS' ? 'PENALTY' : 'BONUS'
      })
    ).toBe(true)
    const changedModifier = compileSubjectWithMechanicsIndex({
      subjectKind: 'CLASS',
      authored: changedClass
    }).mechanicsIndex.nodes.find(
      (node) => node.kind === 'UUID_COMPILED_SEMANTICS' && node.nodeId === modifier.nodeId
    )
    if (changedModifier?.kind !== 'UUID_COMPILED_SEMANTICS') {
      throw new Error('Changed modifier node is missing.')
    }
    expect(changedModifier.semanticDescriptor).not.toEqual(modifier.semanticDescriptor)
    expect(descriptorChecksum(changedModifier.semanticDescriptor)).not.toBe(
      descriptorChecksum(modifier.semanticDescriptor)
    )
  })

  it('indexes a grant-owned charge beneath Thief of Five Fates', () => {
    const warlock = srdBaselineContent.subjects.classes.find(
      (candidate) => candidate.label === 'Warlock'
    )
    const invocationFeature = warlock?.features?.find((feature) => feature.options?.length)
    const thief = invocationFeature?.options?.find(
      (option) => option.label === 'Thief of Five Fates'
    )
    const grant = thief?.grants?.spells?.[0]
    const charge = (grant as { id: string; charges?: { id: string } } | undefined)?.charges
    if (!warlock || !grant || !charge) {
      throw new Error('Thief of Five Fates fixture is missing its charge.')
    }

    const nodes = compileSubjectWithMechanicsIndex({ subjectKind: 'CLASS', authored: warlock })
      .mechanicsIndex.nodes
    expect(
      nodes.some(
        (node) =>
          node.kind === 'UUID_COMPILED_SEMANTICS' &&
          node.nodeKind === 'CHARGE' &&
          node.nodeId === charge.id &&
          node.sourcePath.includes(grant.id)
      )
    ).toBe(true)

    const originalCharge = nodes.find(
      (node) => node.kind === 'UUID_COMPILED_SEMANTICS' && node.nodeId === charge.id
    )
    if (originalCharge?.kind !== 'UUID_COMPILED_SEMANTICS') {
      throw new Error('Compiled Thief of Five Fates charge is missing.')
    }
    const changedWarlock = structuredClone(warlock)
    expect(
      mutateOwnedRecord(changedWarlock, charge.id, (record) => {
        record.resetKind = 'SHORT_REST'
        record.limitKind = 'FIXED_AMOUNT'
        record.scalingKind = 'PER_LEVEL'
        delete record.amount
        record.levels = [
          {
            id: '00000000-0000-4000-8000-000000000004',
            level: 1,
            amount: 2
          }
        ]
      })
    ).toBe(true)
    const changedCharge = compileSubjectWithMechanicsIndex({
      subjectKind: 'CLASS',
      authored: changedWarlock
    }).mechanicsIndex.nodes.find(
      (node) => node.kind === 'UUID_COMPILED_SEMANTICS' && node.nodeId === charge.id
    )
    if (changedCharge?.kind !== 'UUID_COMPILED_SEMANTICS') {
      throw new Error('Changed Thief of Five Fates charge is missing.')
    }
    expect(changedCharge.semanticDescriptor).not.toEqual(originalCharge.semanticDescriptor)
    expect(descriptorChecksum(changedCharge.semanticDescriptor)).not.toBe(
      descriptorChecksum(originalCharge.semanticDescriptor)
    )
  })

  it('indexes a feature-owned resettable charge as CHARGE', () => {
    const druid = srdBaselineContent.subjects.classes.find((candidate) =>
      candidate.features?.some((feature) => feature.label === 'Natural Recovery')
    )
    const feature = druid?.features?.find((candidate) => candidate.label === 'Natural Recovery')
    const charge = feature?.charges
    if (!druid || !feature || !charge) throw new Error('Natural Recovery fixture is missing.')

    const node = compileSubjectWithMechanicsIndex({
      subjectKind: 'CLASS',
      authored: druid
    }).mechanicsIndex.nodes.find(
      (candidate) =>
        candidate.kind === 'UUID_COMPILED_SEMANTICS' &&
        candidate.nodeId === charge.id &&
        candidate.sourcePath.includes(feature.id)
    )
    expect(node?.kind).toBe('UUID_COMPILED_SEMANTICS')
    expect(node?.nodeKind).toBe('CHARGE')
  })

  it('indexes a feature source-charge use as CHARGE_USE', () => {
    const druid = srdBaselineContent.subjects.classes.find((candidate) =>
      candidate.features?.some((feature) => feature.label === 'Natural Recovery')
    )
    const feature = druid?.features?.find((candidate) => candidate.label === 'Natural Recovery')
    const charge = feature?.charges
    if (!druid || !feature || !charge) throw new Error('Natural Recovery fixture is missing.')

    const sourceChargeDruid = structuredClone(druid)
    expect(
      mutateOwnedRecord(sourceChargeDruid, charge.id, (record) => {
        record.limitKind = 'SOURCE_CHARGES'
        record.cost = 1
        delete record.resetKind
        delete record.scalingKind
        delete record.amount
      })
    ).toBe(true)

    const node = compileSubjectWithMechanicsIndex({
      subjectKind: 'CLASS',
      authored: sourceChargeDruid
    }).mechanicsIndex.nodes.find(
      (candidate) =>
        candidate.kind === 'UUID_COMPILED_SEMANTICS' &&
        candidate.nodeId === charge.id &&
        candidate.sourcePath.includes(feature.id)
    )
    expect(node?.kind).toBe('UUID_COMPILED_SEMANTICS')
    expect(node?.nodeKind).toBe('CHARGE_USE')
  })

  it('rejects non-UUID mechanics index identities before publication can consume them', () => {
    const rootId = '00000000-0000-4000-8000-000000000001'
    const nodePathId = '00000000-0000-4000-8000-000000000002'
    const effectId = '00000000-0000-4000-8000-000000000003'
    expect(() =>
      assertCompiledSubjectMechanicsIndex({
        contractVersion: 1,
        subjectKind: 'SPELL',
        rootId: 'not-a-uuid',
        nodes: []
      })
    ).toThrow('root identity must be a UUID')
    expect(() =>
      assertCompiledSubjectMechanicsIndex({
        contractVersion: 1,
        subjectKind: 'SPELL',
        rootId,
        nodes: [
          {
            kind: 'UUID_COMPILED_SEMANTICS',
            nodeKind: 'FEATURE',
            nodeId: 'not-a-uuid',
            sourcePath: [rootId, nodePathId],
            semanticDescriptor: { nodeKind: 'FEATURE', fields: [] }
          }
        ]
      })
    ).toThrow('node identity must be a UUID')
    expect(() =>
      assertCompiledSubjectMechanicsIndex({
        contractVersion: 1,
        subjectKind: 'SPELL',
        rootId,
        nodes: [
          {
            kind: 'COMPILED_EFFECT_GROUP',
            nodeKind: 'EFFECT_GROUP',
            effectId: 'not-a-uuid',
            sourcePath: [rootId, nodePathId],
            compiledEffect: {} as never
          }
        ]
      })
    ).toThrow('effect identity must be a UUID')
    expect(() =>
      assertCompiledSubjectMechanicsIndex({
        contractVersion: 1,
        subjectKind: 'SPELL',
        rootId,
        nodes: [
          {
            kind: 'COMPILED_EFFECT_GROUP',
            nodeKind: 'EFFECT_GROUP',
            effectId,
            sourcePath: [rootId, 'not-a-uuid'],
            compiledEffect: {} as never
          }
        ]
      })
    ).toThrow('paths must contain UUID identities only')
  })

  it('indexes subrace-owned mechanics separately from the effective parent projection', () => {
    const subrace = srdBaselineContent.subjects.races.find(
      (candidate) => candidate.category === 'SUBRACE' && candidate.features?.length
    )
    if (!subrace || subrace.category !== 'SUBRACE') {
      throw new Error('SRD subrace feature fixture is missing.')
    }
    const parent = srdBaselineContent.subjects.races.find(
      (candidate) => candidate.id === subrace.parentRaceId
    )
    if (!parent || parent.category !== 'BASE') throw new Error('SRD base race fixture is missing.')

    const source = compileSubjectWithMechanicsIndex({ subjectKind: 'RACE', authored: subrace })
    const effective = compileSubjectWithMechanicsIndex({
      subjectKind: 'RACE',
      authored: subrace,
      effectiveAuthored: resolveRaceAuthored(subrace, (id) =>
        id === parent.id ? (parent as RaceAuthored) : null
      )
    })

    expect(source.mechanicsIndex.nodes.some((node) => node.nodeKind === 'FEATURE')).toBe(true)
    expect(source.mechanicsIndex.nodes.every((node) => !node.sourcePath.includes(parent.id))).toBe(
      true
    )
    expect('size' in effective.compiled).toBe(true)
  })
})
