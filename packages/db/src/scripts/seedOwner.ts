import { createClient } from '@supabase/supabase-js'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import pg from 'pg'

export const DEFAULT_SEED_OWNER_EMAIL = 'artificer-toolkit-seed@local.invalid'
const USERS_PER_PAGE = 1000
const { Client } = pg

export type SeedOwnerUser = {
  id: string
  email?: string
}

export interface SeedOwnerEnvironment {
  connectionString: string
  email: string
  password?: string
  supabaseSecretKey: string
  supabaseUrl: string
}

export type SeedTarget = 'local' | 'staging' | 'production'

function targetPrefix(target: SeedTarget) {
  if (target === 'local') return ''
  return target === 'staging' ? 'STAGING_' : 'PROD_'
}

function requireEnvironmentVariable(name: string) {
  const value = process.env[name]

  if (!value) throw new Error(`${name} is required to create or reuse the seed owner user.`)

  return value
}

export function readSeedOwnerEnvironment(
  target: SeedTarget = 'local',
  connectionStringOverride?: string
): SeedOwnerEnvironment {
  const prefix = targetPrefix(target)
  const read = (name: string) => requireEnvironmentVariable(`${prefix}${name}`)

  return {
    connectionString: connectionStringOverride ?? read('DATABASE_CONNECTION_STRING'),
    email:
      target !== 'local'
        ? read('SEED_OWNER_EMAIL')
        : (process.env.SEED_OWNER_EMAIL ?? DEFAULT_SEED_OWNER_EMAIL),
    password: process.env[`${prefix}SEED_OWNER_PASSWORD`],
    supabaseSecretKey: read('SUPABASE_SECRET_KEY'),
    supabaseUrl: read('SUPABASE_URL')
  }
}

function createSupabaseAdminClient(environment: SeedOwnerEnvironment) {
  return createClient(environment.supabaseUrl, environment.supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

function createSeedOwnerPassword() {
  return crypto.randomUUID() + crypto.randomUUID()
}

async function updateSeedOwnerPassword(
  environment: SeedOwnerEnvironment,
  user: SeedOwnerUser,
  password: string
) {
  const supabase = createSupabaseAdminClient(environment)
  const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
    email_confirm: true,
    password
  })

  if (error) throw error

  return data.user ?? user
}

async function findUser(
  environment: SeedOwnerEnvironment,
  predicate: (user: SeedOwnerUser) => boolean
) {
  const supabase = createSupabaseAdminClient(environment)
  let page = 1

  while (true) {
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers({
      page,
      perPage: USERS_PER_PAGE
    })
    if (listError) throw listError

    const existingUser = existingUsers.users.find(predicate)
    if (existingUser) {
      return existingUser
    }

    if (!existingUsers.nextPage) {
      break
    }

    page = existingUsers.nextPage
  }

  return null
}

export function findSeedOwnerUserByEmail(environment: SeedOwnerEnvironment) {
  const normalizedEmail = environment.email.toLowerCase()
  return findUser(environment, (user) => user.email?.toLowerCase() === normalizedEmail)
}

export async function findSeedOwnerUserById(environment: SeedOwnerEnvironment, userId: string) {
  const supabase = createSupabaseAdminClient(environment)
  const { data, error } = await supabase.auth.admin.getUserById(userId)

  if (error) {
    if (error.status === 404) return null
    throw error
  }

  return data.user
}

async function promoteSeedOwnerToSuperAdmin(
  environment: SeedOwnerEnvironment,
  user: SeedOwnerUser
) {
  const client = new Client({ connectionString: environment.connectionString })

  await client.connect()

  try {
    const result = await client.query('UPDATE auth.users SET is_super_admin = true WHERE id = $1', [
      user.id
    ])

    if (result.rowCount !== 1) {
      throw new Error(
        `Expected to promote seed owner "${user.id}", updated ${result.rowCount ?? 0} users.`
      )
    }
  } finally {
    await client.end()
  }

  return user
}

export async function ensureSeedOwnerUser(environment: SeedOwnerEnvironment) {
  const existingUser = await findSeedOwnerUserByEmail(environment)

  if (existingUser) {
    const user = environment.password
      ? updateSeedOwnerPassword(environment, existingUser, environment.password)
      : existingUser

    return promoteSeedOwnerToSuperAdmin(environment, await user)
  }

  const supabase = createSupabaseAdminClient(environment)
  const { data, error } = await supabase.auth.admin.createUser({
    email: environment.email,
    email_confirm: true,
    password: environment.password ?? createSeedOwnerPassword(),
    user_metadata: {
      purpose: 'Artificer Toolkit master seed data owner'
    }
  })

  if (error) throw error
  if (!data.user) {
    throw new Error(
      `Supabase did not return a user after creating seed owner "${environment.email}".`
    )
  }

  return promoteSeedOwnerToSuperAdmin(environment, data.user)
}

function parseRemoteSeedTarget(): Exclude<SeedTarget, 'local'> {
  const staging = process.argv.includes('--staging')
  const production = process.argv.includes('--production')
  if (staging === production) throw new Error('Pass exactly one of --staging or --production.')
  return staging ? 'staging' : 'production'
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  ensureSeedOwnerUser(readSeedOwnerEnvironment(parseRemoteSeedTarget()))
    .then((user) => console.info(`Seed owner ready: ${user.email ?? user.id}`))
    .catch((error: unknown) => {
      console.error(error)
      process.exitCode = 1
    })
}
