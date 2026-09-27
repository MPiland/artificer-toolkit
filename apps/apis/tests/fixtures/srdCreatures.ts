import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { srdCreatureRecords } from '@artificer-toolkit/source-data/srd/creatures/index.js'
import { prepareSrdImport } from '@artificer-toolkit/source-data/srd/import.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'

const seededWolf = srdCreatureRecords.find((record) => record.id === wolf.id)
if (!seededWolf) throw new Error('The seeded SRD Wolf is missing.')

/** The SRD Wolf as seeded, with the corpus-applied ATTACK roll its raw stat block module lacks. */
export const srdWolf = seededWolf

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
