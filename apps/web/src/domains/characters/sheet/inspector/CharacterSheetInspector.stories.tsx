import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { expect, userEvent, within } from 'storybook/test'
import { astralTearCharacterSheetFixture } from '../fixtures/astralTearSheet.fixtures'
import { CharacterSheetView } from '../core/CharacterSheetView'
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
  panelHandler
} from '../fixtures/characterSheetStory.fixture'

const meta = {
  ...characterSheetStoryMeta,
  title: 'Domains/Characters/Character Sheet/Inspector'
} satisfies Meta<typeof CharacterSheetView>

export default meta

type Story = StoryObj<typeof meta>

export const AbilityInspector: Story = {
  parameters: {
    msw: { handlers: [panelHandler(abilityPanelFixture)] }
  },
  play: openStrengthInspector
}

export const AbilityInspectorLight: Story = {
  globals: {
    theme: 'light'
  },
  parameters: {
    msw: { handlers: [panelHandler(abilityPanelFixture)] }
  },
  play: openStrengthInspector
}

export const AbilityInspectorAdjusted: Story = {
  parameters: {
    msw: { handlers: [panelHandler(adjustedAbilityPanelFixture)] }
  },
  play: openStrengthInspector
}

export const AbilityInspectorOverridden: Story = {
  parameters: {
    msw: { handlers: [panelHandler(overriddenAbilityPanelFixture)] }
  },
  play: openStrengthInspector
}

export const AbilityInspectorMobile: Story = {
  parameters: {
    msw: { handlers: [panelHandler(abilityPanelFixture)] },
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
  parameters: {
    msw: { handlers: [panelHandler(abilityPanelFixture)] },
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
  parameters: {
    msw: { handlers: [panelHandler(abilityPanelFixture)] },
    viewport: {
      options: characterSheetTabletViewports
    }
  },
  play: openStrengthInspector
}

export const SavingThrowInspector: Story = {
  parameters: {
    msw: { handlers: [panelHandler(savingThrowPanelFixture)] }
  },
  play: openStrengthSaveInspector
}

export const SkillInspector: Story = {
  parameters: {
    msw: { handlers: [panelHandler(skillPanelFixture)] }
  },
  play: openArcanaInspector
}

export const SkillsInspector: Story = {
  parameters: {
    msw: { handlers: [panelHandler(skillsPanelFixture)] }
  },
  play: openSkillsInspector
}

export const SensesInspector: Story = {
  parameters: {
    msw: { handlers: [panelHandler(sensesPanelFixture)] }
  },
  play: openSensesInspector
}

export const MovementInspector: Story = {
  parameters: {
    msw: { handlers: [panelHandler(movementPanelFixture)] }
  },
  play: openMovementInspector
}

export const DefensesInspector: Story = {
  parameters: {
    msw: { handlers: [panelHandler(defensesPanelFixture)] }
  },
  play: openDefensesInspector
}

export const ProficienciesInspector: Story = {
  parameters: {
    msw: { handlers: [panelHandler(proficienciesPanelFixture)] }
  },
  play: openProficienciesInspector
}

export const SpellInspector: Story = {
  args: {
    initialTab: 'spells'
  },
  parameters: {
    msw: { handlers: [panelHandler(spellPanelFixture)] }
  },
  play: openSpellInspector
}

export const SpellInspectorMobile: Story = {
  ...SpellInspector,
  parameters: {
    msw: { handlers: [panelHandler(spellPanelFixture)] },
    viewport: { defaultViewport: 'mobile1' }
  }
}

export const ItemInspector: Story = {
  args: {
    initialTab: 'inventory'
  },
  parameters: {
    msw: { handlers: [panelHandler(itemPanelFixture)] }
  },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Open Wand of Magic Missiles details' })
    )
    await expectInspectorReady(canvasElement, 'Moon-Touched Longsword', 'Owned item')
  }
}

export const ItemInspectorMobile: Story = {
  ...ItemInspector,
  parameters: {
    msw: { handlers: [panelHandler(itemPanelFixture)] },
    viewport: { defaultViewport: 'mobile1' }
  }
}

export const AstralTearItemInspector: Story = {
  args: {
    initialTab: 'inventory',
    sheet: astralTearCharacterSheetFixture
  },
  parameters: {
    msw: { handlers: [panelHandler(astralTearItemPanelFixture)] }
  },
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
  parameters: {
    msw: { handlers: [panelHandler(spellPanelAttackDamageFixture)] }
  }
}

export const SpellInspectorSaveDamage: Story = {
  ...SpellInspectorAttackDamage,
  parameters: {
    msw: { handlers: [panelHandler(spellPanelSaveDamageFixture)] }
  }
}

export const SpellInspectorEmptyCustomizations: Story = {
  ...SpellInspector,
  parameters: {
    msw: { handlers: [panelHandler(spellPanelEmptyCustomizationsFixture)] }
  },
  play: expandSpellCustomize
}

export const SpellInspectorConfiguredCustomizations: Story = {
  ...SpellInspector,
  parameters: {
    msw: { handlers: [panelHandler(spellPanelConfiguredCustomizationsFixture)] }
  },
  play: showConfiguredSpellCustomizations
}

export const SpellsInspector: Story = {
  args: {
    initialTab: 'spells'
  },
  parameters: {
    msw: { handlers: [panelHandler(spellsPanelFixture)] }
  },
  play: openSpellsInspector
}

export const SpellsInspectorMobile: Story = {
  ...SpellsInspector,
  parameters: {
    msw: { handlers: [panelHandler(spellsPanelFixture)] },
    viewport: { defaultViewport: 'mobile1' }
  }
}
