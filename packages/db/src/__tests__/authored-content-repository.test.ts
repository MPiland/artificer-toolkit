import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '#types'

const sqlState = vi.hoisted(() => ({
  row: {} as Record<string, unknown>,
  rows: [] as Array<Record<string, unknown> | undefined>,
  statements: [] as string[]
}))

vi.mock('kysely', () => {
  function render(value: unknown): string {
    return typeof value === 'object' && value !== null && 'text' in value
      ? String((value as { text: unknown }).text)
      : String(value)
  }

  const template = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings
      .map((piece, index) => `${piece}${index < values.length ? render(values[index]) : ''}`)
      .join('')

    return {
      text,
      execute: async () => {
        sqlState.statements.push(text)
        const row = sqlState.rows.length > 0 ? sqlState.rows.shift() : sqlState.row
        return { rows: row && Object.keys(row).length > 0 ? [row] : [] }
      }
    }
  }
  const sql = Object.assign(template, {
    join: (values: unknown[]) => ({ text: values.map(render).join(', ') }),
    table: (value: string) => ({ text: value })
  })

  return { sql }
})

import { createAuthoredContentRepository } from '../domains/subjects/repositories/authoredContent.js'
import { createAuthoredImportRefRepository } from '../domains/subjects/repositories/authoredImportRef.js'

const db = {} as DBLike

describe('authored content repository', () => {
  beforeEach(() => {
    sqlState.statements.length = 0
    sqlState.rows.length = 0
    sqlState.row = {}
  })

  it('reads active metadata by public route identity', async () => {
    sqlState.row = {
      subject_id: '00000000-0000-0000-0000-000000000001',
      subject_kind: 'SPELL',
      owner_user_id: 'user-1',
      system_id: 'system-1',
      label: 'Harm',
      is_master: false,
      has_draft: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02 00:00:00.123456+00',
      public_id: 'harm-public'
    }

    const selected = await createAuthoredContentRepository(db).findActiveByRoute({
      routeId: 'HARM-PUBLIC',
      subjectKind: 'SPELL',
      userId: 'user-1'
    })

    expect(selected).toMatchObject({
      subjectId: '00000000-0000-0000-0000-000000000001',
      publicId: 'harm-public',
      hasDraft: true,
      updatedAt: '2026-01-02T00:00:00.123Z'
    })
    expect(sqlState.statements[0]).toContain('route.public_id = harm-public')
    expect(sqlState.statements[0]).toContain(
      'public.can_access_authored_route_id(route.subject_kind, route.subject_id)'
    )
  })

  it('loads master metadata by subject kind for bounded label matching', async () => {
    await createAuthoredContentRepository(db).findActiveMastersBySubjectKind({
      subjectKind: 'EQUIPMENT'
    })

    expect(sqlState.statements[0]).toContain('active.subject_kind = EQUIPMENT')
    expect(sqlState.statements[0]).toContain('active.is_master = true')
  })

  it('reads an owned draft and its active timestamp by UUID route identity', async () => {
    sqlState.row = {
      subject_id: '00000000-0000-0000-0000-000000000001',
      subject_kind: 'SPELL',
      user_id: 'user-1',
      system_id: 'system-1',
      label: 'Harm',
      payload: { label: 'Harm' },
      base_active_updated_at: '2026-01-02T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-03T00:00:00.000Z',
      active_updated_at: '2026-01-02T00:00:00.000Z',
      public_id: 'harm-public'
    }

    const selected = await createAuthoredContentRepository(db).findDraftByRoute({
      routeId: '00000000-0000-0000-0000-000000000001',
      subjectKind: 'SPELL',
      userId: 'user-1'
    })

    expect(selected).toMatchObject({
      baseActiveUpdatedAt: '2026-01-02T00:00:00.000Z',
      draftState: 'ACTIVE_WITH_DRAFT',
      publicId: 'harm-public'
    })
    expect(sqlState.statements[0]).toContain('draft.user_id = user-1')
  })

  it('turns a preserved edit draft into a new-item draft after active deletion', async () => {
    await createAuthoredContentRepository(db).clearDraftBaseAfterActiveDelete({
      subjectId: '00000000-0000-0000-0000-000000000001',
      subjectKind: 'SPELL',
      userId: 'user-1'
    })

    expect(sqlState.statements[0]).toContain('set base_active_updated_at = null')
    expect(sqlState.statements[0]).toContain('and user_id = user-1')
  })

  it('keeps the active timestamp inside PostgreSQL when saving an edit draft', async () => {
    sqlState.rows.push(
      undefined,
      undefined,
      {
        subject_id: '00000000-0000-0000-0000-000000000001',
        subject_kind: 'SPELL',
        owner_user_id: 'user-1',
        system_id: 'system-1',
        label: 'Harm',
        is_master: false,
        has_draft: false,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.123456Z'
      },
      undefined,
      {
        subject_id: '00000000-0000-0000-0000-000000000001',
        subject_kind: 'SPELL',
        user_id: 'user-1',
        system_id: 'system-1',
        label: 'Edited Harm',
        payload: { label: 'Edited Harm' },
        base_active_updated_at: '2026-01-02 00:00:00.123456+00',
        created_at: '2026-01-03T00:00:00.000Z',
        updated_at: '2026-01-03T00:00:00.000Z',
        active_updated_at: '2026-01-02T00:00:00.123456Z'
      }
    )

    await createAuthoredContentRepository({ isTransaction: true } as DBLike).saveDraft({
      subjectKind: 'SPELL',
      subjectId: '00000000-0000-0000-0000-000000000001',
      userId: 'user-1',
      systemId: 'system-1',
      label: 'Edited Harm',
      payload: { label: 'Edited Harm' }
    })

    expect(sqlState.statements[0]).toContain('pg_advisory_xact_lock')
    expect(sqlState.statements[3]).toContain('select root.updated_at')
    expect(sqlState.statements[3]).toContain('where authored_drafts.user_id = excluded.user_id')
  })

  it('checks draft freshness with exact PostgreSQL timestamp equality', async () => {
    sqlState.rows.push(
      {
        subject_id: '00000000-0000-0000-0000-000000000001',
        subject_kind: 'SPELL',
        user_id: 'user-1',
        system_id: 'system-1',
        label: 'Edited Harm',
        payload: { label: 'Edited Harm' },
        base_active_updated_at: '2026-01-02 00:00:00.123456+00',
        created_at: '2026-01-03T00:00:00.000Z',
        updated_at: '2026-01-03T00:00:00.000Z',
        active_updated_at: null
      },
      {
        subject_id: '00000000-0000-0000-0000-000000000001',
        subject_kind: 'SPELL',
        owner_user_id: 'user-1',
        system_id: 'system-1',
        label: 'Harm',
        is_master: false,
        has_draft: true,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.123456Z'
      },
      { is_current: true }
    )

    const draft = await createAuthoredContentRepository(db).lockDraftForActivation({
      subjectKind: 'SPELL',
      subjectId: '00000000-0000-0000-0000-000000000001',
      userId: 'user-1'
    })

    expect(draft.baseActiveUpdatedAt).toBe('2026-01-02T00:00:00.123Z')
    expect(sqlState.statements[2]).toContain('is not distinct from')
    expect(sqlState.statements[2]).toContain('select root.updated_at')
  })
})

describe('authored import reference repository', () => {
  beforeEach(() => {
    sqlState.statements.length = 0
    sqlState.rows.length = 0
    sqlState.row = {}
  })

  it('upserts an exact user, source, kind, and external identity mapping', async () => {
    sqlState.row = {
      user_id: 'user-1',
      source: 'DND_BEYOND',
      subject_kind: 'CHARACTER',
      external_id: '74476867',
      subject_id: '00000000-0000-0000-0000-000000000001',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z'
    }

    const saved = await createAuthoredImportRefRepository(db).upsert({
      userId: 'user-1',
      source: 'DND_BEYOND',
      subjectKind: 'CHARACTER',
      externalId: '74476867',
      subjectId: '00000000-0000-0000-0000-000000000001'
    })

    expect(saved).toMatchObject({
      externalId: '74476867',
      subjectId: '00000000-0000-0000-0000-000000000001'
    })
    expect(sqlState.statements[0]).toContain(
      'on conflict (user_id, source, subject_kind, external_id) do update'
    )
  })
})
