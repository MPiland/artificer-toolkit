import { describe, expect, it } from 'vitest'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { playerControlFixture, storeRunAutomationMode } from '../../tests/fixtures/playerControl'
import {
  checkpointLiveRoom,
  deliverQueuedRoomControl,
  executeSheetInRoom,
  expectRedactedRoomRefusal,
  invalidateRoomInputs,
  readRoomEncounterSession,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { characterCollectionSchemas } from '@artificer-toolkit/schema/projections/characterOperationalRecords'
import { countDatabaseIo, createDatabaseIoTotals } from '../../tests/fixtures/databaseIo'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import {
  aidAtSecondLevel,
  plannedModifierGrant
} from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { api } from '../_generated/api'
import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { executeCharacterSheetCommandAcknowledgement } from '../characters/sheetCommands'
import { readCharacterRecord } from '../characters/stateDocuments'

/**
 * Sheet play on a Character its live room holds (R06.3, V14.5): Convex refuses play and writes
 * nothing, the owner's play commits through the room and checkpoints to Convex, and Builder edits
 * keep committing in Convex and reach the next room command through its reload.
 */

useLocalRoomWorker()

const HELD = 'This Character is held by its live table; use the room for play commands.'

type Character = ReturnType<typeof characterAuthoredDtoSchema.parse>

async function heldCharacter(
  beforeHold?: (base: Awaited<ReturnType<typeof playerControlFixture>>) => Promise<void>
) {
  const base = await playerControlFixture()
  await beforeHold?.(base)
  // The GM joining the table makes the room claim authority and hold the Run's Characters.
  await readRoomEncounterSession(base.owner.caller, base.campaign.id, { timeline: false })
  const stored = (await base.readState()).character
  if (!stored) throw new Error('Missing held Character fixture.')
  const characterId = stored.id
  /** What Convex stores once the room publishes what it has committed. */
  const settled = async () => {
    await checkpointLiveRoom(base.campaign.id)
    return base.readState()
  }
  const storage = async () => {
    await checkpointLiveRoom(base.campaign.id)
    return base.readReceiptStorage()
  }
  const play = async () => {
    const row = (await settled()).character
    if (!row) throw new Error('Missing held Character fixture.')
    return {
      label: readCharacterRecord(row).label,
      streamVersion: row.play.streamVersion,
      maximumHitPoints: row.play.maximumHitPoints,
      currentHitPoints: readCharacterRecord(row).state.hitpoints.current
    }
  }
  const adjust = (
    mode: 'DAMAGE' | 'HEAL',
    amount: number,
    expectedVersion: number,
    commandId = crypto.randomUUID()
  ) => ({
    scope: 'CHARACTER_SHEET' as const,
    characterId,
    encounterId: base.run.id,
    command: { type: 'ADJUST_HIT_POINTS' as const, mode, amount, commandId, expectedVersion }
  })
  // Edits the Character in the Builder as its owner, which Convex keeps committing while it is held.
  const builderEdit = async (change: (character: Character) => Character) => {
    const row = (await settled()).character
    if (!row) throw new Error('Missing held Character fixture.')
    const draft = await base.player.caller.mutation(api.characters.drafts.create, {
      id: characterId,
      systemId: srdSystemRecord.id
    })
    await base.player.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: draft.id,
      mode: 'edit',
      character: change(characterAuthoredDtoSchema.parse(readCharacterRecord(row)))
    })
    // The commit queued its own notice to the room; delivering it now keeps the scheduler's timer
    // from landing it in the middle of the next room command.
    await deliverQueuedRoomControl(base.t)
  }
  return { ...base, characterId, play, storage, settled, adjust, builderEdit }
}

function atLevel(level: number, label: string) {
  return (character: Character): Character => {
    const [entry] = character.intent.classes ?? []
    const hitpoints = character.intent.hitpoints
    if (!entry || hitpoints?.method !== 'FIXED') throw new Error('Unexpected level fixture.')
    return {
      ...character,
      label,
      intent: {
        ...character.intent,
        classes: [{ ...entry, classLevel: level }],
        hitpoints: {
          ...hitpoints,
          levels: Array.from(
            { length: level },
            (_, index) =>
              hitpoints.levels[index] ?? {
                level: index + 1,
                classId: entry.classId,
                classLevel: index + 1,
                value: 6
              }
          )
        }
      }
    }
  }
}

describe('Sheet play on a held Character', () => {
  it('refuses Convex play, commits the owner through the room and refuses a non-owner', async () => {
    const base = await heldCharacter()
    const initial = await base.play()
    const unchanged = await base.storage()

    // Convex refuses the command and writes nothing.
    const command = base.adjust('DAMAGE', 3, initial.streamVersion)
    await expect(
      base.player.caller.mutation(api.characters.sheetCommands.execute, {
        id: base.characterId,
        command: command.command
      })
    ).rejects.toThrow(HELD)
    expect(await base.storage()).toEqual(unchanged)

    // A player who does not own the Character is refused through the room with no write.
    await expectRedactedRoomRefusal(
      executeSheetInRoom(base.other.caller, command),
      'Assigned Character not found.',
      'DOMAIN_REJECTED'
    )
    expect(await base.storage()).toEqual(unchanged)

    // The owner's command commits in the room and reaches Convex with its checkpoint.
    const acknowledgement = await executeSheetInRoom(base.player.caller, command)
    const committed = await base.play()
    expect(committed).toMatchObject({
      currentHitPoints: initial.currentHitPoints - 3,
      streamVersion: initial.streamVersion + 1
    })
    expect(acknowledgement.streamVersion).toBe(committed.streamVersion)
    const { receipts } = await base.settled()
    expect(receipts).toEqual([expect.objectContaining({ commandId: command.command.commandId })])

    // The same command ID again returns the same acknowledgement and writes nothing.
    const afterCommit = await base.storage()
    expect(await executeSheetInRoom(base.player.caller, command)).toEqual(acknowledgement)
    expect(await base.storage()).toEqual(afterCommit)
  }, 120000)

  it('keeps Builder edits committing in Convex and reloads them into the next room command', async () => {
    const base = await heldCharacter()
    const initial = await base.play()
    const damaged = await executeSheetInRoom(
      base.player.caller,
      base.adjust('DAMAGE', 3, initial.streamVersion)
    )
    const before = await base.play()
    expect(before.currentHitPoints).toBe(initial.currentHitPoints - 3)
    const play = await base.storage()

    // A level-up while held changes the Builder record and leaves play untouched in Convex.
    await base.builderEdit(atLevel(2, 'Held level two'))
    const edited = await base.storage()
    expect(edited.character!.label).toBe('Held level two')
    expect(edited.character!.play).toEqual(play.character!.play)
    expect(edited.headers).toEqual(play.headers)

    // The next room command reloads it: the room-set current HP survives and the maximum rises.
    // The reload changes the play state, so the Sheet feed shows the Character one version ahead;
    // a command at Convex's version is refused as stale and rolls its reload back.
    await expect(
      executeSheetInRoom(base.player.caller, base.adjust('DAMAGE', 1, damaged.streamVersion))
    ).rejects.toThrow('Character Sheet changed')
    expect(await base.storage()).toEqual(edited)
    const raised = await executeSheetInRoom(
      base.player.caller,
      base.adjust('DAMAGE', 1, damaged.streamVersion + 1)
    )
    const levelTwo = await base.play()
    expect(raised.streamVersion).toBe(levelTwo.streamVersion)
    expect(levelTwo.label).toBe('Held level two')
    expect(levelTwo.maximumHitPoints).toBeGreaterThan(initial.maximumHitPoints)
    expect(levelTwo.currentHitPoints).toBe(before.currentHitPoints - 1)

    // Healing to the new maximum puts current HP above the level-one maximum.
    const healed = await executeSheetInRoom(
      base.player.caller,
      base.adjust('HEAL', levelTwo.maximumHitPoints, raised.streamVersion)
    )
    expect((await base.play()).currentHitPoints).toBe(levelTwo.maximumHitPoints)

    // A level-down while held clamps current HP to the lower maximum on the next room command.
    await base.builderEdit(atLevel(1, 'Held level one'))
    await executeSheetInRoom(base.player.caller, base.adjust('DAMAGE', 1, healed.streamVersion + 1))
    expect(await base.play()).toMatchObject({
      label: 'Held level one',
      maximumHitPoints: initial.maximumHitPoints,
      currentHitPoints: initial.maximumHitPoints - 1
    })
  }, 120000)

  it('commits a note through only its note records and reloads it into the next room command', async () => {
    const base = await heldCharacter()
    const initial = await base.play()
    const damaged = await executeSheetInRoom(
      base.player.caller,
      base.adjust('DAMAGE', 2, initial.streamVersion)
    )
    const play = await base.storage()
    const totals = createDatabaseIoTotals()
    await base.player.caller.run((ctx) =>
      executeCharacterSheetCommandAcknowledgement(
        { ...ctx, db: countDatabaseIo(ctx.db, totals) },
        base.player.userId,
        {
          id: base.characterId,
          command: {
            type: 'CREATE_NOTE',
            commandId: crypto.randomUUID(),
            expectedVersion: damaged.streamVersion,
            title: 'Held note',
            groupId: 'session-notes'
          }
        }
      )
    )
    for (const table of Object.keys(characterCollectionSchemas)) {
      if (table === 'characterNotes' || table === 'characterNoteGroups') continue
      expect(totals.reads.byTable[table], table).toBeUndefined()
      expect(totals.writes.byTable[table], table).toBeUndefined()
    }
    // The room keeps play: only the build counts and its structure clock are rewritten.
    expect(totals.writes.byTable.replace?.documents).toBe(1)
    expect(totals.writes.byTable.patch).toBeUndefined()
    const noted = await base.storage()
    expect(noted.character!.play).toEqual(play.character!.play)
    // The built-in Session Notes group is materialized as the one written group row.
    const groups = readCharacterRecord(noted.character!).state.noteGroups
    expect(groups).toEqual([expect.objectContaining({ kind: 'SESSION', label: 'Session Notes' })])
    const note = [expect.objectContaining({ title: 'Held note', groupId: groups![0]!.id })]
    expect(readCharacterRecord(noted.character!).state.notes).toEqual(note)

    // The next room command reloads the note with the room-set hit points intact.
    await invalidateRoomInputs(base.campaign.id, ['CHARACTER'])
    await executeSheetInRoom(base.player.caller, base.adjust('DAMAGE', 1, damaged.streamVersion))
    const settled = (await base.settled()).character!
    expect(readCharacterRecord(settled).state.notes).toEqual(note)
    expect(readCharacterRecord(settled).state.hitpoints.current).toBe(initial.currentHitPoints - 3)
  }, 120000)

  it('ends a held Character’s active effect for the GM only and lowers current hit points to the new maximum (D99)', async () => {
    let effectId = ''
    const base = await heldCharacter(async ({ t, run, character }) => {
      const characterId = character.sourceId
      if (!characterId) throw new Error('Missing held Character source.')
      const effect = await t.run((ctx) =>
        createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).create({
          id: crypto.randomUUID(),
          owner: { kind: 'CHARACTER', characterId },
          definition: plannedModifierGrant({
            encounterId: run.id,
            sourceActorId: character.id,
            holderActorId: character.id,
            lifecycle: {},
            effect: aidAtSecondLevel(),
            rounds: 30,
            lifetimeScope: 'OWNER'
          }).definition,
          lifecycle: { schemaVersion: 1, remainingTicks: 30 }
        })
      )
      effectId = effect.id
    })
    const initial = await base.play()
    const effectIds = () =>
      base.t.run(async (ctx) =>
        (
          await ctx.db
            .query('characterActiveRuleEffects')
            .withIndex('by_characterId_id', (q) => q.eq('characterId', base.characterId))
            .collect()
        ).map(({ id }) => id)
      )
    const boosted = initial.maximumHitPoints + 5
    const set = await executeSheetInRoom(base.owner.caller, {
      scope: 'CHARACTER_SHEET',
      characterId: base.characterId,
      encounterId: base.run.id,
      command: {
        type: 'SET_HIT_POINTS',
        commandId: crypto.randomUUID(),
        expectedVersion: initial.streamVersion,
        current: boosted
      }
    })
    expect((await base.play()).currentHitPoints).toBe(boosted)
    const end = {
      scope: 'CHARACTER_SHEET' as const,
      characterId: base.characterId,
      encounterId: base.run.id,
      command: {
        type: 'END_ACTIVE_EFFECT' as const,
        commandId: crypto.randomUUID(),
        expectedVersion: set.streamVersion,
        effectId
      }
    }

    await expect(executeSheetInRoom(base.player.caller, end)).rejects.toThrow(
      'Only the Campaign owner can end an active effect.'
    )
    expect(await effectIds()).toEqual([effectId])

    const ended = await executeSheetInRoom(base.owner.caller, end)
    expect(ended.streamVersion).toBe(set.streamVersion + 1)
    expect(await base.play()).toMatchObject({
      currentHitPoints: initial.maximumHitPoints,
      streamVersion: ended.streamVersion
    })
    expect(await effectIds()).toEqual([])
  }, 120000)

  describe('ending a grant its holder may end (D113)', () => {
    /** Aid granted twice, one end costing a bonus action and one free, each with its `holderEnd`. */
    async function holdingEndableGrants(automationMode: 'ASSISTED' | 'MANUAL' = 'ASSISTED') {
      // A Manual Run is stored before the room claims it, as START freezes the mode.
      const ids = { costed: '', free: '' }
      const base = await heldCharacter(async ({ t, run, character }) => {
        const characterId = character.sourceId
        if (!characterId) throw new Error('Missing held Character source.')
        if (automationMode === 'MANUAL') await storeRunAutomationMode(t, run.id, automationMode)
        for (const [kind, activation] of [
          ['costed', 'BONUS_ACTION'],
          ['free', 'FREE']
        ] as const) {
          const effect = await t.run((ctx) =>
            createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).create({
              id: crypto.randomUUID(),
              owner: { kind: 'CHARACTER', characterId },
              definition: plannedModifierGrant({
                encounterId: run.id,
                sourceActorId: character.id,
                holderActorId: character.id,
                lifecycle: { holderEnd: { activation } },
                effect: aidAtSecondLevel(),
                rounds: 30,
                lifetimeScope: 'OWNER'
              }).definition,
              lifecycle: { schemaVersion: 1, remainingTicks: 30 }
            })
          )
          ids[kind] = effect.id
        }
      })
      // The room holds the Character: its ended effect reaches Convex with the checkpoint.
      const effectIds = async () => {
        await checkpointLiveRoom(base.campaign.id)
        return base.t.run(async (ctx) =>
          (
            await ctx.db
              .query('characterActiveRuleEffects')
              .withIndex('by_characterId_id', (q) => q.eq('characterId', base.characterId))
              .collect()
          ).map(({ id }) => id)
        )
      }
      const end = (caller: typeof base.player.caller, effectId: string, expectedVersion: number) =>
        executeSheetInRoom(caller, {
          scope: 'CHARACTER_SHEET',
          characterId: base.characterId,
          encounterId: base.run.id,
          command: {
            type: 'END_ACTIVE_EFFECT',
            commandId: crypto.randomUUID(),
            expectedVersion,
            effectId
          }
        })
      return { ...base, ids, effectIds, end }
    }

    it('lets the player end a free grant at the Sheet, and sends a costed one to the Encounter actions', async () => {
      const held = await holdingEndableGrants()
      const { ids, player, effectIds, end } = held
      const both = [ids.costed, ids.free].sort()
      const { streamVersion } = await held.play()

      await expect(end(player.caller, ids.costed, streamVersion)).rejects.toThrow(
        'End this effect from the Encounter actions.'
      )
      expect((await effectIds()).sort()).toEqual(both)

      const ended = await end(player.caller, ids.free, streamVersion)
      expect(await effectIds()).toEqual([ids.costed])
      expect(ended.streamVersion).toBe(streamVersion + 1)
    }, 120000)

    it('lets the player end a costed grant at the Sheet in a Manual Run, which resolves no Encounter commands', async () => {
      const held = await holdingEndableGrants('MANUAL')
      const { ids, player, effectIds, end } = held
      const { streamVersion } = await held.play()

      await end(player.caller, ids.costed, streamVersion)
      expect(await effectIds()).toEqual([ids.free])
    }, 120000)

    it('refuses an effect that has already ended, and a member who does not own the Character', async () => {
      const held = await holdingEndableGrants()
      const { ids, player, other, effectIds, end } = held
      const { streamVersion } = await held.play()

      await expectRedactedRoomRefusal(
        end(other.caller, ids.free, streamVersion),
        'Assigned Character not found.',
        'DOMAIN_REJECTED'
      )
      expect((await effectIds()).sort()).toEqual([ids.costed, ids.free].sort())

      const ended = await end(player.caller, ids.free, streamVersion)
      await expect(end(player.caller, ids.free, ended.streamVersion)).rejects.toThrow(
        'Active effect is unavailable.'
      )
      expect(await effectIds()).toEqual([ids.costed])
    }, 120000)
  })
})
