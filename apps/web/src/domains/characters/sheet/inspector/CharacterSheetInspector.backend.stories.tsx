import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { expect, userEvent, within } from 'storybook/test'
import { Route } from '#routes/_authed/characters/$characterPublicId/$characterSlug/index'
import {
  STORY_CHARACTERS,
  STORY_SPELL_NOTE
} from '../../../../../../apis/tests/developmentReviewDataScenarios'
import {
  abilityPanelOverride,
  expectInspectorReady,
  findSeededSheetCharacter,
  openSheetSection,
  sheetRouter
} from '../stories/characterSheetBackendStory'
import { characterSheetTabletViewports } from '../stories/characterSheetViewports'

// Opens the inspector over the seeded story Characters' Sheets (D218, D221). Writes are spies.
const meta = {
  title: 'Domains/Characters/Character Sheet/Inspector',
  parameters: {
    layout: 'fullscreen',
    tanstack: { router: sheetRouter(STORY_CHARACTERS.fighter) }
  }
} satisfies Meta<typeof Route>

export default meta

type Story = StoryObj<typeof Route>
type Play = NonNullable<Story['play']>

const phone = {
  globals: { viewport: { value: 'mobile1', isRotated: false } },
  parameters: { viewport: { defaultViewport: 'mobile1' } }
} satisfies Pick<Story, 'globals' | 'parameters'>

const tablet = (orientation: 'Portrait' | 'Landscape') =>
  ({
    globals: {
      viewport: { value: `characterSheetTablet${orientation}`, isRotated: false }
    },
    parameters: { viewport: { options: characterSheetTabletViewports } }
  }) satisfies Pick<Story, 'globals' | 'parameters'>

const inspectStrength: Play = async ({ canvas, canvasElement }) => {
  await findSeededSheetCharacter(canvasElement, STORY_CHARACTERS.fighter)
  await userEvent.click(await canvas.findByRole('button', { name: 'Inspect Strength ability' }))
  await expectInspectorReady(canvasElement, 'Strength', 'Effective score')
}

/** A Fighter Overview control opens its panel: click it, then wait for the panel's first read. */
const inspectOverview =
  (name: string | RegExp, title: string, readyLabel: string): Play =>
  async ({ canvas, canvasElement }) => {
    await findSeededSheetCharacter(canvasElement, STORY_CHARACTERS.fighter)
    await userEvent.click(await canvas.findByRole('button', { name }))
    await expectInspectorReady(canvasElement, title, readyLabel)
  }

export const AbilityInspector: Story = { play: inspectStrength }

export const AbilityInspectorLight: Story = {
  globals: { theme: 'light' },
  play: inspectStrength
}

export const AbilityInspectorMobile: Story = { ...phone, play: inspectStrength }

export const AbilityInspectorTabletPortrait: Story = {
  ...tablet('Portrait'),
  play: inspectStrength
}

export const AbilityInspectorTabletLandscape: Story = {
  ...tablet('Landscape'),
  play: inspectStrength
}

// Composed: the seeded Strength panel with a +2 manual adjustment among its contributions.
export const AbilityInspectorAdjusted: Story = {
  parameters: {
    queryOverride: abilityPanelOverride('STRENGTH', (panel) => ({
      ...panel,
      state: 'ADJUSTED',
      score: panel.score + 2,
      // Two more points of score is always one more point of modifier.
      modifier: panel.modifier + 1,
      scoreCalculation: {
        ...panel.scoreCalculation,
        contributions: [
          ...panel.scoreCalculation.contributions,
          {
            id: 'manual-training',
            source: {
              kind: 'MANUAL_ADJUSTMENT',
              adjustmentId: '00000000-0000-4000-8000-000000000103'
            },
            sourceLabel: 'Manual adjustment',
            sourceNote: 'Earned after completing the cliffside trial.',
            value: 2,
            state: 'APPLIED'
          }
        ],
        effective: panel.scoreCalculation.effective + 2
      }
    }))
  },
  play: async (context) => {
    await inspectStrength(context)
    const inspector = within(context.canvasElement.ownerDocument.body).getByRole('dialog', {
      name: 'Strength'
    })
    await expect(within(inspector).getByText('Manual adjustment')).toBeVisible()
    await expect(
      within(inspector).getByText('Earned after completing the cliffside trial.')
    ).toBeVisible()
  }
}

// Composed: the seeded Strength panel under an absolute score override that suppresses its contributions.
export const AbilityInspectorOverridden: Story = {
  parameters: {
    queryOverride: abilityPanelOverride('STRENGTH', (panel) => ({
      ...panel,
      state: 'OVERRIDDEN',
      score: 12,
      modifier: 1,
      scoreCalculation: {
        ...panel.scoreCalculation,
        contributions: panel.scoreCalculation.contributions.map((contribution) => ({
          ...contribution,
          state: 'SUPPRESSED' as const
        })),
        override: {
          adjustmentId: '00000000-0000-4000-8000-000000000111',
          value: 12,
          sourceLabel: 'Manual override',
          sourceNote: 'Temporary score for the alpha playtest.'
        },
        effective: 12
      }
    }))
  },
  play: async (context) => {
    await inspectStrength(context)
    const inspector = within(context.canvasElement.ownerDocument.body).getByRole('dialog', {
      name: 'Strength'
    })
    await expect(within(inspector).getByText('Absolute override')).toBeVisible()
    await expect(
      within(inspector).getByText('Temporary score for the alpha playtest.')
    ).toBeVisible()
  }
}

export const SavingThrowInspector: Story = {
  play: inspectOverview(
    /Inspect Strength saving throw/i,
    'Strength saving throw',
    'Effective total'
  )
}

export const SkillInspector: Story = {
  play: inspectOverview('Arcana', 'Arcana', 'Effective total')
}

export const SkillsInspector: Story = {
  play: inspectOverview('Skills', 'Skills', 'Available skills')
}

export const SensesInspector: Story = {
  play: inspectOverview('Inspect Passive Perception', 'Passive Perception', 'Effective total')
}

export const MovementInspector: Story = {
  play: inspectOverview(/^Speed\b/, 'Movement', 'Primary movement')
}

export const DefensesInspector: Story = {
  play: inspectOverview('Manage Resistances: None', 'Defenses', 'Active defenses')
}

export const ProficienciesInspector: Story = {
  play: inspectOverview('Proficiencies', 'Proficiencies', 'Training entries')
}

const spellsRouter = { tanstack: { router: sheetRouter(STORY_CHARACTERS.multiclass) } }

/** Opens a spell of the seeded multiclass Wizard from the Spells section, as the viewport offers it. */
async function openSpellInspector(
  { canvas, canvasElement }: Parameters<Play>[0],
  spell: string,
  onPhone: boolean
) {
  await findSeededSheetCharacter(canvasElement, STORY_CHARACTERS.multiclass)
  await openSheetSection(canvasElement, 'Spells', onPhone)
  await userEvent.click(
    await canvas.findByRole(
      'button',
      { name: new RegExp(`^Open details for ${spell}`) },
      { timeout: 15_000 }
    )
  )
  return expectInspectorReady(canvasElement, spell, 'Spell source')
}

const inspectSpell =
  (spell: string, onPhone = false): Play =>
  async (context) => {
    await openSpellInspector(context, spell, onPhone)
  }

/** Opens a spell's Customize section and returns its notes fields. */
const customizeSpell =
  (spell: string, onPhone = false) =>
  async (context: Parameters<Play>[0]) => {
    const inspector = await openSpellInspector(context, spell, onPhone)
    await userEvent.click(within(inspector).getByRole('button', { name: /Customize/ }))
    await expect(
      await within(inspector).findByRole('textbox', { name: 'Custom name' })
    ).toBeVisible()
    return within(inspector).findAllByRole('textbox', { name: 'Spell notes' })
  }

export const SpellInspector: Story = {
  parameters: spellsRouter,
  play: inspectSpell('Magic Missile')
}

export const SpellInspectorMobile: Story = {
  ...phone,
  parameters: { ...phone.parameters, ...spellsRouter },
  play: inspectSpell('Magic Missile', true)
}

export const SpellInspectorAttackDamage: Story = {
  parameters: spellsRouter,
  play: inspectSpell('Fire Bolt')
}

export const SpellInspectorSaveDamage: Story = {
  parameters: spellsRouter,
  play: inspectSpell('Burning Hands')
}

export const SpellInspectorCustomizeExpanded: Story = {
  parameters: spellsRouter,
  play: async (context) => {
    await customizeSpell('Magic Missile')(context)
  }
}

export const SpellInspectorCustomizeExpandedMobile: Story = {
  ...phone,
  parameters: { ...phone.parameters, ...spellsRouter },
  play: async (context) => {
    await customizeSpell('Magic Missile', true)(context)
  }
}

export const SpellInspectorEmptyCustomizations: Story = {
  parameters: spellsRouter,
  play: async (context) => {
    for (const notes of await customizeSpell('Magic Missile')(context))
      await expect(notes).toHaveValue('')
  }
}

// Seeded: the story multiclass carries a note on its Class source for Burning Hands.
export const SpellInspectorConfiguredCustomizations: Story = {
  parameters: spellsRouter,
  play: async (context) => {
    const notes = await customizeSpell('Burning Hands')(context)
    expect(notes.map((field) => (field as HTMLTextAreaElement).value)).toContain(STORY_SPELL_NOTE)
  }
}

const inspectSpells =
  (onPhone = false): Play =>
  async ({ canvas, canvasElement }) => {
    await findSeededSheetCharacter(canvasElement, STORY_CHARACTERS.multiclass)
    await openSheetSection(canvasElement, 'Spells', onPhone)
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Manage Spells' }, { timeout: 15_000 })
    )
    await expectInspectorReady(canvasElement, 'Manage Spells', 'Spell slots')
  }

export const SpellsInspector: Story = {
  parameters: spellsRouter,
  play: inspectSpells()
}

export const SpellsInspectorMobile: Story = {
  ...phone,
  parameters: { ...phone.parameters, ...spellsRouter },
  play: inspectSpells(true)
}

/** Opens the seeded Fighter's Club from the Inventory section, as the viewport offers it. */
const inspectItem =
  (onPhone = false): Play =>
  async ({ canvas, canvasElement }) => {
    await findSeededSheetCharacter(canvasElement, STORY_CHARACTERS.fighter)
    await openSheetSection(canvasElement, 'Inventory', onPhone)
    const [club] = await canvas.findAllByRole(
      'button',
      { name: /^Open Club.* details$/ },
      { timeout: 15_000 }
    )
    if (!club) throw new Error('The story Fighter holds no Club.')
    await userEvent.click(club)
    await expectInspectorReady(canvasElement, 'Club', 'Owned item')
  }

export const ItemInspector: Story = { play: inspectItem() }

export const ItemInspectorMobile: Story = { ...phone, play: inspectItem(true) }
