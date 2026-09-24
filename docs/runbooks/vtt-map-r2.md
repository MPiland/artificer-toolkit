# VTT map R2

## Current storage boundary

Convex owns media authorization, metadata, quota, object keys, processing state and cleanup. Cloudflare
R2 stores private objects. The browser receives a short-lived signed single-`PUT` URL whose
`Content-Length` and `Content-Type` match the authorized upload. It never receives R2 credentials.

### Local correctness

Use the existing local R2 substitute with:

```text
MEDIA_STORAGE_MODE=local
CONVEX_SITE_URL=http://127.0.0.1:3211
LOCAL_R2_ENDPOINT=http://127.0.0.1:8026
VITE_MEDIA_STORAGE_ORIGIN=http://127.0.0.1:8026
```

Both server endpoints must be loopback origins. Local mode deliberately ignores managed R2
credentials. Restart the web development server after changing `VITE_MEDIA_STORAGE_ORIGIN` because it
also supplies the exact CSP `connect-src` and `img-src` origin.

### Managed environments

Use a separate private bucket and bucket-scoped **Object Read & Write** credential for staging and
production. Configure the Convex deployment with:

```text
MEDIA_STORAGE_MODE=r2
CONVEX_SITE_URL=https://<deployment>.convex.site
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_BUCKET=<private-bucket-name>
R2_ACCESS_KEY_ID=<bucket-scoped-access-key-id>
R2_SECRET_ACCESS_KEY=<bucket-scoped-secret>
```

Set `VITE_MEDIA_STORAGE_ORIGIN` on the web deployment to the exact origin used by signed R2 URLs.
Keep the bucket private and do not attach a public custom domain. Never expose any credential through
a `VITE_` variable.

### CORS

Allow only the exact web origins that use the bucket, methods `GET` and `PUT`, request header `Content-Type` and response header `ETag`. Preserve existing rules when adding an
origin. Inspect the current policy before changing it:

```text
wrangler r2 bucket cors list <bucket-name>
```

Wrangler's `cors set --file` input uses a `rules` object. Follow Cloudflare's current
[R2 CORS format](https://developers.cloudflare.com/r2/buckets/cors/) and verify an `OPTIONS` request
with the real origin, method and headers before the signed upload.

### Verification

Complete local media correctness first. In the authorized managed smoke:

1. Confirm the target Convex deployment and private bucket names.
2. Create a VTT map upload through the product, perform the signed single `PUT`, and save the map.
3. Open the resulting signed delivery URL as an authorized Campaign member and verify another account
   cannot obtain it.
4. Replace or delete the map and confirm the scheduled cleanup removes unreferenced objects after its
   safety window.
5. Record only aggregate results, object counts and HTTP status; do not record signed URLs or secrets.

The upload URL lasts at most 15 minutes. Convex schedules cleanup after the upload and processing
window, so an interrupted upload does not leave a permanent reservation.

## Historical deployment path

The retired Netlify/Supabase path used different `R2_*` names and multipart uploads. Those variables,
multipart cleanup instructions and Supabase fixtures are historical and must not be used for a current
deployment.
