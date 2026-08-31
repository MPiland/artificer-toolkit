import { describe, expect, it, vi } from 'vitest'

import { checksumCanonicalJson } from '../utils/canonicalJson.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { DBLike } from '../types/index.js'

const state = vi.hoisted(() => ({ results: [] as Array<{ rows: Record<string, unknown>[] }> }))

vi.mock('kysely', () => ({
  sql: () => ({ execute: async () => state.results.shift() ?? { rows: [] } })
}))

import { createEncounterRepository } from '../repositories/encounter.js'

const encounterSystemId = '00000000-0000-4000-8000-000000000001'
const foreignSystemId = '00000000-0000-4000-8000-000000000002'

describe('Encounter optional combat snapshot hydration', () => {
  it('rejects a checksum-valid, internally consistent foreign-System snapshot', async () => {
    const document = {
      schemaVersion: 1 as const,
      kind: 'ALTERNATING_DIAGONALS' as const,
      id: '00000000-0000-4000-8000-000000000003',
      gameSystemId: foreignSystemId,
      module: {
        policyModuleKey: 'scene.grid.square.alternating-diagonals',
        contractVersion: 1
      },
      parameters: { kind: 'ALTERNATING_DIAGONALS' },
      mutuallyExclusiveGroup: null
    }

    const snapshot = {
      schemaVersion: 1 as const,
      gameSystemId: foreignSystemId,
      definitions: [
        {
          definitionId: '00000000-0000-4000-8000-000000000003',
          contentSourceId: '00000000-0000-4000-8000-000000000004',
          definitionVersion: 1,
          definitionChecksum: checksumRuleDocument(document),
          contractVersion: 1,
          label: 'Foreign rule',
          document
        }
      ]
    }
    state.results = [
      {
        rows: [
          {
            id: '00000000-0000-4000-8000-000000000005',
            campaign_id: '00000000-0000-4000-8000-000000000006',
            session_id: '00000000-0000-4000-8000-000000000007',
            game_system_id: encounterSystemId,
            blueprint_id: '00000000-0000-4000-8000-000000000008',
            blueprint_version: 1,
            blueprint_checksum: 'b'.repeat(64),
            rule_pack_revision_id: null,
            initiative_policy_snapshot: null,
            initiative_policy_snapshot_checksum: null,
            optional_combat_snapshot: snapshot,
            optional_combat_snapshot_checksum: checksumCanonicalJson(snapshot),
            automation_mode: 'ASSISTED',
            manual_reminder_mode: 'OFF',
            name: 'Encounter',
            status: 'PREPARED',
            version: 1,
            round: 0,
            current_actor_id: null,
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      },
      { rows: [] },
      { rows: [] }
    ]

    await expect(
      createEncounterRepository({} as DBLike).find('00000000-0000-4000-8000-000000000005')
    ).rejects.toThrow('must use the Encounter Game System')
  })
})
