import { compileFeature } from '@artificer-toolkit/shared/compilers'
import type { EquipmentAuthored, RaceAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  compileBackground,
  compileClass,
  compileFeat,
  compileRace,
  compileResolvedEquipment,
  resolveEquipmentAuthored,
  resolveRaceAuthored
} from '@artificer-toolkit/shared/subjects/compilers'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd'
import { describe, expect, it } from 'vitest'

const SRD = srdBaselineContent.subjects

/** Fails on an empty SRD slice, so a field check can never pass vacuously. */
function nonEmpty<T>(rows: readonly T[]): readonly T[] {
  expect(rows.length).toBeGreaterThan(0)
  return rows
}

// PLATFORM-21.T1a: subject-compiler-v2 carries every rules field and label the Builder reads (D163).
describe('subject-compiler-v2 Builder fields over the SRD', () => {
  it('carries class, resource, spellcasting and specialization fields', () => {
    for (const authored of nonEmpty(SRD.classes)) {
      const compiled = compileClass(authored)
      expect(compiled.label).toBe(authored.label)
      if (authored.category === 'BASE' && compiled.category === 'BASE') {
        expect(compiled.subclassSelectionLevel).toBe(authored.subclassSelectionLevel)
        expect(compiled.startingEquipment).toEqual(authored.startingEquipment)
      }
      if (authored.resources) {
        expect(compiled.resources).toMatchObject({
          label: authored.resources.label,
          order: authored.resources.order
        })
        expect(compiled.resources).not.toHaveProperty('description')
      }
      if (authored.spellcasting)
        expect(compiled.spellcasting).toMatchObject({
          magicName: authored.spellcasting.magicName,
          order: authored.spellcasting.order,
          availableAtLevel: authored.spellcasting.availableAtLevel
        })
    }
    const specializations = SRD.classes.flatMap((authored) => {
      const compiled = compileClass(authored)
      return compiled.category === 'SUBCLASS' && authored.category === 'SUBCLASS'
        ? (authored.specializations ?? []).map(
            (row, index) => [row, compiled.specializations?.[index]] as const
          )
        : []
    })
    for (const [authored, compiled] of nonEmpty(specializations))
      expect(compiled).toMatchObject({ id: authored?.id, label: authored?.label })
    expect(SRD.classes.some((row) => row.resources)).toBe(true)
    expect(SRD.classes.some((row) => row.spellcasting)).toBe(true)
  })

  it('carries race, ancestry, option and inherited-feature fields', () => {
    const byId = new Map<string, RaceAuthored>(SRD.races.map((race) => [race.id, race]))
    const resolved = nonEmpty(SRD.races).map((race) => resolveRaceAuthored(race, (id) => byId.get(id)))
    for (const race of resolved) {
      const compiled = compileRace(race)
      expect(compiled.label).toBe(race.label)
      if (race.ancestry) {
        expect(compiled.ancestry?.label).toBe(race.ancestry.label)
        expect(compiled.ancestry?.options.map((row) => row.label)).toEqual(
          race.ancestry.options.map((row) => row.label)
        )
      }
      if (race.category === 'SUBRACE' && compiled.category === 'SUBRACE')
        expect(compiled.inheritedFeatureIds).toEqual(
          race.subrace.inherited.features?.map((feature) => feature.id)
        )
    }
    expect(resolved.some((race) => race.ancestry)).toBe(true)
    expect(
      resolved.some((race) => race.category === 'SUBRACE' && race.subrace.inherited.features?.length)
    ).toBe(true)
  })

  it('carries background, feat and feature labels', () => {
    for (const authored of nonEmpty(SRD.backgrounds))
      expect(compileBackground(authored).label).toBe(authored.label)
    for (const authored of nonEmpty(SRD.feats)) expect(compileFeat(authored).label).toBe(authored.label)
    const features = SRD.classes.flatMap((row) => row.features ?? [])
    for (const authored of nonEmpty(features)) expect(compileFeature(authored).label).toBe(authored.label)
  })

  it('stores Equipment in its resolved shape, with variant parents applied', () => {
    const byId = new Map<string, EquipmentAuthored>(SRD.equipment.map((row) => [row.id, row]))
    const variants = SRD.equipment.filter((row) => row.category === 'VARIANT')
    for (const authored of nonEmpty(SRD.equipment)) {
      const resolved = resolveEquipmentAuthored(authored, (id) => byId.get(id))
      const compiled = compileResolvedEquipment(resolved)
      expect(compiled.label).toBe(authored.label)
      expect(compiled.category).toBe(resolved.category)
      expect(compiled.properties).toEqual(resolved.properties)
      expect(compiled.parentEquipmentIds).toEqual(resolved.variant?.ancestorEquipmentIds ?? [])
    }
    expect(variants.length).toBeGreaterThan(0)
  })
})
