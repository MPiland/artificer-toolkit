import {
  contentSnapshotDocumentsObjectSchema,
  contentSnapshotIndexObjectSchema,
  type ContentSnapshotScope
} from '@artificer-toolkit/schema/api/contentSnapshots'
import {
  raceAuthoredDtoSchema,
  type RaceAuthoredDto
} from '@artificer-toolkit/schema/subjects/race'
import { elf, highElf } from '@artificer-toolkit/source-data/srd/races/elf.js'
import { describe, expect, it } from 'vitest'

import { getRaceAbilityScoreIncreaseFacts } from '../character/builderCatalog.js'
import { createSnapshotReaders } from '../character/snapshotReaders.js'
import { buildContentSnapshotKind } from '../contentSnapshots.js'

const baseRace = raceAuthoredDtoSchema.parse(elf)
const subrace = raceAuthoredDtoSchema.parse(highElf)

function raceObjects(scope: ContentSnapshotScope, races: readonly RaceAuthoredDto[]) {
  const { index, documents } = buildContentSnapshotKind(
    { format: 1, scope, scopeId: crypto.randomUUID(), kind: 'RACE' },
    races.map((document) => ({ subjectKind: 'RACE' as const, document }))
  )
  return [
    contentSnapshotIndexObjectSchema.parse(JSON.parse(index.json)),
    contentSnapshotDocumentsObjectSchema.parse(JSON.parse(documents.json))
  ]
}

describe('content snapshot readers', () => {
  it('prefers a SOURCE root over a Campaign share of the same root, in any order', async () => {
    const shared = raceObjects('CAMPAIGN', [{ ...baseRace, label: 'Stale share' }])
    const readers = createSnapshotReaders([...shared, ...raceObjects('SOURCE', [baseRace])])
    expect((await readers.readPublication(baseRace.id))?.document.label).toBe(baseRace.label)
    expect((await readers.readRaces()).map((race) => race.label)).toEqual([baseRace.label])
  })

  it('joins a subrace with its base Race as parent resolution does', async () => {
    const readers = createSnapshotReaders(raceObjects('SOURCE', [baseRace, subrace]))
    const joined = (await readers.readRaces()).find((race) => race.id === subrace.id)
    if (baseRace.category !== 'BASE') throw new Error('Expected a base Race fixture.')
    expect(joined).toMatchObject({
      category: 'SUBRACE',
      size: baseRace.size,
      speeds: baseRace.speeds,
      abilityScoreIncreaseFacts: [
        ...getRaceAbilityScoreIncreaseFacts(elf),
        ...getRaceAbilityScoreIncreaseFacts(highElf)
      ]
    })
    await expect(
      createSnapshotReaders(raceObjects('SOURCE', [subrace])).readRaces()
    ).rejects.toThrow('A readable base Race in the same System is required.')
  })
})
