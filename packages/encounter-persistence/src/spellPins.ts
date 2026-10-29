import {
  authoredStoredCompilationSchema,
  type AuthoredStoredCompilation
} from '@artificer-toolkit/schema/api/authoredPublication'
import { snapshotFeatureDefinitions } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { hydrateStoredCompilation } from '@artificer-toolkit/rules-runtime/authoredPublicationHydrate'
import type { CompiledSpell } from '@artificer-toolkit/shared/subjects/compilers'
import { deriveOnce } from './transactionReads.js'
import type { EncounterCommandReadPorts } from './ports.js'
import type { EncounterDocument, EncounterReadContext, EncounterWriteContext } from './store.js'

/** The Spell IDs a Creature snapshot's Feature spell grants name, each once. */
export function creatureSnapshotSpellIds(snapshot: unknown): readonly string[] {
  const ids = new Set<string>()
  for (const feature of snapshotFeatureDefinitions({ kind: 'CREATURE', snapshot }))
    for (const grant of feature.grants?.spells ?? [])
      if (grant.authoringModeKind === 'SELECTED') for (const id of grant.spellIds) ids.add(id)
  return [...ids]
}

function readPinRow(ctx: EncounterReadContext, encounterId: string, spellId: string) {
  return ctx.db
    .query('encounterSpellPins')
    .withIndex('by_encounterId_spellId', (q) =>
      q.eq('encounterId', encounterId).eq('spellId', spellId)
    )
    .unique()
}

type SpellPinRow = Pick<
  EncounterDocument<'encounterSpellPins'>,
  'spellId' | 'sourceChecksum' | 'compilationJson'
>

function parsePinRow(row: SpellPinRow): CompiledSpell {
  const compilation: AuthoredStoredCompilation = authoredStoredCompilationSchema.parse(
    JSON.parse(row.compilationJson)
  )
  return hydrateStoredCompilation(
    'SPELL',
    { id: row.spellId, checksum: row.sourceChecksum },
    compilation
  )
}

/** A pin row's compiled Spell; fails closed on another compiler version or a corrupt compilation. */
export function readStoredSpellPin(row: SpellPinRow): CompiledSpell {
  return deriveOnce(row, parsePinRow)
}

/** The compiled Spells of pin rows read elsewhere (the room's capture), by Spell ID; nothing compiles. */
export function hydrateSpellPins(rows: readonly SpellPinRow[]): ReadonlyMap<string, CompiledSpell> {
  return new Map(rows.map((row) => [row.spellId, readStoredSpellPin(row)]))
}

/**
 * Pins each Spell the snapshots' Creatures name, once per Run (D163): a Spell the Run already holds
 * is never read again, so a later edit of the source cannot change what its actors cast. `userId`
 * reads the sources as the Campaign owner does for the actors' own Creatures.
 */
export async function ensureEncounterSpellPins(
  ctx: EncounterWriteContext,
  readSource: EncounterCommandReadPorts['readEncounterSource'],
  input: {
    encounterId: string
    userId: string
    systemId: string
    snapshots: readonly unknown[]
  }
) {
  const spellIds = new Set(input.snapshots.flatMap(creatureSnapshotSpellIds))
  for (const spellId of spellIds) {
    if (await readPinRow(ctx, input.encounterId, spellId)) continue
    const source = await readSource(input.userId, input.systemId, spellId, 'SPELL')
    await ctx.db.insert('encounterSpellPins', {
      encounterId: input.encounterId,
      spellId,
      sourceRevision: source.version,
      sourceVersionId: source.versionId,
      sourceChecksum: source.checksum,
      compilationJson: JSON.stringify(source.compilation)
    })
  }
}

/** The Run's stored pin rows. */
export function readEncounterSpellPinRows(ctx: EncounterReadContext, encounterId: string) {
  return ctx.db
    .query('encounterSpellPins')
    .withIndex('by_encounterId_spellId', (q) => q.eq('encounterId', encounterId))
    .collect()
}

/** The Run's pinned Spells by ID, hydrated from their stored compilations; nothing compiles. */
export async function readEncounterSpellPins(
  ctx: EncounterReadContext,
  encounterId: string
): Promise<ReadonlyMap<string, CompiledSpell>> {
  return hydrateSpellPins(await readEncounterSpellPinRows(ctx, encounterId))
}
