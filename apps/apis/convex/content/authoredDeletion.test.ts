import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  AuthoredDeleteActiveInput,
  AuthoredPublicationResult,
  AuthoredPublishDraftInput
} from '@artificer-toolkit/schema/api/authoredPublication'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignVehicleDto,
  CreateCampaignVehicleInput
} from '@artificer-toolkit/schema/api/campaignVehicles'
import { characterBuilderDraftPayloadDtoSchema } from '@artificer-toolkit/schema/api/characterBuilder'
import { characterStoredDraftSchema } from '@artificer-toolkit/schema/projections/characterPersistence'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { backgroundAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/background'
import {
  campaignStoredPartyCurrencyGroupSchema,
  campaignStoredPartyCurrencySchema,
  campaignStoredPartyInventorySchema,
  campaignStoredPartyItemSchema
} from '@artificer-toolkit/schema/projections/campaignInventoryPersistence'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { cart } from '@artificer-toolkit/source-data/srd/vehicles/cart.js'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { readCharacterSheetState } from '@artificer-toolkit/schema/projections/characterStoredState'
import { api, components, internal } from '../_generated/api'
import { insertCharacterDraftPayload, readCharacterDraft } from '../characters/documents'
import {
  characterDocumentSchema,
  joinCharacterPlay,
  readCharacterRecord,
  readCharacterRow
} from '../characters/stateDocuments'
import { editCharacterRecord } from '../../tests/fixtures/characterRecords'
import { insertActiveCharacterRecord } from '../../tests/fixtures/characterRows'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const createVehicle = makeFunctionReference<
  'mutation',
  CreateCampaignVehicleInput,
  CampaignVehicleDto
>('campaigns/vehicles:create')
const publish = makeFunctionReference<
  'mutation',
  AuthoredPublishDraftInput,
  AuthoredPublicationResult
>('content/publication:publishDraft')
const deleteActive = makeFunctionReference<'mutation', AuthoredDeleteActiveInput, null>(
  'content/deletion:deleteActive'
)

async function publishOwnedCopy(
  base: Awaited<ReturnType<typeof readySheetFixture>>,
  subjectKind: 'BACKGROUND' | 'VEHICLE',
  subjectId: string
) {
  const draft = await base.owner.caller.mutation(api.content.drafts.duplicate, {
    subjectKind,
    subjectId
  })
  if (!draft.updatedAt) throw new Error('Missing authored draft revision.')
  const publication = await base.owner.caller.mutation(publish, {
    subjectKind,
    subjectId: draft.subjectId,
    expectedDraftUpdatedAt: draft.updatedAt
  })
  return { draft, publication }
}

async function addActor(base: Awaited<ReturnType<typeof readySheetFixture>>) {
  const user = await base.t.run(async (ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'user',
        data: {
          name: 'Third',
          email: 'third@example.invalid',
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
  if (!identity) throw new Error('Missing third test identity.')
  return { caller, userId: identity.userId }
}

type CharacterDto = ReturnType<typeof characterAuthoredDtoSchema.parse>

function selectBackground(
  value: unknown,
  backgroundId: string,
  startingEquipment?: { groupId: string; optionId: string }
): CharacterDto {
  const character = characterAuthoredDtoSchema.parse(value)
  const intent: CharacterDto['intent'] = {
    ...character.intent,
    background: { ...character.intent.background, backgroundId }
  }
  if (startingEquipment) {
    const current = character.intent.startingEquipment
    if (!current?.background) throw new Error('Missing Background equipment decision fixture.')
    intent.startingEquipment = {
      ...current,
      background: { ...current.background, groups: [startingEquipment] }
    }
  }
  return { ...character, intent }
}

describe('native authored deletion source-loss cleanup', () => {
  it('repairs personal/create-only and assigned Characters across active and archived Campaigns once', async () => {
    const base = await readySheetFixture()
    const third = await addActor(base)
    const { draft: sourceDraft, publication } = await publishOwnedCopy(
      base,
      'BACKGROUND',
      acolyte.id
    )
    const ownedBackground = backgroundAuthoredDtoSchema.parse(sourceDraft.payload)
    const equipmentSelection = {
      groupId: ownedBackground.startingEquipment!.sets[0]!.groups[0]!.id,
      optionId: ownedBackground.startingEquipment!.sets[0]!.groups[0]!.options[0]!.id
    }
    const activeCampaign = await base.other.caller.mutation(createCampaign, {
      name: 'Active source-loss campaign',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    const archivedCampaign = await third.caller.mutation(createCampaign, {
      name: 'Archived source-loss campaign',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    await base.t.run(async (ctx) => {
      for (const campaign of [activeCampaign, archivedCampaign]) {
        await ctx.db.insert('campaignMemberships', {
          campaignId: campaign.id,
          userId: base.owner.userId,
          role: 'PLAYER',
          status: 'ACTIVE',
          accessStartedAt: campaign.createdAt,
          joinedAt: campaign.createdAt,
          leftAt: null
        })
      }
      await ctx.db.insert('campaignMemberships', {
        campaignId: archivedCampaign.id,
        userId: base.other.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: archivedCampaign.createdAt,
        joinedAt: archivedCampaign.createdAt,
        leftAt: null
      })
      await ctx.db.insert('campaignCharacterAssignments', {
        campaignId: activeCampaign.id,
        userId: base.owner.userId,
        characterId: base.character.id,
        assignedAt: activeCampaign.createdAt
      })
    })
    for (const campaign of [activeCampaign, archivedCampaign]) {
      await base.owner.caller.mutation(api.campaigns.contentShares.share, {
        campaignId: campaign.id,
        subjectKind: 'BACKGROUND',
        subjectId: publication.subjectId
      })
    }

    const ownerEdit = await base.owner.caller.mutation(api.characters.drafts.create, {
      id: base.character.id,
      systemId: base.character.systemId
    })
    const ownerCandidate = selectBackground(
      ownerEdit.payload.character,
      publication.subjectId,
      equipmentSelection
    )
    await base.owner.caller.mutation(api.characters.drafts.save, {
      characterId: base.character.id,
      expectedDraftId: ownerEdit.id,
      mode: 'edit',
      character: ownerCandidate
    })
    await base.t.run((ctx) =>
      editCharacterRecord(
        ctx,
        base.character.id,
        () => characterDocumentSchema.parse({ ...ownerCandidate, status: 'ACTIVE' }),
        { maximumHitPoints: 0 }
      )
    )
    const otherDraft = await base.other.caller.mutation(api.characters.drafts.create, {
      id: crypto.randomUUID(),
      systemId: srdSystemRecord.id
    })
    const otherCandidate = characterAuthoredDtoSchema.parse({
      ...selectBackground(base.character, publication.subjectId, equipmentSelection),
      id: otherDraft.payload.character.id,
      userId: base.other.userId,
      label: 'Bram',
      status: 'DRAFT'
    })
    await base.other.caller.mutation(api.characters.drafts.save, {
      characterId: otherDraft.payload.character.id,
      expectedDraftId: otherDraft.id,
      mode: 'create',
      character: otherCandidate
    })
    await base.t.run(async (ctx) => {
      const now = new Date().toISOString()
      const active = {
        ...characterDocumentSchema.parse({ ...otherCandidate, status: 'ACTIVE' }),
        status: 'ACTIVE' as const
      }
      await insertActiveCharacterRecord(ctx, active, { createdAt: now })
      const storedDraft = await ctx.db
        .query('characterDrafts')
        .withIndex('by_characterId', (q) => q.eq('characterId', active.id))
        .unique()
      if (!storedDraft) throw new Error('Missing other Character draft fixture.')
      await ctx.db.patch(storedDraft._id, {
        mode: 'edit',
        baseActiveUpdatedAt: now
      })
    })
    await base.t.run((ctx) =>
      ctx.db.insert('campaignCharacterAssignments', {
        campaignId: archivedCampaign.id,
        userId: base.other.userId,
        characterId: otherDraft.payload.character.id,
        assignedAt: archivedCampaign.createdAt
      })
    )
    const personalDraft = await base.owner.caller.mutation(api.characters.drafts.create, {
      id: crypto.randomUUID(),
      systemId: srdSystemRecord.id
    })
    const personalCandidate = characterAuthoredDtoSchema.parse({
      ...selectBackground(base.character, publication.subjectId, equipmentSelection),
      id: personalDraft.payload.character.id,
      label: 'Personal source-loss Character',
      status: 'DRAFT'
    })
    await base.owner.caller.mutation(api.characters.drafts.save, {
      characterId: personalCandidate.id,
      expectedDraftId: personalDraft.id,
      mode: 'create',
      character: personalCandidate
    })
    await base.t.run(async (ctx) => {
      const now = new Date().toISOString()
      const active = {
        ...characterDocumentSchema.parse({ ...personalCandidate, status: 'ACTIVE' }),
        status: 'ACTIVE' as const
      }
      await insertActiveCharacterRecord(ctx, active, { createdAt: now })
      const storedDraft = await ctx.db
        .query('characterDrafts')
        .withIndex('by_characterId', (q) => q.eq('characterId', active.id))
        .unique()
      if (!storedDraft) throw new Error('Missing personal Character draft fixture.')
      await ctx.db.patch(storedDraft._id, {
        mode: 'edit',
        baseActiveUpdatedAt: now
      })
    })
    const createOnly = await base.owner.caller.mutation(api.characters.drafts.create, {
      id: crypto.randomUUID(),
      systemId: srdSystemRecord.id
    })
    const savedCreateOnly = await base.owner.caller.mutation(api.characters.drafts.save, {
      characterId: createOnly.payload.character.id,
      expectedDraftId: createOnly.id,
      mode: 'create',
      character: selectBackground(createOnly.payload.character, publication.subjectId)
    })
    const workingSource = await base.owner.caller.mutation(api.content.drafts.save, {
      subjectKind: 'BACKGROUND',
      subjectId: publication.subjectId,
      systemId: sourceDraft.systemId,
      label: 'Preserved source draft',
      payload: sourceDraft.payload
    })
    await base.t.run(async (ctx) => {
      const authorMembership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', archivedCampaign.id).eq('userId', base.owner.userId)
        )
        .unique()
      const campaign = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', archivedCampaign.id))
        .unique()
      if (!authorMembership || !campaign) throw new Error('Missing archived Campaign fixture.')
      await ctx.db.patch(authorMembership._id, {
        status: 'LEFT',
        leftAt: new Date().toISOString()
      })
      await ctx.db.patch(campaign._id, { status: 'ARCHIVED' })
    })
    const before = await base.t.run(async (ctx) => ({
      characters: await Promise.all(
        (await ctx.db.query('characters').collect()).map((row) => joinCharacterPlay(ctx, row))
      ),
      drafts: await ctx.db.query('characterDrafts').collect(),
      campaigns: await ctx.db.query('campaigns').collect()
    }))

    await base.owner.caller.mutation(deleteActive, {
      subjectKind: 'BACKGROUND',
      subjectId: publication.subjectId
    })

    const after = await base.t.run(async (ctx) => ({
      root: await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', publication.subjectId))
        .unique(),
      sourceDraft: await ctx.db
        .query('authoredDrafts')
        .withIndex('by_subjectId', (q) => q.eq('subjectId', publication.subjectId))
        .unique(),
      characters: await Promise.all(
        (await ctx.db.query('characters').collect()).map((row) => joinCharacterPlay(ctx, row))
      ),
      drafts: await ctx.db.query('characterDrafts').collect(),
      campaigns: await ctx.db.query('campaigns').collect(),
      shares: await ctx.db
        .query('campaignContentShares')
        .withIndex('by_subjectKind_subjectId_campaignId', (q) =>
          q.eq('subjectKind', 'BACKGROUND').eq('subjectId', publication.subjectId)
        )
        .collect(),
      events: await ctx.db.query('campaignEvents').collect()
    }))
    expect(after.root).toBeNull()
    expect(after.sourceDraft).toMatchObject({
      subjectId: publication.subjectId,
      publicId: workingSource.publicId,
      label: 'Preserved source draft',
      draftState: 'DRAFT_ONLY',
      baseActiveUpdatedAt: null,
      basePublishedChecksum: null
    })
    expect(after.shares).toEqual([])
    for (const beforeCampaign of before.campaigns) {
      const current = after.campaigns.find((campaign) => campaign.id === beforeCampaign.id)
      expect(current?.version).toBe(beforeCampaign.version + 1)
    }
    for (const beforeCharacter of before.characters) {
      const current = after.characters.find((character) => character.id === beforeCharacter.id)
      expect(current).toMatchObject({
        _id: beforeCharacter._id,
        id: beforeCharacter.id,
        userId: beforeCharacter.userId,
        status: 'DRAFT',
        play: { streamVersion: beforeCharacter.play.streamVersion + 1 },
        createdAt: beforeCharacter.createdAt
      })
      expect(readCharacterSheetState(current!)).toEqual(readCharacterSheetState(beforeCharacter))
      const document = readCharacterRecord(current!)
      expect(document.intent.background.backgroundId).toBe('')
    }
    const createOnlyAfter = after.drafts.find(
      (draft) => draft.characterId === savedCreateOnly.payload.character.id
    )
    expect(createOnlyAfter).toMatchObject({
      id: savedCreateOnly.id,
      characterId: savedCreateOnly.payload.character.id,
      mode: 'create',
      baseActiveUpdatedAt: null,
      createdAt: savedCreateOnly.createdAt
    })
    const createOnlyPayload = await base.t.run(async (ctx) => {
      const draft = await ctx.db
        .query('characterDrafts')
        .withIndex('by_characterId', (q) =>
          q.eq('characterId', savedCreateOnly.payload.character.id)
        )
        .unique()
      if (!draft) throw new Error('Missing Character draft payload.')
      return (await readCharacterDraft(ctx, draft, null)).payload
    })
    expect(createOnlyPayload.character.intent.background.backgroundId).toBe('')
    expect(
      after.characters.some((record) => record.id === savedCreateOnly.payload.character.id)
    ).toBe(false)
    expect(
      after.events.filter((event) => event.type === 'CAMPAIGN_CONTENT_SHARES_REMOVED')
    ).toHaveLength(2)
    expect(
      after.events
        .filter((event) => event.type === 'CAMPAIGN_CHARACTER_RECONCILED')
        .map((event) => event.subjectCharacterId)
        .sort((left, right) => (left ?? '').localeCompare(right ?? ''))
    ).toEqual(
      [base.character.id, otherDraft.payload.character.id].sort((left, right) =>
        left.localeCompare(right)
      )
    )
    for (const event of after.events.filter((event) =>
      ['CAMPAIGN_CONTENT_SHARES_REMOVED', 'CAMPAIGN_CHARACTER_RECONCILED'].includes(event.type)
    ))
      expect(JSON.parse(event.payloadJson!)).toMatchObject({
        reason: 'AUTHORED_DELETED'
      })
  }, 30_000)

  it('audits and bumps an owner-assigned Character without inventing a share-removal event', async () => {
    const base = await readySheetFixture()
    const { draft, publication } = await publishOwnedCopy(base, 'BACKGROUND', acolyte.id)
    const ownedBackground = backgroundAuthoredDtoSchema.parse(draft.payload)
    const campaign = await base.other.caller.mutation(createCampaign, {
      name: 'Owner assignment without share',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    await base.t.run(async (ctx) => {
      await ctx.db.insert('campaignMemberships', {
        campaignId: campaign.id,
        userId: base.owner.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: campaign.createdAt,
        joinedAt: campaign.createdAt,
        leftAt: null
      })
      await ctx.db.insert('campaignCharacterAssignments', {
        campaignId: campaign.id,
        userId: base.owner.userId,
        characterId: base.character.id,
        assignedAt: campaign.createdAt
      })
      await editCharacterRecord(
        ctx,
        base.character.id,
        () =>
          characterDocumentSchema.parse({
            ...selectBackground(base.character, publication.subjectId, {
              groupId: ownedBackground.startingEquipment!.sets[0]!.groups[0]!.id,
              optionId: ownedBackground.startingEquipment!.sets[0]!.groups[0]!.options[0]!.id
            }),
            status: 'ACTIVE'
          }),
        { maximumHitPoints: 0 }
      )
    })
    await base.owner.caller.mutation(deleteActive, {
      subjectKind: 'BACKGROUND',
      subjectId: publication.subjectId
    })
    const state = await base.t.run(async (ctx) => ({
      campaign: await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
        .unique(),
      character: await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', base.character.id))
        .unique(),
      events: await ctx.db
        .query('campaignEvents')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .collect()
    }))
    expect(state.campaign?.version).toBe(campaign.version + 1)
    expect(state.character?.status).toBe('DRAFT')
    expect(
      state.events.filter((event) => event.type === 'CAMPAIGN_CHARACTER_RECONCILED')
    ).toHaveLength(1)
    expect(state.events.some((event) => event.type === 'CAMPAIGN_CONTENT_SHARES_REMOVED')).toBe(
      false
    )
    expect(JSON.parse(state.events[0]!.payloadJson!)).toMatchObject({
      reason: 'AUTHORED_DELETED'
    })
  }, 30_000)

  it('repairs a committed Character and preserves its working draft when an owned Class is deleted', async () => {
    const base = await readySheetFixture()
    const classDraft = await base.owner.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'CLASS',
      subjectId: fighter.id
    })
    if (!classDraft.updatedAt) throw new Error('Missing owned Class draft revision.')
    const publication = await base.owner.caller.action(
      api.content.classPublicationActions.publishDraft,
      {
        subjectKind: 'CLASS',
        subjectId: classDraft.subjectId,
        expectedDraftUpdatedAt: classDraft.updatedAt
      }
    )
    const edit = await base.owner.caller.mutation(api.characters.drafts.create, {
      id: base.character.id,
      systemId: base.character.systemId
    })
    const ownedClassCharacter = characterAuthoredDtoSchema.parse({
      ...edit.payload.character,
      intent: {
        ...edit.payload.character.intent,
        classes: [{ classId: publication.subjectId, classLevel: 1 }],
        hitpoints: {
          ...edit.payload.character.intent.hitpoints,
          levels: [
            {
              level: 1,
              classId: publication.subjectId,
              classLevel: 1,
              value: 10
            }
          ]
        }
      }
    })
    await base.owner.caller.mutation(api.characters.drafts.save, {
      characterId: base.character.id,
      expectedDraftId: edit.id,
      mode: 'edit',
      character: ownedClassCharacter
    })
    await base.owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: edit.id,
      mode: 'edit',
      character: ownedClassCharacter
    })
    const working = await base.owner.caller.mutation(api.characters.drafts.create, {
      id: base.character.id,
      systemId: base.character.systemId
    })
    const savedWorking = await base.owner.caller.mutation(api.characters.drafts.save, {
      characterId: base.character.id,
      expectedDraftId: working.id,
      mode: 'edit',
      character: {
        ...ownedClassCharacter,
        label: 'Private working Character'
      }
    })
    const before = await base.t.run((ctx) => readCharacterRow(ctx, base.character.id))
    const factsBefore = await base.t.run((ctx) =>
      ctx.db
        .query('authoredSourceFacts')
        .withIndex('by_subjectId', (q) => q.eq('subjectId', publication.subjectId))
        .collect()
    )
    expect(factsBefore).toHaveLength(1)
    await base.owner.caller.mutation(deleteActive, {
      subjectKind: 'CLASS',
      subjectId: publication.subjectId
    })
    const after = await base.t.run(async (ctx) => ({
      sourceFacts: await ctx.db
        .query('authoredSourceFacts')
        .withIndex('by_subjectId', (q) => q.eq('subjectId', publication.subjectId))
        .collect(),
      root: await ctx.db
        .query('authoredRoots')
        .withIndex('by_publicId', (q) => q.eq('id', publication.subjectId))
        .unique(),
      character: await readCharacterRow(ctx, base.character.id),
      draft: await ctx.db
        .query('characterDrafts')
        .withIndex('by_characterId', (q) => q.eq('characterId', base.character.id))
        .unique()
    }))
    expect(after.root).toBeNull()
    expect(after.sourceFacts).toEqual([])
    expect(after.character).toMatchObject({
      _id: before!._id,
      id: before!.id,
      userId: before!.userId,
      label: before!.label,
      status: 'DRAFT',
      play: { streamVersion: before!.play.streamVersion + 1 }
    })
    const repaired = readCharacterRecord(after.character!)
    const committed = readCharacterRecord(before!)
    expect(repaired.state.equipment).toEqual(committed.state.equipment)
    expect(repaired.intent.classes).toEqual([])
    expect(repaired.intent.hitpoints.levels).toEqual([])
    expect(repaired.intent.startingEquipment?.class).toBeUndefined()
    expect(after.draft).toMatchObject({
      id: savedWorking.id,
      characterId: base.character.id,
      label: 'Private working Character',
      mode: 'edit'
    })
    const repairedPayload = await base.t.run(async (ctx) => {
      const draft = await ctx.db
        .query('characterDrafts')
        .withIndex('by_characterId', (q) => q.eq('characterId', base.character.id))
        .unique()
      if (!draft || !after.character) throw new Error('Missing Character draft payload.')
      return (await readCharacterDraft(ctx, draft, after.character)).payload
    })
    const repairedDraft = characterAuthoredDtoSchema.parse(repairedPayload.character)
    expect(repairedDraft.intent.classes).toEqual([])
    expect(repairedDraft.intent.hitpoints.levels).toEqual([])
    expect(repairedDraft.intent.startingEquipment?.class).toBeUndefined()
  }, 30_000)

  it('preserves Vehicle item trees, currency groups and loose balances with correlated audit', async () => {
    const base = await readySheetFixture()
    await importSeededSubjects(base.t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [importedSubject({ subjectKind: 'VEHICLE', ...cart, document: cart })]
    })
    const { publication } = await publishOwnedCopy(base, 'VEHICLE', cart.id)
    const campaign = await base.owner.caller.mutation(createCampaign, {
      name: 'Vehicle deletion evacuation',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    await base.owner.caller.mutation(api.campaigns.contentShares.share, {
      campaignId: campaign.id,
      subjectKind: 'VEHICLE',
      subjectId: publication.subjectId
    })
    const vehicle = await base.owner.caller.mutation(createVehicle, {
      campaignId: campaign.id,
      vehicleDefinitionId: publication.subjectId
    })
    const denominationId = srdSystemRecord.currencies[0]!.id
    const parentId = '93000000-0000-4000-8000-000000000001'
    const childId = '93000000-0000-4000-8000-000000000002'
    const groupId = '93000000-0000-4000-8000-000000000003'
    const groupedBalanceId = '93000000-0000-4000-8000-000000000004'
    const sourceLooseId = '93000000-0000-4000-8000-000000000005'
    const destinationLooseId = '93000000-0000-4000-8000-000000000006'
    await base.t.run(async (ctx) => {
      await ctx.db.insert(
        'campaignPartyInventories',
        campaignStoredPartyInventorySchema.parse({
          campaignId: campaign.id,
          version: 1
        })
      )
      await ctx.db.insert(
        'campaignPartyInventories',
        campaignStoredPartyInventorySchema.parse({
          campaignId: campaign.id,
          vehicleId: vehicle.id,
          version: 2
        })
      )
      for (const [id, containerId] of [
        [parentId, null],
        [childId, parentId]
      ] as const)
        await ctx.db.insert(
          'campaignPartyItems',
          campaignStoredPartyItemSchema.parse({
            campaignId: campaign.id,
            vehicleId: vehicle.id,
            id,
            equipmentId: club.id,
            quantity: 1,
            containerId
          })
        )
      await ctx.db.insert(
        'campaignPartyCurrencyGroups',
        campaignStoredPartyCurrencyGroupSchema.parse({
          campaignId: campaign.id,
          vehicleId: vehicle.id,
          id: groupId,
          containerId: parentId
        })
      )
      for (const row of [
        {
          id: groupedBalanceId,
          vehicleId: vehicle.id,
          groupId,
          containerId: parentId,
          amount: 7
        },
        {
          id: sourceLooseId,
          vehicleId: vehicle.id,
          groupId: undefined,
          containerId: null,
          amount: 13
        },
        {
          id: destinationLooseId,
          vehicleId: undefined,
          groupId: undefined,
          containerId: null,
          amount: 17
        }
      ])
        await ctx.db.insert(
          'campaignPartyCurrencies',
          campaignStoredPartyCurrencySchema.parse({
            campaignId: campaign.id,
            ...row,
            denominationId
          })
        )
    })
    await base.owner.caller.mutation(deleteActive, {
      subjectKind: 'VEHICLE',
      subjectId: publication.subjectId
    })
    const state = await base.t.run(async (ctx) => ({
      vehicle: await ctx.db
        .query('campaignVehicles')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id).eq('id', vehicle.id))
        .unique(),
      inventories: await ctx.db.query('campaignPartyInventories').collect(),
      items: await ctx.db.query('campaignPartyItems').collect(),
      groups: await ctx.db.query('campaignPartyCurrencyGroups').collect(),
      balances: await ctx.db.query('campaignPartyCurrencies').collect(),
      events: await ctx.db.query('campaignEvents').collect()
    }))
    expect(state.vehicle).toBeNull()
    expect(state.inventories).toEqual([expect.objectContaining({ version: 2 })])
    expect(state.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: parentId, containerId: null }),
        expect.objectContaining({ id: childId, containerId: parentId })
      ])
    )
    expect(state.items.every((item) => !('vehicleId' in item))).toBe(true)
    expect(state.groups).toEqual([expect.objectContaining({ id: groupId, containerId: parentId })])
    expect(state.groups[0]).not.toHaveProperty('vehicleId')
    expect(state.balances).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: groupedBalanceId, groupId, amount: 7 }),
        expect.objectContaining({
          id: destinationLooseId,
          amount: 30,
          containerId: null
        })
      ])
    )
    expect(state.balances.some((balance) => balance.id === sourceLooseId)).toBe(false)
    expect(state.balances.every((balance) => !('vehicleId' in balance))).toBe(true)
    const evacuation = state.events.find((event) => event.type === 'CAMPAIGN_VEHICLE_EVACUATED')
    const removal = state.events.find((event) => event.type === 'CAMPAIGN_CONTENT_SHARES_REMOVED')
    expect(JSON.parse(evacuation!.payloadJson!)).toMatchObject({
      reason: 'AUTHORED_DELETED',
      removalEventId: removal!.id,
      sourceInventoryVersion: 3,
      destinationInventoryVersion: 2
    })
  }, 30_000)

  it('exhausts owner draft discovery beyond one UUID keyset batch', async () => {
    const base = await readySheetFixture()
    const { publication } = await publishOwnedCopy(base, 'BACKGROUND', acolyte.id)
    const template = await base.owner.caller.mutation(api.characters.drafts.create, {
      id: crypto.randomUUID(),
      systemId: srdSystemRecord.id
    })
    await base.t.run(async (ctx) => {
      await ctx.db.delete(
        (await ctx.db
          .query('characterDrafts')
          .withIndex('by_characterId', (q) => q.eq('characterId', template.payload.character.id))
          .unique())!._id
      )
      for (let index = 0; index < 101; index += 1) {
        const suffix = String(index).padStart(12, '0')
        const characterId = `91000000-0000-4000-8000-${suffix}`
        const draftId = `92000000-0000-4000-8000-${suffix}`
        const character = selectBackground(
          { ...template.payload.character, id: characterId },
          index === 100 ? publication.subjectId : ''
        )
        const payload = characterBuilderDraftPayloadDtoSchema.parse({
          character
        })
        if (!template.createdAt) throw new Error('Missing draft template timestamp.')
        const stored = await insertCharacterDraftPayload(
          ctx,
          characterId,
          payload,
          template.createdAt
        )
        await ctx.db.insert(
          'characterDrafts',
          characterStoredDraftSchema.parse({
            id: draftId,
            characterId,
            userId: base.owner.userId,
            systemId: srdSystemRecord.id,
            publicId: `batch-${index}`,
            label: 'Untitled Character',
            status: 'DRAFT',
            mode: 'create',
            baseActiveUpdatedAt: null,
            createdAt: template.createdAt,
            updatedAt: template.updatedAt,
            payloadId: stored.payloadId,
            payloadDocumentId: stored.payloadDocumentId,
            checksum: stored.checksum
          })
        )
      }
    })
    const firstBefore = await base.t.run((ctx) =>
      ctx.db
        .query('characterDrafts')
        .withIndex('by_characterId', (q) =>
          q.eq('characterId', '91000000-0000-4000-8000-000000000000')
        )
        .unique()
    )
    await base.owner.caller.mutation(deleteActive, {
      subjectKind: 'BACKGROUND',
      subjectId: publication.subjectId
    })
    const [firstAfter, lastAfter] = await base.t.run((ctx) =>
      Promise.all([
        ctx.db
          .query('characterDrafts')
          .withIndex('by_characterId', (q) =>
            q.eq('characterId', '91000000-0000-4000-8000-000000000000')
          )
          .unique(),
        ctx.db
          .query('characterDrafts')
          .withIndex('by_characterId', (q) =>
            q.eq('characterId', '91000000-0000-4000-8000-000000000100')
          )
          .unique()
      ])
    )
    expect(firstAfter).toEqual(firstBefore)
    const lastPayload = await base.t.run(async (ctx) => {
      if (!lastAfter) throw new Error('Missing reconciled Character draft payload.')
      return (await readCharacterDraft(ctx, lastAfter, null)).payload
    })
    expect(lastPayload.character.intent.background.backgroundId).toBe('')
  }, 30_000)
})
