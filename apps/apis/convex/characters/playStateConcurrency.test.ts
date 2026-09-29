import { describe, expect, it } from 'vitest'
import { SRD_SPEEDS, srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { api } from '../_generated/api'
import { readCharacterRecord } from './stateDocuments'

async function openEdit() {
  const fixture = await readySheetFixture()
  const before = await fixture.readState()
  if (!before.character) throw new Error('Missing Character.')
  const draft = await fixture.owner.caller.mutation(api.characters.drafts.create, {
    id: fixture.character.id,
    systemId: srdSystemRecord.id
  })
  const damage = (expectedVersion: number, amount: number) =>
    fixture.owner.caller.mutation(api.characters.sheetCommands.execute, {
      id: fixture.character.id,
      command: {
        type: 'ADJUST_HIT_POINTS',
        commandId: crypto.randomUUID(),
        expectedVersion,
        mode: 'DAMAGE',
        amount
      }
    })
  const commit = (character: ReturnType<typeof readCharacterRecord>) =>
    fixture.owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: draft.id,
      mode: 'edit',
      character
    })
  return { ...fixture, before: before.character, damage, commit }
}

describe('Character play state versus Builder structure', () => {
  it('keeps both a Builder save and a play change that run concurrently', async () => {
    const { before, damage, commit, readState } = await openEdit()
    const results = await Promise.allSettled([
      commit({ ...readCharacterRecord(before), label: 'Renamed' }),
      damage(before.play.streamVersion, 3)
    ])
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'fulfilled'])
    const after = (await readState()).character
    if (!after) throw new Error('Missing Character.')
    const document = readCharacterRecord(after)
    expect(document.label).toBe('Renamed')
    expect(document.state.hitpoints.current).toBe(before.play.maximumHitPoints - 3)
    expect(after.play.streamVersion).toBe(before.play.streamVersion + 1)
  })

  it('leaves the structure row untouched by a play change', async () => {
    const { before, damage, readState } = await openEdit()
    await damage(before.play.streamVersion, 2)
    const after = (await readState()).character
    if (!after) throw new Error('Missing Character.')
    expect(after.checksum).toBe(before.checksum)
    expect(after.updatedAt).toBe(before.updatedAt)
    expect(after.play.streamVersion).toBe(before.play.streamVersion + 1)
  })

  it('rejects a stale play command against the play version, not the Builder save', async () => {
    const { before, damage, commit, readState } = await openEdit()
    await commit({ ...readCharacterRecord(before), label: 'Renamed' })
    // The Builder commit changed no play state, so the version the Sheet read is still current.
    await damage(before.play.streamVersion, 1)
    await expect(damage(before.play.streamVersion, 1)).rejects.toThrow()
    const after = (await readState()).character
    expect(after?.play.streamVersion).toBe(before.play.streamVersion + 1)
  })

  it('clamps current hit points to a lower committed maximum', async () => {
    const { before, commit, readState } = await openEdit()
    const current = readCharacterRecord(before)
    const abilities = current.intent.abilities
    if (abilities?.method !== 'STANDARD_ARRAY') throw new Error('Expected a standard array.')
    // Swap Constitution 13 and Charisma 8: the Constitution modifier falls from +1 to -1.
    await commit({
      ...current,
      intent: {
        ...current.intent,
        abilities: {
          ...abilities,
          assignments: abilities.assignments.map((assignment) =>
            assignment.ability === 'CONSTITUTION'
              ? { ...assignment, option: '8' as const }
              : assignment.ability === 'CHARISMA'
                ? { ...assignment, option: '13' as const }
                : assignment
          )
        }
      }
    })
    const after = (await readState()).character
    if (!after) throw new Error('Missing Character.')
    expect(after.play.maximumHitPoints).toBeLessThan(before.play.maximumHitPoints)
    expect(readCharacterRecord(after).state.hitpoints.current).toBe(after.play.maximumHitPoints)
    expect(after.play.streamVersion).toBe(before.play.streamVersion + 1)
  })

  it('rejects a stale Builder draft after a Sheet command changes structure', async () => {
    const { before, character, commit, owner } = await openEdit()
    const walk = SRD_SPEEDS.find((speed) => speed.code === 'WALK')!
    await owner.caller.mutation(api.characters.sheetCommands.execute, {
      id: character.id,
      command: {
        type: 'UPSERT_SHEET_ADJUSTMENT',
        commandId: crypto.randomUUID(),
        expectedVersion: before.play.streamVersion,
        adjustment: { family: 'MOVEMENT', speedId: walk.id, field: 'SPEED_OVERRIDE', value: 45 }
      }
    })
    await expect(commit(readCharacterRecord(before))).rejects.toThrow('changed')
  })
})
