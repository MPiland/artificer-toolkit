import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { expect, userEvent, within } from 'storybook/test'
import { characterSheetMulticlassFixture } from '../fixtures/characterRest.fixtures'
import { characterSheetSpellStatesFixture } from '../fixtures/characterSpell.fixtures'
import { astralTearCharacterSheetFixture } from '../fixtures/astralTearSheet.fixtures'
import { CharacterSheetFixtureView as CharacterSheetView } from '../fixtures/CharacterSheetFixtureView'
import {
  characterSheetStoryMeta,
  characterSheetTabletViewports
} from '../fixtures/characterSheetStory.fixture'

const meta = {
  ...characterSheetStoryMeta,
  title: 'Domains/Characters/CharacterSheetView'
} satisfies Meta<typeof CharacterSheetView>

export default meta

type Story = StoryObj<typeof meta>

export const Desktop: Story = {}

export const Mobile: Story = {
  globals: {
    viewport: {
      value: 'mobile1',
      isRotated: false
    }
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1'
    }
  }
}

export const TabletPortrait: Story = {
  globals: {
    viewport: {
      value: 'characterSheetTabletPortrait',
      isRotated: false
    }
  },
  parameters: {
    viewport: {
      options: characterSheetTabletViewports
    }
  }
}

export const TabletLandscape: Story = {
  globals: {
    viewport: {
      value: 'characterSheetTabletLandscape',
      isRotated: false
    }
  },
  parameters: {
    viewport: {
      options: characterSheetTabletViewports
    }
  }
}

export const DraftPending: Story = {
  args: {
    hasDraft: true
  }
}

export const AbilityModifierStates: Story = {}

export const ProficiencyStates: Story = {
  args: {
    sheet: {
      ...characterSheetMulticlassFixture,
      overview: {
        ...characterSheetMulticlassFixture.overview,
        skills: characterSheetMulticlassFixture.overview.skills.map((skill, index) => ({
          ...skill,
          proficiency:
            index < 4
              ? ((['NONE', 'HALF', 'FULL', 'DOUBLE'] as const)[index] ?? 'NONE')
              : skill.proficiency
        }))
      }
    }
  }
}

export const SpellStates: Story = {
  args: {
    initialTab: 'spells',
    sheet: characterSheetSpellStatesFixture
  }
}

export const AstralTearInventory: Story = {
  args: {
    initialTab: 'inventory',
    sheet: astralTearCharacterSheetFixture
  }
}

export const AstralTearFeatures: Story = {
  args: {
    initialTab: 'reference',
    sheet: astralTearCharacterSheetFixture
  }
}

export const ActionTypes: Story = {
  args: {
    initialTab: 'actions',
    sheet: {
      ...characterSheetMulticlassFixture,
      actions: {
        items: [
          ...characterSheetMulticlassFixture.actions.items,
          {
            id: 'action-dash',
            label: 'Dash',
            kind: 'ACTION',
            availability: { status: 'AVAILABLE' },
            sourceLabel: 'Core action',
            description: '<p>Gain extra movement for the current turn.</p>'
          },
          {
            id: 'action-opportunity-attack',
            label: 'Opportunity Attack',
            kind: 'REACTION',
            availability: { status: 'AVAILABLE' },
            sourceLabel: 'Core action',
            description:
              '<p>Make one melee attack when a creature leaves your reach without disengaging.</p>'
          },
          {
            id: 'action-force-ballista',
            label: 'Force Ballista',
            kind: 'ACTION',
            availability: { status: 'AVAILABLE' },
            sourceLabel: 'Artificer',
            description: '<p>Fire a bolt of force at a creature you can see within range.</p>',
            resourceGrantId: 'resource-force-ballista',
            mechanic: {
              effectId: 'force-ballista-effect',
              trigger: 'ATTACK_ROLL',
              activation: { kind: 'ACTION', amount: 1 },
              rangeLabel: '120 ft',
              attackBonus: 7,
              outcomes: [
                {
                  kind: 'DAMAGE',
                  pathCode: 'ON_HIT',
                  expression: '2d8',
                  damageTypeId: 'force',
                  damageTypeLabel: 'Force'
                }
              ]
            }
          }
        ]
      },
      resources: {
        ...characterSheetMulticlassFixture.resources,
        items: [
          ...characterSheetMulticlassFixture.resources.items,
          {
            id: 'resource-force-ballista',
            label: 'Force Ballista',
            sourceLabel: 'Artificer',
            owner: {
              kind: 'AUTHORED_GRANT',
              resourceGrantId: 'resource-force-ballista',
              source: {
                kind: 'AUTHORED',
                sourceKind: 'FEATURE',
                definitionId: '00000000-0000-4000-8000-000000000223',
                sourceInstanceId: 'feature:force-ballista'
              }
            },
            used: 1,
            max: 3,
            remaining: 2,
            recoveries: [{ trigger: 'LONG_REST', amount: { kind: 'ALL' } }]
          }
        ]
      }
    }
  }
}

/** SPELLS-8.6: a long attack name with two active bonuses keeps the row inside a phone's width. */
export const ActiveBonusesMobile: Story = {
  ...Mobile,
  args: {
    initialTab: 'actions',
    sheet: {
      ...characterSheetMulticlassFixture,
      actions: {
        items: [
          ...characterSheetMulticlassFixture.actions.items,
          {
            id: 'action-shillelagh-quarterstaff',
            label: 'Quarterstaff of the Verdant Grove',
            kind: 'ACTION',
            availability: { status: 'AVAILABLE' },
            sourceLabel: 'Weapon',
            mechanic: {
              effectId: 'quarterstaff-effect',
              trigger: 'ATTACK_ROLL',
              activation: { kind: 'ACTION', amount: 1 },
              rangeLabel: '5 ft',
              attackBonus: 5,
              attackAddedDice: [{ label: 'Bless', count: 1, faces: 4, sign: 'ADD' }],
              damageAddedDice: [
                {
                  label: "Hunter's Mark",
                  count: 1,
                  faces: 6,
                  sign: 'ADD',
                  damageTypeId: null,
                  againstHolderOnly: true
                }
              ],
              outcomes: [
                {
                  kind: 'DAMAGE',
                  pathCode: 'ON_HIT',
                  expression: '1d8 + 3',
                  damageTypeId: 'bludgeoning',
                  damageTypeLabel: 'Bludgeoning'
                }
              ]
            }
          }
        ]
      }
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const row = await canvas.findByRole('group', { name: 'Quarterstaff of the Verdant Grove' })
    const badge = within(row).getByRole('button', { name: '2 active bonuses' })
    await expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth)
    await expect(badge.getBoundingClientRect().right).toBeLessThanOrEqual(
      row.getBoundingClientRect().right
    )
    await expect(canvasElement.ownerDocument.documentElement.scrollWidth).toBeLessThanOrEqual(
      canvasElement.ownerDocument.defaultView?.innerWidth ?? 0
    )
    await userEvent.click(badge)
    const list = await within(canvasElement.ownerDocument.body).findByRole('list', {
      name: '2 active bonuses'
    })
    await expect(within(list).getAllByRole('listitem')).toHaveLength(2)
  }
}
