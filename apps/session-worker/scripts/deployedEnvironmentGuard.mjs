import { fileURLToPath } from 'node:url'

import { experimental_readRawConfig } from 'wrangler'

/**
 * `isLocalDevelopment` (src/contentSnapshotStorage.ts) treats this variable as proof of a local
 * workerd, and it enables the meter, checkpoint-barrier and test-rolls routes. No Wrangler
 * configuration level may define it: the top level is production, every `env` entry is a deployed
 * environment, and local development gets it only from the test fixtures' bindings.
 */
export const LOCAL_MARKER = 'LOCAL_CONTENT_SNAPSHOT_ORIGIN'

function levelViolations(label, level) {
  const violations = []
  if (level.vars && Object.hasOwn(level.vars, LOCAL_MARKER)) {
    violations.push(`${label} sets ${LOCAL_MARKER} in vars.`)
  }
  const secrets = level.secrets
  if (secrets?.required?.includes(LOCAL_MARKER)) {
    violations.push(`${label} requires ${LOCAL_MARKER} as a secret.`)
  }
  return violations
}

/** Returns one message per place where a parsed Wrangler configuration defines the local marker. */
export function findLocalMarkerViolations(config) {
  return [
    ...levelViolations('The top-level (production) configuration', config),
    ...Object.entries(config.env ?? {}).flatMap(([name, level]) =>
      levelViolations(`Environment "${name}"`, level)
    )
  ]
}

/** Reads the file exactly as `wrangler deploy` does. */
export function readWranglerConfig(path) {
  return experimental_readRawConfig({ config: path }).rawConfig
}

export const defaultConfigPath = fileURLToPath(new URL('../wrangler.jsonc', import.meta.url))
