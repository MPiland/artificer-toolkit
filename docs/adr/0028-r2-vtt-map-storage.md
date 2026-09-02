# ADR 0028: R2 storage for VTT maps

- **Status:** decision
- **Date:** 2026-09-02

## Context

VTT maps are larger and read more frequently than ordinary product media. Keeping their originals, generated variants, and renderer tiles in Supabase Storage would make VTT traffic consume Supabase egress while Cloudflare R2 provides the required S3-compatible private object storage without egress charges.

## Decision

Supabase Postgres remains authoritative for media identity, ownership, lifecycle, references, quotas, and deletion work. New `VTT_MAP` rows persist `storage_provider = 'R2'`; ordinary media remains `SUPABASE`. Existing Supabase-backed maps remain readable and are not migrated.

The API creates and completes one bounded R2 multipart upload. Browsers receive only short-lived, part-specific signed URLs and return R2 ETags. Server processing and authorized delivery use the persisted provider. Deletion work is keyed by provider plus object key. No Worker, proxy, public bucket, or generic provider framework is introduced.

Staging and production use separate private buckets and bucket-scoped credentials in their existing deployment contexts. Local integration uses a loopback substitute and cannot contact managed storage.

## Consequences

- Scene and Encounter records keep stable media asset IDs; they do not know the provider.
- R2 credentials remain server-only, and bucket CORS exposes `ETag` for browser multipart completion.
- Cross-provider copying, public delivery, storage-class automation, and migration of existing maps remain out of scope.
