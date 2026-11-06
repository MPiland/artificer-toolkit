import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { authSchemaOutput, generateAuthSchema } from './authSchemaCodegen.mjs'

let directory

afterEach(() => {
  if (directory) rmSync(directory, { force: true, recursive: true })
})

// The lifecycle's generated-parity stage fails unless the auth-codegen stage reproduces the committed file.
it('generates the committed Better Auth schema byte for byte', () => {
  directory = mkdtempSync(join(tmpdir(), 'auth-schema-'))
  const output = join(directory, 'schema.ts')

  generateAuthSchema(output)

  const committed = readFileSync(
    resolve(import.meta.dirname, '../apps/apis', authSchemaOutput),
    'utf8'
  )
  expect(readFileSync(output, 'utf8')).toBe(committed)
}, 180_000)
