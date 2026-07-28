import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characters'
import { characterSheetFixture } from './characterSheet.fixtures'

export const characterSheetSpellStatesFixture = {
  ...characterSheetFixture,
  spells: {
    ...characterSheetFixture.spells,
    slots: [
      { slotKey: 'STANDARD:1', label: 'Level 1', level: 1, used: 4, max: 4, remaining: 0 },
      { slotKey: 'STANDARD:2', label: 'Level 2', level: 2, used: 1, max: 2, remaining: 1 }
    ],
    activeGroups: [
      {
        level: 1,
        label: 'Level 1',
        entries: [
          {
            rowId: 'spell:shield:prepared:wizard:level:1',
            target: {
              kind: 'SPELL',
              source: {
                spellId: '00000000-0000-4000-8000-000000000115',
                sourceKind: 'CLASS',
                sourceInstanceId: 'class:wizard'
              },
              castLevel: 1
            },
            spellId: '00000000-0000-4000-8000-000000000115',
            source: {
              spellId: '00000000-0000-4000-8000-000000000115',
              sourceKind: 'CLASS',
              sourceInstanceId: 'class:wizard'
            },
            sourceId: 'class:wizard',
            displayName: 'Shield',
            castLevel: 1,
            activationType: 'REACTION',
            available: false,
            unavailableReason: 'All Level 1 spell slots are expended.',
            cast: {
              spellId: '00000000-0000-4000-8000-000000000115',
              sourceId: 'class:wizard',
              slotKey: 'STANDARD:1'
            }
          },
          {
            rowId: 'spell:magic-missile:known:wizard:level:1',
            target: {
              kind: 'SPELL',
              source: {
                spellId: '00000000-0000-4000-8000-000000000113',
                sourceKind: 'CLASS',
                sourceInstanceId: 'class:wizard'
              },
              castLevel: 1
            },
            spellId: '00000000-0000-4000-8000-000000000113',
            source: {
              spellId: '00000000-0000-4000-8000-000000000113',
              sourceKind: 'CLASS',
              sourceInstanceId: 'class:wizard'
            },
            sourceId: 'class:wizard',
            displayName: 'Magic Missile',
            sourceQualifier: 'Wizard',
            castLevel: 1,
            activationType: 'ACTION',
            primaryEffect: '3 × (1d4 + 1) Force',
            available: false,
            unavailableReason: 'All Level 1 spell slots are expended.',
            cast: {
              spellId: '00000000-0000-4000-8000-000000000113',
              sourceId: 'class:wizard',
              slotKey: 'STANDARD:1'
            }
          },
          {
            rowId: 'spell:magic-missile:granted:feat:level:1',
            target: {
              kind: 'SPELL',
              source: {
                spellId: '00000000-0000-4000-8000-000000000113',
                sourceKind: 'FEAT',
                sourceInstanceId: 'feat:magic-initiate'
              },
              castLevel: 1
            },
            spellId: '00000000-0000-4000-8000-000000000113',
            source: {
              spellId: '00000000-0000-4000-8000-000000000113',
              sourceKind: 'FEAT',
              sourceInstanceId: 'feat:magic-initiate'
            },
            sourceId: 'feat:magic-initiate',
            displayName: 'Magic Missile',
            sourceQualifier: 'Magic Initiate',
            castLevel: 1,
            activationType: 'ACTION',
            primaryEffect: '3 × (1d4 + 1) Force',
            available: true,
            cast: {
              spellId: '00000000-0000-4000-8000-000000000113',
              sourceId: 'feat:magic-initiate'
            }
          }
        ]
      },
      {
        level: 2,
        label: 'Level 2',
        entries: [
          {
            rowId: 'spell:magic-missile:known:wizard:level:2',
            target: {
              kind: 'SPELL',
              source: {
                spellId: '00000000-0000-4000-8000-000000000113',
                sourceKind: 'CLASS',
                sourceInstanceId: 'class:wizard'
              },
              castLevel: 2
            },
            spellId: '00000000-0000-4000-8000-000000000113',
            source: {
              spellId: '00000000-0000-4000-8000-000000000113',
              sourceKind: 'CLASS',
              sourceInstanceId: 'class:wizard'
            },
            sourceId: 'class:wizard',
            displayName: 'Magic Missile',
            castLevel: 2,
            activationType: 'ACTION',
            primaryEffect: '4 × (1d4 + 1) Force',
            available: true,
            cast: {
              spellId: '00000000-0000-4000-8000-000000000113',
              sourceId: 'class:wizard',
              slotKey: 'STANDARD:2'
            }
          }
        ]
      }
    ],
    spells: characterSheetFixture.spells.spells.map((spell) =>
      spell.id === 'spell-shield'
        ? {
            ...spell,
            sources: spell.sources?.map((source) => ({
              ...source,
              acquisition: 'PREPARED' as const,
              prepared: true
            }))
          }
        : spell.id === 'spell-magic-missile'
          ? {
              ...spell,
              sources: spell.sources?.map((source) => ({
                ...source,
                acquisition: 'KNOWN' as const,
                prepared: false,
                canPrepare: false
              }))
            }
          : {
              ...spell,
              sources: spell.sources?.map((source) => ({
                ...source,
                acquisition: 'GRANTED' as const,
                prepared: false,
                canPrepare: false,
                castMode: 'AT_WILL' as const
              }))
            }
    )
  }
} satisfies CharacterSheetResponseDto
