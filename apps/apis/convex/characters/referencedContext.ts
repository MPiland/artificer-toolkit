import { assembleCharacterReferencedBuilderContext } from '@artificer-toolkit/rules-runtime/character/contextPreparation'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { readRootCatalogue } from '../content/catalogueMetadata'
import { assertClassRelationshipsIndexed } from '../content/classRelationshipIndex'
import { contentStream } from '../content/streams'
import { isImportRowVisible } from '../imports/visibility'
import { readCharacterEquipmentCatalogue, readCharacterFeatCatalogue } from './builderContext'
import {
  canReadCharacterRoot,
  loadCharacterRuleContext,
  readSpellIndexEntry,
  type CharacterReferencedReads
} from './context'
import { rejectUnavailableSource } from './sourceReads'

type RuleContext = Awaited<ReturnType<typeof loadCharacterRuleContext>>

// Mirrors the complete pools' per-kind bound in `readCharacterSourceRoots`.
const POOL_SCAN_LIMIT = 500

/**
 * Commit's Builder context (ADR 0036 S7): the Character's referenced content, read by id, plus one
 * bounded witness read per pool-emptiness outcome. Referenced content that cannot be read fails
 * closed with `SOURCE_UNAVAILABLE`.
 */
export async function loadCharacterReferencedContext(
  ctx: QueryCtx,
  character: CharacterAuthored,
  userId: string,
  reads: CharacterReferencedReads
) {
  const context = await loadCharacterRuleContext(
    ctx,
    character,
    userId,
    undefined,
    undefined,
    reads
  )
  requireReferencedSources(character, context, reads)
  const { systemId } = character
  const { sourceAccess: sources, sourceIdentities } = context
  const sourceById = new Map(sources.sources.map((source) => [source.id, source]))
  const { roots } = reads

  async function readRoot(id: string) {
    if (!roots.has(id))
      roots.set(
        id,
        await ctx.db
          .query('authoredRoots')
          .withIndex('by_publicId', (q) => q.eq('id', id))
          .unique()
      )
    return roots.get(id) ?? null
  }

  /** Membership in `readCharacterSourceRoots`; readability is decided by `canRead`. */
  async function isPoolRoot(root: Doc<'authoredRoots'>) {
    if (root.systemId !== systemId) return false
    const source = sourceById.get(root.contentSourceId)
    const inSource =
      source !== undefined &&
      root.ownerUserId === (source.kind === 'USER' ? source.ownerUserId : undefined)
    if (!inSource && sources.campaign === null) return false
    return isImportRowVisible(ctx, root.importJobId)
  }

  async function readPoolRoots(kind: Doc<'authoredRoots'>['subjectKind'], ids: Iterable<string>) {
    const found: Doc<'authoredRoots'>[] = []
    for (const id of ids) {
      const root = await readRoot(id)
      if (root?.subjectKind === kind && (await isPoolRoot(root))) found.push(root)
    }
    return found
  }

  /** Candidate roots in pool order, or the listed candidates; stops where the caller stops. */
  async function* poolRoots(
    kind: Doc<'authoredRoots'>['subjectKind'],
    candidateIds: readonly string[] | null
  ) {
    if (candidateIds) {
      yield* await readPoolRoots(kind, candidateIds)
      return
    }
    let scanned = 0
    const count = () => {
      if (++scanned > POOL_SCAN_LIMIT)
        throw new Error('Character sources require paginated search.')
    }
    for (const source of sources.sources) {
      for await (const root of contentStream(ctx.db)
        .query('authoredRoots')
        .withIndex('by_contentSourceId_subjectKind_ownerUserId', (q) =>
          q
            .eq('contentSourceId', source.id)
            .eq('subjectKind', kind)
            .eq('ownerUserId', source.kind === 'USER' ? source.ownerUserId : undefined)
        )
        .filterWith((root) => isImportRowVisible(ctx, root.importJobId))) {
        count()
        yield root
      }
    }
    const { campaign } = sources
    if (!campaign) return
    for await (const share of ctx.db
      .query('campaignContentShares')
      .withIndex('by_campaignId_subjectKind_subjectId', (q) =>
        q.eq('campaignId', campaign.id).eq('subjectKind', kind)
      )) {
      count()
      const root = await readRoot(share.subjectId)
      if (root && (await isImportRowVisible(ctx, root.importJobId))) yield root
    }
  }

  const canRead = (root: Doc<'authoredRoots'>) =>
    canReadCharacterRoot(ctx, root, systemId, userId, sources, sourceIdentities)

  /** Readable Equipment among `members`, with their parents, which the Builder's verification needs. */
  async function readEquipmentPool(members: readonly Doc<'authoredRoots'>[]) {
    const found = [...members]
    for (let index = 0; index < found.length; index += 1) {
      const parentId = found[index]!.parentEquipmentId
      if (parentId && !found.some((root) => root.id === parentId))
        found.push(...(await readPoolRoots('EQUIPMENT', [parentId])))
    }
    return readCharacterEquipmentCatalogue(ctx, found, systemId, userId, sources, sourceIdentities)
  }

  return assembleCharacterReferencedBuilderContext(character, context, {
    readEquipment: async (ids) => readEquipmentPool(await readPoolRoots('EQUIPMENT', ids)),
    readFeats: async (ids) =>
      readCharacterFeatCatalogue(
        ctx,
        await readPoolRoots('FEAT', ids),
        systemId,
        userId,
        sources,
        sourceIdentities
      ),
    findSubclass: async (classId) => {
      await assertClassRelationshipsIndexed(ctx, systemId)
      let scanned = 0
      for await (const root of ctx.db
        .query('authoredRoots')
        .withIndex('by_system_kind_parentClassId', (q) =>
          q.eq('systemId', systemId).eq('subjectKind', 'CLASS').eq('parentClassId', classId)
        )) {
        if (++scanned > POOL_SCAN_LIMIT)
          throw new Error('Character sources require paginated search.')
        if (!(await isPoolRoot(root)) || !(await canRead(root))) continue
        const subclass = readRootCatalogue(root).class
        if (subclass?.category === 'SUBCLASS' && subclass.parentClassId === classId)
          return subclass
      }
      return null
    },
    findEquipment: async (candidateIds, matches) => {
      for await (const root of poolRoots('EQUIPMENT', candidateIds)) {
        const pool = await readEquipmentPool([root])
        if (matches(pool, root.id)) return pool
      }
      return null
    },
    findSpell: async (candidateIds, matches) => {
      for await (const root of poolRoots('SPELL', candidateIds)) {
        if (!(await canRead(root))) continue
        const spell = readSpellIndexEntry(root)
        if (matches(spell)) return spell
      }
      return null
    },
    findFeat: async (candidateIds, matches) => {
      for await (const root of poolRoots('FEAT', candidateIds)) {
        const [record] = await readCharacterFeatCatalogue(
          ctx,
          [root],
          systemId,
          userId,
          sources,
          sourceIdentities
        )
        if (record && matches(record)) return record
      }
      return null
    }
  })
}

/**
 * Every structural reference must name readable content of its kind. Held Equipment with retained
 * rules, and Sheet-owned Creatures and Vehicles, keep their existing source-loss handling.
 */
function requireReferencedSources(
  character: CharacterAuthored,
  context: RuleContext,
  reads: CharacterReferencedReads
) {
  const { intent, state } = character
  const inventory = state.equipment.inventory
  const heldWithoutRules = new Set(
    inventory.filter((item) => !item.retainedRulesJson).map((item) => item.equipmentId)
  )
  const exempt = new Set([
    ...inventory.map((item) => item.equipmentId).filter((id) => !heldWithoutRules.has(id)),
    ...(state.creatures ?? []).map((instance) => instance.creatureId),
    ...(state.vehicles ?? []).map((instance) => instance.vehicleId)
  ])
  const required: ReadonlyArray<
    readonly [string | undefined, 'RACE' | 'CLASS' | 'BACKGROUND' | 'FEAT' | 'EQUIPMENT']
  > = [
    [intent.race.raceId, 'RACE'],
    [intent.race.subraceId, 'RACE'],
    ...intent.classes.flatMap((row) => [
      [row.classId, 'CLASS'] as const,
      [row.subclassId, 'CLASS'] as const
    ]),
    [intent.background.backgroundId, 'BACKGROUND'],
    ...intent.featureAcquisitions.flatMap((row) =>
      row.source.kind === 'FEAT' ? [[row.source.featId, 'FEAT'] as const] : []
    ),
    ...[intent.startingEquipment?.class, intent.startingEquipment?.background]
      .flatMap((decision) => decision?.groups ?? [])
      .flatMap((group) => group.selections ?? [])
      .map((selection) => [selection.equipmentId, 'EQUIPMENT'] as const),
    ...[...heldWithoutRules].map((id) => [id, 'EQUIPMENT'] as const)
  ]
  for (const [id, kind] of required)
    if (id && reads.rulePublications.get(id)?.subjectKind !== kind) rejectUnavailableSource(id)
  // Spells are read only when the Character needs its Spell catalogue.
  for (const id of [
    ...(intent.spellSelections ?? []).flatMap((selection) => selection.spells),
    ...(state.classes ?? []).flatMap((entry) => [
      ...(entry.spells?.learned ?? []),
      ...(entry.spells?.prepared ?? [])
    ])
  ])
    if (
      reads.rulePublications.has(id) &&
      reads.rulePublications.get(id)?.subjectKind !== 'SPELL'
    )
      rejectUnavailableSource(id)
  for (const id of reads.unreadableRootIds) if (!exempt.has(id)) rejectUnavailableSource(id)
}
