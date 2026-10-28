import type { CharacterBuilderFeatCatalogRecord } from '@artificer-toolkit/rules-runtime/character/builderCatalog'
import { authoredEquipmentOptionFactsSchema } from '@artificer-toolkit/schema/api/authoredOptions'
import type { ContentSnapshotIndexEntry } from '@artificer-toolkit/schema/api/contentSnapshots'
import type { CharacterBuilderContext } from '@artificer-toolkit/rules-runtime/character/builderTypes'
import type { CharacterPresentationLookup } from '@artificer-toolkit/rules-runtime/character/characterRuleContext'
import {
  assembleCharacterBuilderContext,
  prepareActiveCharacterBuilderContext,
  requireCharacterPresentation
} from '@artificer-toolkit/rules-runtime/character/contextPreparation'
import { toContentSnapshotIndexEntry } from '@artificer-toolkit/rules-runtime/contentSnapshots'
import type { CharacterAuthored, ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { QueryCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import {
  canReadCharacterRoot,
  loadCharacterRuleContext,
  readCharacterSources,
  readCharacterPublication,
  readCharacterSourceRoots
} from './context'

/** A loaded source context; commit's referenced context carries no presentation (D163). */
export type CharacterSourceContext = Omit<
  Awaited<ReturnType<typeof loadCharacterBuilderContext>>,
  'presentation'
> &
  Pick<CharacterBuilderContext, 'presentation'>

/**
 * The server's Builder context. `resolution` reads the pools that can affect readiness (Sheet
 * repairs, Campaign assignment and source-loss reconciliation); `active` reads what the Sheet
 * needs. The picker pools are the browser's (ADR 0036 S6); commit reads referenced content (S7).
 */
export async function loadCharacterBuilderContext(
  ctx: QueryCtx,
  character: CharacterAuthored,
  userId: string,
  catalogScope: 'resolution' | 'active',
  authorityScope?: import('../campaigns/authority').CampaignInternalScope,
  referenceSpellIds: readonly string[] = []
): Promise<
  CharacterBuilderContext & {
    creaturesById: Awaited<ReturnType<typeof loadCharacterRuleContext>>['creaturesById']
    vehiclesById: Awaited<ReturnType<typeof loadCharacterRuleContext>>['vehiclesById']
    presentation: CharacterPresentationLookup
    sourceAccess: Awaited<ReturnType<typeof readCharacterSources>>
    publications: Awaited<ReturnType<typeof loadCharacterRuleContext>>['publications']
    sourceIdentities: Awaited<ReturnType<typeof loadCharacterRuleContext>>['sourceIdentities']
    spellCatalogueEntries: Awaited<
      ReturnType<typeof loadCharacterRuleContext>
    >['spellCatalogueEntries']
    currentSpellsById: Awaited<ReturnType<typeof loadCharacterRuleContext>>['currentSpellsById']
  }
> {
  const context = requireCharacterPresentation(
    await loadCharacterRuleContext(
      ctx,
      character,
      userId,
      undefined,
      authorityScope,
      undefined,
      referenceSpellIds,
      catalogScope === 'active' ? 'classLists' : 'complete'
    )
  )
  const sources = context.sourceAccess
  if (catalogScope === 'active') {
    return prepareActiveCharacterBuilderContext(character, context, async () => {
      const roots = await readCharacterSourceRoots(ctx, character.systemId, sources, 'CLASS')
      roots.sort(
        (left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id)
      )
      const classes: ClassAuthored[] = []
      for (const root of roots) {
        const published = context.publications.has(root.id)
          ? context.publications.get(root.id)
          : await readCharacterPublication(
              ctx,
              root,
              character.systemId,
              userId,
              sources,
              context.sourceIdentities
            )
        if (published?.subjectKind === 'CLASS') classes.push(published.document as ClassAuthored)
      }
      return classes
    })
  }
  const readRoots = (kind: Doc<'authoredRoots'>['subjectKind']) =>
    readCharacterSourceRoots(ctx, character.systemId, sources, kind)
  return assembleCharacterBuilderContext(character, context, {
    scope: 'resolution',
    readers: {
      readClasses: async () =>
        (
          await Promise.all(
            (await readRoots('CLASS')).map(async (root) =>
              context.publications.has(root.id)
                ? context.publications.get(root.id)
                : await readCharacterPublication(
                    ctx,
                    root,
                    character.systemId,
                    userId,
                    sources,
                    context.sourceIdentities
                  )
            )
          )
        ).flatMap((published) =>
          published?.subjectKind === 'CLASS' ? [toContentSnapshotIndexEntry(published)] : []
        ),
      readEquipment: async () =>
        readCharacterEquipmentCatalogue(
          ctx,
          await readRoots('EQUIPMENT'),
          character.systemId,
          userId,
          sources,
          context.sourceIdentities
        ),
      readFeats: async () =>
        readCharacterFeatCatalogue(
          ctx,
          await readRoots('FEAT'),
          character.systemId,
          userId,
          sources,
          context.sourceIdentities
        )
    }
  })
}

/** Readable Equipment among `roots`, from their stored builder projections alone (D163). */
export async function readCharacterEquipmentCatalogue(
  ctx: QueryCtx,
  roots: readonly Doc<'authoredRoots'>[],
  systemId: string,
  userId: string,
  sources: Awaited<ReturnType<typeof readCharacterSources>>,
  sourceIdentities: Awaited<ReturnType<typeof loadCharacterRuleContext>>['sourceIdentities']
): Promise<{ entries: ContentSnapshotIndexEntry<'EQUIPMENT'>[] }> {
  const entries: ContentSnapshotIndexEntry<'EQUIPMENT'>[] = []
  for (const root of roots) {
    if (root.subjectKind !== 'EQUIPMENT' || root.systemId !== systemId)
      throw new Error('Stored Character source System mismatch.')
    if (!(await canReadCharacterRoot(ctx, root, systemId, userId, sources, sourceIdentities)))
      continue
    const facts =
      root.equipmentOptions && authoredEquipmentOptionFactsSchema.parse(root.equipmentOptions)
    const builder = facts?.builder
    if (!facts || !builder || facts.checksum !== root.checksum)
      throw new Error('Stored Equipment builder facts are missing or stale.')
    if (
      builder.parentEquipmentId !== root.parentEquipmentId ||
      (facts.category === 'VARIANT') !== (root.parentEquipmentId !== null)
    )
      throw new Error('Stored Equipment parent metadata mismatch.')
    // Parent graph verification is shared with the snapshot path in `assembleCharacterBuilderContext`.
    entries.push({
      id: root.id,
      label: root.label,
      parentEquipmentId: builder.parentEquipmentId,
      category: builder.category,
      isContainer: builder.isContainer,
      ...(builder.maxStack === undefined ? {} : { maxStack: builder.maxStack }),
      properties: [...builder.properties],
      requiresAttunement: builder.requiresAttunement
    })
  }
  return { entries }
}

export async function readCharacterFeatCatalogue(
  ctx: QueryCtx,
  roots: readonly Doc<'authoredRoots'>[],
  systemId: string,
  userId: string,
  sources: Awaited<ReturnType<typeof readCharacterSources>>,
  sourceIdentities: Awaited<ReturnType<typeof loadCharacterRuleContext>>['sourceIdentities']
): Promise<CharacterBuilderFeatCatalogRecord[]> {
  const records: CharacterBuilderFeatCatalogRecord[] = []
  for (const root of roots) {
    if (root.subjectKind !== 'FEAT' || root.systemId !== systemId)
      throw new Error('Stored Character source System mismatch.')
    if (await canReadCharacterRoot(ctx, root, systemId, userId, sources, sourceIdentities))
      records.push({ id: root.id, label: root.label })
  }
  return records
}
