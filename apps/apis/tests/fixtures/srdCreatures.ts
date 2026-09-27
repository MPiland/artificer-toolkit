import { srdCreatureRecords } from '@artificer-toolkit/source-data/srd/creatures/index.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'

const seededWolf = srdCreatureRecords.find((record) => record.id === wolf.id)
if (!seededWolf) throw new Error('The seeded SRD Wolf is missing.')

/** The SRD Wolf as seeded, with the corpus-applied ATTACK roll its raw stat block module lacks. */
export const srdWolf = seededWolf
