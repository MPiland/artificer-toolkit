import { existsSync, readFileSync } from 'node:fs'

const ENV_FILES = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.development.local'
] as const

function parseEnvLine(line: string) {
  const trimmed = line.trim()

  if (!trimmed || trimmed.startsWith('#')) return null

  const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(trimmed)
  if (!match) return null

  let value = match[2].trim()

  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith('\'') && value.endsWith('\''))
  ) {
    value = value.slice(1, -1)
  }

  return {
    key: match[1],
    value
  }
}

export function loadDbScriptEnv() {
  const packageRoot = new URL('../../', import.meta.url)

  for (const fileName of ENV_FILES) {
    const fileUrl = new URL(fileName, packageRoot)

    if (!existsSync(fileUrl)) continue

    const lines = readFileSync(fileUrl, 'utf8').split(/\r?\n/)

    for (const line of lines) {
      const parsed = parseEnvLine(line)

      if (!parsed) continue

      process.env[parsed.key] = parsed.value
    }
  }
}
