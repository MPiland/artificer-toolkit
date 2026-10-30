import assert from 'node:assert/strict'
import { jsonToConvex } from 'convex/values'
import type { DevelopmentClient } from './developmentClient'
import { characterBuilderDraftPayloadDtoSchema } from '@artificer-toolkit/schema/api/characterBuilder'
import type { CharacterSheetCommandInputDto } from '@artificer-toolkit/schema/api/characterSheetCommands'
import type {
  CurrencySystemDto,
  TransferCampaignInventoryInput,
  InventoryOwnerRefDto
} from '@artificer-toolkit/schema/api/campaignInventory'
import { backgroundAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/background'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { sceneVisionRevisionSchema } from '@artificer-toolkit/schema/projections/sceneVisionRevisions'
import {
  CHARACTER_DRAFT_PAYLOAD_INLINE_MAX_BYTES,
  characterStoredPlayStateSchema,
  characterStoredHeadSchema
} from '@artificer-toolkit/schema/projections/characterPersistence'
import {
  encodeCharacterRecord,
  readCharacterRecord
} from '@artificer-toolkit/schema/projections/characterStoredState'
import {
  assembleCharacterStructure,
  encodeCharacterOperationalStructure
} from '@artificer-toolkit/schema/projections/characterOperationalState'
import {
  characterCollectionSchemas,
  characterStoredBuildStateSchema
} from '@artificer-toolkit/schema/projections/characterOperationalRecords'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { reconcileCharacterAuthoredSourceLoss } from '@artificer-toolkit/rules-runtime/character/characterSourceLoss'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { backpack } from '@artificer-toolkit/source-data/srd/equipment/backpack.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api } from '../convex/_generated/api.js'
import {
  decodeUtf8PayloadChunks,
  encodeUtf8PayloadChunks
} from '@artificer-toolkit/shared/jsonPayloadChunks'

type WithoutMetadata<T> = T extends unknown ? Omit<T, 'commandId' | 'expectedVersion'> : never
type NativeTables = Record<string, Record<string, unknown>[]>

function materializeArrayBuffer(value: unknown) {
  const decoded =
    value instanceof ArrayBuffer ? value : jsonToConvex(value as Parameters<typeof jsonToConvex>[0])
  assert.ok(decoded instanceof ArrayBuffer)
  return decoded
}

export async function populateCampaignLifecycleCharacter(input: {
  owner: DevelopmentClient
  player: DevelopmentClient
  campaignId: string
  characterId: string
  currencySystem: CurrencySystemDto
  vehicleIds: [string, string]
}) {
  const { owner, player, campaignId, characterId, currencySystem, vehicleIds } = input
  const backgroundDraft = await owner.mutation(api.content.drafts.duplicate, {
    subjectKind: 'BACKGROUND',
    subjectId: acolyte.id
  })
  const background = backgroundAuthoredDtoSchema.parse({
    ...backgroundDraft.payload,
    label: 'P09 shared minimal Background ' + characterId,
    features: [],
    proficiencies: [],
    startingEquipment: { id: crypto.randomUUID(), sets: [] }
  })
  const publishedDraft = await owner.mutation(api.content.drafts.save, {
    subjectKind: 'BACKGROUND',
    subjectId: backgroundDraft.subjectId,
    systemId: backgroundDraft.systemId,
    label: background.label,
    payload: background
  })
  assert.ok(publishedDraft.updatedAt)
  await owner.mutation(api.content.publication.publishDraft, {
    subjectKind: 'BACKGROUND',
    subjectId: backgroundDraft.subjectId,
    expectedDraftUpdatedAt: publishedDraft.updatedAt
  })
  await owner.mutation(api.campaigns.contentShares.share, {
    campaignId,
    subjectKind: 'BACKGROUND',
    subjectId: backgroundDraft.subjectId
  })
  await player.mutation(api.campaigns.assignments.assign, { campaignId, characterId })
  const current = await player.query(api.characters.builder.activeCharacter, { id: characterId })
  assert.ok(current)
  const opened = await player.mutation(api.characters.drafts.create, {
    id: characterId,
    systemId: current.systemId
  })
  const saved = await player.mutation(api.characters.drafts.save, {
    characterId,
    expectedDraftId: opened.id,
    mode: 'edit',
    baseActiveUpdatedAt: opened.baseActiveUpdatedAt,
    character: {
      ...opened.payload.character,
      intent: {
        ...current.intent,
        background: { backgroundId: backgroundDraft.subjectId },
        startingEquipment: {
          ...current.intent.startingEquipment,
          background: { source: 'BACKGROUND', tookGold: false, groups: [], applied: true }
        }
      }
    },
    ...(opened.payload.builderIntent === undefined
      ? {}
      : { builderIntent: opened.payload.builderIntent })
  })
  await player.mutation(api.characters.commit.commit, {
    expectedDraftId: saved.id,
    mode: 'edit',
    character: saved.payload.character
  })
  const execute = async (fields: WithoutMetadata<CharacterSheetCommandInputDto>) => {
    const before = await player.query(api.characters.sheet.get, { id: characterId })
    assert.ok(before)
    const result = await player.mutation(api.characters.sheetCommands.execute, {
      id: characterId,
      command: {
        ...fields,
        commandId: crypto.randomUUID(),
        expectedVersion: before.meta.streamVersion
      }
    })
    assert.equal(result.streamVersion, before.meta.streamVersion + 1)
    return result
  }
  const beforeBag = await player.query(api.characters.builder.activeCharacter, { id: characterId })
  assert.ok(beforeBag)
  await execute({ type: 'ADD_INVENTORY_ITEM', equipmentId: backpack.id, quantity: 1 })
  const withBag = await player.query(api.characters.builder.activeCharacter, { id: characterId })
  assert.ok(withBag)
  const addedBags = withBag.state.equipment.inventory.filter(
    (row) => !beforeBag.state.equipment.inventory.some((old) => old.id === row.id)
  )
  assert.equal(addedBags.length, 1)
  const bag = addedBags[0]!
  assert.equal(bag.equipmentId, backpack.id)
  assert.ok(bag.retainedRulesJson)
  await execute({
    type: 'ADD_INVENTORY_ITEM',
    equipmentId: club.id,
    quantity: 1,
    containerId: bag.id
  })
  const denomination = currencySystem.denominations[0]!
  for (const containerId of [undefined, bag.id]) {
    await execute({
      type: 'ADJUST_CURRENCY',
      kind: 'RULESET',
      currencyId: srdSystemRecord.currencies[0]!.id,
      amount: 4_294_967_297,
      ...(containerId === undefined ? {} : { containerId })
    })
    await execute({
      type: 'ADJUST_CURRENCY',
      kind: 'CAMPAIGN',
      currencyId: denomination.id,
      campaignCurrencySystemId: currencySystem.id,
      amount: 4_294_967_297,
      ...(containerId === undefined ? {} : { containerId })
    })
  }
  const stableGroups: Array<{
    vehicleId?: string
    bagId: string
    groupIds: string[]
    denominationId: string
  }> = []
  assert.equal(currencySystem.denominations.length, 2)
  const zeroDenomination = currencySystem.denominations[1]!
  const partyOwner: InventoryOwnerRefDto = { kind: 'CAMPAIGN', campaignId }
  const transfer = async (
    client: DevelopmentClient,
    source: InventoryOwnerRefDto,
    destination: InventoryOwnerRefDto,
    itemId: string
  ) => {
    const owners = { campaignId, source, destination }
    const fences = await client.query(api.campaigns.inventoryOwners.transferVersions, {
      input: owners
    })
    const command: TransferCampaignInventoryInput = {
      ...owners,
      kind: 'ITEM',
      itemId,
      amount: 1,
      expectedSourceVersion: fences.sourceVersion,
      expectedDestinationVersion: fences.destinationVersion,
      idempotencyKey: crypto.randomUUID()
    }
    return client.mutation(api.campaigns.inventoryTransfers.transfer, { input: command })
  }
  for (const vehicleId of [undefined, ...vehicleIds]) {
    const before = await player.query(api.characters.builder.activeCharacter, { id: characterId })
    assert.ok(before)
    await execute({
      type: 'ADD_INVENTORY_ITEM',
      equipmentId: backpack.id,
      quantity: 1,
      customName: 'P09 stable coin group container'
    })
    const after = await player.query(api.characters.builder.activeCharacter, { id: characterId })
    assert.ok(after)
    const bags = after.state.equipment.inventory.filter(
      (item) => !before.state.equipment.inventory.some((old) => old.id === item.id)
    )
    assert.equal(bags.length, 1)
    const movedBag = bags[0]!
    assert.equal(movedBag.equipmentId, backpack.id)
    assert.ok(movedBag.retainedRulesJson)
    for (const amount of [1, -1])
      await execute({
        type: 'ADJUST_CURRENCY',
        kind: 'CAMPAIGN',
        currencyId: zeroDenomination.id,
        campaignCurrencySystemId: currencySystem.id,
        amount,
        containerId: movedBag.id
      })
    const populated = await player.query(api.characters.builder.activeCharacter, {
      id: characterId
    })
    assert.ok(populated)
    const groups = populated.state.currency.filter((group) => group.containerId === movedBag.id)
    assert.equal(groups.length, 1)
    assert.deepEqual(
      groups
        .flatMap((group) => group.currencies)
        .map((row) => ({
          kind: row.kind,
          systemId: row.campaignCurrencySystemId,
          currencyId: row.currencyId,
          amount: row.amount
        })),
      [
        {
          kind: 'CAMPAIGN',
          systemId: currencySystem.id,
          currencyId: zeroDenomination.id,
          amount: 0
        }
      ]
    )
    await transfer(player, { kind: 'CHARACTER', characterId }, partyOwner, movedBag.id)
    if (vehicleId !== undefined)
      await transfer(owner, partyOwner, { kind: 'VEHICLE', vehicleId }, movedBag.id)
    const remaining = await player.query(api.characters.builder.activeCharacter, {
      id: characterId
    })
    assert.ok(remaining)
    assert.equal(
      remaining.state.equipment.inventory.some((item) => item.id === movedBag.id),
      false
    )
    for (const group of groups)
      assert.equal(
        remaining.state.currency.some((row) => row.id === group.id),
        false
      )
    const page =
      vehicleId === undefined
        ? await owner.query(api.campaigns.partyInventory.currencies, {
            campaignId,
            paginationOpts: { cursor: null, numItems: 48 }
          })
        : await owner.query(api.campaigns.vehicleInventory.currencies, {
            campaignId,
            vehicleId,
            paginationOpts: { cursor: null, numItems: 48 }
          })
    assert.equal(page.isDone, true)
    assert.deepEqual(
      page.page
        .filter((row) => row.containerId === movedBag.id)
        .map((row) => ({
          kind: row.kind,
          systemId: row.campaignCurrencySystemId,
          denominationId: row.denominationId,
          amount: row.amount
        })),
      [
        {
          kind: 'CAMPAIGN',
          systemId: currencySystem.id,
          denominationId: zeroDenomination.id,
          amount: 0
        }
      ]
    )
    stableGroups.push({
      ...(vehicleId === undefined ? {} : { vehicleId }),
      bagId: movedBag.id,
      groupIds: groups.map((row) => row.id),
      denominationId: zeroDenomination.id
    })
  }
  assert.equal(new Set(stableGroups.flatMap((row) => row.groupIds)).size, 3)
  await execute({ type: 'SET_HIT_POINTS', current: 3, temp: 2 })
  await execute({ type: 'CREATE_NOTE_GROUP', label: 'P09 private notes' })
  const grouped = await player.query(api.characters.sheet.get, { id: characterId })
  assert.ok(grouped)
  const group = grouped.notes.groups?.find((row) => row.label === 'P09 private notes')
  assert.ok(group)
  const privateBody = 'P09 Character private body survives Campaign deletion.'
  await execute({
    type: 'CREATE_NOTE',
    groupId: group.id,
    title: 'P09 private note',
    body: privateBody
  })
  const privateDraft = await player.mutation(api.characters.drafts.create, {
    id: characterId,
    systemId: current.systemId
  })
  const retainedDraft = await player.mutation(api.characters.drafts.save, {
    characterId,
    expectedDraftId: privateDraft.id,
    mode: 'edit',
    baseActiveUpdatedAt: privateDraft.baseActiveUpdatedAt,
    character: { ...privateDraft.payload.character, label: 'P09 private saved draft' },
    ...(privateDraft.payload.builderIntent === undefined
      ? {}
      : { builderIntent: privateDraft.payload.builderIntent })
  })
  assert.equal(await owner.query(api.characters.builder.activeCharacter, { id: characterId }), null)
  assert.equal(await owner.query(api.characters.sheet.get, { id: characterId }), null)
  const ownSheet = await player.query(api.characters.sheet.get, { id: characterId })
  const campaignSheet = await owner.query(api.campaigns.characterSheet.get, {
    campaignId,
    characterId
  })
  assert.ok(ownSheet && campaignSheet)
  assert.equal(JSON.stringify(ownSheet).includes(privateBody), true)
  assert.equal(JSON.stringify(campaignSheet).includes(privateBody), false)
  const [final, finalDraft] = await Promise.all([
    player.query(api.characters.builder.activeCharacter, { id: characterId }),
    player.query(api.characters.drafts.get, { id: characterId })
  ])
  assert.ok(final && finalDraft)
  assert.equal(final.intent.background.backgroundId, backgroundDraft.subjectId)
  assert.equal(
    finalDraft.payload.character.intent.background.backgroundId,
    backgroundDraft.subjectId
  )
  assert.equal(
    finalDraft.payload.character.status,
    'DRAFT',
    'The saved edit draft stays a draft; the personal Sheet above proves current active play access.'
  )
  assert.equal(finalDraft.payload.character.label, 'P09 private saved draft')
  assert.equal(final.state.hitpoints.current, 3)
  for (const item of final.state.equipment.inventory) assert.ok(item.retainedRulesJson)
  return {
    characterId,
    backgroundId: backgroundDraft.subjectId,
    bagId: bag.id,
    savedDraftId: retainedDraft.id,
    currencySystemId: currencySystem.id,
    denominationId: denomination.id,
    ownSheet,
    campaignSheet,
    character: final,
    savedDraft: retainedDraft,
    stableGroups
  }
}

function readNativeCharacterDraftPayload(tables: NativeTables, draft: Record<string, unknown>) {
  const payloadId = draft.payloadId
  const payloadDocumentId = draft.payloadDocumentId
  assert.equal(typeof payloadId, 'string')
  assert.equal(typeof payloadDocumentId, 'string')
  assert.equal(typeof draft.checksum, 'string')
  const payloadRows = tables.characterDraftPayloads
  const chunkRows = tables.characterDraftPayloadChunks
  assert.ok(payloadRows)
  assert.ok(chunkRows)
  const matches = payloadRows.filter(
    (row) =>
      row._id === payloadDocumentId && row.id === payloadId && row.characterId === draft.characterId
  )
  assert.equal(matches.length, 1)
  const payloadRow = matches[0]!
  assert.equal(payloadRow.checksum, draft.checksum)
  const chunks = chunkRows
    .filter((row) => row.payloadId === payloadId && row.characterId === draft.characterId)
    .sort((left, right) => Number(left.chunkIndex) - Number(right.chunkIndex))
  const hasInlinePayload = typeof payloadRow.payloadJson === 'string'
  const hasChunkCount = typeof payloadRow.chunkCount === 'number'
  const hasTotalByteLength = typeof payloadRow.totalByteLength === 'number'
  assert.equal(hasChunkCount, hasTotalByteLength)
  assert.equal(Number(hasInlinePayload) + Number(hasChunkCount), 1)
  let payloadJson: string
  if (hasInlinePayload) {
    assert.equal(chunks.length, 0)
    payloadJson = payloadRow.payloadJson as string
  } else {
    assert.equal(chunks.length, payloadRow.chunkCount)
    const bytes = chunks.map((chunk, index) => {
      assert.equal(chunk.chunkIndex, index)
      return materializeArrayBuffer(chunk.bytes)
    })
    payloadJson = decodeUtf8PayloadChunks(bytes, payloadRow.totalByteLength as number)
  }
  const raw: unknown = JSON.parse(payloadJson)
  assert.equal(checksumRuleDocument(raw), draft.checksum)
  return {
    payload: characterBuilderDraftPayloadDtoSchema.parse(raw),
    payloadJson,
    payloadRow,
    chunks
  }
}

/** The only permitted personal deltas for this complete, minimal-source fixture. */
export function reconcileCampaignDeletionPersonalExpected(input: {
  expected: NativeTables
  actual: NativeTables
  campaign: NativeTables
  characterId: string
  backgroundId: string
  fenceTimeMs: number
}) {
  const { expected, actual, campaign, characterId, backgroundId, fenceTimeMs } = input
  const records = expected.characters!.filter((row) => row.id === characterId)
  const plays = expected.characterPlayStates!.filter((row) => row.characterId === characterId)
  const drafts = expected.characterDrafts!.filter((row) => row.characterId === characterId)
  assert.equal(records.length, 1)
  assert.equal(plays.length, 1)
  assert.equal(drafts.length, 1)
  const record = records[0]!
  const play = plays[0]!
  const draft = drafts[0]!
  assert.equal(typeof draft.updatedAt, 'string')
  assert.equal(typeof play.streamVersion, 'number')
  const { _id: _recordId, _creationTime: _recordCreationTime, ...storedRecord } = record
  const { _id: _playId, _creationTime: _playCreationTime, ...storedPlay } = play
  const builds = expected.characterBuildStates!.filter((row) => row.characterId === characterId)
  assert.equal(builds.length, 1)
  const build = builds[0]!
  assert.equal(typeof build.updatedAt, 'string')
  const { _id: _buildId, _creationTime: _buildCreationTime, ...storedBuild } = build
  const collections = characterCollectionSchemas
  const readCollection = <Value>(table: string, schema: { parse: (input: unknown) => Value }) =>
    expected[table]!.filter((row) => row.characterId === characterId).map((row) => {
      const { _id: _collectionId, _creationTime: _collectionCreationTime, ...fields } = row
      return schema.parse(fields)
    })
  const stored = {
    ...assembleCharacterStructure(
      characterStoredHeadSchema.parse(storedRecord),
      characterStoredBuildStateSchema.parse(storedBuild),
      {
        characterInventoryItems: readCollection(
          'characterInventoryItems',
          collections.characterInventoryItems
        ),
        characterCurrencyGroups: readCollection(
          'characterCurrencyGroups',
          collections.characterCurrencyGroups
        ),
        characterClassSpellStates: readCollection(
          'characterClassSpellStates',
          collections.characterClassSpellStates
        ),
        characterSpellCustomizations: readCollection(
          'characterSpellCustomizations',
          collections.characterSpellCustomizations
        ),
        characterCreatureInstances: readCollection(
          'characterCreatureInstances',
          collections.characterCreatureInstances
        ),
        characterVehicleInstances: readCollection(
          'characterVehicleInstances',
          collections.characterVehicleInstances
        ),
        characterNotes: readCollection('characterNotes', collections.characterNotes),
        characterNoteGroups: readCollection('characterNoteGroups', collections.characterNoteGroups),
        characterExtraEquipment: readCollection(
          'characterExtraEquipment',
          collections.characterExtraEquipment
        )
      }
    ),
    play: characterStoredPlayStateSchema.parse(storedPlay)
  }
  const original = readCharacterRecord(stored)
  const originalDraft = readNativeCharacterDraftPayload(expected, draft).payload
  assert.equal(original.status, 'ACTIVE')
  assert.equal(original.intent.background.backgroundId, backgroundId)
  assert.equal(originalDraft.character.intent.background.backgroundId, backgroundId)
  const systems = new Set(campaign.campaignCurrencySystems!.map((row) => String(row.id)))
  const currency = original.state.currency.map((group) => ({
    ...group,
    currencies: group.currencies.filter((row) => {
      if (row.kind !== 'CAMPAIGN') return true
      assert.ok(
        row.campaignCurrencySystemId,
        'Campaign balances must have a qualified system identity.'
      )
      return !systems.has(row.campaignCurrencySystemId)
    })
  }))
  const departingBalances = original.state.currency
    .flatMap((group) => group.currencies)
    .filter(
      (row) =>
        row.kind === 'CAMPAIGN' &&
        row.campaignCurrencySystemId !== undefined &&
        systems.has(row.campaignCurrencySystemId)
    )
  assert.equal(departingBalances.length, 2)
  assert.equal(
    departingBalances.reduce((sum, row) => sum + row.amount, 0),
    8_589_934_594
  )
  const target = { subjectKind: 'BACKGROUND' as const, subjectId: backgroundId }
  const pruned = reconcileCharacterAuthoredSourceLoss(
    {
      ...original,
      state: { ...original.state, currency }
    },
    target,
    new Map()
  )
  const character = characterAuthoredDtoSchema.parse({ ...pruned, status: 'DRAFT' })
  assert.equal(character.intent.background.backgroundId, '')
  assert.equal(character.intent.startingEquipment?.background, undefined)
  assert.deepEqual(character.state, { ...original.state, currency })
  const actualRecords = actual.characters!.filter((row) => row._id === record._id)
  assert.equal(actualRecords.length, 1)
  // The structure clock lives on the build record (ADR 0035 Amendment 12).
  const actualBuilds = actual.characterBuildStates!.filter((row) => row._id === build._id)
  assert.equal(actualBuilds.length, 1)
  const updatedAt = actualBuilds[0]!.updatedAt
  assert.ok(typeof updatedAt === 'string')
  assert.equal(new Date(updatedAt).toISOString(), updatedAt)
  assert.ok(Date.parse(updatedAt) >= fenceTimeMs)
  assert.ok(Date.parse(updatedAt) > Date.parse(build.updatedAt as string))
  // The prune rewrites the structure (status, label, currency) and advances the play stream; the
  // play content itself is unchanged.
  const written = encodeCharacterRecord(stored, {
    document: character,
    streamVersion: stored.play.streamVersion + 1,
    updatedAt
  })
  assert.notEqual(written.checksum, stored.checksum)
  assert.deepEqual(written.play.state, play.state)
  expected.characters = expected.characters!.map((row) =>
    row._id !== record._id
      ? row
      : {
          ...row,
          label: character.label,
          status: 'DRAFT'
        }
  )
  const operational = encodeCharacterOperationalStructure({
    ...stored,
    ...written,
    status: 'DRAFT'
  })
  expected.characterBuildStates = expected.characterBuildStates!.map((row) =>
    row._id === build._id
      ? { _id: row._id, _creationTime: row._creationTime, ...operational.build }
      : row
  )
  for (const [table, rows] of Object.entries(operational.collections)) {
    const previous = expected[table]!.filter((row) => row.characterId === characterId)
    assert.equal(
      rows.length,
      previous.length,
      'Source pruning retains operational instance identities.'
    )
    expected[table] = expected[table]!.map((row) => {
      if (row.characterId !== characterId) return row
      const next = rows.find((candidate) => candidate.id === row.id)
      assert.ok(next, 'Source pruning retains operational instance identities.')
      return { _id: row._id, _creationTime: row._creationTime, ...next }
    })
  }
  expected.characterPlayStates = expected.characterPlayStates!.map((row) =>
    row._id !== play._id
      ? row
      : {
          ...row,
          streamVersion: written.play.streamVersion,
          state: written.play.state,
          checksum: written.play.checksum,
          updatedAt: written.play.updatedAt
        }
  )
  const prunedDraft = reconcileCharacterAuthoredSourceLoss(
    originalDraft.character,
    target,
    new Map()
  )
  const payload = characterBuilderDraftPayloadDtoSchema.parse({
    ...originalDraft,
    character: { ...prunedDraft, status: 'DRAFT', state: { ...prunedDraft.state, currency } }
  })
  const encodedDraft: unknown = JSON.parse(JSON.stringify(payload))
  const persistedPayload = characterBuilderDraftPayloadDtoSchema.parse(encodedDraft)
  const draftChecksum = checksumRuleDocument(encodedDraft)
  const actualDrafts = actual.characterDrafts!.filter((row) => row.characterId === characterId)
  assert.equal(actualDrafts.length, 1)
  const actualDraft = actualDrafts[0]!
  const draftUpdatedAt = actualDraft.updatedAt
  assert.ok(typeof draftUpdatedAt === 'string')
  assert.equal(new Date(draftUpdatedAt).toISOString(), draftUpdatedAt)
  assert.ok(Date.parse(draftUpdatedAt) > Date.parse(updatedAt))
  assert.ok(Date.parse(draftUpdatedAt) > Date.parse(draft.updatedAt as string))
  assert.equal(typeof actualDraft.payloadId, 'string')
  const { payloadId: previousPayloadId, ...stableDraft } = draft
  const expectedDraft = {
    ...stableDraft,
    label: payload.character.label,
    baseActiveUpdatedAt: updatedAt,
    updatedAt: draftUpdatedAt,
    payloadId: actualDraft.payloadId,
    checksum: draftChecksum
  }
  assert.deepEqual(actualDraft, expectedDraft)
  const storedDraft = readNativeCharacterDraftPayload(actual, actualDraft)
  assert.deepEqual(storedDraft.payload, persistedPayload)
  const payloadJson = canonicalizeRuleDocument(encodedDraft)
  const totalByteLength = new TextEncoder().encode(payloadJson).byteLength
  // Inline in its one payload document below the limit; chunked above it (ADR 0036 S8).
  const expectedChunks =
    totalByteLength > CHARACTER_DRAFT_PAYLOAD_INLINE_MAX_BYTES
      ? encodeUtf8PayloadChunks(payloadJson)
      : []
  assert.equal(storedDraft.payloadJson, payloadJson)
  // The payload document is replaced in place.
  assert.equal(storedDraft.payloadRow._id, draft.payloadDocumentId)
  const expectedPayloadRow = {
    _id: storedDraft.payloadRow._id,
    _creationTime: storedDraft.payloadRow._creationTime,
    id: actualDraft.payloadId,
    characterId,
    ...(expectedChunks.length > 0
      ? { chunkCount: expectedChunks.length, totalByteLength }
      : { payloadJson }),
    checksum: draftChecksum,
    createdAt: draftUpdatedAt
  }
  assert.deepEqual(storedDraft.payloadRow, expectedPayloadRow)
  const expectedChunkRows = storedDraft.chunks.map((row, index) => {
    const bytes = materializeArrayBuffer(row.bytes)
    assert.deepEqual(new Uint8Array(bytes), new Uint8Array(expectedChunks[index]!))
    return {
      _id: row._id,
      _creationTime: row._creationTime,
      characterId,
      payloadId: actualDraft.payloadId,
      chunkIndex: index,
      bytes: row.bytes
    }
  })
  assert.deepEqual(storedDraft.chunks, expectedChunkRows)
  if (typeof previousPayloadId === 'string') {
    assert.notEqual(actualDraft.payloadId, previousPayloadId)
    assert.equal(
      actual.characterDraftPayloads!.some((row) => row.id === previousPayloadId),
      false
    )
    assert.equal(
      actual.characterDraftPayloadChunks!.some((row) => row.payloadId === previousPayloadId),
      false
    )
  }
  expected.characterDrafts = expected.characterDrafts!.map((row) =>
    row._id === draft._id ? actualDraft : row
  )
  expected.characterDraftPayloads = [
    ...expected.characterDraftPayloads!.filter((row) => row._id !== storedDraft.payloadRow._id),
    expectedPayloadRow
  ].sort((left, right) => String(left._id).localeCompare(String(right._id)))
  expected.characterDraftPayloadChunks = [
    ...expected.characterDraftPayloadChunks!.filter((row) => row.payloadId !== previousPayloadId),
    ...expectedChunkRows
  ].sort((left, right) => String(left._id).localeCompare(String(right._id)))
  const markers = expected.sceneVisionRevisions!.filter(
    (row) => row.scope === 'CHARACTER' && row.id === characterId
  )
  assert.equal(markers.length, 1)
  const beforeMarker = markers[0]!
  const afterMarkers = actual.sceneVisionRevisions!.filter((row) => row._id === beforeMarker._id)
  assert.equal(afterMarkers.length, 1)
  const afterMarker = afterMarkers[0]!
  const revision = sceneVisionRevisionSchema.shape.revision.parse(afterMarker.revision)
  assert.notEqual(revision, beforeMarker.revision)
  expected.sceneVisionRevisions = expected.sceneVisionRevisions!.map((row) =>
    row._id !== beforeMarker._id ? row : { ...row, revision }
  )
  return {
    updatedAt,
    draftUpdatedAt,
    removedCurrencyAmount: 8_589_934_594,
    checksum: written.checksum
  }
}
