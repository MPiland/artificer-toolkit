import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { expect, userEvent, within } from 'storybook/test'
import { astralTearCharacterSheetFixture } from '../fixtures/astralTearSheet.fixtures'
import { CharacterSheetFixtureView as CharacterSheetView } from '../fixtures/CharacterSheetFixtureView'
import {
  abilityPanelFixture,
  adjustedAbilityPanelFixture,
  astralTearItemPanelFixture,
  defensesPanelFixture,
  itemPanelFixture,
  movementPanelFixture,
  overriddenAbilityPanelFixture,
  proficienciesPanelFixture,
  savingThrowPanelFixture,
  sensesPanelFixture,
  skillPanelFixture,
  skillsPanelFixture,
  spellPanelAttackDamageFixture,
  spellPanelConfiguredCustomizationsFixture,
  spellPanelEmptyCustomizationsFixture,
  spellPanelFixture,
  spellPanelSaveDamageFixture,
  spellsPanelFixture
} from './inspector.fixtures'
import {
  characterSheetStoryMeta,
  characterSheetTabletViewports,
  expectInspectorReady,
  openArcanaInspector,
  openDefensesInspector,
  openMovementInspector,
  openProficienciesInspector,
  openSensesInspector,
  openSkillsInspector,
  openSpellInspector,
  openSpellsInspector,
  openStrengthInspector,
  openStrengthSaveInspector,
  withSheetPanel
} from '../fixtures/characterSheetStory.fixture'

const meta = {
  ...characterSheetStoryMeta,
  title: 'Domains/Characters/Character Sheet/Inspector'
} satisfies Meta<typeof CharacterSheetView>

export default meta

type Story = StoryObj<typeof meta>

export const AbilityInspector: Story = {
  decorators: [withSheetPanel(abilityPanelFixture)],
  play: openStrengthInspector
}

export const AbilityInspectorLight: Story = {
  globals: {
    theme: 'light'
  },
  decorators: [withSheetPanel(abilityPanelFixture)],
  play: openStrengthInspector
}

export const AbilityInspectorAdjusted: Story = {
  decorators: [withSheetPanel(adjustedAbilityPanelFixture)],
  play: openStrengthInspector
}

export const AbilityInspectorOverridden: Story = {
  decorators: [withSheetPanel(overriddenAbilityPanelFixture)],
  play: openStrengthInspector
}

export const AbilityInspectorMobile: Story = {
  decorators: [withSheetPanel(abilityPanelFixture)],
  parameters: {
    viewport: {
      defaultViewport: 'mobile1'
    }
  },
  play: openStrengthInspector
}

export const AbilityInspectorTabletPortrait: Story = {
  globals: {
    viewport: {
      value: 'characterSheetTabletPortrait',
      isRotated: false
    }
  },
  decorators: [withSheetPanel(abilityPanelFixture)],
  parameters: {
    viewport: {
      options: characterSheetTabletViewports
    }
  },
  play: openStrengthInspector
}

export const AbilityInspectorTabletLandscape: Story = {
  globals: {
    viewport: {
      value: 'characterSheetTabletLandscape',
      isRotated: false
    }
  },
  decorators: [withSheetPanel(abilityPanelFixture)],
  parameters: {
    viewport: {
      options: characterSheetTabletViewports
    }
  },
  play: openStrengthInspector
}

export const SavingThrowInspector: Story = {
  decorators: [withSheetPanel(savingThrowPanelFixture)],
  play: openStrengthSaveInspector
}

export const SkillInspector: Story = {
  decorators: [withSheetPanel(skillPanelFixture)],
  play: openArcanaInspector
}

export const SkillsInspector: Story = {
  decorators: [withSheetPanel(skillsPanelFixture)],
  play: openSkillsInspector
}

export const SensesInspector: Story = {
  decorators: [withSheetPanel(sensesPanelFixture)],
  play: openSensesInspector
}

export const MovementInspector: Story = {
  decorators: [withSheetPanel(movementPanelFixture)],
  play: openMovementInspector
}

export const DefensesInspector: Story = {
  decorators: [withSheetPanel(defensesPanelFixture)],
  play: openDefensesInspector
}

export const ProficienciesInspector: Story = {
  decorators: [withSheetPanel(proficienciesPanelFixture)],
  play: openProficienciesInspector
}

export const SpellInspector: Story = {
  args: {
    initialTab: 'spells'
  },
  decorators: [withSheetPanel(spellPanelFixture)],
  play: openSpellInspector
}

export const SpellInspectorMobile: Story = {
  ...SpellInspector,
  decorators: [withSheetPanel(spellPanelFixture)],
  parameters: {
    viewport: { defaultViewport: 'mobile1' }
  }
}

export const ItemInspector: Story = {
  args: {
    initialTab: 'inventory'
  },
  decorators: [withSheetPanel(itemPanelFixture)],
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Open Wand of Magic Missiles details' })
    )
    await expectInspectorReady(canvasElement, 'Moon-Touched Longsword', 'Owned item')
  }
}

export const ItemInspectorMobile: Story = {
  ...ItemInspector,
  decorators: [withSheetPanel(itemPanelFixture)],
  parameters: {
    viewport: { defaultViewport: 'mobile1' }
  }
}

export const AstralTearItemInspector: Story = {
  args: {
    initialTab: 'inventory',
    sheet: astralTearCharacterSheetFixture
  },
  decorators: [withSheetPanel(astralTearItemPanelFixture)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      await canvas.findByRole('button', {
        name: 'Open The Astral Tear Awakened details'
      })
    )
    await expectInspectorReady(canvasElement, 'The Astral Tear Awakened', 'Owned item')
    const inspector = within(canvasElement.ownerDocument.body).getByRole('dialog', {
      name: 'The Astral Tear Awakened'
    })
    await expect(within(inspector).getByText('2 / 3')).toBeVisible()
    await expect(within(inspector).getByText('Resets: Dawn')).toBeVisible()
    await expect(within(inspector).getByText('Warping Strike')).toBeVisible()
    await expect(within(inspector).getByText('Spells')).toBeVisible()
    await expect(
      within(inspector).getByRole('button', { name: 'Use Warping Strike' })
    ).toBeVisible()
    await expect(within(inspector).getByRole('button', { name: 'Use Spells' })).toBeVisible()
  }
}

const expandSpellCustomize: Story['play'] = async (context) => {
  await openSpellInspector?.(context)
  const { canvasElement } = context
  await expectInspectorReady(canvasElement, 'Magic Missile', 'Spell source')
  const inspector = within(canvasElement.ownerDocument.body).getByRole('dialog', {
    name: 'Magic Missile'
  })
  await userEvent.click(within(inspector).getByRole('button', { name: /Customize/ }))
  await expect(await within(inspector).findByRole('textbox', { name: 'Custom name' })).toBeVisible()
}

const showConfiguredSpellCustomizations: Story['play'] = async (context) => {
  await expandSpellCustomize(context)
  const inspector = within(context.canvasElement.ownerDocument.body).getByRole('dialog', {
    name: 'Magic Missile'
  })
  const sourceNotes = await within(inspector).findAllByRole('textbox', { name: 'Source notes' })
  const lastSourceNote = sourceNotes.at(-1)
  if (!lastSourceNote) throw new Error('Expected a configured spell customization source note.')
  await userEvent.click(lastSourceNote)
  await expect(lastSourceNote).toBeVisible()
}

export const SpellInspectorCustomizeExpanded: Story = {
  ...SpellInspector,
  play: expandSpellCustomize
}

export const SpellInspectorCustomizeExpandedMobile: Story = {
  ...SpellInspectorMobile,
  play: expandSpellCustomize
}

export const SpellInspectorAttackDamage: Story = {
  ...SpellInspector,
  decorators: [withSheetPanel(spellPanelAttackDamageFixture)]
}

export const SpellInspectorSaveDamage: Story = {
  ...SpellInspectorAttackDamage,
  decorators: [withSheetPanel(spellPanelSaveDamageFixture)]
}

export const SpellInspectorEmptyCustomizations: Story = {
  ...SpellInspector,
  decorators: [withSheetPanel(spellPanelEmptyCustomizationsFixture)],
  play: expandSpellCustomize
}

export const SpellInspectorConfiguredCustomizations: Story = {
  ...SpellInspector,
  decorators: [withSheetPanel(spellPanelConfiguredCustomizationsFixture)],
  play: showConfiguredSpellCustomizations
}

export const SpellsInspector: Story = {
  args: {
    initialTab: 'spells'
  },
  decorators: [withSheetPanel(spellsPanelFixture)],
  play: openSpellsInspector
}

export const SpellsInspectorMobile: Story = {
  ...SpellsInspector,
  decorators: [withSheetPanel(spellsPanelFixture)],
  parameters: {
    viewport: { defaultViewport: 'mobile1' }
  }
}
