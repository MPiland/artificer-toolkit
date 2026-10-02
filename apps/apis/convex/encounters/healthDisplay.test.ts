import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignChatEntryDto,
  CampaignChatPageDto,
  listCampaignChatEntriesInputSchema
} from '@artificer-toolkit/schema/api/campaignCommunication'
import type {
  EncounterCommandInputDto,
  EncounterGmProjectionDto,
  EncounterPlayerProjectionDto,
  ShareEncounterActorHealthInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import type {
  CharacterSheetCommandResponseDto,
  CharacterSheetExecuteInput
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import type { CharacterPartyVisibilityDto } from '@artificer-toolkit/schema/api/healthDisplay'
import { api } from '../_generated/api'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { createPartyPlayer } from '../../tests/fixtures/partyPlayer'
import { executeInRoom, RoomCommandRefusal } from '../../tests/fixtures/liveSessionWorker'

const get = makeFunctionReference<
  'query',
  { encounterId: string },
  EncounterGmProjectionDto | EncounterPlayerProjectionDto
>('encounters/projectionReads:get')
const share = makeFunctionReference<
  'mutation',
  ShareEncounterActorHealthInputDto,
  CampaignChatEntryDto
>('encounters/healthDisplay:share')
const sheetExecute = makeFunctionReference<
  'mutation',
  CharacterSheetExecuteInput,
  CharacterSheetCommandResponseDto
>('characters/sheetCommands:execute')
const chat = makeFunctionReference<
  'query',
  z.input<typeof listCampaignChatEntriesInputSchema>,
  CampaignChatPageDto
>('campaigns/chat:list')

type CommandPayload = EncounterCommandInputDto extends infer Command
  ? Command extends EncounterCommandInputDto
    ? Omit<Command, 'encounterId' | 'commandId' | 'expectedVersion'>
    : never
  : never

async function setup() {
  const base = await setupCharacterRun()
  // The table log names its author.
  await base.owner.caller.mutation(api.account.updateProfile, { username: 'TableGM', bio: null })
  const party = await createPartyPlayer(base.t, base.campaign)
  await party.join()
  const enemy = base.run.actors.find((actor) => actor.kind === 'CUSTOM')
  if (!enemy) throw new Error('Missing enemy actor.')
  const gmView = async () =>
    encounterGmProjectionDtoSchema.parse(
      await base.owner.caller.query(get, { encounterId: base.run.id })
    )
  const gm = async (payload: CommandPayload) =>
    executeInRoom(base.owner.caller, {
      command: {
        ...payload,
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: (await gmView()).version
      } as EncounterCommandInputDto
    })
  const healthSeenBy = async (viewer: typeof party | typeof base.player, actorId: string) => {
    const projection = (await viewer.caller.query(get, {
      encounterId: base.run.id
    })) as EncounterPlayerProjectionDto
    return projection.actors.find((actor) => actor.id === actorId)?.health
  }
  async function setCharacterHealth(health: CharacterPartyVisibilityDto['health']) {
    const sheet = await base.player.caller.query(api.characters.sheet.get, {
      id: base.character.id
    })
    if (!sheet) throw new Error('Expected Character Sheet.')
    await base.player.caller.mutation(sheetExecute, {
      id: base.character.id,
      command: {
        type: 'SET_PARTY_VISIBILITY',
        commandId: crypto.randomUUID(),
        expectedVersion: sheet.meta.streamVersion,
        visibility: { sheet: false, health }
      }
    })
  }
  return { ...base, party, enemy, gm, gmView, healthSeenBy, setCharacterHealth }
}

describe('Encounter health display levels (ADR 0034 decision 5)', () => {
  it('redacts enemy health for every level, with the actor override over the Encounter default', async () => {
    const base = await setup()
    await base.gm({ type: 'UPDATE_ACTOR', actorId: base.enemy.id, currentHitPoints: 1 })

    // Hidden is the default and carries nothing.
    expect(await base.healthSeenBy(base.party, base.enemy.id)).toBeNull()

    await base.gm({ type: 'SET_HEALTH_DISPLAY_DEFAULT', level: 'DESCRIPTIVE' })
    expect(await base.healthSeenBy(base.party, base.enemy.id)).toEqual({
      level: 'DESCRIPTIVE',
      state: 'BLOODIED'
    })

    await base.gm({ type: 'UPDATE_ACTOR', actorId: base.enemy.id, healthDisplay: 'BAR' })
    const bar = await base.healthSeenBy(base.party, base.enemy.id)
    // 1 of 3 is shown only as a coarse 5% step.
    expect(bar).toEqual({ level: 'BAR', ratio: 0.35 })

    await base.gm({ type: 'UPDATE_ACTOR', actorId: base.enemy.id, healthDisplay: 'EXACT' })
    expect(await base.healthSeenBy(base.party, base.enemy.id)).toEqual({
      level: 'EXACT',
      current: 1,
      maximum: 3
    })

    await base.gm({ type: 'UPDATE_ACTOR', actorId: base.enemy.id, healthDisplay: 'HIDDEN' })
    expect(await base.healthSeenBy(base.party, base.enemy.id)).toBeNull()

    await base.gm({ type: 'UPDATE_ACTOR', actorId: base.enemy.id, healthDisplay: null })
    expect(await base.healthSeenBy(base.party, base.enemy.id)).toEqual({
      level: 'DESCRIPTIVE',
      state: 'BLOODIED'
    })

    // The GM always sees exact values and the settings.
    const gmView = await base.gmView()
    expect(gmView.healthDisplayDefault).toBe('DESCRIPTIVE')
    expect(gmView.actors.find((actor) => actor.id === base.enemy.id)).toMatchObject({
      currentHitPoints: 1,
      maxHitPoints: 3,
      healthDisplay: null
    })
    const playerView = JSON.stringify(
      await base.party.caller.query(get, { encounterId: base.run.id })
    )
    for (const gmOnly of ['currentHitPoints', 'healthBand', 'healthDisplay'])
      expect(playerView).not.toContain(gmOnly)
  }, 60_000)

  it('shows a Character at its player’s level, and exact health to its controller', async () => {
    const base = await setup()
    const characterId = base.actor.id
    // The Character's own player controls it and always sees exact health.
    expect(await base.healthSeenBy(base.player, characterId)).toMatchObject({ level: 'EXACT' })
    expect(await base.healthSeenBy(base.party, characterId)).toBeNull()
    // The Encounter default is for enemies and NPCs only.
    await base.gm({ type: 'SET_HEALTH_DISPLAY_DEFAULT', level: 'EXACT' })
    expect(await base.healthSeenBy(base.party, characterId)).toBeNull()

    await base.setCharacterHealth('DESCRIPTIVE')
    expect(await base.healthSeenBy(base.party, characterId)).toEqual({
      level: 'DESCRIPTIVE',
      state: 'UNHURT'
    })
    await base.setCharacterHealth('BAR')
    expect(await base.healthSeenBy(base.party, characterId)).toEqual({ level: 'BAR', ratio: 1 })
    await base.setCharacterHealth('EXACT')
    const gmCharacter = (await base.gmView()).actors.find((actor) => actor.id === characterId)!
    expect(await base.healthSeenBy(base.party, characterId)).toEqual({
      level: 'EXACT',
      current: gmCharacter.currentHitPoints,
      maximum: gmCharacter.maxHitPoints
    })

    // The GM cannot override a Character's level; its player owns it on the Sheet.
    await expect(
      base.gm({ type: 'UPDATE_ACTOR', actorId: characterId, healthDisplay: 'HIDDEN' })
    ).rejects.toThrow(RoomCommandRefusal)
  }, 60_000)

  it('posts one enemy health state to the table log without changing its level', async () => {
    const base = await setup()
    await base.gm({ type: 'UPDATE_ACTOR', actorId: base.enemy.id, currentHitPoints: 1 })
    const before = await base.gmView()
    const commandId = crypto.randomUUID()
    const input = { encounterId: base.run.id, actorId: base.enemy.id, commandId }

    await expect(base.party.caller.mutation(share, input)).rejects.toThrow('Campaign not found.')
    const entry = await base.owner.caller.mutation(share, input)
    expect(entry).toMatchObject({ room: 'TABLE', kind: 'CHAT', body: 'Target looks bloodied.' })
    // A retry of the same share posts nothing new.
    expect(await base.owner.caller.mutation(share, input)).toEqual(entry)
    const log = await base.owner.caller.query(chat, {
      campaignId: base.campaign.id,
      room: 'TABLE'
    })
    expect(log.entries.filter((candidate) => candidate.body === entry.body)).toHaveLength(1)
    expect(await base.gmView()).toEqual(before)
    expect(await base.healthSeenBy(base.party, base.enemy.id)).toBeNull()

    // Sharing a hidden enemy would reveal it; a Character's health is its player's to share.
    await base.gm({ type: 'UPDATE_ACTOR', actorId: base.enemy.id, public: false })
    await expect(
      base.owner.caller.mutation(share, { ...input, commandId: crypto.randomUUID() })
    ).rejects.toThrow('Encounter actor was not found.')
    await expect(
      base.owner.caller.mutation(share, {
        ...input,
        actorId: base.actor.id,
        commandId: crypto.randomUUID()
      })
    ).rejects.toThrow('Encounter actor was not found.')
  }, 60_000)
})
