# ADR 0028: R2 storage for VTT maps

- **Status:** decision — R2 byte storage retained; Supabase metadata and provider split superseded by [ADR 0029](0029-convex-backend-cutover.md)
- **Date:** 2026-09-02

## Context

VTT maps are larger and read more frequently than ordinary product media. Keeping their originals, generated variants, and renderer tiles in Supabase Storage would make VTT traffic consume Supabase egress while Cloudflare R2 provides the required S3-compatible private object storage without egress charges.

## Decision

Convex is authoritative for media identity, ownership, lifecycle, references, quotas, and deletion work. R2 stores product media bytes under ADR 0029. The former `storage_provider` split between R2 maps and Supabase ordinary media is historical migration context.

Convex creates one bounded upload and returns a short-lived signed single-`PUT` URL whose content length and type match the authorized request. The browser returns the R2 ETag; Convex retains authoritative metadata and schedules cleanup by object key. No Worker, proxy, public bucket, multipart lifecycle, or generic provider framework is introduced.

Staging and production use separate private buckets and bucket-scoped credentials in their existing deployment contexts. Local integration uses a loopback substitute and cannot contact managed storage.

## Consequences

- Scene and Encounter records keep stable media asset IDs; they do not know the provider.
- R2 credentials remain server-only, and bucket CORS exposes `ETag` for browser multipart completion.
- Public delivery, storage-class automation, and migration of historical objects remain out of scope.
