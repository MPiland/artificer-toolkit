import {
  LOCAL_MARKER,
  defaultConfigPath,
  findLocalMarkerViolations,
  readWranglerConfig
} from './deployedEnvironmentGuard.mjs'

const path = process.argv[2] ?? defaultConfigPath
const violations = findLocalMarkerViolations(readWranglerConfig(path))
if (violations.length > 0) {
  console.error(`${violations.join('\n')}\nDeployed Workers must never carry ${LOCAL_MARKER}.`)
  process.exit(1)
}
console.info(`No deployed Worker environment in ${path} defines ${LOCAL_MARKER}.`)
