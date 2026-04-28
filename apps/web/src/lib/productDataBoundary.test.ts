import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourceRoot = join(process.cwd(), 'src')
const blockedImports = [
  '@artificer-toolkit/db',
  '@artificer-toolkit/functions',
  '@apis'
]
const legacyAllowList = [
  `${sep}components${sep}Form${sep}`,
  `${sep}domains${sep}`,
  `${sep}hooks${sep}characterLogic${sep}`,
  `${sep}hooks${sep}useClassProficiency.ts`,
  `${sep}hooks${sep}useSourceData.ts`,
  `${sep}hooks${sep}useSystemData.ts`,
  `${sep}legacy${sep}`,
  `${sep}server${sep}domains${sep}`
]
const typeOnlyAllowList = [
  `${sep}supabase${sep}client.ts`,
  `${sep}supabase${sep}server.server.ts`
]

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    const stats = statSync(path)

    if (stats.isDirectory()) {
      return collectSourceFiles(path)
    }

    return path.endsWith('.ts') || path.endsWith('.tsx') ? [path] : []
  })
}

function isAllowedLegacyPath(path: string) {
  return legacyAllowList.some((allowed) => path.includes(allowed))
    || typeOnlyAllowList.some((allowed) => path.endsWith(allowed))
}

describe('product data boundary', () => {
  it('keeps active web code behind apps/apis', () => {
    const violations = collectSourceFiles(sourceRoot)
      .filter((path) => !path.endsWith('.test.ts') && !path.endsWith('.test.tsx'))
      .filter((path) => !isAllowedLegacyPath(path))
      .flatMap((path) => {
        const text = readFileSync(path, 'utf8')
        return blockedImports
          .filter((blockedImport) => text.includes(blockedImport))
          .map((blockedImport) => `${relative(process.cwd(), path)} imports ${blockedImport}`)
      })

    expect(violations).toEqual([])
  })
})
