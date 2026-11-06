// Generates the Better Auth component schema (apps/apis/convex/betterAuth/schema.ts) in its committed
// form, so the lifecycle's generated-artifact parity check compares like with like. The generator
// writes unformatted code and puts its resolved, machine-specific output path into the header comment;
// the committed file is oxfmt-formatted and names the project-relative path.
//   node scripts/authSchemaCodegen.mjs   (yarn workspace @artificer-toolkit/apis codegen:auth)
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { yarnSpawn } from './convexSelfHosted.mjs'

const root = resolve(import.meta.dirname, '..')
const apis = resolve(root, 'apps/apis')
export const authSchemaOutput = 'convex/betterAuth/schema.ts'

function yarn(args, cwd) {
  const [executable, spawnArgs] = yarnSpawn(args)
  const result = spawnSync(executable, spawnArgs, { cwd, shell: false, stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`yarn ${args.join(' ')} failed (exit ${result.status}).`)
}

/** Writes the schema to `output` (relative to apps/apis), byte for byte as it is committed. */
export function generateAuthSchema(output = authSchemaOutput) {
  const path = resolve(apis, output)
  yarn(['auth', 'generate', '--config', 'better-auth.config.ts', '--output', output, '--yes'], apis)
  const generated = readFileSync(path, 'utf8')
  writeFileSync(path, generated.replace(`--output ${path}`, `--output ${authSchemaOutput}`))
  yarn(['oxfmt', '--config', resolve(root, '.oxfmtrc.jsonc'), path], root)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) generateAuthSchema()
