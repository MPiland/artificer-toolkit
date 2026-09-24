import assert from 'node:assert/strict'
import { ConvexClient } from 'convex/browser'
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server'
import { srdVehicles } from '@artificer-toolkit/source-data/srd/vehicles/index.js'
import { api } from '../convex/_generated/api.js'
import type { CampaignCustodyCohort } from './developmentCampaignCustody'

function subscribe<Query extends FunctionReference<'query'>>(
  client: ConvexClient,
  query: Query,
  args: FunctionArgs<Query>,
  unsubscribers: (() => void)[]
): Promise<FunctionReturnType<Query>> {
  return new Promise((resolve, reject) => {
    unsubscribers.push(client.onUpdate(query, args, resolve, reject))
  })
}

export async function verifyCampaignInventoryReadProbe(
  cohort: CampaignCustodyCohort,
  input: { deploymentUrl: string; ownerFetchToken: () => Promise<string> }
) {
  const [firstPlayer, secondPlayer] = cohort.players
  assert.ok(firstPlayer && secondPlayer)
  const clients = [
    new ConvexClient(input.deploymentUrl),
    new ConvexClient(input.deploymentUrl),
    new ConvexClient(input.deploymentUrl)
  ]
  const unsubscribers: (() => void)[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    clients[0]!.setAuth(input.ownerFetchToken)
    clients[1]!.setAuth(firstPlayer.fetchToken)
    clients[2]!.setAuth(secondPlayer.fetchToken)
    const campaignId = cohort.campaignId
    const pageInput = { campaignId, paginationOpts: { cursor: null, numItems: 48 } }
    const owner = { kind: 'CAMPAIGN' as const, campaignId }
    const burst = Promise.all(
      clients.map(async (client) => {
        const [campaign, systems, shares, items, currencies, vehicles, options, version] =
          await Promise.all([
            subscribe(client, api.campaigns.queries.get, { id: campaignId }, unsubscribers),
            subscribe(client, api.campaigns.currencySystems.list, pageInput, unsubscribers),
            subscribe(client, api.campaigns.contentShares.list, pageInput, unsubscribers),
            subscribe(client, api.campaigns.partyInventory.items, pageInput, unsubscribers),
            subscribe(client, api.campaigns.partyInventory.currencies, pageInput, unsubscribers),
            subscribe(client, api.campaigns.vehicles.list, pageInput, unsubscribers),
            subscribe(client, api.campaigns.vehicles.definitionOptions, pageInput, unsubscribers),
            subscribe(
              client,
              api.campaigns.inventoryOwners.version,
              { input: { campaignId, owner } },
              unsubscribers
            )
          ])
        assert.equal(campaign?.id, campaignId)
        for (const page of [systems, shares, items, currencies, vehicles]) {
          assert.deepEqual(page.page, [])
          assert.equal(page.isDone, true)
        }
        assert.deepEqual(version, { owner, version: 0 })
        for (const page of [items, currencies]) {
          assert.deepEqual(page.owner, version.owner)
          assert.equal(page.version, version.version)
        }
        const ids = options.page.map((option) => option.id).sort()
        assert.equal(options.isDone, true)
        assert.equal(new Set(ids).size, 11)
        assert.deepEqual(ids, srdVehicles.map((vehicle) => vehicle.id).sort())
        return {
          'queries.get': campaign,
          'currencySystems.list': systems,
          'contentShares.list': shares,
          'partyInventory.items': items,
          'partyInventory.currencies': currencies,
          'vehicles.list': vehicles,
          'vehicles.definitionOptions': options,
          'inventoryOwners.version': version
        }
      })
    )
    const result = await Promise.race([
      burst,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Inventory read probe timed out after 30 seconds.')),
          30_000
        )
      })
    ])
    const [ownerResponse, player1Response, player2Response] = result
    assert.ok(ownerResponse && player1Response && player2Response)
    const keys = [
      'currencySystems.list',
      'contentShares.list',
      'partyInventory.items',
      'partyInventory.currencies',
      'vehicles.list',
      'vehicles.definitionOptions'
    ] as const
    for (const key of keys) {
      assert.deepEqual(player1Response[key].page, ownerResponse[key].page)
      assert.deepEqual(player2Response[key].page, ownerResponse[key].page)
    }
    return {
      campaignId,
      queryCount: 24,
      responses: { owner: ownerResponse, player1: player1Response, player2: player2Response }
    }
  } finally {
    clearTimeout(timer)
    for (const unsubscribe of unsubscribers) unsubscribe()
    await Promise.all(clients.map((client) => client.close()))
  }
}
