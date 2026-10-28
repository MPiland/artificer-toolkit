import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import type { ClassAuthoredDto } from '@artificer-toolkit/schema/subjects/class'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { human } from '@artificer-toolkit/source-data/srd/races/human.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { api } from '../../convex/_generated/api'
import { readCharacterRow } from '../../convex/characters/stateDocuments'
import { readReceiptHeaders } from '../../convex/lib/receiptLedgers'
import { fixture, input } from './characters'
import { importedSubject, importSeededSubjects } from './publication'

export async function readyCharacterFixture(
  {
    base: sourceClass = fighter,
    classLevel = 1,
    subclass,
    ...options
  }: Partial<Pick<typeof fighter | ClassAuthoredDto, 'resources' | 'spellcasting' | 'features'>> & {
    /** The SRD base Class the Character takes; defaults to the Fighter. */
    base?: typeof fighter
    /** The Character's level in that Class; defaults to 1. */
    classLevel?: number
    /** An SRD subclass of that Class the Character has chosen. */
    subclass?: typeof fighter
  } = {},
  equipment = club,
  existing?: Awaited<ReturnType<typeof fixture>>
) {
  if (sourceClass.category !== 'BASE') throw new Error('Expected a canonical parent base class.')
  const base = existing ?? (await fixture())
  const groupId = crypto.randomUUID()
  const optionId = crypto.randomUUID()
  const background = {
    ...acolyte,
    features: [],
    proficiencies: [],
    startingEquipment: {
      id: crypto.randomUUID(),
      sets: [
        {
          id: crypto.randomUUID(),
          order: 0,
          groups: [
            {
              id: groupId,
              order: 0,
              options: [
                {
                  id: optionId,
                  order: 0,
                  items: [
                    {
                      id: crypto.randomUUID(),
                      order: 0,
                      startingEquipmentKind: 'EQUIPMENT' as const,
                      selectionKind: 'GRANTED' as const,
                      authoringModeKind: 'SELECTED' as const,
                      equipmentIds: [equipment.id],
                      quantity: 2
                    },
                    {
                      id: crypto.randomUUID(),
                      order: 1,
                      startingEquipmentKind: 'CURRENCY' as const,
                      currencies: [{ currencyId: sourceClass.startingGold.currencyId, amount: 15 }]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  }
  const baseClass = {
    ...structuredClone(sourceClass),
    ...options,
    features: options.features ?? [],
    proficiencies: [],
    startingEquipment: { ...sourceClass.startingEquipment!, sets: [] }
  }
  await importSeededSubjects(base.t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({ subjectKind: 'RACE', ...human, document: { ...human, features: [] } }),
      importedSubject({ subjectKind: 'CLASS', ...baseClass, document: baseClass }),
      ...(subclass
        ? [importedSubject({ subjectKind: 'CLASS', ...subclass, document: subclass })]
        : []),
      importedSubject({ subjectKind: 'BACKGROUND', ...background, document: background }),
      importedSubject({ subjectKind: 'EQUIPMENT', ...equipment, document: equipment })
    ]
  })
  async function createCharacter(request = input(), caller = base.owner.caller) {
    const draft = await caller.mutation(api.characters.drafts.create, request)
    const character = characterAuthoredDtoSchema.parse({
      ...draft.payload.character,
      label: 'Aria',
      intent: {
        ...draft.payload.character.intent,
        race: { raceId: human.id },
        background: { backgroundId: background.id },
        classes: [
          { classId: baseClass.id, classLevel, ...(subclass ? { subclassId: subclass.id } : {}) }
        ],
        abilities: {
          method: 'STANDARD_ARRAY',
          assignments: [
            { ability: 'STRENGTH', option: '15' },
            { ability: 'DEXTERITY', option: '14' },
            { ability: 'CONSTITUTION', option: '13' },
            { ability: 'INTELLIGENCE', option: '12' },
            { ability: 'WISDOM', option: '10' },
            { ability: 'CHARISMA', option: '8' }
          ]
        },
        hitpoints: {
          method: 'FIXED',
          levels: Array.from({ length: classLevel }, (_, index) => ({
            level: index + 1,
            classId: baseClass.id,
            classLevel: index + 1,
            value: index === 0 ? 10 : 6
          }))
        },
        startingEquipment: {
          class: {
            source: 'CLASS',
            tookGold: true,
            gold: { goldOption: baseClass.startingGold.dieConfig, totalGold: 100 },
            applied: true
          },
          background: {
            source: 'BACKGROUND',
            tookGold: false,
            groups: [{ groupId, optionId }],
            applied: true
          }
        }
      }
    })
    return { ...base, draft, character }
  }
  return { ...base, createCharacter, baseClass }
}

export async function readySheetFixture(
  options: Parameters<typeof readyCharacterFixture>[0] = {},
  equipment?: Parameters<typeof readyCharacterFixture>[1],
  existing?: Parameters<typeof readyCharacterFixture>[2]
) {
  const base = await readyCharacterFixture(options, equipment, existing)
  const { draft, character } = await base.createCharacter()
  const committed = await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
  const readState = () =>
    base.t.run(async (ctx) => {
      const headers = await ctx.db
        .query('characterCommandReceipts')
        .withIndex('by_characterId_commandId', (q) => q.eq('characterId', character.id))
        .collect()
      return {
        character: await readCharacterRow(ctx, character.id),
        receipts: await readReceiptHeaders(ctx, 'characterCommandReceipts', headers)
      }
    })
  // Physical snapshots include orphan bodies so rollback assertions cover the whole publication.
  const readReceiptStorage = () =>
    base.t.run(async (ctx) => ({
      character: await readCharacterRow(ctx, character.id),
      headers: await ctx.db
        .query('characterCommandReceipts')
        .withIndex('by_characterId_commandId', (q) => q.eq('characterId', character.id))
        .collect(),
      ledgers: await ctx.db.query('receiptLedgers').collect(),
      parts: await ctx.db.query('receiptLedgerParts').collect()
    }))
  return { ...base, character, committed, readState, readReceiptStorage }
}
