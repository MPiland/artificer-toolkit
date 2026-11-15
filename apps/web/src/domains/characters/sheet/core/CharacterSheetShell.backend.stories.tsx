import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import type { CharacterSheetActionsDto } from '@artificer-toolkit/schema/api/characterSheetSlices'
import { Route } from '#routes/_authed/characters/$characterPublicId/$characterSlug/index'
import { STORY_CHARACTERS } from '../../../../../../apis/tests/developmentReviewDataScenarios'
import {
  findSeededSheetCharacter,
  openMobileSheetPage,
  sheetRouter,
  sheetSliceOverride,
  type StoryCharacter
} from '../stories/characterSheetBackendStory'
import { characterSheetTabletViewports } from '../stories/characterSheetViewports'

// Reads the Sheets of the story account's Characters that `seedStoryData` builds through the
// Builder commit (D218, D221). Writes are spies.
const meta = {
  title: 'Domains/Characters/CharacterSheetView',
  parameters: {
    layout: 'fullscreen',
    tanstack: { router: sheetRouter(STORY_CHARACTERS.fighter) }
  }
} satisfies Meta<typeof Route>

export default meta

// Typed by the route (the meta sets no `component`), so a story can retarget its params.
type Story = StoryObj<typeof Route>

const opensCharacter = (character: StoryCharacter): Pick<Story, 'play'> => ({
  play: ({ canvasElement }) => findSeededSheetCharacter(canvasElement, character)
})

export const Desktop: Story = opensCharacter(STORY_CHARACTERS.fighter)

export const Mobile: Story = {
  ...opensCharacter(STORY_CHARACTERS.fighter),
  globals: { viewport: { value: 'mobile1', isRotated: false } },
  parameters: { viewport: { defaultViewport: 'mobile1' } }
}

export const TabletPortrait: Story = {
  ...opensCharacter(STORY_CHARACTERS.fighter),
  globals: { viewport: { value: 'characterSheetTabletPortrait', isRotated: false } },
  parameters: { viewport: { options: characterSheetTabletViewports } }
}

export const TabletLandscape: Story = {
  ...opensCharacter(STORY_CHARACTERS.fighter),
  globals: { viewport: { value: 'characterSheetTabletLandscape', isRotated: false } },
  parameters: { viewport: { options: characterSheetTabletViewports } }
}

export const DraftPending: Story = {
  ...opensCharacter(STORY_CHARACTERS.draftPending),
  parameters: { tanstack: { router: sheetRouter(STORY_CHARACTERS.draftPending) } }
}

export const AbilityModifierStates: Story = opensCharacter(STORY_CHARACTERS.fighter)

const skillProficiencies = ['NONE', 'HALF', 'FULL', 'DOUBLE'] as const

// Composed: the seeded Fighter's Common slice with its first four skills at each proficiency level.
export const ProficiencyStates: Story = {
  parameters: {
    queryOverride: sheetSliceOverride('COMMON', (common) => ({
      ...common,
      overview: {
        ...common.overview,
        skills: skillProficiencies.reduce(
          (skills, proficiency, level) =>
            skills.map((skill, index) => (index === level ? { ...skill, proficiency } : skill)),
          common.overview.skills
        )
      }
    }))
  },
  play: async ({ canvas, canvasElement }) => {
    await findSeededSheetCharacter(canvasElement, STORY_CHARACTERS.fighter)
    for (const level of ['Not proficient', 'Half proficiency', 'Proficient', 'Expertise'])
      expect((await canvas.findAllByRole('img', { name: level })).length).toBeGreaterThan(0)
  }
}

// Seeded: the story caster has spent every spell slot, so its spells read as exhausted.
export const SpellStates: Story = {
  parameters: { tanstack: { router: sheetRouter(STORY_CHARACTERS.caster) } },
  play: async ({ canvas, canvasElement }) => {
    await findSeededSheetCharacter(canvasElement, STORY_CHARACTERS.caster)
    await userEvent.click(await canvas.findByRole('tab', { name: /^Spells/ }))
    for (const spell of ['Magic Missile', 'Shield'])
      expect((await canvas.findAllByText(spell, {}, { timeout: 15_000 })).length).toBeGreaterThan(0)
    expect(
      (await canvas.findAllByText(/spell slots are exhausted\./, {}, { timeout: 15_000 })).length
    ).toBeGreaterThan(0)
  }
}

// Composed: the seeded Fighter's Actions slice with a basic Action, a Reaction and an Action that
// spends a limited-use resource and rolls an attack.
export const ActionTypes: Story = {
  parameters: {
    queryOverride: sheetSliceOverride('ACTIONS', (actions): CharacterSheetActionsDto => ({
      ...actions,
      actions: {
        ...actions.actions,
        items: [
          ...actions.actions.items,
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
        ...actions.resources,
        items: [
          ...actions.resources.items,
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
    }))
  },
  play: async ({ canvas, canvasElement }) => {
    await findSeededSheetCharacter(canvasElement, STORY_CHARACTERS.fighter)
    for (const action of ['Dash', 'Opportunity Attack', 'Force Ballista'])
      expect((await canvas.findAllByText(action)).length).toBeGreaterThan(0)
  }
}

/** SPELLS-8.6: a long attack name with two active bonuses keeps the row inside a phone's width. */
export const ActiveBonusesMobile: Story = {
  globals: { viewport: { value: 'mobile1', isRotated: false } },
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
    queryOverride: sheetSliceOverride('ACTIONS', (actions): CharacterSheetActionsDto => ({
      ...actions,
      actions: {
        ...actions.actions,
        items: [
          ...actions.actions.items,
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
    }))
  },
  play: async ({ canvas, canvasElement }) => {
    await findSeededSheetCharacter(canvasElement, STORY_CHARACTERS.fighter)
    await openMobileSheetPage(canvasElement, 'Actions')
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
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(2))
  }
}
