import { makeFunctionReference } from 'convex/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CampaignPartyInventoryMutationInput } from '@artificer-toolkit/schema/api/campaignInventory'
import type {
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import type {
  VehicleCleanupGrant,
  VehicleCleanupJob
} from '@artificer-toolkit/schema/projections/campaignVehicleCleanupPersistence'
import {
  campaignStoredVehicleCleanupSchema,
  campaignStoredVehicleCleanupSegmentSchema
} from '@artificer-toolkit/schema/projections/campaignVehicleCleanupPersistence'
import { campaignStoredEventSchema } from '@artificer-toolkit/schema/projections/campaignEventPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { acquiredEquipmentRulesSchema } from '@artificer-toolkit/schema/projections/acquiredEquipmentRules'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { backpack } from '@artificer-toolkit/source-data/srd/equipment/backpack.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api, components } from '../_generated/api'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { beginVehicleCleanup, probeVehicleCleanup } from './vehicleCleanup'
import { retainCampaignEquipmentRules } from './acquiredEquipment'
import {
  readVehicleCleanupLock,
  readVehicleCleanupProgress,
  vehicleCleanupRowAvailable,
  requireVehicleCleanupRowEditable
} from './vehicleCleanupDocuments'

const run = makeFunctionReference<'mutation', { jobId: string }, null>(
  'campaigns/vehicleCleanup:run'
)
const step = makeFunctionReference<'mutation', { jobId: string }, null>(
  'campaigns/vehicleCleanup:step'
)
const retry = makeFunctionReference<'mutation', { jobId: string }, null>(
  'campaigns/vehicleCleanup:retry'
)
const sheetExecute = makeFunctionReference<
  'mutation',
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
>('characters/sheetCommands:execute')
type Command = CampaignPartyInventoryMutationInput extends infer Input
  ? Input extends { kind: string }
    ? Omit<Input, 'campaignId' | 'vehicleId' | 'expectedOwnerVersion' | 'idempotencyKey'>
    : never
  : never

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

async function setup(cargoItems = 36) {
  const base = await readySheetFixture()
  await importSeededSubjects(base.t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({ subjectKind: 'VEHICLE', ...cart, document: cart }),
      importedSubject({ subjectKind: 'EQUIPMENT', ...backpack, document: backpack })
    ]
  })
  const campaign = await base.other.caller.mutation(api.campaigns.create.create, {
    name: 'Bounded Vehicle cleanup',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  await base.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.owner.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
  )
  const vehicle = await base.other.caller.mutation(api.campaigns.vehicles.create, {
    campaignId: campaign.id,
    vehicleDefinitionId: cart.id
  })
  const ownerVersion = async (vehicleId?: string) =>
    base.t.run(
      async (ctx) =>
        (
          await ctx.db
            .query('campaignPartyInventories')
            .withIndex('by_campaignId_vehicleId', (q) =>
              q.eq('campaignId', campaign.id).eq('vehicleId', vehicleId)
            )
            .unique()
        )?.version ?? 0
    )
  const execute = async (command: Command, vehicleId?: string) =>
    base.other.caller.mutation(api.campaigns.partyInventoryCommands.mutate, {
      input: {
        ...command,
        campaignId: campaign.id,
        expectedOwnerVersion: await ownerVersion(vehicleId),
        idempotencyKey: crypto.randomUUID(),
        ...(vehicleId === undefined ? {} : { vehicleId })
      }
    })
  const read = () =>
    base.t.run(async (ctx) => ({
      items: await ctx.db
        .query('campaignPartyItems')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .take(128),
      groups: await ctx.db
        .query('campaignPartyCurrencyGroups')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .take(128),
      balances: await ctx.db
        .query('campaignPartyCurrencies')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .take(128)
    }))
  // Real Sheet creation/coin placement and Character -> Vehicle transfer create an explicit carried group.
  const beforeBag = await base.readState()
  const added = await base.owner.caller.mutation(sheetExecute, {
    id: base.character.id,
    command: {
      type: 'ADD_INVENTORY_ITEM',
      commandId: crypto.randomUUID(),
      expectedVersion: beforeBag.character!.play.streamVersion,
      equipmentId: backpack.id,
      quantity: 1
    }
  })
  expect(added).not.toHaveProperty('sheet')
  const addedSheet = (await base.owner.caller.query(api.characters.sheet.get, {
    id: added.characterId
  }))!
  const bag = addedSheet.inventory.containers![0]!
  const denominationId = srdSystemRecord.currencies[0]!.id
  const beforeCredit = await base.readState()
  await base.owner.caller.mutation(sheetExecute, {
    id: base.character.id,
    command: {
      type: 'ADJUST_CURRENCY',
      commandId: crypto.randomUUID(),
      expectedVersion: beforeCredit.character!.play.streamVersion,
      currencyId: denominationId,
      kind: 'RULESET',
      amount: 7,
      containerId: bag.id
    }
  })
  await base.owner.caller.mutation(api.campaigns.assignments.assign, {
    campaignId: campaign.id,
    characterId: base.character.id
  })
  const beforeTransfer = await base.readState()
  await base.owner.caller.mutation(api.campaigns.inventoryTransfers.transfer, {
    input: {
      kind: 'ITEM',
      campaignId: campaign.id,
      source: { kind: 'CHARACTER', characterId: base.character.id },
      destination: { kind: 'VEHICLE', vehicleId: vehicle.id },
      itemId: bag.id,
      amount: 1,
      expectedSourceVersion: beforeTransfer.character!.play.streamVersion,
      expectedDestinationVersion: 0,
      idempotencyKey: crypto.randomUUID()
    }
  })
  for (let index = 0; index < cargoItems; index++)
    await execute(
      {
        kind: 'ITEM_ADD',
        equipmentId: club.id,
        quantity: index + 1,
        containerId: bag.id
      },
      vehicle.id
    )
  await execute(
    {
      kind: 'CURRENCY_ADJUST',
      denominationId,
      campaignCurrencySystemId: null,
      amount: 10,
      containerId: null
    },
    vehicle.id
  )
  const begin = async (
    mode: 'RETURN' | 'DESTROY' = 'RETURN',
    override: Partial<VehicleCleanupGrant> = {}
  ) =>
    base.t.run(async (ctx) => {
      const currentCampaign = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
        .unique()
      const currentVehicle = await ctx.db
        .query('campaignVehicles')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id).eq('id', vehicle.id))
        .unique()
      const grant: VehicleCleanupGrant = {
        campaignId: campaign.id,
        campaignVersion: currentCampaign!.version,
        vehicleId: vehicle.id,
        vehicleVersion: currentVehicle!.version,
        sourceInventoryVersion: (await ctx.db
          .query('campaignPartyInventories')
          .withIndex('by_campaignId_vehicleId', (q) =>
            q.eq('campaignId', campaign.id).eq('vehicleId', vehicle.id)
          )
          .unique())!.version,
        actorUserId: base.other.userId,
        eventId: crypto.randomUUID(),
        commandId: crypto.randomUUID(),
        inputFingerprint: checksumCanonicalJson({ cleanup: 'test', vehicleId: vehicle.id }),
        mode,
        beforeAvailability: currentVehicle!.availability ?? 'AVAILABLE',
        label: currentVehicle!.label,
        vehicleDefinitionId: currentVehicle!.vehicleDefinitionId,
        ...override
      }
      return { grant, acknowledgement: await beginVehicleCleanup(ctx, grant) }
    })
  return {
    base,
    campaign,
    vehicle,
    read,
    execute,
    ownerVersion,
    begin,
    denominationId,
    bagId: bag.id
  }
}
type Fixture = Awaited<ReturnType<typeof setup>>
async function jobOf(f: Fixture, jobId: string): Promise<VehicleCleanupJob> {
  return f.base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('campaignVehicleCleanupJobs')
      .withIndex('by_publicId', (q) => q.eq('id', jobId))
      .unique()
    if (!row) throw new Error('Missing job fixture.')
    const { _id, _creationTime, ...stored } = row
    return campaignStoredVehicleCleanupSchema.parse(stored)
  })
}
async function advance(f: Fixture, jobId: string, until: (job: VehicleCleanupJob) => boolean) {
  for (let ticks = 0; ticks < 500; ticks++) {
    const job = await jobOf(f, jobId)
    if (until(job)) return job
    await f.base.t.mutation(run, { jobId })
  }
  throw new Error('Cleanup did not converge within bounded test ticks.')
}
function cargoShape(row: {
  _id: unknown
  _creationTime: number
  vehicleId?: string
  cleanupJobId?: string
}) {
  const { _id, _creationTime, vehicleId: _vehicleId, cleanupJobId: _cleanupJobId, ...stored } = row
  return stored
}

async function addQualifiedSlots(f: Fixture, lateAmount = Number.MAX_SAFE_INTEGER) {
  const systems = []
  for (let index = 0; index < 2; index++)
    systems.push(
      await f.base.other.caller.mutation(api.campaigns.currencySystems.save, {
        campaignId: f.campaign.id,
        label: `System ${index}`,
        isReference: false,
        denominations: Array.from({ length: 5 }, (_, slot) => ({
          id: `${index + 2}0000000-0000-4000-8000-${String(slot + 10).padStart(12, '0')}`,
          label: `Coin ${slot}`,
          abbreviation: `c${slot}`,
          scaleInReference: slot + 1
        }))
      })
    )
  systems.sort((left, right) => left.id.localeCompare(right.id))
  for (const system of systems)
    for (const denomination of system.denominations)
      await f.execute(
        {
          kind: 'CURRENCY_ADJUST',
          denominationId: denomination.id,
          campaignCurrencySystemId: system.id,
          amount: 1
        },
        f.vehicle.id
      )
  const existing = systems[0]!,
    early = existing.denominations[0]!
  await f.execute({
    kind: 'CURRENCY_ADJUST',
    denominationId: early.id,
    campaignCurrencySystemId: existing.id,
    amount: 7
  })
  const lateSystem = systems[1]!,
    late = lateSystem.denominations.at(-1)!
  await f.execute({
    kind: 'CURRENCY_ADJUST',
    denominationId: late.id,
    campaignCurrencySystemId: lateSystem.id,
    amount: lateAmount
  })
  return { lateSystem, late }
}

describe('bounded native Vehicle cleanup core (promotion candidate)', () => {
  it('dispatches ordinary cargo atomically and oversized cargo to the durable path', async () => {
    const ordinary = await setup(1)
    expect(
      await ordinary.base.t.run((ctx) =>
        probeVehicleCleanup(ctx, ordinary.campaign.id, ordinary.vehicle.id)
      )
    ).toEqual({ ordinary: true })
    const oversized = await setup()
    expect(
      await oversized.base.t.run((ctx) =>
        probeVehicleCleanup(ctx, oversized.campaign.id, oversized.vehicle.id)
      )
    ).toEqual({ ordinary: false })
  })

  it('dispatches a small RETURN around the exact pending loose slot while DESTROY and unrelated namespaces remain ordinary', async () => {
    const f = await setup()
    await f.execute({
      kind: 'CURRENCY_ADJUST',
      denominationId: f.denominationId,
      campaignCurrencySystemId: null,
      amount: 7
    })
    const custom = await f.base.other.caller.mutation(api.campaigns.currencySystems.save, {
      campaignId: f.campaign.id,
      label: 'Same denomination UUID',
      isReference: false,
      denominations: [
        {
          id: f.denominationId,
          label: 'Custom coin',
          abbreviation: 'c',
          scaleInReference: 1
        }
      ]
    })
    await f.execute({
      kind: 'CURRENCY_ADJUST',
      denominationId: f.denominationId,
      campaignCurrencySystemId: custom.id,
      amount: 4
    })
    const small = await f.base.other.caller.mutation(api.campaigns.vehicles.create, {
      campaignId: f.campaign.id,
      vehicleDefinitionId: cart.id
    })
    await f.execute({ kind: 'ITEM_ADD', equipmentId: backpack.id, quantity: 1 }, small.id)
    const bag = (await f.read()).items.find((item) => item.vehicleId === small.id)!
    await f.execute(
      {
        kind: 'CURRENCY_ADJUST',
        denominationId: f.denominationId,
        campaignCurrencySystemId: null,
        amount: 5,
        containerId: bag.id
      },
      small.id
    )
    await f.execute(
      {
        kind: 'CURRENCY_ADJUST',
        denominationId: f.denominationId,
        campaignCurrencySystemId: custom.id,
        amount: 2
      },
      small.id
    )
    const ordinary = await f.read()
    expect(await f.base.t.run((ctx) => probeVehicleCleanup(ctx, f.campaign.id, small.id))).toEqual({
      ordinary: true
    })
    expect(await f.read()).toEqual(ordinary)
    const {
      acknowledgement: { jobId }
    } = await f.begin()
    await advance(f, jobId, (job) => job.phase === 'APPLY_ITEMS')
    const unrelated = await f.read()
    // Contained native money and a custom namespace with the same UUID do not merge into the held native slot.
    expect(await f.base.t.run((ctx) => probeVehicleCleanup(ctx, f.campaign.id, small.id))).toEqual({
      ordinary: true
    })
    expect(await f.read()).toEqual(unrelated)
    await f.execute(
      {
        kind: 'CURRENCY_ADJUST',
        denominationId: f.denominationId,
        campaignCurrencySystemId: null,
        amount: 9
      },
      small.id
    )
    const pending = await f.read()
    expect(await f.base.t.run((ctx) => probeVehicleCleanup(ctx, f.campaign.id, small.id))).toEqual({
      ordinary: false
    })
    expect(
      await f.base.t.run((ctx) => probeVehicleCleanup(ctx, f.campaign.id, small.id, 'RETURN'))
    ).toEqual({ ordinary: false })
    expect(
      await f.base.t.run((ctx) => probeVehicleCleanup(ctx, f.campaign.id, small.id, 'DESTROY'))
    ).toEqual({ ordinary: true })
    expect(await f.read()).toEqual(pending)
    expect(
      pending.balances.find(
        (balance) =>
          balance.vehicleId === undefined && balance.campaignCurrencySystemId === custom.id
      )?.amount
    ).toBe(4)
    await advance(f, jobId, (job) => job.status === 'COMPLETED')
    const completed = await f.read()
    expect(await f.base.t.run((ctx) => probeVehicleCleanup(ctx, f.campaign.id, small.id))).toEqual({
      ordinary: true
    })
    expect(await f.read()).toEqual(completed)
  })

  it.each(['unknown', 'malformed marker', 'malformed holder'] as const)(
    'fails closed without writes for a small RETURN with %s target cleanup metadata',
    async (corruption) => {
      const f = await setup(1)
      await f.execute({
        kind: 'CURRENCY_ADJUST',
        denominationId: f.denominationId,
        campaignCurrencySystemId: null,
        amount: 7
      })
      if (corruption === 'malformed holder') {
        const {
          acknowledgement: { jobId }
        } = await f.begin()
        await advance(f, jobId, (job) => job.phase === 'APPLY_ITEMS')
        await f.base.t.run(async (ctx) => {
          const holder = await ctx.db
            .query('campaignVehicleCleanupJobs')
            .withIndex('by_publicId', (q) => q.eq('id', jobId))
            .unique()
          await ctx.db.patch(holder!._id, { grantChecksum: '0'.repeat(64) })
        })
      } else {
        const target = (await f.read()).balances.find(
          (balance) =>
            balance.vehicleId === undefined &&
            balance.groupId === undefined &&
            balance.containerId === null
        )!
        await f.base.t.run((ctx) =>
          ctx.db.patch(target._id, {
            cleanupJobId: corruption === 'unknown' ? crypto.randomUUID() : 'not-a-uuid'
          })
        )
      }
      const before = await f.read()
      await expect(
        f.base.t.run((ctx) => probeVehicleCleanup(ctx, f.campaign.id, f.vehicle.id))
      ).rejects.toMatchObject({ data: { vehicleCleanupValidation: true } })
      expect(
        await f.base.t.run((ctx) =>
          probeVehicleCleanup(ctx, f.campaign.id, f.vehicle.id, 'DESTROY')
        )
      ).toEqual({ ordinary: true })
      expect(await f.read()).toEqual(before)
    }
  )

  it('returns the exact acquired forest, groups, placement and money, retaining concurrent unrelated writes and exact replay', async () => {
    const f = await setup()
    await f.execute({
      kind: 'CURRENCY_ADJUST',
      denominationId: f.denominationId,
      campaignCurrencySystemId: null,
      amount: Number.MAX_SAFE_INTEGER - 20
    })
    const before = await f.read()
    const begun = await f.begin()
    const jobId = begun.acknowledgement.jobId
    expect(await f.base.t.run((ctx) => beginVehicleCleanup(ctx, begun.grant))).toEqual(
      begun.acknowledgement
    )
    await advance(f, jobId, (job) => job.phase === 'APPLY_ITEMS')
    await f.base.t.mutation(step, { jobId })
    const partial = await f.read()
    expect(partial.items.some((row) => row.cleanupJobId === jobId)).toBe(true)
    for (const row of partial.items.filter((item) => item.cleanupJobId === jobId)) {
      expect(await f.base.t.run((ctx) => vehicleCleanupRowAvailable(ctx, row))).toBe(false)
      await expect(
        f.base.t.run((ctx) => requireVehicleCleanupRowEditable(ctx, row))
      ).rejects.toThrow()
    }
    await f.execute({ kind: 'ITEM_ADD', equipmentId: club.id, quantity: 9 })
    const versionBeforeFinal = await f.ownerVersion()
    const completed = await advance(f, jobId, (job) => job.status === 'COMPLETED')
    expect(completed.destinationInventoryVersion).toBe(versionBeforeFinal + 1)
    const after = await f.read()
    expect(
      after.items
        .filter((row) => row.cleanupJobId === jobId)
        .map(cargoShape)
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    ).toEqual(
      before.items
        .map(cargoShape)
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    )
    expect(after.groups.map(cargoShape)).toEqual(before.groups.map(cargoShape))
    const carried = before.balances.filter((balance) => balance.groupId !== undefined)
    expect(
      after.balances.filter((balance) => balance.groupId !== undefined).map(cargoShape)
    ).toEqual(carried.map(cargoShape))
    expect(
      after.balances.find(
        (balance) => balance.groupId === undefined && balance.containerId === null
      )?.amount
    ).toBe(Number.MAX_SAFE_INTEGER - 10)
    for (const row of after.items)
      expect(await f.base.t.run((ctx) => vehicleCleanupRowAvailable(ctx, row))).toBe(true)
    const exact = await f.read()
    await f.base.t.mutation(step, { jobId })
    await f.base.t.mutation(run, { jobId })
    await f.base.t.mutation(retry, { jobId })
    expect(await f.read()).toEqual(exact)
    expect(await f.base.t.run((ctx) => beginVehicleCleanup(ctx, begun.grant))).toMatchObject({
      jobId,
      status: 'COMPLETED'
    })
    await expect(
      f.base.t.run((ctx) => beginVehicleCleanup(ctx, { ...begun.grant, mode: 'DESTROY' }))
    ).rejects.toThrow()
  })

  it('destroys all cargo without changing unrelated party custody or destination version', async () => {
    const f = await setup()
    await f.execute({ kind: 'ITEM_ADD', equipmentId: club.id, quantity: 5 })
    const before = (await f.read()).items.filter((item) => item.vehicleId === undefined)
    const version = await f.ownerVersion()
    const {
      acknowledgement: { jobId }
    } = await f.begin('DESTROY')
    const done = await advance(f, jobId, (job) => job.status === 'COMPLETED')
    expect(done.destinationInventoryVersion).toBeNull()
    expect(await f.ownerVersion()).toBe(version)
    expect((await f.read()).items).toEqual(before)
    expect((await f.read()).groups).toEqual([])
    expect((await f.read()).balances).toEqual([])
  })

  it('releases validation locks and empty placeholders safely after overflow, then retries against current destination money', async () => {
    const f = await setup()
    await f.execute({
      kind: 'CURRENCY_ADJUST',
      denominationId: f.denominationId,
      campaignCurrencySystemId: null,
      amount: Number.MAX_SAFE_INTEGER
    })
    const sourceBefore = (await f.read()).items
    const {
      acknowledgement: { jobId }
    } = await f.begin()
    const failed = await advance(f, jobId, (job) => job.status === 'FAILED' && job.releaseComplete)
    expect(failed.applyStarted).toBe(false)
    expect((await f.read()).items).toEqual(sourceBefore)
    const target = (await f.read()).balances.find((balance) => balance.vehicleId === undefined)!
    expect(target).toMatchObject({ amount: Number.MAX_SAFE_INTEGER })
    expect(target.cleanupJobId).toBeUndefined()
    await f.execute({
      kind: 'CURRENCY_ADJUST',
      denominationId: f.denominationId,
      campaignCurrencySystemId: null,
      amount: -20
    })
    await f.base.t.mutation(retry, { jobId })
    await f.base.t.mutation(retry, { jobId })
    await advance(f, jobId, (job) => job.status === 'COMPLETED')
    expect(
      (await f.read()).balances.find(
        (balance) => balance.vehicleId === undefined && balance.containerId === null
      )?.amount
    ).toBe(Number.MAX_SAFE_INTEGER - 10)
  })

  it('retains every existing target amount and removes only committed zero placeholders on early validation failure', async () => {
    const f = await setup()
    await addQualifiedSlots(f)
    const before = (await f.read()).balances.filter((balance) => balance.vehicleId === undefined)
    const {
      acknowledgement: { jobId }
    } = await f.begin()
    await advance(f, jobId, (job) => job.phase === 'VALIDATE_TOTALS')
    await f.base.t.mutation(run, { jobId })
    expect(await jobOf(f, jobId)).toMatchObject({ status: 'RUNNING', phase: 'VALIDATE_TOTALS' })
    const locked = (await f.read()).balances.filter((balance) => balance.cleanupJobId === jobId)
    expect(locked).toHaveLength(8)
    expect(locked.filter((balance) => balance.amount === 0).length).toBeGreaterThan(0)
    await advance(f, jobId, (job) => job.status === 'FAILED' && job.releaseComplete)
    expect((await f.read()).balances.filter((balance) => balance.vehicleId === undefined)).toEqual(
      before
    )
  })

  it.each(['slot', 'public ID'] as const)(
    'releases previously committed locks and fails before apply for duplicate destination %s',
    async (corruption) => {
      const f = await setup()
      const { lateSystem, late } = await addQualifiedSlots(f, 7)
      const target = (await f.read()).balances.find(
        (balance) =>
          balance.vehicleId === undefined &&
          balance.campaignCurrencySystemId === lateSystem.id &&
          balance.denominationId === late.id
      )!
      await f.base.t.run((ctx) => {
        const { _id, _creationTime, ...stored } = target
        return ctx.db.insert('campaignPartyCurrencies', {
          ...stored,
          ...(corruption === 'slot'
            ? { id: crypto.randomUUID() }
            : { denominationId: lateSystem.denominations.at(-2)!.id })
        })
      })
      const before = await f.read()
      const {
        acknowledgement: { jobId }
      } = await f.begin()
      await advance(f, jobId, (job) => job.phase === 'VALIDATE_TOTALS')
      await f.base.t.mutation(run, { jobId })
      expect(await jobOf(f, jobId)).toMatchObject({
        status: 'RUNNING',
        phase: 'VALIDATE_TOTALS',
        applyStarted: false
      })
      expect(
        (await f.read()).balances.filter((balance) => balance.cleanupJobId === jobId)
      ).toHaveLength(8)
      const failed = await advance(
        f,
        jobId,
        (job) => job.status === 'FAILED' && job.releaseComplete
      )
      expect(failed).toMatchObject({ phase: 'RELEASE', applyStarted: false })
      expect(failed.failureReason).toContain(
        corruption === 'slot' ? 'duplicate balances' : 'public ID'
      )
      expect(await f.read()).toEqual(before)
      expect((await f.read()).balances.some((balance) => balance.cleanupJobId === jobId)).toBe(
        false
      )
    }
  )

  it.each(['slot', 'public ID'] as const)(
    'preserves the exact late apply phase and locked contents for duplicate destination %s',
    async (corruption) => {
      const f = await setup()
      await f.execute({
        kind: 'CURRENCY_ADJUST',
        denominationId: f.denominationId,
        campaignCurrencySystemId: null,
        amount: 7
      })
      const {
        acknowledgement: { jobId }
      } = await f.begin()
      await advance(f, jobId, (job) => job.phase === 'APPLY_TOTALS')
      const target = (await f.read()).balances.find(
        (balance) =>
          balance.vehicleId === undefined &&
          balance.groupId === undefined &&
          balance.containerId === null
      )!
      const duplicateId = await f.base.t.run((ctx) => {
        const { _id, _creationTime, ...stored } = target
        return ctx.db.insert('campaignPartyCurrencies', {
          ...stored,
          ...(corruption === 'slot'
            ? { id: crypto.randomUUID() }
            : {
                denominationId: srdSystemRecord.currencies.find(
                  (currency) => currency.id !== f.denominationId
                )!.id
              })
        })
      })
      const before = await f.read(),
        phaseBefore = await jobOf(f, jobId)
      await f.base.t.mutation(run, { jobId })
      const failed = await jobOf(f, jobId)
      expect(failed).toMatchObject({
        status: 'FAILED',
        phase: 'APPLY_TOTALS',
        applyStarted: true,
        applied: phaseBefore.applied,
        sequence: phaseBefore.sequence
      })
      expect(failed.failureReason).toContain(
        corruption === 'slot' ? 'duplicate balances' : 'public ID'
      )
      expect(await f.read()).toEqual(before)
      for (const row of before.items)
        expect(await f.base.t.run((ctx) => vehicleCleanupRowAvailable(ctx, row))).toBe(false)
      // Repair only the deliberately injected invalid duplicate; retry must not replay committed cargo pages.
      await f.base.t.run((ctx) => ctx.db.delete(duplicateId))
      await f.base.t.mutation(retry, { jobId })
      await advance(f, jobId, (job) => job.status === 'COMPLETED')
      expect(
        (await f.read()).balances.find((balance) => balance.containerId === null)?.amount
      ).toBe(17)
      const completed = await f.read()
      await f.base.t.mutation(run, { jobId })
      await f.base.t.mutation(retry, { jobId })
      expect(await f.read()).toEqual(completed)
    }
  )

  it('releases locks when the first physical apply page rolls back and retries validation from unchanged cargo', async () => {
    const f = await setup()
    const before = await f.read()
    const {
      acknowledgement: { jobId }
    } = await f.begin()
    await advance(f, jobId, (job) => job.phase === 'APPLY_ITEMS')
    expect(await jobOf(f, jobId)).toMatchObject({ applyStarted: false })
    vi.spyOn(campaignStoredVehicleCleanupSegmentSchema, 'parse').mockImplementationOnce(() => {
      throw new Error('Injected first page failure')
    })
    await f.base.t.mutation(run, { jobId })
    vi.restoreAllMocks()
    const failed = await advance(f, jobId, (job) => job.status === 'FAILED' && job.releaseComplete)
    expect(failed).toMatchObject({ applyStarted: false, phase: 'RELEASE' })
    expect(await f.read()).toEqual(before)
    await f.base.t.mutation(retry, { jobId })
    expect(await jobOf(f, jobId)).toMatchObject({ status: 'RUNNING', phase: 'VALIDATE_ITEMS' })
    await advance(f, jobId, (job) => job.status === 'COMPLETED')
    expect((await f.read()).balances.find((balance) => balance.containerId === null)?.amount).toBe(
      10
    )
  })

  it('rolls back a failed apply page, hides all previous moved rows, and resumes the exact phase without duplicating money', async () => {
    const f = await setup()
    const {
      acknowledgement: { jobId }
    } = await f.begin()
    await advance(f, jobId, (job) => job.phase === 'APPLY_ITEMS')
    await f.base.t.mutation(step, { jobId })
    const before = await f.read(),
      phaseBefore = await jobOf(f, jobId)
    vi.spyOn(campaignStoredVehicleCleanupSegmentSchema, 'parse').mockImplementationOnce(() => {
      throw new Error('Injected segment failure')
    })
    await f.base.t.mutation(run, { jobId })
    vi.restoreAllMocks()
    expect(await f.read()).toEqual(before)
    const failed = await jobOf(f, jobId)
    expect(failed).toMatchObject({
      status: 'FAILED',
      phase: phaseBefore.phase,
      applyStarted: true,
      applied: phaseBefore.applied
    })
    for (const row of before.items.filter((item) => item.cleanupJobId === jobId))
      expect(await f.base.t.run((ctx) => vehicleCleanupRowAvailable(ctx, row))).toBe(false)
    await f.base.t.mutation(retry, { jobId })
    await advance(f, jobId, (job) => job.status === 'COMPLETED')
    expect((await f.read()).balances.find((balance) => balance.containerId === null)?.amount).toBe(
      10
    )
  })

  it('keeps a failed final audit hidden and retries finalization without adding the loose money twice', async () => {
    const f = await setup()
    const {
      acknowledgement: { jobId }
    } = await f.begin()
    await advance(f, jobId, (job) => job.phase === 'FINALIZE')
    const before = await f.read()
    vi.spyOn(campaignStoredEventSchema, 'parse').mockImplementationOnce(() => {
      throw new Error('Injected final audit failure')
    })
    await f.base.t.mutation(run, { jobId })
    vi.restoreAllMocks()
    expect(await f.read()).toEqual(before)
    expect(await jobOf(f, jobId)).toMatchObject({ status: 'FAILED', phase: 'FINALIZE' })
    await f.base.t.mutation(retry, { jobId })
    await advance(f, jobId, (job) => job.status === 'COMPLETED')
    expect((await f.read()).balances.find((balance) => balance.containerId === null)?.amount).toBe(
      10
    )
  })

  it('waits for another active qualified slot cleanup without vetoing either begin and resumes after completion', async () => {
    const f = await setup()
    const secondVehicle = await f.base.other.caller.mutation(api.campaigns.vehicles.create, {
      campaignId: f.campaign.id,
      vehicleDefinitionId: cart.id
    })
    await f.execute(
      {
        kind: 'CURRENCY_ADJUST',
        denominationId: f.denominationId,
        campaignCurrencySystemId: null,
        amount: 4
      },
      secondVehicle.id
    )
    const first = await f.begin()
    await advance(f, first.acknowledgement.jobId, (job) => job.phase === 'APPLY_ITEMS')
    const second = await f.base.t.run((ctx) =>
      beginVehicleCleanup(ctx, {
        ...first.grant,
        vehicleId: secondVehicle.id,
        vehicleVersion: 0,
        sourceInventoryVersion: 1,
        eventId: crypto.randomUUID(),
        commandId: crypto.randomUUID()
      })
    )
    await advance(f, second.jobId, (job) => job.phase === 'VALIDATE_TOTALS')
    await f.base.t.mutation(run, { jobId: second.jobId })
    expect(await jobOf(f, second.jobId)).toMatchObject({
      status: 'RUNNING',
      phase: 'VALIDATE_TOTALS'
    })
    await advance(f, first.acknowledgement.jobId, (job) => job.status === 'COMPLETED')
    await advance(f, second.jobId, (job) => job.status === 'COMPLETED')
    expect((await f.read()).balances.find((balance) => balance.containerId === null)?.amount).toBe(
      14
    )
  })

  it('continues from the committed grant after initiator profile/membership and author Vehicle definition disappear', async () => {
    const f = await setup()
    const {
      acknowledgement: { jobId }
    } = await f.begin('RETURN', { removalEventId: crypto.randomUUID() })
    await f.base.t.run(async (ctx) => {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', f.base.other.userId))
        .unique()
      const membership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', f.campaign.id).eq('userId', f.base.other.userId)
        )
        .unique()
      const root = await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', cart.id))
        .unique()
      if (profile) {
        await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
          input: {
            model: 'user',
            where: [{ field: '_id', value: profile.authUserId }]
          }
        })
        await ctx.db.delete(profile._id)
      }
      if (membership) await ctx.db.delete(membership._id)
      if (root) await ctx.db.delete(root._id)
    })
    await advance(f, jobId, (job) => job.status === 'COMPLETED')
    expect((await f.read()).items).toHaveLength(37)
  })

  it('purges source and previously moved destination rows after Campaign disappearance without resurrecting inventory', async () => {
    const f = await setup()
    const {
      acknowledgement: { jobId }
    } = await f.begin()
    await advance(f, jobId, (job) => job.phase === 'APPLY_ITEMS')
    await f.base.t.mutation(step, { jobId })
    await f.base.t.run(async (ctx) => {
      const campaign = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', f.campaign.id))
        .unique()
      await ctx.db.delete(campaign!._id)
    })
    await advance(f, jobId, (job) => job.status === 'PURGED')
    expect(await f.read()).toEqual({ items: [], groups: [], balances: [] })
    expect(await f.ownerVersion()).toBe(0)
    await f.base.t.mutation(run, { jobId })
    await f.base.t.mutation(retry, { jobId })
    expect(await f.read()).toEqual({ items: [], groups: [], balances: [] })
  })

  it('fails closed if the Vehicle disappears while Campaign still exists and retains source cargo', async () => {
    const f = await setup()
    const before = await f.read()
    const {
      acknowledgement: { jobId }
    } = await f.begin()
    await f.base.t.run(async (ctx) => {
      const vehicle = await ctx.db
        .query('campaignVehicles')
        .withIndex('by_campaignId_id', (q) =>
          q.eq('campaignId', f.campaign.id).eq('id', f.vehicle.id)
        )
        .unique()
      await ctx.db.delete(vehicle!._id)
    })
    await advance(f, jobId, (job) => job.status === 'FAILED' && job.releaseComplete)
    expect(await f.read()).toEqual(before)
  })

  it('denies Player progress for formerly unavailable cargo and exposes only counts/status to the OWNER', async () => {
    const f = await setup()
    await f.base.other.caller.mutation(api.campaigns.vehicles.lifecycle, {
      input: {
        action: 'MAKE_UNAVAILABLE',
        campaignId: f.campaign.id,
        vehicleId: f.vehicle.id,
        expectedVersion: 0,
        idempotencyKey: crypto.randomUUID()
      }
    })
    const {
      acknowledgement: { jobId }
    } = await f.begin()
    await expect(
      f.base.t.run((ctx) => readVehicleCleanupProgress(ctx, f.campaign.id, jobId, 'PLAYER'))
    ).rejects.toThrow('unavailable')
    const progress = await f.base.t.run((ctx) =>
      readVehicleCleanupProgress(ctx, f.campaign.id, jobId, 'OWNER')
    )
    expect(Object.keys(progress).sort()).toEqual(
      [
        'applied',
        'campaignId',
        'eventId',
        'failureReason',
        'jobId',
        'phase',
        'retryReady',
        'status',
        'validated',
        'vehicleId'
      ].sort()
    )
    const vehicle = await f.base.t.run((ctx) =>
      ctx.db
        .query('campaignVehicles')
        .withIndex('by_campaignId_id', (q) =>
          q.eq('campaignId', f.campaign.id).eq('id', f.vehicle.id)
        )
        .unique()
    )
    expect(await f.base.t.run((ctx) => readVehicleCleanupLock(ctx, vehicle!))).toEqual({
      jobId,
      status: 'RUNNING'
    })
  })

  it.each(['cycle', 'missing parent', 'duplicate item', 'group placement'] as const)(
    'rejects corrupt %s before applying any cargo',
    async (scenario) => {
      const f = await setup()
      const snapshot = await f.read()
      await f.base.t.run(async (ctx) => {
        const bag = snapshot.items.find((item) => item.id === f.bagId)!
        if (scenario === 'cycle') {
          const ring = snapshot.items.filter((item) => item.vehicleId === f.vehicle.id)
          for (let index = 0; index < ring.length; index++)
            await ctx.db.patch(ring[index]!._id, {
              containerId: ring[(index + 1) % ring.length]!.id
            })
        }
        if (scenario === 'missing parent')
          await ctx.db.patch(bag._id, { containerId: crypto.randomUUID() })
        if (scenario === 'duplicate item') {
          const { _id, _creationTime, ...stored } = bag
          await ctx.db.insert('campaignPartyItems', stored)
        }
        if (scenario === 'group placement')
          await ctx.db.patch(
            snapshot.balances.find((balance) => balance.groupId !== undefined)!._id,
            { containerId: null }
          )
      })
      const before = await f.read()
      const {
        acknowledgement: { jobId }
      } = await f.begin()
      const failed = await advance(
        f,
        jobId,
        (job) => job.status === 'FAILED' && job.releaseComplete
      )
      expect(failed.applyStarted).toBe(false)
      expect(await f.read()).toEqual(before)
    }
  )
  it.each(['RETURN', 'DESTROY'] as const)(
    'retains missing acquired rules and advances the pending %s cleanup join',
    async (mode) => {
      const f = await setup()
      const begun = await f.begin(mode)
      const jobId = begun.acknowledgement.jobId
      await advance(f, jobId, (job) => job.phase === 'APPLY_ITEMS')
      const pending = await jobOf(f, jobId)
      expect(pending.status).toBe('RUNNING')
      const source = (await f.read()).items.find(
        (item) => item.vehicleId === f.vehicle.id && item.equipmentId === club.id
      )!
      await f.base.t.run((ctx) => ctx.db.patch(source._id, { retainedRulesJson: undefined }))
      const beforeJoin = await jobOf(f, jobId)
      const immutable = {
        grant: beforeJoin.grant,
        grantChecksum: beforeJoin.grantChecksum,
        mode: beforeJoin.grant.mode,
        actorUserId: beforeJoin.grant.actorUserId,
        eventId: beforeJoin.grant.eventId
      }
      const beforeSourceVersion = beforeJoin.sourceInventoryVersion
      const joined = await f.base.t.run(async (ctx) => {
        const campaign = await ctx.db
          .query('campaigns')
          .withIndex('by_publicId', (q) => q.eq('id', f.campaign.id))
          .unique()
        if (!campaign) throw new Error('Missing Campaign cleanup fixture.')
        await retainCampaignEquipmentRules(ctx, campaign, [
          { subjectKind: 'EQUIPMENT', subjectId: club.id }
        ])
        return {
          job: await ctx.db
            .query('campaignVehicleCleanupJobs')
            .withIndex('by_publicId', (q) => q.eq('id', jobId))
            .unique(),
          inventory: await ctx.db
            .query('campaignPartyInventories')
            .withIndex('by_campaignId_vehicleId', (q) =>
              q.eq('campaignId', f.campaign.id).eq('vehicleId', f.vehicle.id)
            )
            .unique()
        }
      })
      expect(joined.job?.sourceInventoryVersion).toBe(beforeSourceVersion + 1)
      expect(joined.inventory?.version).toBe(beforeSourceVersion + 1)
      expect(joined?.job?.status).toBe('RUNNING')
      expect({
        grant: joined.job?.grant,
        grantChecksum: joined.job?.grantChecksum,
        mode: joined.job?.grant.mode,
        actorUserId: joined.job?.grant.actorUserId,
        eventId: joined.job?.grant.eventId
      }).toEqual(immutable)
      const retained = (await f.read()).items.find(
        (item) => item.id === source.id
      )?.retainedRulesJson
      expect(retained).toBeTypeOf('string')
      acquiredEquipmentRulesSchema.parse(JSON.parse(retained!))
      const sourceFence = await f.base.t.run(async (ctx) => {
        const vehicle = await ctx.db
          .query('campaignVehicles')
          .withIndex('by_campaignId_id', (q) =>
            q.eq('campaignId', f.campaign.id).eq('id', f.vehicle.id)
          )
          .unique()
        if (!vehicle) throw new Error('Missing source Vehicle fence.')
        return readVehicleCleanupLock(ctx, vehicle)
      })
      expect(sourceFence).toEqual({ jobId, status: 'RUNNING' })
      const completed = await advance(f, jobId, (job) => job.status === 'COMPLETED')
      expect(completed.status).toBe('COMPLETED')
      const exact = await f.read()
      await f.base.t.mutation(step, { jobId })
      await f.base.t.mutation(run, { jobId })
      expect(await f.read()).toEqual(exact)
      expect(await jobOf(f, jobId)).toMatchObject({
        status: 'COMPLETED',
        grant: immutable.grant,
        grantChecksum: immutable.grantChecksum
      })
    }
  )

  it('retains missing rules after a pre-apply overflow failure and converges without money duplication', async () => {
    const f = await setup()
    await f.execute({
      kind: 'CURRENCY_ADJUST',
      denominationId: f.denominationId,
      campaignCurrencySystemId: null,
      amount: Number.MAX_SAFE_INTEGER
    })
    const begun = await f.begin()
    const jobId = begun.acknowledgement.jobId
    const failed = await advance(f, jobId, (job) => job.status === 'FAILED' && job.releaseComplete)
    expect(failed.applyStarted).toBe(false)
    const source = (await f.read()).items.find(
      (item) => item.vehicleId === f.vehicle.id && item.equipmentId === club.id
    )!
    await f.base.t.run((ctx) => ctx.db.patch(source._id, { retainedRulesJson: undefined }))
    const immutable = {
      grant: failed.grant,
      grantChecksum: failed.grantChecksum,
      mode: failed.grant.mode,
      actorUserId: failed.grant.actorUserId,
      eventId: failed.grant.eventId
    }
    const joined = await f.base.t.run(async (ctx) => {
      const campaign = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', f.campaign.id))
        .unique()
      if (!campaign) throw new Error('Missing Campaign cleanup fixture.')
      await retainCampaignEquipmentRules(ctx, campaign, [
        { subjectKind: 'EQUIPMENT', subjectId: club.id }
      ])
      return {
        job: await ctx.db
          .query('campaignVehicleCleanupJobs')
          .withIndex('by_publicId', (q) => q.eq('id', jobId))
          .unique(),
        inventory: await ctx.db
          .query('campaignPartyInventories')
          .withIndex('by_campaignId_vehicleId', (q) =>
            q.eq('campaignId', f.campaign.id).eq('vehicleId', f.vehicle.id)
          )
          .unique()
      }
    })
    expect(joined.job?.sourceInventoryVersion).toBe(failed.sourceInventoryVersion + 1)
    expect(joined.inventory?.version).toBe(failed.sourceInventoryVersion + 1)
    expect(joined.job?.status).toBe('FAILED')
    expect({
      grant: joined.job?.grant,
      grantChecksum: joined.job?.grantChecksum,
      mode: joined.job?.grant.mode,
      actorUserId: joined.job?.grant.actorUserId,
      eventId: joined.job?.grant.eventId
    }).toEqual(immutable)
    const retained = (await f.read()).items.find((item) => item.id === source.id)?.retainedRulesJson
    expect(retained).toBeTypeOf('string')
    acquiredEquipmentRulesSchema.parse(JSON.parse(retained!))
    await f.execute({
      kind: 'CURRENCY_ADJUST',
      denominationId: f.denominationId,
      campaignCurrencySystemId: null,
      amount: -20
    })
    await f.base.t.mutation(retry, { jobId })
    await f.base.t.mutation(retry, { jobId })
    const completed = await advance(f, jobId, (job) => job.status === 'COMPLETED')
    expect(completed.status).toBe('COMPLETED')
    expect(
      (await f.read()).balances.find(
        (balance) => balance.vehicleId === undefined && balance.containerId === null
      )?.amount
    ).toBe(Number.MAX_SAFE_INTEGER - 10)
    const exact = await f.read()
    await f.base.t.mutation(run, { jobId })
    await f.base.t.mutation(retry, { jobId })
    expect(await f.read()).toEqual(exact)
    expect(await jobOf(f, jobId)).toMatchObject({
      status: 'COMPLETED',
      grant: immutable.grant,
      grantChecksum: immutable.grantChecksum
    })
  })
})
