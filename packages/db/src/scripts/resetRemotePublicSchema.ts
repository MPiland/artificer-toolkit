import { readFile } from 'node:fs/promises'

import pg from 'pg'

const { Client } = pg

const CONFIRMATION_VALUE = 'reset-public-schema'

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`${name} is required.`)
  }

  return value
}

function describeDatabase(databaseUrl: string): string {
  const parsed = new URL(databaseUrl)
  const username = parsed.username ? `${parsed.username}@` : ''

  return `${parsed.protocol}//${username}${parsed.host}${parsed.pathname}`
}

async function main() {
  const databaseUrl = requireEnv('DATABASE_URL')
  const confirmation = requireEnv('CONFIRM_REMOTE_PUBLIC_SCHEMA_RESET')

  if (confirmation !== CONFIRMATION_VALUE) {
    throw new Error(`CONFIRM_REMOTE_PUBLIC_SCHEMA_RESET must equal "${CONFIRMATION_VALUE}".`)
  }

  const bundleUrl = new URL('../domains/bootstrap/generated/create_database.bundle.sql', import.meta.url)
  const bundleSql = await readFile(bundleUrl, 'utf8')

  const resetSql = `
BEGIN;

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
ALTER SCHEMA public OWNER TO postgres;

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;

${bundleSql}

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;

COMMIT;
`

  const client = new Client({ connectionString: databaseUrl })

  console.log(`Resetting public schema on ${describeDatabase(databaseUrl)}.`)

  await client.connect()

  try {
    await client.query('SET statement_timeout = 0')
    await client.query(resetSql)
  } finally {
    await client.end()
  }

  console.log('Public schema reset complete.')
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
