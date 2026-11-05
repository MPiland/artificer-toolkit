import { expect, it } from 'vitest'

import { dnd5eCoreCodeAdapter } from '@artificer-toolkit/rules-runtime/systems/dnd5e/coreCodes'
import { lifeDomainCleric } from '@artificer-toolkit/source-data/srd/classes/life-domain.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeNodeRuntimeValues } from '../nodeRuntime/nodeRuntimeService.js'
import { createSrdNodeRuntimeReader } from './srdSourceReader.js'

// Building the SRD source facts parses about a thousand records (seconds on a loaded machine). The
// fixture does that while its module loads, so no test pays for it inside its own timeout.
it("leaves a test's first class normalization only its own work", async () => {
  const started = performance.now()
  await normalizeNodeRuntimeValues(createSrdNodeRuntimeReader(dnd5eCoreCodeAdapter.lists), {
    mapId: 'class',
    systemId: srdSystemRecord.id,
    values: structuredClone(lifeDomainCleric) as unknown as Record<string, unknown>
  })
  expect(performance.now() - started).toBeLessThan(1_000)
})
