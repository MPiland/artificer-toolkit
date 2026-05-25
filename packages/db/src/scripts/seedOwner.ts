import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import { pathToFileURL } from 'node:url'

import { loadDbScriptEnv } from './loadScriptEnv.js'

loadDbScriptEnv()

export const DEFAULT_SEED_OWNER_EMAIL = 'artificertoolkit@gmail.com'
const USERS_PER_PAGE = 1000
const { Client } = pg

type SeedOwnerUser = {
  id: string
  email?: string
}

function requireSupabaseAdminEnv() {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error('SUPABASE_URL is required to create or reuse the seed owner user.')
  }

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to create or reuse the seed owner user.')
  }

  return {
    serviceRoleKey,
    url
  }
}

function createSupabaseAdminClient() {
  const { serviceRoleKey, url } = requireSupabaseAdminEnv()

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

function requireDatabaseConnectionString() {
  const connectionString = process.env.DATABASE_URL ?? process.env.DATABASE_CONNECTION_STRING

  if (!connectionString) {
    throw new Error('DATABASE_URL or DATABASE_CONNECTION_STRING is required to promote the seed owner user.')
  }

  return connectionString
}

function createSeedOwnerPassword() {
  return crypto.randomUUID() + crypto.randomUUID()
}

async function updateSeedOwnerPassword(
  user: SeedOwnerUser,
  password: string
) {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
    email_confirm: true,
    password
  })

  if (error) throw error

  return data.user ?? user
}

async function findUser(
  predicate: (user: SeedOwnerUser) => boolean
) {
  const supabase = createSupabaseAdminClient()
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

export async function findSeedOwnerUserById(userId: string) {
  return findUser((user) => user.id === userId)
}

async function promoteSeedOwnerToSuperAdmin(user: SeedOwnerUser) {
  const client = new Client({ connectionString: requireDatabaseConnectionString() })

  await client.connect()

  try {
    const result = await client.query(
      'UPDATE auth.users SET is_super_admin = true WHERE id = $1',
      [user.id]
    )

    if (result.rowCount !== 1) {
      throw new Error(`Expected to promote seed owner "${user.id}", updated ${result.rowCount ?? 0} users.`)
    }
  } finally {
    await client.end()
  }

  return user
}

export async function ensureSeedOwnerUser() {
  const email = process.env.SEED_OWNER_EMAIL ?? DEFAULT_SEED_OWNER_EMAIL
  const password = process.env.SEED_OWNER_PASSWORD
  const normalizedEmail = email.toLowerCase()
  const existingUser = await findUser((user) => user.email?.toLowerCase() === normalizedEmail)

  if (existingUser) {
    const user = password
      ? updateSeedOwnerPassword(existingUser, password)
      : existingUser

    return promoteSeedOwnerToSuperAdmin(await user)
  }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    password: password ?? createSeedOwnerPassword(),
    user_metadata: {
      purpose: 'Artificer Toolkit master seed data owner'
    }
  })

  if (error) throw error
  if (!data.user) {
    throw new Error(`Supabase did not return a user after creating seed owner "${email}".`)
  }

  return promoteSeedOwnerToSuperAdmin(data.user)
}

async function main() {
  const user = await ensureSeedOwnerUser()
  console.info(`Seed owner user id: ${user.id}`)
}

function isDirectScript() {
  return process.argv[1]
    ? import.meta.url === pathToFileURL(process.argv[1]).href
    : false
}

if (isDirectScript()) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
