import { describe, expect, it } from 'vitest'
import { srdBaselineContent } from '../source-data/srd/index.js'
import type { DurationReference, NestedFeatureReference } from './helpers/srdSourceDataHelpers.js'
import {
  collectInvalidUuidValues,
  collectDuplicateValues,
  collectDurationReferences,
  collectNestedFeatureReferences
} from './helpers/srdSourceDataHelpers.js'

describe('SRD source data', () => {
  it('binds the SRD system container to the D&D 5e 2014 ruleset', () => {
    expect(srdBaselineContent.vocabulary.systems).toHaveLength(1)
    expect(srdBaselineContent.vocabulary.systems[0]).toMatchObject({
      rulesetCode: 'dnd5e',
      rulesetVersion: '2014'
    })
  })

  it('uses valid UUID strings for deterministic ID fields', () => {
    const invalidValues: string[] = []

    collectInvalidUuidValues(srdBaselineContent, 'srdBaselineContent', invalidValues)

    expect(invalidValues).toEqual([])
  })

  it('does not define duplicate subject IDs', () => {
    const subjectGroups = Object.values(srdBaselineContent.subjects) as readonly (readonly {
      id: string
    }[])[]
    const subjectIds = subjectGroups.flatMap((subjects) => subjects.map((subject) => subject.id))

    expect(collectDuplicateValues(subjectIds)).toEqual([])
  })

  it('marks seeded subject records active', () => {
    const subjectGroups = Object.entries(srdBaselineContent.subjects) as readonly [
      string,
      readonly { label: string; status: string }[]
    ][]
    const inactiveSubjects = subjectGroups.flatMap(([subjectKind, subjects]) =>
      subjects
        .filter((subject) => subject.status !== 'ACTIVE')
        .map((subject) => `${subjectKind}: ${subject.label} (${subject.status})`)
    )

    expect(inactiveSubjects).toEqual([])
  })

  it('does not define duplicate nested feature IDs', () => {
    const featureReferences: NestedFeatureReference[] = []

    collectNestedFeatureReferences(srdBaselineContent.subjects, 'subjects', featureReferences)

    const duplicateFeatureIds = new Set(
      collectDuplicateValues(featureReferences.map((reference) => reference.id))
    )
    expect(
      featureReferences
        .filter((reference) => duplicateFeatureIds.has(reference.id))
        .map((reference) => `${reference.path}: ${reference.id}`)
    ).toEqual([])
  })

  it('does not reuse duration characteristic IDs', () => {
    const durationReferences: DurationReference[] = []

    collectDurationReferences(srdBaselineContent.subjects, 'subjects', durationReferences)

    const duplicateDurationIds = new Set(
      collectDuplicateValues(durationReferences.map((reference) => reference.id))
    )
    expect(
      durationReferences
        .filter((reference) => duplicateDurationIds.has(reference.id))
        .map((reference) => `${reference.path}: ${reference.id}`)
    ).toEqual([])
  })

  it('keeps creature feature IDs scoped to their owning creature', () => {
    const mismatchedFeatureIds = srdBaselineContent.subjects.creatures.flatMap((creature) => {
      const creatureOwnerSegment = creature.id.slice(24, 28)

      return (creature.features ?? [])
        .filter((feature) => feature.id.slice(24, 28) !== creatureOwnerSegment)
        .map((feature) => `${creature.label}: ${feature.label} (${feature.id})`)
    })

    expect(mismatchedFeatureIds).toEqual([])
  })

  it('keeps equipment modifier IDs scoped to their owning equipment', () => {
    const mismatchedModifierIds = srdBaselineContent.subjects.equipment.flatMap((equipment) => {
      const equipmentOwnerSegment = equipment.id.split('-')[4]?.slice(0, 4)

      return (equipment.modifiers ?? [])
        .filter((modifier) => modifier.id.split('-')[3] !== equipmentOwnerSegment)
        .map((modifier) => `${equipment.label}: ${modifier.id}`)
    })

    expect(mismatchedModifierIds).toEqual([])
  })

  it('uses contiguous one-based modifier orders within each equipment record', () => {
    const invalidModifierOrders = srdBaselineContent.subjects.equipment.flatMap((equipment) =>
      (equipment.modifiers ?? []).flatMap((modifier, index) =>
        Number.isInteger(modifier.order) && modifier.order === index + 1
          ? []
          : [
              `${equipment.label}: ${modifier.id} has order ${modifier.order}, expected ${index + 1}`
            ]
      )
    )

    expect(invalidModifierOrders).toEqual([])
  })
})
