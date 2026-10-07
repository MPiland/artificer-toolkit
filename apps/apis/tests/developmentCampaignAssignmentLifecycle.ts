import assert from 'node:assert/strict'
import type { FunctionReturnType } from 'convex/server'
import { decodeCampaignEventPage } from '@artificer-toolkit/schema/api/campaignEventTransport'
import {
  campaignEventDtoSchema,
  type CampaignEventDto
} from '@artificer-toolkit/schema/api/campaignLiveState'
import { canonicalizeRuleDocument } from '@artificer-toolkit/shared/rules'
import type { CampaignPartyInventoryMutationInput } from '@artificer-toolkit/schema/api/campaignInventory'
import type { CharacterSheetCommandInputDto } from '@artificer-toolkit/schema/api/characterSheetCommands'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { backpack } from '@artificer-toolkit/source-data/srd/equipment/backpack.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { api } from '../convex/_generated/api.js'
import type { DevelopmentClient } from './developmentClient'
import type { CampaignCustodyCohort } from './developmentCampaignCustody'

type Page<T> = { page: T[]; isDone: boolean; continueCursor: string; version?: number }
type ActiveCharacter = NonNullable<
  FunctionReturnType<typeof api.characters.builder.activeCharacter>
>
type CharacterIntent = ActiveCharacter['intent']
type WithoutCommandMetadata<T> = T extends unknown
  ? Omit<T, 'commandId' | 'expectedVersion'>
  : never
type SheetFields = WithoutCommandMetadata<CharacterSheetCommandInputDto>

async function collectPages<T>(load: (cursor: string | null) => Promise<Page<T>>) {
  const rows: T[] = []
  const cursors = new Set<string>()
  let cursor: string | null = null
  let version: number | undefined
  while (true) {
    const result = await load(cursor)
    if (result.version !== undefined) {
      version ??= result.version
      assert.equal(result.version, version, 'All inventory pages use one owner version.')
    }
    rows.push(...result.page)
    if (result.isDone) {
      const ids = rows.map((row) =>
        typeof row === 'object' && row !== null && 'id' in row ? row.id : null
      )
      if (ids.every((id) => typeof id === 'string'))
        assert.equal(new Set(ids).size, ids.length, 'Complete pages contain unique identities.')
      return rows
    }
    assert.ok(result.continueCursor, 'Incomplete inventory pages need a continuation cursor.')
    assert.equal(cursors.has(result.continueCursor), false, 'Inventory page cursor must advance.')
    cursors.add(result.continueCursor)
    cursor = result.continueCursor
  }
}

/** Public P10/P12 proof for replacement and explicit unassignment without fixture-only writes. */
export async function verifyCampaignAssignmentLifecycle(
  cohort: CampaignCustodyCohort,
  anonymous: DevelopmentClient,
  replacementCharacterId: string
) {
  if (fighter.category !== 'BASE')
    throw new Error('Assignment lifecycle requires the base Fighter.')
  const [first, second] = cohort.players
  const [originalId, secondId] = cohort.characterIds
  const [firstUserId, secondUserId] = cohort.playerUserIds
  const { campaignId, owner } = cohort
  const replacementId = replacementCharacterId.toLowerCase()
  const rulesetGoldId = fighter.startingGold.currencyId
  const pagination = (cursor: string | null) => ({ cursor, numItems: 1 })

  const loadItems = () =>
    collectPages((cursor) =>
      owner.query(api.campaigns.partyInventory.items, {
        campaignId,
        paginationOpts: pagination(cursor)
      })
    )
  const loadCurrencies = () =>
    collectPages((cursor) =>
      owner.query(api.campaigns.partyInventory.currencies, {
        campaignId,
        paginationOpts: pagination(cursor)
      })
    )
  const audit = async () => {
    const events: FunctionReturnType<typeof api.campaigns.inventoryAudit.list>['events'] = []
    const cursors = new Set<string>()
    let cursor: string | undefined
    while (true) {
      const page = await owner.query(api.campaigns.inventoryAudit.list, {
        campaignId,
        limit: 8,
        ...(cursor === undefined ? {} : { cursor })
      })
      events.push(...page.events)
      if (page.nextCursor === null) return events
      assert.equal(cursors.has(page.nextCursor), false, 'Audit cursor must advance.')
      cursors.add(page.nextCursor)
      cursor = page.nextCursor
    }
  }
  const history = async (client: DevelopmentClient, characterId: string) => {
    const rows: CampaignEventDto[] = []
    const cursors = new Set<string>()
    let cursor: string | undefined
    while (true) {
      const page = decodeCampaignEventPage(
        await client.query(api.campaigns.events.list, {
          campaignId,
          characterId,
          limit: 8,
          ...(cursor === undefined ? {} : { cursor })
        })
      )
      rows.push(...page.events)
      if (page.nextCursor === null) return rows
      assert.equal(cursors.has(page.nextCursor), false, 'History cursor must advance.')
      cursors.add(page.nextCursor)
      cursor = page.nextCursor
    }
  }
  const attempt = async <T>(operation: () => Promise<T>) => {
    try {
      return { ok: true as const, value: await operation() }
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : String(error) }
    }
  }
  const restrictedRead = async <T>(operation: () => Promise<T>) => {
    const result = await attempt(operation)
    if (result.ok) return result
    assert.match(
      result.error,
      /Assigned Character not found|Builder repair/i,
      'Unexpected backend read failures must fail the proof.'
    )
    return {
      ok: false as const,
      error: /Builder repair/i.test(result.error) ? 'BUILDER_REPAIR' : 'UNASSIGNED'
    }
  }
  const snapshot = async () => {
    const [
      campaign,
      items,
      currencies,
      partyFence,
      firstCharacters,
      firstActive,
      secondActive,
      replacementActive,
      firstDraft,
      secondDraft,
      replacementDraft,
      firstSheet,
      secondSheet,
      replacementSheet,
      firstCampaignSheet,
      replacementCampaignSheet,
      rows,
      events,
      replacementEvents
    ] = await Promise.all([
      owner.query(api.campaigns.queries.get, { id: campaignId }),
      loadItems(),
      loadCurrencies(),
      owner.query(api.campaigns.inventoryOwners.version, {
        input: { campaignId, owner: { kind: 'CAMPAIGN', campaignId } }
      }),
      collectPages((cursor) =>
        first.client.query(api.characters.list.list, { paginationOpts: pagination(cursor) })
      ),
      first.client.query(api.characters.builder.activeCharacter, { id: originalId }),
      second.client.query(api.characters.builder.activeCharacter, { id: secondId }),
      first.client.query(api.characters.builder.activeCharacter, { id: replacementId }),
      first.client.query(api.characters.drafts.get, { id: originalId }),
      second.client.query(api.characters.drafts.get, { id: secondId }),
      first.client.query(api.characters.drafts.get, { id: replacementId }),
      restrictedRead(() => first.client.query(api.characters.sheet.get, { id: originalId })),
      restrictedRead(() => second.client.query(api.characters.sheet.get, { id: secondId })),
      restrictedRead(() => first.client.query(api.characters.sheet.get, { id: replacementId })),
      restrictedRead(() =>
        owner.query(api.campaigns.characterSheet.get, { campaignId, characterId: originalId })
      ),
      restrictedRead(() =>
        owner.query(api.campaigns.characterSheet.get, { campaignId, characterId: replacementId })
      ),
      audit(),
      history(owner, secondId),
      restrictedRead(() => history(first.client, originalId))
    ])
    assert.ok(campaign && firstActive && secondActive && replacementActive)
    const firstCharacter = firstCharacters.find((entry) => entry.id === originalId)
    assert.ok(
      firstCharacter,
      'Current active/repair Character must exist in complete public listing.'
    )
    assert.equal(
      partyFence.version,
      (
        await owner.query(api.campaigns.partyInventory.items, {
          campaignId,
          paginationOpts: pagination(null)
        })
      ).version
    )
    return structuredClone({
      campaign,
      items,
      currencies,
      partyFence,
      firstCharacters,
      firstCharacter,
      firstActive,
      secondActive,
      replacementActive,
      firstDraft,
      secondDraft,
      replacementDraft,
      firstSheet,
      secondSheet,
      replacementSheet,
      firstCampaignSheet,
      replacementCampaignSheet,
      audit: rows,
      history: events,
      replacementHistory: replacementEvents
    })
  }
  const refuse = async (label: string, action: () => Promise<unknown>, pattern: RegExp) => {
    const before = await snapshot()
    await assert.rejects(action, pattern)
    assert.deepEqual(await snapshot(), before, label + ' must not write.')
  }
  const execute = async (client: DevelopmentClient, id: string, fields: SheetFields) => {
    const before = await client.query(api.characters.sheet.get, { id })
    assert.ok(before, 'Own Sheet must exist before a personal command.')
    const result = await client.mutation(api.characters.sheetCommands.execute, {
      id,
      command: {
        ...fields,
        commandId: crypto.randomUUID(),
        expectedVersion: before.meta.streamVersion
      } as CharacterSheetCommandInputDto
    })
    assert.equal(result.streamVersion, before.meta.streamVersion + 1)
    return result
  }
  const commitIntent = async (intent: CharacterIntent) => {
    const current = await first.client.query(api.characters.builder.activeCharacter, {
      id: originalId
    })
    assert.ok(current)
    const draft = await first.client.mutation(api.characters.drafts.create, {
      id: originalId,
      systemId: current.systemId
    })
    const saved = await first.client.mutation(api.characters.drafts.save, {
      characterId: originalId,
      expectedDraftId: draft.id,
      mode: 'edit',
      baseActiveUpdatedAt: draft.baseActiveUpdatedAt,
      character: { ...draft.payload.character, intent },
      ...(draft.payload.builderIntent === undefined
        ? {}
        : { builderIntent: draft.payload.builderIntent })
    })
    return first.client.mutation(api.characters.commit.commit, {
      expectedDraftId: saved.id,
      mode: 'edit',
      character: saved.payload.character
    })
  }
  const restoreOriginal = async (intent: CharacterIntent) => {
    const current = await first.client.query(api.characters.builder.activeCharacter, {
      id: originalId
    })
    assert.ok(current)
    if (canonicalizeRuleDocument(current.intent) !== canonicalizeRuleDocument(intent))
      await commitIntent(intent)
    const campaign = await owner.query(api.campaigns.queries.get, { id: campaignId })
    assert.ok(campaign)
    const firstMembership = campaign.memberships.find((entry) => entry.userId === firstUserId)
    if (firstMembership?.assignedCharacter?.id !== originalId)
      await first.client.mutation(api.campaigns.assignments.assign, {
        campaignId,
        characterId: originalId
      })
  }

  type Snapshot = Awaited<ReturnType<typeof snapshot>>
  const proveDeparture = (
    before: Snapshot,
    after: Snapshot,
    status: 'ACTIVE' | 'DRAFT',
    reason: string,
    systemId: string
  ) => {
    const currency = before.firstActive.state.currency.map((group) => ({
      ...group,
      currencies: group.currencies.filter(
        (row) => row.kind !== 'CAMPAIGN' || row.campaignCurrencySystemId !== systemId
      )
    }))
    const expectedState = { ...before.firstActive.state, currency }
    if (status === 'ACTIVE') {
      assert.ok(after.firstSheet.ok && after.firstSheet.value)
      expectedState.hitpoints = {
        ...expectedState.hitpoints,
        current: Math.min(
          expectedState.hitpoints.current,
          after.firstSheet.value.overview.maxHitPoints
        )
      }
      assert.ok(before.firstSheet.ok && before.firstSheet.value)
      assert.deepEqual(
        after.firstSheet.value.notes,
        before.firstSheet.value.notes,
        'Private Sheet notes remain literal.'
      )
    }
    assert.equal(after.firstCharacter.status, status)
    assert.ok(before.firstSheet.ok && before.firstSheet.value)
    const streamVersion = before.firstSheet.value.meta.streamVersion + 1
    assert.equal(after.firstCharacter.streamVersion, streamVersion)
    if (status === 'ACTIVE') {
      assert.ok(after.firstSheet.ok && after.firstSheet.value)
      assert.equal(after.firstSheet.value.meta.streamVersion, streamVersion)
    }
    assert.deepEqual(
      after.firstActive.state,
      expectedState,
      'All physical IDs, raw retained rules, nested placement, qualified unrelated coins and private state remain exact.'
    )
    assert.deepEqual(after.secondActive, before.secondActive)
    assert.deepEqual(after.secondSheet, before.secondSheet)
    assert.deepEqual(after.secondDraft, before.secondDraft)
    assert.deepEqual(after.replacementActive, before.replacementActive)
    assert.deepEqual(after.replacementDraft, before.replacementDraft)
    assert.deepEqual(after.items, before.items, 'Party physical custody is unchanged.')
    assert.equal(after.partyFence.version, before.partyFence.version + 1)
    const key = (denominationId: string, currencySystemId: string | null | undefined) =>
      JSON.stringify([currencySystemId ?? null, denominationId])
    const values = (rows: typeof before.currencies) => {
      const totals = new Map<string, bigint>()
      for (const row of rows) {
        assert.ok(Number.isSafeInteger(row.amount) && row.amount >= 0)
        const identity = key(row.denominationId, row.campaignCurrencySystemId)
        totals.set(identity, (totals.get(identity) ?? 0n) + BigInt(row.amount))
      }
      return totals
    }
    const returned = new Map<string, bigint>()
    for (const group of before.firstActive.state.currency)
      for (const row of group.currencies)
        if (row.kind === 'CAMPAIGN' && row.campaignCurrencySystemId === systemId) {
          const identity = key(row.currencyId, systemId)
          returned.set(identity, (returned.get(identity) ?? 0n) + BigInt(row.amount))
        }
    const expectedTotals = values(before.currencies)
    for (const [identity, amount] of returned)
      expectedTotals.set(identity, (expectedTotals.get(identity) ?? 0n) + amount)
    assert.deepEqual(
      [...values(after.currencies)].sort(([left], [right]) => left.localeCompare(right)),
      [...expectedTotals].sort(([left], [right]) => left.localeCompare(right)),
      'Every qualified BigInt total is conserved exactly.'
    )
    const placedKey = (row: (typeof before.currencies)[number]) =>
      JSON.stringify([row.campaignCurrencySystemId ?? null, row.denominationId, row.containerId])
    for (const old of before.currencies) {
      const moved = returned.get(key(old.denominationId, old.campaignCurrencySystemId)) ?? 0n
      const expected =
        moved > 0n &&
        old.containerId === null &&
        BigInt(old.amount) + moved <= BigInt(Number.MAX_SAFE_INTEGER)
          ? { ...old, amount: old.amount + Number(moved) }
          : old
      assert.ok(
        after.currencies.some(
          (row) => canonicalizeRuleDocument(row) === canonicalizeRuleDocument(expected)
        ),
        'Existing qualified Party balance and metadata stay literal.'
      )
    }
    for (const row of after.currencies.filter(
      (row) => !before.currencies.some((old) => placedKey(row) === placedKey(old))
    )) {
      assert.equal(row.containerId, null)
      assert.equal(
        BigInt(row.amount),
        returned.get(key(row.denominationId, row.campaignCurrencySystemId))
      )
    }
    const added = after.audit.filter((event) => !before.audit.some((old) => old.id === event.id))
    assert.equal(added.length, 1)
    const receipt = added[0]
    assert.ok(receipt && receipt.kind === 'CUSTODY_TRANSFER')
    const payload = campaignEventDtoSchema.shape.payload.parse(JSON.parse(receipt.payloadJson))
    assert.ok(payload !== null && typeof payload === 'object' && !Array.isArray(payload))
    assert.equal(payload.reason, reason)
    assert.deepEqual(payload.custodyContext, {
      sourceOwnerId: originalId,
      destinationOwnerId: campaignId
    })
    const denominations = [...returned]
      .filter(([, amount]) => amount > 0n)
      .map(([identity, amount]) => {
        const [currencySystemId, denominationId] = JSON.parse(identity) as [string, string]
        return {
          denominationId,
          kind: 'CAMPAIGN',
          campaignCurrencySystemId: currencySystemId,
          amount: amount.toString(),
          beforeSourceAmount: amount.toString(),
          afterSourceAmount: '0'
        }
      })
    assert.deepEqual(
      payload.denominations,
      denominations.sort((a, b) => a.denominationId.localeCompare(b.denominationId))
    )
    assert.ok(before.firstDraft && after.firstDraft)
    assert.equal(after.firstDraft.id, before.firstDraft.id)
    assert.equal(
      after.firstDraft.payload.character.label,
      before.firstDraft.payload.character.label
    )
    assert.deepEqual(after.firstDraft.payload.character.state, {
      ...before.firstDraft.payload.character.state,
      currency
    })
    assert.equal(after.firstCampaignSheet.ok, false)
    assert.equal(JSON.stringify(after.history).includes('Assignment private note'), false)
    return streamVersion
  }
  const proveReconciliation = (
    events: CampaignEventDto[],
    reason: string,
    status: 'ACTIVE' | 'DRAFT',
    streamVersion: number
  ) => {
    const receipts = events.filter(
      (event) =>
        event.type === 'CAMPAIGN_CHARACTER_RECONCILED' &&
        event.payload !== null &&
        typeof event.payload === 'object' &&
        !Array.isArray(event.payload) &&
        event.payload.reason === reason
    )
    assert.equal(receipts.length, 1)
    const receipt = receipts[0]
    assert.ok(
      receipt &&
        receipt.payload !== null &&
        typeof receipt.payload === 'object' &&
        !Array.isArray(receipt.payload)
    )
    assert.equal(receipt.subjectCharacterId, originalId)
    assert.equal(receipt.visibility, 'SUBJECT')
    assert.equal(receipt.payload.characterId, originalId)
    assert.equal(receipt.payload.status, status)
    assert.equal(receipt.payload.streamVersion, streamVersion)
    assert.equal(receipt.payload.draftOnly, false)
    assert.equal(JSON.stringify(receipt).includes('Assignment private note'), false)
    return receipt
  }
  const unshare = async (subjectKind: 'BACKGROUND' | 'EQUIPMENT', subjectId: string) => {
    const campaign = await owner.query(api.campaigns.queries.get, { id: campaignId })
    assert.ok(campaign)
    return second.client.mutation(api.campaigns.contentShares.unshare, {
      campaignId,
      subjectKind,
      subjectId,
      sharedBy: secondUserId,
      expectedCampaignVersion: campaign.version,
      commandId: crypto.randomUUID()
    })
  }
  const initial = await snapshot()
  const originalIntent = initial.firstActive.intent
  const secondIntent = initial.secondActive.intent
  const sharedBackgroundId = secondIntent.background.backgroundId
  let sharedEquipmentId: string | undefined
  assert.ok(sharedBackgroundId, 'Second Character needs its published Background.')
  assert.ok(secondIntent.startingEquipment?.background)
  assert.equal(
    initial.campaign.memberships.find((entry) => entry.userId === firstUserId)?.assignedCharacter
      ?.id,
    originalId
  )
  assert.equal(
    initial.campaign.memberships.find((entry) => entry.userId === secondUserId)?.assignedCharacter
      ?.id,
    secondId
  )
  assert.equal(initial.replacementActive.status, 'ACTIVE')
  assert.equal(initial.replacementSheet.ok, true)

  try {
    await refuse(
      'anonymous assignment',
      () =>
        anonymous.mutation(api.campaigns.assignments.assign, {
          campaignId,
          characterId: originalId
        }),
      /identity|authenticated|authorized|permission/i
    )
    await refuse(
      'foreign player assignment',
      () =>
        second.client.mutation(api.campaigns.assignments.assign, {
          campaignId,
          characterId: originalId
        }),
      /unavailable|character/i
    )
    // Without a Character the GM removes only their own, which they do not have (CAMPAIGN-7).
    const noOwnerCharacter = await snapshot()
    assert.deepEqual(await owner.mutation(api.campaigns.assignments.unassign, { campaignId }), {
      ok: true
    })
    assert.deepEqual(
      await snapshot(),
      noOwnerCharacter,
      'Owner unassignment without their own Character must not write.'
    )
    await refuse(
      'invalid assignment UUID',
      () =>
        first.client.mutation(api.campaigns.assignments.assign, {
          campaignId,
          characterId: crypto.randomUUID()
        }),
      /unavailable|not found/i
    )

    let equipmentDraft = await second.client.mutation(api.content.drafts.duplicate, {
      subjectKind: 'EQUIPMENT',
      subjectId: backpack.id
    })
    equipmentDraft = await second.client.mutation(api.content.drafts.save, {
      subjectKind: 'EQUIPMENT',
      subjectId: equipmentDraft.subjectId,
      systemId: equipmentDraft.systemId,
      label: `Assignment departure pack ${crypto.randomUUID()}`,
      payload: equipmentDraft.payload
    })
    assert.ok(equipmentDraft.updatedAt)
    const sharedEquipment = await second.client.mutation(api.content.publication.publishDraft, {
      subjectKind: 'EQUIPMENT',
      subjectId: equipmentDraft.subjectId,
      expectedDraftUpdatedAt: equipmentDraft.updatedAt
    })
    sharedEquipmentId = sharedEquipment.subjectId
    await Promise.all([
      second.client.mutation(api.campaigns.contentShares.share, {
        campaignId,
        subjectKind: 'EQUIPMENT',
        subjectId: sharedEquipment.subjectId
      }),
      second.client.mutation(api.campaigns.contentShares.share, {
        campaignId,
        subjectKind: 'BACKGROUND',
        subjectId: sharedBackgroundId
      })
    ])

    await commitIntent({
      ...originalIntent,
      background: { backgroundId: sharedBackgroundId },
      startingEquipment: {
        ...originalIntent.startingEquipment,
        background: secondIntent.startingEquipment.background
      }
    })
    const afterBackground = await first.client.query(api.characters.builder.activeCharacter, {
      id: originalId
    })
    assert.ok(afterBackground)
    assert.equal(afterBackground.intent.background.backgroundId, sharedBackgroundId)

    const beforePack = await first.client.query(api.characters.builder.activeCharacter, {
      id: originalId
    })
    assert.ok(beforePack)
    await execute(first.client, originalId, {
      type: 'ADD_INVENTORY_ITEM',
      equipmentId: sharedEquipment.subjectId,
      quantity: 1,
      customName: 'Assignment departure pack',
      notes: 'Retain this acquired pack.'
    })
    const withPack = await first.client.query(api.characters.builder.activeCharacter, {
      id: originalId
    })
    assert.ok(withPack)
    const pack = withPack.state.equipment.inventory.find(
      (item) => !beforePack.state.equipment.inventory.some((old) => old.id === item.id)
    )
    assert.ok(pack?.retainedRulesJson)
    const packSheet = await first.client.query(api.characters.sheet.get, { id: originalId })
    assert.ok(packSheet?.inventory.containers?.some((container) => container.id === pack.id))
    await execute(first.client, originalId, {
      type: 'ADD_INVENTORY_ITEM',
      equipmentId: club.id,
      quantity: 1,
      containerId: pack.id,
      customName: 'Assignment nested club'
    })
    await execute(first.client, originalId, {
      type: 'ADJUST_CURRENCY',
      kind: 'RULESET',
      currencyId: rulesetGoldId,
      amount: 3,
      containerId: pack.id
    })

    const currentSystems = await collectPages((cursor) =>
      owner.query(api.campaigns.currencySystems.list, {
        campaignId,
        paginationOpts: pagination(cursor)
      })
    )
    let currencySystem = await owner.mutation(api.campaigns.currencySystems.save, {
      campaignId,
      label: `Assignment Gold ${crypto.randomUUID()}`,
      isReference: !currentSystems.some((entry) => entry.isReference),
      denominations: [{ id: rulesetGoldId, label: 'Gold', abbreviation: 'gp', scaleInReference: 1 }]
    })
    const partyBefore = await owner.query(api.campaigns.inventoryOwners.version, {
      input: { campaignId, owner: { kind: 'CAMPAIGN', campaignId } }
    })
    await owner.mutation(api.campaigns.partyInventoryCommands.mutate, {
      input: {
        kind: 'CURRENCY_ADJUST',
        campaignId,
        denominationId: rulesetGoldId,
        campaignCurrencySystemId: currencySystem.id,
        amount: 7,
        expectedOwnerVersion: partyBefore.version,
        idempotencyKey: crypto.randomUUID()
      } satisfies CampaignPartyInventoryMutationInput
    })
    await execute(first.client, originalId, {
      type: 'ADJUST_CURRENCY',
      kind: 'CAMPAIGN',
      currencyId: rulesetGoldId,
      campaignCurrencySystemId: currencySystem.id,
      amount: 5,
      containerId: pack.id
    })
    await execute(first.client, originalId, {
      type: 'ADJUST_CURRENCY',
      kind: 'CAMPAIGN',
      currencyId: rulesetGoldId,
      campaignCurrencySystemId: currencySystem.id,
      amount: 2
    })
    const adjustment = await owner.mutation(api.campaigns.gmWrites.saveAdjustment, {
      campaignId,
      characterId: originalId,
      visibility: 'SECRET',
      expectedVersion: 0,
      adjustment: {
        family: 'HIT_POINTS',
        field: 'MAXIMUM_MODIFIER',
        value: 4,
        sourceNote: 'Assignment GM HP'
      }
    })
    const campaignSheet = await owner.query(api.campaigns.characterSheet.get, {
      campaignId,
      characterId: originalId
    })
    assert.ok(campaignSheet)
    await execute(first.client, originalId, {
      type: 'SET_HIT_POINTS',
      current: campaignSheet.overview.maxHitPoints
    })
    const opened = await first.client.mutation(api.characters.drafts.create, {
      id: originalId,
      systemId: afterBackground.systemId
    })
    const privateDraft = await first.client.mutation(api.characters.drafts.save, {
      characterId: originalId,
      expectedDraftId: opened.id,
      mode: 'edit',
      baseActiveUpdatedAt: opened.baseActiveUpdatedAt,
      character: { ...opened.payload.character, label: 'Assignment private saved draft' },
      ...(opened.payload.builderIntent === undefined
        ? {}
        : { builderIntent: opened.payload.builderIntent })
    })
    await execute(first.client, originalId, {
      type: 'CREATE_NOTE_GROUP',
      label: 'Assignment private notes'
    })
    const afterGroup = await first.client.query(api.characters.sheet.get, { id: originalId })
    assert.ok(afterGroup)
    const groupId = afterGroup.notes.groups?.find(
      (group) => group.label === 'Assignment private notes'
    )?.id
    assert.ok(groupId)
    await execute(first.client, originalId, {
      type: 'CREATE_NOTE',
      groupId,
      title: 'Assignment private note',
      body: 'Visible only to the Character owner.'
    })

    const overflowDenominationId = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
    currencySystem = await owner.mutation(api.campaigns.currencySystems.save, {
      campaignId,
      systemId: currencySystem.id,
      expectedVersion: currencySystem.version,
      label: currencySystem.label,
      isReference: currencySystem.isReference,
      denominations: [
        ...currencySystem.denominations,
        {
          id: overflowDenominationId,
          label: 'Overflow Gold',
          abbreviation: 'og',
          scaleInReference: 2
        }
      ]
    })
    const sortedDenominations = [...currencySystem.denominations].map((entry) => entry.id).sort()
    assert.equal(
      sortedDenominations.indexOf(rulesetGoldId) <
        sortedDenominations.indexOf(overflowDenominationId),
      true
    )
    await execute(first.client, originalId, {
      type: 'ADJUST_CURRENCY',
      kind: 'CAMPAIGN',
      currencyId: overflowDenominationId,
      campaignCurrencySystemId: currencySystem.id,
      amount: 1
    })
    const overflowParty = await owner.query(api.campaigns.inventoryOwners.version, {
      input: { campaignId, owner: { kind: 'CAMPAIGN', campaignId } }
    })
    await owner.mutation(api.campaigns.partyInventoryCommands.mutate, {
      input: {
        kind: 'CURRENCY_ADJUST',
        campaignId,
        denominationId: overflowDenominationId,
        campaignCurrencySystemId: currencySystem.id,
        amount: Number.MAX_SAFE_INTEGER,
        expectedOwnerVersion: overflowParty.version,
        idempotencyKey: crypto.randomUUID()
      } satisfies CampaignPartyInventoryMutationInput
    })
    const beforeReplacement = await snapshot()
    await owner.mutation(api.campaigns.assignments.assign, {
      campaignId,
      characterId: replacementId
    })
    const replaced = await snapshot()
    const overflowPurseAmounts = replaced.currencies
      .filter(
        (row) =>
          row.campaignCurrencySystemId === currencySystem.id &&
          row.denominationId === overflowDenominationId
      )
      .map((row) => row.amount)
      .sort((left, right) => left - right)
    assert.deepEqual(overflowPurseAmounts, [1, Number.MAX_SAFE_INTEGER])
    const replacementVersion = proveDeparture(
      beforeReplacement,
      replaced,
      'DRAFT',
      'CHARACTER_REPLACED',
      currencySystem.id
    )
    assert.equal(
      replaced.campaign.memberships.find((entry) => entry.userId === firstUserId)?.assignedCharacter
        ?.id,
      replacementId
    )
    assert.equal(replaced.firstActive.status, 'DRAFT')
    assert.equal(replaced.firstSheet.ok, false)
    assert.equal(replaced.firstCampaignSheet.ok, false)
    assert.equal(replaced.replacementActive.status, 'ACTIVE')
    assert.equal(replaced.replacementSheet.ok, true)
    assert.equal(replaced.partyFence.version, beforeReplacement.partyFence.version + 1)
    assert.equal(
      replaced.firstActive.state.currency
        .flatMap((group) => group.currencies)
        .some((row) => row.kind === 'CAMPAIGN' && row.currencyId === rulesetGoldId),
      false
    )
    assert.equal(
      replaced.firstActive.state.currency
        .flatMap((group) => group.currencies)
        .some((row) => row.kind === 'RULESET' && row.currencyId === rulesetGoldId),
      true
    )
    assert.ok(
      replaced.firstActive.state.equipment.inventory.some(
        (item) => item.id === pack.id && item.retainedRulesJson
      )
    )
    assert.ok(
      replaced.firstActive.state.equipment.inventory.some(
        (item) => item.containerId === pack.id && item.equipmentId === club.id
      )
    )
    const repairedDraft = await first.client.query(api.characters.drafts.get, { id: originalId })
    assert.ok(repairedDraft)
    assert.equal(repairedDraft.id, privateDraft.id)
    assert.equal(repairedDraft.payload.character.intent.background.backgroundId, '')
    assert.equal(repairedDraft.payload.character.label, 'Assignment private saved draft')
    assert.equal(
      JSON.stringify(replaced.firstCampaignSheet).includes('Assignment private note'),
      false
    )
    assert.equal(JSON.stringify(replaced.history).includes('Assignment private note'), false)
    assert.equal(JSON.stringify(replaced.audit).includes('CHARACTER_REPLACED'), true)

    const noWriteReplacement = await snapshot()
    assert.deepEqual(
      await owner.mutation(api.campaigns.assignments.assign, {
        campaignId,
        characterId: replacementId
      }),
      { ok: true }
    )
    assert.deepEqual(
      await snapshot(),
      noWriteReplacement,
      'Exact replacement assignment must not write.'
    )
    await refuse(
      'player foreign explicit unassign',
      () =>
        first.client.mutation(api.campaigns.assignments.unassign, {
          campaignId,
          characterId: originalId
        }),
      /assigned.*not found/i
    )

    const repair = await first.client.mutation(api.characters.drafts.create, {
      id: originalId,
      systemId: repairedDraft.payload.character.systemId
    })
    const repaired = await first.client.mutation(api.characters.drafts.save, {
      characterId: originalId,
      expectedDraftId: repair.id,
      mode: 'edit',
      baseActiveUpdatedAt: repair.baseActiveUpdatedAt,
      character: { ...repair.payload.character, intent: originalIntent },
      ...(repair.payload.builderIntent === undefined
        ? {}
        : { builderIntent: repair.payload.builderIntent })
    })
    await first.client.mutation(api.characters.commit.commit, {
      expectedDraftId: repaired.id,
      mode: 'edit',
      character: repaired.payload.character
    })
    await first.client.mutation(api.campaigns.assignments.assign, {
      campaignId,
      characterId: originalId
    })
    const reassigned = await snapshot()
    assert.equal(
      reassigned.campaign.memberships.find((entry) => entry.userId === firstUserId)
        ?.assignedCharacter?.id,
      originalId
    )
    assert.equal(reassigned.replacementActive.status, 'ACTIVE')
    assert.equal(reassigned.replacementSheet.ok, true)
    const replacementSubjectHistory = await history(first.client, originalId)
    const replacementReceipt = proveReconciliation(
      replacementSubjectHistory,
      'CHARACTER_REPLACED',
      'DRAFT',
      replacementVersion
    )
    assert.deepEqual(reassigned.replacementActive, initial.replacementActive)
    assert.deepEqual(reassigned.replacementSheet, initial.replacementSheet)

    const partyForFinal = await owner.query(api.campaigns.inventoryOwners.version, {
      input: { campaignId, owner: { kind: 'CAMPAIGN', campaignId } }
    })
    await owner.mutation(api.campaigns.partyInventoryCommands.mutate, {
      input: {
        kind: 'CURRENCY_ADJUST',
        campaignId,
        denominationId: rulesetGoldId,
        campaignCurrencySystemId: currencySystem.id,
        amount: 4,
        expectedOwnerVersion: partyForFinal.version,
        idempotencyKey: crypto.randomUUID()
      } satisfies CampaignPartyInventoryMutationInput
    })
    await execute(first.client, originalId, {
      type: 'ADJUST_CURRENCY',
      kind: 'CAMPAIGN',
      currencyId: rulesetGoldId,
      campaignCurrencySystemId: currencySystem.id,
      amount: 4
    })
    await owner.mutation(api.campaigns.gmWrites.saveAdjustment, {
      campaignId,
      characterId: originalId,
      visibility: 'SECRET',
      expectedVersion: 0,
      adjustment: {
        family: 'HIT_POINTS',
        field: 'MAXIMUM_MODIFIER',
        value: 4,
        sourceNote: 'Assignment GM HP final'
      }
    })
    const finalGmSheet = await owner.query(api.campaigns.characterSheet.get, {
      campaignId,
      characterId: originalId
    })
    assert.ok(finalGmSheet)
    await execute(first.client, originalId, {
      type: 'SET_HIT_POINTS',
      current: finalGmSheet.overview.maxHitPoints
    })
    const finalOpened = await first.client.mutation(api.characters.drafts.create, {
      id: originalId,
      systemId: reassigned.firstActive.systemId
    })
    const finalDraft = await first.client.mutation(api.characters.drafts.save, {
      characterId: originalId,
      expectedDraftId: finalOpened.id,
      mode: 'edit',
      baseActiveUpdatedAt: finalOpened.baseActiveUpdatedAt,
      character: { ...finalOpened.payload.character, label: 'Assignment final private draft' },
      ...(finalOpened.payload.builderIntent === undefined
        ? {}
        : { builderIntent: finalOpened.payload.builderIntent })
    })
    const beforeUnassign = await snapshot()
    await owner.mutation(api.campaigns.assignments.unassign, {
      campaignId,
      characterId: originalId
    })
    const unassigned = await snapshot()
    const unassignmentVersion = proveDeparture(
      beforeUnassign,
      unassigned,
      'ACTIVE',
      'CHARACTER_UNASSIGNED',
      currencySystem.id
    )
    assert.equal(
      unassigned.campaign.memberships.find((entry) => entry.userId === firstUserId)
        ?.assignedCharacter,
      null
    )
    assert.equal(unassigned.firstCharacter.status, 'ACTIVE')
    assert.equal(unassigned.firstSheet.ok, true)
    assert.equal(unassigned.firstCampaignSheet.ok, false)
    assert.equal(unassigned.partyFence.version, beforeUnassign.partyFence.version + 1)
    assert.equal(
      unassigned.firstActive.state.currency
        .flatMap((group) => group.currencies)
        .some((row) => row.kind === 'CAMPAIGN'),
      false
    )
    assert.ok(
      unassigned.firstActive.state.equipment.inventory.some(
        (item) => item.id === pack.id && item.retainedRulesJson
      )
    )
    const finalKeptDraft = await first.client.query(api.characters.drafts.get, { id: originalId })
    assert.ok(finalKeptDraft)
    assert.equal(finalKeptDraft.id, finalDraft.id)
    assert.equal(finalKeptDraft.payload.character.label, 'Assignment final private draft')
    await assert.rejects(
      () =>
        owner.query(api.campaigns.events.list, { campaignId, characterId: originalId, limit: 8 }),
      /assigned|not found|authorized|permission/i
    )
    await assert.rejects(
      () =>
        second.client.query(api.campaigns.events.list, {
          campaignId,
          characterId: originalId,
          limit: 8
        }),
      /assigned|not found|authorized|permission/i
    )
    const noWriteUnassign = await snapshot()
    assert.deepEqual(
      await first.client.mutation(api.campaigns.assignments.unassign, { campaignId }),
      { ok: true }
    )
    assert.deepEqual(
      await snapshot(),
      noWriteUnassign,
      'Repeated player unassignment must not write.'
    )

    await first.client.mutation(api.campaigns.assignments.assign, {
      campaignId,
      characterId: originalId
    })
    const unassignmentSubjectHistory = await history(first.client, originalId)
    const unassignmentReceipt = proveReconciliation(
      unassignmentSubjectHistory,
      'CHARACTER_UNASSIGNED',
      'ACTIVE',
      unassignmentVersion
    )
    await unshare('BACKGROUND', sharedBackgroundId)
    await unshare('EQUIPMENT', sharedEquipment.subjectId)
    const retainedBefore = await snapshot()
    await refuse(
      'unshared Equipment add',
      () =>
        execute(first.client, originalId, {
          type: 'ADD_INVENTORY_ITEM',
          equipmentId: sharedEquipment.subjectId,
          quantity: 1
        }),
      /unavailable|source|not available/i
    )
    const retained = await first.client.query(api.characters.builder.activeCharacter, {
      id: originalId
    })
    assert.ok(
      retained?.state.equipment.inventory.some(
        (item) => item.id === pack.id && item.retainedRulesJson
      )
    )
    assert.deepEqual(
      await snapshot(),
      retainedBefore,
      'Retained source access loss must not grow inventory.'
    )
    return {
      initial,
      replaced,
      unassigned,
      retained,
      adjustmentId: adjustment.id,
      replacementReceipt,
      unassignmentReceipt,
      currencySystemId: currencySystem.id,
      sharedEquipmentId: sharedEquipment.subjectId,
      overflowPurseAmounts
    }
  } finally {
    await restoreOriginal(originalIntent)
    const shares = await collectPages((cursor) =>
      owner.query(api.campaigns.contentShares.list, {
        campaignId,
        paginationOpts: pagination(cursor)
      })
    )
    for (const share of shares) {
      if (
        (share.subjectKind === 'BACKGROUND' && share.subjectId === sharedBackgroundId) ||
        (share.subjectKind === 'EQUIPMENT' && share.subjectId === sharedEquipmentId)
      )
        await unshare(share.subjectKind, share.subjectId)
    }
  }
}
