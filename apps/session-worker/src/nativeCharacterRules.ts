import type {
  AuthoredCurrentSourceIdentity,
  AuthoredPublicationDocument
} from '@artificer-toolkit/schema/api/authoredPublication'
import {
  type LiveSessionCharacterRulesInput,
  type LiveSessionCharacterRulesRequest,
  type LiveSessionCharacterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionCharacterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { ContentSnapshotIndexEntry } from '@artificer-toolkit/schema/api/contentSnapshots'
import type { EquipmentAuthoredDto } from '@artificer-toolkit/schema/subjects/equipment'
import type { CharacterAuthored, ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { parsePublicationDocument } from '@artificer-toolkit/rules-runtime/authoredPublicationRead'
import { toContentSnapshotIndexEntry } from '@artificer-toolkit/rules-runtime/contentSnapshots'
import type { CharacterSheetCampaignContext } from '@artificer-toolkit/rules-runtime/character/campaignCharacterSheet'
import {
  collectCharacterRuleSourceSelections,
  prepareActiveCharacterBuilderContext,
  prepareCharacterRuleContext
} from '@artificer-toolkit/rules-runtime/character/contextPreparation'
import { prepareCharacterSheetFromContext } from '@artificer-toolkit/rules-runtime/character/sheetPreparation'
import { readCharacterRecord } from '@artificer-toolkit/schema/projections/characterStoredState'

export type PreparedLiveCharacterSheet = Awaited<ReturnType<typeof prepareLiveCharacterSheetFacts>> & {
  revisions: LiveSessionRulesRevisions
  dependencies: Array<{ request: LiveSessionCharacterRulesRequest; readChecksum: string }>
}

/** Prepares authorized Character facts over stored inputs the room reads. */
export async function prepareLiveCharacterSheetFacts(
  initialInput: LiveSessionCharacterRulesInput,
  capture: (
    request: LiveSessionCharacterRulesRequest
  ) => Promise<LiveSessionCharacterRulesResponse>,
  spellCatalogueEntries?: readonly ContentSnapshotIndexEntry<'SPELL'>[]
) {
  const inputs = await capture({ kind: 'INPUTS' })
  if (
    inputs.kind !== 'INPUTS' ||
    inputs.owner.id !== initialInput.characterId ||
    inputs.campaign.id !== initialInput.campaignId ||
    inputs.system.id !== inputs.owner.systemId
  )
    throw new Error('Character rules input binding mismatch.')
  if (inputs.owner.status !== 'ACTIVE') throw new Error('Character owner binding mismatch.')
  // Validated DTOs use literal starting-equipment sources for the authored string enum.
  const character = readCharacterRecord(inputs.owner) as CharacterAuthored
  type CapturedPublication = Extract<
    LiveSessionCharacterRulesResponse,
    { kind: 'PUBLICATIONS' }
  >['publications'][number]
  const publications = new Map<
    string,
    {
      publication: AuthoredPublicationDocument
      version: number
      campaignShared: CapturedPublication['campaignShared']
      campaignParentAllowed: CapturedPublication['campaignParentAllowed']
      storedParentId: CapturedPublication['storedParentId']
    } | null
  >()
  const validatedShared = new Set<string>()
  const identities = new Map<string, AuthoredCurrentSourceIdentity>()
  function rememberIdentity(identity: AuthoredCurrentSourceIdentity) {
    const previous = identities.get(identity.subjectId)
    if (
      identity.systemId !== character.systemId ||
      (previous &&
        (previous.subjectKind !== identity.subjectKind ||
          previous.systemId !== identity.systemId ||
          previous.contentSourceId !== identity.contentSourceId ||
          previous.versionId !== identity.versionId ||
          previous.checksum !== identity.checksum))
    )
      throw new Error('Character rules source changed during preparation.')
    identities.set(identity.subjectId, identity)
  }

  async function fetchPublications(ids: readonly string[]) {
    const missing = [...new Set(ids)].filter((id) => !publications.has(id)).sort()
    for (let offset = 0; offset < missing.length; offset += 500) {
      const subjectIds = missing.slice(offset, offset + 500)
      const requested = new Set(subjectIds)
      const received = new Set<string>()
      let afterSubjectId: string | null = null
      for (;;) {
        const response = await capture({ kind: 'PUBLICATIONS', subjectIds, afterSubjectId })
        if (response.kind !== 'PUBLICATIONS') throw new Error('Character publications are missing.')
        const next = response.continueAfter
        if (
          next !== null &&
          (!requested.has(next) || (afterSubjectId !== null && next <= afterSubjectId))
        )
          throw new Error('Character publication cursor mismatch.')
        for (const {
          identity,
          version,
          documentJson,
          campaignShared,
          campaignParentAllowed,
          storedParentId
        } of response.publications) {
          const id = identity.subjectId
          if (
            !requested.has(id) ||
            received.has(id) ||
            (afterSubjectId !== null && id <= afterSubjectId) ||
            (next !== null && id > next)
          )
            throw new Error('Character publication page identity mismatch.')
          const publication = parsePublicationDocument(
            identity.subjectKind,
            JSON.parse(documentJson)
          )
          if (publication.document.id !== id || publication.document.systemId !== identity.systemId)
            throw new Error('Character publication document identity mismatch.')
          // Content source ownership is stored on the authorized root, not authored DTOs.
          // Storage checksums describe the original document, not its normalized DTO.
          rememberIdentity(identity)
          received.add(id)
          publications.set(id, {
            publication,
            version,
            campaignShared,
            campaignParentAllowed,
            storedParentId
          })
        }
        if (received.size > subjectIds.length)
          throw new Error('Character publication page exceeds the requested sources.')
        if (next === null) break
        afterSubjectId = next
      }
      for (const id of subjectIds) if (!publications.has(id)) publications.set(id, null)
    }
  }

  async function readRawPublication(id: string) {
    await fetchPublications([id])
    return publications.get(id) ?? null
  }

  async function validateSharedPublication(id: string) {
    const root = await readRawPublication(id)
    if (!root?.campaignShared || validatedShared.has(id)) return
    const { publication } = root
    if (publication.subjectKind === 'CLASS' && publication.document.category === 'SUBCLASS') {
      const parentId = publication.document.parentClassId
      const parent = await readRawPublication(parentId)
      if (
        parentId === id ||
        !parent?.campaignParentAllowed ||
        parent.publication.subjectKind !== 'CLASS' ||
        parent.publication.document.category !== 'BASE' ||
        parent.publication.document.systemId !== publication.document.systemId
      )
        throw new Error('A readable base class in the same System is required.')
    } else if (publication.subjectKind === 'RACE' && publication.document.category === 'SUBRACE') {
      const parentId = publication.document.parentRaceId
      const parent = await readRawPublication(parentId)
      if (
        parentId === id ||
        !parent?.campaignParentAllowed ||
        parent.publication.subjectKind !== 'RACE' ||
        parent.publication.document.category !== 'BASE' ||
        parent.publication.document.systemId !== publication.document.systemId ||
        parent.storedParentId !== null
      )
        throw new Error('A readable base Race in the same System is required.')
    } else if (publication.subjectKind === 'EQUIPMENT') {
      const seen = new Set([id])
      let current = publication.document
      while (current.category === 'VARIANT') {
        const parentId = current.parentEquipmentId
        if (seen.has(parentId)) throw new Error('Equipment variant cycle detected.')
        if (seen.size >= 500) throw new Error('Equipment inheritance exceeds the authoring limit.')
        const parent = await readRawPublication(parentId)
        if (
          !parent?.campaignParentAllowed ||
          parent.publication.subjectKind !== 'EQUIPMENT' ||
          parent.publication.document.systemId !== publication.document.systemId
        )
          throw new Error('Readable parent Equipment in the same System is required.')
        current = parent.publication.document
        if (
          parent.storedParentId !==
          (current.category === 'VARIANT' ? current.parentEquipmentId : null)
        )
          throw new Error('Stored Equipment parent metadata mismatch.')
        seen.add(parentId)
      }
      for (const parentId of seen) validatedShared.add(parentId)
    }
    validatedShared.add(id)
  }

  async function readPublication(id: string) {
    const entry = await readRawPublication(id)
    if (entry) await validateSharedPublication(id)
    return entry?.publication ?? null
  }

  async function readIndexedPublications(
    request: Exclude<LiveSessionCharacterRulesRequest, { kind: 'INPUTS' | 'PUBLICATIONS' }>
  ) {
    const indexedIds = new Map<
      string,
      Extract<LiveSessionCharacterRulesResponse, { kind: 'SOURCE_INDEX' }>['sources'][number]
    >()
    const counts = new Map<AuthoredPublicationDocument['subjectKind'], number>()
    const sharedCounts = new Map<AuthoredPublicationDocument['subjectKind'], number>()
    const seenCursors = new Set<string>()
    let cursor: Extract<
      LiveSessionCharacterRulesResponse,
      { kind: 'SOURCE_INDEX' }
    >['continueCursor'] = null
    for (;;) {
      const response = await capture(cursor === null ? request : { ...request, cursor })
      if (response.kind !== 'SOURCE_INDEX') throw new Error('Character source index is missing.')
      for (const source of response.sources) {
        const { campaignShared, matches: _matches, ...identity } = source
        if (
          (request.kind === 'CLASS_CATALOGUE' && identity.subjectKind !== 'CLASS') ||
          (request.kind === 'SPELL_CATALOGUE' && identity.subjectKind !== 'SPELL')
        )
          throw new Error('Character source index identity mismatch.')
        rememberIdentity(identity)
        if (indexedIds.has(identity.subjectId))
          throw new Error('Character source index repeats a publication.')
        const sourceCounts = campaignShared ? sharedCounts : counts
        const count = (sourceCounts.get(identity.subjectKind) ?? 0) + 1
        if (count > 500)
          throw new Error('Character authorized sources exceed the bounded catalogue limit.')
        sourceCounts.set(identity.subjectKind, count)
        indexedIds.set(identity.subjectId, source)
      }
      const next = response.continueCursor
      if (next === null) break
      const cursorKey = JSON.stringify(next)
      if (
        seenCursors.has(cursorKey) ||
        (cursor !== null &&
          (next.kindIndex < cursor.kindIndex ||
            (next.kindIndex === cursor.kindIndex && next.sourceIndex < cursor.sourceIndex)))
      )
        throw new Error('Character source index cursor mismatch.')
      seenCursors.add(cursorKey)
      cursor = next
    }
    // Count direct headers before loading bodies. Shared roots also need ACTIVE/body validation.
    for (const identity of indexedIds.values()) {
      if (!identity.campaignShared) continue
      const entry = await readRawPublication(identity.subjectId)
      if (!entry) continue
      await validateSharedPublication(identity.subjectId)
      const count = (counts.get(entry.publication.subjectKind) ?? 0) + 1
      if (count > 500)
        throw new Error('Character authorized sources exceed the bounded catalogue limit.')
      counts.set(entry.publication.subjectKind, count)
    }
    const matching = [...indexedIds.values()]
      .filter((identity) => identity.matches)
      .sort((left, right) => left.subjectId.localeCompare(right.subjectId))
    await fetchPublications(matching.map((identity) => identity.subjectId))
    const authorized: AuthoredPublicationDocument[] = []
    for (const identity of matching) {
      const publication = await readPublication(identity.subjectId)
      if (publication) authorized.push(publication)
    }
    return authorized
  }

  await fetchPublications([...collectCharacterRuleSourceSelections(character).keys()])
  const ruleContext = await prepareCharacterRuleContext(character, inputs.system, undefined, {
    readPublication,
    async readRaceParent(document) {
      const parent = await readPublication(document.parentRaceId)
      const parentEntry = await readRawPublication(document.parentRaceId)
      if (
        document.parentRaceId === document.id ||
        parent?.subjectKind !== 'RACE' ||
        parent.document.category !== 'BASE' ||
        parent.document.systemId !== document.systemId ||
        parentEntry?.storedParentId !== null
      )
        throw new Error('A readable base Race in the same System is required.')
      return parent.document
    },
    async requireClassParent(document) {
      const parent = await readPublication(document.parentClassId)
      if (
        document.parentClassId === document.id ||
        parent?.subjectKind !== 'CLASS' ||
        parent.document.category !== 'BASE' ||
        parent.document.systemId !== document.systemId
      )
        throw new Error('A readable base class in the same System is required.')
    },
    async readEquipmentParents(document) {
      const ancestors = new Map<string, EquipmentAuthoredDto>([[document.id, document]])
      let current = document
      while (current.category === 'VARIANT') {
        const parentId = current.parentEquipmentId
        if (ancestors.has(parentId)) throw new Error('Equipment variant cycle detected.')
        if (ancestors.size >= 500)
          throw new Error('Equipment inheritance exceeds the authoring limit.')
        const parent = await readPublication(parentId)
        const parentEntry = await readRawPublication(parentId)
        if (parent?.subjectKind !== 'EQUIPMENT' || parent.document.systemId !== document.systemId)
          throw new Error('Readable parent Equipment in the same System is required.')
        current = parent.document
        if (
          parentEntry?.storedParentId !==
          (current.category === 'VARIANT' ? current.parentEquipmentId : null)
        )
          throw new Error('Stored Equipment parent metadata mismatch.')
        ancestors.set(current.id, current)
      }
      return ancestors
    },
    async readFeatureSources(featureIds) {
      const ids = [...featureIds].sort()
      const sources = new Map<string, AuthoredPublicationDocument>()
      for (let offset = 0; offset < ids.length; offset += 500) {
        for (const publication of await readIndexedPublications({
          kind: 'FEATURE_SOURCES',
          featureIds: ids.slice(offset, offset + 500)
        }))
          sources.set(publication.document.id, publication)
      }
      return [...sources.values()]
    },
    async readSpellCatalogue(referencedSpellIds) {
      if (spellCatalogueEntries) {
        await fetchPublications([...referencedSpellIds])
        const documents = []
        for (const id of referencedSpellIds) {
          const publication = await readPublication(id)
          if (publication?.subjectKind === 'SPELL') documents.push(publication.document)
        }
        return { entries: [...spellCatalogueEntries], documents }
      }
      const catalogue = await readIndexedPublications({ kind: 'SPELL_CATALOGUE' })
      const spells = catalogue.map((publication) => {
        if (publication.subjectKind !== 'SPELL')
          throw new Error('Character Spell catalogue mismatch.')
        return publication
      })
      return {
        entries: spells.map(toContentSnapshotIndexEntry),
        documents: spells
          .filter((publication) => referencedSpellIds.has(publication.document.id))
          .map((publication) => publication.document)
      }
    }
  })
  const context = await prepareActiveCharacterBuilderContext(character, ruleContext, async () => {
    const catalogue = await readIndexedPublications({ kind: 'CLASS_CATALOGUE' })
    return catalogue
      .map((publication) => {
        if (publication.subjectKind !== 'CLASS')
          throw new Error('Character Class catalogue mismatch.')
        return publication.document as ClassAuthored
      })
      .sort(
        (left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id)
      )
  })
  const campaignContext: CharacterSheetCampaignContext = {
    currencyOptions: inputs.campaign.currencyOptions,
    viewer: character.userId === initialInput.expectedUserId ? 'CHARACTER_OWNER' : 'CAMPAIGN_OWNER',
    campaignId: inputs.campaign.id,
    campaignStatus: inputs.campaign.status,
    contentMaturity: inputs.campaign.contentMaturity,
    attunementSlotOverride: inputs.campaign.attunementSlotOverride,
    adjustments: inputs.campaign.state.adjustments.map((record) => ({
      ...record.adjustment,
      id: record.id,
      characterId: character.id,
      createdBy: record.createdBy,
      updatedBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    })),
    secretAdjustmentIds: new Set(
      inputs.campaign.state.adjustments
        .filter((record) => record.visibility === 'SECRET')
        .map((record) => record.id)
    ),
    conditions: inputs.campaign.state.conditions
  }
  const preparedSheet = await prepareCharacterSheetFromContext({
    character,
    context,
    sheetState: inputs.sheetState,
    campaignContext
  })
  return {
    active: inputs.owner,
    character,
    sheetState: inputs.sheetState,
    campaignContext,
    ...preparedSheet,
    sourceIdentities: [...identities.values()],
    sourceVersions: [...identities.values()].flatMap((identity) => {
      const publication = publications.get(identity.subjectId)
      return publication ? [{ ...identity, version: publication.version }] : []
    })
  }
}
