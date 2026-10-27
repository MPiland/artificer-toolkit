import { describe, expect, it } from 'vitest'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { SRD_OPTIONAL_COMBAT_DEFINITIONS } from '@artificer-toolkit/source-data/srd/optionalCombat.js'

import { presentCampaignPlaySettingsOptions } from '../campaignPlaySettingsOptions.js'

const injuries = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
  (definition) => definition.document.kind === 'INJURIES'
)
if (!injuries) throw new Error('Missing SRD Injuries.')
const { document, definitionFamilyKey } = injuries

function current(
  label: string,
  module: typeof document.module,
  id: string = document.id
): ReusableDefinitionCurrentDto {
  const body = { ...document, id, module }
  return {
    id,
    gameSystemId: document.gameSystemId,
    contentSourceId: '44444444-4444-4444-8444-444444444444',
    definitionFamilyKey,
    label,
    description: null,
    document: body,
    checksum: checksumRuleDocument(body),
    contractVersion: 1,
    version: 1,
    publishedAt: '2026-10-26T00:00:00.000Z',
    publishedBy: '55555555-5555-4555-8555-555555555555'
  }
}

describe('Campaign settings options for Injuries (ATTACK-15.3)', () => {
  it('offers Injuries only while its authored module resolves to the integrated policy', () => {
    const offered = current(injuries.label, document.module)
    const laterContract = current(
      'Injuries, unsupported contract',
      { ...document.module, contractVersion: document.module.contractVersion + 1 },
      '15a30000-0000-4000-8000-000000000001'
    )
    const otherModule = current(
      'Injuries, unknown module',
      { ...document.module, policyModuleKey: 'homebrew.injuries' },
      '15a30000-0000-4000-8000-000000000002'
    )
    expect(
      presentCampaignPlaySettingsOptions([offered, laterContract, otherModule]).optionalCombatRules
    ).toEqual([{ definitionId: document.id, label: injuries.label, kind: 'INJURIES' }])
  })
})
