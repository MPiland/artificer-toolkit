import type { Decorator, Meta, StoryObj } from '@storybook/tanstack-react'
import { useQueryClient } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { Box } from '@mantine/core'
import { delay } from 'msw'
import { expect, mocked, userEvent, within } from 'storybook/test'
import { useMutation as useConvexMutation } from 'convex/react'
import { getFunctionName } from 'convex/server'
import type { CharacterSheetPanelDto } from '@artificer-toolkit/schema/api/characterSheetPanel'
import { characterSheetPanelInputSchema } from '@artificer-toolkit/schema/api/characterSheetPanel'
import { characterSheetExecuteInputSchema } from '@artificer-toolkit/schema/api/characterSheetCommands'
import { characterSheetExtraCatalogReadInputSchema } from '@artificer-toolkit/schema/api/characterSheetData'
import { rollRecordDtoSchema } from '@artificer-toolkit/schema/api/rolls'
import { characterPreparationOptionsResponseDtoSchema } from '@artificer-toolkit/schema/api/characterPreparationOptions'
import { mockSheetRestPreview } from './characterSheetNativeStory.fixture'
import { characterSheetFixture } from './characterSheet.fixtures'
import { CharacterSheetFixtureView as CharacterSheetView } from './CharacterSheetFixtureView'
import { companionPanelFixture, vehiclePanelFixture } from '../inspector/inspector.fixtures'

export function withSheetPanel(panel: CharacterSheetPanelDto): Decorator {
  return (Story) => {
    const queryClient = useQueryClient()
    queryClient.setQueryDefaults(
      ['convexQuery', getFunctionName(convexApi.characters.panels.get)],
      {
        queryFn: async () => panel
      }
    )
    queryClient.setQueryDefaults(
      ['convexQuery', getFunctionName(convexApi.characters.preparationOptions.get)],
      {
        queryFn: async () =>
          characterPreparationOptionsResponseDtoSchema.parse({
            characterId: panel.characterId,
            streamVersion: characterSheetFixture.meta.streamVersion,
            classes:
              panel.kind === 'SPELLS'
                ? [
                    ...new Set(
                      panel.groups.flatMap((group) =>
                        group.sources.flatMap((source) =>
                          source.preparationClassId ? [source.preparationClassId] : []
                        )
                      )
                    )
                  ].map((classId) => ({
                    classId,
                    label: 'Class spells',
                    preparedSpellLimit: 20,
                    eligibleSpellIds: panel.groups.flatMap((group) =>
                      group.sources
                        .filter((source) => source.preparationClassId === classId)
                        .map((source) => source.spellId)
                    ),
                    preparedSpellIds: panel.groups.flatMap((group) =>
                      group.sources
                        .filter(
                          (source) => source.preparationClassId === classId && source.prepared
                        )
                        .map((source) => source.spellId)
                    )
                  }))
                : [],
            catalogue: {
              kind: 'INLINE',
              spells:
                panel.kind === 'SPELLS'
                  ? panel.groups.flatMap((group) =>
                      group.sources.map((source) => ({
                        spellId: source.spellId,
                        label: source.label,
                        level: group.level
                      }))
                    )
                  : []
            }
          })
      }
    )
    return <Story />
  }
}

export const withExtrasPanels: Decorator = (Story) => {
  const queryClient = useQueryClient()
  queryClient.setQueryDefaults(
    ['convexQuery', getFunctionName(convexApi.characters.extraOptions.list)],
    {
      queryFn: async ({ queryKey }) => {
        const input = characterSheetExtraCatalogReadInputSchema.parse(queryKey[2])
        const items =
          input.kind === 'CREATURE'
            ? [{ id: companionPanelFixture.creatureId, label: 'Owl' }]
            : [{ id: '00000000-0000-4000-8000-000000000504', label: 'Sailing Ship' }]
        return {
          items: items.filter((item) =>
            item.label.toLowerCase().includes(input.query?.toLowerCase() ?? '')
          ),
          nextCursor: null
        }
      }
    }
  )
  queryClient.setQueryDefaults(['convexQuery', getFunctionName(convexApi.characters.panels.get)], {
    queryFn: async ({ queryKey }) => {
      const { target } = characterSheetPanelInputSchema.parse(queryKey[2])
      return target.kind === 'VEHICLE' ? vehiclePanelFixture : companionPanelFixture
    }
  })
  return <Story />
}

const hitDieRollBase = {
  id: '00000000-0000-4000-8000-000000000701',
  characterId: characterSheetFixture.meta.characterId,
  characterLabel: characterSheetFixture.identity.label,
  source: { kind: 'HIT_DIE', label: 'Short rest hit dice' },
  ruleset: { systemId: 'system-1', code: 'DND5E_2014', version: '1' },
  createdAt: '2026-08-20T12:00:00.000Z'
} as const

/** The dice the table rolled for the played Fighter's one d10: 5 + 1. */
const fighterHitDieRoll = rollRecordDtoSchema.parse({
  ...hitDieRollBase,
  normalizedExpression: '1d10 + 1',
  evidence: {
    terms: [{ count: 1, die: 10, rolls: [5], subtotal: 5 }],
    modifier: 1,
    mode: 'NORMAL',
    keep: 'FIRST',
    subtotal: 6,
    transform: { kind: 'NONE' },
    total: 6
  }
})

/** The dice the table rolled for the played multiclass's d10 and d8: 6 + 5 + 2. */
const multiclassHitDieRoll = rollRecordDtoSchema.parse({
  ...hitDieRollBase,
  normalizedExpression: '1d10 + 1d8 + 2',
  evidence: {
    terms: [
      { count: 1, die: 10, rolls: [6], subtotal: 6 },
      { count: 1, die: 8, rolls: [5], subtotal: 5 }
    ],
    modifier: 2,
    mode: 'NORMAL',
    keep: 'FIRST',
    subtotal: 11,
    transform: { kind: 'NONE' },
    total: 13
  }
})

function createHitDieRollMock(roll: typeof fighterHitDieRoll) {
  return () => {
    mocked(useConvexMutation).mockImplementation((reference) => {
      const mutate: ReturnType<typeof useConvexMutation> = Object.assign(
        async () => {
          if (getFunctionName(reference) === getFunctionName(convexApi.rolls.execute)) return roll
          if (getFunctionName(reference) === getFunctionName(convexApi.rolls.discard))
            return { ok: true }
          throw new Error(`Unconfigured native mutation: ${getFunctionName(reference)}`)
        },
        { withOptimisticUpdate: () => mutate }
      )
      return mutate
    })
  }
}

export const mockHitDieRoll = createHitDieRollMock(fighterHitDieRoll)
export const mockMulticlassHitDieRoll = createHitDieRollMock(multiclassHitDieRoll)

export function mockExtraCommands(fail = false) {
  mocked(useConvexMutation).mockImplementation((reference) => {
    const mutate: ReturnType<typeof useConvexMutation> = Object.assign(
      async (args?: unknown) => {
        if (
          getFunctionName(reference) !== getFunctionName(convexApi.characters.sheetCommands.execute)
        ) {
          throw new Error(`Unconfigured native mutation: ${getFunctionName(reference)}`)
        }
        characterSheetExecuteInputSchema.parse(args)
        if (fail) {
          await delay(1_500)
          throw new Error('The server rejected this change.')
        }
        return {
          characterId: characterSheetFixture.meta.characterId,
          streamVersion: characterSheetFixture.meta.streamVersion + 1
        }
      },
      { withOptimisticUpdate: () => mutate }
    )
    return mutate
  })
}

export const characterSheetStoryMeta = {
  title: 'Domains/Characters/CharacterSheetView',
  component: CharacterSheetView,
  tags: ['autodocs'],
  beforeEach: mockSheetRestPreview,
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

type CharacterSheetStory = StoryObj<typeof characterSheetStoryMeta>

export const characterSheetTabletViewports = {
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

export async function expectInspectorReady(
  canvasElement: HTMLElement,
  title: string,
  readyLabel: string
) {
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

export const openStrengthInspector: CharacterSheetStory['play'] = async ({
  canvas,
  canvasElement
}) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Inspect Strength ability' }))
  await expectInspectorReady(canvasElement, 'Strength', 'Effective score')
}

export const openStrengthSaveInspector: CharacterSheetStory['play'] = async ({
  canvas,
  canvasElement
}) => {
  await userEvent.click(canvas.getByRole('button', { name: /Inspect Strength saving throw/i }))
  await expectInspectorReady(canvasElement, 'Strength saving throw', 'Effective total')
}

export const openArcanaInspector: CharacterSheetStory['play'] = async ({
  canvas,
  canvasElement
}) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Arcana' }))
  await expectInspectorReady(canvasElement, 'Arcana', 'Effective total')
}

export const openSkillsInspector: CharacterSheetStory['play'] = async ({
  canvas,
  canvasElement
}) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Skills' }))
  await expectInspectorReady(canvasElement, 'Skills', 'Available skills')
}

export const openSensesInspector: CharacterSheetStory['play'] = async ({
  canvas,
  canvasElement
}) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Inspect Passive Perception' }))
  await expectInspectorReady(canvasElement, 'Senses', 'Available senses')
}

export const openMovementInspector: CharacterSheetStory['play'] = async ({
  canvas,
  canvasElement
}) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Speed 30 feet' }))
  await expectInspectorReady(canvasElement, 'Movement', 'Primary movement')
}

export const openDefensesInspector: CharacterSheetStory['play'] = async ({
  canvas,
  canvasElement
}) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Manage Resistances: None' }))
  await expectInspectorReady(canvasElement, 'Defenses', 'Active defenses')
}

export const openProficienciesInspector: CharacterSheetStory['play'] = async ({
  canvas,
  canvasElement
}) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Proficiencies' }))
  await expectInspectorReady(canvasElement, 'Proficiencies', 'Training entries')
}

export const openSpellInspector: CharacterSheetStory['play'] = async ({
  canvas,
  canvasElement
}) => {
  await userEvent.click(
    await canvas.findByRole(
      'button',
      { name: /^Open details for Magic Missile/ },
      { timeout: 5_000 }
    )
  )
  await expectInspectorReady(canvasElement, 'Magic Missile', 'Spell source')
}

export const openSpellsInspector: CharacterSheetStory['play'] = async ({
  canvas,
  canvasElement
}) => {
  await userEvent.click(
    await canvas.findByRole('button', { name: 'Manage Spells' }, { timeout: 5_000 })
  )
  await expectInspectorReady(canvasElement, 'Manage Spells', 'Spell slots')
}
