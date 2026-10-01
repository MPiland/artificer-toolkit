import {
  liveSessionCharacterRulesInputSchema,
  liveSessionCharacterRulesResponseSchema,
  type LiveSessionCharacterRulesInput,
  type LiveSessionCharacterRulesRequest,
  type LiveSessionCharacterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionCharacterRules'
import type { ContentSnapshotDocumentsObject } from '@artificer-toolkit/schema/api/contentSnapshots'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import { createSnapshotReaders } from '@artificer-toolkit/rules-runtime/character/snapshotReaders'
import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'
import { sha256Hex } from '@artificer-toolkit/shared/sha256'
import { prepareLiveCharacterSheetFacts } from './nativeCharacterRules.js'
import { mergeNativeRulesRevisions } from './nativeRulesRevisions.js'
import { resolveCharacterRecordStats } from '@artificer-toolkit/rules-runtime/character/characterRecordStats'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { characterStoredPlayStateSchema } from '@artificer-toolkit/schema/projections/characterPersistence'
import { createCharacterResourceOwnerKey } from '@artificer-toolkit/shared/character'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { RoomInputs } from './roomInputs.js'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'

/** The caller admits the command through RoomAuthorization before reading its target's facts. */
export async function prepareRoomLiveCharacterSheet(
  store: RoomEncounterStore,
  room: RoomInputs,
  scope: Omit<LiveSessionCharacterRulesInput, 'request'>,
  observed: LiveSessionRulesRevisions | null,
  transaction?: RoomTransaction
) {
  const initialInput = liveSessionCharacterRulesInputSchema.parse({
    ...scope,
    request: { kind: 'INPUTS' }
  })
  if (room.epoch !== initialInput.authorityEpoch)
    throw new Error('Room Character rules epoch mismatch.')
  const priorBuilder = room.characterBuilderSnapshot(initialInput.characterId, transaction)
  let [part, systemInput] = await Promise.all([
    room.character(initialInput.characterId, observed, transaction),
    room.system('SYSTEM', observed, transaction)
  ])
  if (!part.inputs || !part.contentSnapshots || !systemInput.system)
    throw new Error('Room Character rules inputs are missing.')
  if (part.contentSnapshots.systemId !== part.inputs.owner.systemId)
    throw new Error('Room Character content System mismatch.')
  const objects = await room.contentObjects(initialInput.characterId, observed, transaction)
  const readers = createSnapshotReaders(objects)
  type Publication = Omit<
    Extract<LiveSessionCharacterRulesResponse, { kind: 'PUBLICATIONS' }>['publications'][number],
    'documentJson'
  > & {
    root: ContentSnapshotDocumentsObject['roots'][number]
  }
  const publications = new Map<string, Publication>()
  const sharedIds = new Set<string>()
  const sourceKinds = new Map(
    part.contentSnapshots.sources.map((source) => [source.contentSourceId, source.kind])
  )
  for (const object of objects) {
    if (object.part !== 'documents') continue
    if (object.roots.some((root) => root.systemId !== part.inputs!.owner.systemId))
      throw new Error('Room Character publication System mismatch.')
    if (object.scope === 'CAMPAIGN') {
      if (object.scopeId !== initialInput.campaignId)
        throw new Error('Room content Campaign mismatch.')
      for (const root of object.roots) sharedIds.add(root.id)
    } else if (object.scope !== 'SOURCE' || !sourceKinds.has(object.scopeId)) {
      throw new Error('Room content source is unauthorized.')
    }
  }
  const ordered = [...objects].sort(
    (left, right) => Number(left.scope === 'CAMPAIGN') - Number(right.scope === 'CAMPAIGN')
  )
  for (const object of ordered) {
    if (object.part !== 'documents') continue
    for (const [index, root] of object.roots.entries()) {
      const pin = object.versions[index]!
      const previous = publications.get(root.id)
      if (previous) {
        if (
          canonicalizeJson({
            identity: previous.identity,
            version: previous.version,
            storedParentId: previous.storedParentId ?? null
          }) !==
          canonicalizeJson({
            identity: pin.identity,
            version: pin.version,
            storedParentId: pin.storedParentId ?? null
          })
        )
          throw new Error('Room content source versions disagree.')
        continue
      }
      publications.set(root.id, {
        ...pin,
        root,
        campaignShared: object.scope === 'CAMPAIGN',
        campaignParentAllowed:
          sharedIds.has(root.id) || sourceKinds.get(object.scopeId) === 'PLATFORM'
      })
    }
  }
  const revisions = mergeNativeRulesRevisions(part.revisions, systemInput.revisions)
  const dependencies: Array<{ request: LiveSessionCharacterRulesRequest; readChecksum: string }> =
    []
  async function capture(
    request: LiveSessionCharacterRulesRequest
  ): Promise<LiveSessionCharacterRulesResponse> {
    const input = liveSessionCharacterRulesInputSchema.parse({ ...initialInput, request })
    const hash = (value: unknown) => sha256Hex(canonicalizeJson(value))
    let response: LiveSessionCharacterRulesResponse
    if (request.kind === 'INPUTS') {
      const stored = { kind: 'INPUTS' as const, ...part.inputs!, system: systemInput.system! }
      response = {
        ...stored,
        revisions,
        readChecksum: hash({ input, userId: initialInput.expectedUserId, response: stored })
      }
    } else if (request.kind === 'PUBLICATIONS') {
      const checkedIds = [...new Set(request.subjectIds)]
        .sort()
        .filter((id) => request.afterSubjectId === null || id > request.afterSubjectId)
      const values = checkedIds.flatMap((id) => {
        const publication = publications.get(id)
        if (!publication) return []
        const { root, ...metadata } = publication
        return [{ ...metadata, documentJson: JSON.stringify(root) }]
      })
      response = {
        kind: 'PUBLICATIONS',
        revisions,
        continueAfter: null,
        publications: values,
        readChecksum: hash({
          input,
          userId: initialInput.expectedUserId,
          checkedIds,
          publications: values.map(({ documentJson: _documentJson, ...metadata }) => metadata),
          continueAfter: null
        })
      }
    } else {
      const featureIds = request.kind === 'FEATURE_SOURCES' ? new Set(request.featureIds) : null
      const matches = featureIds
        ? new Set(
            (await readers.readFeatureSources(featureIds)).map(
              (publication) => publication.document.id
            )
          )
        : null
      const sources = [...publications.values()]
        .filter((publication) =>
          request.kind === 'CLASS_CATALOGUE'
            ? publication.identity.subjectKind === 'CLASS'
            : request.kind === 'SPELL_CATALOGUE'
              ? publication.identity.subjectKind === 'SPELL'
              : publication.identity.subjectKind !== 'SPELL'
        )
        .map((publication) => ({
          ...publication.identity,
          campaignShared: publication.campaignShared,
          matches: matches?.has(publication.identity.subjectId) ?? true
        }))
        .sort((left, right) => left.subjectId.localeCompare(right.subjectId))
      response = {
        kind: 'SOURCE_INDEX',
        revisions,
        continueCursor: null,
        sources,
        readChecksum: hash({
          input,
          userId: initialInput.expectedUserId,
          sources,
          continueCursor: null
        })
      }
    }
    const parsed = liveSessionCharacterRulesResponseSchema.parse(response)
    dependencies.push({ request: input.request, readChecksum: parsed.readChecksum })
    return parsed
  }
  const catalogue = (await readers.readSpellCatalogue(new Set())).entries
  let facts = await prepareLiveCharacterSheetFacts(initialInput, capture, catalogue)
  if (transaction) {
    const play = await store.store
      .query('characterPlayStates')
      .withIndex('by_characterId', (q) => q.eq('characterId', initialInput.characterId))
      .unique()
    if (
      !play ||
      play._id !== facts.active.play._id ||
      play.userId !== facts.active.userId ||
      play.checksum !== facts.active.play.checksum ||
      play.streamVersion !== facts.active.play.streamVersion
    )
      throw new Error('Room Character reconciliation base is stale.')
    const state = readCharacterPlay(play)
    const stats = resolveCharacterRecordStats(facts.ruleEvaluation)
    const resourcePools = new Set(
      facts.ruleEvaluation.output.resources.map((resource) => resource.poolId)
    )
    const inventoryIds = new Set(
      facts.prepared.character.state.equipment.inventory.map((item) => item.id)
    )
    const builder = room.characterBuilderSnapshot(initialInput.characterId, transaction)
    const clampsHitPoints =
      priorBuilder &&
      builder &&
      priorBuilder.updatedAt !== builder.updatedAt &&
      stats.maximumHitPoints < play.maximumHitPoints &&
      state.hitpoints.current > stats.maximumHitPoints
    const nextState = {
      ...state,
      hitpoints: {
        ...state.hitpoints,
        current: clampsHitPoints ? stats.maximumHitPoints : state.hitpoints.current,
        hitDice: facts.prepared.character.state.hitpoints.hitDice
      },
      equipped: state.equipped.filter((itemId) => inventoryIds.has(itemId)),
      attuned: state.attuned.filter((itemId) => inventoryIds.has(itemId)),
      resourceUsage: state.resourceUsage.filter((usage) =>
        resourcePools.has(createCharacterResourceOwnerKey(usage.owner))
      )
    }
    const checksum = checksumRuleDocument(nextState)
    const stateChanged = checksum !== play.checksum
    if (
      stateChanged ||
      stats.maximumHitPoints !== play.maximumHitPoints ||
      stats.walkingSpeed !== play.walkingSpeed
    ) {
      const { _id, _creationTime, ...fields } = play
      await store.store.replace(
        _id,
        characterStoredPlayStateSchema.parse({
          ...fields,
          ...stats,
          state: nextState,
          checksum,
          streamVersion: play.streamVersion + (stateChanged ? 1 : 0),
          updatedAt: stateChanged
            ? new Date(Math.max(Date.now(), Date.parse(play.updatedAt) + 1)).toISOString()
            : play.updatedAt
        })
      )
      part = await room.character(initialInput.characterId, observed, transaction)
      // Re-evaluate over the reconciled play without replacing the Builder's structure or reloading content.
      facts = await prepareLiveCharacterSheetFacts(initialInput, capture, catalogue)
    }
  }
  return { ...facts, revisions, dependencies }
}
