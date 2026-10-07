import { expect, it } from 'vitest'
import { setupAutomaticCharacterMovement } from '../../tests/fixtures/automaticCharacterMovement'
import { useMovementReactionsInRoom } from '../../tests/fixtures/automaticSceneMovement'
import {
  checkpointLiveRoom,
  queueRoomRolls,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { api } from '../_generated/api'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'

useLocalRoomWorker()

it('moves a Character whose Sheet changed after Run creation and damages its current hit points', async () => {
  const value = await setupAutomaticCharacterMovement(['AUTOMATIC'])
  const characterId = value.base.character.id
  // Convex holds the Run's Character state current only after the room checkpoints (D85).
  const readCharacter = async () => {
    await checkpointLiveRoom(value.base.campaign.id)
    return value.base.t.run(async (ctx) => {
      const row = await readCharacterRow(ctx, characterId)
      if (!row) throw new Error('Missing moving Character.')
      return {
        streamVersion: row.play.streamVersion,
        hitPoints: readCharacterRecord(row).state.hitpoints.current
      }
    })
  }
  const created = await readCharacter()
  const sheet = await value.player.caller.query(api.characters.sheet.get, { id: characterId })
  if (!sheet) throw new Error('Missing moving Character Sheet.')
  await value.player.caller.mutation(api.characters.sheetCommands.execute, {
    id: characterId,
    command: {
      type: 'ADJUST_HIT_POINTS',
      commandId: crypto.randomUUID(),
      expectedVersion: sheet.meta.streamVersion,
      mode: 'DAMAGE',
      amount: 2
    }
  })
  const edited = await readCharacter()
  expect(edited).toEqual({
    streamVersion: created.streamVersion + 1,
    hitPoints: created.hitPoints - 2
  })

  // The one Use draws an attack d20 (a 15) and the bite dice (the minimum).
  await queueRoomRolls(value.base.campaign.id, { rolls: [14, 0, 0], repeat: 0 })
  const { occurrence } = await useMovementReactionsInRoom(value)
  expect(occurrence).toMatchObject({ status: 'COMPLETE', pending: null })

  const moved = await readCharacter()
  expect(moved.hitPoints).toBe(edited.hitPoints - 1)
  expect(moved.streamVersion).toBeGreaterThan(edited.streamVersion)
  const projection = await value.owner.caller.query(api.encounters.projectionReads.get, {
    encounterId: value.base.run.id
  })
  const mover = projection.actors.find((actor) => actor.sourceId === characterId)
  expect(mover && 'currentHitPoints' in mover ? mover.currentHitPoints : null).toBe(moved.hitPoints)
}, 30_000)
