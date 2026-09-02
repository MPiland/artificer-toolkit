# VTT map R2

Use two private buckets in one Cloudflare account:

- `artificer-toolkit-vtt-staging`
- `artificer-toolkit-vtt-production`

Create one R2 Account API token per bucket with **Object Read & Write**, restricted to that bucket. Retain the Access Key ID and Secret Access Key when Cloudflare displays them.

Set these server-only variables in each Netlify deployment context:

```text
R2_ACCOUNT_ID=<Cloudflare account ID>
R2_ACCESS_KEY_ID=<bucket-scoped access key ID>
R2_SECRET_ACCESS_KEY=<bucket-scoped secret access key>
R2_VTT_MAP_BUCKET=<bucket name for this deployment context>
```

Never use a `VITE_` prefix. `R2_S3_ENDPOINT` is optional for Cloudflare and should remain unset. Automated local tests use either the loopback R2 substitute or the legacy local Supabase fixture and need no R2 credentials. A manually running local app may use the staging bucket by placing the same four values in the ignored root `.env.local`.

Apply this CORS policy to each bucket, replacing the example origins with the exact local, staging, and production origins that should use that bucket:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://staging.example.com",
      "https://example.com"
    ],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Keep the bucket private and do not attach a public custom domain. R2 aborts incomplete multipart uploads after seven days by default; application cleanup attempts an earlier abort after 24 hours.

Local correctness must be green before managed verification. Staging verifies only the real R2 credentials, CORS, multipart behavior, managed Supabase/Netlify connections, and performance.
