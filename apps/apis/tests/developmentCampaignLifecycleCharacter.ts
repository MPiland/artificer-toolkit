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
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { reconcileCharacterAuthoredSourceLoss } from '@artificer-toolkit/rules-runtime/character/characterSourceLoss'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { backpack } from '@artificer-toolkit/source-data/srd/equipment/backpack.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api } from '../convex/_generated/api.js'
import { decodeUtf8PayloadChunks, encodeUtf8PayloadChunks } from '../convex/lib/jsonPayloadChunks'

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
  const current = await player.query(api.characters.builder.get, { id: characterId })
  assert.ok(current)
  const opened = await player.mutation(api.characters.drafts.create, {
    id: characterId,
    systemId: current.character.systemId
  })
  const saved = await player.mutation(api.characters.drafts.save, {
    characterId,
    expectedDraftId: opened.id,
    mode: 'edit',
    baseActiveUpdatedAt: opened.baseActiveUpdatedAt,
    character: {
      ...opened.payload.character,
      intent: {
        ...current.character.intent,
        background: { backgroundId: backgroundDraft.subjectId },
        startingEquipment: {
          ...current.character.intent.startingEquipment,
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
  const beforeBag = await player.query(api.characters.builder.get, { id: characterId })
  assert.ok(beforeBag)
  await execute({ type: 'ADD_INVENTORY_ITEM', equipmentId: backpack.id, quantity: 1 })
  const withBag = await player.query(api.characters.builder.get, { id: characterId })
  assert.ok(withBag)
  const addedBags = withBag.character.state.equipment.inventory.filter(
    (row) => !beforeBag.character.state.equipment.inventory.some((old) => old.id === row.id)
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
    const before = await player.query(api.characters.builder.get, { id: characterId })
    assert.ok(before)
    await execute({
      type: 'ADD_INVENTORY_ITEM',
      equipmentId: backpack.id,
      quantity: 1,
      customName: 'P09 stable coin group container'
    })
    const after = await player.query(api.characters.builder.get, { id: characterId })
    assert.ok(after)
    const bags = after.character.state.equipment.inventory.filter(
      (item) => !before.character.state.equipment.inventory.some((old) => old.id === item.id)
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
    const populated = await player.query(api.characters.builder.get, { id: characterId })
    assert.ok(populated)
    const groups = populated.character.state.currency.filter(
      (group) => group.containerId === movedBag.id
    )
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
    const remaining = await player.query(api.characters.builder.get, { id: characterId })
    assert.ok(remaining)
    assert.equal(
      remaining.character.state.equipment.inventory.some((item) => item.id === movedBag.id),
      false
    )
    for (const group of groups)
      assert.equal(
        remaining.character.state.currency.some((row) => row.id === group.id),
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
    systemId: current.character.systemId
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
  assert.equal(await owner.query(api.characters.builder.get, { id: characterId }), null)
  assert.equal(await owner.query(api.characters.sheet.get, { id: characterId }), null)
  const ownSheet = await player.query(api.characters.sheet.get, { id: characterId })
  const campaignSheet = await owner.query(api.campaigns.characterSheet.get, {
    campaignId,
    characterId
  })
  assert.ok(ownSheet && campaignSheet)
  assert.equal(JSON.stringify(ownSheet).includes(privateBody), true)
  assert.equal(JSON.stringify(campaignSheet).includes(privateBody), false)
  const final = await player.query(api.characters.builder.get, { id: characterId })
  assert.ok(final)
  assert.equal(final.character.intent.background.backgroundId, backgroundDraft.subjectId)
  assert.equal(
    final.character.status,
    'DRAFT',
    'Builder returns the saved edit draft; the personal Sheet above proves current active play access.'
  )
  assert.equal(final.character.label, 'P09 private saved draft')
  assert.equal(final.character.state.hitpoints.current, 3)
  for (const item of final.character.state.equipment.inventory) assert.ok(item.retainedRulesJson)
  return {
    characterId,
    backgroundId: backgroundDraft.subjectId,
    bagId: bag.id,
    savedDraftId: retainedDraft.id,
    currencySystemId: currencySystem.id,
    denominationId: denomination.id,
    ownSheet,
    campaignSheet,
    character: final.character,
    savedDraft: retainedDraft,
    stableGroups
  }
}

function readNativeCharacterDraftPayload(tables: NativeTables, draft: Record<string, unknown>) {
  const inlinePayloadJson = draft.payloadJson
  const payloadId = draft.payloadId
  assert.equal(
    Number(typeof inlinePayloadJson === 'string') + Number(typeof payloadId === 'string'),
    1,
    'Character draft must use exactly one Convex payload representation.'
  )
  assert.equal(typeof draft.checksum, 'string')
  const payloadRows = tables.characterDraftPayloads
  const chunkRows = tables.characterDraftPayloadChunks
  assert.ok(payloadRows)
  assert.ok(chunkRows)
  if (typeof inlinePayloadJson === 'string') {
    const raw: unknown = JSON.parse(inlinePayloadJson)
    assert.equal(checksumRuleDocument(raw), draft.checksum)
    return {
      payload: characterBuilderDraftPayloadDtoSchema.parse(raw),
      payloadJson: inlinePayloadJson,
      payloadRow: null,
      chunks: [] as Record<string, unknown>[]
    }
  }

  const matches = payloadRows.filter(
    (row) => row.id === payloadId && row.characterId === draft.characterId
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
  const drafts = expected.characterDrafts!.filter((row) => row.characterId === characterId)
  assert.equal(records.length, 1)
  assert.equal(drafts.length, 1)
  const record = records[0]!
  const draft = drafts[0]!
  assert.equal(typeof record.documentJson, 'string')
  assert.equal(typeof record.updatedAt, 'string')
  assert.equal(typeof draft.updatedAt, 'string')
  assert.equal(typeof record.streamVersion, 'number')
  const original = characterAuthoredDtoSchema.parse(JSON.parse(record.documentJson as string))
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
  const encoded: unknown = JSON.parse(JSON.stringify(character))
  const actualRecords = actual.characters!.filter((row) => row._id === record._id)
  assert.equal(actualRecords.length, 1)
  const updatedAt = actualRecords[0]!.updatedAt
  assert.ok(typeof updatedAt === 'string')
  assert.equal(new Date(updatedAt).toISOString(), updatedAt)
  assert.ok(Date.parse(updatedAt) >= fenceTimeMs)
  assert.ok(Date.parse(updatedAt) > Date.parse(record.updatedAt as string))
  const checksum = checksumRuleDocument(encoded)
  assert.notEqual(checksum, record.checksum)
  expected.characters = expected.characters!.map((row) =>
    row._id !== record._id
      ? row
      : {
          ...row,
          label: character.label,
          status: 'DRAFT',
          streamVersion: (record.streamVersion as number) + 1,
          documentJson: canonicalizeRuleDocument(encoded),
          checksum,
          updatedAt
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
  const { payloadJson: _payloadJson, payloadId: previousPayloadId, ...stableDraft } = draft
  const expectedDraft = {
    ...stableDraft,
    label: payload.character.label,
    baseActiveUpdatedAt: updatedAt,
    updatedAt: draftUpdatedAt,
    payloadId: actualDraft.payloadId,
    checksum: draftChecksum
  }
  assert.deepEqual(actualDraft, expectedDraft)
  const stored = readNativeCharacterDraftPayload(actual, actualDraft)
  assert.deepEqual(stored.payload, persistedPayload)
  assert.ok(stored.payloadRow)
  const payloadJson = canonicalizeRuleDocument(encodedDraft)
  const expectedChunks = encodeUtf8PayloadChunks(payloadJson)
  const totalByteLength = expectedChunks.reduce((total, chunk) => total + chunk.byteLength, 0)
  assert.equal(stored.payloadJson, payloadJson)
  const expectedPayloadRow = {
    _id: stored.payloadRow._id,
    _creationTime: stored.payloadRow._creationTime,
    id: actualDraft.payloadId,
    characterId,
    chunkCount: expectedChunks.length,
    totalByteLength,
    checksum: draftChecksum,
    createdAt: draftUpdatedAt
  }
  assert.deepEqual(stored.payloadRow, expectedPayloadRow)
  const expectedChunkRows = stored.chunks.map((row, index) => {
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
  assert.deepEqual(stored.chunks, expectedChunkRows)
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
    ...expected.characterDraftPayloads!.filter((row) => row.id !== previousPayloadId),
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
  return { updatedAt, draftUpdatedAt, removedCurrencyAmount: 8_589_934_594, checksum }
}
