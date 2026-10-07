import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import { validateUsername } from '@artificer-toolkit/shared/account/username'
import type { DevelopmentClient } from './developmentClient'
import { api } from '../convex/_generated/api.js'
import type { CampaignCustodyCohort } from './developmentCampaignCustody'
import {
  verifyCampaignMembershipCustodyDeparture,
  type MembershipCustodyDepartureProof,
  type MembershipCustodyDepartureReason
} from './developmentCampaignMembershipCustody'

export type CampaignMembershipLifecycleStage =
  | 'BEFORE_LEAVE'
  | 'AFTER_LEAVE'
  | 'AFTER_REJOIN_LEAVE'
  | 'BEFORE_REMOVE'
  | 'AFTER_REMOVE'
  | 'AFTER_REJOIN_REMOVE'
  | 'AFTER_FORWARD_TRANSFER'
  | 'AFTER_RESTORE_TRANSFER'

export type MembershipLifecycleObserver = {
  client: DevelopmentClient & { setAuth: (token: string) => void }
  fetchToken: () => Promise<string>
  userId: string
}

export type MembershipLifecycleDepartureProof = Pick<
  MembershipCustodyDepartureProof,
  'actorUserId' | 'departingUserId' | 'departure'
> & {
  contention?: MembershipCustodyDepartureProof['contention']
}

export type MembershipLifecycleMode = 'CUSTODY' | 'MEMBERSHIP_ONLY'

export type MembershipLifecycleSocialProof = {
  listingId: string
  profiles: {
    owner: string
    players: [string, string]
    observer: string
  }
  observer: {
    userId: string
    profileId: string
    username: string
  }
  departures: [MembershipLifecycleDepartureProof, MembershipLifecycleDepartureProof]
}

async function collectPages<T>(
  load: (cursor: string | null) => Promise<{
    page: T[]
    isDone: boolean
    continueCursor: string
  }>
): Promise<T[]> {
  const rows: T[] = []
  const cursors = new Set<string>()
  let cursor: string | null = null
  while (true) {
    const page = await load(cursor)
    rows.push(...page.page)
    if (page.isDone) return rows
    assert.equal(cursors.has(page.continueCursor), false, 'Lifecycle cursor must advance.')
    cursors.add(page.continueCursor)
    cursor = page.continueCursor
  }
}

async function collectAuditPages(cohort: CampaignCustodyCohort): Promise<unknown[]> {
  const events: unknown[] = []
  const cursors = new Set<string>()
  let cursor: string | undefined
  while (true) {
    const page = await cohort.owner.query(api.campaigns.inventoryAudit.list, {
      campaignId: cohort.campaignId,
      limit: 8,
      ...(cursor ? { cursor } : {})
    })
    events.push(...page.events)
    if (page.nextCursor === null) return events
    assert.equal(cursors.has(page.nextCursor), false, 'Lifecycle audit cursor must advance.')
    cursors.add(page.nextCursor)
    cursor = page.nextCursor
  }
}

function usernameFor(prefix: string, userId: string) {
  const identity = userId.replaceAll('-', '')
  for (let end = identity.length; end >= 12; end--) {
    const candidate = `${prefix}${identity.slice(end - 12, end)}`
    if (validateUsername(candidate).message === null) return candidate
  }
  throw new Error('Fixture identity has no allowed username suffix.')
}

/**
 * Public lifecycle coordinator. The caller owns account creation, fixture cleanup and the final
 * custody receipt guard; this verifier only drives the settled Campaign and Social operations.
 */
export async function verifyCampaignMembershipLifecycle(
  cohort: CampaignCustodyCohort,
  observer: MembershipLifecycleObserver,
  onProfilesReady?: (profiles: MembershipLifecycleSocialProof['profiles']) => void | Promise<void>,
  onStage?: (stage: CampaignMembershipLifecycleStage) => void | Promise<void>,
  mode: MembershipLifecycleMode = 'CUSTODY'
): Promise<MembershipLifecycleSocialProof> {
  const { owner, campaignId } = cohort
  const [player0, player1] = cohort.players
  const [player0UserId, player1UserId] = cohort.playerUserIds
  const [player0CharacterId, player1CharacterId] = cohort.characterIds
  const ownerUsername = usernameFor('CustodyOwner', cohort.ownerUserId)
  const player0Username = usernameFor('CustodyPlayerA', player0UserId)
  const player1Username = usernameFor('CustodyPlayerB', player1UserId)
  const observerUsername = usernameFor('CustodyObserver', observer.userId)
  const playerAccounts = [player0, player1] as const

  for (const player of playerAccounts) player.client.setAuth(await player.fetchToken())
  observer.client.setAuth(await observer.fetchToken())
  const profileIds: string[] = []
  for (const [client, username] of [
    [owner, ownerUsername],
    [player0.client, player0Username],
    [player1.client, player1Username],
    [observer.client, observerUsername]
  ] as const) {
    await client.mutation(api.account.updateProfile, { username, bio: null })
    const profile = await client.mutation(api.social.profiles.initialize, {})
    assert.ok(profile.profilePublicId, 'Social profile initialization must return a profile ID.')
    profileIds.push(profile.profilePublicId)
    const preferences = await client.mutation(api.notifications.updatePreferences, {
      category: 'SOCIAL',
      inApp: true,
      email: false
    })
    assert.equal(preferences.social.email, false)
  }
  assert.equal((await observer.client.query(api.account.identity, {})).role, 'user')
  const [ownerProfileId, player0ProfileId, player1ProfileId, observerProfileId] = profileIds
  if (!ownerProfileId || !player0ProfileId || !player1ProfileId || !observerProfileId)
    throw new Error('Social profile setup is incomplete.')
  await onProfilesReady?.({
    owner: ownerProfileId,
    players: [player0ProfileId, player1ProfileId],
    observer: observerProfileId
  })

  const listingDraft = await owner.mutation(api.social.listingDrafts.create, {
    input: {
      campaignId,
      summary: 'Membership lifecycle proof table',
      audience: 'PUBLIC',
      systemId: (await owner.query(api.campaigns.queries.get, { id: campaignId })).gameSystemId,
      playMode: 'ONLINE',
      capacity: 2,
      schedule: {
        kind: 'FLEXIBLE',
        timeZone: 'Etc/UTC',
        summary: 'Agree a UTC session time'
      },
      location: null,
      expectations: {
        contentGuidance: 'Standard adventure content.',
        attendancePolicy: 'Tell the table when unavailable.',
        allowedContentRules: 'Campaign-shared and SRD content.',
        tableConduct: 'Be kind and collaborate.',
        contentBoundaries: 'Discuss boundaries before play.',
        safetyPractices: ['LINES_AND_VEILS'],
        safetyDetails: 'Pause and discuss when needed.'
      }
    }
  })
  const listing = await owner.mutation(api.social.listings.open, {
    listingPublicId: listingDraft.listingPublicId,
    expectedVersion: listingDraft.version
  })
  assert.equal(listing.status, 'OPEN')
  assert.equal(listing.capacity, 2)

  const readReplayState = async () => {
    const campaign = await owner.query(api.campaigns.queries.get, {
      id: campaignId
    })
    const vehicles = await collectPages((cursor) =>
      owner.query(api.campaigns.vehicles.list, {
        campaignId,
        paginationOpts: { cursor, numItems: 1 }
      })
    )
    const partyVersion = await owner.query(api.campaigns.inventoryOwners.version, {
      input: { campaignId, owner: { kind: 'CAMPAIGN', campaignId } }
    })
    const vehicleVersions = await Promise.all(
      vehicles.map(async (vehicle) => ({
        vehicleId: vehicle.id,
        version: (
          await owner.query(api.campaigns.inventoryOwners.version, {
            input: {
              campaignId,
              owner: { kind: 'VEHICLE', vehicleId: vehicle.id }
            }
          })
        ).version
      }))
    )
    const streams = await Promise.all(
      [player0CharacterId, player1CharacterId].map(async (characterId, index) => ({
        characterId,
        streamVersion:
          (await playerAccounts[index]!.client.query(api.characters.sheet.get, { id: characterId }))
            ?.meta.streamVersion ?? null
      }))
    )
    return {
      campaign,
      audit: await collectAuditPages(cohort),
      inventoryVersions: {
        party: partyVersion.version,
        vehicles: vehicleVersions
      },
      characterStreams: streams
    }
  }
  const member = async (userId: string) => {
    const campaign = await owner.query(api.campaigns.queries.get, {
      id: campaignId
    })
    const membership = campaign.memberships.find((entry) => entry.userId === userId)
    if (!membership) throw new Error('Expected active Campaign member is missing.')
    return { campaign, membership }
  }
  const verifyMembershipDeparture = async (
    playerIndex: 0 | 1,
    reason: MembershipCustodyDepartureReason
  ): Promise<MembershipLifecycleDepartureProof> => {
    const departingUserId = cohort.playerUserIds[playerIndex]
    const { campaign, membership } = await member(departingUserId)
    const base = {
      campaignId,
      expectedCampaignVersion: campaign.version,
      expectedMembershipAccessStartedAt: membership.accessStartedAt,
      commandId: randomUUID()
    }
    if (reason === 'MEMBER_LEFT') {
      assert.deepEqual(
        await cohort.players[playerIndex].client.mutation(
          api.campaigns.membershipDeparture.leave,
          base
        ),
        { ok: true }
      )
      return { actorUserId: departingUserId, departingUserId, departure: base }
    }
    const departure = { ...base, userId: departingUserId }
    assert.deepEqual(
      await owner.mutation(api.campaigns.membershipDeparture.removeMember, departure),
      { ok: true }
    )
    return {
      actorUserId: cohort.ownerUserId,
      departingUserId,
      departure
    }
  }
  const restoreAssignment = (playerIndex: 0 | 1) =>
    assert.doesNotReject(
      () =>
        cohort.players[playerIndex].client.mutation(api.campaigns.assignments.assign, {
          campaignId,
          characterId: cohort.characterIds[playerIndex]
        }),
      'Rejoined player ' +
        playerIndex +
        ' must be able to restore their acquired-equipment Character assignment.'
    )
  const replayDeparture = async (proof: MembershipLifecycleDepartureProof, playerIndex: 0 | 1) => {
    if ('userId' in proof.departure)
      return owner.mutation(api.campaigns.membershipDeparture.removeMember, proof.departure)
    return cohort.players[playerIndex].client.mutation(
      api.campaigns.membershipDeparture.leave,
      proof.departure
    )
  }

  await onStage?.('BEFORE_LEAVE')
  const departure0 =
    mode === 'CUSTODY'
      ? await verifyCampaignMembershipCustodyDeparture(cohort, 0, 'MEMBER_LEFT')
      : await verifyMembershipDeparture(0, 'MEMBER_LEFT')
  await onStage?.('AFTER_LEAVE')
  const afterLeave = await member(player1UserId)
  const invitation = await owner.mutation(api.social.invitations.create, {
    listingPublicId: listing.listingPublicId,
    expectedListingVersion: (
      await owner.query(api.social.listings.getOwned, {
        listingPublicId: listing.listingPublicId
      })
    ).version,
    username: player0Username
  })
  await player0.client.mutation(api.social.invitations.accept, {
    invitePublicId: invitation.invitePublicId,
    expectedVersion: invitation.version
  })
  const rejoined0 = await member(player0UserId)
  assert.ok(
    Date.parse(rejoined0.membership.accessStartedAt) >
      Date.parse(departure0.departure.expectedMembershipAccessStartedAt),
    'Rejoin must create a strictly newer membership epoch.'
  )
  await restoreAssignment(0)
  const replay0Before = await readReplayState()
  assert.deepEqual(await replayDeparture(departure0, 0), { ok: true })
  assert.deepEqual(await readReplayState(), replay0Before, 'Original leave replay must not write.')
  assert.equal(afterLeave.membership.userId, player1UserId)

  await onStage?.('AFTER_REJOIN_LEAVE')
  await onStage?.('BEFORE_REMOVE')
  const departure1 =
    mode === 'CUSTODY'
      ? await verifyCampaignMembershipCustodyDeparture(cohort, 1, 'MEMBER_REMOVED')
      : await verifyMembershipDeparture(1, 'MEMBER_REMOVED')
  await onStage?.('AFTER_REMOVE')
  const invitation1 = await owner.mutation(api.social.invitations.create, {
    listingPublicId: listing.listingPublicId,
    expectedListingVersion: (
      await owner.query(api.social.listings.getOwned, {
        listingPublicId: listing.listingPublicId
      })
    ).version,
    username: player1Username
  })
  await player1.client.mutation(api.social.invitations.accept, {
    invitePublicId: invitation1.invitePublicId,
    expectedVersion: invitation1.version
  })
  const rejoined1 = await member(player1UserId)
  assert.ok(
    Date.parse(rejoined1.membership.accessStartedAt) >
      Date.parse(departure1.departure.expectedMembershipAccessStartedAt),
    'Removal rejoin must create a strictly newer membership epoch.'
  )
  await restoreAssignment(1)
  const replay1Before = await readReplayState()
  assert.deepEqual(await replayDeparture(departure1, 1), { ok: true })
  assert.deepEqual(
    await readReplayState(),
    replay1Before,
    'Original removal replay must not write.'
  )

  await onStage?.('AFTER_REJOIN_REMOVE')
  const beforeForwardTransfer = await owner.query(api.campaigns.queries.get, {
    id: campaignId
  })
  const beforeOwnerEpoch = beforeForwardTransfer.memberships.find(
    (entry) => entry.userId === cohort.ownerUserId
  )?.accessStartedAt
  const beforePlayer0Epoch = beforeForwardTransfer.memberships.find(
    (entry) => entry.userId === player0UserId
  )?.accessStartedAt
  if (!beforeOwnerEpoch || !beforePlayer0Epoch)
    throw new Error('Ownership transfer members are missing.')
  await owner.mutation(api.campaigns.ownership.request, {
    campaignId,
    recipientUserId: player0UserId
  })
  const player0Owned = await player0.client.mutation(api.campaigns.ownership.accept, { campaignId })
  assert.equal(player0Owned.role, 'OWNER')
  const afterForwardTransfer = await player0.client.query(api.campaigns.queries.get, {
    id: campaignId
  })
  const forwardOwner = afterForwardTransfer.memberships.find(
    (entry) => entry.userId === player0UserId
  )
  const forwardFormerOwner = afterForwardTransfer.memberships.find(
    (entry) => entry.userId === cohort.ownerUserId
  )
  assert.equal(forwardOwner?.role, 'OWNER')
  assert.equal(forwardFormerOwner?.role, 'PLAYER')
  // The new GM keeps playing their Character (CAMPAIGN-7).
  assert.equal(forwardOwner?.assignedCharacter?.id, player0CharacterId)
  assert.ok(
    Date.parse(forwardOwner?.accessStartedAt ?? '') > Date.parse(beforePlayer0Epoch) &&
      Date.parse(forwardFormerOwner?.accessStartedAt ?? '') > Date.parse(beforeOwnerEpoch),
    'Ownership transfer must advance both role epochs.'
  )
  const closedListing = await player0.client.query(api.social.listings.getOwned, {
    listingPublicId: listing.listingPublicId
  })
  assert.equal(closedListing.status, 'CLOSED')
  await assert.rejects(
    () =>
      owner.query(api.campaigns.characterSheet.get, {
        campaignId,
        characterId: player1CharacterId
      }),
    /Assigned Character not found/i
  )
  assert.ok(
    await player0.client.query(api.campaigns.characterSheet.get, {
      campaignId,
      characterId: player1CharacterId
    })
  )
  assert.equal(
    await player0.client.query(api.characters.builder.activeCharacter, {
      id: player1CharacterId
    }),
    null,
    'Campaign ownership must not widen personal Builder access.'
  )
  await assert.rejects(
    () => player0.client.mutation(api.campaigns.ownership.accept, { campaignId }),
    /invalid|expired/i
  )

  await onStage?.('AFTER_FORWARD_TRANSFER')
  await player0.client.mutation(api.campaigns.ownership.request, {
    campaignId,
    recipientUserId: cohort.ownerUserId
  })
  const ownerRestored = await owner.mutation(api.campaigns.ownership.accept, {
    campaignId
  })
  assert.equal(ownerRestored.role, 'OWNER')
  await assert.rejects(
    () => owner.mutation(api.campaigns.ownership.accept, { campaignId }),
    /invalid|expired/i
  )
  const finalCampaign = await owner.query(api.campaigns.queries.get, {
    id: campaignId
  })
  const finalOwner = finalCampaign.memberships.find((entry) => entry.userId === cohort.ownerUserId)
  const finalPlayer0 = finalCampaign.memberships.find((entry) => entry.userId === player0UserId)
  if (!finalOwner || !finalPlayer0) throw new Error('Ownership restoration members are missing.')
  assert.equal(finalOwner.role, 'OWNER')
  assert.equal(finalPlayer0.role, 'PLAYER')
  assert.ok(
    Date.parse(finalOwner.accessStartedAt) >
      Date.parse(forwardFormerOwner?.accessStartedAt ?? '') &&
      Date.parse(finalPlayer0.accessStartedAt) > Date.parse(forwardOwner?.accessStartedAt ?? ''),
    'Ownership restoration must advance both role epochs again.'
  )
  await restoreAssignment(0)
  const settled = await owner.query(api.campaigns.queries.get, {
    id: campaignId
  })
  assert.deepEqual(
    settled.memberships.map((entry) => entry.userId).sort(),
    [cohort.ownerUserId, player0UserId, player1UserId].sort()
  )
  assert.equal(
    settled.memberships.find((entry) => entry.userId === cohort.ownerUserId)?.role,
    'OWNER'
  )
  for (const [userId, characterId] of [
    [player0UserId, player0CharacterId],
    [player1UserId, player1CharacterId]
  ] as const)
    assert.equal(
      settled.memberships.find((entry) => entry.userId === userId)?.assignedCharacter?.id,
      characterId
    )

  await onStage?.('AFTER_RESTORE_TRANSFER')

  return {
    listingId: listing.listingPublicId,
    profiles: {
      owner: ownerProfileId,
      players: [player0ProfileId, player1ProfileId],
      observer: observerProfileId
    },
    observer: {
      userId: observer.userId,
      profileId: observerProfileId,
      username: observerUsername
    },
    departures: [departure0, departure1]
  }
}
