import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import type { SocialProofCohort } from './developmentSocial.js'
import { api } from '../convex/_generated/api.js'

type RequestOutcome =
  | { status: 'fulfilled' }
  | { status: 'rejected'; error: 'seat-unavailable' | 'unknown' }

const outcome = (result: PromiseSettledResult<unknown>): RequestOutcome => {
  if (result.status === 'fulfilled') return { status: 'fulfilled' }
  if (
    result.reason instanceof Error &&
    result.reason.message.includes('This table no longer has an available seat.')
  )
    return { status: 'rejected', error: 'seat-unavailable' }
  return { status: 'rejected', error: 'unknown' }
}

const assertSeatRejection = (result: PromiseSettledResult<unknown>) => {
  if (result.status !== 'rejected') throw new Error('Expected a rejected admission request.')
  assert.ok(result.reason instanceof Error)
  assert.match(result.reason.message, /This table no longer has an available seat\./)
}

export async function verifySocialAdmission(
  cohort: SocialProofCohort,
  campaignId: string,
  listingId: string,
  evidenceDirectory: string
) {
  const { owner, player, invitee } = cohort
  const accounts = Object.values(cohort)
  const startedAt = new Date().toISOString()
  for (const account of accounts) account.client.setAuth(await account.fetchToken())

  const listing = await owner.client.query(api.social.listings.getOwned, {
    listingPublicId: listingId
  })
  const updatedListing = await owner.client.mutation(api.social.listings.update, {
    input: {
      listingPublicId: listing.listingPublicId,
      expectedVersion: listing.version,
      summary: listing.summary,
      audience: listing.audience,
      systemId: listing.system.systemId,
      playMode: listing.playMode,
      capacity: 1,
      schedule: listing.schedule,
      location: listing.location,
      expectations: listing.expectations
    }
  })
  assert.equal(updatedListing.capacity, 1)

  const applications = await Promise.all([
    player.client.mutation(api.social.applications.submit, {
      listingPublicId: listingId,
      message: 'Admission proof player application.',
      expectedListingVersion: updatedListing.version
    }),
    invitee.client.mutation(api.social.applications.submit, {
      listingPublicId: listingId,
      message: 'Admission proof invitee application.',
      expectedListingVersion: updatedListing.version
    })
  ])
  const decisionInputs = applications.map((application) => ({
    applicationPublicId: application.applicationPublicId,
    expectedVersion: application.version,
    decision: 'ACCEPT' as const
  }))
  const firstRace = await Promise.allSettled(
    decisionInputs.map((input) =>
      owner.client.mutation(api.social.applications.decide, input, { skipQueue: true })
    )
  )
  assert.equal(firstRace.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(firstRace.filter((result) => result.status === 'rejected').length, 1)
  const firstLoser = firstRace.find((result) => result.status === 'rejected')
  assert.ok(firstLoser)
  assertSeatRejection(firstLoser)
  const firstWinnerIndex = firstRace[0].status === 'fulfilled' ? 0 : 1
  const firstLoserIndex = firstWinnerIndex === 0 ? 1 : 0
  const firstWinner = firstRace[firstWinnerIndex]
  if (firstWinner.status !== 'fulfilled')
    throw new Error('Expected one fulfilled admission request.')
  assert.equal(firstWinner.value.status, 'ACCEPTED')
  const afterFirstAdmission = await owner.client.query(api.campaigns.queries.get, {
    id: campaignId
  })
  const firstMember = afterFirstAdmission.memberships.find(
    (member) => member.userId === [player, invitee][firstWinnerIndex]!.userId
  )
  assert.ok(firstMember)
  assert.equal(
    afterFirstAdmission.memberships.filter((member) => member.role === 'PLAYER').length,
    1
  )

  const replayedDecisions = await Promise.all(
    [0, 1].map(() =>
      owner.client.mutation(api.social.applications.decide, decisionInputs[firstWinnerIndex]!, {
        skipQueue: true
      })
    )
  )
  assert.ok(replayedDecisions.every((application) => application.status === 'ACCEPTED'))
  const afterFirstReplay = await owner.client.query(api.campaigns.queries.get, { id: campaignId })
  const replayedFirstMember = afterFirstReplay.memberships.find(
    (member) => member.userId === firstMember.userId
  )
  assert.ok(replayedFirstMember)
  assert.equal(replayedFirstMember.accessStartedAt, firstMember.accessStartedAt)
  assert.equal(afterFirstReplay.memberships.filter((member) => member.role === 'PLAYER').length, 1)
  assert.equal(firstMember.userId, [player, invitee][firstWinnerIndex]!.userId)

  await owner.client.mutation(api.campaigns.membershipDeparture.removeMember, {
    campaignId,
    userId: firstMember.userId,
    commandId: crypto.randomUUID(),
    expectedCampaignVersion: afterFirstReplay.version,
    expectedMembershipAccessStartedAt: firstMember.accessStartedAt
  })

  const invite = await owner.client.mutation(api.social.invitations.create, {
    listingPublicId: listingId,
    expectedListingVersion: updatedListing.version,
    username: [player, invitee][firstWinnerIndex]!.username
  })
  const mixedRace = await Promise.allSettled([
    owner.client.mutation(api.social.applications.decide, decisionInputs[firstLoserIndex]!, {
      skipQueue: true
    }),
    [player, invitee][firstWinnerIndex]!.client.mutation(
      api.social.invitations.accept,
      { invitePublicId: invite.invitePublicId, expectedVersion: invite.version },
      { skipQueue: true }
    )
  ])
  assert.equal(mixedRace.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(mixedRace.filter((result) => result.status === 'rejected').length, 1)
  const mixedLoser = mixedRace.find((result) => result.status === 'rejected')
  assert.ok(mixedLoser)
  assertSeatRejection(mixedLoser)
  const mixedWinnerIndex = mixedRace[0].status === 'fulfilled' ? 0 : 1
  const mixedWinner = mixedRace[mixedWinnerIndex]
  if (mixedWinner.status !== 'fulfilled')
    throw new Error('Expected one fulfilled mixed admission request.')
  const afterMixedAdmission = await owner.client.query(api.campaigns.queries.get, {
    id: campaignId
  })
  assert.equal(
    afterMixedAdmission.memberships.filter((member) => member.role === 'PLAYER').length,
    1
  )
  const secondMember = afterMixedAdmission.memberships.find((member) => member.role === 'PLAYER')
  assert.ok(secondMember)
  const mixedWinnerAccount =
    mixedWinnerIndex === 0
      ? [player, invitee][firstLoserIndex]!
      : [player, invitee][firstWinnerIndex]!
  assert.equal(secondMember.userId, mixedWinnerAccount.userId)
  const accessStartedAt = secondMember.accessStartedAt

  if (mixedWinnerIndex === 0) {
    const replay = await Promise.all(
      [0, 1].map(() =>
        owner.client.mutation(api.social.applications.decide, decisionInputs[firstLoserIndex]!, {
          skipQueue: true
        })
      )
    )
    assert.ok(replay.every((application) => application.status === 'ACCEPTED'))
  } else {
    const replay = await Promise.all(
      [0, 1].map(() =>
        [player, invitee][firstWinnerIndex]!.client.mutation(
          api.social.invitations.accept,
          { invitePublicId: invite.invitePublicId, expectedVersion: invite.version },
          { skipQueue: true }
        )
      )
    )
    assert.ok(
      replay.every((campaign) =>
        campaign.memberships.some((member) => member.userId === secondMember.userId)
      )
    )
  }
  const afterReplay = await owner.client.query(api.campaigns.queries.get, { id: campaignId })
  const replayMember = afterReplay.memberships.find((member) => member.role === 'PLAYER')
  assert.ok(replayMember)
  assert.equal(replayMember.userId, secondMember.userId)
  assert.equal(replayMember.accessStartedAt, accessStartedAt)
  assert.equal(afterReplay.memberships.filter((member) => member.role === 'PLAYER').length, 1)

  await owner.client.mutation(api.campaigns.membershipDeparture.removeMember, {
    campaignId,
    userId: replayMember.userId,
    commandId: crypto.randomUUID(),
    expectedCampaignVersion: afterReplay.version,
    expectedMembershipAccessStartedAt: replayMember.accessStartedAt
  })
  const finalCampaign = await owner.client.query(api.campaigns.queries.get, { id: campaignId })
  assert.equal(finalCampaign.memberships.filter((member) => member.role === 'PLAYER').length, 0)
  assert.ok(!finalCampaign.memberships.some((member) => member.userId === player.userId))
  assert.ok(!finalCampaign.memberships.some((member) => member.userId === invitee.userId))

  const evidence = {
    startedAt,
    endedAt: new Date().toISOString(),
    requests: {
      applicationAdmission: firstRace.map(outcome),
      applicationReplay: replayedDecisions.map(() => ({ status: 'fulfilled' as const })),
      mixedAdmission: mixedRace.map(outcome),
      mixedReplay: [{ status: 'fulfilled' as const }, { status: 'fulfilled' as const }]
    },
    counts: {
      firstFulfilled: firstRace.filter((result) => result.status === 'fulfilled').length,
      mixedFulfilled: mixedRace.filter((result) => result.status === 'fulfilled').length,
      finalPlayers: finalCampaign.memberships.filter((member) => member.role === 'PLAYER').length
    },
    replayEpochEqual: replayMember.accessStartedAt === accessStartedAt
  }
  await writeFile(
    `${evidenceDirectory}/admission-concurrency.json`,
    JSON.stringify(evidence, null, 2)
  )
  console.log('Native Social concurrent admission and replay proof passed.')
}
