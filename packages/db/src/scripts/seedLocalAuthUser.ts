import { createClient } from '@supabase/supabase-js'
import { pathToFileURL } from 'node:url'

function requireLocalAuthEnv() {
  const email = process.env.LOCAL_AUTH_EMAIL
  const password = process.env.LOCAL_AUTH_PASSWORD
  const username = process.env.LOCAL_AUTH_USERNAME
  const secretKey = process.env.SUPABASE_SECRET_KEY
  const url = process.env.SUPABASE_URL

  if (!url) {
    throw new Error('SUPABASE_URL is required to create or update a local auth user.')
  }

  if (!secretKey) {
    throw new Error('SUPABASE_SECRET_KEY is required to create or update a local auth user.')
  }

  if (!email) {
    throw new Error('LOCAL_AUTH_EMAIL is required to create or update a local auth user.')
  }

  if (!password) {
    throw new Error('LOCAL_AUTH_PASSWORD is required to create or update a local auth user.')
  }

  if (!username) {
    throw new Error('LOCAL_AUTH_USERNAME is required to create or update a local auth user.')
  }

  if (!url.includes('127.0.0.1') && !url.includes('localhost')) {
    throw new Error('seedLocalAuthUser only runs against local Supabase URLs.')
  }

  return {
    email,
    password,
    secretKey,
    username,
    url
  }
}

async function main() {
  const { email, password, secretKey, username, url } = requireLocalAuthEnv()
  const supabase = createClient(url, secretKey, {
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
        password,
        user_metadata: { username }
      })
    : await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        password,
        user_metadata: { username }
      })

  if (result.error) throw result.error
  if (!result.data.user) {
    throw new Error(`Supabase did not return a user for "${email}".`)
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ username })
    .eq('id', result.data.user.id)
  if (profileError) throw profileError

  console.info(`Local auth user ready: ${result.data.user.email}`)
}

function isDirectScript() {
  return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false
}

if (isDirectScript()) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
