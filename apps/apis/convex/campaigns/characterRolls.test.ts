import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  campaignCharacterSheetRollInputSchema,
  campaignCharacterSheetExecuteInputSchema,
  campaignCharacterRestPreviewInputSchema
} from '@artificer-toolkit/schema/api/campaignCharacterSheet'
import {
  characterSheetCommandInputDtoSchema,
  type CharacterRestPreviewRequestDto,
  type CharacterRestPreviewResponseDto,
  type CharacterSheetCommandResponseDto
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { characterSheetStateSchema } from '@artificer-toolkit/schema/projections/characterSheetState'
import { formatCharacterHitDiceRollExpression } from '@artificer-toolkit/shared/character'
import * as projection from '@artificer-toolkit/rules-runtime/character/sheetProjection'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { api, components, internal } from '../_generated/api'

const create = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const roll = makeFunctionReference<
  'mutation',
  z.input<typeof campaignCharacterSheetRollInputSchema>,
  RollRecordDto
>('campaigns/characterSheet:executeRoll')
const preview = makeFunctionReference<
  'query',
  z.input<typeof campaignCharacterRestPreviewInputSchema>,
  CharacterRestPreviewResponseDto
>('campaigns/characterSheet:restPreview')
const execute = makeFunctionReference<
  'mutation',
  z.input<typeof campaignCharacterSheetExecuteInputSchema>,
  CharacterSheetCommandResponseDto
>('campaigns/characterSheet:execute')

async function setup() {
  const { owner: player, other: gm, ...base } = await readySheetFixture()
  const campaign = await gm.caller.mutation(create, {
    name: 'Private Character rolls',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  // Membership/assignment fixtures only: this does not prove native public admission.
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
  const scope = { campaignId: campaign.id, characterId: base.character.id }
  const readPrivate = () =>
    base.t.run(async (ctx) => ({
      rolls: await ctx.db.query('userRollHistory').collect(),
      rooms: await ctx.db.query('campaignConversations').collect(),
      members: await ctx.db.query('campaignConversationMembers').collect(),
      entries: await ctx.db.query('campaignConversationEntries').collect(),
      payloads: await ctx.db.query('campaignConversationEntryPayloads').collect()
    }))
  return {
    ...base,
    player,
    gm,
    campaign,
    memberId,
    assignment,
    assignmentId,
    scope,
    readPrivate
  }
}

function rest(
  rolled: RollRecordDto,
  modifierPerDie: number,
  expectedVersion: number
): CharacterRestPreviewRequestDto {
  return {
    restKind: 'SHORT',
    expectedVersion,
    selectedHitDice: rolled.evidence.terms.map(({ die, count }) => ({
      die,
      count
    })),
    resetMaximumHitPointModifier: false,
    healingMode: 'AUTOMATIC',
    manualHealingAccepted: false,
    selectedCompanionInstanceIds: [],
    requestRoll: false,
    rollId: rolled.id,
    rollEvidence: {
      expression: rolled.normalizedExpression,
      total: rolled.evidence.total,
      terms: rolled.evidence.terms.map(({ die, count, rolls }) => ({
        die,
        count,
        rolls,
        modifierPerDie
      }))
    }
  }
}

function completion(
  input: CharacterRestPreviewRequestDto,
  result: CharacterRestPreviewResponseDto
) {
  return characterSheetCommandInputDtoSchema.parse({
    ...input,
    type: 'COMPLETE_REST',
    commandId: crypto.randomUUID(),
    previewFingerprint: result.previewFingerprint
  })
}

afterEach(() => vi.restoreAllMocks())

describe('native Campaign Character-private rolls and GM SHORT rests', () => {
  it('retains assigned repair identity for Builder and narrative chat without granting Character rolls', async () => {
    const { t, player, gm, character, scope, readState, readPrivate } = await setup()
    await player.caller.mutation(api.account.updateProfile, { username: 'RepairPlayer', bio: null })
    const stored = await readState()
    if (!stored.character) throw new Error('Missing canonical Character.')
    const repair = {
      ...characterAuthoredDtoSchema.parse(JSON.parse(stored.character.documentJson)),
      status: 'DRAFT' as const
    }
    await t.run((ctx) =>
      ctx.db.patch(stored.character!._id, {
        status: 'DRAFT',
        documentJson: canonicalizeRuleDocument(repair),
        checksum: checksumRuleDocument(repair)
      })
    )
    const before = await readPrivate()
    for (const actor of [player, gm]) {
      await expect(
        actor.caller.mutation(roll, {
          ...scope,
          expression: '1d20',
          source: { kind: 'MANUAL', label: 'Manual roll' }
        })
      ).rejects.toThrow('Builder repair')
    }
    expect(await readPrivate()).toEqual(before)
    expect(
      (await player.caller.query(api.characters.builder.get, { id: character.id }))?.character
        .status
    ).toBe('DRAFT')
    const sent = await player.caller.mutation(api.campaigns.chat.send, {
      campaignId: scope.campaignId,
      room: 'TABLE',
      clientNonce: crypto.randomUUID(),
      mode: 'ROLEPLAY',
      assignedCharacterId: character.id,
      body: 'Waiting by the campfire.'
    })
    expect(sent).toMatchObject({ characterId: character.id, body: 'Waiting by the campfire.' })
  })

  it('consumes a real GM hit-die roll atomically, preserves private player state and replays only with current authority', async () => {
    const { t, player, gm, character, scope, memberId, readState, readPrivate } = await setup()
    await player.caller.mutation(api.characters.sheetCommands.execute, {
      id: character.id,
      command: {
        type: 'CREATE_NOTE',
        title: 'Private note',
        body: 'PRIVATE-BODY',
        groupId: 'session-notes',
        commandId: crypto.randomUUID(),
        expectedVersion: 1
      }
    })
    await player.caller.mutation(api.characters.sheetCommands.execute, {
      id: character.id,
      command: {
        type: 'UPSERT_SHEET_ADJUSTMENT',
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        adjustment: {
          family: 'HIT_POINTS',
          field: 'MAXIMUM_MODIFIER',
          value: 2,
          sourceNote: 'PRIVATE-ADJUSTMENT'
        }
      }
    })
    const damaged = await player.caller.mutation(api.characters.sheetCommands.execute, {
      id: character.id,
      command: {
        type: 'ADJUST_HIT_POINTS',
        mode: 'DAMAGE',
        amount: 6,
        commandId: crypto.randomUUID(),
        expectedVersion: 3
      }
    })
    const pool = damaged.sheet.overview.hitDice[0]!
    const modifier = damaged.sheet.overview.abilities.find(
      (ability) => ability.ability === 'CONSTITUTION'
    )!.modifier
    const before = await readState()
    const personalRolls = await player.caller.query(api.rolls.history, {})
    const request = {
      ...scope,
      expression: formatCharacterHitDiceRollExpression([
        { die: pool.die, count: 1, modifierPerDie: modifier }
      ]),
      source: { kind: 'HIT_DIE' as const, label: 'Short rest hit dice' }
    }
    const rolled = await gm.caller.mutation(roll, request)
    expect(rolled.characterId).toBe(character.id)
    expect(await readState()).toEqual(before)
    const input = rest(rolled, modifier, 4)
    const beforePreview = await readPrivate()
    const projected = await gm.caller.query(preview, { ...scope, input })
    expect(projected.canApply).toBe(true)
    expect(await readState()).toEqual(before)
    expect(await readPrivate()).toEqual(beforePreview)
    const command = completion(input, projected)
    const original = projection.projectCharacterSheetBundle
    vi.spyOn(projection, 'projectCharacterSheetBundle')
      .mockImplementationOnce(original)
      .mockImplementationOnce(() => {
        throw new Error('Injected post-write rest projection failure')
      })
    await expect(gm.caller.mutation(execute, { ...scope, command })).rejects.toThrow(
      'Injected post-write rest projection failure'
    )
    expect(await readState()).toEqual(before)
    expect(await readPrivate()).toEqual(beforePreview)
    vi.restoreAllMocks()
    const completed = await gm.caller.mutation(execute, { ...scope, command })
    expect(completed.streamVersion).toBe(5)
    expect(completed.sheet.overview.hitDice.find((die) => die.die === pool.die)?.used).toBe(1)
    expect(completed.sheet.overview.currentHitPoints).toBe(
      Math.min(
        damaged.sheet.overview.maxHitPoints,
        damaged.sheet.overview.currentHitPoints + rolled.evidence.total
      )
    )
    expect(completed.result).toMatchObject({
      type: 'COMPLETE_REST',
      rest: {
        rollEvidence: input.rollEvidence,
        spentHitDice: input.selectedHitDice
      }
    })
    expect(completed.historyEntry?.actorId).toBe(gm.userId)
    const after = await readState()
    expect(after.receipts).toHaveLength(before.receipts.length + 1)
    const originalCharacter = characterAuthoredDtoSchema.parse(
      JSON.parse(before.character!.documentJson)
    )
    const currentCharacter = characterAuthoredDtoSchema.parse(
      JSON.parse(after.character!.documentJson)
    )
    expect(currentCharacter.intent).toEqual(originalCharacter.intent)
    expect(
      characterSheetStateSchema.parse(JSON.parse(after.character!.sheetState!.documentJson))
        .adjustments
    ).toEqual(
      characterSheetStateSchema.parse(JSON.parse(before.character!.sheetState!.documentJson))
        .adjustments
    )
    const ownerSheet = await player.caller.query(api.characters.sheet.get, {
      id: character.id
    })
    expect(ownerSheet?.notes.items?.[0]?.body).toBe('PRIVATE-BODY')
    expect(JSON.stringify(completed)).not.toContain('PRIVATE-BODY')
    expect(JSON.stringify(completed)).not.toContain('PRIVATE-ADJUSTMENT')
    const privateState = await readPrivate()
    expect(privateState.rolls).toHaveLength(1)
    expect(privateState.rolls[0]).toMatchObject({
      id: rolled.id,
      userId: gm.userId,
      consumedAt: completed.historyEntry!.occurredAt
    })
    expect(privateState.rooms).toEqual(beforePreview.rooms)
    expect(privateState.members).toEqual(beforePreview.members)
    expect(privateState.entries).toEqual([])
    expect(privateState.payloads).toEqual([])
    expect(await player.caller.query(api.rolls.history, {})).toEqual(personalRolls)
    await expect(
      gm.caller.query(preview, {
        ...scope,
        input: { ...input, expectedVersion: 5 }
      })
    ).rejects.toThrow('authoritative roll')
    await gm.caller.mutation(api.rolls.clearHistory, {})
    const replay = await gm.caller.mutation(execute, { ...scope, command })
    expect(replay.historyEntry).toEqual(completed.historyEntry)
    expect(replay.result).toEqual(completed.result)
    expect(await readState()).toEqual(after)
    await t.run((ctx) => ctx.db.patch(memberId, { status: 'LEFT' }))
    await expect(gm.caller.mutation(execute, { ...scope, command })).rejects.toThrow()
    expect(await readState()).toEqual(after)
    expect((await readPrivate()).rolls).toEqual([])
  })

  it('accepts only the caller’s exact private Character hit-die evidence, not another caller, TABLE or manual rolls', async () => {
    const { t, player, gm, character, scope, readState, readPrivate } = await setup()
    await gm.caller.mutation(api.account.updateProfile, {
      username: 'PrivateRollGM',
      bio: null
    })
    const damaged = await player.caller.mutation(api.characters.sheetCommands.execute, {
      id: character.id,
      command: {
        type: 'ADJUST_HIT_POINTS',
        mode: 'DAMAGE',
        amount: 6,
        commandId: crypto.randomUUID(),
        expectedVersion: 1
      }
    })
    const pool = damaged.sheet.overview.hitDice[0]!
    const modifier = damaged.sheet.overview.abilities.find(
      (ability) => ability.ability === 'CONSTITUTION'
    )!.modifier
    const request = {
      ...scope,
      expression: formatCharacterHitDiceRollExpression([
        { die: pool.die, count: 1, modifierPerDie: modifier }
      ]),
      source: { kind: 'HIT_DIE' as const, label: 'Short rest hit dice' }
    }
    const gmRoll = await gm.caller.mutation(roll, request)
    const playerRoll = await player.caller.mutation(roll, request)
    const input = rest(gmRoll, modifier, 2)
    const table = await gm.caller.mutation(api.campaigns.rolls.execute, {
      campaignId: scope.campaignId,
      room: 'TABLE',
      clientNonce: crypto.randomUUID(),
      roll: {
        characterId: character.id,
        expression: request.expression,
        source: request.source
      }
    })
    const manual = await gm.caller.mutation(api.campaigns.rolls.executePrivate, {
      campaignId: scope.campaignId,
      roll: {
        characterId: null,
        expression: request.expression,
        source: { kind: 'MANUAL', label: 'Manual' }
      }
    })
    const before = { state: await readState(), private: await readPrivate() }
    await expect(player.caller.query(preview, { ...scope, input })).rejects.toThrow(
      'authoritative roll'
    )
    const projected = await gm.caller.query(preview, { ...scope, input })
    await expect(
      player.caller.mutation(execute, {
        ...scope,
        command: completion(input, projected)
      })
    ).rejects.toThrow('authoritative roll')
    for (const evidence of [
      rest(playerRoll, modifier, 2),
      rest(table.roll!, modifier, 2),
      rest(manual, modifier, 2),
      { ...input, rollId: crypto.randomUUID() }
    ]) {
      await expect(gm.caller.query(preview, { ...scope, input: evidence })).rejects.toThrow(
        'authoritative roll'
      )
      await expect(
        gm.caller.mutation(execute, {
          ...scope,
          command: completion(evidence, projected)
        })
      ).rejects.toThrow('authoritative roll')
    }
    const evidence = input.rollEvidence!
    const delta = evidence.terms[0]!.rolls[0] === pool.die ? -1 : 1
    const forged = {
      ...input,
      rollEvidence: {
        ...evidence,
        total: evidence.total + delta,
        terms: evidence.terms.map((term) => ({
          ...term,
          rolls: [term.rolls[0]! + delta]
        }))
      }
    }
    await expect(gm.caller.query(preview, { ...scope, input: forged })).rejects.toThrow(
      'authoritative roll'
    )
    await expect(
      gm.caller.mutation(execute, {
        ...scope,
        command: completion(forged, projected)
      })
    ).rejects.toThrow('authoritative roll')
    expect({ state: await readState(), private: await readPrivate() }).toEqual(before)
    expect(
      (await t.run((ctx) => ctx.db.query('userRollHistory').collect())).every(
        (record) => !record.consumedAt
      )
    ).toBe(true)
  })

  it('denies invalid authority and invalid rolls without changing existing private history or Character state', async () => {
    const {
      t,
      player,
      gm,
      character,
      campaign,
      scope,
      memberId,
      assignmentId,
      assignment,
      readState,
      readPrivate
    } = await setup()
    const request = {
      ...scope,
      expression: '1d20',
      source: { kind: 'MANUAL' as const, label: 'Manual' }
    }
    await gm.caller.mutation(roll, request)
    const before = { state: await readState(), private: await readPrivate() }
    await expect(t.mutation(roll, request)).rejects.toThrow()
    await expect(
      gm.caller.mutation(api.rolls.execute, {
        characterId: character.id,
        expression: '1d20',
        source: request.source
      })
    ).rejects.toThrow('Character not found')
    for (const invalid of [
      { ...request, userId: player.userId },
      { ...request, campaignId: crypto.randomUUID() },
      { ...request, characterId: crypto.randomUUID() },
      { ...request, campaignId: 'bad' },
      { ...request, characterId: 'bad' },
      { ...request, expression: '1d3' },
      { ...request, expression: '10000d20' },
      { ...request, expression: '1d6', rollMode: 'ADVANTAGE' as const },
      {
        ...request,
        expression: '1d20 + 999',
        source: { kind: 'ABILITY_CHECK' as const, label: 'Strength check' }
      },
      {
        ...request,
        source: { kind: 'ATTACK' as const, label: 'Invented attack' }
      }
    ])
      await expect(gm.caller.mutation(roll, invalid)).rejects.toThrow()
    const random = vi.spyOn(crypto, 'getRandomValues').mockImplementation(() => {
      throw new Error('Entropy failed')
    })
    await expect(gm.caller.mutation(roll, request)).rejects.toThrow('Entropy failed')
    random.mockRestore()
    const user = await t.run(async (ctx) =>
      ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: 'user',
          data: {
            name: 'Other player',
            email: 'private-roll-other@example.invalid',
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
    const other = t.withIdentity({ subject: user._id, sessionId: session._id })
    const identity = await other.query(api.account.identity, {})
    if (!identity) throw new Error('Missing other player identity')
    await expect(other.mutation(roll, request)).rejects.toThrow()
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
    await expect(other.mutation(roll, request)).rejects.toThrow('Assigned Character not found')
    await t.run((ctx) => ctx.db.patch(memberId, { status: 'LEFT' }))
    await expect(gm.caller.mutation(roll, request)).rejects.toThrow()
    await expect(player.caller.mutation(roll, request)).rejects.toThrow()
    await t.run((ctx) => ctx.db.patch(memberId, { status: 'ACTIVE' }))
    await t.run((ctx) => ctx.db.patch(assignmentId, { userId: identity.userId }))
    await expect(gm.caller.mutation(roll, request)).rejects.toThrow()
    await t.run((ctx) =>
      ctx.db.patch(assignmentId, {
        userId: player.userId,
        campaignId: crypto.randomUUID()
      })
    )
    await expect(gm.caller.mutation(roll, request)).rejects.toThrow()
    await t.run((ctx) => ctx.db.patch(assignmentId, assignment))
    const stored = before.state.character!
    await t.run((ctx) => ctx.db.patch(stored._id, { userId: gm.userId }))
    await expect(gm.caller.mutation(roll, request)).rejects.toThrow()
    await t.run((ctx) => ctx.db.patch(stored._id, { userId: player.userId }))
    const campaignRow = await t.run((ctx) =>
      ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
        .unique()
    )
    if (!campaignRow) throw new Error('Missing Campaign')
    await t.run((ctx) => ctx.db.patch(campaignRow._id, { gameSystemId: crypto.randomUUID() }))
    await expect(gm.caller.mutation(roll, request)).rejects.toThrow()
    await t.run((ctx) =>
      ctx.db.patch(campaignRow._id, {
        gameSystemId: campaign.gameSystemId,
        status: 'ARCHIVED'
      })
    )
    await expect(gm.caller.mutation(roll, request)).rejects.toThrow('read-only')
    await t.run((ctx) => ctx.db.patch(campaignRow._id, { status: 'ACTIVE' }))
    await t.run((ctx) => ctx.db.delete(assignmentId))
    await expect(gm.caller.mutation(roll, request)).rejects.toThrow('Assigned Character not found')
    expect({ state: await readState(), private: await readPrivate() }).toEqual(before)
  })

  it('retains only the GM’s latest twenty private snapshots with current STANDARD masking and no room writes', async () => {
    const { t, player, gm, character, campaign, scope, readState, readPrivate } = await setup()
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
    )!
    await player.caller.mutation(api.characters.sheetCommands.execute, {
      id: character.id,
      command: {
        type: 'EQUIP_ITEM',
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        itemId: item.id
      }
    })
    const current = await gm.caller.query(api.campaigns.characterSheet.get, scope)
    const action = current.actions.items.find(
      (candidate) =>
        candidate.label.includes('**** club') && candidate.mechanic?.attackBonus != null
    )
    if (!action?.mechanic || action.mechanic.attackBonus == null)
      throw new Error('Missing shared attack')
    const bonus = action.mechanic.attackBonus
    const request = {
      ...scope,
      expression: bonus === 0 ? '1d20' : `1d20 ${bonus > 0 ? '+' : '-'} ${Math.abs(bonus)}`,
      rollMode: action.mechanic.attackRollMode ?? 'NORMAL',
      source: {
        kind: 'ATTACK' as const,
        label: `${action.label} attack`.slice(0, 80)
      }
    }
    const playerRoll = await player.caller.mutation(roll, request)
    const before = await readState()
    const generated: RollRecordDto[] = []
    for (let index = 0; index < 21; index++) generated.push(await gm.caller.mutation(roll, request))
    expect(generated.every((record) => record.source.label === request.source.label)).toBe(true)
    const retained = await gm.caller.query(api.rolls.history, {})
    expect(retained).toHaveLength(20)
    expect(new Set(retained.map((record) => record.id))).toEqual(
      new Set(
        [...generated]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
          .slice(0, 20)
          .map((record) => record.id)
      )
    )
    expect(retained.every((record) => record.source.label === request.source.label)).toBe(true)
    expect(await player.caller.query(api.rolls.history, {})).toEqual([playerRoll])
    const state = await readPrivate()
    expect(state.rolls.filter((record) => record.userId === gm.userId)).toHaveLength(20)
    expect(state.rolls.every((record) => record.source.label.includes('shit club'))).toBe(true)
    expect(state.entries).toEqual([])
    expect(state.payloads).toEqual([])
    expect(state.rooms).toEqual([])
    expect(state.members).toEqual([])
    expect(await readState()).toEqual(before)
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
        .unique()
      if (!row) throw new Error('Missing Campaign')
      await ctx.db.patch(row._id, { contentMaturity: 'MATURE' })
    })
    const mature = await gm.caller.query(api.rolls.history, {})
    expect(mature.every((record) => record.source.label.includes('shit club'))).toBe(true)
    expect(mature.map((record) => record.id)).toEqual(retained.map((record) => record.id))
    expect(await readPrivate()).toEqual(state)
    await t.run(async (ctx) => {
      const owner = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', campaign.id).eq('userId', gm.userId)
        )
        .unique()
      if (!owner) throw new Error('Missing GM membership')
      await ctx.db.patch(owner._id, { status: 'LEFT' })
    })
    await expect(gm.caller.mutation(roll, request)).rejects.toThrow()
    expect(await gm.caller.query(api.rolls.history, {})).toEqual(mature)
    expect(await readPrivate()).toEqual(state)
  })
})
