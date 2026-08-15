import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  createSrdSeedSourceConfig,
  stageSrdSeedSourceWorkdir
} from '../scripts/manageSrdSeedSource.js'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  )
})

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'artificer-srd-seed-source-'))
  temporaryDirectories.push(directory)
  return directory
}

const config = `project_id = "artificer-toolkit"

[api]
port = 54321

[db.seed]
enabled = true
sql_paths = ["./seed.sql"]
`

describe('SRD seed-source workspace', () => {
  it('uses a distinct Supabase project and disables the staged SQL seed', () => {
    expect(createSrdSeedSourceConfig(config, 'isolated-source')).toContain(
      'project_id = "isolated-source"'
    )
    expect(createSrdSeedSourceConfig(config, 'isolated-source')).toContain(
      '[db.seed]\nenabled = false'
    )
  })

  it('refreshes repository inputs without replacing Supabase volume metadata', async () => {
    const root = await createTemporaryDirectory()
    const sourceSupabaseDir = join(root, 'source', 'supabase')
    const targetWorkdir = join(root, 'target')

    await mkdir(sourceSupabaseDir, { recursive: true })
    await writeFile(join(sourceSupabaseDir, 'config.toml'), config, 'utf8')
    for (const directoryName of ['functions', 'migrations', 'templates']) {
      const directory = join(sourceSupabaseDir, directoryName)
      await mkdir(directory, { recursive: true })
      await writeFile(join(directory, 'current.txt'), directoryName, 'utf8')
    }

    await stageSrdSeedSourceWorkdir({ sourceSupabaseDir, targetWorkdir })
    const stagedSupabaseDir = join(targetWorkdir, 'supabase')
    await mkdir(join(stagedSupabaseDir, '.temp'), { recursive: true })
    await writeFile(join(stagedSupabaseDir, '.temp', 'volume-id'), 'preserved', 'utf8')
    await writeFile(join(stagedSupabaseDir, 'migrations', 'stale.sql'), 'stale', 'utf8')

    await stageSrdSeedSourceWorkdir({ sourceSupabaseDir, targetWorkdir })

    expect(await readFile(join(stagedSupabaseDir, '.temp', 'volume-id'), 'utf8')).toBe('preserved')
    await expect(
      readFile(join(stagedSupabaseDir, 'migrations', 'stale.sql'), 'utf8')
    ).rejects.toThrow()
    expect(await readFile(join(stagedSupabaseDir, 'migrations', 'current.txt'), 'utf8')).toBe(
      'migrations'
    )
  })
})
