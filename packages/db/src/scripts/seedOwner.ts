import { createClient } from '@supabase/supabase-js'
import { pathToFileURL } from 'node:url'

import { loadDbScriptEnv } from './loadScriptEnv.js'

loadDbScriptEnv()

export const DEFAULT_SEED_OWNER_EMAIL = 'artificertoolkit@gmail.com'
const USERS_PER_PAGE = 1000

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

function createSeedOwnerPassword() {
  return crypto.randomUUID() + crypto.randomUUID()
}

async function findUser(
  predicate: (user: { id: string, email?: string }) => boolean
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

export async function ensureSeedOwnerUser() {
  const email = process.env.SEED_OWNER_EMAIL ?? DEFAULT_SEED_OWNER_EMAIL
  const normalizedEmail = email.toLowerCase()
  const existingUser = await findUser((user) => user.email?.toLowerCase() === normalizedEmail)

  if (existingUser) {
    return existingUser
  }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    password: createSeedOwnerPassword(),
    user_metadata: {
      purpose: 'Artificer Toolkit master seed data owner'
    }
  })

  if (error) throw error
  if (!data.user) {
    throw new Error(`Supabase did not return a user after creating seed owner "${email}".`)
  }

  return data.user
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
