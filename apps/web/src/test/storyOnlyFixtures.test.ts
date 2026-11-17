import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourceRoot = join(process.cwd(), 'src')
const fixtureModulePattern = /\.fixtures?\.tsx?$/
const testPattern = /\.test\.tsx?$/
const storyPattern = /\.stories\.tsx?$/
const importPattern = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g
const resolvedExtensions = ['.ts', '.tsx', '/index.ts', '/index.tsx']

describe('story-only fixture modules', () => {
  it('has no fixture module that only stories (or fixture contract tests) import', () => {
    const sources = readSourceFiles(sourceRoot)
    const importsOf = new Map(sources.map((file) => [file, resolveImports(file)]))
    const fixtureModules = sources.filter((file) => fixtureModulePattern.test(file))

    // A fixture is shared with unit tests when a unit test that does not merely check the
    // fixtures themselves imports it, directly or through another shared fixture.
    const shared = new Set(
      sources
        .filter((file) => testPattern.test(file) && !/fixture/i.test(basename(file)))
        .flatMap((file) => importsOf.get(file) ?? [])
        .filter((file) => fixtureModulePattern.test(file))
    )
    for (let grew = true; grew;) {
      grew = false
      for (const fixture of [...shared]) {
        for (const imported of importsOf.get(fixture) ?? []) {
          if (fixtureModulePattern.test(imported) && !shared.has(imported)) {
            shared.add(imported)
            grew = true
          }
        }
      }
    }

    const storyOnly = fixtureModules
      .filter((file) => !shared.has(file))
      .map((file) => relative(sourceRoot, file).split(sep).join('/'))

    expect(storyOnly).toEqual([])
  })

  it('finds the fixture modules and the stories that use them', () => {
    const sources = readSourceFiles(sourceRoot)
    const importedByStories = sources
      .filter((file) => storyPattern.test(file))
      .flatMap(resolveImports)
      .filter((file) => fixtureModulePattern.test(file))

    expect(importedByStories.length).toBeGreaterThan(0)
  })
})

function readSourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name)
    if (entry.isDirectory()) return readSourceFiles(path)
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })
}

function resolveImports(file: string): string[] {
  const source = readFileSync(file, 'utf8')
  return [...source.matchAll(importPattern)].flatMap(([, specifier]) => {
    const base = specifier.startsWith('.')
      ? resolve(dirname(file), specifier)
      : specifier.startsWith('#')
        ? resolve(sourceRoot, specifier.slice(1).replace(/^app\//, ''))
        : null
    if (!base) return []
    const match = [base, ...resolvedExtensions.map((extension) => base + extension)].find(
      (candidate) => /\.tsx?$/.test(candidate) && existsSync(candidate)
    )
    return match ? [match] : []
  })
}
