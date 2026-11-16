import type { Decorator, Meta } from '@storybook/tanstack-react'
import { useQueryClient } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { Box } from '@mantine/core'
import { mocked } from 'storybook/test'
import { useMutation as useConvexMutation } from 'convex/react'
import { getFunctionName } from 'convex/server'
import type { CharacterSheetPanelDto } from '@artificer-toolkit/schema/api/characterSheetPanel'
import { rollRecordDtoSchema } from '@artificer-toolkit/schema/api/rolls'
import { characterPreparationOptionsResponseDtoSchema } from '@artificer-toolkit/schema/api/characterPreparationOptions'
import { mockSheetRestPreview } from './characterSheetNativeStory.fixture'
import { characterSheetFixture } from './characterSheet.fixtures'
import { CharacterSheetFixtureView as CharacterSheetView } from './CharacterSheetFixtureView'

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

const hitDieRollBase = {
  id: '00000000-0000-4000-8000-000000000701',
  characterId: characterSheetFixture.meta.characterId,
  characterLabel: characterSheetFixture.identity.label,
  source: { kind: 'HIT_DIE', label: 'Short rest hit dice' },
  ruleset: { systemId: 'system-1', code: 'DND5E_2014', version: '1' },
  createdAt: '2026-08-20T12:00:00.000Z'
} as const

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

export function mockMulticlassHitDieRoll() {
  mocked(useConvexMutation).mockImplementation((reference) => {
    const mutate: ReturnType<typeof useConvexMutation> = Object.assign(
      async () => {
        if (getFunctionName(reference) === getFunctionName(convexApi.rolls.execute))
          return multiclassHitDieRoll
        if (getFunctionName(reference) === getFunctionName(convexApi.rolls.discard))
          return { ok: true }
        throw new Error(`Unconfigured native mutation: ${getFunctionName(reference)}`)
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
