import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageRoot = path.resolve(__dirname, '..')
const domainsRoot = path.join(packageRoot, 'src', 'domains')
const entryFile = path.join(domainsRoot, 'utils', 'create_database.sql')
const outputFile = path.join(domainsRoot, 'bootstrap', 'generated', 'create_database.bundle.sql')

function toWindowsRelativePath(filePath) {
  return path.relative(packageRoot, filePath).replaceAll('/', '\\')
}

async function inlineSqlFile(filePath, seen = new Set()) {
  const normalizedPath = path.normalize(filePath)

  if (seen.has(normalizedPath)) {
    throw new Error(`Recursive SQL include detected for ${normalizedPath}`)
  }

  seen.add(normalizedPath)

  const sql = await readFile(normalizedPath, 'utf8')
  const lines = sql.split(/\r?\n/)
  const output = []

  for (const line of lines) {
    const includeMatch = line.match(/^\\i\s+:etl_root'\/(.+)'$/)

    if (includeMatch) {
      const includePath = path.join(domainsRoot, ...includeMatch[1].split('/'))
      const included = await inlineSqlFile(includePath, seen)
      output.push(included)
      continue
    }

    if (line.startsWith('\\set ')) {
      continue
    }

    if (line.trim() === '\\set ON_ERROR_STOP off') {
      continue
    }

    output.push(line)
  }

  seen.delete(normalizedPath)

  return [
    `-- BEGIN INCLUDE: ${toWindowsRelativePath(normalizedPath)}`,
    output.join('\n').trimEnd(),
    `-- END INCLUDE: ${toWindowsRelativePath(normalizedPath)}`
  ].join('\n')
}

async function main() {
  const bundled = await inlineSqlFile(entryFile)
  await mkdir(path.dirname(outputFile), { recursive: true })
  await writeFile(outputFile, `${bundled}\n`, 'utf8')
  console.log(`Wrote ${path.relative(packageRoot, outputFile)}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
