import { expect, it, vi } from 'vitest'

import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'
import { authoredDocumentVersionSchema } from '@artificer-toolkit/schema/projections/authoredContent'
import { lifeDomainCleric } from '@artificer-toolkit/source-data/srd/classes/life-domain.js'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from '../nodeRuntime/nodeRuntimeService.js'

// Building the SRD source facts parses about a thousand records (seconds on a loaded machine). The
// fixture parses them while its module loads, so a test's first resolve never pays for them inside
// its own timeout.
it('parses every SRD record when the fixture loads, not on the first resolve', async () => {
  const parse = vi.spyOn(authoredDocumentVersionSchema, 'parse')
  const { createSrdNodeRuntimeReader } = await import('./srdSourceReader.js')
  const { backgrounds, classes, creatures, equipment, feats, races, spells, vehicles } =
    srdBaselineContent.subjects
  const records = [backgrounds, classes, creatures, equipment, feats, races, spells, vehicles]
  expect(parse).toHaveBeenCalledTimes(records.reduce((total, list) => total + list.length, 0))

  parse.mockClear()
  await normalizeNodeRuntimeValues(createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists), {
    mapId: 'class',
    systemId: srdSystemRecord.id,
    values: structuredClone(lifeDomainCleric) as unknown as Record<string, unknown>
  })
  expect(parse).not.toHaveBeenCalled()
})
