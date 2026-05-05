import { Alert } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { HttpResponse, http } from 'msw'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characters'
import { CharacterSheetHero } from '../components/sheet/CharacterSheetHero'
import { CharacterSheetOverview } from '../components/sheet/CharacterSheetOverview'
import type { CharacterSheetTabId } from '../components/sheet/CharacterSheet.types'
import { CharacterSheetView } from '../components/sheet/CharacterSheetView'
import * as styles from '../components/sheet/characterSheet.css'
import {
  characterHistoryFixture,
  characterSheetFixture
} from '../character.fixtures'

const API_BASE = 'http://localhost:3001'

const meta = {
  title: 'Domains/Characters/Sheet',
  component: CharacterSheetStoryHarness,
  parameters: {
    docs: {
      description: {
        component: 'Interactive character sheet states for play-state management. Dice rolling is intentionally deferred to the dice tranche.'
      }
    },
    msw: {
      handlers: [http.get(`${API_BASE}/characters/:characterId/history`, () => HttpResponse.json(characterHistoryFixture))]
    }
  },
  args: {
    hasDraft: false,
    maxWidth: 1280,
    sheet: characterSheetFixture
  }
} satisfies Meta<typeof CharacterSheetStoryHarness>

export default meta

type Story = StoryObj<typeof meta>

export const Overview: Story = {}

export const DraftBanner: Story = {
  args: {
    hasDraft: true
  }
}

export const ResourcesAndRests: Story = {
  args: {
    initialTab: 'resources'
  }
}

export const SpellManagement: Story = {
  args: {
    initialTab: 'spells'
  }
}

export const InventoryManagement: Story = {
  args: {
    initialTab: 'inventory'
  }
}

export const ReferenceRules: Story = {
  args: {
    initialTab: 'reference'
  }
}

export const History: Story = {
  args: {
    initialTab: 'history'
  }
}

export const MobileOverview: Story = {
  args: {
    maxWidth: 390
  }
}

export const EmptyCharacter: Story = {
  args: {
    sheet: createEmptySheet()
  }
}

export const CommandError: Story = {
  render: (args) => (
    <CharacterSheetCommandErrorPreview
      hasDraft={args.hasDraft}
      maxWidth={args.maxWidth}
      sheet={args.sheet}
    />
  )
}

function CharacterSheetStoryHarness({
  hasDraft,
  initialTab = 'overview',
  maxWidth,
  sheet
}: {
  hasDraft: boolean
  initialTab?: CharacterSheetTabId
  maxWidth: number
  sheet: CharacterSheetResponseDto
}) {
  return (
    <div style={{ margin: '0 auto', maxWidth, minHeight: '100vh', padding: '24px' }}>
      <CharacterSheetView hasDraft={hasDraft} initialTab={initialTab} sheet={sheet} />
    </div>
  )
}

function CharacterSheetCommandErrorPreview({
  hasDraft,
  maxWidth,
  sheet
}: {
  hasDraft: boolean
  maxWidth: number
  sheet: CharacterSheetResponseDto
}) {
  return (
    <div style={{ margin: '0 auto', maxWidth, minHeight: '100vh', padding: '24px' }}>
      <div className={styles.shell}>
        <CharacterSheetHero hasDraft={hasDraft} sheet={sheet} />
        <Alert color='red'>
          This character changed in another tab. Refresh the sheet, then try the command again.
        </Alert>
        <CharacterSheetOverview
          pending={false}
          sheet={sheet}
          submitCommand={() => undefined}
        />
      </div>
    </div>
  )
}

function createEmptySheet(): CharacterSheetResponseDto {
  return {
    ...characterSheetFixture,
    meta: {
      ...characterSheetFixture.meta,
      streamVersion: 1
    },
    overview: {
      ...characterSheetFixture.overview,
      currentHitPoints: 6,
      maxHitPoints: 6,
      tempHitPoints: 0,
      exhaustionLevel: 0,
      exhaustionNotes: undefined,
      conditions: []
    },
    actions: { items: [] },
    resources: {
      items: [],
      hitDice: [{ die: 6, total: 1, used: 0, remaining: 1 }]
    },
    spells: {
      saveDc: null,
      attackBonus: null,
      slots: [],
      spells: [],
      preparationSources: []
    },
    inventory: {
      items: [],
      currencies: []
    },
    reference: {
      ...characterSheetFixture.reference,
      features: [],
      proficiencies: [],
      defenses: [],
      senses: []
    },
    notes: {}
  }
}
