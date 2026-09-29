import { expect, it } from 'vitest'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { verifyCharacterConcurrency } from '../../tests/developmentCharacterConcurrency'

it('proves Character commit and Sheet command concurrency through native functions', async () => {
  const base = await readyCharacterFixture()
  const first = await base.createCharacter()
  const second = await base.createCharacter()
  const result = await verifyCharacterConcurrency({
    owner: {
      query: (query, ...args) => base.owner.caller.run((ctx) => ctx.runQuery(query, ...args)),
      mutation: (mutation, ...args) =>
        base.owner.caller.run((ctx) => ctx.runMutation(mutation, ...args))
    },
    peer: {
      query: (query, ...args) => base.owner.caller.run((ctx) => ctx.runQuery(query, ...args)),
      mutation: (mutation, ...args) =>
        base.owner.caller.run((ctx) => ctx.runMutation(mutation, ...args))
    },
    foreign: {
      query: (query, ...args) => base.other.caller.run((ctx) => ctx.runQuery(query, ...args)),
      mutation: (mutation, ...args) =>
        base.other.caller.run((ctx) => ctx.runMutation(mutation, ...args))
    },
    anonymous: {
      query: (query, ...args) => base.t.run((ctx) => ctx.runQuery(query, ...args)),
      mutation: (mutation, ...args) => base.t.run((ctx) => ctx.runMutation(mutation, ...args))
    },
    first: { expectedDraftId: first.draft.id, mode: 'create', character: first.character },
    second: { expectedDraftId: second.draft.id, mode: 'create', character: second.character }
  })
  await base.t.run(async (ctx) => {
    const [characters, firstReceipts, firstDraft, secondDraft] = await Promise.all([
      ctx.db.query('characters').collect(),
      ctx.db
        .query('characterCommandReceipts')
        .withIndex('by_characterId_commandId', (q) => q.eq('characterId', first.character.id))
        .collect(),
      ctx.db
        .query('characterDrafts')
        .withIndex('by_characterId', (q) => q.eq('characterId', first.character.id))
        .unique(),
      ctx.db
        .query('characterDrafts')
        .withIndex('by_characterId', (q) => q.eq('characterId', second.character.id))
        .unique()
    ])
    expect(characters.map((character) => character.id).sort()).toEqual(
      [first.character.id, second.character.id].sort()
    )
    expect(
      firstReceipts.filter(
        (receipt) => receipt.commandId === result.originalNoteInput.command.commandId
      )
    ).toHaveLength(1)
    expect(firstReceipts).toHaveLength(4)
    expect(firstDraft).toBeNull()
    expect(secondDraft).toBeNull()
  })
  expect(result.currentSheet.meta.streamVersion).toBe(5)
}, 30000)
