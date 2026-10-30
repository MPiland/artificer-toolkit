import assert from 'node:assert/strict'
import type { ConvexHttpClient } from 'convex/browser'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { human } from '@artificer-toolkit/source-data/srd/races/human.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { backpack } from '@artificer-toolkit/source-data/srd/equipment/backpack.js'
import { classAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/class'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import type { AuthoredDraftResult } from '@artificer-toolkit/schema/api/authoredDrafts'
import type { CharacterBuilderResolveInput } from '@artificer-toolkit/schema/api/characterBuilderQueries'
import type { DevelopmentClient } from './developmentClient'
import { api } from '../convex/_generated/api.js'

export async function prepareDevelopmentCharacter(
  owner: DevelopmentClient & Pick<ConvexHttpClient, 'action'>,
  characterId: string,
  options: Partial<Pick<typeof fighter, 'features' | 'resources' | 'spellcasting'>> = {}
) {
  const equipment = await owner.mutation(api.content.drafts.duplicate, {
    subjectKind: 'EQUIPMENT',
    subjectId: backpack.id
  })
  const race = await owner.mutation(api.content.drafts.duplicate, {
    subjectKind: 'RACE',
    subjectId: human.id
  })
  const background = await owner.mutation(api.content.drafts.duplicate, {
    subjectKind: 'BACKGROUND',
    subjectId: acolyte.id
  })
  const baseClass = await owner.mutation(api.content.drafts.duplicate, {
    subjectKind: 'CLASS',
    subjectId: fighter.id
  })
  const classDocument = classAuthoredDtoSchema.parse(baseClass.payload)
  assert.equal(classDocument.category, 'BASE')
  if (classDocument.category !== 'BASE') throw new Error('Expected a base Class')
  const groupId = crypto.randomUUID()
  const optionId = crypto.randomUUID()
  async function publish(draft: AuthoredDraftResult, payload = draft.payload) {
    const label = `${draft.label} ${characterId}`
    const saved = await owner.mutation(api.content.drafts.save, {
      subjectKind: draft.subjectKind,
      subjectId: draft.subjectId,
      systemId: draft.systemId,
      label,
      payload: { ...payload, label }
    })
    assert.ok(saved.updatedAt)
    if (draft.subjectKind === 'CLASS') {
      await owner.action(api.content.classPublicationActions.publishDraft, {
        subjectKind: 'CLASS',
        subjectId: draft.subjectId,
        expectedDraftUpdatedAt: saved.updatedAt
      })
      return
    }
    await owner.mutation(api.content.publication.publishDraft, {
      subjectKind: draft.subjectKind,
      subjectId: draft.subjectId,
      expectedDraftUpdatedAt: saved.updatedAt
    })
  }
  await publish(equipment)
  await publish(race, { ...race.payload, features: [] })
  await publish(background, {
    ...background.payload,
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
                      startingEquipmentKind: 'EQUIPMENT',
                      selectionKind: 'GRANTED',
                      authoringModeKind: 'SELECTED',
                      equipmentIds: [club.id],
                      quantity: 2
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  })
  await publish(baseClass, {
    ...baseClass.payload,
    features: [],
    ...options,
    proficiencies: [],
    startingEquipment: { id: crypto.randomUUID(), sets: [] }
  })
  const draft = await owner.mutation(api.characters.drafts.create, {
    id: characterId,
    systemId: club.systemId
  })
  const character = characterAuthoredDtoSchema.parse({
    ...draft.payload.character,
    label: 'Equipment reconciliation fixture',
    intent: {
      ...draft.payload.character.intent,
      race: { raceId: race.subjectId },
      background: { backgroundId: background.subjectId },
      classes: [{ classId: baseClass.subjectId, classLevel: 1 }],
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
        levels: [{ level: 1, classId: baseClass.subjectId, classLevel: 1, value: 10 }]
      },
      startingEquipment: {
        class: {
          source: 'CLASS',
          tookGold: true,
          gold: { goldOption: classDocument.startingGold.dieConfig, totalGold: 100 },
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
  const candidate: CharacterBuilderResolveInput = {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  }
  return { candidate, character, equipment }
}

export async function createDevelopmentCharacter(
  owner: DevelopmentClient & Pick<ConvexHttpClient, 'action'>,
  characterId: string,
  options: Partial<Pick<typeof fighter, 'features' | 'resources' | 'spellcasting'>> = {}
) {
  const { candidate, character, equipment } = await prepareDevelopmentCharacter(
    owner,
    characterId,
    options
  )
  const committed = await owner.mutation(api.characters.commit.commit, candidate)
  return { committed, character, equipment }
}
