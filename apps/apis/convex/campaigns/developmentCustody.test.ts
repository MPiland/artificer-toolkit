// @vitest-environment node
import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  verifyCampaignCustody,
  verifyCharacterCustody,
  type CampaignCustodyCohort
} from '../../tests/developmentCampaignCustody'
import { verifyCampaignInventory } from '../../tests/developmentCampaignInventory'
import { verifyCampaignAuthoredCustodyDeletion } from '../../tests/developmentCampaignAuthoredCustodyDeletion'
import { verifyCampaignCurrencyLifecycle } from '../../tests/developmentCampaignCurrencyLifecycle'
import { verifyCampaignAssignmentLifecycle } from '../../tests/developmentCampaignAssignmentLifecycle'
import { backgroundAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/background'
import { characterBuilderResolveInputSchema } from '@artificer-toolkit/schema/api/characterBuilderQueries'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { verifyCampaignMembershipLifecycle } from '../../tests/developmentCampaignMembershipLifecycle'
import { importedSubject } from '../../tests/fixtures/publication'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import { backpack } from '@artificer-toolkit/source-data/srd/equipment/backpack.js'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  joinCharacterPlay,
  readCharacterRecord,
  readCharacterRow
} from '../characters/stateDocuments'
import { api, components, internal } from '../_generated/api'
import { writeCharacterRecord } from '../../tests/fixtures/characterRecords'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { convexDevelopmentClient } from '../../tests/fixtures/convexDevelopmentClient'

afterEach(() => vi.useRealTimers())

const create = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const admit = makeFunctionReference<
  'mutation',
  { ownerUserId: string; playerUserIds: string[]; campaignId: string },
  null
>('campaigns/developmentCustody:admitFixturePlayers')
const remove = makeFunctionReference<
  'mutation',
  {
    ownerUserId: string
    playerUserIds: string[]
    characterIds: string[]
    campaignId: string
  },
  null
>('campaigns/developmentCustody:removeFixtureState')

async function markFixtureAccount(
  base: Awaited<ReturnType<typeof readySheetFixture>>,
  userId: string,
  suffix: string
) {
  await base.t.run(async (ctx) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
    if (!profile) throw new Error('Fixture profile is unavailable.')
    await ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: 'user',
        where: [{ field: '_id', value: profile.authUserId }],
        update: { email: `draft_123456abcde${suffix}@example.invalid` }
      }
    })
  })
}

async function setup() {
  const base = await readySheetFixture()
  await markFixtureAccount(base, base.other.userId, '0')
  await markFixtureAccount(base, base.owner.userId, '1')
  const campaign = await base.other.caller.mutation(create, {
    name: 'Encounter execution fixture',
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
  await base.other.caller.mutation(api.campaigns.assignments.assign, {
    campaignId: campaign.id,
    characterId: base.character.id
  })
  return { ...base, campaign }
}

async function addSecondPlayer(base: Awaited<ReturnType<typeof setup>>) {
  const user = await base.t.run(async (ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'user',
        data: {
          name: 'Second',
          email: 'second@example.invalid',
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      },
      onCreateHandle: await createFunctionHandle(internal.auth.onCreate)
    })
  )
  const session = await base.t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'session',
        data: {
          userId: user._id,
          token: crypto.randomUUID(),
          expiresAt: Date.now() + 60_000,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    })
  )
  const caller = base.t.withIdentity({
    subject: user._id,
    sessionId: session._id
  })
  const identity = await caller.query(api.account.identity, {})
  if (!identity) throw new Error('Fixture second-player identity is unavailable.')
  const draft = await base.createCharacter()
  const committed = await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.draft.id,
    mode: 'create',
    character: draft.character
  })
  await markFixtureAccount(base, identity.userId, '2')
  await base.t.run(async (ctx) => {
    const record = await readCharacterRow(ctx, committed.character.id)
    const route = await ctx.db
      .query('authoredRouteIds')
      .withIndex('by_subjectId', (q) => q.eq('subjectId', committed.character.id))
      .unique()
    if (!record || !route) throw new Error('Fixture second-player Character is unavailable.')
    await writeCharacterRecord(ctx, record, {
      document: readCharacterRecord(record),
      userId: identity.userId
    })
    await ctx.db.patch(route._id, { ownerUserId: identity.userId })
  })
  return {
    userId: identity.userId,
    characterId: committed.character.id,
    caller
  }
}

async function addObserver(base: Awaited<ReturnType<typeof setup>>) {
  const user = await base.t.run(async (ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'user',
        data: {
          name: 'Observer',
          email: 'observer@example.invalid',
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      },
      onCreateHandle: await createFunctionHandle(internal.auth.onCreate)
    })
  )
  const session = await base.t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'session',
        data: {
          userId: user._id,
          token: crypto.randomUUID(),
          expiresAt: Date.now() + 60_000,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    })
  )
  const caller = base.t.withIdentity({
    subject: user._id,
    sessionId: session._id
  })
  const identity = await caller.query(api.account.identity, {})
  if (!identity) throw new Error('Fixture observer identity is unavailable.')
  await markFixtureAccount(base, identity.userId, '3')
  return { userId: identity.userId, caller }
}
function input(
  base: Awaited<ReturnType<typeof setup>>,
  second: Awaited<ReturnType<typeof addSecondPlayer>>
) {
  return {
    ownerUserId: base.other.userId,
    playerUserIds: [base.owner.userId, second.userId],
    characterIds: [base.character.id, second.characterId],
    campaignId: base.campaign.id
  }
}

async function readScoped(base: Awaited<ReturnType<typeof setup>>) {
  return base.t.run(async (ctx) => ({
    events: await ctx.db
      .query('campaignEvents')
      .withIndex('by_campaignId_id', (q) => q.eq('campaignId', base.campaign.id))
      .collect(),
    vehicles: await ctx.db
      .query('campaignVehicles')
      .withIndex('by_campaignId_id', (q) => q.eq('campaignId', base.campaign.id))
      .collect(),
    balances: await ctx.db
      .query('campaignPartyCurrencies')
      .withIndex('by_campaignId_vehicleId_id', (q) => q.eq('campaignId', base.campaign.id))
      .collect(),
    inventories: await ctx.db
      .query('campaignPartyInventories')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
      .collect(),
    memberships: await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) => q.eq('campaignId', base.campaign.id))
      .collect(),
    assignments: await ctx.db
      .query('campaignCharacterAssignments')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
      .collect(),
    items: await ctx.db
      .query('campaignPartyItems')
      .withIndex('by_campaignId_id', (q) => q.eq('campaignId', base.campaign.id))
      .collect(),
    groups: await ctx.db
      .query('campaignPartyCurrencyGroups')
      .withIndex('by_campaignId_id', (q) => q.eq('campaignId', base.campaign.id))
      .collect(),
    characters: await Promise.all(
      (await ctx.db.query('characters').collect()).map((row) => joinCharacterPlay(ctx, row))
    ),
    authoredRoots: await ctx.db.query('authoredRoots').collect(),
    authoredDrafts: await ctx.db.query('authoredDrafts').collect(),
    currencySystems: await ctx.db
      .query('campaignCurrencySystems')
      .withIndex('by_campaignId_id', (q) => q.eq('campaignId', base.campaign.id))
      .collect(),
    denominations: await ctx.db
      .query('campaignCurrencyDenominations')
      .withIndex('by_campaignId_id', (q) => q.eq('campaignId', base.campaign.id))
      .collect(),
    overlays: await ctx.db
      .query('campaignCharacterStates')
      .withIndex('by_campaignId_characterId', (q) => q.eq('campaignId', base.campaign.id))
      .collect(),
    campaign: await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
      .unique()
  }))
}

/** One Campaign with two Players, both Characters assigned, and the cart and backpack imported. */
async function mixedCohort() {
  const base = await setup()
  const second = await addSecondPlayer(base)
  await base.t.mutation(admit, {
    ownerUserId: base.other.userId,
    playerUserIds: [base.owner.userId, second.userId],
    campaignId: base.campaign.id
  })
  await second.caller.mutation(api.campaigns.assignments.assign, {
    campaignId: base.campaign.id,
    characterId: second.characterId
  })
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({ subjectKind: 'VEHICLE', ...cart, document: cart }),
      importedSubject({
        subjectKind: 'EQUIPMENT',
        ...backpack,
        document: backpack
      })
    ]
  })
  const client = convexDevelopmentClient
  const cohort: CampaignCustodyCohort = {
    owner: client(base.other.caller),
    ownerUserId: base.other.userId,
    players: [
      {
        client: { ...client(base.owner.caller), setAuth: () => {} },
        fetchToken: async () => ''
      },
      {
        client: { ...client(second.caller), setAuth: () => {} },
        fetchToken: async () => ''
      }
    ],
    playerUserIds: [base.owner.userId, second.userId],
    characterIds: [base.character.id, second.characterId],
    campaignId: base.campaign.id
  }
  return { base, second, cohort, anonymous: client(base.t) }
}

/** The unshare evacuation event of the given kind, for tampering. */
function evacuationEvent(
  events: Awaited<ReturnType<typeof readScoped>>['events'],
  kind: 'immediate' | 'durable'
) {
  const found = events.find((event) => {
    if (event.type !== 'CAMPAIGN_VEHICLE_EVACUATED') return false
    const payload: unknown = JSON.parse(event.payloadJson)
    return (
      payload !== null &&
      typeof payload === 'object' &&
      (kind === 'durable' ? 'jobId' in payload : 'formerCampaignVehicleId' in payload)
    )
  })
  if (!found) throw new Error(`Public driver ${kind} evacuation receipt is missing.`)
  return found
}

/** Tamper the event's payload with a fresh removal identity, prove removal refuses, restore it. */
async function expectTamperedEvacuationRefused(
  base: Awaited<ReturnType<typeof setup>>,
  second: Awaited<ReturnType<typeof addSecondPlayer>>,
  evacuation: ReturnType<typeof evacuationEvent>,
  refusal: string,
  before: Awaited<ReturnType<typeof readScoped>>
) {
  const payload: unknown = JSON.parse(evacuation.payloadJson)
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload))
    throw new Error('Public driver evacuation payload is invalid.')
  await base.t.run((ctx) =>
    ctx.db.patch(evacuation._id, {
      payloadJson: JSON.stringify({
        ...payload,
        removalEventId: crypto.randomUUID()
      })
    })
  )
  const tampered = await readScoped(base)
  await expect(base.t.mutation(remove, input(base, second))).rejects.toThrow(refusal)
  expect(await readScoped(base)).toEqual(tampered)
  await base.t.run((ctx) => ctx.db.patch(evacuation._id, { payloadJson: evacuation.payloadJson }))
  expect(await readScoped(base)).toEqual(before)
}

describe('development custody fixture cleanup', () => {
  it('executes the actual currency lifecycle with authorized Vehicle returns and bounded exact cleanup', async () => {
    // The full public journey can outlive the fixture's one-minute auth session on constrained hosts.
    vi.useFakeTimers({ toFake: ['Date'] })
    const base = await setup()
    const second = await addSecondPlayer(base)
    await base.t.mutation(admit, {
      ownerUserId: base.other.userId,
      playerUserIds: [base.owner.userId, second.userId],
      campaignId: base.campaign.id
    })
    await second.caller.mutation(api.campaigns.assignments.assign, {
      campaignId: base.campaign.id,
      characterId: second.characterId
    })
    await base.t.mutation(internal.content.import.importSubjects, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [
        importedSubject({ subjectKind: 'VEHICLE', ...cart, document: cart }),
        importedSubject({
          subjectKind: 'EQUIPMENT',
          ...backpack,
          document: backpack
        })
      ]
    })
    const client = convexDevelopmentClient
    const anonymous = convexDevelopmentClient(base.t)
    const proof = await verifyCampaignCurrencyLifecycle(
      {
        owner: client(base.other.caller),
        ownerUserId: base.other.userId,
        players: [
          {
            client: { ...client(base.owner.caller), setAuth: () => {} },
            fetchToken: async () => ''
          },
          {
            client: { ...client(second.caller), setAuth: () => {} },
            fetchToken: async () => ''
          }
        ],
        playerUserIds: [base.owner.userId, second.userId],
        characterIds: [base.character.id, second.characterId],
        campaignId: base.campaign.id
      },
      anonymous
    )
    expect(proof.finalSystems).toEqual([])
    expect(proof.zeroGroups).toHaveLength(3)
    expect(proof.zeroGroups.every((unit) => unit.groupIds.length > 0)).toBe(true)
    await base.t.mutation(remove, input(base, second))
    const after = await readScoped(base)
    expect(after.currencySystems).toEqual([])
    expect(after.vehicles).toEqual([])
    expect(after.events).toEqual([])
  }, 120000)

  it('runs public assignment replacement and unassignment, rejecting tampered lifecycle receipts before cleanup', async () => {
    const base = await setup()
    const second = await addSecondPlayer(base)
    await base.t.mutation(admit, {
      ownerUserId: base.other.userId,
      playerUserIds: [base.owner.userId, second.userId],
      campaignId: base.campaign.id
    })
    await second.caller.mutation(api.campaigns.assignments.assign, {
      campaignId: base.campaign.id,
      characterId: second.characterId
    })
    await base.t.mutation(internal.content.import.importSubjects, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [importedSubject({ subjectKind: 'EQUIPMENT', ...backpack, document: backpack })]
    })
    const duplicated = await second.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'BACKGROUND',
      subjectId: acolyte.id
    })
    const background = backgroundAuthoredDtoSchema.parse(duplicated.payload)
    const saved = await second.caller.mutation(api.content.drafts.save, {
      subjectKind: 'BACKGROUND',
      subjectId: duplicated.subjectId,
      systemId: duplicated.systemId,
      label: 'Assignment shared background',
      payload: { ...background, label: 'Assignment shared background' }
    })
    await second.caller.mutation(api.content.publication.publishDraft, {
      subjectKind: 'BACKGROUND',
      subjectId: duplicated.subjectId,
      expectedDraftUpdatedAt: saved.updatedAt!
    })
    const secondActive = await second.caller.query(api.characters.builder.activeCharacter, {
      id: second.characterId
    })
    if (!secondActive) throw new Error('Second active Character is unavailable.')
    const secondDraft = await second.caller.mutation(api.characters.drafts.create, {
      id: second.characterId,
      systemId: secondActive.systemId
    })
    const secondCandidate = characterBuilderResolveInputSchema.parse({
      expectedDraftId: secondDraft.id,
      mode: 'edit',
      character: {
        ...secondDraft.payload.character,
        intent: {
          ...secondActive.intent,
          background: { backgroundId: duplicated.subjectId },
          startingEquipment: {
            ...secondActive.intent.startingEquipment,
            background: {
              source: 'BACKGROUND',
              tookGold: false,
              applied: true,
              groups: background.startingEquipment!.sets.flatMap((set) =>
                set.groups.map((group) => ({
                  groupId: group.id,
                  optionId: group.options[0]!.id
                }))
              )
            }
          }
        }
      }
    })
    const staleCandidate = {
      ...secondCandidate,
      character: {
        ...secondCandidate.character,
        intent: {
          ...secondCandidate.character.intent,
          startingEquipment: secondActive.intent.startingEquipment
        }
      }
    }
    await expect(
      second.caller.mutation(api.characters.commit.commit, staleCandidate)
    ).rejects.toThrow('not ready')
    const changedSecond = await second.caller.mutation(
      api.characters.commit.commit,
      secondCandidate
    )
    expect(changedSecond.character.state).toEqual(secondActive.state)
    const replacement = await base.createCharacter()
    const committed = await base.owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: replacement.draft.id,
      mode: 'create',
      character: replacement.character
    })
    const client = convexDevelopmentClient
    const anonymous = convexDevelopmentClient(base.t)
    await verifyCampaignAssignmentLifecycle(
      {
        owner: client(base.other.caller),
        ownerUserId: base.other.userId,
        players: [
          {
            client: { ...client(base.owner.caller), setAuth: () => {} },
            fetchToken: async () => ''
          },
          { client: { ...client(second.caller), setAuth: () => {} }, fetchToken: async () => '' }
        ],
        playerUserIds: [base.owner.userId, second.userId],
        characterIds: [base.character.id, second.characterId],
        campaignId: base.campaign.id
      },
      anonymous,
      committed.character.id
    )
    const before = await readScoped(base)
    const reconciliation = before.events.find(
      (event) =>
        event.type === 'CAMPAIGN_CHARACTER_RECONCILED' &&
        (JSON.parse(event.payloadJson) as { reason: string }).reason === 'CHARACTER_REPLACED'
    )
    const custody = before.events.find(
      (event) =>
        event.type === 'CUSTODY_TRANSFER' &&
        (JSON.parse(event.payloadJson) as { reason: string }).reason === 'CHARACTER_UNASSIGNED'
    )
    const adjustment = before.events.find((event) => event.type === 'CAMPAIGN_ADJUSTMENT_SAVED')
    if (!reconciliation || !custody || !adjustment)
      throw new Error('Actual lifecycle receipt catalogue is incomplete.')
    for (const event of [reconciliation, custody, adjustment]) {
      await base.t.run((ctx) => ctx.db.patch(event._id, { actorUserId: second.userId }))
      const tampered = await readScoped(base)
      await expect(base.t.mutation(remove, input(base, second))).rejects.toThrow(
        /Fixture assignment/
      )
      expect(await readScoped(base)).toEqual(tampered)
      await base.t.run((ctx) => ctx.db.patch(event._id, { actorUserId: event.actorUserId }))
      expect(await readScoped(base)).toEqual(before)
    }
    const raw: unknown = JSON.parse(reconciliation.payloadJson)
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      throw new Error('Actual reconciliation payload is invalid.')
    const active = before.characters.find((row) => row.id === base.character.id)
    if (!active) throw new Error('Repaired original Character is unavailable.')
    await base.t.run((ctx) =>
      ctx.db.patch(reconciliation._id, {
        payloadJson: JSON.stringify({ ...raw, streamVersion: active.play.streamVersion + 1 })
      })
    )
    const tamperedVersion = await readScoped(base)
    await expect(base.t.mutation(remove, input(base, second))).rejects.toThrow(
      'assignment Character reconciliation receipt mismatch'
    )
    expect(await readScoped(base)).toEqual(tamperedVersion)
    await base.t.run((ctx) =>
      ctx.db.patch(reconciliation._id, { payloadJson: reconciliation.payloadJson })
    )
    await base.t.mutation(remove, input(base, second))
    const after = await readScoped(base)
    expect(after.events).toEqual([])
    expect(after.items).toEqual([])
    expect(after.balances).toEqual([])
    expect(after.characters).toEqual(before.characters)
    expect(after.assignments.map((row) => row.characterId)).toEqual([base.character.id])
    expect(after.characters.some((row) => row.id === committed.character.id)).toBe(true)
  }, 120000)

  it('recognizes actual public authored deletion receipts and rejects tampered provenance before cleanup', async () => {
    const base = await setup()
    const second = await addSecondPlayer(base)
    await base.t.mutation(admit, {
      ownerUserId: base.other.userId,
      playerUserIds: [base.owner.userId, second.userId],
      campaignId: base.campaign.id
    })
    await second.caller.mutation(api.campaigns.assignments.assign, {
      campaignId: base.campaign.id,
      characterId: second.characterId
    })
    await base.t.mutation(internal.content.import.importSubjects, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [
        importedSubject({ subjectKind: 'VEHICLE', ...cart, document: cart }),
        importedSubject({
          subjectKind: 'EQUIPMENT',
          ...backpack,
          document: backpack
        })
      ]
    })
    const client = convexDevelopmentClient
    const anonymous = convexDevelopmentClient(base.t)
    const proof = await verifyCampaignAuthoredCustodyDeletion(
      {
        owner: client(base.other.caller),
        ownerUserId: base.other.userId,
        players: [
          {
            client: { ...client(base.owner.caller), setAuth: () => {} },
            fetchToken: async () => ''
          },
          {
            client: { ...client(second.caller), setAuth: () => {} },
            fetchToken: async () => ''
          }
        ],
        playerUserIds: [base.owner.userId, second.userId],
        characterIds: [base.character.id, second.characterId],
        campaignId: base.campaign.id
      },
      anonymous
    )
    const before = await readScoped(base)
    const parent = before.events.find((event) => event.id === proof.vehicleRemoval.eventId)
    if (!parent) throw new Error('Actual authored Vehicle deletion parent is unavailable.')
    await base.t.run((ctx) => ctx.db.patch(parent._id, { actorUserId: second.userId }))
    const tamperedActor = await readScoped(base)
    await expect(base.t.mutation(remove, input(base, second))).rejects.toThrow(
      'authored deletion receipt mismatch'
    )
    expect(await readScoped(base)).toEqual(tamperedActor)
    await base.t.run((ctx) => ctx.db.patch(parent._id, { actorUserId: parent.actorUserId }))
    expect(await readScoped(base)).toEqual(before)
    const draft = before.authoredDrafts.find((record) => record.subjectId === proof.equipmentId)
    if (!draft) throw new Error('Actual deleted Equipment retained draft is unavailable.')
    await base.t.run((ctx) => ctx.db.patch(draft._id, { userId: second.userId }))
    const tamperedDraft = await readScoped(base)
    await expect(base.t.mutation(remove, input(base, second))).rejects.toThrow(
      'authored deletion draft ownership mismatch'
    )
    expect(await readScoped(base)).toEqual(tamperedDraft)
    await base.t.run((ctx) => ctx.db.patch(draft._id, { userId: draft.userId }))
    expect(await readScoped(base)).toEqual(before)
    const actualEvacuation = proof.evacuationEvents[0]
    if (!actualEvacuation)
      throw new Error('Actual authored deletion evacuation proof is unavailable.')
    const child = before.events.find((event) => event.id === actualEvacuation.id)
    if (!child) throw new Error('Actual authored deletion evacuation event is unavailable.')
    const payload: unknown = JSON.parse(child.payloadJson)
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload))
      throw new Error('Actual authored deletion evacuation payload is invalid.')
    await base.t.run((ctx) =>
      ctx.db.patch(child._id, {
        payloadJson: JSON.stringify({
          ...payload,
          removalEventId: crypto.randomUUID()
        })
      })
    )
    const tamperedChild = await readScoped(base)
    await expect(base.t.mutation(remove, input(base, second))).rejects.toThrow(
      'evacuation identity mismatch'
    )
    expect(await readScoped(base)).toEqual(tamperedChild)
    await base.t.run((ctx) => ctx.db.patch(child._id, { payloadJson: child.payloadJson }))
    expect(await readScoped(base)).toEqual(before)
    await expect(base.t.mutation(remove, input(base, second))).resolves.toBeNull()
    const after = await readScoped(base)
    expect(after.items).toEqual([])
    expect(after.events).toEqual([])
    expect(after.vehicles).toEqual([])
    expect(after.balances).toEqual([])
    expect(after.inventories).toEqual([])
    expect(after.authoredDrafts).toEqual(before.authoredDrafts)
    expect(after.assignments.map((row) => row.characterId)).toEqual([base.character.id])
  }, 30000)

  it('runs the public mixed Character custody driver and validates historical Vehicle removal before cleanup', async () => {
    const { base, second, cohort, anonymous } = await mixedCohort()
    await verifyCampaignCustody(cohort, anonymous, false)
    const before = await readScoped(base)
    const lifecycle = before.events.find((event) => event.type === 'VEHICLE_LIFECYCLE')
    if (!lifecycle) throw new Error('Public driver lifecycle receipt is missing.')
    await base.t.run((ctx) => ctx.db.patch(lifecycle._id, { actorUserId: second.userId }))
    const tamperedLifecycle = await readScoped(base)
    await expect(base.t.mutation(remove, input(base, second))).rejects.toThrow(
      'lifecycle audit mismatch'
    )
    expect(await readScoped(base)).toEqual(tamperedLifecycle)
    await base.t.run((ctx) => ctx.db.patch(lifecycle._id, { actorUserId: lifecycle.actorUserId }))
    expect(await readScoped(base)).toEqual(before)
    await expectTamperedEvacuationRefused(
      base,
      second,
      evacuationEvent(before.events, 'immediate'),
      'Vehicle evacuation identity mismatch',
      before
    )
    await expect(base.t.mutation(remove, input(base, second))).resolves.toBeNull()
    const after = await readScoped(base)
    expect(after.items).toEqual([])
    expect(after.events).toEqual([])
    expect(after.vehicles).toEqual([])
    expect(after.balances).toEqual([])
    expect(after.inventories).toEqual([])
    expect(after.assignments.map((row) => row.characterId)).toEqual([base.character.id])
  }, 30000)

  it('validates a durable bounded Vehicle cleanup receipt and pages the Character custody driver before removing the cohort', async () => {
    const { base, second, cohort, anonymous } = await mixedCohort()
    await verifyCampaignInventory({
      owner: cohort.owner,
      player: cohort.players[0].client,
      anonymous,
      campaignId: cohort.campaignId
    })
    // The bounded cleanup leaves the party more rows than one inventory page, which is what makes the
    // driver's cursor-advance assertions run.
    const firstPartyPage = await cohort.owner.query(api.campaigns.partyInventory.items, {
      campaignId: cohort.campaignId,
      paginationOpts: { cursor: null, numItems: 8 }
    })
    expect(firstPartyPage.isDone).toBe(false)
    await verifyCharacterCustody(cohort)
    const before = await readScoped(base)
    await expectTamperedEvacuationRefused(
      base,
      second,
      evacuationEvent(before.events, 'durable'),
      'durable Vehicle evacuation receipt mismatch',
      before
    )
    await expect(base.t.mutation(remove, input(base, second))).resolves.toBeNull()
    const after = await readScoped(base)
    expect(after.items).toEqual([])
    expect(after.events).toEqual([])
    expect(after.vehicles).toEqual([])
    expect(after.balances).toEqual([])
    expect(after.inventories).toEqual([])
    expect(after.assignments.map((row) => row.characterId)).toEqual([base.character.id])
  }, 30000)

  it('admits the exact cohort and removes validated inventory while retaining the first player and both Characters', async () => {
    const base = await setup()
    const second = await addSecondPlayer(base)
    await expect(
      base.t.mutation(admit, {
        ownerUserId: base.other.userId,
        playerUserIds: [base.owner.userId, second.userId],
        campaignId: base.campaign.id
      })
    ).resolves.toBeNull()
    const departedAt = new Date(Date.parse(base.campaign.createdAt) + 1000).toISOString()
    await base.t.run(async (ctx) => {
      const membership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', base.campaign.id).eq('userId', second.userId)
        )
        .unique()
      if (!membership) throw new Error('Second-player membership is unavailable.')
      await ctx.db.patch(membership._id, { status: 'LEFT', leftAt: departedAt })
    })
    await expect(
      base.t.mutation(admit, {
        ownerUserId: base.other.userId,
        playerUserIds: [base.owner.userId, second.userId],
        campaignId: base.campaign.id
      })
    ).resolves.toBeNull()
    const restoredMembership = (await readScoped(base)).memberships.find(
      (membership) => membership.userId === second.userId
    )
    expect(Date.parse(restoredMembership?.accessStartedAt ?? '')).toBeGreaterThan(
      Date.parse(departedAt)
    )
    expect(restoredMembership?.joinedAt).toBe(restoredMembership?.accessStartedAt)
    expect(restoredMembership?.leftAt).toBeNull()
    await base.t.run(async (ctx) => {
      await ctx.db.insert('campaignCharacterAssignments', {
        campaignId: base.campaign.id,
        characterId: second.characterId,
        userId: second.userId,
        assignedAt: new Date().toISOString()
      })
      await ctx.db.insert('campaignPartyInventories', {
        campaignId: base.campaign.id,
        version: 4
      })
      const containerId = crypto.randomUUID()
      await ctx.db.insert('campaignPartyItems', {
        campaignId: base.campaign.id,
        id: containerId,
        equipmentId: crypto.randomUUID(),
        quantity: 1,
        containerId: null
      })
      for (let index = 0; index < 49; index++)
        await ctx.db.insert('campaignPartyCurrencyGroups', {
          campaignId: base.campaign.id,
          id: crypto.randomUUID(),
          containerId
        })
    })
    await expect(base.t.mutation(remove, input(base, second))).resolves.toBeNull()
    const after = await readScoped(base)
    expect(after.items).toEqual([])
    expect(after.groups).toEqual([])
    expect(after.assignments).toHaveLength(1)
    expect(after.assignments[0]?.characterId).toBe(base.character.id)
    expect(new Set(after.memberships.map((row) => row.userId))).toEqual(
      new Set([base.other.userId, base.owner.userId])
    )
    await expect(
      base.t.run((ctx) =>
        ctx.db
          .query('characters')
          .withIndex('by_publicId', (q) => q.eq('id', second.characterId))
          .unique()
      )
    ).resolves.not.toBeNull()
  })

  it('fails before deletion for an unexpected member, malformed container placement, and excess groups', async () => {
    const base = await setup()
    const second = await addSecondPlayer(base)
    await base.t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: base.campaign.id,
        userId: base.other.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: base.campaign.createdAt,
        joinedAt: base.campaign.createdAt,
        leftAt: null
      })
    )
    const duplicateOwner = await readScoped(base)
    await expect(
      base.t.mutation(admit, {
        ownerUserId: base.other.userId,
        playerUserIds: [base.owner.userId, second.userId],
        campaignId: base.campaign.id
      })
    ).rejects.toThrow('owner identity mismatch')
    expect(await readScoped(base)).toEqual(duplicateOwner)
    await base.t.run(async (ctx) => {
      const duplicate = (
        await ctx.db
          .query('campaignMemberships')
          .withIndex('by_campaignId_userId', (q) => q.eq('campaignId', base.campaign.id))
          .collect()
      ).find((row) => row.userId === base.other.userId && row.role === 'PLAYER')
      if (!duplicate) throw new Error('Duplicate owner fixture membership is unavailable.')
      await ctx.db.delete(duplicate._id)
    })
    await base.t.mutation(admit, {
      ownerUserId: base.other.userId,
      playerUserIds: [base.owner.userId, second.userId],
      campaignId: base.campaign.id
    })
    await base.t.run(async (ctx) => {
      await ctx.db.insert('campaignCharacterAssignments', {
        campaignId: base.campaign.id,
        characterId: second.characterId,
        userId: second.userId,
        assignedAt: new Date().toISOString()
      })
      await ctx.db.insert('campaignPartyItems', {
        campaignId: base.campaign.id,
        id: crypto.randomUUID(),
        equipmentId: crypto.randomUUID(),
        quantity: 1,
        containerId: crypto.randomUUID()
      })
    })
    const malformed = await readScoped(base)
    await expect(base.t.mutation(remove, input(base, second))).rejects.toThrow('placement mismatch')
    expect(await readScoped(base)).toEqual(malformed)
    await base.t.run(async (ctx) => {
      for (const row of await ctx.db
        .query('campaignPartyItems')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', base.campaign.id))
        .collect())
        await ctx.db.delete(row._id)
      for (let index = 0; index < 101; index++)
        await ctx.db.insert('campaignPartyCurrencyGroups', {
          campaignId: base.campaign.id,
          id: crypto.randomUUID(),
          containerId: null
        })
    })
    const excess = await readScoped(base)
    await expect(base.t.mutation(remove, input(base, second))).rejects.toThrow('bounds exceeded')
    expect(await readScoped(base)).toEqual(excess)
  })
  it('rejects tampered public membership departure receipts before fixture cleanup deletes data', async () => {
    const base = await setup()
    const second = await addSecondPlayer(base)
    const observer = await addObserver(base)
    await base.t.mutation(admit, {
      ownerUserId: base.other.userId,
      playerUserIds: [base.owner.userId, second.userId],
      campaignId: base.campaign.id
    })
    await expect(
      second.caller.mutation(api.campaigns.assignments.assign, {
        campaignId: base.campaign.id,
        characterId: second.characterId
      })
    ).resolves.toEqual({ ok: true })
    await base.t.mutation(internal.content.import.importSubjects, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [
        importedSubject({ subjectKind: 'VEHICLE', ...cart, document: cart }),
        importedSubject({
          subjectKind: 'EQUIPMENT',
          ...backpack,
          document: backpack
        })
      ]
    })
    const client = convexDevelopmentClient
    const lifecycle = await verifyCampaignMembershipLifecycle(
      {
        owner: client(base.other.caller),
        ownerUserId: base.other.userId,
        players: [
          {
            client: { ...client(base.owner.caller), setAuth: () => {} },
            fetchToken: async () => ''
          },
          {
            client: { ...client(second.caller), setAuth: () => {} },
            fetchToken: async () => ''
          }
        ],
        playerUserIds: [base.owner.userId, second.userId],
        characterIds: [base.character.id, second.characterId],
        campaignId: base.campaign.id
      },
      {
        userId: observer.userId,
        client: { ...client(observer.caller), setAuth: () => {} },
        fetchToken: async () => ''
      }
    )
    const before = await readScoped(base)
    const ownershipReconciliations = before.events.filter((event) => {
      if (event.type !== 'CAMPAIGN_CHARACTER_RECONCILED') return false
      const payload = JSON.parse(event.payloadJson) as Record<string, unknown>
      return payload.reason === 'OWNERSHIP_TRANSFER'
    })
    expect(ownershipReconciliations).toEqual([])
    const departureReasons = ['MEMBER_LEFT', 'MEMBER_REMOVED'] as const
    for (const [index, proof] of lifecycle.departures.entries()) {
      const reason = departureReasons[index]
      if (!reason) throw new Error('Membership departure reason is unavailable.')
      const removal = before.events.find((event) => event.commandId === proof.departure.commandId)
      if (!removal) throw new Error('Public membership departure receipt is missing.')
      expect(removal.type).toBe('CAMPAIGN_CONTENT_SHARES_REMOVED')
      expect(removal.actorUserId).toBe(proof.actorUserId)
      expect(removal.inputFingerprint).toBe(
        checksumCanonicalJson({
          operation: reason,
          campaignId: base.campaign.id,
          actorUserId: proof.actorUserId,
          departingUserId: proof.departingUserId,
          commandId: proof.departure.commandId,
          expectedCampaignVersion: proof.departure.expectedCampaignVersion,
          expectedMembershipAccessStartedAt: new Date(
            proof.departure.expectedMembershipAccessStartedAt
          ).toISOString()
        })
      )
      const restored = before.memberships.find((row) => row.userId === proof.departingUserId)
      expect(Date.parse(restored?.accessStartedAt ?? '')).toBeGreaterThan(
        Date.parse(proof.departure.expectedMembershipAccessStartedAt)
      )
    }
    const leaveProof = lifecycle.departures[0]
    if (!leaveProof) throw new Error('Leave departure proof is unavailable.')
    const leaveRemoval = before.events.find(
      (event) => event.commandId === leaveProof.departure.commandId
    )
    if (!leaveRemoval) throw new Error('Leave removal event is unavailable.')
    await base.t.run((ctx) => ctx.db.patch(leaveRemoval._id, { actorUserId: base.other.userId }))
    const tamperedActor = await readScoped(base)
    await expect(base.t.mutation(remove, input(base, second))).rejects.toThrow(
      'membership removal receipt mismatch'
    )
    expect(await readScoped(base)).toEqual(tamperedActor)
    await base.t.run((ctx) =>
      ctx.db.patch(leaveRemoval._id, { actorUserId: leaveRemoval.actorUserId })
    )
    expect(await readScoped(base)).toEqual(before)

    const currency = before.events.find(
      (event) =>
        event.type === 'CUSTODY_TRANSFER' &&
        event.commandId === undefined &&
        event.inputFingerprint === undefined &&
        event.subjectCharacterId === base.character.id
    )
    if (!currency) throw new Error('Public departure currency receipt is missing.')
    expect(Date.parse(currency.createdAt)).toBeGreaterThanOrEqual(
      Date.parse(leaveProof.departure.expectedMembershipAccessStartedAt)
    )
    expect(Date.parse(currency.createdAt)).toBeLessThanOrEqual(Date.parse(leaveRemoval.createdAt))
    const currencyPayload = JSON.parse(currency.payloadJson) as Record<string, unknown>
    if (!Array.isArray(currencyPayload.denominations) || !currencyPayload.denominations[0])
      throw new Error('Public departure currency denominations are missing.')
    const denomination = currencyPayload.denominations[0] as Record<string, unknown>
    await base.t.run((ctx) =>
      ctx.db.patch(currency._id, {
        payloadJson: JSON.stringify({
          ...currencyPayload,
          denominations: [{ ...denomination, unexpected: true }]
        })
      })
    )
    const tamperedDenomination = await readScoped(base)
    await expect(base.t.mutation(remove, input(base, second))).rejects.toThrow(
      'currency namespace mismatch'
    )
    expect(await readScoped(base)).toEqual(tamperedDenomination)
    await base.t.run((ctx) => ctx.db.patch(currency._id, { payloadJson: currency.payloadJson }))
    expect(await readScoped(base)).toEqual(before)
    await base.t.run((ctx) =>
      ctx.db.patch(currency._id, {
        payloadJson: JSON.stringify({
          ...currencyPayload,
          denominations: [{ ...denomination, campaignCurrencySystemId: crypto.randomUUID() }]
        })
      })
    )
    const tamperedNamespace = await readScoped(base)
    await expect(base.t.mutation(remove, input(base, second))).rejects.toThrow(
      'currency namespace mismatch'
    )
    expect(await readScoped(base)).toEqual(tamperedNamespace)
    await base.t.run((ctx) => ctx.db.patch(currency._id, { payloadJson: currency.payloadJson }))
    expect(await readScoped(base)).toEqual(before)

    const reconciliation = before.events.find((event) => {
      if (event.type !== 'CAMPAIGN_CHARACTER_RECONCILED') return false
      const payload = JSON.parse(event.payloadJson) as Record<string, unknown>
      return payload.characterId === base.character.id
    })
    if (!reconciliation) throw new Error('Historical departing Character receipt is missing.')
    const currentCharacter = before.characters.find(
      (character) => character.id === base.character.id
    )
    if (!currentCharacter) throw new Error('Restored departing Character is missing.')
    const reconciliationPayload = JSON.parse(reconciliation.payloadJson) as Record<string, unknown>
    expect(Date.parse(reconciliation.createdAt)).toBeGreaterThanOrEqual(
      Date.parse(leaveProof.departure.expectedMembershipAccessStartedAt)
    )
    expect(Date.parse(reconciliation.createdAt)).toBeLessThanOrEqual(
      Date.parse(leaveRemoval.createdAt)
    )
    expect(reconciliationPayload.streamVersion).toBeLessThanOrEqual(
      currentCharacter.play.streamVersion
    )
    await base.t.run((ctx) =>
      ctx.db.patch(reconciliation._id, {
        payloadJson: JSON.stringify({
          ...reconciliationPayload,
          streamVersion: Number.MAX_SAFE_INTEGER
        })
      })
    )
    const tamperedStream = await readScoped(base)
    await expect(base.t.mutation(remove, input(base, second))).rejects.toThrow(
      'Character reconciliation receipt mismatch'
    )
    expect(await readScoped(base)).toEqual(tamperedStream)
    await base.t.run((ctx) =>
      ctx.db.patch(reconciliation._id, {
        payloadJson: reconciliation.payloadJson
      })
    )
    expect(await readScoped(base)).toEqual(before)

    const evacuation = before.events.find((event) => event.type === 'CAMPAIGN_VEHICLE_EVACUATED')
    if (!evacuation) throw new Error('Public departure evacuation receipt is missing.')
    const evacuationPayload = JSON.parse(evacuation.payloadJson) as Record<string, unknown>
    const evacuationRemoval = before.events.find(
      (event) => event.id === evacuationPayload.removalEventId
    )
    if (!evacuationRemoval) throw new Error('Evacuation removal receipt is unavailable.')
    expect(Date.parse(evacuation.createdAt)).toBeGreaterThanOrEqual(
      Date.parse(evacuationRemoval.createdAt)
    )
    await base.t.run((ctx) =>
      ctx.db.patch(evacuation._id, {
        payloadJson: JSON.stringify({
          ...evacuationPayload,
          removalEventId: crypto.randomUUID()
        })
      })
    )
    const tamperedEvacuation = await readScoped(base)
    await expect(base.t.mutation(remove, input(base, second))).rejects.toThrow(
      'evacuation identity mismatch'
    )
    expect(await readScoped(base)).toEqual(tamperedEvacuation)
    await base.t.run((ctx) => ctx.db.patch(evacuation._id, { payloadJson: evacuation.payloadJson }))
    expect(await readScoped(base)).toEqual(before)
    await expect(base.t.mutation(remove, input(base, second))).resolves.toBeNull()
  }, 60000)
})
