import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import type { ClassAuthoredDto } from '@artificer-toolkit/schema/subjects/class'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { human } from '@artificer-toolkit/source-data/srd/races/human.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { api, internal } from '../../convex/_generated/api'
import { fixture, input } from './characters'
import { importedSubject } from './publication'

export async function readyCharacterFixture(
  options: Partial<
    Pick<typeof fighter | ClassAuthoredDto, 'resources' | 'spellcasting' | 'features'>
  > = {},
  equipment = club
) {
  if (fighter.category !== 'BASE') throw new Error('Expected the canonical parent Fighter class.')
  const base = await fixture()
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
                      currencies: [{ currencyId: fighter.startingGold.currencyId, amount: 15 }]
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
    ...structuredClone(fighter),
    ...options,
    features: options.features ?? [],
    proficiencies: [],
    startingEquipment: { ...fighter.startingEquipment!, sets: [] }
  }
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({ subjectKind: 'RACE', ...human, document: { ...human, features: [] } }),
      importedSubject({ subjectKind: 'CLASS', ...baseClass, document: baseClass }),
      importedSubject({ subjectKind: 'BACKGROUND', ...background, document: background }),
      importedSubject({ subjectKind: 'EQUIPMENT', ...equipment, document: equipment })
    ]
  })
  async function createCharacter(request = input()) {
    const draft = await base.owner.caller.mutation(api.characters.drafts.create, request)
    const character = characterAuthoredDtoSchema.parse({
      ...draft.payload.character,
      label: 'Aria',
      intent: {
        ...draft.payload.character.intent,
        race: { raceId: human.id },
        background: { backgroundId: background.id },
        classes: [{ classId: baseClass.id, classLevel: 1 }],
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
          levels: [{ level: 1, classId: baseClass.id, classLevel: 1, value: 10 }]
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
  equipment?: Parameters<typeof readyCharacterFixture>[1]
) {
  const base = await readyCharacterFixture(options, equipment)
  const { draft, character } = await base.createCharacter()
  const committed = await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
  const readState = () =>
    base.t.run(async (ctx) => ({
      character: await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', character.id))
        .unique(),
      receipts: await ctx.db
        .query('characterCommandReceipts')
        .withIndex('by_characterId_commandId', (q) => q.eq('characterId', character.id))
        .collect()
    }))
  return { ...base, character, committed, readState }
}
