import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import { api } from '../convex/_generated/api.js'
import type { CampaignCustodyCohort } from './developmentCampaignCustody'
import {
  verifyCampaignCustodyBrowser as driveCampaignCustodyBrowser,
  type CampaignCustodyVerificationInput
} from '../../web/tests/live-backend/campaignCustody'

async function collectPages<T>(
  load: (cursor: string | null) => Promise<{ page: T[]; isDone: boolean; continueCursor: string }>
): Promise<T[]> {
  const rows: T[] = []
  const cursors = new Set<string>()
  let cursor: string | null = null
  while (true) {
    const result = await load(cursor)
    rows.push(...result.page)
    if (result.isDone) return rows
    assert.equal(cursors.has(result.continueCursor), false, 'Inventory cursor must advance.')
    cursors.add(result.continueCursor)
    cursor = result.continueCursor
  }
}

export async function verifyCampaignCustodyBrowser(
  cohort: CampaignCustodyCohort,
  input: Omit<CampaignCustodyVerificationInput, 'verifyState'>
): Promise<void> {
  const { owner, campaignId } = cohort
  const paginationOpts = { cursor: null, numItems: 48 }
  const listInput = { campaignId, paginationOpts }
  const read = async () => {
    const [vehicles, items, currencies, version] = await Promise.all([
      collectPages((cursor) =>
        owner.query(api.campaigns.vehicles.list, {
          ...listInput,
          paginationOpts: { ...paginationOpts, cursor }
        })
      ),
      collectPages((cursor) =>
        owner.query(api.campaigns.partyInventory.items, {
          ...listInput,
          paginationOpts: { ...paginationOpts, cursor }
        })
      ),
      collectPages((cursor) =>
        owner.query(api.campaigns.partyInventory.currencies, {
          ...listInput,
          paginationOpts: { ...paginationOpts, cursor }
        })
      ),
      owner.query(api.campaigns.inventoryOwners.version, {
        input: { campaignId, owner: { kind: 'CAMPAIGN', campaignId } }
      })
    ])
    assert.ok(vehicles.length <= 1, 'The browser fixture has at most one current Vehicle.')
    const vehicle = vehicles[0]
    const cargo = vehicle
      ? await Promise.all([
          collectPages((cursor) =>
            owner.query(api.campaigns.vehicleInventory.items, {
              ...listInput,
              vehicleId: vehicle.id,
              paginationOpts: { ...paginationOpts, cursor }
            })
          ),
          collectPages((cursor) =>
            owner.query(api.campaigns.vehicleInventory.currencies, {
              ...listInput,
              vehicleId: vehicle.id,
              paginationOpts: { ...paginationOpts, cursor }
            })
          ),
          owner.query(api.campaigns.inventoryOwners.version, {
            input: { campaignId, owner: { kind: 'VEHICLE', vehicleId: vehicle.id } }
          })
        ])
      : null
    return {
      vehicles,
      party: { items, currencies, version: version.version },
      cargo: cargo ? { items: cargo[0], currencies: cargo[1], version: cargo[2].version } : null
    }
  }
  type Snapshot = Awaited<ReturnType<typeof read>>
  const baseline = await read()
  assert.equal(baseline.vehicles.length, 0)
  let first: Snapshot | undefined
  let returned: Snapshot | undefined
  let second: Snapshot | undefined
  const canonicalRows = <T>(rows: T[]) => rows.map((row) => JSON.stringify(row)).sort()
  const assertFilledCargo = (snapshot: Snapshot) => {
    assert.equal(snapshot.vehicles.length, 1)
    assert.equal(snapshot.vehicles[0].vehicleDefinitionId, cart.id)
    assert.equal(snapshot.vehicles[0].availability, 'AVAILABLE')
    assert.ok(snapshot.cargo)
    assert.equal(snapshot.cargo.items.length, 2)
    const bag = snapshot.cargo.items.find((row) => row.label === 'Backpack')
    const child = snapshot.cargo.items.find((row) => row.label === 'Club')
    assert.ok(bag?.isContainer && child)
    assert.equal(bag.quantity, 1)
    assert.equal(child.quantity, 1)
    assert.equal(child.containerId, bag.id)
    assert.equal(snapshot.cargo.currencies.length, 1)
    assert.equal(snapshot.cargo.currencies[0].kind, 'RULESET')
    assert.equal(snapshot.cargo.currencies[0].containerId, bag.id)
    assert.equal(snapshot.cargo.currencies[0].amount, 5)
    assert.equal(snapshot.cargo.version, 3)
  }
  await driveCampaignCustodyBrowser({
    ...input,
    verifyState: async (stage) => {
      const snapshot = await read()
      if (stage === 'cargo-filled') {
        assertFilledCargo(snapshot)
        assert.deepEqual(snapshot.party, baseline.party)
        first = snapshot
      } else if (stage === 'unavailable' || stage === 'restored') {
        assert.ok(first?.cargo && snapshot.cargo)
        assert.equal(snapshot.vehicles[0].id, first.vehicles[0].id)
        assert.equal(
          snapshot.vehicles[0].version,
          first.vehicles[0].version + (stage === 'unavailable' ? 1 : 2)
        )
        assert.equal(
          snapshot.vehicles[0].availability,
          stage === 'unavailable' ? 'UNAVAILABLE' : 'AVAILABLE'
        )
        assert.deepEqual(snapshot.cargo, first.cargo)
        assert.deepEqual(snapshot.party, baseline.party)
      } else if (stage === 'returned') {
        assert.ok(first?.cargo)
        assert.deepEqual(snapshot.vehicles, [])
        assert.equal(snapshot.cargo, null)
        assert.equal(snapshot.party.version, baseline.party.version + 1)
        assert.deepEqual(
          canonicalRows(snapshot.party.items),
          canonicalRows([...baseline.party.items, ...first.cargo.items])
        )
        assert.deepEqual(
          canonicalRows(snapshot.party.currencies),
          canonicalRows([...baseline.party.currencies, ...first.cargo.currencies])
        )
        returned = snapshot
      } else if (stage === 'destroy-filled') {
        assert.ok(returned)
        assertFilledCargo(snapshot)
        assert.deepEqual(snapshot.party, returned.party)
        second = snapshot
      } else {
        assert.ok(returned && second?.cargo)
        assert.deepEqual(snapshot.vehicles, [])
        assert.equal(snapshot.cargo, null)
        assert.deepEqual(
          snapshot.party,
          returned.party,
          'Explicit cargo destruction must not add cargo to party inventory.'
        )
      }
      for (const player of cohort.players) {
        const visible = await collectPages((cursor) =>
          player.client.query(api.campaigns.vehicles.list, {
            ...listInput,
            paginationOpts: { ...paginationOpts, cursor }
          })
        )
        assert.deepEqual(visible, stage === 'unavailable' ? [] : snapshot.vehicles)
        const vehicleId = (stage === 'destroyed' ? second : first)?.vehicles[0].id
        if (vehicleId && ['unavailable', 'returned', 'destroyed'].includes(stage)) {
          await assert.rejects(
            () =>
              player.client.query(api.campaigns.vehicleInventory.items, {
                ...listInput,
                vehicleId
              }),
            /unavailable|not found|access|permission/i
          )
          await assert.rejects(
            () =>
              player.client.query(api.campaigns.vehicleInventory.currencies, {
                ...listInput,
                vehicleId
              }),
            /unavailable|not found|access|permission/i
          )
        } else if (snapshot.cargo && snapshot.vehicles[0]) {
          const playerCargo = await Promise.all([
            collectPages((cursor) =>
              player.client.query(api.campaigns.vehicleInventory.items, {
                ...listInput,
                vehicleId: snapshot.vehicles[0].id,
                paginationOpts: { ...paginationOpts, cursor }
              })
            ),
            collectPages((cursor) =>
              player.client.query(api.campaigns.vehicleInventory.currencies, {
                ...listInput,
                vehicleId: snapshot.vehicles[0].id,
                paginationOpts: { ...paginationOpts, cursor }
              })
            )
          ])
          assert.deepEqual(playerCargo[0], snapshot.cargo.items)
          assert.deepEqual(playerCargo[1], snapshot.cargo.currencies)
        }
      }
      await writeFile(
        `${input.evidenceDirectory}/native-${stage}.json`,
        JSON.stringify({ stage, capturedAtUtc: new Date().toISOString(), snapshot }, null, 2)
      )
    }
  })
  assert.ok(returned && second)
  assert.deepEqual((await read()).party, returned.party)
  const audit = await collectPages(async (cursor) => {
    const page = await cohort.owner.query(api.campaigns.inventoryAudit.list, {
      campaignId: cohort.campaignId,
      limit: 48,
      ...(cursor ? { cursor } : {})
    })
    return {
      page: page.events,
      isDone: page.nextCursor === null,
      continueCursor: page.nextCursor ?? ''
    }
  })
  assert.deepEqual(
    JSON.parse(await readFile(`${input.evidenceDirectory}/browser-audit.json`, 'utf8')) as unknown,
    { auditIds: audit.map((event) => event.id) },
    'Every visible audit row must match the complete native owner-only audit in order.'
  )
  console.log(
    'Campaign custody browser: all six UI lifecycle stages matched complete native state; three independent authenticated clients preserved cargo identity, coins and privacy through restoration, return, destruction and reload.'
  )
}
