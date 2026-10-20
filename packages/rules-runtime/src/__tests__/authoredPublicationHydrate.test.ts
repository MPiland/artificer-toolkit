import type { AuthoredStoredCompilation } from '@artificer-toolkit/schema/api/authoredPublication'
import { srdEquipment } from '@artificer-toolkit/source-data/srd/equipment/index.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { describe, expect, it } from 'vitest'

import { hydrateStoredCompilation } from '../authoredPublicationHydrate.js'
import { storedEquipmentSource } from '../testing/storedEquipmentSource.js'

const [equipment, other] = srdEquipment
if (!equipment || !other) throw new Error('SRD Equipment is missing.')
const stored = storedEquipmentSource(equipment)
const subject = { id: equipment.id, checksum: stored.checksum }

describe('hydrateStoredCompilation guards', () => {
  it('hydrates the stored compilation of its own current document', () => {
    expect(hydrateStoredCompilation('EQUIPMENT', subject, stored.compilation).id).toBe(equipment.id)
  })

  it('refuses a compilation of a superseded compiler version', () => {
    expect(() =>
      hydrateStoredCompilation('EQUIPMENT', subject, {
        ...stored.compilation,
        compilerVersion: 'subject-compiler-v1'
      } as unknown as AuthoredStoredCompilation)
    ).toThrow('Stored EQUIPMENT compilation is superseded; recompile it.')
  })

  it('refuses a projection whose id is not the subject id', () => {
    const foreign = storedEquipmentSource(other).compilation
    const projectionJson = foreign.projectionJson
    expect(() =>
      hydrateStoredCompilation('EQUIPMENT', subject, {
        ...stored.compilation,
        projectionJson,
        projectionChecksum: checksumRuleDocument(JSON.parse(projectionJson))
      })
    ).toThrow('Stored EQUIPMENT compilation identity mismatch.')
  })
})
