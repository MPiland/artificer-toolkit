// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// ADR 0036 S6: the browser runs Builder rules only. Encounter rules stay on the server and in the
// session Worker, so no web module may reach `rules-runtime/encounter*`, directly or through the
// runtime modules it imports.

const webSource = join(process.cwd(), 'src')
const runtimeSource = resolve(process.cwd(), '../../packages/rules-runtime/src')
const RUNTIME_PACKAGE = '@artificer-toolkit/rules-runtime'
const isEncounterModule = (path: string) => /^encounter/i.test(path.split(/[\\/]/).at(-1) ?? '')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    // Test-support folders are never bundled, so their imports cannot reach the browser.
    if (statSync(path).isDirectory()) return entry === 'tests' ? [] : sourceFiles(path)
    return /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) ? [path] : []
  })
}

/** Specifiers of imports and re-exports that reach the bundle (type-only imports do not). */
function valueImports(text: string): string[] {
  const statements = text.matchAll(
    /(?:^|\n)\s*(import|export)\s+(type\s+)?(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/g
  )
  const dynamic = text.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)
  return [
    ...[...statements].flatMap((match) => (match[2] ? [] : [match[3]!])),
    ...[...dynamic].map((match) => match[1]!)
  ]
}

function runtimeFile(specifier: string, from: string | null): string | null {
  const path = from
    ? resolve(dirname(from), specifier)
    : join(runtimeSource, specifier.slice(RUNTIME_PACKAGE.length) || 'index')
  const file = path.replace(/\.js$/, '') + '.ts'
  return existsSync(file) ? file : null
}

describe('rules-runtime boundary', () => {
  it('keeps Encounter rules out of the web app', () => {
    const violations: string[] = []
    const visited = new Set<string>()
    const pending: { file: string; via: string }[] = []

    for (const file of sourceFiles(webSource)) {
      const text = readFileSync(file, 'utf8')
      for (const match of text.matchAll(/['"](@artificer-toolkit\/rules-runtime[^'"]*)['"]/g)) {
        const specifier = match[1]!
        const via = relative(process.cwd(), file)
        if (isEncounterModule(specifier)) violations.push(`${via} imports ${specifier}`)
        const target = runtimeFile(specifier, null)
        if (target) pending.push({ file: target, via })
      }
    }
    while (pending.length > 0) {
      const { file, via } = pending.pop()!
      if (visited.has(file)) continue
      visited.add(file)
      if (isEncounterModule(file)) {
        violations.push(`${via} reaches ${relative(runtimeSource, file)}`)
        continue
      }
      for (const specifier of valueImports(readFileSync(file, 'utf8'))) {
        if (!specifier.startsWith('.')) continue
        const target = runtimeFile(specifier, file)
        if (target) pending.push({ file: target, via })
      }
    }

    expect(visited.size).toBeGreaterThan(0)
    expect(violations).toEqual([])
  })
})
