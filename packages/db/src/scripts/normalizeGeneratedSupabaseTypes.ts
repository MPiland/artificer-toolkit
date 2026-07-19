import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const GENERATED_TYPES_FILE = fileURLToPath(
  new URL('../types/supabase.database.ts', import.meta.url)
)

const compositeConstraints = [
  {
    redundant: `  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },`,
    normalized: '  PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals },'
  },
  {
    redundant: `  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },`,
    normalized: '  PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals },'
  }
] as const

/**
 * Removes the impossible default-schema branch that Supabase emits when the
 * public schema has no composite types. The schema-qualified branch remains
 * available for composite types in other generated schemas.
 */
export function normalizeGeneratedSupabaseTypes(source: string): string {
  if (!source.includes('export type Database')) {
    throw new Error('Supabase type generation did not produce a Database type.')
  }

  if (!publicSchemaHasNoCompositeTypes(source)) return source

  for (const constraint of compositeConstraints) {
    const occurrences = source.split(constraint.redundant).length - 1
    if (occurrences > 1) {
      throw new Error('Supabase generated more than one default CompositeTypes constraint.')
    }
    if (occurrences === 1) {
      return source.replace(constraint.redundant, constraint.normalized)
    }
    if (source.includes(constraint.normalized)) return source
  }

  throw new Error('Supabase changed its empty CompositeTypes output; update the normalizer.')
}

function publicSchemaHasNoCompositeTypes(source: string): boolean {
  const publicSchemaStart = source.indexOf('\n  public: {')
  const nextSchemaStart = source.indexOf('\n  storage: {', publicSchemaStart)
  const compositeTypesStart = source.indexOf('\n    CompositeTypes:', publicSchemaStart)

  if (publicSchemaStart < 0 || compositeTypesStart < 0) {
    throw new Error('Supabase generated types do not contain the public CompositeTypes declaration.')
  }
  if (nextSchemaStart >= 0 && compositeTypesStart > nextSchemaStart) {
    throw new Error('Supabase generated types do not contain public CompositeTypes.')
  }

  const compositeDeclarationEnd = nextSchemaStart >= 0 ? nextSchemaStart : source.length
  const compositeDeclaration = source.slice(compositeTypesStart, compositeDeclarationEnd)

  return /CompositeTypes:\s*(?:Record<never,\s*never>|\{\s*\[_ in never\]: never\s*\})/.test(
    compositeDeclaration
  )
}

async function main(): Promise<void> {
  const generatedTypes = await readFile(GENERATED_TYPES_FILE, 'utf8')
  const normalizedTypes = normalizeGeneratedSupabaseTypes(generatedTypes)
  await writeFile(GENERATED_TYPES_FILE, normalizedTypes)
}

const entryPoint = process.argv[1]
if (entryPoint && pathToFileURL(resolve(entryPoint)).href === import.meta.url) {
  await main()
}
