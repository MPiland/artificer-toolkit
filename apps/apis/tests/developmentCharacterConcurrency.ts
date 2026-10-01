import assert from 'node:assert/strict'
import type { CharacterBuilderResolveInput } from '@artificer-toolkit/schema/api/characterBuilderQueries'
import type { CharacterSheetSliceDtoMap } from '@artificer-toolkit/schema/api/characterSheetSlices'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import type { DevelopmentClient } from './developmentClient'
import { api } from '../convex/_generated/api.js'

export async function verifyCharacterConcurrency({
  owner,
  peer,
  foreign,
  anonymous,
  first,
  second
}: {
  owner: DevelopmentClient
  peer: DevelopmentClient
  foreign: DevelopmentClient
  anonymous: DevelopmentClient
  first: CharacterBuilderResolveInput
  second: CharacterBuilderResolveInput
}) {
  async function readSlice<Slice extends 'COMMON' | 'NOTES'>(
    client: DevelopmentClient,
    slice: Slice
  ) {
    const response = await client.query(api.characters.sheetSlices.get, {
      id: first.character.id,
      slice
    })
    assert.ok(response && response.slice === slice)
    return response.data as CharacterSheetSliceDtoMap[Slice]
  }

  const creates = await Promise.allSettled([
    owner.mutation(api.characters.commit.commit, first),
    peer.mutation(api.characters.commit.commit, first)
  ])
  assert.equal(creates.filter((result) => result.status === 'fulfilled').length, 1)
  const create = creates.find((result) => result.status === 'fulfilled')
  if (!create || create.status !== 'fulfilled') throw new Error('Character create did not succeed.')
  const rejectedCreate = creates.find((result) => result.status === 'rejected')
  if (!rejectedCreate || rejectedCreate.status !== 'rejected')
    throw new Error('Character create did not reject a duplicate contender.')
  if (!(rejectedCreate.reason instanceof Error)) throw rejectedCreate.reason
  assert.match(
    rejectedCreate.reason.message,
    /Character draft is unavailable for the current user\./
  )
  assert.equal(create.value.streamVersion, 1)
  assert.equal(create.value.character.state.equipment.inventory.length, 1)
  assert.equal(create.value.character.state.equipment.inventory[0]?.quantity, 2)
  await assert.rejects(
    () => owner.mutation(api.characters.commit.commit, first),
    /Character draft is unavailable for the current user\./
  )
  const secondCreate = await owner.mutation(api.characters.commit.commit, second)
  assert.equal(secondCreate.streamVersion, 1)

  const originalNoteInput = {
    id: first.character.id,
    command: {
      type: 'CREATE_NOTE' as const,
      commandId: crypto.randomUUID(),
      expectedVersion: 1,
      title: 'Concurrency proof',
      body: 'Stored once',
      groupId: 'session-notes'
    }
  }
  const notes = await Promise.all([
    owner.mutation(api.characters.sheetCommands.execute, originalNoteInput),
    peer.mutation(api.characters.sheetCommands.execute, originalNoteInput)
  ])
  assert.deepEqual(notes[0], notes[1])
  assert.equal(notes[0].characterId, first.character.id)
  assert.equal('sheet' in notes[0], false)
  assert.equal('panels' in notes[0], false)
  assert.equal(notes[0].streamVersion, 2)
  assert.equal(notes[1].streamVersion, 2)
  const notedSheet = await readSlice(owner, 'COMMON')
  assert.ok(notedSheet)
  assert.equal(notedSheet.meta.streamVersion, 2)
  const notedNotes = await readSlice(owner, 'NOTES')
  assert.equal(notedNotes.meta.streamVersion, 2)
  assert.equal(notedNotes.notes.items?.length, 1)
  assert.deepEqual(await readSlice(peer, 'NOTES'), notedNotes)
  assert.equal(
    await foreign.query(api.characters.sheetSlices.get, { id: first.character.id, slice: 'NOTES' }),
    null
  )
  await assert.rejects(
    () =>
      anonymous.query(api.characters.sheetSlices.get, { id: first.character.id, slice: 'NOTES' }),
    /Unauthenticated/
  )
  assert.deepEqual(await readSlice(peer, 'COMMON'), notedSheet)
  const conflict = await Promise.allSettled([
    owner.mutation(api.characters.sheetCommands.execute, {
      id: first.character.id,
      command: {
        type: 'SET_INSPIRATION' as const,
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        inspired: true
      }
    }),
    peer.mutation(api.characters.sheetCommands.execute, {
      id: first.character.id,
      command: {
        type: 'SET_INSPIRATION' as const,
        commandId: crypto.randomUUID(),
        expectedVersion: 2,
        inspired: false
      }
    })
  ])
  assert.equal(conflict.filter((result) => result.status === 'fulfilled').length, 1)
  const winningConflict = conflict.find((result) => result.status === 'fulfilled')
  if (!winningConflict || winningConflict.status !== 'fulfilled')
    throw new Error('Character Sheet conflict did not have a winner.')
  const rejectedConflict = conflict.find((result) => result.status === 'rejected')
  if (!rejectedConflict || rejectedConflict.status !== 'rejected')
    throw new Error('Character Sheet conflict did not reject a contender.')
  if (!(rejectedConflict.reason instanceof Error)) throw rejectedConflict.reason
  assert.match(
    rejectedConflict.reason.message,
    /Character Sheet changed; refresh before applying this command\./
  )
  assert.equal(winningConflict.value.streamVersion, 3)
  const unrelated = await Promise.all([
    owner.mutation(api.characters.sheetCommands.execute, {
      id: first.character.id,
      command: {
        type: 'SET_INSPIRATION' as const,
        commandId: crypto.randomUUID(),
        expectedVersion: 3,
        inspired: true
      }
    }),
    peer.mutation(api.characters.sheetCommands.execute, {
      id: second.character.id,
      command: {
        type: 'SET_INSPIRATION' as const,
        commandId: crypto.randomUUID(),
        expectedVersion: 1,
        inspired: true
      }
    })
  ])
  assert.equal(unrelated[0].streamVersion, 4)
  assert.equal(unrelated[1].streamVersion, 2)
  const unrelatedSheet = await readSlice(owner, 'COMMON')
  assert.ok(unrelatedSheet)
  assert.equal(unrelatedSheet.meta.streamVersion, 4)
  assert.equal(unrelatedSheet.overview.inspiration, true)
  const unrelatedNotes = await readSlice(owner, 'NOTES')
  assert.equal(unrelatedNotes.meta.streamVersion, 4)
  assert.deepEqual(unrelatedNotes.notes, notedNotes.notes)
  const replay = await owner.mutation(api.characters.sheetCommands.execute, originalNoteInput)
  assert.deepEqual(replay, { ...notes[0], streamVersion: 4 })
  await assert.rejects(
    () =>
      owner.mutation(api.characters.sheetCommands.execute, {
        ...originalNoteInput,
        command: { ...originalNoteInput.command, title: 'Mismatch' }
      }),
    /Sheet command replay does not match the original command\./
  )
  await assert.rejects(
    () =>
      owner.mutation(api.characters.sheetCommands.execute, {
        id: first.character.id,
        command: {
          ...originalNoteInput.command,
          commandId: crypto.randomUUID(),
          expectedVersion: 1
        }
      }),
    /Character Sheet changed; refresh before applying this command\./
  )
  await assert.rejects(
    () => foreign.mutation(api.characters.sheetCommands.execute, originalNoteInput),
    /Character Sheet is unavailable for the current user\./
  )
  await assert.rejects(
    () => anonymous.mutation(api.characters.sheetCommands.execute, originalNoteInput),
    /Unauthenticated/
  )
  assert.deepEqual(await readSlice(owner, 'COMMON'), unrelatedSheet)
  assert.deepEqual(await readSlice(owner, 'NOTES'), unrelatedNotes)
  const staleEdit = await owner.mutation(api.characters.drafts.create, {
    id: first.character.id,
    systemId: first.character.systemId
  })
  const staleSheetUpdate = await owner.mutation(api.characters.sheetCommands.execute, {
    id: first.character.id,
    command: {
      type: 'CREATE_NOTE_GROUP' as const,
      commandId: crypto.randomUUID(),
      expectedVersion: 4,
      label: 'Stale baseline'
    }
  })
  assert.equal(staleSheetUpdate.streamVersion, 5)
  const staleSheet = await readSlice(owner, 'COMMON')
  assert.ok(staleSheet)
  assert.equal(staleSheet.meta.streamVersion, staleSheetUpdate.streamVersion)
  const staleNotes = await readSlice(owner, 'NOTES')
  assert.equal(staleNotes.meta.streamVersion, staleSheetUpdate.streamVersion)
  const staleCandidate: CharacterBuilderResolveInput = {
    expectedDraftId: staleEdit.id,
    mode: 'edit',
    character: characterAuthoredDtoSchema.parse(staleEdit.payload.character)
  }
  await assert.rejects(
    () => owner.mutation(api.characters.commit.commit, staleCandidate),
    /Character changed since this draft opened; reopen it before committing\./
  )
  assert.deepEqual(
    await owner.query(api.characters.drafts.get, { id: first.character.id }),
    staleEdit
  )
  assert.deepEqual(await readSlice(owner, 'COMMON'), staleSheet)
  assert.deepEqual(await readSlice(owner, 'NOTES'), staleNotes)
  await owner.mutation(api.characters.drafts.discard, {
    id: first.character.id,
    expectedDraftId: staleEdit.id
  })
  const freshEdit = await owner.mutation(api.characters.drafts.create, {
    id: first.character.id,
    systemId: first.character.systemId
  })
  await assert.rejects(
    () => owner.mutation(api.characters.commit.commit, staleCandidate),
    /Character draft generation changed; reopen it before committing\./
  )
  assert.deepEqual(
    await owner.query(api.characters.drafts.get, { id: first.character.id }),
    freshEdit
  )
  const freshCandidate: CharacterBuilderResolveInput = {
    expectedDraftId: freshEdit.id,
    mode: 'edit',
    character: characterAuthoredDtoSchema.parse(freshEdit.payload.character)
  }
  const edits = await Promise.allSettled([
    owner.mutation(api.characters.commit.commit, freshCandidate),
    peer.mutation(api.characters.commit.commit, freshCandidate)
  ])
  assert.equal(edits.filter((result) => result.status === 'fulfilled').length, 1)
  const winningEdit = edits.find((result) => result.status === 'fulfilled')
  if (!winningEdit || winningEdit.status !== 'fulfilled')
    throw new Error('Character edit did not succeed.')
  const rejectedEdit = edits.find((result) => result.status === 'rejected')
  if (!rejectedEdit || rejectedEdit.status !== 'rejected')
    throw new Error('Character edit did not reject a duplicate contender.')
  if (!(rejectedEdit.reason instanceof Error)) throw rejectedEdit.reason
  assert.match(rejectedEdit.reason.message, /Character draft is unavailable for the current user\./)
  // A Builder commit that leaves play state alone does not advance the play stream.
  assert.equal(winningEdit.value.streamVersion, 5)
  assert.deepEqual(
    winningEdit.value.character.state.equipment.inventory,
    create.value.character.state.equipment.inventory
  )
  const currentSheet = await readSlice(owner, 'COMMON')
  assert.ok(currentSheet)
  assert.equal(currentSheet.meta.streamVersion, 5)
  assert.deepEqual(currentSheet.overview, staleSheet.overview)
  const currentNotes = await readSlice(owner, 'NOTES')
  assert.deepEqual(currentNotes, staleNotes)
  return {
    originalNoteInput,
    originalReceipt: notes[0],
    currentSheet
  }
}
