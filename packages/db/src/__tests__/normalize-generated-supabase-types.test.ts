import { describe, expect, it } from 'vitest'

import { normalizeGeneratedSupabaseTypes } from '../scripts/normalizeGeneratedSupabaseTypes.js'

const redundantConstraint = `  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },`
const normalizedConstraint =
  '  PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals },'

function generatedTypes(compositeTypes: string, constraint = redundantConstraint): string {
  return `export type Database = {
  public: {
    Tables: Record<never, never>
    CompositeTypes: ${compositeTypes}
  }
  storage: {
    CompositeTypes: Record<never, never>
  }
}

export type CompositeTypes<
${constraint}
> = never
`
}

describe('normalizeGeneratedSupabaseTypes', () => {
  it('removes the impossible default-schema branch when public composite types are empty', () => {
    const normalized = normalizeGeneratedSupabaseTypes(generatedTypes('Record<never, never>'))

    expect(normalized).toContain(normalizedConstraint)
    expect(normalized).not.toContain(redundantConstraint)
  })

  it('is idempotent after the generated constraint is normalized', () => {
    const source = generatedTypes('Record<never, never>', normalizedConstraint)

    expect(normalizeGeneratedSupabaseTypes(source)).toBe(source)
  })

  it('preserves the default-schema branch when public composite types exist', () => {
    const source = generatedTypes('{ address: { street: string } }')

    expect(normalizeGeneratedSupabaseTypes(source)).toBe(source)
  })

  it('fails when empty composite output no longer matches the known generator shape', () => {
    const source = generatedTypes(
      'Record<never, never>',
      '  PublicCompositeTypeNameOrOptions extends unknown,'
    )

    expect(() => normalizeGeneratedSupabaseTypes(source)).toThrow(
      'Supabase changed its empty CompositeTypes output'
    )
  })
})
