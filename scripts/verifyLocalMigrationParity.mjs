import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { spawn } from 'node:child_process'

const root = resolve(import.meta.dirname, '..')
const migrationsDirectory = resolve(root, 'supabase/migrations')

function runSupabaseMigrationList() {
  return new Promise((resolveRun, rejectRun) => {
    const executable = process.platform === 'win32' ? process.execPath : 'yarn'
    const args =
      process.platform === 'win32'
        ? [
            resolve(dirname(process.execPath), 'node_modules/corepack/dist/yarn.js'),
            'supabase',
            'migration',
            'list',
            '--local',
            '--output-format',
            'json'
          ]
        : ['supabase', 'migration', 'list', '--local', '--output-format', 'json']
    const child = spawn(executable, args, {
      cwd: root,
      env: process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    const output = []
    const errors = []
    child.stdout.on('data', (chunk) => output.push(chunk))
    child.stderr.on('data', (chunk) => errors.push(chunk))
    child.once('error', rejectRun)
    child.once('close', (code) => {
      if (code !== 0) {
        rejectRun(
          new Error(
            Buffer.concat(errors).toString('utf8').trim() ||
              `Supabase migration list exited ${code}.`
          )
        )
        return
      }
      resolveRun(Buffer.concat(output).toString('utf8'))
    })
  })
}

const localMigrations = (await readdir(migrationsDirectory))
  .flatMap((name) => {
    const match = /^(\d+)_.*\.sql$/u.exec(name)
    return match ? [match[1]] : []
  })
  .sort()
assert.equal(
  new Set(localMigrations).size,
  localMigrations.length,
  'Local migration versions must be unique.'
)

const response = JSON.parse(await runSupabaseMigrationList())
assert.ok(Array.isArray(response.migrations), 'Supabase returned no migration list.')
const appliedMigrations = response.migrations.map(({ local, remote }) => {
  assert.equal(local, remote, `Migration parity mismatch for ${local ?? remote}.`)
  assert.equal(typeof local, 'string', 'An applied migration is absent locally.')
  return local
})
assert.deepEqual(
  appliedMigrations,
  localMigrations,
  'Local migration files and applied migration history differ.'
)

console.log(
  JSON.stringify({
    appliedMigrationCount: appliedMigrations.length,
    localMigrationCount: localMigrations.length,
    parity: 'EXACT'
  })
)
