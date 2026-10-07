import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { prepareSrdImport } from '@artificer-toolkit/source-data/srd/import.js'

let seededCreatures: readonly CreatureAuthored[] | null = null

/** A Creature exactly as the SRD seed imports it (vocabulary codes resolved), by stat block name. */
export function seededSrdCreature(label: string): CreatureAuthored {
  seededCreatures ??= prepareSrdImport()
    .subjects.filter((subject) => subject.subjectKind === 'CREATURE')
    .map((subject) => creatureAuthoredDtoSchema.parse(subject.document))
  const record = seededCreatures.find((candidate) => candidate.label === label)
  if (!record) throw new Error(`The seeded SRD ${label} is missing.`)
  return record
}
