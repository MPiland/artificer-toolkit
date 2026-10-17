import { Migrations } from '@convex-dev/migrations'
import { buildCharacterGrantFoldModifierFacts } from '@artificer-toolkit/rules-runtime/character/characterGrantFoldSourceFacts'
import { modifierGrantDtoSchema } from '@artificer-toolkit/schema/grants/modifier'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { compileModifierGrant } from '@artificer-toolkit/shared/compilers'
import { components, internal } from '../_generated/api'
import schema from '../schema'
import { internalMutation } from '../lib/mutations'

/**
 * PLATFORM-20 backfill: a frozen modifier operation carried its compiled grant as a `grant` JSON
 * dump. It now carries the grant's typed `scope` and `payload` and the class resources it scopes
 * to, rebuilt from that dump by the grant compiler and fold fact builder. Each rewritten definition
 * is validated and re-checksummed. Idempotent: a definition with no dump is left alone.
 */
const migrations = new Migrations(components.migrations, { schema, internalMutation })

function upcastModifierOperations(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(upcastModifierOperations)
  if (typeof value !== 'object' || value === null) return value
  if ('grantId' in value && 'modifierKind' in value && 'grant' in value) {
    const { grant, ...operation } = value
    const [fact] = buildCharacterGrantFoldModifierFacts([
      compileModifierGrant(modifierGrantDtoSchema.parse(grant))
    ])
    if (fact === undefined) throw new Error('A modifier grant builds one fold fact.')
    return {
      ...operation,
      scope: fact.scope,
      ...(fact.payload === undefined ? {} : { payload: fact.payload }),
      scopeResourceIds: fact.scopeResourceIds
    }
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, upcastModifierOperations(entry)])
  )
}

function migratedDefinition(definitionJson: string) {
  const stored: unknown = JSON.parse(definitionJson)
  const upcast = upcastModifierOperations(stored)
  if (JSON.stringify(upcast) === JSON.stringify(stored)) return undefined
  const definition = activeRuleEffectDefinitionDtoSchema.parse(upcast)
  return {
    definitionJson: JSON.stringify(definition),
    definitionChecksum: checksumCanonicalJson(definition)
  }
}

// Definitions can approach the document size limit.
export const characterEffectModifierOperations = migrations.define({
  table: 'characterActiveRuleEffects',
  batchSize: 1,
  migrateOne: (_ctx, row) => migratedDefinition(row.definitionJson)
})

export const encounterEffectModifierOperations = migrations.define({
  table: 'encounterActiveRuleEffects',
  batchSize: 1,
  migrateOne: (_ctx, row) => migratedDefinition(row.definitionJson)
})

export const spatialEffectModifierOperations = migrations.define({
  table: 'encounterSpatialRuleEffects',
  batchSize: 1,
  migrateOne: (_ctx, row) => migratedDefinition(row.definitionJson)
})

export const run = migrations.runner([
  internal.rules.modifierOperationMigration.characterEffectModifierOperations,
  internal.rules.modifierOperationMigration.encounterEffectModifierOperations,
  internal.rules.modifierOperationMigration.spatialEffectModifierOperations
])
