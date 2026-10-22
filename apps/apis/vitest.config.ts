import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { defineConfig } from 'vitest/config'
import { BaseSequencer, type TestSpecification } from 'vitest/node'
import { DURATIONS_FILE, longestFirst, shardPaths } from '../../scripts/convexShards.mjs'
import { inlineWorkspacePackages, sourceResolve } from '../../scripts/vitestSource.mjs'

const durations: Record<string, number> = JSON.parse(readFileSync(DURATIONS_FILE, 'utf8'))

/**
 * Shards by recorded file duration instead of path hash, and runs each shard's files longest first so
 * parallel workers finish together (scripts/convexShards.mjs).
 */
class DurationSequencer extends BaseSequencer {
  private path(spec: TestSpecification) {
    return relative(this.ctx.config.root, spec.moduleId).replaceAll('\\', '/')
  }

  override async shard(files: TestSpecification[]) {
    const { shard } = this.ctx.config
    if (!shard) return files
    const paths = new Set(
      shardPaths(
        files.map((spec) => this.path(spec)),
        durations,
        shard.count,
        shard.index
      )
    )
    return files.filter((spec) => paths.has(this.path(spec)))
  }

  override async sort(files: TestSpecification[]) {
    const rank = new Map(
      longestFirst(
        files.map((spec) => this.path(spec)),
        durations
      ).map((path, index) => [path, index])
    )
    return files.toSorted((a, b) => (rank.get(this.path(a)) ?? 0) - (rank.get(this.path(b)) ?? 0))
  }
}

export default defineConfig({
  ...sourceResolve,
  test: {
    allowOnly: false,
    environment: 'edge-runtime',
    // The first fixture lazily transforms the backend and auth component modules.
    testTimeout: 30_000,
    env: {
      // The product's local modes (ADR 0035): scheduled jobs find a configured provider, not a throw.
      MEDIA_STORAGE_MODE: 'local',
      CONVEX_SITE_URL: 'http://127.0.0.1:3221',
      MAIL_DELIVERY_MODE: 'local',
      LOCAL_EMAIL_SINK_URL: 'http://127.0.0.1:8025/messages',
      LIVE_SESSION_WORKER_URL: 'http://127.0.0.1:8787',
      LIVE_SESSION_WORKER_SECRET: 'test-live-session-worker-secret-long-enough'
    },
    include: ['apps/apis/convex/**/*.test.ts'],
    setupFiles: ['apps/apis/tests/convexTest.ts', 'apps/apis/tests/localServices.ts'],
    server: {
      deps: {
        inline: [
          ...inlineWorkspacePackages,
          'convex-test',
          '@convex-dev/migrations',
          '@convex-dev/better-auth',
          '@convex-dev/resend',
          '@convex-dev/r2',
          '@convex-dev/action-retrier',
          '@convex-dev/rate-limiter',
          '@convex-dev/batch-worker'
        ]
      }
    },
    sequence: { sequencer: DurationSequencer },
    fileParallelism: false,
    maxWorkers: 1
  }
})
