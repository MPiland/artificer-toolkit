import { readdirSync, readFileSync } from 'node:fs'
import { extname, join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourceRoot = join(process.cwd(), 'src')
const sourceExtensions = new Set(['.ts', '.tsx'])
const skippedDirectories = new Set(['coverage', 'dist', 'node_modules', 'storybook-static'])
const allowedLiteralShadows = new Set(['none'])

function collectActiveSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return skippedDirectories.has(entry.name)
        ? []
        : collectActiveSourceFiles(join(directory, entry.name))
    }

    if (!sourceExtensions.has(extname(entry.name))) return []
    if (entry.name.includes('.test.') || entry.name.includes('.stories.')) return []

    return [join(directory, entry.name)]
  })
}

function portablePath(filePath: string): string {
  return relative(sourceRoot, filePath).split(sep).join('/')
}

describe('shadow token boundaries', () => {
  const sourceFiles = collectActiveSourceFiles(sourceRoot)

  it('keeps active box shadows on semantic tokens', () => {
    const literalShadowPattern = /(?:['"]?boxShadow['"]?)\s*:\s*(['"`])([^'"`]*)\1/g
    const offenders = sourceFiles.flatMap((filePath) => {
      const source = readFileSync(filePath, 'utf8')

      return Array.from(source.matchAll(literalShadowPattern))
        .map((match) => match[2].trim())
        .filter((value) => !allowedLiteralShadows.has(value))
        .map((value) => `${portablePath(filePath)}: ${value}`)
    })

    expect(offenders).toEqual([])
  })

  it('does not introduce Mantine preset shadows', () => {
    const mantinePresetPattern = /(?:['"]?shadow['"]?)\s*(?::|=)\s*(['"])([^'"]+)\1/g
    const offenders = sourceFiles.flatMap((filePath) => {
      const source = readFileSync(filePath, 'utf8')

      return Array.from(source.matchAll(mantinePresetPattern))
        .map((match) => match[2].trim())
        .filter((value) => !allowedLiteralShadows.has(value))
        .map((value) => `${portablePath(filePath)}: ${value}`)
    })

    expect(offenders).toEqual([])
  })
})
