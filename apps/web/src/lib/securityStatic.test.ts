import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = path.resolve(process.cwd(), '../..')
const sourceExtensions = new Set(['.ts', '.tsx'])
const skippedDirectories = new Set([
  '.git',
  'coverage',
  'dist',
  'node_modules',
  'storybook-static',
  'test-results'
])
const allowlistedScriptSqlPaths = new Set([
  'packages/db/src/scripts/auditSrdData.ts',
  'packages/db/src/scripts/testCharacterSheetStatePatchIntegration.ts'
])

function toPortablePath(filePath: string): string {
  return filePath.split(path.sep).join('/')
}

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (skippedDirectories.has(entry.name)) {
      return []
    }

    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      return collectSourceFiles(entryPath)
    }

    if (!sourceExtensions.has(path.extname(entry.name))) {
      return []
    }

    return [entryPath]
  })
}

function read(filePath: string): string {
  return readFileSync(filePath, 'utf8')
}

function productionFiles(files: string[]): string[] {
  return files.filter((filePath) => !filePath.includes('.test.') && !filePath.includes('.stories.'))
}

describe('static security posture', () => {
  const webFiles = productionFiles(collectSourceFiles(path.join(repoRoot, 'apps', 'web', 'src')))
  const runtimeServerFiles = productionFiles([
    ...collectSourceFiles(path.join(repoRoot, 'apps', 'apis', 'src')),
    ...collectSourceFiles(path.join(repoRoot, 'packages', 'db', 'src')),
    ...collectSourceFiles(path.join(repoRoot, 'packages', 'functions', 'src'))
  ])

  it('keeps web product data away from DB and function internals', () => {
    const productDataServerImportPattern = /from ['"]@artificer-toolkit\/(?:functions|db(?!\/types))/
    const offenders = webFiles
      .filter((filePath) => productDataServerImportPattern.test(read(filePath)))
      .map(toPortablePath)

    expect(offenders).toEqual([])
  })

  it('does not keep the retired REST API env surface alive', () => {
    const offenders = webFiles
      .filter((filePath) => read(filePath).includes('VITE_API_URL'))
      .map(toPortablePath)

    expect(offenders).toEqual([])
  })

  it('does not add browser token storage in active web code', () => {
    const tokenStoragePattern = /(?:localStorage|sessionStorage)\.(?:setItem|getItem)\([^)]*(?:access|refresh|session|token|authorization)/i
    const offenders = webFiles
      .filter((filePath) => tokenStoragePattern.test(read(filePath)))
      .map(toPortablePath)

    expect(offenders).toEqual([])
  })

  it('does not use raw HTML injection in active web code', () => {
    const offenders = webFiles
      .filter((filePath) => read(filePath).includes('dangerouslySetInnerHTML'))
      .map(toPortablePath)

    expect(offenders).toEqual([])
  })

  it('routes authored rich HTML through the sanitizer helper', () => {
    const offenders = webFiles
      .filter((filePath) => read(filePath).includes('html-react-parser'))
      .map(toPortablePath)
      .filter((filePath) => !filePath.endsWith('/apps/web/src/ui/primitives/renderSanitizedRichHtml.tsx'))

    expect(offenders).toEqual([])
  })

  it('does not use raw SQL helpers in active runtime code', () => {
    const offenders = runtimeServerFiles
      .filter((filePath) => /sql\.raw\s*\(/.test(read(filePath)))
      .map(toPortablePath)
      .filter((filePath) => !Array.from(allowlistedScriptSqlPaths).some((allowedPath) => filePath.endsWith(`/${allowedPath}`)))

    expect(offenders).toEqual([])
  })
})
