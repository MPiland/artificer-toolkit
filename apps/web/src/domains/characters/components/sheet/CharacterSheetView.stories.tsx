import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { Box } from '@mantine/core'
import { HttpResponse, delay, http } from 'msw'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import type { CharacterRestPreviewRequestDto, CharacterSheetPanelDto } from '#app/lib/api'
import {
  createCharacterRestPreviewFixture,
  characterSheetFixture,
  characterSheetMulticlassFixture,
  characterSheetSpellStatesFixture
} from '../../character.fixtures'
import { CharacterSheetView } from './CharacterSheetView'
import { CharacterSheetInspector } from './panels/CharacterSheetInspector'
import {
  abilityPanelFixture,
  adjustedAbilityPanelFixture,
  companionPanelFixture,
  defensesPanelFixture,
  itemPanelFixture,
  movementPanelFixture,
  overriddenAbilityPanelFixture,
  proficienciesPanelFixture,
  savingThrowPanelFixture,
  sensesPanelFixture,
  skillPanelFixture,
  spellPanelAttackDamageFixture,
  spellPanelConfiguredCustomizationsFixture,
  spellPanelEmptyCustomizationsFixture,
  skillsPanelFixture,
  spellPanelFixture,
  spellPanelSaveDamageFixture,
  spellsPanelFixture,
  vehiclePanelFixture
} from './panels/characterSheetPanel.fixtures'

function panelHandler(panel: CharacterSheetPanelDto) {
  return http.get('*/api/trpc/characters.panel', () =>
    HttpResponse.json([{ result: { data: panel } }])
  )
}

function extrasPanelHandler() {
  return http.get('*/api/trpc/characters.panel', ({ request }) => {
    const panel = request.url.includes('VEHICLE') ? vehiclePanelFixture : companionPanelFixture
    return HttpResponse.json([{ result: { data: panel } }])
  })
}

function extrasCommandHandler() {
  return http.post('*/api/trpc/characters.command', () =>
    HttpResponse.json([
      {
        result: {
          data: {
            characterId: characterSheetFixture.meta.characterId,
            streamVersion: characterSheetFixture.meta.streamVersion + 1,
            sheet: {
              ...characterSheetFixture,
              meta: {
                ...characterSheetFixture.meta,
                streamVersion: characterSheetFixture.meta.streamVersion + 1
              },
              extras: {
                kindOptions: [{ code: 'COMPANION', label: 'Companion' }],
                originOptions: [{ code: 'SUMMONED', label: 'Summoned' }],
                creatureOptions: [{ id: companionPanelFixture.creatureId, label: 'Owl' }],
                vehicleOptions: [{ id: vehiclePanelFixture.vehicleId, label: 'Sailing Ship' }],
                items: [
                  {
                    id: companionPanelFixture.companionInstanceId,
                    kind: 'COMPANION',
                    kindLabel: 'Companion',
                    creatureId: companionPanelFixture.creatureId,
                    relationshipKind: 'COMPANION',
                    relationshipLabel: 'Companion',
                    originKind: 'SUMMONED',
                    originLabel: 'Summoned',
                    authoredName: 'Owl',
                    displayName: 'Ferdinand',
                    customName: 'Ferdinand',
                    isActive: true,
                    armorClass: 11,
                    speedLabel: 'Flying 60 feet',
                    hitPoints: { current: 1, temp: 0, maximum: 1 },
                    hitDice: [],
                    actions: [],
                    features: [],
                    equipmentItemIds: []
                  },
                  {
                    id: '00000000-0000-4000-8000-000000000503',
                    kind: 'VEHICLE',
                    kindLabel: 'Vehicle',
                    vehicleId: '00000000-0000-4000-8000-000000000504',
                    authoredName: 'Sailing Ship',
                    displayName: 'Sailing Ship',
                    categoryLabel: 'Water vehicle',
                    isActive: true,
                    speedLabel: '4 mph',
                    crewLabel: '20 crew',
                    passengerCapacity: 20,
                    cargoCapacityLabel: '100 tons',
                    hitPoints: { current: 300, maximum: 300 },
                    actions: [],
                    features: [],
                    equipmentItemIds: []
                  },
                  {
                    id: '00000000-0000-4000-8000-000000000509',
                    kind: 'COMPANION',
                    kindLabel: 'Companion',
                    creatureId: companionPanelFixture.creatureId,
                    relationshipKind: 'COMPANION',
                    relationshipLabel: 'Companion',
                    originKind: 'SUMMONED',
                    originLabel: 'Summoned',
                    authoredName: 'Owl',
                    displayName: 'Owl',
                    isActive: true,
                    armorClass: 11,
                    speedLabel: 'Flying 60 feet',
                    hitPoints: { current: 1, temp: 0, maximum: 1 },
                    hitDice: [],
                    actions: [],
                    features: [],
                    equipmentItemIds: []
                  }
                ]
              }
            }
          }
        }
      }
    ])
  )
}

function extrasCommandErrorHandler() {
  return http.post('*/api/trpc/characters.command', async () => {
    await delay(1_500)
    return new HttpResponse(null, { status: 500 })
  })
}

function restPreviewHandler() {
  return http.post('*/api/trpc/characters.restPreview', async ({ request }) => {
    const body: unknown = await request.json()
    if (typeof body !== 'object' || body === null || !('0' in body)) {
      return new HttpResponse(null, { status: 400 })
    }

    const input = (body as { 0: { id: string; input: CharacterRestPreviewRequestDto } })[0].input
    return HttpResponse.json([
      {
        result: {
          data: createCharacterRestPreviewFixture(input)
        }
      }
    ])
  })
}

const meta = {
  title: 'Domains/Characters/CharacterSheetView',
  component: CharacterSheetView,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <Box bg='var(--mantine-color-body)' h='100dvh' p={{ base: 'md', md: 'xl' }}>
        <Story />
      </Box>
    )
  ],
  args: {
    characterPublicId: characterSheetFixture.publicId ?? characterSheetFixture.meta.characterId,
    hasDraft: false,
    sheet: characterSheetFixture
  }
} satisfies Meta<typeof CharacterSheetView>

export default meta

type Story = StoryObj<typeof meta>

const characterSheetTabletViewports = {
  characterSheetTabletPortrait: {
    name: 'Character Sheet tablet portrait',
    styles: {
      width: '820px',
      height: '1180px'
    },
    type: 'tablet'
  },
  characterSheetTabletLandscape: {
    name: 'Character Sheet tablet landscape',
    styles: {
      width: '1180px',
      height: '820px'
    },
    type: 'tablet'
  }
} as const

async function expectInspectorReady(canvasElement: HTMLElement, title: string, readyLabel: string) {
  const inspector = await within(canvasElement.ownerDocument.body).findByRole(
    'dialog',
    { name: title },
    { timeout: 10_000 }
  )
  await expect(inspector).toBeVisible()
  await expect(
    within(inspector).queryByLabelText('Loading character details')
  ).not.toBeInTheDocument()
  await expect(await within(inspector).findByText(readyLabel, { exact: true })).toBeVisible()
}

const openStrengthInspector: Story['play'] = async ({ canvas, canvasElement }) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Inspect Strength ability' }))
  await expectInspectorReady(canvasElement, 'Strength', 'Effective score')
}

const openStrengthSaveInspector: Story['play'] = async ({ canvas, canvasElement }) => {
  await userEvent.click(canvas.getByRole('button', { name: /Inspect Strength saving throw/i }))
  await expectInspectorReady(canvasElement, 'Strength saving throw', 'Effective total')
}

const openArcanaInspector: Story['play'] = async ({ canvas, canvasElement }) => {
  await userEvent.click(canvas.getByRole('button', { name: /Arcana/ }))
  await expectInspectorReady(canvasElement, 'Arcana', 'Effective total')
}

const openSkillsInspector: Story['play'] = async ({ canvas, canvasElement }) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Skills' }))
  await expectInspectorReady(canvasElement, 'Skills', 'Available skills')
}

const openSensesInspector: Story['play'] = async ({ canvas, canvasElement }) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Senses' }))
  await expectInspectorReady(canvasElement, 'Senses', 'Available senses')
}

const openMovementInspector: Story['play'] = async ({ canvas, canvasElement }) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Speed 30 feet' }))
  await expectInspectorReady(canvasElement, 'Movement', 'Primary movement')
}

const openDefensesInspector: Story['play'] = async ({ canvas, canvasElement }) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Defenses' }))
  await expectInspectorReady(canvasElement, 'Defenses', 'Active defenses')
}

const openProficienciesInspector: Story['play'] = async ({ canvas, canvasElement }) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Proficiencies' }))
  await expectInspectorReady(canvasElement, 'Proficiencies', 'Training entries')
}

const openSpellInspector: Story['play'] = async ({ canvasElement }) => {
  await expectInspectorReady(canvasElement, 'Magic Missile', 'Spell source')
}

const openSpellsInspector: Story['play'] = async ({ canvasElement }) => {
  await expectInspectorReady(canvasElement, 'Manage Spells', 'Spell slots')
}

export const Desktop: Story = {}

export const Mobile: Story = {
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

export const ShortRestPreview: Story = {
  args: {
    initialTab: 'actions',
    sheet: characterSheetMulticlassFixture
  },
  parameters: {
    msw: { handlers: [restPreviewHandler()] }
  },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Short Rest' }))
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog', {
      name: 'Short Rest'
    })
    await userEvent.click(
      await within(dialog).findByRole('button', { name: 'Add one d10 hit die' })
    )
    const addD8 = within(dialog).getByRole('button', { name: 'Add one d8 hit die' })
    await waitFor(() => expect(addD8).toBeEnabled())
    await userEvent.click(addD8)
    await expect(within(dialog).getByText('1d10 + 1d8 + 4')).toBeVisible()
    await expect(within(dialog).getByRole('button', { name: 'Take Short Rest' })).toBeVisible()
  }
}

export const ShortRestRolled: Story = {
  ...ShortRestPreview,
  play: async (context) => {
    await ShortRestPreview.play?.(context)
    const dialog = await within(context.canvasElement.ownerDocument.body).findByRole('dialog', {
      name: 'Short Rest'
    })
    await userEvent.click(within(dialog).getByRole('button', { name: '1d10 + 1d8 + 4' }))
    const rollLabels = await within(dialog).findAllByText('15 rolled')
    await expect(rollLabels[0]).toBeVisible()
    await expect(within(dialog).getByText('6 HP staged')).toBeVisible()
  }
}

export const ShortRestPreviewMobile: Story = {
  ...ShortRestPreview,
  parameters: {
    ...ShortRestPreview.parameters,
    viewport: {
      defaultViewport: 'mobile1'
    }
  }
}

export const LongRestPreview: Story = {
  args: {
    initialTab: 'actions',
    sheet: characterSheetMulticlassFixture
  },
  parameters: {
    msw: { handlers: [restPreviewHandler()] }
  },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Long Rest' }))
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog', {
      name: 'Long Rest'
    })
    await expect(await within(dialog).findByText('No roll needed')).toBeVisible()
    await expect(
      await within(dialog).findByRole('button', { name: 'Take Long Rest' })
    ).toBeEnabled()
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

export const Extras: Story = {
  parameters: { msw: { handlers: [extrasPanelHandler(), extrasCommandHandler()] } },
  args: {
    initialTab: 'extras',
    sheet: {
      ...characterSheetFixture,
      extras: {
        kindOptions: [
          { code: 'COMPANION', label: 'Companion' },
          { code: 'MOUNT', label: 'Mount' },
          { code: 'OWNED', label: 'Owned creature' },
          { code: 'VEHICLE', label: 'Vehicle' }
        ],
        originOptions: [
          { code: 'WORLD', label: 'World' },
          { code: 'SUMMONED', label: 'Summoned' }
        ],
        creatureOptions: [{ id: companionPanelFixture.creatureId, label: 'Owl' }],
        vehicleOptions: [{ id: vehiclePanelFixture.vehicleId, label: 'Sailing Ship' }],
        items: [
          {
            id: '00000000-0000-4000-8000-000000000501',
            kind: 'COMPANION',
            kindLabel: 'Companion',
            creatureId: '00000000-0000-4000-8000-000000000502',
            relationshipKind: 'COMPANION',
            relationshipLabel: 'Companion',
            originKind: 'SUMMONED',
            originLabel: 'Summoned',
            authoredName: 'Owl',
            displayName: 'Ferdinand',
            customName: 'Ferdinand',
            isActive: true,
            armorClass: 11,
            speedLabel: 'Flying 60 feet',
            hitPoints: { current: 1, temp: 0, maximum: 1 },
            hitDice: [],
            actions: [],
            features: [],
            equipmentItemIds: []
          },
          {
            id: '00000000-0000-4000-8000-000000000503',
            kind: 'VEHICLE',
            kindLabel: 'Vehicle',
            vehicleId: '00000000-0000-4000-8000-000000000504',
            authoredName: 'Sailing Ship',
            displayName: 'Sailing Ship',
            categoryLabel: 'Water vehicle',
            isActive: true,
            speedLabel: '4 mph',
            crewLabel: '20 crew',
            passengerCapacity: 20,
            cargoCapacityLabel: '100 tons',
            hitPoints: { current: 300, maximum: 300 },
            actions: [],
            features: [],
            equipmentItemIds: []
          }
        ]
      }
    }
  },
  play: async ({ canvas, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByRole('button', { name: /add extra/i }))
    await body.findByText('Kind')
    for (const [label, option] of [
      ['Kind', 'Companion'],
      ['Creature', 'Owl'],
      ['Origin', 'Summoned']
    ] as const) {
      const input = body
        .getAllByLabelText(label)
        .find((element) => element instanceof HTMLInputElement)
      if (!input) throw new Error(`${label} input is unavailable`)
      await userEvent.click(input)
      await userEvent.click(await body.findByRole('option', { name: option }))
    }
    const drawer = body.getByRole('dialog', { name: 'Add Extra' })
    await userEvent.click(within(drawer).getByRole('button', { name: /^add extra$/i }))
    await waitFor(() =>
      expect(body.queryByRole('dialog', { name: 'Add Extra' })).not.toBeInTheDocument()
    )

    const companionRow = canvas.getByRole('button', {
      name: 'Open Ferdinand (Owl) details'
    })
    await userEvent.click(companionRow)
    const inspector = await body.findByRole('dialog', { name: 'Ferdinand' })
    await userEvent.click(
      within(inspector).getByRole('button', { name: 'Close character inspector' })
    )
    await waitFor(() => expect(inspector).not.toBeInTheDocument())
    await waitFor(() => expect(companionRow).toHaveFocus())
  }
}

export const ExtrasCommandError: Story = {
  parameters: {
    msw: { handlers: [extrasPanelHandler(), extrasCommandErrorHandler()] }
  },
  args: Extras.args
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
            sourceLabel: 'Core action',
            description: '<p>Gain extra movement for the current turn.</p>'
          },
          {
            id: 'action-opportunity-attack',
            label: 'Opportunity Attack',
            kind: 'REACTION',
            sourceLabel: 'Core action',
            description:
              '<p>Make one melee attack when a creature leaves your reach without disengaging.</p>'
          },
          {
            id: 'action-force-ballista',
            label: 'Force Ballista',
            kind: 'ACTION',
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
  render: (args) => (
    <>
      <CharacterSheetView {...args} />
      <CharacterSheetInspector
        characterId={characterSheetFixture.meta.characterId}
        expectedVersion={characterSheetFixture.meta.streamVersion}
        pending={false}
        submitCommand={async () => false}
        target={spellPanelFixture.target}
        onClose={() => undefined}
        onOpenBuilder={() => undefined}
        onTargetChange={() => undefined}
      />
    </>
  ),
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
  render: (args) => (
    <>
      <CharacterSheetView {...args} />
      <CharacterSheetInspector
        characterId={characterSheetFixture.meta.characterId}
        expectedVersion={characterSheetFixture.meta.streamVersion}
        pending={false}
        submitCommand={async () => false}
        target={itemPanelFixture.target}
        onClose={() => undefined}
        onOpenBuilder={() => undefined}
        onTargetChange={() => undefined}
      />
    </>
  ),
  play: async ({ canvasElement }) => {
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

const expandSpellCustomize: Story['play'] = async ({ canvasElement }) => {
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
  },
  render: (args) => (
    <>
      <CharacterSheetView {...args} />
      <CharacterSheetInspector
        characterId={characterSheetFixture.meta.characterId}
        expectedVersion={characterSheetFixture.meta.streamVersion}
        pending={false}
        submitCommand={async () => false}
        target={spellPanelAttackDamageFixture.target}
        onClose={() => undefined}
        onOpenBuilder={() => undefined}
        onTargetChange={() => undefined}
      />
    </>
  )
}

export const SpellInspectorSaveDamage: Story = {
  ...SpellInspectorAttackDamage,
  parameters: {
    msw: { handlers: [panelHandler(spellPanelSaveDamageFixture)] }
  },
  render: (args) => (
    <>
      <CharacterSheetView {...args} />
      <CharacterSheetInspector
        characterId={characterSheetFixture.meta.characterId}
        expectedVersion={characterSheetFixture.meta.streamVersion}
        pending={false}
        submitCommand={async () => false}
        target={spellPanelSaveDamageFixture.target}
        onClose={() => undefined}
        onOpenBuilder={() => undefined}
        onTargetChange={() => undefined}
      />
    </>
  )
}

export const SpellInspectorEmptyCustomizations: Story = {
  ...SpellInspector,
  parameters: {
    msw: { handlers: [panelHandler(spellPanelEmptyCustomizationsFixture)] }
  },
  render: (args) => (
    <>
      <CharacterSheetView {...args} />
      <CharacterSheetInspector
        characterId={characterSheetFixture.meta.characterId}
        expectedVersion={characterSheetFixture.meta.streamVersion}
        pending={false}
        submitCommand={async () => false}
        target={spellPanelEmptyCustomizationsFixture.target}
        onClose={() => undefined}
        onOpenBuilder={() => undefined}
        onTargetChange={() => undefined}
      />
    </>
  ),
  play: expandSpellCustomize
}

export const SpellInspectorConfiguredCustomizations: Story = {
  ...SpellInspector,
  parameters: {
    msw: { handlers: [panelHandler(spellPanelConfiguredCustomizationsFixture)] }
  },
  render: (args) => (
    <>
      <CharacterSheetView {...args} />
      <CharacterSheetInspector
        characterId={characterSheetFixture.meta.characterId}
        expectedVersion={characterSheetFixture.meta.streamVersion}
        pending={false}
        submitCommand={async () => false}
        target={spellPanelConfiguredCustomizationsFixture.target}
        onClose={() => undefined}
        onOpenBuilder={() => undefined}
        onTargetChange={() => undefined}
      />
    </>
  ),
  play: showConfiguredSpellCustomizations
}

export const SpellsInspector: Story = {
  args: {
    initialTab: 'spells'
  },
  parameters: {
    msw: { handlers: [panelHandler(spellsPanelFixture)] }
  },
  render: (args) => (
    <>
      <CharacterSheetView {...args} />
      <CharacterSheetInspector
        characterId={characterSheetFixture.meta.characterId}
        expectedVersion={characterSheetFixture.meta.streamVersion}
        pending={false}
        submitCommand={async () => false}
        target={spellsPanelFixture.target}
        onClose={() => undefined}
        onOpenBuilder={() => undefined}
        onTargetChange={() => undefined}
      />
    </>
  ),
  play: openSpellsInspector
}

export const SpellsInspectorMobile: Story = {
  ...SpellsInspector,
  parameters: {
    msw: { handlers: [panelHandler(spellsPanelFixture)] },
    viewport: { defaultViewport: 'mobile1' }
  }
}
