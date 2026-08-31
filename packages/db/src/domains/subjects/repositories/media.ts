import { sql } from 'kysely'
import type { DBLike } from '#types'
import { withTransaction } from '../../../utils/index.js'

export type MediaAssetRow = {
  id: string
  owner_user_id: string
  profile: string
  target_key: string
  status: string
  original_file_name: string
  declared_mime_type: string
  declared_bytes: number
  raw_object_key: string
  verified_mime_type: string | null
  verified_bytes: number | null
  width: number | null
  height: number | null
  crop_x: number | string | null
  crop_y: number | string | null
  crop_width: number | string | null
  crop_height: number | string | null
  rejection_reason: string | null
  processing_started_at: Date | string | null
  ready_at: Date | string | null
  created_at: Date | string
  updated_at: Date | string
}

export type MediaVariantRow = {
  id: string
  asset_id: string
  kind: string
  object_key: string
  mime_type: string
  byte_size: number
  width: number | null
  height: number | null
}

export type VttMapTileRow = {
  asset_id: string
  byte_size: number
  column_index: number
  height: number
  object_key: string
  row_index: number
  width: number
}

export type AuthoredImageSlotRow = {
  subject_kind: string
  subject_id: string
  scope: string
  asset_id: string | null
  alt_text: string | null
  is_decorative: boolean
}

export function createMediaRepository(db: DBLike) {
  return {
    async findById(assetId: string): Promise<MediaAssetRow | null> {
      const result =
        await sql<MediaAssetRow>`select * from media_assets where id = ${assetId}::uuid`.execute(db)
      return result.rows[0] ?? null
    },

    async findByIdForUpdate(assetId: string): Promise<MediaAssetRow | null> {
      const result = await sql<MediaAssetRow>`
        select * from media_assets where id = ${assetId}::uuid for update
      `.execute(db)
      return result.rows[0] ?? null
    },

    async findByOwnerAndKey(
      ownerUserId: string,
      idempotencyKey: string
    ): Promise<MediaAssetRow | null> {
      const result = await sql<MediaAssetRow>`
        select * from media_assets
        where owner_user_id = ${ownerUserId}::uuid and idempotency_key = ${idempotencyKey}::uuid
      `.execute(db)
      return result.rows[0] ?? null
    },

    async createPending(input: {
      id: string
      ownerUserId: string
      profile: string
      originalFileName: string
      declaredMimeType: string
      declaredBytes: number
      idempotencyKey: string
      rawObjectKey: string
      targetKey: string
    }): Promise<MediaAssetRow> {
      const result = await sql<MediaAssetRow>`
        insert into media_assets (
          id, owner_user_id, profile, original_file_name, declared_mime_type, declared_bytes,
          idempotency_key, raw_object_key, target_key
        ) values (
          ${input.id}::uuid, ${input.ownerUserId}::uuid, ${input.profile}, ${input.originalFileName},
          ${input.declaredMimeType}, ${input.declaredBytes}, ${input.idempotencyKey}::uuid,
          ${input.rawObjectKey}, ${input.targetKey}
        ) on conflict (owner_user_id, idempotency_key) do update
          set updated_at = media_assets.updated_at
        returning *
      `.execute(db)
      const asset = result.rows[0]
      if (!asset) throw new Error('Failed to create media asset.')
      return asset
    },

    async lockOwner(userId: string): Promise<boolean> {
      const result = await sql<{
        id: string
      }>`select id from profiles where id = ${userId}::uuid for update`.execute(db)
      return Boolean(result.rows[0])
    },

    async usageBytes(ownerUserId: string): Promise<number> {
      const result = await sql<{ total: string | number }>`
        select coalesce(sum(case when asset.status in ('PENDING_UPLOAD', 'PROCESSING') then case when asset.profile = 'VTT_MAP' then 26214400 else 6291456 end else 0 end), 0)
          + coalesce((select sum(variant.byte_size) from media_variants variant
              join media_assets owned on owned.id = variant.asset_id
              where owned.owner_user_id = ${ownerUserId}::uuid and owned.status = 'READY'), 0)
          + coalesce((select sum(tile.byte_size) from vtt_map_tiles tile
              join media_assets owned on owned.id = tile.asset_id
              where owned.owner_user_id = ${ownerUserId}::uuid and owned.status = 'READY'), 0) as total
        from media_assets asset where asset.owner_user_id = ${ownerUserId}::uuid
      `.execute(db)
      return Number(result.rows[0]?.total ?? 0)
    },

    async claimForProcessing(assetId: string, ownerUserId: string): Promise<MediaAssetRow | null> {
      const result = await sql<MediaAssetRow>`
        update media_assets
        set status = 'PROCESSING', processing_started_at = now(), updated_at = now()
        where id = ${assetId}::uuid and owner_user_id = ${ownerUserId}::uuid
          and (status = 'PENDING_UPLOAD' or (status = 'PROCESSING' and processing_started_at < now() - interval '5 minutes'))
        returning *
      `.execute(db)
      return result.rows[0] ?? null
    },

    async replaceReady(input: {
      assetId: string
      ownerUserId: string
      quotaBytes: number
      reservationBytes: number
      verifiedMimeType: string
      verifiedBytes: number
      width: number | null
      height: number | null
      variants: readonly Omit<MediaVariantRow, 'asset_id'>[]
      vttMapTiles?: readonly Omit<VttMapTileRow, 'asset_id'>[]
    }): Promise<boolean> {
      return withTransaction(db, async (trx) => {
        const owner = await sql<{ id: string }>`
          select id from profiles where id = ${input.ownerUserId}::uuid for update
        `.execute(trx)
        if (!owner.rows[0]) return false
        const usage = await sql<{ total: string | number }>`
          select coalesce(sum(case when asset.status in ('PENDING_UPLOAD', 'PROCESSING') then case when asset.profile = 'VTT_MAP' then 26214400 else 6291456 end else 0 end), 0)
            + coalesce((select sum(variant.byte_size) from media_variants variant
                join media_assets owned on owned.id = variant.asset_id
                where owned.owner_user_id = ${input.ownerUserId}::uuid and owned.status = 'READY'), 0)
            + coalesce((select sum(tile.byte_size) from vtt_map_tiles tile
                join media_assets owned on owned.id = tile.asset_id
                where owned.owner_user_id = ${input.ownerUserId}::uuid and owned.status = 'READY'), 0) as total
          from media_assets asset where asset.owner_user_id = ${input.ownerUserId}::uuid
        `.execute(trx)
        const variantBytes = input.variants.reduce((total, variant) => total + variant.byte_size, 0)
        const tileBytes = (input.vttMapTiles ?? []).reduce(
          (total, tile) => total + tile.byte_size,
          0
        )
        if (
          Number(usage.rows[0]?.total ?? 0) - input.reservationBytes + variantBytes + tileBytes >
          input.quotaBytes
        )
          return false
        await sql`
          insert into media_object_deletions (object_key)
          select object_key from media_variants where asset_id = ${input.assetId}::uuid
          on conflict (object_key) do nothing
        `.execute(trx)
        await sql`delete from media_variants where asset_id = ${input.assetId}::uuid`.execute(trx)
        await sql`
          insert into media_object_deletions (object_key)
          select object_key from vtt_map_tiles where asset_id = ${input.assetId}::uuid
          on conflict (object_key) do nothing
        `.execute(trx)
        await sql`delete from vtt_map_tiles where asset_id = ${input.assetId}::uuid`.execute(trx)
        for (const variant of input.variants)
          await sql`
          insert into media_variants (id, asset_id, kind, object_key, mime_type, byte_size, width, height)
          values (${variant.id}::uuid, ${input.assetId}::uuid, ${variant.kind}, ${variant.object_key},
            ${variant.mime_type}, ${variant.byte_size}, ${variant.width}, ${variant.height})
        `.execute(trx)
        for (const tile of input.vttMapTiles ?? [])
          await sql`
            insert into vtt_map_tiles (
              asset_id, row_index, column_index, object_key, byte_size, width, height
            ) values (
              ${input.assetId}::uuid, ${tile.row_index}, ${tile.column_index},
              ${tile.object_key}, ${tile.byte_size}, ${tile.width}, ${tile.height}
            )
          `.execute(trx)
        for (const variant of input.variants)
          await sql`
            delete from media_object_deletions where object_key = ${variant.object_key}
          `.execute(trx)
        const updated = await sql<{
          id: string
        }>`update media_assets set status = 'READY', verified_mime_type = ${input.verifiedMimeType},
          verified_bytes = ${input.verifiedBytes}, width = ${input.width}, height = ${input.height},
          ready_at = now(), unreferenced_at = now(), processing_started_at = null, updated_at = now()
          where id = ${input.assetId}::uuid and status = 'PROCESSING'
          returning id`.execute(trx)
        if (!updated.rows[0]) throw new Error('Media asset is no longer processing.')
        await sql`
          insert into media_object_deletions (object_key)
          select raw_object_key from media_assets where id = ${input.assetId}::uuid
          on conflict (object_key) do nothing
        `.execute(trx)
        for (const tile of input.vttMapTiles ?? [])
          await sql`
            delete from media_object_deletions where object_key = ${tile.object_key}
          `.execute(trx)
        return true
      })
    },

    async reject(assetId: string, reason: string): Promise<void> {
      await sql`
        update media_assets set status = 'REJECTED', rejection_reason = ${reason},
          processing_started_at = null, updated_at = now()
        where id = ${assetId}::uuid
      `.execute(db)
    },

    async resetPending(assetId: string): Promise<void> {
      await sql`
        update media_assets set status = 'PENDING_UPLOAD', processing_started_at = null, updated_at = now()
        where id = ${assetId}::uuid and status = 'PROCESSING'
      `.execute(db)
    },

    async findVariant(assetId: string, kind: string): Promise<MediaVariantRow | null> {
      const result = await sql<MediaVariantRow>`
        select * from media_variants where asset_id = ${assetId}::uuid and kind = ${kind}
      `.execute(db)
      return result.rows[0] ?? null
    },

    async listVttMapTiles(assetId: string): Promise<VttMapTileRow[]> {
      const result = await sql<VttMapTileRow>`
        select asset_id, row_index, column_index, object_key, byte_size, width, height
        from vtt_map_tiles where asset_id = ${assetId}::uuid
        order by row_index asc, column_index asc
      `.execute(db)
      return result.rows
    },

    async replaceThumbnail(
      assetId: string,
      ownerUserId: string,
      quotaBytes: number,
      variant: Omit<MediaVariantRow, 'asset_id'>
    ): Promise<{ previousObjectKey: string | null } | null> {
      if (!(await this.lockOwner(ownerUserId))) return null
      const previous = await this.findVariant(assetId, 'THUMBNAIL')
      if (
        (await this.usageBytes(ownerUserId)) - (previous?.byte_size ?? 0) + variant.byte_size >
        quotaBytes
      )
        return null
      if (previous)
        await sql`
          insert into media_object_deletions (object_key) values (${previous.object_key})
          on conflict (object_key) do nothing
        `.execute(db)
      await sql`delete from media_variants where asset_id = ${assetId}::uuid and kind = 'THUMBNAIL'`.execute(
        db
      )
      await sql`
        insert into media_variants (id, asset_id, kind, object_key, mime_type, byte_size, width, height)
        values (${variant.id}::uuid, ${assetId}::uuid, 'THUMBNAIL', ${variant.object_key}, ${variant.mime_type},
          ${variant.byte_size}, ${variant.width}, ${variant.height})
      `.execute(db)
      await sql`delete from media_object_deletions where object_key = ${variant.object_key}`.execute(
        db
      )
      return { previousObjectKey: previous?.object_key ?? null }
    },

    async scheduleObjectDeletions(objectKeys: readonly string[]): Promise<void> {
      for (const objectKey of new Set(objectKeys))
        await sql`
          insert into media_object_deletions (object_key) values (${objectKey})
          on conflict (object_key) do nothing
        `.execute(db)
    },

    async completeObjectDeletions(objectKeys: readonly string[]): Promise<void> {
      const uniqueKeys = [...new Set(objectKeys)]
      if (uniqueKeys.length === 0) return
      await sql`delete from media_object_deletions where object_key = any(${uniqueKeys})`.execute(
        db
      )
    },

    async listObjectDeletions(limit = 100): Promise<string[]> {
      const result = await sql<{ object_key: string }>`
        select object_key from media_object_deletions
        where created_at < now() - interval '15 minutes'
        order by created_at limit ${limit}
      `.execute(db)
      return result.rows.map((row) => row.object_key)
    },

    async setCrop(
      assetId: string,
      crop: { x: number; y: number; width: number; height: number }
    ): Promise<void> {
      await sql`update media_assets set crop_x = ${crop.x}, crop_y = ${crop.y}, crop_width = ${crop.width}, crop_height = ${crop.height}, updated_at = now() where id = ${assetId}::uuid`.execute(
        db
      )
    },

    async setAccountAvatar(userId: string, assetId: string | null): Promise<void> {
      await db
        .updateTable('profiles')
        .set({ avatar_asset_id: assetId })
        .where('id', '=', userId)
        .execute()
    },

    async setCharacterPortrait(
      userId: string,
      characterId: string,
      assetId: string | null
    ): Promise<boolean> {
      const result = await db
        .updateTable('characters')
        .set({ portrait_asset_id: assetId })
        .where('id', '=', characterId)
        .where('user_id', '=', userId)
        .executeTakeFirst()
      return Number(result.numUpdatedRows) > 0
    },

    async getAuthoredSlot(
      subjectKind: string,
      subjectId: string,
      scope: string
    ): Promise<AuthoredImageSlotRow | null> {
      const result =
        await sql<AuthoredImageSlotRow>`select * from authored_image_slots where subject_kind = ${subjectKind} and subject_id = ${subjectId}::uuid and scope = ${scope}`.execute(
          db
        )
      return result.rows[0] ?? null
    },

    async upsertAuthoredSlot(input: AuthoredImageSlotRow): Promise<void> {
      await sql`
        insert into authored_image_slots (subject_kind, subject_id, scope, asset_id, alt_text, is_decorative)
        values (${input.subject_kind}, ${input.subject_id}::uuid, ${input.scope}, ${input.asset_id}::uuid,
          ${input.alt_text}, ${input.is_decorative})
        on conflict (subject_kind, subject_id, scope) do update set
          asset_id = excluded.asset_id, alt_text = excluded.alt_text,
          is_decorative = excluded.is_decorative, updated_at = now()
      `.execute(db)
    },

    async deleteAuthoredSlot(subjectKind: string, subjectId: string, scope: string): Promise<void> {
      await sql`delete from authored_image_slots where subject_kind = ${subjectKind} and subject_id = ${subjectId}::uuid and scope = ${scope}`.execute(
        db
      )
    },

    async claimCleanupObjects(
      userId: string
    ): Promise<{ assetId: string; rawObjectKey: string; objectKeys: string[] }[]> {
      const result = await sql<{ asset_id: string; raw_object_key: string; object_keys: string[] }>`
        with claimed as (
          update media_assets asset
          set status = 'DELETED', deleted_at = coalesce(asset.deleted_at, now()), updated_at = now()
          where asset.owner_user_id = ${userId}::uuid
            and (
              asset.status = 'DELETED'
              or (asset.status = 'PENDING_UPLOAD' and asset.created_at < now() - interval '24 hours')
              or (
                asset.status = 'PROCESSING'
                and coalesce(asset.processing_started_at, asset.created_at) < now() - interval '24 hours'
              )
              or (
                asset.status = 'READY'
                and asset.unreferenced_at < now() - interval '24 hours'
                and not exists (select 1 from profiles where avatar_asset_id = asset.id)
                and not exists (select 1 from characters where portrait_asset_id = asset.id)
                and not exists (select 1 from authored_image_slots where asset_id = asset.id)
                and not exists (
                  select 1 from campaign_scene_definitions definition
                  where definition.definition #>> '{map,assetId}' = asset.id::text
                )
                and not exists (
                  select 1 from campaign_live_scenes scene
                  where scene.definition_snapshot #>> '{map,assetId}' = asset.id::text
                    or scene.projection #>> '{map,assetId}' = asset.id::text
                )
              )
              or (asset.status = 'REJECTED' and asset.updated_at < now() - interval '7 days')
            )
          returning asset.id, asset.raw_object_key
        )
        select claimed.id as asset_id, claimed.raw_object_key,
          coalesce(array_agg(distinct variant.object_key) filter (where variant.object_key is not null), '{}')
            || coalesce(array_agg(distinct tile.object_key) filter (where tile.object_key is not null), '{}') as object_keys
        from claimed
        left join media_variants variant on variant.asset_id = claimed.id
        left join vtt_map_tiles tile on tile.asset_id = claimed.id
        group by claimed.id, claimed.raw_object_key
      `.execute(db)
      return result.rows.map((row) => ({
        assetId: row.asset_id,
        rawObjectKey: row.raw_object_key,
        objectKeys: row.object_keys
      }))
    },

    async deleteAsset(assetId: string): Promise<void> {
      await sql`delete from media_assets where id = ${assetId}::uuid`.execute(db)
    }
  }
}
