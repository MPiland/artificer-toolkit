import { afterEach, beforeEach, describe, it, vi } from 'vitest'
import { characterSheetCommandExecutionDtoSchema } from '@artificer-toolkit/schema/api/characterSheetCommands'
import { projectCharacterSheetForViewer } from '@artificer-toolkit/rules-runtime/character/campaignCharacterSheet'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { api } from '../_generated/api'
import { executeCharacterSheetCommand } from './sheetCommands'
import { loadCharacterSheetFacts } from './sheetFacts'
import { loadCharacterSheet, projectCharacterSheetFacts } from './sheetPreparation'
import { storeCharacterSheetSections } from './sheetSectionDerivation'

const now = performance.now.bind(performance)

describe('probe', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())
  it('times phases', async () => {
    const { player, character } = await setupCharacterRun()
    const readVersion = async () =>
      (await player.caller.query(api.characters.sheet.get, { id: character.id }))!.meta.streamVersion
    const t: Record<string, number[]> = {}
    const time = async <T>(k: string, f: () => Promise<T> | T) => {
      const s = now()
      const r = await f()
      ;(t[k] ??= []).push(Math.round(now() - s))
      return r
    }
    for (let i = 0; i < 6; i++) {
      const version = await readVersion()
      const result = await player.caller.run((ctx) =>
        time('execute', () =>
          executeCharacterSheetCommand(ctx, player.userId, {
            id: character.id,
            command: {
              type: 'ADJUST_HIT_POINTS',
              commandId: crypto.randomUUID(),
              expectedVersion: version,
              mode: 'DAMAGE',
              amount: 1
            }
          })
        )
      )
      await time('dtoParse', () => characterSheetCommandExecutionDtoSchema.parse(result))
      await player.caller.run(async (ctx) => {
        await time('loadSheet', () => loadCharacterSheet(ctx, player.userId, character.id))
        const facts = (await time('facts', () =>
          loadCharacterSheetFacts(ctx, player.userId, character.id)
        ))!
        const projected = await time('project', () => projectCharacterSheetFacts(facts))
        const viewed = await time('viewer', () =>
          projectCharacterSheetForViewer(projected.sheet, projected.campaignContext)
        )
        void viewed
        await time('store', () => storeCharacterSheetSections(ctx, facts as never))
      })
    }
    throw new Error("PROBE " + JSON.stringify(t))
  }, 300_000)
})
