import { spawn } from 'node:child_process'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const SRD_SEED_SOURCE_PROJECT_ID = 'artificer-toolkit-srd-seed-source'

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const DEVELOPMENT_PROJECT_ID = 'artificer-toolkit'
const SRD_SEED_SOURCE_WORKDIR = join(REPOSITORY_ROOT, '.supabase-seed-source')
const COPIED_SUPABASE_DIRECTORIES = ['functions', 'migrations', 'templates'] as const

interface CommandResult {
  exitCode: number
  stderr: string
  stdout: string
}

interface SupabaseStatus {
  API_URL?: unknown
  DB_URL?: unknown
  SECRET_KEY?: unknown
  SERVICE_ROLE_KEY?: unknown
}

interface StageSrdSeedSourceOptions {
  projectId?: string
  sourceSupabaseDir: string
  targetWorkdir: string
}

function assertDirectChild(parent: string, target: string): void {
  const childPath = relative(resolve(parent), resolve(target))

  if (!childPath || childPath.startsWith('..') || isAbsolute(childPath)) {
    throw new Error(`Refusing to replace unsafe staged path "${target}".`)
  }
}

export function createSrdSeedSourceConfig(
  source: string,
  projectId = SRD_SEED_SOURCE_PROJECT_ID
): string {
  let section = ''
  let projectIdUpdates = 0
  let seedUpdates = 0

  const output = source
    .split('\n')
    .map((line) => {
      const sectionMatch = line.match(/^\s*\[([^\]]+)]\s*$/)
      if (sectionMatch) {
        section = sectionMatch[1] ?? ''
        return line
      }

      if (!section && /^\s*project_id\s*=/.test(line)) {
        projectIdUpdates += 1
        return `project_id = "${projectId}"`
      }

      if (section === 'db.seed' && /^\s*enabled\s*=/.test(line)) {
        seedUpdates += 1
        return 'enabled = false'
      }

      return line
    })
    .join('\n')

  if (projectIdUpdates !== 1 || seedUpdates !== 1) {
    throw new Error(
      `Expected one root project_id and one [db.seed] enabled setting; found ${projectIdUpdates} and ${seedUpdates}.`
    )
  }

  return output
}

export async function stageSrdSeedSourceWorkdir({
  projectId = SRD_SEED_SOURCE_PROJECT_ID,
  sourceSupabaseDir,
  targetWorkdir
}: StageSrdSeedSourceOptions): Promise<void> {
  const targetSupabaseDir = join(targetWorkdir, 'supabase')
  await mkdir(targetSupabaseDir, { recursive: true })

  const sourceConfig = await readFile(join(sourceSupabaseDir, 'config.toml'), 'utf8')
  await writeFile(
    join(targetSupabaseDir, 'config.toml'),
    createSrdSeedSourceConfig(sourceConfig, projectId),
    'utf8'
  )

  for (const directoryName of COPIED_SUPABASE_DIRECTORIES) {
    const sourceDirectory = join(sourceSupabaseDir, directoryName)
    const targetDirectory = join(targetSupabaseDir, directoryName)
    assertDirectChild(targetSupabaseDir, targetDirectory)
    await rm(targetDirectory, { force: true, recursive: true })
    await cp(sourceDirectory, targetDirectory, { recursive: true })
  }
}

async function runYarn(
  args: string[],
  options: {
    capture?: boolean
    env?: NodeJS.ProcessEnv
  } = {}
): Promise<CommandResult> {
  const capture = options.capture ?? false

  return new Promise((resolveResult, reject) => {
    const command = process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : 'yarn'
    const commandArgs = process.platform === 'win32' ? ['/d', '/s', '/c', 'yarn', ...args] : args
    const child = spawn(command, commandArgs, {
      cwd: REPOSITORY_ROOT,
      env: options.env ?? process.env,
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      windowsHide: true
    })

    let stderr = ''
    let stdout = ''

    if (capture) {
      child.stdout?.setEncoding('utf8')
      child.stderr?.setEncoding('utf8')
      child.stdout?.on('data', (chunk: string) => {
        stdout += chunk
      })
      child.stderr?.on('data', (chunk: string) => {
        stderr += chunk
      })
    }

    child.once('error', reject)
    child.once('close', (exitCode) => {
      resolveResult({ exitCode: exitCode ?? 1, stderr, stdout })
    })
  })
}

async function requireSuccessfulYarn(
  args: string[],
  options: Parameters<typeof runYarn>[1] = {}
): Promise<CommandResult> {
  const result = await runYarn(args, options)

  if (result.exitCode !== 0) {
    const detail = result.stderr.trim()
    throw new Error(
      detail
        ? `Command "yarn ${args.join(' ')}" failed: ${detail}`
        : `Command "yarn ${args.join(' ')}" failed with exit code ${result.exitCode}.`
    )
  }

  return result
}

async function isSupabaseProjectRunning(workdir: string): Promise<boolean> {
  const result = await runYarn(['supabase', 'status', '--workdir', workdir], { capture: true })
  return result.exitCode === 0
}

async function stageSeedSource(): Promise<void> {
  await stageSrdSeedSourceWorkdir({
    sourceSupabaseDir: join(REPOSITORY_ROOT, 'supabase'),
    targetWorkdir: SRD_SEED_SOURCE_WORKDIR
  })
}

async function startSeedSource(): Promise<void> {
  await stageSeedSource()

  if (await isSupabaseProjectRunning(SRD_SEED_SOURCE_WORKDIR)) {
    console.info('The isolated SRD seed-source stack is already running.')
    return
  }

  const developmentWasRunning = await isSupabaseProjectRunning(REPOSITORY_ROOT)
  if (developmentWasRunning) {
    console.info('Stopping the development Supabase stack while preserving its data...')
    await requireSuccessfulYarn(['supabase', 'stop', '--project-id', DEVELOPMENT_PROJECT_ID])
  }

  console.info('Starting the isolated SRD seed-source Supabase stack...')
  try {
    await requireSuccessfulYarn(
      ['supabase', 'start', '--workdir', SRD_SEED_SOURCE_WORKDIR, '--yes'],
      { capture: true }
    )
  } catch (error) {
    if (developmentWasRunning) {
      console.info('Seed-source startup failed; restoring the development Supabase stack...')
      await requireSuccessfulYarn(['supabase', 'start', '--workdir', REPOSITORY_ROOT, '--yes'], {
        capture: true
      })
    }
    throw error
  }
}

function readRequiredStatusValue(status: SupabaseStatus, key: keyof SupabaseStatus): string {
  const value = status[key]
  if (typeof value !== 'string' || !value) {
    throw new Error(`Supabase status did not provide ${key}.`)
  }
  return value
}

async function readSeedSourceEnvironment(): Promise<NodeJS.ProcessEnv> {
  const result = await requireSuccessfulYarn(
    ['supabase', 'status', '--workdir', SRD_SEED_SOURCE_WORKDIR, '--output', 'json'],
    { capture: true }
  )
  const status = JSON.parse(result.stdout) as SupabaseStatus
  const secretKey = status.SECRET_KEY ?? status.SERVICE_ROLE_KEY

  if (typeof secretKey !== 'string' || !secretKey) {
    throw new Error('Supabase status did not provide SECRET_KEY or SERVICE_ROLE_KEY.')
  }

  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_CONNECTION_STRING: readRequiredStatusValue(status, 'DB_URL'),
    SUPABASE_SECRET_KEY: secretKey,
    SUPABASE_URL: readRequiredStatusValue(status, 'API_URL')
  }
  delete environment.SEED_OWNER_USER_ID

  return environment
}

async function prepareSeedSource(): Promise<void> {
  await startSeedSource()

  console.info('Resetting only the isolated SRD seed-source database...')
  await requireSuccessfulYarn([
    'supabase',
    'db',
    'reset',
    '--local',
    '--no-seed',
    '--workdir',
    SRD_SEED_SOURCE_WORKDIR,
    '--yes'
  ])

  const environment = await readSeedSourceEnvironment()
  console.info('Seeding and auditing the isolated SRD source corpus...')
  await requireSuccessfulYarn(['seed:srd:local'], { env: environment })
  await requireSuccessfulYarn(['audit:srd'], { env: environment })

  console.info('The isolated source corpus is ready.')
  console.info('Next: yarn seed:srd:production:dry-run')
  console.info('When finished: yarn seed-source:stop')
}

async function stopSeedSource(): Promise<void> {
  if (await isSupabaseProjectRunning(SRD_SEED_SOURCE_WORKDIR)) {
    console.info('Stopping the isolated SRD seed-source stack while preserving its data...')
    await requireSuccessfulYarn(['supabase', 'stop', '--project-id', SRD_SEED_SOURCE_PROJECT_ID])
  }

  if (!(await isSupabaseProjectRunning(REPOSITORY_ROOT))) {
    console.info('Restoring the development Supabase stack...')
    await requireSuccessfulYarn(['supabase', 'start', '--workdir', REPOSITORY_ROOT, '--yes'], {
      capture: true
    })
  }
}

async function main(): Promise<void> {
  const command = process.argv[2]

  if (command === 'start') {
    await startSeedSource()
    return
  }
  if (command === 'prepare') {
    await prepareSeedSource()
    return
  }
  if (command === 'stop') {
    await stopSeedSource()
    return
  }

  throw new Error('Expected one command: start, prepare, or stop.')
}

const invokedScript = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null
if (invokedScript === import.meta.url) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
