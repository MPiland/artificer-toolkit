import { describe, expect, it } from 'vitest'
import { authoredDraftCommandInputSchema } from '@artificer-toolkit/schema/api/authoredDrafts'
import { characterBuilderResolveInputSchema } from '@artificer-toolkit/schema/api/characterBuilderQueries'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { evaluateBuilderCandidate } from '../../tests/fixtures/builderEvaluation'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { api } from '../_generated/api'

describe('Character source-change journeys (BUILDER-3)', () => {
  it('reconciles a Character through a same-source replacement, then repairs it after authored deletion', async () => {
    const { t, owner, createCharacter } = await readyCharacterFixture()
    const paginationOpts = { cursor: null, numItems: 48 }
    const authored = {
      ...acolyte,
      id: crypto.randomUUID(),
      userId: owner.userId,
      label: 'Owned background',
      features: [],
      startingEquipment: undefined
    }
    const save = (document: typeof authored) =>
      owner.caller.mutation(
        api.content.drafts.save,
        authoredDraftCommandInputSchema.parse({
          subjectKind: 'BACKGROUND',
          subjectId: document.id,
          systemId: document.systemId,
          label: document.label,
          payload: JSON.parse(JSON.stringify(document))
        })
      )
    const publish = async (document: typeof authored) => {
      const saved = await save(document)
      if (!saved.updatedAt) throw new Error('Missing publication timestamp.')
      await owner.caller.mutation(api.content.publication.publishDraft, {
        subjectKind: 'BACKGROUND',
        subjectId: saved.subjectId,
        expectedDraftUpdatedAt: saved.updatedAt
      })
    }
    const evaluate = (candidate: unknown) =>
      evaluateBuilderCandidate(
        t,
        owner.caller,
        owner.userId,
        characterBuilderResolveInputSchema.parse(candidate)
      )

    // 1-2. Build on the owned Background's chosen language grant, commit and take damage.
    await publish(authored)
    const first = await createCharacter()
    const initial = {
      ...first.character,
      intent: {
        ...first.character.intent,
        background: { backgroundId: authored.id },
        startingEquipment: { ...first.character.intent.startingEquipment, background: undefined }
      }
    }
    const initialCandidate = {
      expectedDraftId: first.draft.id,
      mode: 'create' as const,
      character: initial
    }
    const languageChoice = (await (await evaluate(initialCandidate)).resolve()).view.background
      .grantChoices[0]
    if (!languageChoice) throw new Error('Missing owned background language choice.')
    const character = {
      ...initial,
      intent: {
        ...initial.intent,
        chosenGrantSelections: [
          {
            id: crypto.randomUUID(),
            grantId: languageChoice.grantId,
            source: languageChoice.source,
            timing: languageChoice.timing,
            targetIds: languageChoice.options.slice(0, 2).map((option) => option.id)
          }
        ]
      }
    }
    const candidate = { ...initialCandidate, character }
    expect((await (await evaluate(candidate)).resolve()).resolution.readiness.ready).toBe(true)
    const committed = await owner.caller.mutation(api.characters.commit.commit, candidate)
    expect(committed.character.intent.chosenGrantSelections).toHaveLength(1)
    const damaged = await owner.caller.mutation(api.characters.sheetCommands.execute, {
      id: character.id,
      command: {
        type: 'ADJUST_HIT_POINTS',
        commandId: crypto.randomUUID(),
        expectedVersion: committed.streamVersion,
        mode: 'DAMAGE',
        amount: 3
      }
    })
    const played = await owner.caller.query(api.characters.sheet.get, { id: character.id })
    expect(played).not.toBeNull()
    const damagedCharacter = await owner.caller.query(api.characters.builder.activeCharacter, {
      id: character.id
    })
    if (!damagedCharacter) throw new Error('Missing damaged Character.')
    const hitPoints = damagedCharacter.state.hitpoints.current
    expect(hitPoints).toBeLessThan(committed.character.state.hitpoints.current)
    const inventory = damagedCharacter.state.equipment.inventory

    // 3-4. The author replaces the publication without the chosen grant; the Builder reconciles it.
    await publish({ ...authored, label: 'Published revision', proficiencies: [] })
    const edit = await owner.caller.mutation(api.characters.drafts.create, {
      id: character.id,
      systemId: character.systemId
    })
    const editCandidate = {
      expectedDraftId: edit.id,
      mode: 'edit' as const,
      character: { ...edit.payload.character, status: 'DRAFT' as const }
    }
    expect(editCandidate.character.intent.chosenGrantSelections).toEqual(
      character.intent.chosenGrantSelections
    )
    const savedEdit = await owner.caller.mutation(api.characters.drafts.save, {
      expectedDraftId: edit.id,
      characterId: character.id,
      mode: 'edit',
      character: editCandidate.character
    })
    const canonicalBefore = await owner.caller.query(api.characters.builder.activeCharacter, {
      id: character.id
    })
    const preview = await (await evaluate(editCandidate)).preview()
    expect(preview.character.intent.chosenGrantSelections).toBeUndefined()
    expect(preview.character.state.hitpoints.current).toBe(hitPoints)
    expect(preview.character.state.equipment.inventory).toEqual(inventory)
    expect(await owner.caller.query(api.characters.drafts.get, { id: character.id })).toEqual(
      savedEdit
    )
    expect(
      await owner.caller.query(api.characters.builder.activeCharacter, { id: character.id })
    ).toEqual(canonicalBefore)
    const reconciled = await owner.caller.mutation(api.characters.commit.commit, editCandidate)
    expect(reconciled).toMatchObject({
      publicId: committed.publicId,
      streamVersion: damaged.streamVersion,
      character: { id: character.id, status: 'ACTIVE' }
    })
    expect(reconciled.character.intent.chosenGrantSelections).toBeUndefined()
    expect(reconciled.character.state.hitpoints.current).toBe(hitPoints)
    expect(reconciled.character.state.equipment.inventory).toEqual(inventory)
    expect(await owner.caller.query(api.characters.sheet.get, { id: character.id })).not.toBeNull()

    // 5. Authored deletion turns the Character into a repair row that keeps identity and state.
    await owner.caller.mutation(api.content.deletion.deleteActive, {
      subjectKind: 'BACKGROUND',
      subjectId: authored.id
    })
    expect(
      (await owner.caller.query(api.characters.list.list, { paginationOpts })).page[0]
    ).toMatchObject({ id: character.id, publicId: committed.publicId, status: 'DRAFT' })
    await expect(
      owner.caller.query(api.characters.sheet.get, { id: character.id })
    ).rejects.toThrow('Builder repair')
    const sheetCommand = (expectedVersion: number) =>
      owner.caller.mutation(api.characters.sheetCommands.execute, {
        id: character.id,
        command: {
          type: 'ADJUST_HIT_POINTS',
          commandId: crypto.randomUUID(),
          expectedVersion,
          mode: 'HEAL',
          amount: 1
        }
      })
    await expect(sheetCommand(damaged.streamVersion)).rejects.toThrow('Builder repair')
    const repairRow = await owner.caller.query(api.characters.builder.activeCharacter, {
      id: character.id
    })
    expect(repairRow).toMatchObject({ id: character.id, status: 'DRAFT' })
    expect(repairRow?.state.hitpoints.current).toBe(hitPoints)
    expect(repairRow?.state.equipment.inventory).toEqual(inventory)

    // 6. The Builder repairs it: unchanged is rejected; choosing a ready Background activates it.
    const repair = await owner.caller.mutation(api.characters.drafts.create, {
      id: character.id,
      systemId: character.systemId
    })
    await expect(
      owner.caller.mutation(api.characters.commit.commit, {
        expectedDraftId: repair.id,
        mode: 'edit',
        character: repair.payload.character
      })
    ).rejects.toThrow('not ready to activate')
    expect(
      await owner.caller.query(api.characters.builder.activeCharacter, { id: character.id })
    ).toEqual(repairRow)
    const repaired = await owner.caller.mutation(api.characters.commit.commit, {
      expectedDraftId: repair.id,
      mode: 'edit',
      character: {
        ...repair.payload.character,
        intent: {
          ...repair.payload.character.intent,
          background: first.character.intent.background,
          startingEquipment: first.character.intent.startingEquipment
        }
      }
    })
    expect(repaired).toMatchObject({
      publicId: committed.publicId,
      character: { id: character.id, status: 'ACTIVE' }
    })
    expect(repaired.character.state.hitpoints.current).toBe(hitPoints)
    expect(repaired.character.state.equipment.inventory).toEqual(inventory)
    expect(await owner.caller.query(api.characters.sheet.get, { id: character.id })).not.toBeNull()
    await sheetCommand(repaired.streamVersion)
    expect(
      (await owner.caller.query(api.characters.builder.activeCharacter, { id: character.id }))
        ?.state.hitpoints.current
    ).toBe(hitPoints + 1)
  })
})
