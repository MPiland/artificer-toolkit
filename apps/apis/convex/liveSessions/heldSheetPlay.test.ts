import { describe, expect, it } from 'vitest'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { playerControlFixture } from '../../tests/fixtures/playerControl'
import {
  checkpointLiveRoom,
  executeSheetInRoom,
  expectRedactedRoomRefusal,
  invalidateRoomInputs,
  readRoomEncounterSession,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { api } from '../_generated/api'
import { readCharacterRecord } from '../characters/stateDocuments'

/**
 * Sheet play on a Character its live room holds (R06.3, V14.5): Convex refuses play and writes
 * nothing, the owner's play commits through the room and checkpoints to Convex, and Builder edits
 * keep committing in Convex and reach the next room command through its reload.
 */

useLocalRoomWorker()

const HELD = 'This Character is held by its live table; use the room for play commands.'

type Character = ReturnType<typeof characterAuthoredDtoSchema.parse>

async function heldCharacter() {
  const base = await playerControlFixture()
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
    // convex-test runs no scheduler, so the notice Convex sends the room about the edit goes here.
    await invalidateRoomInputs(base.campaign.id, ['CHARACTER'])
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
})
