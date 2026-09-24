import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { v } from 'convex/values'

const require = createRequire(import.meta.url)
const root = dirname(require.resolve('convex/package.json'))
const helper = 'cli/codegen_templates/validator_helpers.js'
const generators = [
  require(join(root, 'dist/cjs', helper)),
  await import(pathToFileURL(join(root, 'dist/esm', helper)).href)
]

for (const { validatorToType } of generators) {
  assert.equal(validatorToType(v.union().json, false), 'never')
  assert.equal(validatorToType(v.array(v.union()).json, false), 'Array<never>')
  assert.equal(
    validatorToType(v.record(v.string(), v.union()).json, false),
    'Record<string, never>'
  )
  assert.equal(validatorToType(v.union(v.string(), v.number()).json, false), 'string | number')
}
console.log('Static API generators preserve never and ordinary union types.')
