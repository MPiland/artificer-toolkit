import { getAuthTables } from 'better-auth/db'
import { convexTest } from 'convex-test'
import { expect, it } from 'vitest'
import { createAuthOptions } from '../authFactory.helper'
import schema from '../schema'
import { createAuthAdapterOptions } from './options'

it('preserves complete HTTP auth table metadata in the official component adapter', async () => {
  const t = convexTest(schema, import.meta.glob('../**/*.*s'))
  await t.run(async (ctx) => {
    const adapterTables = getAuthTables(createAuthAdapterOptions())
    const httpTables = getAuthTables(createAuthOptions(ctx))
    const serialize = (value: unknown) =>
      JSON.stringify(value, (_key, field: unknown) =>
        typeof field === 'function' ? String(field) : field
      )
    expect(serialize(adapterTables)).toBe(serialize(httpTables))
    expect(Object.keys(adapterTables).sort()).toEqual([
      'account',
      'jwks',
      'rateLimit',
      'session',
      'user',
      'verification'
    ])
    for (const [model, field] of [
      ['user', 'email'],
      ['user', 'username'],
      ['session', 'token'],
      ['rateLimit', 'key']
    ] as const)
      expect(adapterTables[model].fields[field].unique).toBe(true)
  })
})
