import { describe, expect, it } from 'vitest'

import {
  compileBackground,
  compileClass,
  compileCreature,
  compileEquipment,
  compileFeat,
  compileRace,
  compileSpell,
  compileVehicle,
  resolveRaceAuthored
} from '@artificer-toolkit/shared/subjects/compilers'

import { srdBaselineContent } from '../source-data/srd/index.js'
import { checksumCanonicalJson, normalizeCanonicalJson } from '../utils/canonicalJson.js'
import { checksumSystemVocabularySnapshot } from '../utils/versionedProjectionChecksum.js'

function requireFixture<T>(records: readonly T[], name: string): T {
  const record = records[0]
  if (!record) throw new Error(`SRD ${name} fixture is missing.`)
  return record
}

describe('versioned baseline projections', () => {
  it('rebuilds each authored-root projection with an identical checksum', () => {
    const racesById = new Map(srdBaselineContent.subjects.races.map((race) => [race.id, race]))
    const race = requireFixture(srdBaselineContent.subjects.races, 'race')
    const compile = [
      () => compileBackground(requireFixture(srdBaselineContent.subjects.backgrounds, 'background')),
      () => compileClass(requireFixture(srdBaselineContent.subjects.classes, 'class')),
      () => compileCreature(requireFixture(srdBaselineContent.subjects.creatures, 'creature')),
      () => compileEquipment(requireFixture(srdBaselineContent.subjects.equipment, 'equipment')),
      () => compileFeat(requireFixture(srdBaselineContent.subjects.feats, 'feat')),
      () => compileRace(resolveRaceAuthored(race, (raceId) => racesById.get(raceId))),
      () => compileSpell(requireFixture(srdBaselineContent.subjects.spells, 'spell')),
      () => compileVehicle(requireFixture(srdBaselineContent.subjects.vehicles, 'vehicle'))
    ]

    for (const compileProjection of compile) {
      const first = checksumCanonicalJson(normalizeCanonicalJson(compileProjection()))
      const rebuilt = checksumCanonicalJson(normalizeCanonicalJson(compileProjection()))
      expect(rebuilt).toBe(first)
    }
  })

  it('keeps a persisted System vocabulary snapshot checksum stable when it is read back', () => {
    const system = requireFixture(srdBaselineContent.vocabulary.systems, 'system')
    const published = {
      snapshotId: '00000000-0000-0000-0000-000000000001',
      systemId: system.id,
      snapshotVersion: 1,
      schemaVersion: 1,
      document: system
    }
    const checksum = checksumSystemVocabularySnapshot(published)
    const stored = { ...published, checksum }

    expect(checksumSystemVocabularySnapshot(stored)).toBe(checksum)
  })
})
