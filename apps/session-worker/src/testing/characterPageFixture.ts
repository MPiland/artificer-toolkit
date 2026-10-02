import { characterStoredRowSchema } from '@artificer-toolkit/schema/projections/characterPersistence'
import {
  characterDocumentSchema,
  encodeCharacterRecord
} from '@artificer-toolkit/schema/projections/characterStoredState'
import { characterSheetStateSchema } from '@artificer-toolkit/schema/projections/characterSheetState'
import { splitCharacterPlayState } from '@artificer-toolkit/schema/projections/characterPlayState'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

/** A level 1 Character capture; the private transport row below uses the canonical storage codec. */
const capturedPage = {
  status: 'ASSIGNED',
  characterId: 'f84fd6f1-8c90-4578-b9c5-2593b797bcb9',
  documents: [],
  contentSnapshots: {
    systemId: '00000000-0000-0000-0000-000000000001',
    sources: [],
    campaign: {
      id: '6ac2c5e6-6b7a-4af7-809d-bafb66543183',
      contentMaturity: 'STANDARD',
      head: null
    }
  },
  inputs: {
    campaign: {
      attunementSlotOverride: null,
      contentMaturity: 'STANDARD',
      currencyOptions: [],
      id: '6ac2c5e6-6b7a-4af7-809d-bafb66543183',
      state: { adjustments: [], conditions: [] },
      status: 'ACTIVE'
    },
    character: {
      id: 'f84fd6f1-8c90-4578-b9c5-2593b797bcb9',
      intent: {
        abilities: {
          assignments: [
            { ability: 'STRENGTH', option: '15' },
            { ability: 'DEXTERITY', option: '14' },
            { ability: 'CONSTITUTION', option: '13' },
            { ability: 'INTELLIGENCE', option: '12' },
            { ability: 'WISDOM', option: '10' },
            { ability: 'CHARISMA', option: '8' }
          ],
          method: 'STANDARD_ARRAY'
        },
        advancement: { method: 'MILESTONE' },
        background: { backgroundId: '00000000-0000-0000-0040-000100000000' },
        classes: [{ classId: '00000000-0000-0000-0010-000500000000', classLevel: 1 }],
        featureAcquisitions: [],
        hitpoints: {
          levels: [
            { classId: '00000000-0000-0000-0010-000500000000', classLevel: 1, level: 1, value: 11 }
          ],
          method: 'FIXED'
        },
        race: { raceId: '00000000-0000-0000-0030-000400000000' },
        startingEquipment: {
          background: {
            applied: true,
            groups: [
              {
                groupId: '3b74a8d0-eb08-47c9-b103-8d3ec46bd283',
                optionId: '319962bb-3446-4b1e-bc19-3f3d5e78a36d'
              }
            ],
            source: 'BACKGROUND',
            tookGold: false
          },
          class: {
            applied: true,
            gold: { goldOption: '5d4', totalGold: 100 },
            source: 'CLASS',
            tookGold: true
          }
        }
      },
      label: 'Aria',
      profile: {},
      state: {
        currency: [
          {
            currencies: [
              { amount: 115, currencyId: '00000000-0000-0000-0003-000400000000', kind: 'RULESET' }
            ],
            id: '07653bb9-429c-4ab6-910c-cd693b82ec10'
          }
        ],
        equipment: {
          attuned: [],
          equipped: [],
          inventory: [
            {
              equipmentId: '00000000-0000-0000-0060-000100000000',
              id: '992d362a-d18b-42d0-aea9-56368b7710b9',
              quantity: 2,
              retainedRulesJson:
                '{"equipmentId":"00000000-0000-0000-0060-000100000000","systemId":"00000000-0000-0000-0000-000000000001","sources":[{"subjectKind":"EQUIPMENT","subjectId":"00000000-0000-0000-0060-000100000000","versionId":"c7cda311-2d80-5d4b-a99b-af0c6633edbe","version":1,"checksum":"5aeb9726b66a957406d7792efebf48cd74b4c74801be9f96b4814ce445776ee5","documentJson":"{\\"category\\":\\"WEAPON\\",\\"cost\\":{\\"amount\\":1,\\"currencyId\\":\\"00000000-0000-0000-0003-000300000000\\"},\\"description\\":null,\\"effects\\":[{\\"grip\\":\\"ONE_HANDED\\",\\"id\\":\\"00000060-0000-0210-0001-000000000001\\",\\"invocation\\":{\\"activation\\":{\\"amount\\":1,\\"code\\":\\"ACTION\\"},\\"kind\\":\\"ACTION\\",\\"range\\":{\\"amount\\":5,\\"id\\":\\"00000060-0000-0211-0001-000000000001\\",\\"rangeKind\\":\\"DISTANCE\\",\\"unit\\":\\"FEET\\"},\\"targeting\\":{\\"dispositionKind\\":\\"ANY\\",\\"selectionKind\\":\\"SINGLE_TARGET\\"},\\"triggerCode\\":\\"MELEE_WEAPON_ATTACK\\"},\\"order\\":1,\\"paths\\":[{\\"groupType\\":\\"SINGLE\\",\\"id\\":\\"00000060-0000-0212-0001-000000000001\\",\\"order\\":1,\\"originKind\\":\\"SOURCE\\",\\"pathCode\\":\\"ON_HIT\\",\\"resultBlock\\":{\\"id\\":\\"00000060-0000-0212-0001-000000000001__result\\",\\"outcomes\\":[{\\"damageTypeId\\":\\"00000000-0000-0000-0004-000200000000\\",\\"diceConfig\\":\\"1d4\\",\\"effectKind\\":\\"DAMAGE\\",\\"id\\":\\"00000060-0000-0212-0001-000000000001\\",\\"scalingKind\\":\\"NONE\\",\\"valueKind\\":\\"DICE\\"}],\\"resultKind\\":\\"SINGLE\\"},\\"selectionKind\\":\\"FIXED\\"}]}],\\"id\\":\\"00000000-0000-0000-0060-000100000000\\",\\"kind\\":\\"EQUIPMENT\\",\\"label\\":\\"Club\\",\\"modifiers\\":[{\\"domain\\":{\\"attackDomain\\":\\"MELEE\\"},\\"grantKind\\":\\"MODIFIER_GRANT\\",\\"id\\":\\"00000060-0000-0300-0001-000000000001\\",\\"modifierKind\\":\\"ABILITY_MODIFIER_BONUS\\",\\"order\\":1,\\"payload\\":{\\"ability\\":\\"STRENGTH\\"},\\"restrictions\\":{\\"groups\\":[{\\"contexts\\":[{\\"conditions\\":[{\\"constraint\\":\\"INCLUDE\\",\\"id\\":\\"00000060-0000-0304-0001-000000000001\\",\\"kind\\":\\"PREDICATE\\",\\"order\\":0,\\"predicateCode\\":\\"WHILE_SOURCE_EQUIPPED\\"}],\\"id\\":\\"00000060-0000-0303-0001-000000000001\\",\\"order\\":0,\\"subject\\":\\"CHARACTER\\"}],\\"id\\":\\"00000060-0000-0302-0001-000000000001\\",\\"order\\":0}],\\"id\\":\\"00000060-0000-0301-0001-000000000001\\"},\\"scope\\":\\"SOURCE\\",\\"selectionKind\\":\\"GRANTED\\",\\"valueDomainCode\\":\\"ATTACK_ROLL\\"},{\\"domain\\":{\\"attackDomain\\":\\"MELEE\\"},\\"grantKind\\":\\"MODIFIER_GRANT\\",\\"id\\":\\"00000060-0000-0300-0001-000000000002\\",\\"modifierKind\\":\\"ABILITY_MODIFIER_BONUS\\",\\"order\\":2,\\"payload\\":{\\"ability\\":\\"STRENGTH\\"},\\"restrictions\\":{\\"groups\\":[{\\"contexts\\":[{\\"conditions\\":[{\\"constraint\\":\\"INCLUDE\\",\\"id\\":\\"00000060-0000-0304-0001-000000000002\\",\\"kind\\":\\"PREDICATE\\",\\"order\\":0,\\"predicateCode\\":\\"WHILE_SOURCE_EQUIPPED\\"}],\\"id\\":\\"00000060-0000-0303-0001-000000000002\\",\\"order\\":0,\\"subject\\":\\"CHARACTER\\"}],\\"id\\":\\"00000060-0000-0302-0001-000000000002\\",\\"order\\":0}],\\"id\\":\\"00000060-0000-0301-0001-000000000002\\"},\\"scope\\":\\"SOURCE\\",\\"selectionKind\\":\\"GRANTED\\",\\"valueDomainCode\\":\\"DAMAGE\\"}],\\"properties\\":[\\"SIMPLE\\",\\"MELEE\\",\\"LIGHT\\"],\\"rarityId\\":\\"00000000-0000-0000-0009-000100000000\\",\\"systemId\\":\\"00000000-0000-0000-0000-000000000001\\",\\"userId\\":\\"00000000-0000-0000-0000-000000000000\\",\\"weight\\":{\\"amount\\":2,\\"unit\\":\\"POUNDS\\"}}"}]}'
            }
          ]
        },
        hitpoints: { current: 11, hitDice: [{ die: 10, total: 1, used: 0 }] }
      },
      status: 'ACTIVE',
      systemId: '00000000-0000-0000-0000-000000000001',
      userId: '4b355870-c307-4b42-a70f-e73cecc6c459'
    },
    sheetState: {
      adjustments: [],
      movementDisplayPreference: { mode: 'AUTO' },
      partyVisibility: { health: 'HIDDEN', sheet: false },
      resourceUsage: [],
      spellCustomizations: []
    },
    streamVersion: 1,
    updatedAt: '2026-09-29T07:35:48.348Z'
  },
  revisions: [
    {
      id: '00000000-0000-0000-0000-000000000001',
      revision: 'a88b25c0-78a8-4111-8001-b9567dddf396',
      scope: 'SYSTEM'
    },
    {
      id: '6ac2c5e6-6b7a-4af7-809d-bafb66543183',
      revision: '37126bb7-6fac-466e-9ad1-9d51079e2993',
      scope: 'CAMPAIGN'
    },
    {
      id: '6ac2c5e6-6b7a-4af7-809d-bafb66543183',
      revision: '45bba7ed-c069-431d-baad-43cdc9b2f18e',
      scope: 'PLAY'
    },
    {
      id: 'f84fd6f1-8c90-4578-b9c5-2593b797bcb9',
      revision: '9962f99a-db00-45a3-b8db-94c4b6448b99',
      scope: 'CHARACTER'
    }
  ]
}

const sheetState = characterSheetStateSchema.parse(capturedPage.inputs.sheetState)
const updatedAt = capturedPage.inputs.updatedAt
const capturedRevisions = capturedPage.revisions

/** The captured Character's private stored row (structure with its play record), re-keyed to an owner. */
export function characterOwnerRowFor({
  characterId = capturedPage.characterId,
  userId = capturedPage.inputs.character.userId
}: { characterId?: string; userId?: string } = {}) {
  const character = characterDocumentSchema.parse({
    ...capturedPage.inputs.character,
    id: characterId,
    userId
  })
  const play = splitCharacterPlayState({ state: character.state, sheetState }).play
  return characterStoredRowSchema.parse(
    encodeCharacterRecord(
      {
        _id: 'fixture:character',
        _creationTime: Date.parse(updatedAt),
        id: character.id,
        userId: character.userId,
        systemId: character.systemId,
        label: character.label,
        status: 'ACTIVE',
        createdAt: updatedAt,
        updatedAt,
        documentJson: JSON.stringify(character),
        checksum: checksumRuleDocument(character),
        play: {
          _id: 'fixture:character-play',
          _creationTime: Date.parse(updatedAt),
          characterId: character.id,
          userId: character.userId,
          streamVersion: capturedPage.inputs.streamVersion,
          maximumHitPoints: 11,
          walkingSpeed: 30,
          state: play,
          checksum: checksumRuleDocument(play),
          updatedAt
        }
      },
      {
        document: character,
        sheetState,
        streamVersion: capturedPage.inputs.streamVersion,
        updatedAt
      }
    )
  )
}

/**
 * The assigned Character's first room-input part, including its complete private owner capture.
 * The capture can be re-keyed to another Character, owner and Campaign, and given the content
 * manifest and revisions of the room that serves it; the defaults are the capture itself.
 */
export function characterPageFixtureFor({
  characterId = capturedPage.characterId,
  userId = capturedPage.inputs.character.userId,
  campaignId = capturedPage.inputs.campaign.id,
  contentSnapshots = {
    ...capturedPage.contentSnapshots,
    campaign: { ...capturedPage.contentSnapshots.campaign, id: campaignId }
  },
  revisions = capturedRevisions.map((revision) => ({
    ...revision,
    id:
      revision.scope === 'CHARACTER'
        ? characterId
        : revision.scope === 'SYSTEM'
          ? revision.id
          : campaignId
  }))
}: {
  characterId?: string
  userId?: string
  campaignId?: string
  contentSnapshots?: unknown
  revisions?: unknown
} = {}): unknown {
  return {
    status: capturedPage.status,
    characterId,
    documents: capturedPage.documents,
    contentSnapshots,
    inputs: {
      owner: characterOwnerRowFor({ characterId, userId }),
      campaign: { ...capturedPage.inputs.campaign, id: campaignId },
      sheetState
    },
    revisions
  }
}

export const characterPageFixture: unknown = characterPageFixtureFor()
