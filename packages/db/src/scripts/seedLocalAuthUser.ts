import { createClient } from '@supabase/supabase-js'
import { pathToFileURL } from 'node:url'

import { loadDbScriptEnv } from './loadScriptEnv.js'

loadDbScriptEnv()

function requireLocalAuthEnv() {
  const email = process.env.LOCAL_AUTH_EMAIL
  const password = process.env.LOCAL_AUTH_PASSWORD
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.SUPABASE_URL

  if (!url) {
    throw new Error('SUPABASE_URL is required to create or update a local auth user.')
  }

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to create or update a local auth user.')
  }

  if (!email) {
    throw new Error('LOCAL_AUTH_EMAIL is required to create or update a local auth user.')
  }

  if (!password) {
    throw new Error('LOCAL_AUTH_PASSWORD is required to create or update a local auth user.')
  }

  if (!url.includes('127.0.0.1') && !url.includes('localhost')) {
    throw new Error('seedLocalAuthUser only runs against local Supabase URLs.')
  }

  return {
    email,
    password,
    serviceRoleKey,
    url
  }
}

async function main() {
  const { email, password, serviceRoleKey, url } = requireLocalAuthEnv()
  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  const { data: users, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  })

  if (listError) throw listError

  const existingUser = users.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())
  const result = existingUser
    ? await supabase.auth.admin.updateUserById(existingUser.id, {
      email_confirm: true,
      password
    })
    : await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      password
    })

  if (result.error) throw result.error
  if (!result.data.user) {
    throw new Error(`Supabase did not return a user for "${email}".`)
  }

  console.info(`Local auth user ready: ${result.data.user.email}`)
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
