import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generate } from 'ts-to-zod'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SRC_DIR = path.resolve(__dirname, './types')
const OUT_DIR = path.resolve(__dirname, './schemas')

function walk(dir: string): string[] {
  return fs.readdirSync(dir).flatMap((file) => {
    const full = path.join(dir, file)
    return fs.statSync(full).isDirectory() ? walk(full) : [full]
  })
}

function ensureDir(file: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
}

function getImportPath(tsFile: string, outFile: string): string {
  const tsJsPath = tsFile.replace(/\.ts$/, '.js')
  let relative = path.relative(path.dirname(outFile), tsJsPath)
  relative = relative.replace(/\\/g, '/') // Windows-safe

  // Ensure it starts with "./" or "../"
  if (!relative.startsWith('.')) {
    relative = './' + relative
  }

  return relative
}

async function run() {
  const files = walk(SRC_DIR).filter((f) => f.endsWith('.ts'))

  for (const tsFile of files) {
    const relative = path.relative(SRC_DIR, tsFile)
    const outFile = path.join(OUT_DIR, relative.replace(/\.ts$/, '.zod.ts'))

    const sourceText = fs.readFileSync(tsFile, 'utf8')

    const result = generate({
      sourceText,
      keepComments: true
    })

    if (result.errors.length > 0) {
      console.warn('Generation errors in', tsFile, result.errors)
    }

    const importPath = getImportPath(tsFile, outFile)
    const zodFileText = result.getZodSchemasFile(importPath)

    ensureDir(outFile)
    fs.writeFileSync(outFile, zodFileText, 'utf8')

    console.log('Generated:', outFile)
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
