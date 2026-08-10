import type { DBLike } from '@artificer-toolkit/db'
import {
  createAuthoredContentRepository,
  createAuthoredImportRefRepository,
  createCharacterBuilderDraftRepository,
  createCharacterRepository,
  createSystemRepository,
  withTransaction,
  type AuthoredImportSource
} from '@artificer-toolkit/db'
import type { AuthoredSubjectKindDto } from '@artificer-toolkit/schema/api/content'
import type {
  ArtificerPortableContentDto,
  AuthoredContentExportRequestDto,
  ImportBatchInputDto,
  ImportCollisionChoiceDto,
  ImportCollisionDto,
  ImportCommitRequestDto,
  ImportExistingMatchDto,
  ImportIssueDto,
  ImportNotImportedDto,
  ImportPreviewItemDto,
  ImportPreviewResponseDto,
  ImportResultItemDto,
  ImportResultReportDto,
  ImportSourceDto
} from '@artificer-toolkit/schema/api/imports'
import {
  IMPORT_MAX_BATCH_BYTES,
  IMPORT_MAX_BATCH_RELATIONSHIPS
} from '@artificer-toolkit/schema/api/imports'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { CHARACTER_ABILITY_GENERATION_METHOD } from '@artificer-toolkit/shared/core'

import {
  authoredDomainConfigs,
  activateAuthoredDomainInput,
  getAuthoredDomain,
  saveAuthoredDomainInputDraft,
  type AuthoredContentInput,
  type AuthoredDomainRuntimeConfig
} from '../authoredContent/index.js'
import {
  createEmptyCharacterAuthored,
  saveCharacterBuilderDraftForUser
} from '../character/index.js'
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
  DndBeyondImportError,
  fetchDndBeyondCharacter,
  findDnd5e2014SystemId
} from './dndBeyondClient.js'
import {
  collectPortableReferences,
  isCompleteExternalCustomContent,
  normalizeImportedAuthoredPayload,
  stripPortableMetadata
} from './portableContent.js'

type CharacterSource = Extract<ImportSourceDto, 'DND_BEYOND' | 'FOUNDRY_DND5E'>
type FoundryEntry = Extract<ImportBatchInputDto, { source: 'FOUNDRY_DND5E' }>['entries'][number]
type FoundryParsedEntry =
  | { entry: FoundryEntry; parsed: ParsedExternalCharacter }
  | { entry: FoundryEntry; failure: PreparedUnableItem }

const IMPORT_BATCH_TOO_COMPLEX_MESSAGE =
  'The import batch contains too many relationships to prepare safely.'

interface ImportServiceDependencies {
  createId?: () => string
  fetch?: typeof fetch
}

interface ResolvedReference extends ExternalContentReference {
  subjectId?: string
  matchedLabel?: string
}

interface ResolvedExternalMatch {
  subjectId: string
  matchedLabel: string
}

interface PreparedCharacterItem {
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

interface PreparedAuthoredItem {
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

interface PreparedCustomContent {
  subjectKind: AuthoredSubjectKindDto
  externalId: string
  label: string
  payload: Record<string, unknown>
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

type PreparedItem = PreparedCharacterItem | PreparedAuthoredItem | PreparedUnableItem

interface PreparedBatch {
  source: ImportSourceDto
  items: PreparedItem[]
  defaultSystemId?: string
}

export async function previewImports(
  db: DBLike,
  input: ImportBatchInputDto,
  userId: string,
  dependencies: ImportServiceDependencies = {}
): Promise<ImportPreviewResponseDto> {
  const prepared = await prepareImportBatch(db, input, userId, new Map(), new Map(), dependencies)
  const items = prepared.items.map(toPreviewItem)
  return {
    source: input.source,
    items,
    summary: {
      ready: items.filter((item) => item.status === 'READY').length,
      needsReview: items.filter((item) => item.status === 'NEEDS_REVIEW').length,
      unable: items.filter((item) => item.status === 'UNABLE').length
    }
  }
}

export async function commitImports(
  db: DBLike,
  request: ImportCommitRequestDto,
  userId: string,
  dependencies: ImportServiceDependencies = {}
): Promise<ImportResultReportDto> {
  const resolutionByEntryId = new Map(
    request.resolutions.map((resolution) => [resolution.entryId, resolution])
  )
  const customContentChoiceByKey = new Map(
    (request.customContentChoices ?? []).map((choice) => [
      `${choice.entryId}:${choice.subjectKind}:${choice.externalId}`,
      choice.choice
    ])
  )
  const prepared = await prepareImportBatch(
    db,
    request.batch,
    userId,
    resolutionByEntryId,
    customContentChoiceByKey,
    dependencies
  )
  const createId = dependencies.createId ?? (() => crypto.randomUUID())
  const selectedEntryIds = new Set(request.selectedEntryIds)
  const allPortableRoots = new Set(
    prepared.items.flatMap((item) =>
      item.kind === 'AUTHORED' && item.externalId
        ? [`${item.envelope.item.kind}:${item.externalId}`]
        : []
    )
  )
  const selectedPortableRoots = new Set(
    prepared.items.flatMap((item) =>
      item.kind === 'AUTHORED' && item.externalId && selectedEntryIds.has(item.entryId)
        ? [`${item.envelope.item.kind}:${item.externalId}`]
        : []
    )
  )

  const items = await withTransaction(db, async (trx) => {
    const committablePortableItems: PreparedAuthoredItem[] = []
    for (const item of prepared.items) {
      if (item.kind !== 'AUTHORED' || !selectedEntryIds.has(item.entryId)) continue
      const resolution = resolutionByEntryId.get(item.entryId)
      if (validateCollisionResolution(item, resolution?.choice ?? 'COPY', resolution)) continue
      const systemId = readString(item.envelope.item.data.systemId)
      if (systemId && (await createSystemRepository(trx).findById(systemId))) {
        committablePortableItems.push(item)
      }
    }
    const rootIdMap = buildPortableRootIdMap(committablePortableItems)
    const committablePortableRoots = new Set(rootIdMap.keys())
    const results: ImportResultItemDto[] = []

    for (const item of prepared.items) {
      if (!selectedEntryIds.has(item.entryId)) {
        results.push({
          entryId: item.entryId,
          name: item.name,
          outcome: 'SKIPPED',
          issues: item.issues
        })
        continue
      }
      if (item.kind === 'UNABLE') {
        results.push({
          entryId: item.entryId,
          name: item.name,
          outcome: 'FAILED',
          issues: item.issues
        })
        continue
      }

      const resolution = resolutionByEntryId.get(item.entryId)
      const collisionChoice = resolution?.choice ?? 'COPY'
      const invalidResolution = validateCollisionResolution(item, collisionChoice, resolution)
      if (invalidResolution) {
        results.push({
          entryId: item.entryId,
          name: item.name,
          label: item.label,
          outcome: 'FAILED',
          issues: [...item.issues, invalidResolution]
        })
        continue
      }

      if (item.kind === 'CHARACTER') {
        if (!prepared.defaultSystemId) {
          throw namedError('ImportConfigurationError', 'D&D 5e 2014 is not configured.')
        }
        results.push(
          await commitCharacterImport(trx, item, userId, prepared.defaultSystemId, createId)
        )
        continue
      }

      const deselectedReferenceIssues = getDeselectedPortableReferenceIssues(
        item.envelope.references,
        allPortableRoots,
        selectedPortableRoots
      )
      const unavailableReferenceIssues = getUnavailablePortableReferenceIssues(
        item.envelope.references,
        selectedPortableRoots,
        committablePortableRoots
      )
      results.push(
        await commitArtificerImport(
          trx,
          {
            ...item,
            issues: [...item.issues, ...deselectedReferenceIssues, ...unavailableReferenceIssues]
          },
          userId,
          rootIdMap,
          createId
        )
      )
    }

    return results
  })

  return {
    source: request.batch.source,
    items,
    summary: {
      created: items.filter((item) => item.outcome === 'CREATED').length,
      updated: items.filter((item) => item.outcome === 'UPDATED').length,
      skipped: items.filter((item) => item.outcome === 'SKIPPED').length,
      failed: items.filter((item) => item.outcome === 'FAILED').length
    }
  }
}

export async function exportAuthoredContent(
  db: DBLike,
  request: AuthoredContentExportRequestDto,
  userId: string
): Promise<ArtificerPortableContentDto> {
  const config = getAuthoredConfig(request.subjectKind)
  const detail = await getAuthoredDomain(db, config, { id: request.id, view: request.view }, userId)
  if (!detail || !detail.permissions.canEdit || detail.provenance.kind !== 'OWNED') {
    throw namedError(
      'AuthoredContentOwnershipError',
      `Only owned ${request.subjectKind.toLowerCase()} content can be exported.`
    )
  }

  const draftPayload = detail.draft?.payload
  const item = request.view === 'draft' ? draftPayload : detail.item
  if (!isRecord(item)) {
    throw namedError(
      'NotFoundError',
      `${request.subjectKind} "${request.id}" does not have an exportable ${request.view} view.`
    )
  }

  const data = stripPortableMetadata(item)
  const references = await collectPortableReferences(db, data, userId)
  return {
    format: 'artificer-content',
    version: 1,
    item: { kind: request.subjectKind, data },
    references
  }
}

async function prepareImportBatch(
  db: DBLike,
  input: ImportBatchInputDto,
  userId: string,
  resolutionByEntryId: ReadonlyMap<
    string,
    { choice: ImportCollisionChoiceDto; confirmDraftReplacement: boolean }
  >,
  customContentChoiceByKey: ReadonlyMap<string, 'ACTIVE' | 'DRAFT'>,
  dependencies: ImportServiceDependencies
): Promise<PreparedBatch> {
  const createId = dependencies.createId ?? (() => crypto.randomUUID())

  if (input.source === 'DND_BEYOND') {
    const defaultSystemId = await findDnd5e2014SystemId(db)
    const items: PreparedItem[] = []
    const responseBudget = { remainingBytes: IMPORT_MAX_BATCH_BYTES }
    for (const entry of input.entries) {
      const characterId = parseDndBeyondCharacterUrl(entry.url)
      if (!characterId) {
        items.push(
          unable(
            entry.entryId,
            entry.url,
            'INVALID_DND_BEYOND_URL',
            'Use a normal https://www.dndbeyond.com/characters/{id} character-sheet link.',
            ['url']
          )
        )
        continue
      }

      let payload: unknown
      try {
        payload = await fetchDndBeyondCharacter(
          characterId,
          dependencies.fetch ?? globalThis.fetch,
          responseBudget
        )
      } catch (error) {
        if (!(error instanceof DndBeyondImportError)) throw error
        items.push(unable(entry.entryId, entry.url, 'DND_BEYOND_UNAVAILABLE', error.message, []))
        continue
      }

      const parsed = parseDndBeyondCharacterPayload(payload, characterId)
      if (!parsed) {
        items.push(
          unable(
            entry.entryId,
            entry.url,
            'UNRECOGNIZED_DND_BEYOND_CHARACTER',
            'D&D Beyond returned a character shape this importer does not recognize.',
            []
          )
        )
        continue
      }
      items.push(
        await prepareExternalCharacter(
          db,
          entry.entryId,
          entry.url,
          'DND_BEYOND',
          parsed,
          userId,
          defaultSystemId,
          resolutionByEntryId.get(entry.entryId)?.choice ?? 'COPY',
          customContentChoiceByKey,
          createId
        )
      )
    }
    return { source: input.source, items, defaultSystemId }
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

    const defaultSystemId = await findDnd5e2014SystemId(db)
    const items = await Promise.all(
      parsedEntries.map(async (parsedEntry): Promise<PreparedItem> => {
        if (!('parsed' in parsedEntry)) return parsedEntry.failure
        return prepareExternalCharacter(
          db,
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
    return { source: input.source, items, defaultSystemId }
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
        db,
        entry.entryId,
        entry.name,
        parsed.envelope,
        userId,
        resolutionByEntryId.get(entry.entryId)?.choice ?? 'COPY',
        createId
      )
    })
  )
  await resolvePortableReferenceMaps(db, items, userId)
  return { source: input.source, items }
}

async function prepareExternalCharacter(
  db: DBLike,
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
  const importRefRepository = createAuthoredImportRefRepository(db)
  const contentRepository = createAuthoredContentRepository(db)
  const existingRef = await importRefRepository.findByExternalId({
    userId,
    source,
    subjectKind: 'CHARACTER',
    externalId: parsed.externalId
  })
  const collision = existingRef
    ? await findCharacterCollision(db, existingRef.subjectId, userId)
    : undefined
  const targetId = collision && choice === 'UPDATE_DRAFT' ? collision.subjectId : createId()

  const customContentResults: CustomContentResult[] = []
  for (const custom of parsed.customContent) {
    const existingRef = await importRefRepository.findByExternalId({
      userId,
      source,
      subjectKind: custom.subjectKind,
      externalId: custom.externalId
    })
    if (existingRef) {
      const [active, draft] = await Promise.all([
        contentRepository.findActiveBySubject({
          subjectKind: custom.subjectKind,
          subjectId: existingRef.subjectId
        }),
        contentRepository.findDraftBySubject({
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
    const normalized = normalizeImportedAuthoredPayload(
      custom.payload,
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
      getAuthoredConfig(custom.subjectKind),
      normalized
    )
    customContentResults.push({
      kind: 'NEW',
      prepared: {
        ...custom,
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
          [
            subjectKind,
            await contentRepository.findActiveMastersBySubjectKind({ subjectKind })
          ] as const
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
        ? { subjectId: existingCustom.existingId, matchedLabel: existingCustom.existingLabel }
        : { subjectId: sameEntrySubjectId }
      : await resolveExternalReference(db, userId, source, reference, masterContentByKind)
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
  db: DBLike,
  entryId: string,
  name: string,
  envelope: ArtificerPortableContentDto,
  userId: string,
  choice: ImportCollisionChoiceDto,
  createId: () => string
): Promise<PreparedAuthoredItem> {
  const importedId = readString(envelope.item.data.id)
  const importRef = importedId
    ? await createAuthoredImportRefRepository(db).findByExternalId({
        userId,
        source: 'ARTIFICER_JSON',
        subjectKind: envelope.item.kind,
        externalId: importedId
      })
    : null
  const collision = importedId
    ? await findAuthoredCollision(db, envelope.item.kind, importedId, userId)
    : undefined
  const mappedCollision =
    collision ??
    (importRef
      ? await findAuthoredCollision(db, envelope.item.kind, importRef.subjectId, userId)
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

async function commitCharacterImport(
  db: DBLike,
  item: PreparedCharacterItem,
  userId: string,
  systemId: string,
  createId: () => string
): Promise<ImportResultItemDto> {
  for (const custom of item.customContent) {
    const payload = normalizeImportedAuthoredPayload(
      custom.payload,
      custom.subjectKind,
      custom.targetId,
      custom.label,
      systemId,
      userId,
      createId,
      false,
      new Map()
    )
    const config = getAuthoredConfig(custom.subjectKind)
    if (custom.activate) {
      await activateAuthoredDomainInput(
        db,
        config,
        payload as unknown as AuthoredContentInput,
        userId
      )
    } else {
      await saveAuthoredDomainInputDraft(
        db,
        config,
        payload as unknown as AuthoredContentInput,
        userId
      )
    }
    await createAuthoredImportRefRepository(db).upsert({
      userId,
      source: item.source,
      subjectKind: custom.subjectKind,
      externalId: custom.externalId,
      subjectId: custom.targetId
    })
  }

  const existingActive = await createCharacterRepository(db).findAuthoredById(item.targetId)
  const character = buildImportedCharacter(item, userId, systemId, createId)
  const baseActiveUpdatedAt = existingActive
    ? await createCharacterRepository(db).findUpdatedAtById(item.targetId)
    : null
  const draft = await saveCharacterBuilderDraftForUser(
    db,
    item.targetId,
    {
      character,
      mode: existingActive ? 'edit' : 'create',
      baseActiveUpdatedAt
    },
    userId
  )
  await createAuthoredImportRefRepository(db).upsert({
    userId,
    source: item.source,
    subjectKind: 'CHARACTER',
    externalId: item.externalId,
    subjectId: item.targetId
  })

  return {
    entryId: item.entryId,
    name: item.name,
    label: item.label,
    outcome: item.collision && item.targetId === item.collision.subjectId ? 'UPDATED' : 'CREATED',
    issues: item.issues,
    destination: { kind: 'CHARACTER_BUILDER_DRAFT', subjectId: item.targetId },
    relatedContent: item.customContent.map(toRelatedContent),
    publicId: draft.publicId
  }
}

async function commitArtificerImport(
  db: DBLike,
  item: PreparedAuthoredItem,
  userId: string,
  rootIdMap: ReadonlyMap<string, string>,
  createId: () => string
): Promise<ImportResultItemDto> {
  const importedSystemId = readString(item.envelope.item.data.systemId)
  if (!importedSystemId || !(await createSystemRepository(db).findById(importedSystemId))) {
    return {
      entryId: item.entryId,
      name: item.name,
      label: item.label,
      outcome: 'FAILED',
      issues: [
        ...item.issues,
        issue(
          'ERROR',
          'UNKNOWN_RULES_SYSTEM',
          'The imported content does not identify an available Artificer rules system.',
          ['item', 'data', 'systemId'],
          true
        )
      ]
    }
  }

  const isCopy = !item.collision || item.targetId !== item.collision.subjectId
  const payload = normalizeImportedAuthoredPayload(
    item.envelope.item.data,
    item.envelope.item.kind,
    item.targetId,
    item.label,
    importedSystemId,
    userId,
    createId,
    isCopy && item.collision !== undefined,
    new Map([...rootIdMap, ...item.referenceIdMap])
  )
  const config = getAuthoredConfig(item.envelope.item.kind)
  const parsed = config.schema.safeParse(payload)
  if (!parsed.success) {
    return {
      entryId: item.entryId,
      name: item.name,
      label: item.label,
      outcome: 'FAILED',
      issues: [
        ...item.issues,
        issue(
          'ERROR',
          'INVALID_AUTHORED_CONTENT',
          'The imported content needs correction before it can be saved.',
          ['item', 'data'],
          true
        )
      ]
    }
  }
  const saved = await saveAuthoredDomainInputDraft(db, config, parsed.data, userId)
  if (item.externalId) {
    await createAuthoredImportRefRepository(db).upsert({
      userId,
      source: 'ARTIFICER_JSON',
      subjectKind: item.envelope.item.kind,
      externalId: item.externalId,
      subjectId: saved.subjectId
    })
  }

  return {
    entryId: item.entryId,
    name: item.name,
    label: item.label,
    outcome: item.collision && item.targetId === item.collision.subjectId ? 'UPDATED' : 'CREATED',
    issues: item.issues,
    destination: {
      kind: 'AUTHORED_DRAFT',
      subjectKind: item.envelope.item.kind,
      subjectId: saved.subjectId
    },
    publicId: saved.publicId
  }
}

function buildImportedCharacter(
  item: PreparedCharacterItem,
  userId: string,
  systemId: string,
  createId: () => string
): CharacterAuthored {
  const character = createEmptyCharacterAuthored({ id: item.targetId, systemId, userId })
  character.label = item.label
  character.description = item.parsed.description
  character.profile = item.parsed.profile
  if (item.parsed.abilities) {
    character.intent.abilities = {
      method: CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED,
      state: {
        assignments: Object.entries(item.parsed.abilities).map(([ability, score]) => ({
          ability: ability as keyof typeof item.parsed.abilities,
          score
        }))
      }
    }
  }
  if (item.parsed.hitPoints) {
    character.state.hitpoints.current = item.parsed.hitPoints.current
    character.state.hitpoints.temp = item.parsed.hitPoints.temp
  }

  let lastClassIndex = -1
  for (const reference of item.references) {
    if (!reference.subjectId) continue
    if (reference.role === 'RACE') {
      character.intent.race.raceId = reference.subjectId
    } else if (reference.role === 'BACKGROUND') {
      character.intent.background.backgroundId = reference.subjectId
    } else if (reference.role === 'CLASS') {
      character.intent.classes.push({
        classId: reference.subjectId,
        classLevel: reference.level ?? 1
      })
      lastClassIndex = character.intent.classes.length - 1
    } else if (reference.role === 'SUBCLASS' && lastClassIndex >= 0) {
      character.intent.classes[lastClassIndex]!.subclassId = reference.subjectId
    } else if (reference.role === 'EQUIPMENT') {
      const itemId = createId()
      character.state.equipment.inventory.push({
        id: itemId,
        equipmentId: reference.subjectId,
        quantity: reference.quantity ?? 1
      })
      if (reference.equipped) character.state.equipment.equipped.push(itemId)
      if (reference.attuned) character.state.equipment.attuned.push(itemId)
    }
  }
  return character
}

async function resolveExternalReference(
  db: DBLike,
  userId: string,
  source: AuthoredImportSource,
  reference: ExternalContentReference,
  masterContentByKind: ReadonlyMap<
    AuthoredSubjectKindDto,
    Array<{ subjectId: string; label: string }>
  >
): Promise<ResolvedExternalMatch | undefined> {
  const contentRepository = createAuthoredContentRepository(db)
  if (reference.nativeId) {
    const canonical = await contentRepository.findActiveBySubject({
      subjectKind: reference.subjectKind,
      subjectId: reference.nativeId
    })
    if (canonical?.isMaster || canonical?.ownerUserId === userId) {
      return { subjectId: canonical.subjectId, matchedLabel: canonical.label }
    }
  }
  if (reference.externalId) {
    const mapped = await createAuthoredImportRefRepository(db).findByExternalId({
      userId,
      source,
      subjectKind: reference.subjectKind,
      externalId: reference.externalId
    })
    if (mapped) {
      const active = await contentRepository.findActiveBySubject({
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

function referenceLabelVariants(label: string, subjectKind: AuthoredSubjectKindDto): Set<string> {
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

function normalizeReferenceLabel(label: string): string {
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
      summaries.set(key, { label: reference.label, subjectKind: reference.subjectKind, count: 1 })
    }
  }
  return [...summaries.values()]
}

async function resolvePortableReferenceMaps(
  db: DBLike,
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
  const contentRepository = createAuthoredContentRepository(db)
  const importRefRepository = createAuthoredImportRefRepository(db)

  for (const item of authoredItems) {
    for (const [index, reference] of item.envelope.references.entries()) {
      if (reference.id && sameBatch.has(`${reference.kind}:${reference.id}`)) continue

      const exact = reference.id
        ? await contentRepository.findActiveBySubject({
            subjectKind: reference.kind,
            subjectId: reference.id
          })
        : null
      if (exact?.ownerUserId === userId) continue

      if (reference.importSource && reference.importId) {
        const mapped = await importRefRepository.findByExternalId({
          userId,
          source: reference.importSource,
          subjectKind: reference.kind,
          externalId: reference.importId
        })
        const active = mapped
          ? await contentRepository.findActiveBySubject({
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
  db: DBLike,
  subjectId: string,
  userId: string
): Promise<ImportCollisionDto | undefined> {
  const [active, draft] = await Promise.all([
    createCharacterRepository(db).findAuthoredById(subjectId),
    createCharacterBuilderDraftRepository(db).findByCharacter({ characterId: subjectId, userId })
  ])
  if (!active && !draft) return undefined
  const owned = (!active || active.userId === userId) && (!draft || draft.userId === userId)
  return {
    subjectKind: 'CHARACTER',
    subjectId,
    label: draft?.label ?? active?.label ?? 'Imported character',
    hasExistingDraft: Boolean(draft),
    allowedChoices: owned ? ['COPY', 'UPDATE_DRAFT'] : ['COPY'],
    defaultChoice: 'COPY'
  }
}

async function findAuthoredCollision(
  db: DBLike,
  subjectKind: AuthoredSubjectKindDto,
  subjectId: string,
  userId: string
): Promise<ImportCollisionDto | undefined> {
  const repository = createAuthoredContentRepository(db)
  const [active, draft] = await Promise.all([
    repository.findActiveBySubject({ subjectKind, subjectId }),
    repository.findDraftBySubject({ subjectKind, subjectId, userId })
  ])
  if (!active && !draft) return undefined
  const owned =
    (!active || (!active.isMaster && active.ownerUserId === userId)) && Boolean(draft || active)
  return {
    subjectKind,
    subjectId,
    label: draft?.label ?? active?.label ?? `Imported ${subjectKind.toLowerCase()}`,
    hasExistingDraft: Boolean(draft),
    allowedChoices: owned ? ['COPY', 'UPDATE_DRAFT'] : ['COPY'],
    defaultChoice: 'COPY'
  }
}

function validateCollisionResolution(
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

function toRelatedContent(custom: PreparedCustomContent) {
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

function buildPortableRootIdMap(items: PreparedItem[]): Map<string, string> {
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

function getAuthoredConfig(subjectKind: AuthoredSubjectKindDto): AuthoredDomainRuntimeConfig {
  switch (subjectKind) {
    case 'BACKGROUND':
      return authoredDomainConfigs.backgrounds
    case 'CLASS':
      return authoredDomainConfigs.classes
    case 'CREATURE':
      return authoredDomainConfigs.creatures
    case 'EQUIPMENT':
      return authoredDomainConfigs.equipment
    case 'FEAT':
      return authoredDomainConfigs.feats
    case 'RACE':
      return authoredDomainConfigs.races
    case 'SPELL':
      return authoredDomainConfigs.spells
    case 'VEHICLE':
      return authoredDomainConfigs.vehicles
  }
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
  return { kind: 'UNABLE', entryId, name, issues: [issue('ERROR', code, message, path, true)] }
}

function issue(
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

function namedError(name: string, message: string): Error {
  const error = new Error(message)
  error.name = name
  return error
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
