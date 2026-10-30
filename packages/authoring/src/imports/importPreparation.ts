import * as core from 'zod/v4/core'
import type { AuthoredSubjectKindDto } from '@artificer-toolkit/schema/api/content'
import type {
  ArtificerPortableContentDto,
  ImportBatchInputDto,
  ImportCollisionChoiceDto,
  ImportCollisionDto,
  ImportExistingMatchDto,
  ImportIssueDto,
  ImportNotImportedDto,
  ImportPreviewItemDto,
  ImportPreviewResponseDto,
  ImportSourceDto
} from '@artificer-toolkit/schema/api/imports'
import {
  IMPORT_MAX_BATCH_BYTES,
  IMPORT_MAX_BATCH_RELATIONSHIPS
} from '@artificer-toolkit/schema/api/imports'
import { backgroundAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/background'
import { classAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/class'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { featAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/feat'
import { raceAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/race'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import { vehicleAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/vehicle'

import {
  parseArtificerPortableEntry,
  parseDndBeyondCharacterPayload,
  parseDndBeyondCharacterUrl,
  parseFoundryActorPayload,
  type ExternalCustomContent,
  type ExternalContentReference,
  type ParsedExternalCharacter
} from './importParsers.js'
import {
  isCompleteExternalCustomContent,
  normalizeImportedAuthoredPayload
} from './importedAuthoredPayload.js'
import {
  applyImportedEquipmentTerms,
  type ImportedEquipmentVocabulary
} from './importedEquipmentTerms.js'
import { applyImportedWeaponAttack, type ImportedVocabularyEntry } from './importedWeaponAttack.js'
const DND_BEYOND_RESPONSE_MAX_BYTES = 10 * 1024 * 1024
const DND_BEYOND_TIMEOUT_MS = 15_000

class DndBeyondImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DndBeyondImportError'
  }
}

export async function fetchFrozenDndBeyondPayload(
  characterId: string,
  fetcher: typeof fetch,
  budget: { remainingBytes: number }
): Promise<{ text: string; payload: unknown; utf8ByteLength: number }> {
  const endpoint = `https://character-service.dndbeyond.com/character/v5/character/${characterId}?includeCustomItems=true`
  const response = await fetcher(endpoint, {
    headers: { accept: 'application/json' },
    credentials: 'omit',
    redirect: 'error',
    signal: AbortSignal.timeout(DND_BEYOND_TIMEOUT_MS)
  })
  if (!response.ok) {
    throw new DndBeyondImportError(
      response.status === 401 || response.status === 403 || response.status === 404
        ? 'The D&D Beyond character is private or unavailable.'
        : `D&D Beyond returned ${response.status}.`
    )
  }
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > DND_BEYOND_RESPONSE_MAX_BYTES) {
    throw new DndBeyondImportError('The D&D Beyond character response is too large.')
  }
  if (Number.isFinite(contentLength) && contentLength > budget.remainingBytes) {
    throw new DndBeyondImportError('The D&D Beyond import batch exceeds 25 MiB.')
  }
  const frozen = await readCappedDndBeyondResponse(response, budget)
  try {
    return {
      ...frozen,
      payload: JSON.parse(frozen.text) as unknown
    }
  } catch {
    throw new DndBeyondImportError('D&D Beyond returned malformed character data.')
  }
}

async function readCappedDndBeyondResponse(
  response: Response,
  budget: { remainingBytes: number }
): Promise<{ text: string; utf8ByteLength: number }> {
  if (!response.body) {
    const text = await response.text()
    const utf8ByteLength = new TextEncoder().encode(text).byteLength
    consumeDndBeyondBytes(utf8ByteLength, budget)
    return { text, utf8ByteLength }
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let bytes = 0
  while (true) {
    const result = await reader.read()
    if (result.done) break
    bytes += result.value.byteLength
    if (bytes > DND_BEYOND_RESPONSE_MAX_BYTES || result.value.byteLength > budget.remainingBytes) {
      await reader.cancel()
      if (bytes > DND_BEYOND_RESPONSE_MAX_BYTES) {
        throw new DndBeyondImportError('The D&D Beyond character response is too large.')
      }
      budget.remainingBytes = 0
      throw new DndBeyondImportError('The D&D Beyond import batch exceeds 25 MiB.')
    }
    budget.remainingBytes -= result.value.byteLength
    chunks.push(result.value)
  }
  const combined = new Uint8Array(bytes)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }
  return {
    text: new TextDecoder().decode(combined),
    utf8ByteLength: bytes
  }
}

function consumeDndBeyondBytes(bytes: number, budget: { remainingBytes: number }): void {
  if (!Number.isSafeInteger(bytes) || bytes < 0) {
    throw new DndBeyondImportError('The frozen D&D Beyond response byte length is invalid.')
  }
  if (bytes > DND_BEYOND_RESPONSE_MAX_BYTES) {
    throw new DndBeyondImportError('The D&D Beyond character response is too large.')
  }
  if (bytes > budget.remainingBytes) {
    budget.remainingBytes = 0
    throw new DndBeyondImportError('The D&D Beyond import batch exceeds 25 MiB.')
  }
  budget.remainingBytes -= bytes
}
type CharacterSource = Extract<ImportSourceDto, 'DND_BEYOND' | 'FOUNDRY_DND5E'>
type FoundryEntry = Extract<ImportBatchInputDto, { source: 'FOUNDRY_DND5E' }>['entries'][number]
type FoundryParsedEntry =
  | { entry: FoundryEntry; parsed: ParsedExternalCharacter }
  | { entry: FoundryEntry; failure: PreparedUnableItem }

const IMPORT_BATCH_TOO_COMPLEX_MESSAGE =
  'The import batch contains too many relationships to prepare safely.'

const authoredSchemaByKind = {
  BACKGROUND: { schema: backgroundAuthoredDtoSchema },
  CLASS: { schema: classAuthoredDtoSchema },
  CREATURE: { schema: creatureAuthoredDtoSchema },
  EQUIPMENT: { schema: equipmentAuthoredDtoSchema },
  FEAT: { schema: featAuthoredDtoSchema },
  RACE: { schema: raceAuthoredDtoSchema },
  SPELL: { schema: spellAuthoredDtoSchema },
  VEHICLE: { schema: vehicleAuthoredDtoSchema }
} satisfies Record<AuthoredSubjectKindDto, { schema: core.$ZodType }>
export interface ImportPreparationDependencies {
  createId?: () => string
  fetch?: typeof fetch
  loadFrozenDndBeyondPayload?: (
    entryId: string,
    characterId: string
  ) => Promise<{
    payload: unknown
    utf8ByteLength: number
  }>
}

/**
 * Storage reads needed to prepare an import. Implementations may read from SQL,
 * Convex, or another persistence boundary; preparation itself stays storage-agnostic.
 */
export interface ImportPreparationLookup {
  findImportReference(input: {
    userId: string
    source: ImportSourceDto
    subjectKind: AuthoredSubjectKindDto | 'CHARACTER'
    externalId: string
  }): Promise<{ subjectId: string } | null>
  findActiveAuthored(input: { subjectKind: AuthoredSubjectKindDto; subjectId: string }): Promise<{
    subjectId: string
    ownerUserId: string | null
    label: string
    isMaster: boolean
  } | null>
  findAuthoredDraft(input: {
    subjectKind: AuthoredSubjectKindDto
    subjectId: string
    userId: string
  }): Promise<{ label: string } | null>
  findActiveMasterLabelCandidates(input: {
    subjectKind: AuthoredSubjectKindDto
  }): Promise<Array<{ subjectId: string; label: string }>>
  findCharacter(input: { characterId: string }): Promise<{ userId: string; label: string } | null>
  findCharacterDraft(input: {
    characterId: string
    userId: string
  }): Promise<{ label: string } | null>
  /** The vocabulary a System defines, or null when the System is not readable. */
  findSystemVocabulary(input: { systemId: string }): Promise<ImportSystemVocabulary | null>
}

/** The System vocabulary custom imported content resolves its named terms against. */
export interface ImportSystemVocabulary extends ImportedEquipmentVocabulary {
  damageTypes: readonly ImportedVocabularyEntry[]
}

const EMPTY_SYSTEM_VOCABULARY: ImportSystemVocabulary = {
  damageTypes: [],
  rarities: []
}

export interface ResolvedReference extends ExternalContentReference {
  subjectId?: string
  matchedLabel?: string
}

interface ResolvedExternalMatch {
  subjectId: string
  matchedLabel: string
}

export interface PreparedCharacterItem {
  kind: 'CHARACTER'
  entryId: string
  name: string
  label: string
  externalId: string
  source: CharacterSource
  parsed: ParsedExternalCharacter
  references: ResolvedReference[]
  customContent: PreparedCustomContent[]
  existingMatches: ImportExistingMatchDto[]
  notImported: ImportNotImportedDto[]
  targetId: string
  collision?: ImportCollisionDto
  issues: ImportIssueDto[]
}

export interface PreparedAuthoredItem {
  kind: 'AUTHORED'
  entryId: string
  name: string
  label: string
  externalId?: string
  envelope: ArtificerPortableContentDto
  targetId: string
  referenceIdMap: Map<string, string>
  collision?: ImportCollisionDto
  issues: ImportIssueDto[]
}

interface PreparedUnableItem {
  kind: 'UNABLE'
  entryId: string
  name: string
  issues: ImportIssueDto[]
}

export interface PreparedCustomContent extends ExternalCustomContent {
  targetId: string
  activate: boolean
  activationEligible: boolean
  issues: ImportIssueDto[]
}

type CustomContentResult =
  | {
      kind: 'EXISTING'
      existingId: string
      existingLabel: string
      custom: ExternalCustomContent
    }
  | { kind: 'NEW'; prepared: PreparedCustomContent }

export type PreparedItem = PreparedCharacterItem | PreparedAuthoredItem | PreparedUnableItem

export interface PreparedBatch {
  source: ImportSourceDto
  items: PreparedItem[]
  defaultSystemId?: string
  primaryRulesCatalogueId?: string
}

export async function prepareImportBatch(
  lookup: ImportPreparationLookup,
  input: ImportBatchInputDto,
  userId: string,
  resolutionByEntryId: ReadonlyMap<
    string,
    { choice: ImportCollisionChoiceDto; confirmDraftReplacement: boolean }
  >,
  customContentChoiceByKey: ReadonlyMap<string, 'ACTIVE' | 'DRAFT'>,
  dependencies: ImportPreparationDependencies = {}
): Promise<PreparedBatch> {
  const createId = dependencies.createId ?? (() => crypto.randomUUID())

  if (input.source === 'DND_BEYOND') {
    const defaultSystemId = input.systemId
    const parsedEntries: Array<
      | {
          entry: (typeof input.entries)[number]
          parsed: ParsedExternalCharacter
        }
      | { failure: PreparedUnableItem }
    > = []
    const responseBudget = { remainingBytes: IMPORT_MAX_BATCH_BYTES }
    for (const entry of input.entries) {
      const characterId = parseDndBeyondCharacterUrl(entry.url)
      if (!characterId) {
        parsedEntries.push({
          failure: unable(
            entry.entryId,
            entry.url,
            'INVALID_DND_BEYOND_URL',
            'Use a normal https://www.dndbeyond.com/characters/{id} character-sheet link.',
            ['url']
          )
        })
        continue
      }

      let payload: unknown
      try {
        if (dependencies.loadFrozenDndBeyondPayload) {
          const frozen = await dependencies.loadFrozenDndBeyondPayload(entry.entryId, characterId)
          consumeDndBeyondBytes(frozen.utf8ByteLength, responseBudget)
          payload = frozen.payload
        } else {
          payload = (
            await fetchFrozenDndBeyondPayload(
              characterId,
              dependencies.fetch ?? globalThis.fetch,
              responseBudget
            )
          ).payload
        }
      } catch (error) {
        if (!(error instanceof DndBeyondImportError)) throw error
        parsedEntries.push({
          failure: unable(entry.entryId, entry.url, 'DND_BEYOND_UNAVAILABLE', error.message, [])
        })
        continue
      }

      const parsed = parseDndBeyondCharacterPayload(payload, characterId)
      if (!parsed) {
        parsedEntries.push({
          failure: unable(
            entry.entryId,
            entry.url,
            'UNRECOGNIZED_DND_BEYOND_CHARACTER',
            'D&D Beyond returned a character shape this importer does not recognize.',
            []
          )
        })
        continue
      }
      parsedEntries.push({ entry, parsed })
    }

    const relationshipCount = parsedEntries.reduce(
      (total, entry) =>
        total +
        ('parsed' in entry
          ? entry.parsed.references.length + entry.parsed.customContent.length
          : 0),
      0
    )
    if (relationshipCount > IMPORT_MAX_BATCH_RELATIONSHIPS) {
      return {
        source: input.source,
        items: parsedEntries.map((parsedEntry) =>
          'parsed' in parsedEntry
            ? unable(
                parsedEntry.entry.entryId,
                parsedEntry.entry.url,
                'IMPORT_BATCH_TOO_COMPLEX',
                IMPORT_BATCH_TOO_COMPLEX_MESSAGE,
                []
              )
            : parsedEntry.failure
        )
      }
    }

    const items = await Promise.all(
      parsedEntries.map(async (parsedEntry): Promise<PreparedItem> => {
        if (!('parsed' in parsedEntry)) return parsedEntry.failure
        return prepareExternalCharacter(
          lookup,
          parsedEntry.entry.entryId,
          parsedEntry.entry.url,
          'DND_BEYOND',
          parsedEntry.parsed,
          userId,
          defaultSystemId,
          resolutionByEntryId.get(parsedEntry.entry.entryId)?.choice ?? 'COPY',
          customContentChoiceByKey,
          createId
        )
      })
    )
    return {
      source: input.source,
      items,
      defaultSystemId,
      primaryRulesCatalogueId: input.primaryRulesCatalogueId
    }
  }

  if (input.source === 'FOUNDRY_DND5E') {
    const parsedEntries: FoundryParsedEntry[] = input.entries.map((entry) => {
      try {
        const parsed = parseFoundryActorPayload(JSON.parse(entry.text))
        return parsed
          ? { entry, parsed }
          : {
              entry,
              failure: unable(
                entry.entryId,
                entry.name,
                'UNSUPPORTED_FOUNDRY_ACTOR',
                'Only Foundry dnd5e character Actor exports are supported.',
                []
              )
            }
      } catch {
        return {
          entry,
          failure: unable(
            entry.entryId,
            entry.name,
            'MALFORMED_JSON',
            'The selected Foundry file is not valid JSON.',
            []
          )
        }
      }
    })
    const relationshipCount = parsedEntries.reduce(
      (total, entry) =>
        total +
        ('parsed' in entry
          ? entry.parsed.references.length + entry.parsed.customContent.length
          : 0),
      0
    )
    if (relationshipCount > IMPORT_MAX_BATCH_RELATIONSHIPS) {
      return {
        source: input.source,
        items: parsedEntries.map((parsedEntry) =>
          'parsed' in parsedEntry
            ? unable(
                parsedEntry.entry.entryId,
                parsedEntry.entry.name,
                'IMPORT_BATCH_TOO_COMPLEX',
                IMPORT_BATCH_TOO_COMPLEX_MESSAGE,
                []
              )
            : parsedEntry.failure
        )
      }
    }

    const defaultSystemId = input.systemId
    const items = await Promise.all(
      parsedEntries.map(async (parsedEntry): Promise<PreparedItem> => {
        if (!('parsed' in parsedEntry)) return parsedEntry.failure
        return prepareExternalCharacter(
          lookup,
          parsedEntry.entry.entryId,
          parsedEntry.entry.name,
          'FOUNDRY_DND5E',
          parsedEntry.parsed,
          userId,
          defaultSystemId,
          resolutionByEntryId.get(parsedEntry.entry.entryId)?.choice ?? 'COPY',
          customContentChoiceByKey,
          createId
        )
      })
    )
    return {
      source: input.source,
      items,
      defaultSystemId,
      primaryRulesCatalogueId: input.primaryRulesCatalogueId
    }
  }

  const parsedEntries = input.entries.map((entry) => ({
    entry,
    parsed: parseArtificerPortableEntry(entry)
  }))
  const relationshipCount = parsedEntries.reduce(
    (total, { parsed }) => total + (parsed?.envelope.references.length ?? 0),
    0
  )
  if (relationshipCount > IMPORT_MAX_BATCH_RELATIONSHIPS) {
    return {
      source: input.source,
      items: parsedEntries.map(({ entry, parsed }) =>
        parsed
          ? unable(
              entry.entryId,
              entry.name,
              'IMPORT_BATCH_TOO_COMPLEX',
              IMPORT_BATCH_TOO_COMPLEX_MESSAGE,
              []
            )
          : unable(
              entry.entryId,
              entry.name,
              'INVALID_ARTIFICER_CONTENT',
              'The file is not a supported Artificer content export.',
              []
            )
      )
    }
  }
  const duplicateRootIds = findDuplicatePortableRootIds(parsedEntries)
  const items = await Promise.all(
    parsedEntries.map(async ({ entry, parsed }): Promise<PreparedItem> => {
      if (!parsed) {
        return unable(
          entry.entryId,
          entry.name,
          'INVALID_ARTIFICER_CONTENT',
          'The file is not a supported Artificer content export.',
          []
        )
      }
      const importedId = readString(parsed.envelope.item.data.id)
      if (importedId && duplicateRootIds.has(`${parsed.envelope.item.kind}:${importedId}`)) {
        return unable(
          entry.entryId,
          entry.name,
          'DUPLICATE_BATCH_SUBJECT',
          `More than one file contains authored subject id "${importedId}".`,
          ['item', 'data', 'id']
        )
      }
      return prepareArtificerItem(
        lookup,
        entry.entryId,
        entry.name,
        parsed.envelope,
        userId,
        resolutionByEntryId.get(entry.entryId)?.choice ?? 'COPY',
        createId
      )
    })
  )
  await resolvePortableReferenceMaps(lookup, items, userId)
  return { source: input.source, items }
}

async function prepareExternalCharacter(
  lookup: ImportPreparationLookup,
  entryId: string,
  name: string,
  source: CharacterSource,
  parsed: ParsedExternalCharacter,
  userId: string,
  defaultSystemId: string,
  choice: ImportCollisionChoiceDto,
  customContentChoiceByKey: ReadonlyMap<string, 'ACTIVE' | 'DRAFT'>,
  createId: () => string
): Promise<PreparedCharacterItem> {
  const existingRef = await lookup.findImportReference({
    userId,
    source,
    subjectKind: 'CHARACTER',
    externalId: parsed.externalId
  })
  const collision = existingRef
    ? await findCharacterCollision(lookup, existingRef.subjectId, userId)
    : undefined
  const targetId = collision && choice === 'UPDATE_DRAFT' ? collision.subjectId : createId()

  const vocabulary = parsed.customContent.length
    ? ((await lookup.findSystemVocabulary({ systemId: defaultSystemId })) ??
      EMPTY_SYSTEM_VOCABULARY)
    : EMPTY_SYSTEM_VOCABULARY
  const customIssues: ImportIssueDto[] = []
  const customContentResults: CustomContentResult[] = []
  for (const custom of parsed.customContent) {
    const existingRef = await lookup.findImportReference({
      userId,
      source,
      subjectKind: custom.subjectKind,
      externalId: custom.externalId
    })
    if (existingRef) {
      const [active, draft] = await Promise.all([
        lookup.findActiveAuthored({
          subjectKind: custom.subjectKind,
          subjectId: existingRef.subjectId
        }),
        lookup.findAuthoredDraft({
          subjectKind: custom.subjectKind,
          subjectId: existingRef.subjectId,
          userId
        })
      ])
      if (active?.ownerUserId === userId || draft) {
        customContentResults.push({
          kind: 'EXISTING',
          existingId: existingRef.subjectId,
          existingLabel: active?.label ?? draft?.label ?? custom.label,
          custom
        })
        continue
      }
    }

    const targetId = createId()
    // Resolve the source's attack, rarity, price and grants first: eligibility is decided on the
    // payload the commit stages, so the preview and the commit always agree.
    const attack = applyImportedWeaponAttack(custom, vocabulary.damageTypes, createId)
    const terms = applyImportedEquipmentTerms(
      { ...custom, payload: attack.payload },
      vocabulary,
      createId
    )
    customIssues.push(...attack.issues, ...terms.issues)
    const normalized = normalizeImportedAuthoredPayload(
      terms.payload,
      custom.subjectKind,
      targetId,
      custom.label,
      defaultSystemId,
      userId,
      createId,
      false,
      new Map()
    )
    const activationEligible = isCompleteExternalCustomContent(
      authoredSchemaByKind[custom.subjectKind],
      normalized
    )
    customContentResults.push({
      kind: 'NEW',
      prepared: {
        ...custom,
        payload: terms.payload,
        targetId,
        activationEligible,
        activate:
          activationEligible &&
          customContentChoiceByKey.get(`${entryId}:${custom.subjectKind}:${custom.externalId}`) !==
            'DRAFT',
        issues: []
      }
    })
  }
  const customContent = customContentResults.flatMap((result) =>
    result.kind === 'NEW' ? [result.prepared] : []
  )
  const sameEntryCustomIds = new Map<string, string>(
    customContentResults.map((result) => {
      const custom = result.kind === 'NEW' ? result.prepared : result.custom
      return [
        `${custom.subjectKind}:${custom.externalId}`,
        result.kind === 'NEW' ? result.prepared.targetId : result.existingId
      ] as const
    })
  )
  const sameEntryExistingCustomMatches = new Map(
    customContentResults.flatMap((result) =>
      result.kind === 'EXISTING'
        ? [[`${result.custom.subjectKind}:${result.custom.externalId}`, result] as const]
        : []
    )
  )
  const neededSubjectKinds = [
    ...new Set(parsed.references.map((reference) => reference.subjectKind))
  ]
  const masterContentByKind = new Map<
    AuthoredSubjectKindDto,
    Array<{ subjectId: string; label: string }>
  >(
    await Promise.all(
      neededSubjectKinds.map(
        async (subjectKind) =>
          [subjectKind, await lookup.findActiveMasterLabelCandidates({ subjectKind })] as const
      )
    )
  )
  const references: ResolvedReference[] = []
  for (const reference of parsed.references) {
    const sameEntryKey = reference.externalId
      ? (`${reference.subjectKind}:${reference.externalId}` as const)
      : undefined
    const existingCustom = sameEntryKey
      ? sameEntryExistingCustomMatches.get(sameEntryKey)
      : undefined
    const sameEntrySubjectId = sameEntryKey ? sameEntryCustomIds.get(sameEntryKey) : undefined
    const existingMatch = sameEntrySubjectId
      ? existingCustom
        ? {
            subjectId: existingCustom.existingId,
            matchedLabel: existingCustom.existingLabel
          }
        : { subjectId: sameEntrySubjectId }
      : await resolveExternalReference(lookup, userId, source, reference, masterContentByKind)
    references.push({ ...reference, ...existingMatch })
  }
  const existingMatches = summarizeExistingMatches(references)
  const notImported = summarizeNotImported(references)
  const unsupportedSelectionCount = references.filter(
    (reference) => reference.subjectId && (reference.role === 'FEAT' || reference.role === 'SPELL')
  ).length
  const unsupportedSelectionIssues = unsupportedSelectionCount
    ? [
        issue(
          'INFO',
          'UNMAPPED_CHARACTER_SELECTION',
          `${unsupportedSelectionCount} matched feat or spell selection${unsupportedSelectionCount === 1 ? '' : 's'} can be added in Builder after import.`,
          [],
          false
        )
      ]
    : []

  return {
    kind: 'CHARACTER',
    entryId,
    name,
    label: parsed.label,
    externalId: parsed.externalId,
    source,
    parsed,
    references,
    customContent,
    existingMatches,
    notImported,
    targetId,
    collision,
    issues: [
      ...parsed.issues,
      ...customIssues,
      ...unsupportedSelectionIssues,
      ...(collision?.hasExistingDraft
        ? [
            issue(
              'WARNING',
              'EXISTING_DRAFT_REPLACEMENT',
              'Updating this character will replace its existing Builder draft.',
              [],
              true
            )
          ]
        : [])
    ]
  }
}

async function prepareArtificerItem(
  lookup: ImportPreparationLookup,
  entryId: string,
  name: string,
  envelope: ArtificerPortableContentDto,
  userId: string,
  choice: ImportCollisionChoiceDto,
  createId: () => string
): Promise<PreparedAuthoredItem> {
  const importedId = readString(envelope.item.data.id)
  const importRef = importedId
    ? await lookup.findImportReference({
        userId,
        source: 'ARTIFICER_JSON',
        subjectKind: envelope.item.kind,
        externalId: importedId
      })
    : null
  const collision = importedId
    ? await findAuthoredCollision(lookup, envelope.item.kind, importedId, userId)
    : undefined
  const mappedCollision =
    collision ??
    (importRef
      ? await findAuthoredCollision(lookup, envelope.item.kind, importRef.subjectId, userId)
      : undefined)
  const targetId = mappedCollision
    ? choice === 'UPDATE_DRAFT'
      ? mappedCollision.subjectId
      : createId()
    : createId()
  const label =
    readString(envelope.item.data.label) ?? `Imported ${envelope.item.kind.toLowerCase()}`
  const issues: ImportIssueDto[] = []
  if (mappedCollision?.hasExistingDraft) {
    issues.push(
      issue(
        'WARNING',
        'EXISTING_DRAFT_REPLACEMENT',
        'Updating this item will replace its existing authored draft.',
        [],
        true
      )
    )
  }
  if (!importedId) {
    issues.push(
      issue(
        'INFO',
        'GENERATED_SUBJECT_ID',
        'The imported item has no id, so Artificer will generate one.',
        ['item', 'data', 'id'],
        false
      )
    )
  }

  return {
    kind: 'AUTHORED',
    entryId,
    name,
    label,
    externalId: importedId,
    envelope,
    targetId,
    referenceIdMap: new Map(),
    collision: mappedCollision,
    issues
  }
}
async function resolveExternalReference(
  lookup: ImportPreparationLookup,
  userId: string,
  source: ImportSourceDto,
  reference: ExternalContentReference,
  masterContentByKind: ReadonlyMap<
    AuthoredSubjectKindDto,
    Array<{ subjectId: string; label: string }>
  >
): Promise<ResolvedExternalMatch | undefined> {
  if (reference.nativeId) {
    const canonical = await lookup.findActiveAuthored({
      subjectKind: reference.subjectKind,
      subjectId: reference.nativeId
    })
    if (canonical?.isMaster || canonical?.ownerUserId === userId) {
      return { subjectId: canonical.subjectId, matchedLabel: canonical.label }
    }
  }
  if (reference.externalId) {
    const mapped = await lookup.findImportReference({
      userId,
      source,
      subjectKind: reference.subjectKind,
      externalId: reference.externalId
    })
    if (mapped) {
      const active = await lookup.findActiveAuthored({
        subjectKind: reference.subjectKind,
        subjectId: mapped.subjectId
      })
      if (active) return { subjectId: active.subjectId, matchedLabel: active.label }
    }
  }
  const matches = (masterContentByKind.get(reference.subjectKind) ?? []).filter((master) =>
    referenceLabelVariants(reference.label, reference.subjectKind).has(
      normalizeReferenceLabel(master.label)
    )
  )
  return matches.length === 1 && matches[0]
    ? { subjectId: matches[0].subjectId, matchedLabel: matches[0].label }
    : undefined
}

export function referenceLabelVariants(
  label: string,
  subjectKind: AuthoredSubjectKindDto
): Set<string> {
  const normalized = normalizeReferenceLabel(label)
  const variants = new Set([normalized])
  const comma = label.split(',')
  if (comma.length === 2) variants.add(normalizeReferenceLabel(`${comma[1]} ${comma[0]}`))
  if (subjectKind === 'EQUIPMENT') {
    const bonus = normalized.match(/^(.*?)\s*\+\s*(\d+)$/)
    if (bonus?.[1] && bonus[2]) variants.add(`${bonus[1]} armor +${bonus[2]}`)
  }
  return variants
}

export function normalizeReferenceLabel(label: string): string {
  return label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function summarizeExistingMatches(references: ResolvedReference[]): ImportExistingMatchDto[] {
  const summaries = new Map<string, ImportExistingMatchDto>()
  for (const reference of references) {
    if (!reference.subjectId || !reference.matchedLabel) continue
    const key = `${reference.subjectKind}:${reference.label}:${reference.subjectId}:${reference.matchedLabel}`
    const existing = summaries.get(key)
    if (existing) existing.count += 1
    else {
      summaries.set(key, {
        sourceLabel: reference.label,
        matchedLabel: reference.matchedLabel,
        subjectKind: reference.subjectKind,
        count: 1
      })
    }
  }
  return [...summaries.values()]
}

function summarizeNotImported(references: ResolvedReference[]): ImportNotImportedDto[] {
  const summaries = new Map<string, ImportNotImportedDto>()
  for (const reference of references) {
    if (reference.subjectId) continue
    const key = `${reference.subjectKind}:${normalizeReferenceLabel(reference.label)}`
    const existing = summaries.get(key)
    if (existing) existing.count += 1
    else {
      summaries.set(key, {
        label: reference.label,
        subjectKind: reference.subjectKind,
        count: 1
      })
    }
  }
  return [...summaries.values()]
}

async function resolvePortableReferenceMaps(
  lookup: ImportPreparationLookup,
  items: PreparedItem[],
  userId: string
): Promise<void> {
  const authoredItems = items.filter(
    (item): item is PreparedAuthoredItem => item.kind === 'AUTHORED'
  )
  const sameBatch = new Set(
    authoredItems.flatMap((item) =>
      item.externalId ? [`${item.envelope.item.kind}:${item.externalId}`] : []
    )
  )
  for (const item of authoredItems) {
    for (const [index, reference] of item.envelope.references.entries()) {
      if (reference.id && sameBatch.has(`${reference.kind}:${reference.id}`)) continue

      const exact = reference.id
        ? await lookup.findActiveAuthored({
            subjectKind: reference.kind,
            subjectId: reference.id
          })
        : null
      if (exact?.ownerUserId === userId) continue

      if (reference.importSource && reference.importId) {
        const mapped = await lookup.findImportReference({
          userId,
          source: reference.importSource,
          subjectKind: reference.kind,
          externalId: reference.importId
        })
        const active = mapped
          ? await lookup.findActiveAuthored({
              subjectKind: reference.kind,
              subjectId: mapped.subjectId
            })
          : null
        if (active && reference.id) {
          item.referenceIdMap.set(`${reference.kind}:${reference.id}`, active.subjectId)
          continue
        }
      }

      if (exact?.isMaster) continue

      item.issues.push(
        issue(
          'WARNING',
          'UNRESOLVED_PORTABLE_REFERENCE',
          `Could not resolve ${reference.kind.toLowerCase()} reference "${reference.label}".`,
          ['references', index],
          true,
          reference.id
            ? `Same batch, owned Artificer id ${reference.id}, imported provenance, then exact seeded id`
            : 'Imported provenance; no source Artificer id was supplied for remapping'
        )
      )
    }
  }
}

async function findCharacterCollision(
  lookup: ImportPreparationLookup,
  subjectId: string,
  userId: string
): Promise<ImportCollisionDto | undefined> {
  const [active, draft] = await Promise.all([
    lookup.findCharacter({ characterId: subjectId }),
    lookup.findCharacterDraft({ characterId: subjectId, userId })
  ])
  const existing = draft ?? active
  if (!existing) return undefined
  const owned = !active || active.userId === userId
  return {
    subjectKind: 'CHARACTER',
    subjectId,
    label: existing.label,
    hasExistingDraft: Boolean(draft),
    allowedChoices: owned ? ['COPY', 'UPDATE_DRAFT'] : ['COPY'],
    defaultChoice: 'COPY'
  }
}

async function findAuthoredCollision(
  lookup: ImportPreparationLookup,
  subjectKind: AuthoredSubjectKindDto,
  subjectId: string,
  userId: string
): Promise<ImportCollisionDto | undefined> {
  const [active, draft] = await Promise.all([
    lookup.findActiveAuthored({ subjectKind, subjectId }),
    lookup.findAuthoredDraft({ subjectKind, subjectId, userId })
  ])
  const existing = draft ?? active
  if (!existing) return undefined
  const owned =
    (!active || (!active.isMaster && active.ownerUserId === userId)) && Boolean(draft || active)
  return {
    subjectKind,
    subjectId,
    label: existing.label,
    hasExistingDraft: Boolean(draft),
    allowedChoices: owned ? ['COPY', 'UPDATE_DRAFT'] : ['COPY'],
    defaultChoice: 'COPY'
  }
}

export function validateCollisionResolution(
  item: PreparedCharacterItem | PreparedAuthoredItem,
  choice: ImportCollisionChoiceDto,
  resolution: { confirmDraftReplacement: boolean } | undefined
): ImportIssueDto | null {
  if (!item.collision || choice === 'COPY') return null
  if (!item.collision.allowedChoices.includes('UPDATE_DRAFT')) {
    return issue(
      'ERROR',
      'UPDATE_NOT_ALLOWED',
      'This matching item is not owned by the current user and can only be imported as a copy.',
      [],
      true
    )
  }
  if (item.collision.hasExistingDraft && !resolution?.confirmDraftReplacement) {
    return issue(
      'ERROR',
      'DRAFT_REPLACEMENT_NOT_CONFIRMED',
      'Confirm replacement of the existing draft before updating it.',
      [],
      true
    )
  }
  return null
}

export function toImportPreviewResponse(prepared: PreparedBatch): ImportPreviewResponseDto {
  const items = prepared.items.map(toPreviewItem)
  return {
    source: prepared.source,
    items,
    summary: {
      ready: items.filter((item) => item.status === 'READY').length,
      needsReview: items.filter((item) => item.status === 'NEEDS_REVIEW').length,
      unable: items.filter((item) => item.status === 'UNABLE').length
    }
  }
}
function toPreviewItem(item: PreparedItem): ImportPreviewItemDto {
  if (item.kind === 'UNABLE') {
    return {
      entryId: item.entryId,
      name: item.name,
      status: 'UNABLE',
      issues: item.issues
    }
  }
  const status = item.issues.some((entry) => entry.severity === 'ERROR')
    ? 'UNABLE'
    : item.collision || item.issues.some((entry) => entry.correctionRequired)
      ? 'NEEDS_REVIEW'
      : 'READY'
  return {
    entryId: item.entryId,
    name: item.name,
    status,
    label: item.label,
    externalId: item.externalId,
    issues: item.issues,
    collision: item.collision,
    relatedContent:
      item.kind === 'CHARACTER' ? item.customContent.map(toRelatedContent) : undefined,
    existingMatches: item.kind === 'CHARACTER' ? item.existingMatches : undefined,
    notImported: item.kind === 'CHARACTER' ? item.notImported : undefined,
    destination:
      item.kind === 'CHARACTER'
        ? { kind: 'CHARACTER_BUILDER_DRAFT', subjectId: item.targetId }
        : {
            kind: 'AUTHORED_DRAFT',
            subjectKind: item.envelope.item.kind,
            subjectId: item.targetId
          }
  }
}

export function toRelatedContent(custom: PreparedCustomContent) {
  return {
    externalId: custom.externalId,
    label: custom.label,
    subjectKind: custom.subjectKind,
    activationEligible: custom.activationEligible,
    destination: {
      kind: custom.activate ? 'ACTIVE_AUTHORED_CONTENT' : 'AUTHORED_DRAFT',
      subjectKind: custom.subjectKind,
      subjectId: custom.targetId
    } as const
  }
}

export function buildPortableRootIdMap(items: PreparedItem[]): Map<string, string> {
  return new Map(
    items.flatMap((item) =>
      item.kind === 'AUTHORED' && item.externalId
        ? [[`${item.envelope.item.kind}:${item.externalId}`, item.targetId] as const]
        : []
    )
  )
}

export function getDeselectedPortableReferenceIssues(
  references: ArtificerPortableContentDto['references'],
  allPortableRoots: ReadonlySet<string>,
  selectedPortableRoots: ReadonlySet<string>
): ImportIssueDto[] {
  return references.flatMap((reference, index) =>
    reference.id &&
    allPortableRoots.has(`${reference.kind}:${reference.id}`) &&
    !selectedPortableRoots.has(`${reference.kind}:${reference.id}`)
      ? [
          issue(
            'WARNING',
            'BATCH_REFERENCE_NOT_SELECTED',
            `Referenced batch item "${reference.label}" was not selected and will remain unresolved.`,
            ['references', index],
            true,
            `Selected same-batch ${reference.kind.toLowerCase()} id ${reference.id}`
          )
        ]
      : []
  )
}

export function getUnavailablePortableReferenceIssues(
  references: ArtificerPortableContentDto['references'],
  selectedPortableRoots: ReadonlySet<string>,
  committablePortableRoots: ReadonlySet<string>
): ImportIssueDto[] {
  return references.flatMap((reference, index) => {
    const key = reference.id ? `${reference.kind}:${reference.id}` : undefined
    return key && selectedPortableRoots.has(key) && !committablePortableRoots.has(key)
      ? [
          issue(
            'WARNING',
            'BATCH_REFERENCE_TARGET_FAILED',
            `Referenced batch item "${reference.label}" cannot be committed and will remain unresolved.`,
            ['references', index],
            true,
            `Committable same-batch ${reference.kind.toLowerCase()} id ${reference.id}`
          )
        ]
      : []
  })
}

function findDuplicatePortableRootIds(
  entries: Array<{
    parsed: { envelope: ArtificerPortableContentDto } | null
  }>
): Set<string> {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const { parsed } of entries) {
    if (!parsed) continue
    const id = readString(parsed.envelope.item.data.id)
    if (!id) continue
    const key = `${parsed.envelope.item.kind}:${id}`
    if (seen.has(key)) duplicates.add(key)
    seen.add(key)
  }
  return duplicates
}

function unable(
  entryId: string,
  name: string,
  code: string,
  message: string,
  path: Array<string | number>
): PreparedUnableItem {
  return {
    kind: 'UNABLE',
    entryId,
    name,
    issues: [issue('ERROR', code, message, path, true)]
  }
}

export function issue(
  severity: ImportIssueDto['severity'],
  code: string,
  message: string,
  path: Array<string | number>,
  correctionRequired: boolean,
  attemptedMatch?: string
): ImportIssueDto {
  return {
    severity,
    code,
    message,
    path,
    correctionRequired,
    ...(attemptedMatch ? { attemptedMatch } : {})
  }
}

export function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
