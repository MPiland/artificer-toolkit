import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

function table(sql: string, name: string): string {
  const start = sql.indexOf(`CREATE TABLE IF NOT EXISTS public.${name} (`)
  const end = sql.indexOf(';', start)
  return sql.slice(start, end)
}

describe('Campaign child scope constraints', () => {
  const canonical = read('packages/db/src/domains/campaigns/tables/campaigns.sql')
  const migration = read('supabase/migrations/20260809000000_campaign_child_tenant_constraints.sql')
  const bundle = read('packages/db/src/domains/bootstrap/generated/create_database.bundle.sql')

  it('keeps conversations and sessions unique within their campaign', () => {
    for (const sql of [canonical, migration, bundle]) {
      expect(sql).toContain('UNIQUE (id, campaign_id)')
    }

    expect(migration).toContain('campaign_conversations_id_campaign_id_key')
    expect(migration).toContain('campaign_sessions_id_campaign_id_key')
  })

  it('requires children to reference a conversation or session in the same campaign', () => {
    for (const [name, parent] of [
      ['campaign_conversation_members', 'campaign_conversations'],
      ['campaign_conversation_entries', 'campaign_conversations'],
      ['campaign_session_attendance', 'campaign_sessions'],
      ['campaign_session_rsvps', 'campaign_sessions'],
      ['campaign_session_reference_pins', 'campaign_sessions']
    ] as const) {
      for (const sql of [canonical, bundle]) {
        const definition = table(sql, name)
        expect(definition).toContain(
          `FOREIGN KEY (${parent === 'campaign_conversations' ? 'conversation_id' : 'session_id'}, campaign_id)`
        )
        expect(definition).toContain(`REFERENCES public.${parent} (id, campaign_id)`)
        expect(definition).not.toContain(`REFERENCES public.${parent} (id) ON DELETE CASCADE`)
      }
    }

    expect(migration).toContain(
      'DROP CONSTRAINT campaign_conversation_members_conversation_id_fkey'
    )
    expect(migration).toContain(
      'DROP CONSTRAINT campaign_conversation_entries_conversation_id_fkey'
    )
    expect(migration).toContain('DROP CONSTRAINT campaign_session_attendance_session_id_fkey')
    expect(migration).toContain('DROP CONSTRAINT campaign_session_rsvps_session_id_fkey')
    expect(migration).toContain('DROP CONSTRAINT campaign_session_reference_pins_session_id_fkey')
    for (const constraint of [
      'campaign_conversation_members_conversation_campaign_fkey',
      'campaign_conversation_entries_conversation_campaign_fkey',
      'campaign_session_attendance_session_campaign_fkey',
      'campaign_session_rsvps_session_campaign_fkey',
      'campaign_session_reference_pins_session_campaign_fkey'
    ]) {
      expect(migration).toContain(`ADD CONSTRAINT ${constraint}`)
    }
    expect(migration).toContain('FOREIGN KEY (conversation_id, campaign_id)')
    expect(migration).toContain('REFERENCES public.campaign_conversations (id, campaign_id)')
    expect(migration).toContain('FOREIGN KEY (session_id, campaign_id)')
    expect(migration).toContain('REFERENCES public.campaign_sessions (id, campaign_id)')
    expect(migration).not.toContain('NOT VALID')
  })
})
