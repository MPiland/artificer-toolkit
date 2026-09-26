import { expect, it, vi } from 'vitest'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { setupAutomaticCharacterMovement } from '../../tests/fixtures/automaticCharacterMovement'
import { useMovementReactions } from '../../tests/fixtures/automaticSceneMovement'
import { api } from '../_generated/api'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: (sides: number) => (sides === 20 ? 14 : 0) }))

it('moves a Character whose Sheet changed after Run creation and damages its current hit points', async () => {
  const value = await setupAutomaticCharacterMovement(['AUTOMATIC'])
  const characterId = value.base.character.id
  const readCharacter = () =>
    value.base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', characterId))
        .unique()
      if (!row) throw new Error('Missing moving Character.')
      return {
        streamVersion: row.streamVersion,
        hitPoints: characterAuthoredDtoSchema.parse(JSON.parse(row.documentJson)).state.hitpoints
          .current
      }
    })
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

  const { publish, prepared } = await useMovementReactions(value)
  expect(prepared.outcome.kind).toBe('TERMINAL')
  await publish()

  const moved = await readCharacter()
  expect(moved.hitPoints).toBe(edited.hitPoints - 1)
  expect(moved.streamVersion).toBeGreaterThan(edited.streamVersion)
  const projection = await value.owner.caller.query(api.encounters.projectionReads.get, {
    encounterId: value.base.run.id
  })
  const mover = projection.actors.find((actor) => actor.sourceId === characterId)
  expect(mover && 'currentHitPoints' in mover ? mover.currentHitPoints : null).toBe(moved.hitPoints)
}, 30_000)
