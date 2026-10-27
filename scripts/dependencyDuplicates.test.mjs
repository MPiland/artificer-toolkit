import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const lockfile = readFileSync(join(import.meta.dirname, '..', 'yarn.lock'), 'utf8')

/** Versions of `name` that yarn.lock installs, one per resolved lockfile entry. */
const installedVersions = (name) =>
  [...lockfile.matchAll(new RegExp(`^"?${name}@npm:[^\n]*:\n  version: (\\S+)`, 'gm'))].map(
    ([, version]) => version
  )

describe('yarn.lock', () => {
  it('installs a single prosemirror-model, which TipTap needs to wrap and split nodes', () => {
    expect(installedVersions('prosemirror-model')).toHaveLength(1)
  })
})
