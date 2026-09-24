import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { SocialProofCohort } from './developmentSocial.js'
import { api } from '../convex/_generated/api.js'
import { developmentCli as cli } from './developmentCli'

export async function verifySocialPagination(
  cohort: SocialProofCohort,
  campaignId: string,
  listingId: string,
  evidenceDirectory: string
) {
  const { owner, player, invitee, moderator } = cohort
  const startedAt = new Date().toISOString()
  let temporaryCampaignId: string | null = null
  for (const account of Object.values(cohort)) account.client.setAuth(await account.fetchToken())

  try {
    const listing = await owner.client.query(api.social.listings.getOwned, {
      listingPublicId: listingId
    })
    assert.equal(listing.status, 'OPEN')
    // Convex indexes search terms up to 32 characters.
    const needle = `p17${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`
    const beforeFields = {
      summary: `${needle} before`,
      audience: listing.audience,
      systemId: listing.system.systemId,
      playMode: listing.playMode,
      capacity: listing.capacity,
      schedule: listing.schedule,
      location: listing.location,
      expectations: listing.expectations
    }
    const updatedFields = { ...beforeFields, summary: `${needle} after` }
    const preparedListing = await owner.client.mutation(api.social.listings.update, {
      input: {
        ...beforeFields,
        listingPublicId: listing.listingPublicId,
        expectedVersion: listing.version
      }
    })

    const temporaryCampaign = await moderator.client.mutation(api.campaigns.create.create, {
      name: 'Encounter execution fixture',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    temporaryCampaignId = temporaryCampaign.id
    assert.notEqual(temporaryCampaignId, campaignId)
    const temporaryListing = await moderator.client.mutation(api.social.listingDrafts.create, {
      input: {
        ...beforeFields,
        campaignId: temporaryCampaignId
      }
    })
    const openedListing = await moderator.client.mutation(api.social.listings.open, {
      listingPublicId: temporaryListing.listingPublicId,
      expectedVersion: temporaryListing.version
    })
    assert.equal(openedListing.status, 'OPEN')

    const first = await invitee.client.query(api.social.discoveryLists.search, {
      query: needle,
      paginationOpts: { cursor: null, numItems: 1 }
    })
    assert.equal(first.page.length, 1)
    assert.equal(first.isDone, false)
    assert.ok(first.continueCursor)
    assert.notEqual(first.continueCursor, null)
    const firstId = first.page[0]!.listingPublicId
    const listingIds = [listingId, temporaryListing.listingPublicId]
    assert.ok(listingIds.includes(firstId))
    const secondExpectedId = listingIds.find((id) => id !== firstId)
    assert.ok(secondExpectedId)

    const [, , second] = await Promise.all([
      owner.client.mutation(api.social.listings.update, {
        input: {
          ...updatedFields,
          listingPublicId: listing.listingPublicId,
          expectedVersion: preparedListing.version
        }
      }),
      moderator.client.mutation(api.social.listings.update, {
        input: {
          ...updatedFields,
          listingPublicId: temporaryListing.listingPublicId,
          expectedVersion: openedListing.version
        }
      }),
      invitee.client.query(api.social.discoveryLists.search, {
        query: needle,
        paginationOpts: { cursor: first.continueCursor, numItems: 8 }
      })
    ])
    assert.equal(second.page.length, 1)
    assert.equal(second.page[0]!.listingPublicId, secondExpectedId)
    assert.equal(second.isDone, true)
    assert.notEqual(second.continueCursor, first.continueCursor)
    const initialOrder = [first.page[0]!.listingPublicId, second.page[0]!.listingPublicId]

    const repeatFirst = await invitee.client.query(api.social.discoveryLists.search, {
      query: needle,
      paginationOpts: { cursor: null, numItems: 1 }
    })
    const repeatSecond = await invitee.client.query(api.social.discoveryLists.search, {
      query: needle,
      paginationOpts: { cursor: repeatFirst.continueCursor, numItems: 8 }
    })
    const repeatedOrder = [
      repeatFirst.page[0]!.listingPublicId,
      repeatSecond.page[0]!.listingPublicId
    ]
    assert.deepEqual(repeatedOrder, initialOrder)
    assert.equal(repeatFirst.page.length, 1)
    assert.equal(repeatSecond.page.length, 1)
    assert.equal(repeatSecond.isDone, true)
    assert.equal(repeatFirst.page[0]!.summary, updatedFields.summary)
    assert.equal(repeatSecond.page[0]!.summary, updatedFields.summary)
    await writeFile(
      `${evidenceDirectory}/pagination-concurrency.json`,
      JSON.stringify(
        {
          startedAt,
          endedAt: new Date().toISOString(),
          counts: { initial: initialOrder.length, repeated: repeatedOrder.length },
          initialOrder,
          repeatedOrder,
          cursorAdvanced: second.continueCursor !== first.continueCursor,
          continuationDone: second.isDone
        },
        null,
        2
      )
    )
    console.log('Native Social concurrent pagination proof passed.')
  } finally {
    if (temporaryCampaignId) {
      await cli(
        'social/developmentFixtures:removeFixtureState',
        {
          ownerUserId: moderator.userId,
          playerUserId: player.userId,
          inviteeUserId: invitee.userId,
          moderatorUserId: owner.userId,
          campaignId: temporaryCampaignId
        },
        false
      )
      await cli(
        'encounters/developmentCampaign:removeFixtureCampaign',
        {
          ownerUserId: moderator.userId,
          playerUserId: player.userId,
          campaignId: temporaryCampaignId,
          characterId: crypto.randomUUID()
        },
        false
      )
    }
  }
}
