import { makeFunctionReference } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput,
  DeleteCampaignInput,
  CampaignDeletionResult
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CurrencySystemDto,
  SaveCampaignCurrencySystemInput,
  CampaignPartyInventoryMutationInput
} from '@artificer-toolkit/schema/api/campaignInventory'
import type {
  CampaignVehicleLifecycleInput,
  CampaignVehicleLifecycleResult
} from '@artificer-toolkit/schema/api/campaignVehicles'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { backpack } from '@artificer-toolkit/source-data/srd/equipment/backpack.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api } from '../_generated/api'
import type { Id, TableNames } from '../_generated/dataModel'
import schema from '../schema'
import * as deletionState from './deletionState'
import { fixture } from '../../tests/fixtures/characters'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { populateCampaignLifecycleInventory } from '../../tests/developmentCampaignLifecycleInventory'
import {
  populateCampaignLifecycleCharacter,
  reconcileCampaignDeletionPersonalExpected
} from '../../tests/developmentCampaignLifecycleCharacter'
import { convexDevelopmentClient } from '../../tests/fixtures/convexDevelopmentClient'

const create = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const remove = makeFunctionReference<'mutation', DeleteCampaignInput, CampaignDeletionResult>(
  'campaigns/deletion:remove'
)
const runDeletionPage = makeFunctionReference<
  'action',
  { jobId: Id<'campaignDeletionJobs'>; revision: number },
  null
>('campaigns/deletionJobs:run')

const saveCurrency = makeFunctionReference<
  'mutation',
  SaveCampaignCurrencySystemInput,
  CurrencySystemDto
>('campaigns/currencySystems:save')
const lifecycle = makeFunctionReference<
  'mutation',
  { input: CampaignVehicleLifecycleInput },
  CampaignVehicleLifecycleResult
>('campaigns/vehicles:lifecycle')

const campaignInput: CreateCampaignInput = {
  name: 'Campaign deletion custody',
  format: 'ONGOING',
  toneTags: ['HEROIC'],
  contentMaturity: 'STANDARD',
  gameSystemId: srdSystemRecord.id,
  primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
}
const tableNames = Object.keys(schema.tables) as TableNames[]
const snapshot = (t: Awaited<ReturnType<typeof fixture>>['t']) =>
  t.run(async (ctx) => ({
    tables: Object.fromEntries(
      await Promise.all(
        tableNames.map(async (name) => [name, await ctx.db.query(name).collect()] as const)
      )
    ) as Record<string, unknown[]>,
    scheduled: await ctx.db.system.query('_scheduled_functions').collect()
  }))
async function deletionJob(t: Awaited<ReturnType<typeof fixture>>['t'], campaignId: string) {
  const job = await t.run((ctx) =>
    ctx.db
      .query('campaignDeletionJobs')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
      .unique()
  )
  if (!job) throw new Error('Missing Campaign deletion job.')
  return job
}
async function finishDeletion(t: Awaited<ReturnType<typeof fixture>>['t'], campaignId: string) {
  for (let page = 0; page < 1000; page++) {
    const job = await deletionJob(t, campaignId)
    if (job.status === 'DELETED') return job
    if (job.status === 'FAILED') throw new Error('Campaign deletion failed.')
    await t.action(runDeletionPage, { jobId: job._id, revision: job.revision })
  }
  throw new Error('Campaign deletion did not converge.')
}
const rowHas = (row: unknown, key: string): row is Record<string, unknown> =>
  typeof row === 'object' && row !== null && key in row
const rowString = (row: unknown, key: string) =>
  rowHas(row, key) && typeof row[key] === 'string' ? row[key] : undefined
const rowNumber = (row: unknown, key: string) =>
  rowHas(row, key) && typeof row[key] === 'number' ? row[key] : undefined
const currencyId = (suffix: string) => `10000000-0000-4000-8000-${suffix.padStart(12, '0')}`
const campaignDenomination = (id: string) => ({
  id,
  label: 'Campaign Denomination',
  abbreviation: 'cd',
  scaleInReference: 1
})
type NativeTables = Record<string, Record<string, unknown>[]>
function nativeTables(tables: Record<string, unknown[]>): NativeTables {
  return Object.fromEntries(
    Object.entries(tables).map(([name, rows]) => [
      name,
      rows.flatMap((row) => {
        if (typeof row !== 'object' || row === null || Array.isArray(row)) return []
        const record: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(row)) record[key] = value
        return [record]
      })
    ])
  )
}

async function mutateParty(
  base: Awaited<ReturnType<typeof readySheetFixture>>,
  caller: typeof base.other.caller,
  campaignId: string,
  command:
    | Omit<
        Extract<CampaignPartyInventoryMutationInput, { kind: 'ITEM_ADD' }>,
        'campaignId' | 'expectedOwnerVersion' | 'idempotencyKey'
      >
    | Omit<
        Extract<CampaignPartyInventoryMutationInput, { kind: 'CURRENCY_ADJUST' }>,
        'campaignId' | 'expectedOwnerVersion' | 'idempotencyKey'
      >,
  vehicleId?: string
) {
  const inventory = await base.t.run((ctx) =>
    ctx.db
      .query('campaignPartyInventories')
      .withIndex('by_campaignId_vehicleId', (q) =>
        vehicleId === undefined
          ? q.eq('campaignId', campaignId).eq('vehicleId', undefined)
          : q.eq('campaignId', campaignId).eq('vehicleId', vehicleId)
      )
      .unique()
  )
  return caller.mutation(api.campaigns.partyInventoryCommands.mutate, {
    input: {
      ...command,
      campaignId,
      vehicleId,
      expectedOwnerVersion: inventory?.version ?? 0,
      idempotencyKey: crypto.randomUUID()
    }
  })
}

async function addBagAndClub(
  base: Awaited<ReturnType<typeof readySheetFixture>>,
  caller: typeof base.other.caller,
  campaignId: string,
  vehicleId?: string
) {
  const bag = await mutateParty(
    base,
    caller,
    campaignId,
    { kind: 'ITEM_ADD', equipmentId: backpack.id, quantity: 1 },
    vehicleId
  )
  const event = await base.t.run((ctx) =>
    ctx.db
      .query('campaignEvents')
      .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaignId))
      .collect()
  )
  const bagEvent = event.find((row) => row.id === bag.eventId)
  if (!bagEvent) throw new Error('Missing backpack event.')
  const payload: unknown = JSON.parse(bagEvent.payloadJson)
  const bagId = rowString(payload, 'itemId')
  if (!bagId) throw new Error('Missing backpack item ID.')
  await mutateParty(
    base,
    caller,
    campaignId,
    { kind: 'ITEM_ADD', equipmentId: club.id, quantity: 1, containerId: bagId },
    vehicleId
  )
}

async function populate(
  base: Awaited<ReturnType<typeof readySheetFixture>>,
  campaign: CampaignDetailDto,
  caller: typeof base.other.caller,
  suffix: string
) {
  const denominationId = currencyId(suffix)
  const system = await caller.mutation(saveCurrency, {
    campaignId: campaign.id,
    label: 'Campaign custody currency',
    isReference: false,
    denominations: [campaignDenomination(denominationId)]
  })
  const vehicle = await caller.mutation(api.campaigns.vehicles.create, {
    campaignId: campaign.id,
    vehicleDefinitionId: cart.id,
    label: 'Custody cart'
  })
  await addBagAndClub(base, caller, campaign.id)
  await addBagAndClub(base, caller, campaign.id, vehicle.id)
  await mutateParty(base, caller, campaign.id, {
    kind: 'CURRENCY_ADJUST',
    denominationId: srdSystemRecord.currencies[0]!.id,
    amount: 4_294_967_297
  })
  await mutateParty(base, caller, campaign.id, {
    kind: 'CURRENCY_ADJUST',
    denominationId,
    campaignCurrencySystemId: system.id,
    amount: 4_294_967_299
  })
  await mutateParty(
    base,
    caller,
    campaign.id,
    {
      kind: 'CURRENCY_ADJUST',
      denominationId: srdSystemRecord.currencies[0]!.id,
      amount: 4_294_967_301
    },
    vehicle.id
  )
  await mutateParty(
    base,
    caller,
    campaign.id,
    {
      kind: 'CURRENCY_ADJUST',
      denominationId,
      campaignCurrencySystemId: system.id,
      amount: 4_294_967_303
    },
    vehicle.id
  )
  const unavailable = await caller.mutation(lifecycle, {
    input: {
      action: 'MAKE_UNAVAILABLE',
      campaignId: campaign.id,
      vehicleId: vehicle.id,
      expectedVersion: vehicle.version,
      idempotencyKey: crypto.randomUUID()
    }
  })
  return {
    system,
    vehicle: {
      ...vehicle,
      availability: 'UNAVAILABLE' as const,
      version: vehicle.version + 1
    },
    unavailable,
    denominationId
  }
}

function expectedAfter(
  before: Awaited<ReturnType<typeof snapshot>>,
  target: CampaignDetailDto,
  ownerUserId: string
) {
  const releaseCount = target.status === 'ACTIVE' ? 1 : 0
  expect(
    before.tables.accountUsageEntries?.filter(
      (row) =>
        rowString(row, 'resource') === 'activeHostedCampaigns' &&
        rowString(row, 'sourceId') === target.id
    ),
    'target hosted usage entries before deletion'
  ).toHaveLength(releaseCount)
  const tables = Object.fromEntries(
    Object.entries(before.tables).map(([name, rows]) => [
      name,
      rows.filter((row) => {
        if (name === 'campaigns') return rowString(row, 'id') !== target.id
        if (name === 'authoredRouteIds') return rowString(row, 'subjectId') !== target.id
        if (name === 'sceneVisionRevisions')
          return !(
            (rowString(row, 'scope') === 'CAMPAIGN' || rowString(row, 'scope') === 'PLAY') &&
            rowString(row, 'id') === target.id
          )
        if (name === 'accountUsageEntries')
          return !(
            rowString(row, 'resource') === 'activeHostedCampaigns' &&
            rowString(row, 'sourceId') === target.id
          )
        return rowString(row, 'campaignId') !== target.id
      })
    ])
  ) as Record<string, unknown[]>
  const profile = before.tables.userProfiles.find((row) => rowString(row, 'userId') === ownerUserId)
  if (
    !profile ||
    !rowHas(profile, 'entitlementUsage') ||
    typeof profile.entitlementUsage !== 'object' ||
    profile.entitlementUsage === null
  )
    throw new Error('Missing owner profile usage.')
  const entitlementUsage = profile.entitlementUsage
  const activeHostedCampaigns = rowNumber(entitlementUsage, 'activeHostedCampaigns')
  if (activeHostedCampaigns === undefined || activeHostedCampaigns < releaseCount)
    throw new Error('Missing active Campaign usage.')
  tables.userProfiles = before.tables.userProfiles.map((row) =>
    rowString(row, 'userId') === ownerUserId
      ? {
          ...profile,
          entitlementUsage: {
            ...entitlementUsage,
            activeHostedCampaigns: activeHostedCampaigns - releaseCount
          }
        }
      : row
  )
  return { tables, scheduled: before.scheduled }
}

function assertPopulated(snapshotValue: Awaited<ReturnType<typeof snapshot>>, campaignId: string) {
  for (const name of [
    'campaignVehicles',
    'campaignPartyInventories',
    'campaignPartyItems',
    'campaignPartyCurrencies',
    'campaignCurrencySystems',
    'campaignCurrencyDenominations',
    'campaignEvents'
  ])
    expect(
      snapshotValue.tables[name]?.some((row) => rowString(row, 'campaignId') === campaignId),
      name
    ).toBe(true)
  expect(
    snapshotValue.tables.campaignPartyCurrencies
      ?.filter((row) => rowString(row, 'campaignId') === campaignId)
      .every((row) => (rowNumber(row, 'amount') ?? 0) > 2 ** 32)
  ).toBe(true)
  expect(
    snapshotValue.tables.campaignVehicles?.find(
      (row) => rowString(row, 'campaignId') === campaignId
    )
  ).toMatchObject({ availability: 'UNAVAILABLE' })
}

describe('native Campaign custody deletion', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it.each(['ACTIVE', 'ARCHIVED'] as const)(
    'removes populated party and unavailable Vehicle custody from a %s Campaign while preserving personal and unrelated Campaign state',
    async (status) => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const base = await readySheetFixture()
      await importSeededSubjects(base.t, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        subjects: [
          importedSubject({
            subjectKind: 'EQUIPMENT',
            ...backpack,
            document: backpack
          }),
          importedSubject({ subjectKind: 'VEHICLE', ...cart, document: cart })
        ]
      })
      let target = await base.other.caller.mutation(create, campaignInput)
      const unrelated = await base.owner.caller.mutation(create, {
        ...campaignInput,
        name: 'Unrelated custody Campaign'
      })
      await populate(base, target, base.other.caller, '101')
      await populate(base, unrelated, base.owner.caller, '102')
      const current = await base.other.caller.query(api.campaigns.queries.get, {
        id: target.id
      })
      if (!current) throw new Error('Current Campaign detail is unavailable.')
      if (status === 'ARCHIVED')
        target = await base.other.caller.mutation(api.campaigns.archive.archive, {
          campaignId: target.id,
          expectedVersion: current.version
        })
      // Character writes queue the Sheet's derivation (ADR 0041); work due within the snapshot
      // build delay settles before the baseline, and the build stays pending.
      await vi.advanceTimersByTimeAsync(1_000)
      await base.t.finishInProgressScheduledFunctions()
      const before = await snapshot(base.t)
      assertPopulated(before, target.id)
      assertPopulated(before, unrelated.id)
      expect(before.tables.campaigns?.some((row) => rowString(row, 'id') === unrelated.id)).toBe(
        true
      )
      await expect(
        base.other.caller.mutation(remove, {
          campaignId: target.id,
          expectedVersion: target.version,
          confirmation: 'DELETE'
        })
      ).resolves.toEqual({ ok: true })
      expect(await deletionJob(base.t, target.id)).toMatchObject({
        status: 'DELETING',
        expectedVersion: target.version,
        ownerUserId: base.other.userId
      })
      expect((await snapshot(base.t)).tables.campaigns).toEqual(before.tables.campaigns)
      await expect(
        base.other.caller.query(api.campaigns.queries.get, { id: target.id })
      ).rejects.toThrow('Campaign not found.')
      expect(await finishDeletion(base.t, target.id)).toMatchObject({ status: 'DELETED' })
      const after = await snapshot(base.t)
      const expected = expectedAfter(before, target, base.other.userId)
      for (const name of tableNames.filter((name) => name !== 'campaignDeletionJobs'))
        expect(after.tables[name], name).toEqual(expected.tables[name])
      expect(
        after.scheduled.filter((row) => !row.name?.startsWith('campaigns/deletionJobs:'))
      ).toEqual(expected.scheduled)
      for (const name of [
        'campaignVehicles',
        'campaignPartyInventories',
        'campaignPartyItems',
        'campaignPartyCurrencyGroups',
        'campaignPartyCurrencies',
        'campaignCurrencySystems',
        'campaignCurrencyDenominations',
        'campaignEvents'
      ])
        expect(
          after.tables[name]?.filter((row) => rowString(row, 'campaignId') === target.id),
          name
        ).toEqual([])
      expect(after.tables.campaigns?.some((row) => rowString(row, 'id') === unrelated.id)).toBe(
        true
      )
      expect(
        after.tables.accountUsageEntries?.filter(
          (row) =>
            rowString(row, 'resource') === 'activeHostedCampaigns' &&
            rowString(row, 'sourceId') === target.id
        ),
        'target hosted usage entries after deletion'
      ).toHaveLength(0)
    },
    30_000
  )

  it.each(['ACTIVE', 'ARCHIVED'] as const)(
    'rolls back a failed cleanup page for populated %s Campaign custody and retries',
    async (status) => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const base = await readySheetFixture()
      await importSeededSubjects(base.t, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        subjects: [
          importedSubject({
            subjectKind: 'EQUIPMENT',
            ...backpack,
            document: backpack
          }),
          importedSubject({ subjectKind: 'VEHICLE', ...cart, document: cart })
        ]
      })
      let target = await base.other.caller.mutation(create, campaignInput)
      await populate(base, target, base.other.caller, '103')
      const current = await base.other.caller.query(api.campaigns.queries.get, {
        id: target.id
      })
      if (!current) throw new Error('Current Campaign detail is unavailable.')
      if (status === 'ARCHIVED')
        target = await base.other.caller.mutation(api.campaigns.archive.archive, {
          campaignId: target.id,
          expectedVersion: current.version
        })
      // Character writes queue the Sheet's derivation (ADR 0041); work due within the snapshot
      // build delay settles before the baseline, and the build stays pending.
      await vi.advanceTimersByTimeAsync(1_000)
      await base.t.finishInProgressScheduledFunctions()
      const before = await snapshot(base.t)
      assertPopulated(before, target.id)
      const command = {
        campaignId: target.id,
        expectedVersion: target.version,
        confirmation: 'DELETE' as const
      }
      await expect(base.other.caller.mutation(remove, command)).resolves.toEqual({ ok: true })
      expect(await deletionJob(base.t, target.id)).toMatchObject({ status: 'DELETING' })
      expect((await snapshot(base.t)).tables.campaigns).toEqual(before.tables.campaigns)
      await expect(
        base.other.caller.query(api.campaigns.queries.get, { id: target.id })
      ).rejects.toThrow('Campaign not found.')
      while ((await deletionJob(base.t, target.id)).stage !== 'PURGE') {
        const job = await deletionJob(base.t, target.id)
        await base.t.action(runDeletionPage, { jobId: job._id, revision: job.revision })
      }
      const beforePage = await snapshot(base.t)
      const job = await deletionJob(base.t, target.id)
      const eventsBeforePage = beforePage.tables.campaignEvents.filter(
        (row) => rowString(row, 'campaignId') === target.id
      ).length
      expect(eventsBeforePage).toBeGreaterThan(0)
      // One step pages through several phases; failing at the event phase rolls back all of them.
      const original = deletionState.removeCampaignState
      const fault = vi
        .spyOn(deletionState, 'removeCampaignState')
        .mockImplementation(async (ctx, captured) => {
          const progress = await original(ctx, captured)
          if (captured.phase !== 20) return progress
          const eventsAfterWrite = await ctx.db
            .query('campaignEvents')
            .withIndex('by_campaignId_id', (q) => q.eq('campaignId', target.id))
            .collect()
          expect(eventsAfterWrite.length).toBeLessThan(eventsBeforePage)
          throw new Error('Injected Campaign custody cleanup page failure')
        })
      try {
        await expect(
          base.t.action(runDeletionPage, { jobId: job._id, revision: job.revision })
        ).rejects.toThrow('Injected Campaign custody cleanup page failure')
      } finally {
        fault.mockRestore()
      }
      const afterFailure = await snapshot(base.t)
      for (const name of tableNames.filter((name) => name !== 'campaignDeletionJobs'))
        expect(afterFailure.tables[name], name).toEqual(beforePage.tables[name])
      expect(await deletionJob(base.t, target.id)).toMatchObject({
        status: 'FAILED',
        phase: job.phase,
        revision: job.revision
      })
      await expect(
        base.other.caller.query(api.campaigns.queries.get, { id: target.id })
      ).rejects.toThrow('Campaign not found.')
      await expect(base.other.caller.mutation(remove, command)).resolves.toEqual({ ok: true })
      expect(await finishDeletion(base.t, target.id)).toMatchObject({ status: 'DELETED' })
      const after = await snapshot(base.t)
      const expected = expectedAfter(before, target, base.other.userId)
      for (const name of tableNames.filter((name) => name !== 'campaignDeletionJobs'))
        expect(after.tables[name], name).toEqual(expected.tables[name])
    },
    30_000
  )
  // The Campaign's snapshot build runs 2 s after the content that marks it. A fake clock decides
  // whether that is before the deletion or after it, instead of the test's real running time.
  it.each([
    { status: 'ACTIVE', buildTiming: 'AFTER_DELETION', suffix: '' },
    { status: 'ARCHIVED', buildTiming: 'AFTER_DELETION', suffix: '' },
    { status: 'ACTIVE', buildTiming: 'BEFORE_DELETION', suffix: ' after its snapshot was built' }
  ] as const)(
    'runs the real public custody producers before deleting a $status Campaign$suffix',
    async ({ status, buildTiming }) => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const base = await readySheetFixture()
      await importSeededSubjects(base.t, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        subjects: [
          importedSubject({
            subjectKind: 'EQUIPMENT',
            ...backpack,
            document: backpack
          }),
          importedSubject({ subjectKind: 'VEHICLE', ...cart, document: cart })
        ]
      })
      let target = await base.other.caller.mutation(create, campaignInput)
      await base.t.run((ctx) =>
        ctx.db.insert('campaignMemberships', {
          campaignId: target.id,
          userId: base.owner.userId,
          role: 'PLAYER',
          status: 'ACTIVE',
          accessStartedAt: target.createdAt,
          joinedAt: target.createdAt,
          leftAt: null
        })
      )
      const client = convexDevelopmentClient
      const produced = await populateCampaignLifecycleInventory(
        client(base.other.caller),
        target.id
      )
      const character = await populateCampaignLifecycleCharacter({
        owner: client(base.other.caller),
        player: client(base.owner.caller),
        campaignId: target.id,
        characterId: base.character.id,
        currencySystem: produced.currencySystem,
        vehicleIds: [produced.vehicles[0]!.id, produced.vehicles[1]!.id]
      })
      expect(character.stableGroups).toHaveLength(3)
      expect(character.stableGroups.map((group) => group.vehicleId)).toEqual([
        undefined,
        produced.vehicles[0]!.id,
        produced.vehicles[1]!.id
      ])
      expect(
        character.stableGroups.every(
          (group) => group.denominationId === produced.denominationIds.unused
        )
      ).toBe(true)
      expect(character.stableGroups.every((group) => group.groupIds.length === 1)).toBe(true)
      const current = await base.other.caller.query(api.campaigns.queries.get, {
        id: target.id
      })
      if (!current) throw new Error('Current Campaign detail is unavailable.')
      if (status === 'ARCHIVED')
        target = await base.other.caller.mutation(api.campaigns.archive.archive, {
          campaignId: target.id,
          expectedVersion: current.version
        })
      if (buildTiming === 'BEFORE_DELETION')
        await base.t.finishAllScheduledFunctions(vi.runAllTimers)
      else {
        // Work due within the build delay settles; the Campaign's snapshot build stays pending.
        await vi.advanceTimersByTimeAsync(1_000)
        await base.t.finishInProgressScheduledFunctions()
      }
      const before = await snapshot(base.t)
      const campaignObjects = <Row>(rows: readonly Row[] | undefined) =>
        rows?.filter((row) => rowString(row, 'scope') !== 'SOURCE')
      expect(
        campaignObjects(before.tables.contentSnapshotObjects)?.length,
        'snapshot objects before deletion'
      ).toBe(buildTiming === 'BEFORE_DELETION' ? 3 : 0)
      const highBalances = before.tables.campaignPartyCurrencies.filter(
        (row) =>
          rowString(row, 'campaignId') === target.id && rowString(row, 'groupId') === undefined
      )
      expect(highBalances).toHaveLength(12)
      expect(highBalances.every((row) => rowNumber(row, 'amount') === 4_294_967_297)).toBe(true)
      const groups = before.tables.campaignPartyCurrencyGroups.filter(
        (row) => rowString(row, 'campaignId') === target.id
      )
      expect(groups).toHaveLength(3)
      const zeroBalances = before.tables.campaignPartyCurrencies.filter(
        (row) =>
          rowString(row, 'campaignId') === target.id && rowString(row, 'groupId') !== undefined
      )
      expect(zeroBalances).toHaveLength(3)
      for (const expectedGroup of character.stableGroups) {
        const group = groups.filter((row) => rowString(row, 'id') === expectedGroup.groupIds[0])
        expect(group).toHaveLength(1)
        expect(rowString(group[0], 'vehicleId')).toBe(expectedGroup.vehicleId)
        expect(rowString(group[0], 'containerId')).toBe(expectedGroup.bagId)
        const balances = zeroBalances.filter(
          (row) => rowString(row, 'groupId') === expectedGroup.groupIds[0]
        )
        expect(balances).toHaveLength(1)
        expect(rowNumber(balances[0], 'amount')).toBe(0)
        expect(rowString(balances[0], 'vehicleId')).toBe(expectedGroup.vehicleId)
        expect(rowString(balances[0], 'containerId')).toBe(expectedGroup.bagId)
        expect(rowString(balances[0], 'campaignCurrencySystemId')).toBe(produced.currencySystem.id)
        expect(rowString(balances[0], 'denominationId')).toBe(produced.denominationIds.unused)
      }
      const expectedSnapshot = expectedAfter(before, target, base.other.userId)
      const nativeTimeMs = Date.now()
      const clock = vi.spyOn(Date, 'now').mockReturnValue(nativeTimeMs)
      let after: Awaited<ReturnType<typeof snapshot>>
      try {
        await expect(
          base.other.caller.mutation(remove, {
            campaignId: target.id,
            expectedVersion: target.version,
            confirmation: 'DELETE'
          })
        ).resolves.toEqual({ ok: true })
        const immediate = await snapshot(base.t)
        expect(immediate.tables.campaigns).toEqual(before.tables.campaigns)
        expect(await deletionJob(base.t, target.id)).toMatchObject({ status: 'DELETING' })
        await expect(
          base.other.caller.query(api.campaigns.queries.get, { id: target.id })
        ).rejects.toThrow('Campaign not found.')
        expect(await finishDeletion(base.t, target.id)).toMatchObject({ status: 'DELETED' })
        await base.t.finishAllScheduledFunctions(vi.runAllTimers)
        after = await snapshot(base.t)
      } finally {
        clock.mockRestore()
      }
      const expected = nativeTables(expectedSnapshot.tables)
      reconcileCampaignDeletionPersonalExpected({
        expected,
        actual: nativeTables(after.tables),
        campaign: nativeTables(before.tables),
        characterId: base.character.id,
        backgroundId: character.backgroundId,
        fenceTimeMs: nativeTimeMs
      })
      // Removed shares mark the Campaign's content snapshot; builds have their own tests. The
      // owner's Source builds against the local R2 fixture and uploads objects, so only objects of
      // other scopes are compared.
      // A build that ran before the deletion leaves its objects behind, superseded at the deletion.
      const supersededAt = Date.parse(
        rowString(after.tables.campaignDeletionJobs?.[0], 'updatedAt')
      )
      const expectedRows = (name: string) =>
        name === 'contentSnapshotObjects'
          ? campaignObjects(expected[name])?.map((row) =>
              buildTiming === 'BEFORE_DELETION' ? { ...row, supersededAt } : row
            )
          : expected[name]
      const actualRows = (name: string) =>
        name === 'contentSnapshotObjects' ? campaignObjects(after.tables[name]) : after.tables[name]
      for (const name of tableNames.filter(
        (name) => name !== 'campaignDeletionJobs' && name !== 'contentSnapshotHeads'
      ))
        expect(actualRows(name), name).toEqual(expectedRows(name))
      expect(
        after.tables.contentSnapshotHeads?.filter(
          (row) => rowString(row, 'scope') === 'CAMPAIGN' && rowString(row, 'scopeId') === target.id
        ),
        'Campaign snapshot head after deletion'
      ).toHaveLength(0)
      // Archive always schedules the room close; its run state is the only scheduler change.
      const roomControl = 'liveSessions/control:send'
      const snapshotBuild = 'contentSnapshots/actions:build'
      expect(
        after.scheduled.filter(
          (row) =>
            !row.name?.startsWith('campaigns/deletionJobs:') &&
            row.name !== roomControl &&
            row.name !== snapshotBuild
        )
      ).toEqual(
        expectedSnapshot.scheduled.filter(
          (row) => row.name !== roomControl && row.name !== snapshotBuild
        )
      )
      expect(
        after.scheduled.filter((row) => row.name === roomControl).map((row) => row.args)
      ).toEqual(
        status === 'ARCHIVED'
          ? [[{ campaignId: target.id, operation: { type: 'CLOSE_ROOM' } }]]
          : []
      )
      expect(
        after.tables.accountUsageEntries?.filter(
          (row) =>
            rowString(row, 'resource') === 'activeHostedCampaigns' &&
            rowString(row, 'sourceId') === target.id
        ),
        'target hosted usage entries after deletion'
      ).toHaveLength(0)
    },
    30_000
  )
})
