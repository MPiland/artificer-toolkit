import { describe, expect, it } from 'vitest'
import type { CharacterDraftSaveInput } from '@artificer-toolkit/schema/api/characterDrafts'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { srdEquipment } from '@artificer-toolkit/source-data/srd/equipment/index.js'
import { human } from '@artificer-toolkit/source-data/srd/races/human.js'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'
import { insertActiveCharacterRecord } from '../../tests/fixtures/characterRows'
import { fixture, input } from '../../tests/fixtures/characters'
import { countDatabaseIo, createDatabaseIoTotals } from '../../tests/fixtures/databaseIo'
import { api } from '../_generated/api'
import { withSceneVisionTracking } from '../lib/mutations'
import { saveCharacterDraft } from './drafts'

// ADR 0036 S8: an autosave reads the draft head only and writes the head and the payload in place.
const AUTOSAVE_BUDGET_BYTES = 32 * 1024

describe('Character draft autosave budget', () => {
  it('saves a level-5 caster draft in at most 32 KB without reading the old payload', async () => {
    const { t, owner } = await fixture()
    const draft = await owner.caller.mutation(api.characters.drafts.create, input())
    const wizardSpells = srdSpells.filter((spell) => spell.classIds?.includes(wizard.id))
    // A realistic working draft: every Builder step filled, with notes and starting inventory.
    const character = characterAuthoredDtoSchema.parse({
      ...draft.payload.character,
      label: 'Budget wizard',
      profile: {
        ...draft.payload.character.profile,
        backstory: 'Raised in the archive of a forgotten order. '.repeat(40)
      },
      intent: {
        ...draft.payload.character.intent,
        race: { raceId: human.id },
        background: { backgroundId: acolyte.id },
        classes: [{ classId: wizard.id, classLevel: 5 }],
        abilities: {
          method: 'STANDARD_ARRAY',
          assignments: [
            { ability: 'STRENGTH', option: '8' },
            { ability: 'DEXTERITY', option: '14' },
            { ability: 'CONSTITUTION', option: '13' },
            { ability: 'INTELLIGENCE', option: '15' },
            { ability: 'WISDOM', option: '12' },
            { ability: 'CHARISMA', option: '10' }
          ]
        },
        hitpoints: {
          method: 'FIXED',
          levels: [1, 2, 3, 4, 5].map((level) => ({
            level,
            classId: wizard.id,
            classLevel: level,
            value: level === 1 ? 6 : 4
          }))
        },
        spellSelections: [
          {
            id: crypto.randomUUID(),
            source: { kind: 'CLASS', classId: wizard.id, classLevel: 5 },
            timing: { kind: 'IMMEDIATE' },
            spells: [
              ...wizardSpells.filter((spell) => spell.level === 0).slice(0, 4),
              ...wizardSpells.filter((spell) => spell.level > 0 && spell.level <= 3).slice(0, 14)
            ].map((spell) => spell.id)
          }
        ]
      },
      state: {
        ...draft.payload.character.state,
        equipment: {
          ...draft.payload.character.state.equipment,
          inventory: srdEquipment.slice(0, 15).map((equipment) => ({
            id: crypto.randomUUID(),
            equipmentId: equipment.id,
            quantity: 1
          }))
        }
      }
    })
    const save = (label: string): CharacterDraftSaveInput => ({
      characterId: draft.characterId,
      expectedDraftId: draft.id,
      mode: 'create',
      character: { ...character, label },
      builderIntent: { abilities: { activeMethod: 'STANDARD_ARRAY', methods: {} } }
    })
    await owner.caller.mutation(api.characters.drafts.save, save('First save'))

    const totals = createDatabaseIoTotals()
    const saved = await owner.caller.run((ctx) =>
      saveCharacterDraft(
        // Counted beneath the trigger layer, so trigger reads and writes count too.
        withSceneVisionTracking({ ...ctx, db: countDatabaseIo(ctx.db, totals) }),
        save('Autosaved')
      )
    )
    const payloadBytes = JSON.stringify(saved.payload).length
    const measured = {
      payloadKb: Math.round(payloadBytes / 102.4) / 10,
      readKb: Math.round(totals.reads.bytes / 102.4) / 10,
      writeKb: Math.round(totals.writes.bytes / 102.4) / 10,
      reads: totals.reads.byTable,
      writes: totals.writes.byTable
    }
    console.info('S8 autosave I/O', JSON.stringify(measured))

    expect(saved.payload.character.label).toBe('Autosaved')
    expect(await owner.caller.query(api.characters.drafts.get, { id: draft.characterId })).toEqual(
      saved
    )
    expect(totals.reads.bytes + totals.writes.bytes).toBeLessThanOrEqual(AUTOSAVE_BUDGET_BYTES)
    // Only the caller's profile and the draft head are read: never the old payload, the active
    // Character, the System or a document by id.
    expect(Object.keys(totals.reads.byTable).sort()).toEqual(['characterDrafts', 'userProfiles'])
    expect(totals.reads.byTable.characterDrafts?.documents).toBe(1)
    // The head and the payload document are replaced in place; nothing is inserted or deleted.
    expect(Object.keys(totals.writes.byTable).sort()).toEqual(['replace'])
    expect(totals.writes.documents).toBe(2)

    // An edit draft also reads its active row, whose status sets the returned `draftState`.
    await owner.caller.mutation(api.characters.drafts.discard, {
      id: draft.characterId,
      expectedDraftId: draft.id
    })
    const active = { ...character, label: 'Active wizard', status: 'ACTIVE' as const }
    await t.run((ctx) =>
      insertActiveCharacterRecord(ctx, active, {
        createdAt: draft.createdAt!,
        maximumHitPoints: 22,
        walkingSpeed: 30
      })
    )
    const edit = await owner.caller.mutation(api.characters.drafts.create, {
      id: draft.characterId,
      systemId: draft.systemId
    })
    const editSave = (label: string): CharacterDraftSaveInput => ({
      ...save(label),
      expectedDraftId: edit.id,
      mode: 'edit'
    })
    await owner.caller.mutation(api.characters.drafts.save, editSave('First edit'))
    const editTotals = createDatabaseIoTotals()
    const editSaved = await owner.caller.run((ctx) =>
      saveCharacterDraft(
        withSceneVisionTracking({ ...ctx, db: countDatabaseIo(ctx.db, editTotals) }),
        editSave('Autosaved edit')
      )
    )
    console.info(
      'S8 edit autosave I/O',
      JSON.stringify({
        readKb: Math.round(editTotals.reads.bytes / 102.4) / 10,
        writeKb: Math.round(editTotals.writes.bytes / 102.4) / 10,
        reads: editTotals.reads.byTable
      })
    )
    expect(editSaved.draftState).toBe('ACTIVE_WITH_DRAFT')
    expect(editTotals.reads.bytes + editTotals.writes.bytes).toBeLessThanOrEqual(
      AUTOSAVE_BUDGET_BYTES
    )
    expect(Object.keys(editTotals.reads.byTable).sort()).toEqual([
      'characterDrafts',
      'characters',
      'userProfiles'
    ])
  })
})
