// @vitest-environment node
import { globSync, readFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { join } from 'node:path'
import { expect, it } from 'vitest'

// The Convex plugin's lint hook rejects any edit to a `convex/*.ts` file that imports a Node builtin,
// test files included. convex-test function tests therefore use web-standard globals, and a Node-only
// step lives in a helper or a repo-level check under `apps/apis/tests/`.
const convexDirectory = join(import.meta.dirname, '../convex')
const builtins = new Set(builtinModules)
const specifier =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*|\bvi\.(?:mock|doMock|importActual)\s*\(\s*)(['"])([^'"]+)\1/g

it('keeps Node builtin imports out of every convex test file', () => {
  const offenders = globSync('**/*.test.ts', { cwd: convexDirectory }).flatMap((file) =>
    [...readFileSync(join(convexDirectory, file), 'utf8').matchAll(specifier)]
      .map((match) => match[2]!)
      .filter((name) => name.startsWith('node:') || builtins.has(name))
      .map((name) => `${file}: ${name}`)
  )
  expect(offenders).toEqual([])
})

it('recognises prefixed and bare builtin specifiers', () => {
  const found = [
    "import { a } from 'node:crypto'",
    "import b from 'fs'",
    "const c = await import('fs/promises')",
    "import 'zlib'"
  ].flatMap((line) => [...line.matchAll(specifier)].map((match) => match[2]!))
  expect(found.every((name) => name.startsWith('node:') || builtins.has(name))).toBe(true)
  expect(found).toHaveLength(4)
})
