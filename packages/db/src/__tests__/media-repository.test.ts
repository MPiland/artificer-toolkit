import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const source = await readFile(
  new URL('../domains/subjects/repositories/media.ts', import.meta.url),
  'utf8'
)

describe('media repository cleanup contracts', () => {
  it('returns the conflicting idempotency row and serializes owner accounting', () => {
    expect(source).toContain('on conflict (owner_user_id, idempotency_key) do update')
    expect(source).toContain('select id from profiles where id = ${userId}::uuid for update')
  })

  it('does not clean referenced ready media and ages it from the last detach', () => {
    expect(source).toContain("asset.unreferenced_at < now() - interval '24 hours'")
    expect(source).toContain('not exists (select 1 from profiles where avatar_asset_id = asset.id)')
    expect(source).toContain(
      'not exists (select 1 from characters where portrait_asset_id = asset.id)'
    )
    expect(source).toContain(
      'not exists (select 1 from authored_image_slots where asset_id = asset.id)'
    )
    expect(source).toContain('select 1 from campaign_live_scenes scene')
    expect(source).not.toContain('select 1 from encounter_scenes scene')
    expect(source).toContain('with claimed as')
    expect(source).toContain("set status = 'DELETED'")
  })

  it('reserves the profile upload limit for every unfinished upload', () => {
    expect(source).toContain(
      "asset.status in ('PENDING_UPLOAD', 'PROCESSING') then case when asset.profile = 'VTT_MAP' then 26214400 else 6291456 end"
    )
  })

  it('enforces actual processed bytes under the owner lock', () => {
    expect(source).toContain('input.reservationBytes + variantBytes')
    expect(source).toContain('input.quotaBytes')
    expect(source).toContain('(previous?.byte_size ?? 0) + variant.byte_size')
  })

  it('keeps replacement objects queued until their metadata is committed', () => {
    expect(source).toContain('insert into media_object_deletions (object_key)')
    expect(source).toContain(
      'delete from media_object_deletions where object_key = ${variant.object_key}'
    )
    expect(source).toContain("created_at < now() - interval '15 minutes'")
  })
})
