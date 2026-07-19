import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourceRoot = join(process.cwd(), 'src')
const activeRoots = [join(sourceRoot, 'domains'), join(sourceRoot, 'forms')]

describe('authoring form architecture boundaries', () => {
  it('keeps node-map-backed defaults out of components/editors imports', () => {
    const offenders = activeRoots
      .flatMap((root) => readSourceFiles(root))
      .filter((filePath) => !filePath.endsWith('.test.ts') && !filePath.endsWith('.test.tsx'))
      .filter((filePath) => readFileSync(filePath, 'utf8').includes('#components/editors'))
      .map((filePath) => relative(sourceRoot, filePath).split(sep).join('/'))

    expect(offenders).toEqual([])
  })

  it('keeps production navigation and progress on the resolved authoring-schema contract', () => {
    const productionConsumers = [
      join(sourceRoot, 'forms', 'layout', 'authoringNavigation.ts'),
      join(sourceRoot, 'forms', 'validation', 'authoringProgress.ts')
    ]

    expect(
      productionConsumers.filter((filePath) =>
        readFileSync(filePath, 'utf8').includes('staticResolvedModel')
      )
    ).toEqual([])
  })
})

function readSourceFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry)
    const stat = statSync(path)

    if (stat.isDirectory()) return readSourceFiles(path)
    if (!/\.(ts|tsx)$/.test(entry)) return []

    return [path]
  })
}
