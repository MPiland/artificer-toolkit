import { describe, expect, it } from 'vitest'

import { srdCreatures } from '@artificer-toolkit/source-data/srd/creatures/index.js'

import { authoredSourceFacts } from './authoredSourceFacts.js'

const checksum = 'a'.repeat(64)

describe('SRD creature source facts', () => {
  it.each(srdCreatures.map((creature) => [creature.label, creature] as const))(
    'derives %s without two different rows sharing an id',
    (_label, creature) => {
      const subject = { subjectKind: 'CREATURE', document: creature, checksum } as Parameters<
        typeof authoredSourceFacts
      >[0]

      expect(() => authoredSourceFacts(subject)).not.toThrow()
    }
  )
})
