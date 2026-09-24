import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignChatEntryDto,
  CampaignChatPageDto,
  ExecuteCampaignPrivateRollInput,
  ExecuteCampaignRollInput,
  SendCampaignChatEntryInput,
  listCampaignChatEntriesInputSchema
} from '@artificer-toolkit/schema/api/campaignCommunication'
import type { listCampaignAdjustmentsInputSchema } from '@artificer-toolkit/schema/api/campaignLiveState'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characterSheetData'
import type {
  ExecuteRollInputDto,
  RollHistoryResponseDto,
  RollRecordDto
} from '@artificer-toolkit/schema/api/rolls'
import { campaignCharacterStateSchema } from '@artificer-toolkit/schema/projections/campaignCharacterState'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { api, components, internal } from '../_generated/api'

const create = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const execute = makeFunctionReference<'mutation', ExecuteCampaignRollInput, CampaignChatEntryDto>(
  'campaigns/rolls:execute'
)
const executePrivate = makeFunctionReference<
  'mutation',
  ExecuteCampaignPrivateRollInput,
  RollRecordDto
>('campaigns/rolls:executePrivate')
const personalExecute = makeFunctionReference<'mutation', ExecuteRollInputDto, RollRecordDto>(
  'rolls:execute'
)
const history = makeFunctionReference<'query', Record<string, never>, RollHistoryResponseDto>(
  'rolls:history'
)
const send = makeFunctionReference<'mutation', SendCampaignChatEntryInput, CampaignChatEntryDto>(
  'campaigns/chat:send'
)
const list = makeFunctionReference<
  'query',
  z.input<typeof listCampaignChatEntriesInputSchema>,
  CampaignChatPageDto
>('campaigns/chat:list')
const sheet = makeFunctionReference<
  'query',
  z.input<typeof listCampaignAdjustmentsInputSchema>,
  CharacterSheetResponseDto
>('campaigns/characterSheet:get')

async function setup() {
  const { owner: player, other: gm, ...base } = await readySheetFixture()
  await gm.caller.mutation(api.account.updateProfile, {
    username: 'CampaignGM',
    bio: null
  })
  await player.caller.mutation(api.account.updateProfile, {
    username: 'CampaignPlayer',
    bio: null
  })
  const campaign = await gm.caller.mutation(create, {
    name: 'Campaign rolls',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  // Explicit fixtures exercise roll authority, not public membership admission.
  const memberId = await base.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: player.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
  )
  const assignment = {
    campaignId: campaign.id,
    userId: player.userId,
    characterId: base.character.id,
    assignedAt: campaign.createdAt
  }
  const assignmentId = await base.t.run((ctx) =>
    ctx.db.insert('campaignCharacterAssignments', assignment)
  )
  await base.t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.updateMany, {
      input: {
        model: 'session',
        update: { expiresAt: Date.now() + 24 * 60 * 60_000 }
      },
      paginationOpts: { cursor: null, numItems: 10 }
    })
  )
  const request: ExecuteCampaignRollInput = {
    campaignId: campaign.id,
    room: 'TABLE',
    clientNonce: crypto.randomUUID(),
    roll: {
      characterId: base.character.id,
      expression: '1d20 + 2',
      source: { kind: 'MANUAL', label: 'Client label' }
    }
  }
  const privateRequest: ExecuteCampaignPrivateRollInput = {
    campaignId: campaign.id,
    roll: {
      characterId: null,
      expression: '1d20',
      source: { kind: 'MANUAL', label: 'shit secret' }
    }
  }
  const readEntries = () =>
    base.t.run(async (ctx) => ({
      headers: await ctx.db.query('campaignConversationEntries').collect(),
      payloads: await ctx.db.query('campaignConversationEntryPayloads').collect(),
      history: await ctx.db.query('userRollHistory').collect()
    }))
  return {
    ...base,
    player,
    gm,
    campaign,
    memberId,
    assignmentId,
    assignment,
    request,
    privateRequest,
    readEntries
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('native Campaign authoritative rolls', () => {
  it('rolls assigned Characters for their player or GM, with cryptographic evidence and no play-state or private-history writes', async () => {
    const { player, gm, t, character, request, readState, readEntries } = await setup()
    const before = await readState()
    const random = vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      if (!(array instanceof Uint32Array)) throw new Error('Expected bounded sample')
      array[0] = 9
      return array
    })
    const first = await player.caller.mutation(execute, request)
    const second = await gm.caller.mutation(execute, {
      ...request,
      clientNonce: crypto.randomUUID()
    })
    for (const entry of [first, second]) {
      expect(entry).toMatchObject({
        kind: 'ROLL',
        body: null,
        mode: null,
        characterId: character.id,
        roll: {
          characterId: character.id,
          characterLabel: character.label,
          source: { kind: 'MANUAL', label: 'Manual roll' },
          ruleset: {
            systemId: srdSystemRecord.id,
            code: srdSystemRecord.rulesetCode,
            version: srdSystemRecord.rulesetVersion
          },
          evidence: { total: 12, terms: [{ rolls: [10] }] }
        }
      })
    }
    expect(second.authorUsername).toBe('CampaignGM')
    expect(random).toHaveBeenCalledTimes(2)
    expect(await player.caller.query(history, {})).toEqual([])
    expect(await gm.caller.query(history, {})).toEqual([])
    await expect(
      gm.caller.mutation(personalExecute, { ...request.roll, characterId: character.id })
    ).rejects.toThrow()
    await expect(t.mutation(execute, request)).rejects.toThrow()
    expect(await readState()).toEqual(before)
    expect((await readEntries()).headers).toHaveLength(2)
    expect((await readEntries()).payloads).toHaveLength(2)
  })

  it('resolves hidden Campaign mechanics through the current Sheet and rejects forged expressions, modes, sources and rooms', async () => {
    const { t, player, gm, campaign, character, request, readState, readEntries } = await setup()
    const state = campaignCharacterStateSchema.parse({
      adjustments: [
        {
          id: crypto.randomUUID(),
          campaignId: campaign.id,
          characterId: character.id,
          createdBy: gm.userId,
          version: 0,
          createdAt: campaign.createdAt,
          updatedAt: campaign.createdAt,
          visibility: 'SECRET',
          adjustment: {
            family: 'ABILITY',
            ability: 'STRENGTH',
            field: 'SCORE_OVERRIDE',
            value: 21,
            sourceNote: 'SECRET-ROLL-CAUSE'
          }
        }
      ],
      conditions: []
    })
    await t.run((ctx) =>
      ctx.db.insert('campaignCharacterStates', {
        campaignId: campaign.id,
        characterId: character.id,
        documentJson: JSON.stringify(state),
        checksum: checksumRuleDocument(state)
      })
    )
    const projected = await player.caller.query(sheet, {
      campaignId: campaign.id,
      characterId: character.id
    })
    const strength = projected.overview.abilities.find((ability) => ability.ability === 'STRENGTH')!
    expect(strength.modifier).toBe(5)
    const command: ExecuteCampaignRollInput = {
      ...request,
      roll: {
        characterId: character.id,
        expression: '1d20 + 5',
        rollMode: strength.rollMode,
        source: { kind: 'ABILITY_CHECK', label: 'Strength check' }
      }
    }
    const before = await readState()
    const rolled = await player.caller.mutation(execute, command)
    expect(rolled.roll?.evidence.modifier).toBe(5)
    expect(JSON.stringify(rolled)).not.toContain('SECRET-ROLL-CAUSE')
    expect(JSON.stringify(rolled)).not.toContain(state.adjustments[0]!.id)
    for (const roll of [
      { ...command.roll, expression: '1d20 + 2' },
      { ...command.roll, rollMode: 'DISADVANTAGE' as const },
      {
        ...command.roll,
        source: { kind: 'ABILITY_CHECK' as const, label: 'Invented check' }
      }
    ])
      await expect(
        player.caller.mutation(execute, {
          ...command,
          clientNonce: crypto.randomUUID(),
          roll
        })
      ).rejects.toThrow()
    for (const room of ['PARTY', 'DIRECT'] as const)
      await expect(
        player.caller.mutation(execute, {
          ...command,
          room,
          clientNonce: crypto.randomUUID()
        })
      ).rejects.toThrow()
    expect((await readEntries()).headers).toHaveLength(1)
    expect(await readState()).toEqual(before)
  })

  it('matches presented weapon labels while retaining original roll provenance', async () => {
    const { player, gm, campaign, character, request, readEntries, readState } = await setup()
    const draft = await gm.caller.mutation(api.content.drafts.duplicate, {
      subjectKind: 'EQUIPMENT',
      subjectId: club.id
    })
    const saved = await gm.caller.mutation(api.content.drafts.save, {
      subjectKind: 'EQUIPMENT',
      subjectId: draft.subjectId,
      systemId: draft.systemId,
      label: 'shit club',
      payload: { ...draft.payload, label: 'shit club' }
    })
    await gm.caller.mutation(api.content.publication.publishDraft, {
      subjectKind: 'EQUIPMENT',
      subjectId: draft.subjectId,
      expectedDraftUpdatedAt: saved.updatedAt!
    })
    await gm.caller.mutation(api.campaigns.contentShares.share, {
      campaignId: campaign.id,
      subjectKind: 'EQUIPMENT',
      subjectId: draft.subjectId
    })
    const added = await player.caller.mutation(api.characters.sheetCommands.execute, {
      id: character.id,
      command: {
        type: 'ADD_INVENTORY_ITEM',
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        equipmentId: draft.subjectId,
        quantity: 1
      }
    })
    const item = added.sheet.inventory.items.find(
      (candidate) => candidate.equipmentId === draft.subjectId
    )
    if (!item) throw new Error('Missing shared club fixture')
    await player.caller.mutation(api.characters.sheetCommands.execute, {
      id: character.id,
      command: {
        type: 'EQUIP_ITEM',
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        itemId: item.id
      }
    })
    const current = await gm.caller.query(sheet, {
      campaignId: campaign.id,
      characterId: character.id
    })
    const action = current.actions.items.find(
      (candidate) =>
        candidate.label.includes('**** club') && candidate.mechanic?.attackBonus != null
    )
    if (!action?.mechanic || action.mechanic.attackBonus == null)
      throw new Error('Expected equipped club attack')
    const bonus = action.mechanic.attackBonus
    const roll: ExecuteCampaignRollInput['roll'] = {
      characterId: character.id,
      expression: bonus === 0 ? '1d20' : `1d20 ${bonus > 0 ? '+' : '-'} ${Math.abs(bonus)}`,
      rollMode: action.mechanic.attackRollMode ?? 'NORMAL',
      source: { kind: 'ATTACK', label: `${action.label} attack`.slice(0, 80) }
    }
    const before = await readState()
    const result = await gm.caller.mutation(execute, { ...request, roll })
    expect(result.roll?.source.label).toBe(roll.source.label)
    expect((await readEntries()).payloads[0]?.roll?.source.label).toBe(
      roll.source.label.replace('****', 'shit')
    )
    await expect(
      gm.caller.mutation(execute, {
        ...request,
        clientNonce: crypto.randomUUID(),
        roll: {
          ...roll,
          source: { ...roll.source, label: roll.source.label.replace('****', 'shit') }
        }
      })
    ).rejects.toThrow()
    expect(await readState()).toEqual(before)
  })

  it('replays exactly without rerolling changed input, but checks current assignment and membership epoch before replay', async () => {
    const { t, player, request, assignmentId, assignment, memberId, readEntries } = await setup()
    const first = await player.caller.mutation(execute, request)
    const before = await readEntries()
    const random = vi.spyOn(crypto, 'getRandomValues').mockImplementation(() => {
      throw new Error('Replay must not reroll')
    })
    expect(
      await player.caller.mutation(execute, {
        ...request,
        roll: { ...request.roll, expression: '2d6' }
      })
    ).toEqual(first)
    expect(random).not.toHaveBeenCalled()
    await t.run((ctx) => ctx.db.delete(assignmentId))
    await expect(player.caller.mutation(execute, request)).rejects.toThrow()
    await t.run((ctx) => ctx.db.insert('campaignCharacterAssignments', assignment))
    await t.run((ctx) =>
      ctx.db.patch(memberId, {
        accessStartedAt: new Date(Date.parse(first.createdAt) + 1).toISOString()
      })
    )
    await expect(player.caller.mutation(execute, request)).rejects.toThrow()
    expect(await readEntries()).toEqual(before)
  })

  it('rejects CHAT and other-room nonce reuse and shares the thirty-per-minute text/roll limit', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const { gm, player, campaign, request, readEntries } = await setup()
    await gm.caller.mutation(api.campaigns.conversations.open, {
      campaignId: campaign.id,
      kind: 'TABLE'
    })
    await gm.caller.mutation(api.campaigns.conversations.open, {
      campaignId: campaign.id,
      kind: 'DIRECT',
      directUserId: player.userId
    })
    const text: SendCampaignChatEntryInput = {
      campaignId: campaign.id,
      room: 'TABLE',
      mode: 'OOC',
      body: 'text',
      clientNonce: crypto.randomUUID()
    }
    await gm.caller.mutation(send, text)
    await expect(
      gm.caller.mutation(execute, {
        ...request,
        clientNonce: text.clientNonce
      })
    ).rejects.toThrow()
    const direct = {
      ...text,
      room: 'DIRECT' as const,
      directUserId: player.userId,
      clientNonce: crypto.randomUUID()
    }
    await gm.caller.mutation(send, direct)
    await expect(
      gm.caller.mutation(execute, {
        ...request,
        clientNonce: direct.clientNonce
      })
    ).rejects.toThrow()
    const first = await gm.caller.mutation(execute, request)
    for (let index = 0; index < 27; index++)
      await gm.caller.mutation(send, {
        ...text,
        clientNonce: crypto.randomUUID()
      })
    await expect(
      gm.caller.mutation(execute, {
        ...request,
        clientNonce: crypto.randomUUID()
      })
    ).rejects.toThrow(/rate|30|limit/i)
    expect(await gm.caller.mutation(execute, request)).toEqual(first)
    expect((await readEntries()).headers).toHaveLength(30)
    vi.setSystemTime(new Date('2026-01-01T00:01:01Z'))
    await expect(
      gm.caller.mutation(execute, {
        ...request,
        clientNonce: crypto.randomUUID()
      })
    ).resolves.toMatchObject({ kind: 'ROLL' })
  })

  it('preserves original GM labels behind STANDARD presentation and makes roll payloads immutable', async () => {
    const { t, gm, player, campaign, request, readEntries } = await setup()
    const command: ExecuteCampaignRollInput = {
      ...request,
      roll: {
        characterId: null,
        expression: '1d20',
        source: { kind: 'MANUAL', label: 'shit secret' }
      }
    }
    const rolled = await gm.caller.mutation(execute, command)
    expect(rolled).toMatchObject({
      characterId: null,
      roll: { characterId: null, source: { label: '**** secret' } }
    })
    const before = await readEntries()
    expect(before.payloads[0]?.roll?.source.label).toBe('shit secret')
    await player.caller.mutation(api.campaigns.conversations.open, {
      campaignId: campaign.id,
      kind: 'TABLE'
    })
    expect(
      (
        await player.caller.query(list, {
          campaignId: campaign.id,
          room: 'TABLE',
          limit: 50
        })
      ).entries[0]
    ).toEqual(rolled)
    await expect(
      gm.caller.mutation(api.campaigns.chat.edit, {
        campaignId: campaign.id,
        entryId: rolled.id,
        body: 'rewritten'
      })
    ).rejects.toThrow('Chat entry cannot be changed')
    await expect(
      gm.caller.mutation(api.campaigns.chat.unsend, {
        campaignId: campaign.id,
        entryId: rolled.id
      })
    ).rejects.toThrow('Chat entry cannot be changed')
    await expect(player.caller.mutation(execute, command)).rejects.toThrow()
    await expect(
      gm.caller.mutation(execute, {
        ...command,
        clientNonce: crypto.randomUUID(),
        roll: {
          ...command.roll,
          source: { kind: 'ABILITY_CHECK', label: 'Strength check' }
        }
      })
    ).rejects.toThrow()
    expect(await readEntries()).toEqual(before)
    expect(await t.run((ctx) => ctx.db.query('userRollHistory').collect())).toEqual([])
  })

  it('bounds expanded STANDARD text for fresh rolls and existing MATURE conversation history', async () => {
    const { t, gm, player, campaign, character, request, readEntries } = await setup()
    const body = `${'ass '.repeat(499)}word`
    const sourceLabel = `${'ass '.repeat(19)}word`
    const characterLabel = `${'ass '.repeat(24)}word`
    const campaignRow = await t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
        .unique()
      const active = await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', character.id))
        .unique()
      if (!row || !active) throw new Error('Missing Campaign/Character fixture')
      const raw: unknown = JSON.parse(active.documentJson)
      const document = { ...characterAuthoredDtoSchema.parse(raw), label: characterLabel }
      await ctx.db.patch(active._id, {
        label: characterLabel,
        documentJson: JSON.stringify(document),
        checksum: checksumRuleDocument(document)
      })
      await ctx.db.patch(row._id, { contentMaturity: 'MATURE' })
      return row
    })
    const text = await gm.caller.mutation(send, {
      campaignId: campaign.id,
      room: 'TABLE',
      mode: 'OOC',
      body,
      clientNonce: crypto.randomUUID()
    })
    const ownerRequest: ExecuteCampaignRollInput = {
      ...request,
      roll: {
        characterId: null,
        expression: '1d20',
        source: { kind: 'MANUAL', label: sourceLabel }
      }
    }
    const manual = await gm.caller.mutation(execute, ownerRequest)
    const assigned = await player.caller.mutation(execute, {
      ...request,
      clientNonce: crypto.randomUUID()
    })
    expect(text.body).toHaveLength(2000)
    expect(manual.roll?.source.label).toHaveLength(80)
    expect(assigned.characterLabel).toHaveLength(100)
    const stored = await readEntries()
    await t.run((ctx) => ctx.db.patch(campaignRow._id, { contentMaturity: 'STANDARD' }))
    const page = await gm.caller.query(list, { campaignId: campaign.id, room: 'TABLE', limit: 50 })
    expect(page.entries).toHaveLength(3)
    const presentedText = page.entries.find((entry) => entry.id === text.id)!
    const presentedManual = page.entries.find((entry) => entry.id === manual.id)!
    const presentedCharacter = page.entries.find((entry) => entry.id === assigned.id)!
    expect(presentedText.body).toBe(`${'**** '.repeat(499)}word`.slice(0, 2000))
    expect(presentedManual.roll?.source.label).toBe(`${'**** '.repeat(19)}word`.slice(0, 80).trim())
    expect(presentedCharacter.characterLabel).toBe(`${'**** '.repeat(24)}word`.slice(0, 100).trim())
    expect(await gm.caller.mutation(execute, ownerRequest)).toEqual(presentedManual)
    expect(await readEntries()).toEqual(stored)
    const fresh = await gm.caller.mutation(execute, {
      ...ownerRequest,
      clientNonce: crypto.randomUUID()
    })
    expect(fresh.roll?.source.label).toBe(presentedManual.roll?.source.label)
    const freshText = await gm.caller.mutation(send, {
      campaignId: campaign.id,
      room: 'TABLE',
      mode: 'OOC',
      body,
      clientNonce: crypto.randomUUID()
    })
    expect(freshText.body).toBe(presentedText.body)
    expect(
      (await readEntries()).payloads.find((payload) => payload.entryId === fresh.id)?.roll?.source
        .label
    ).toBe(sourceLabel)
    expect(
      (await readEntries()).payloads.find((payload) => payload.entryId === freshText.id)?.body
    ).toBe(body)
  })

  it('retains one mixed 500-entry TABLE window and rolls back header, payload and trimming together', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const { t, gm, request, readEntries } = await setup()
    const template = await gm.caller.mutation(execute, request)
    const seed = (await readEntries()).payloads[0]!
    await t.run(async (ctx) => {
      for (let index = 0; index < 499; index++) {
        const id = `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`
        await ctx.db.insert('campaignConversationEntries', {
          id,
          campaignId: request.campaignId,
          conversationId: template.conversationId,
          authorUserId: gm.userId,
          createdAt: '2020-01-01T00:00:00.000Z',
          clientNonce: crypto.randomUUID()
        })
        const { _id, _creationTime, ...payload } = seed
        void _id
        void _creationTime
        await ctx.db.insert(
          'campaignConversationEntryPayloads',
          index % 2 === 0
            ? { ...payload, entryId: id }
            : {
                ...payload,
                entryId: id,
                kind: 'CHAT',
                mode: 'OOC',
                body: 'seed text',
                roll: null
              }
        )
      }
    })
    const before = await readEntries()
    const next = { ...request, clientNonce: crypto.randomUUID() }
    await expect(
      gm.caller.run(async (ctx) => {
        await ctx.runMutation(execute, next)
        throw new Error('Injected enclosing transaction failure')
      })
    ).rejects.toThrow('Injected enclosing transaction failure')
    expect(await readEntries()).toEqual(before)
    const newest = await gm.caller.mutation(execute, next)
    const retained = await readEntries()
    expect(retained.headers).toHaveLength(500)
    expect(retained.payloads).toHaveLength(500)
    expect(retained.headers.map((entry) => entry.id)).toContain(newest.id)
    expect(retained.headers.map((entry) => entry.id)).not.toContain(
      '00000000-0000-4000-8000-000000000000'
    )
    expect(retained.payloads.map((payload) => payload.entryId).sort()).toEqual(
      retained.headers.map((entry) => entry.id).sort()
    )
    expect(new Set(retained.payloads.map((payload) => payload.kind))).toEqual(
      new Set(['CHAT', 'ROLL'])
    )
    expect(retained.history).toEqual([])
  })

  it('keeps GM private raw labels only in the GM twenty-record history, with no conversation or player-history writes', async () => {
    const { t, gm, player, privateRequest, readState, readEntries } = await setup()
    const before = await readState()
    const first = await gm.caller.mutation(executePrivate, privateRequest)
    expect(first).toMatchObject({
      characterId: null,
      source: { kind: 'MANUAL', label: 'shit secret' },
      ruleset: { systemId: srdSystemRecord.id }
    })
    await t.run(async (ctx) => {
      for (let index = 0; index < 19; index++)
        await ctx.db.insert('userRollHistory', {
          ...first,
          id: crypto.randomUUID(),
          userId: gm.userId,
          createdAt: new Date(Date.UTC(2020, 0, 1, 0, 0, index)).toISOString()
        })
    })
    const beforeFailure = await readEntries()
    await expect(
      gm.caller.run(async (ctx) => {
        await ctx.runMutation(executePrivate, privateRequest)
        throw new Error('Injected private failure')
      })
    ).rejects.toThrow('Injected private failure')
    expect(await readEntries()).toEqual(beforeFailure)
    const newest = await gm.caller.mutation(executePrivate, privateRequest)
    const records = await gm.caller.query(history, {})
    expect(records).toHaveLength(20)
    expect(records).toContainEqual(newest)
    expect(records.every((record) => record.source.label === 'shit secret')).toBe(true)
    expect(await player.caller.query(history, {})).toEqual([])
    expect((await readEntries()).headers).toEqual([])
    expect((await readEntries()).payloads).toEqual([])
    expect(await t.run((ctx) => ctx.db.query('campaignConversations').collect())).toEqual([])
    expect(await readState()).toEqual(before)
    await expect(player.caller.mutation(executePrivate, privateRequest)).rejects.toThrow()
    await expect(t.mutation(executePrivate, privateRequest)).rejects.toThrow()
    await expect(
      gm.caller.mutation(executePrivate, {
        ...privateRequest,
        roll: {
          ...privateRequest.roll,
          source: { kind: 'ABILITY_CHECK', label: 'Strength check' }
        }
      })
    ).rejects.toThrow()
  })

  it('denies outsiders and other active players access to an assigned Character', async () => {
    const { t, campaign, request, privateRequest, readEntries } = await setup()
    const user = await t.run(async (ctx) =>
      ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'user',
          data: {
            name: 'Party member',
            email: 'party-roll@example.invalid',
            emailVerified: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        },
        onCreateHandle: await createFunctionHandle(internal.auth.onCreate)
      })
    )
    const session = await t.run((ctx) =>
      ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'session',
          data: {
            userId: user._id,
            token: crypto.randomUUID(),
            expiresAt: Date.now() + 60000,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        }
      })
    )
    const caller = t.withIdentity({ subject: user._id, sessionId: session._id })
    const identity = await caller.query(api.account.identity, {})
    if (!identity) throw new Error('Missing party member identity')
    await caller.mutation(api.account.updateProfile, { username: 'PartyPlayer', bio: null })
    await expect(caller.mutation(execute, request)).rejects.toThrow()
    await expect(caller.mutation(executePrivate, privateRequest)).rejects.toThrow()
    await t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: campaign.id,
        userId: identity.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: campaign.createdAt,
        joinedAt: campaign.createdAt,
        leftAt: null
      })
    )
    await expect(caller.mutation(execute, request)).rejects.toThrow('Assigned Character not found')
    await expect(caller.mutation(executePrivate, privateRequest)).rejects.toThrow()
    expect(await readEntries()).toEqual({ headers: [], payloads: [], history: [] })
  })

  it('fails closed for removed or invalid assignment authority and archived Campaigns', async () => {
    const {
      t,
      gm,
      player,
      campaign,
      character,
      memberId,
      assignmentId,
      request,
      privateRequest,
      readEntries
    } = await setup()
    const record = await t.run((ctx) =>
      ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', character.id))
        .unique()
    )
    if (!record) throw new Error('Missing Character fixture')
    for (const change of [{ status: 'LEFT' as const }, { role: 'OWNER' as const }]) {
      await t.run((ctx) => ctx.db.patch(memberId, change))
      await expect(gm.caller.mutation(execute, request)).rejects.toThrow()
      await expect(gm.caller.mutation(executePrivate, privateRequest)).rejects.toThrow()
      await t.run((ctx) => ctx.db.patch(memberId, { status: 'ACTIVE', role: 'PLAYER' }))
    }
    await t.run((ctx) => ctx.db.patch(record._id, { userId: gm.userId }))
    await expect(player.caller.mutation(execute, request)).rejects.toThrow()
    await expect(gm.caller.mutation(execute, request)).rejects.toThrow()
    await t.run((ctx) => ctx.db.patch(record._id, { userId: player.userId }))
    await t.run((ctx) => ctx.db.patch(record._id, { systemId: crypto.randomUUID() }))
    await expect(gm.caller.mutation(execute, request)).rejects.toThrow()
    await expect(gm.caller.mutation(executePrivate, privateRequest)).rejects.toThrow()
    await t.run((ctx) => ctx.db.patch(record._id, { systemId: record.systemId }))
    const route = await t.run((ctx) =>
      ctx.db
        .query('authoredRouteIds')
        .withIndex('by_subjectId', (q) => q.eq('subjectId', character.id))
        .unique()
    )
    if (!route) throw new Error('Missing Character route fixture')
    await t.run((ctx) => ctx.db.patch(route._id, { ownerUserId: gm.userId }))
    await expect(gm.caller.mutation(execute, request)).rejects.toThrow()
    await expect(gm.caller.mutation(executePrivate, privateRequest)).rejects.toThrow()
    await t.run((ctx) => ctx.db.patch(route._id, { ownerUserId: player.userId }))
    await t.run((ctx) => ctx.db.patch(assignmentId, { campaignId: crypto.randomUUID() }))
    await expect(gm.caller.mutation(execute, request)).rejects.toThrow()
    await expect(gm.caller.mutation(executePrivate, privateRequest)).rejects.toThrow()
    await t.run((ctx) => ctx.db.patch(assignmentId, { campaignId: campaign.id }))
    await t.run((ctx) => ctx.db.patch(memberId, { status: 'LEFT' }))
    await expect(player.caller.mutation(execute, request)).rejects.toThrow()
    await t.run((ctx) => ctx.db.patch(memberId, { status: 'ACTIVE' }))
    await t.run((ctx) => ctx.db.delete(assignmentId))
    await expect(gm.caller.mutation(execute, request)).rejects.toThrow()
    await expect(gm.caller.mutation(executePrivate, privateRequest)).rejects.toThrow()
    const row = await t.run((ctx) =>
      ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
        .unique()
    )
    if (!row) throw new Error('Missing Campaign fixture')
    await t.run((ctx) =>
      ctx.db.insert('campaignCharacterAssignments', {
        campaignId: campaign.id,
        userId: player.userId,
        characterId: character.id,
        assignedAt: campaign.createdAt
      })
    )
    await t.run((ctx) => ctx.db.patch(row._id, { status: 'ARCHIVED' }))
    await expect(gm.caller.mutation(execute, request)).rejects.toThrow()
    await expect(gm.caller.mutation(executePrivate, privateRequest)).rejects.toThrow()
    expect(await readEntries()).toEqual({
      headers: [],
      payloads: [],
      history: []
    })
  })
})
