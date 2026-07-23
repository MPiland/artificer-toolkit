import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '#types'

const sqlState = vi.hoisted(() => ({
  row: {} as Record<string, unknown>,
  statements: [] as string[]
}))

vi.mock('kysely', () => {
  function render(value: unknown): string {
    return typeof value === 'object' && value !== null && 'text' in value
      ? String((value as { text: unknown }).text)
      : String(value)
  }

  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings
      .map((piece, index) => `${piece}${index < values.length ? render(values[index]) : ''}`)
      .join('')

    return {
      text,
      execute: async () => {
        sqlState.statements.push(text)
        return { rows: [sqlState.row] }
      }
    }
  }

  return { sql }
})

import { createAuthoredDefinitionRepository } from '../domains/subjects/repositories/authoredDefinition.js'

const db = {} as DBLike

describe('authored selected revision reads', () => {
  beforeEach(() => {
    sqlState.statements.length = 0
    sqlState.row = {
      subject_id: '00000000-0000-0000-0000-000000000001',
      subject_kind: 'SPELL',
      owner_user_id: 'user-1',
      system_id: 'system-1',
      label: 'Harm',
      is_master: false,
      active_revision_id: 'revision-active',
      draft_revision_id: 'revision-draft',
      next_revision_number: 3,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
      public_id: 'harm-public',
      revision_id: 'revision-active',
      revision_number: 1,
      payload: { label: 'Harm' },
      base_active_revision_id: null,
      revision_created_at: '2026-01-01T00:00:00.000Z'
    }
  })

  it('selects an accessible active revision by public route id and maps draft presence', async () => {
    const selected = await createAuthoredDefinitionRepository(db).findSelectedRevision({
      routeId: 'HARM-PUBLIC',
      subjectKind: 'SPELL',
      userId: 'user-1',
      view: 'active'
    })

    expect(selected).toMatchObject({
      subjectId: '00000000-0000-0000-0000-000000000001',
      publicId: 'harm-public',
      activeRevisionId: 'revision-active',
      draftRevisionId: 'revision-draft',
      revisionId: 'revision-active',
      payload: { label: 'Harm' }
    })
    expect(sqlState.statements[0]).toContain('route.public_id = harm-public')
    expect(sqlState.statements[0]).toContain(
      'public.can_access_authored_route_id(route.subject_kind, route.subject_id)'
    )
    expect(sqlState.statements[0]).not.toContain('definition.owner_user_id = user-1')
  })

  it('selects an owned draft revision by catalogue UUID', async () => {
    sqlState.row.revision_id = 'revision-draft'
    sqlState.row.revision_number = 2
    sqlState.row.base_active_revision_id = 'revision-active'

    const selected = await createAuthoredDefinitionRepository(db).findSelectedRevision({
      routeId: '00000000-0000-0000-0000-000000000001',
      subjectKind: 'SPELL',
      userId: 'user-1',
      view: 'draft'
    })

    expect(selected).toMatchObject({
      revisionId: 'revision-draft',
      revisionNumber: 2,
      baseActiveRevisionId: 'revision-active'
    })
    expect(sqlState.statements[0]).toContain(
      'route.subject_id = 00000000-0000-0000-0000-000000000001::uuid'
    )
    expect(sqlState.statements[0]).toContain('definition.owner_user_id = user-1')
  })
})
