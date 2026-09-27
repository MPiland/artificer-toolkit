import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { srdCreatureRecords } from '@artificer-toolkit/source-data/srd/creatures/index.js'
import { prepareSrdImport } from '@artificer-toolkit/source-data/srd/import.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'

/** An SRD Creature record as the corpus seeds it, with the ATTACK rolls its raw stat block module lacks. */
export function srdCreatureRecord(id: string): CreatureAuthored {
  const record = srdCreatureRecords.find((candidate) => candidate.id === id)
  if (!record) throw new Error(`The seeded SRD Creature ${id} is missing.`)
  return record
}

/** The SRD Wolf as seeded. */
export const srdWolf = srdCreatureRecord(wolf.id)

let seededCreatures: readonly CreatureAuthored[] | null = null

/** A Creature exactly as the SRD seed imports it (vocabulary codes resolved), by stat block name. */
export function seededSrdCreature(label: string): CreatureAuthored {
  seededCreatures ??= prepareSrdImport()
    .subjects.filter((subject) => subject.subjectKind === 'CREATURE')
    .map((subject) => creatureAuthoredDtoSchema.parse(subject.document) as CreatureAuthored)
  const record = seededCreatures.find((candidate) => candidate.label === label)
  if (!record) throw new Error(`The seeded SRD ${label} is missing.`)
  return record
}
