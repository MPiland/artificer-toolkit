import { Alert } from '@mantine/core'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { HttpResponse, http } from 'msw'
import { useEffect } from 'react'
import {
  characterSheetCommandInputDtoSchema,
  type CharacterHistoryEntryDto,
  type CharacterSheetCommandInputDto,
  type CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characters'
import { CharacterSheetHero } from '../components/sheet/CharacterSheetHero'
import { CharacterSheetInventory } from '../components/sheet/CharacterSheetInventory'
import { CharacterSheetNotes } from '../components/sheet/CharacterSheetNotes'
import { CharacterSheetOverview } from '../components/sheet/CharacterSheetOverview'
import type { CharacterSheetTabId } from '../components/sheet/CharacterSheet.types'
import { CharacterSheetView } from '../components/sheet/CharacterSheetView'
import * as styles from '../components/sheet/characterSheet.css'
import {
  characterHistoryFixture,
  characterSheetFixture
} from '../character.fixtures'
import { queryKeys } from '#app/lib/queryKeys'

const API_BASE = 'http://localhost:3001'
const STACKED_INVENTORY_CHARACTER_ID = 'character-story-stacked-inventory'
const sheetCommandHandlers = createSheetCommandHandlers(characterSheetFixture)

const meta = {
  title: 'Domains/Characters/Sheet',
  component: CharacterSheetStoryHarness,
  parameters: {
    docs: {
      description: {
        component: 'Interactive character sheet states for play-state management. Dice rolling is intentionally deferred to the dice tranche.'
      }
    },
    msw: { handlers: sheetCommandHandlers }
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

export const ConditionsAndExhaustion: Story = {
  args: {
    sheet: createConditionHeavySheet()
  }
}

export const ActionsReference: Story = {
  args: {
    initialTab: 'actions'
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

export const InventoryStackManagement: Story = {
  args: {
    initialTab: 'inventory',
    sheet: createStackedInventorySheet()
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

export const MobileSpellManagement: Story = {
  args: {
    initialTab: 'spells',
    maxWidth: 390
  }
}

export const MobileInventoryManagement: Story = {
  args: {
    initialTab: 'inventory',
    maxWidth: 390
  }
}

export const EmptyCharacter: Story = {
  args: {
    sheet: createEmptySheet()
  }
}

export const CommandPending: Story = {
  render: (args) => (
    <CharacterSheetCommandPendingPreview
      hasDraft={args.hasDraft}
      maxWidth={args.maxWidth}
      sheet={args.sheet}
    />
  )
}

export const CommandPendingInventory: Story = {
  render: (args) => (
    <CharacterSheetInventoryPendingPreview
      hasDraft={args.hasDraft}
      maxWidth={args.maxWidth}
      sheet={args.sheet}
    />
  )
}

export const CommandPendingNotes: Story = {
  render: (args) => (
    <CharacterSheetNotesPendingPreview
      hasDraft={args.hasDraft}
      maxWidth={args.maxWidth}
      sheet={args.sheet}
    />
  )
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
  const queryClient = useQueryClient()
  const characterId = sheet.meta.characterId
  const { data: liveSheet } = useQuery({
    queryKey: queryKeys.characters.sheet(characterId),
    queryFn: async () => sheet,
    initialData: sheet,
    staleTime: Infinity
  })

  useEffect(() => {
    queryClient.setQueryData(queryKeys.characters.sheet(characterId), sheet)
  }, [characterId, queryClient, sheet])

  return (
    <div style={{ margin: '0 auto', maxWidth, minHeight: '100vh', padding: '24px' }}>
      <CharacterSheetView hasDraft={hasDraft} initialTab={initialTab} sheet={liveSheet} />
    </div>
  )
}

function CharacterSheetCommandPendingPreview({
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
        <Alert color='blue'>
          A sheet command is being applied. Controls stay visible, but editing and command actions are temporarily disabled.
        </Alert>
        <CharacterSheetOverview
          pending
          sheet={sheet}
          submitCommand={() => undefined}
        />
      </div>
    </div>
  )
}

function CharacterSheetInventoryPendingPreview({
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
        <Alert color='blue'>
          Inventory command pending. Add, edit, equip, attune, and currency controls are temporarily disabled.
        </Alert>
        <CharacterSheetInventory
          pending
          sheet={sheet}
          submitCommand={() => undefined}
        />
      </div>
    </div>
  )
}

function CharacterSheetNotesPendingPreview({
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
        <Alert color='blue'>
          Notes command pending. Background notes remain readable, and session note editing is temporarily locked.
        </Alert>
        <CharacterSheetNotes
          pending
          sheet={sheet}
          submitCommand={() => undefined}
        />
      </div>
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

function createConditionHeavySheet(): CharacterSheetResponseDto {
  return {
    ...characterSheetFixture,
    overview: {
      ...characterSheetFixture.overview,
      exhaustionLevel: 3,
      exhaustionNotes: 'Heat haze from the glass desert still clings to every breath.',
      conditions: [
        ...characterSheetFixture.overview.conditions,
        {
          conditionTypeId: 'condition-prone',
          label: 'Prone',
          description: 'A prone creature moves by crawling unless it stands up.',
          notes: 'Knocked down by a collapsing gantry.'
        }
      ]
    }
  }
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

function createSheetCommandHandlers(baseSheet: CharacterSheetResponseDto) {
  return [
    http.get(`${API_BASE}/characters/:characterId/history`, () => HttpResponse.json(characterHistoryFixture)),
    http.post(`${API_BASE}/characters/:characterId/commands`, async ({ params, request }) => {
      const command = characterSheetCommandInputDtoSchema.parse(await request.json())
      const sheet = createSheetForCommand(command, getCommandBaseSheet(baseSheet, String(params.characterId)))
      const historyEntry = createHistoryEntry(command, sheet)

      return HttpResponse.json({
        characterId: sheet.meta.characterId,
        streamVersion: sheet.meta.streamVersion,
        sheet,
        historyEntry
      })
    })
  ]
}

function getCommandBaseSheet(
  baseSheet: CharacterSheetResponseDto,
  characterId: string
): CharacterSheetResponseDto {
  return characterId === STACKED_INVENTORY_CHARACTER_ID
    ? createStackedInventorySheet()
    : baseSheet
}

function createSheetForCommand(
  command: CharacterSheetCommandInputDto,
  baseSheet: CharacterSheetResponseDto
): CharacterSheetResponseDto {
  const sheet = structuredClone(baseSheet)
  const nextVersion = command.expectedVersion + 1
  sheet.meta.streamVersion = nextVersion

  switch (command.type) {
    case 'ADJUST_HIT_POINTS': {
      const nextHitPoints = command.mode === 'DAMAGE'
        ? sheet.overview.currentHitPoints - command.amount
        : sheet.overview.currentHitPoints + command.amount
      sheet.overview.currentHitPoints = Math.max(0, Math.min(nextHitPoints, sheet.overview.maxHitPoints))
      break
    }
    case 'SET_HIT_POINTS':
      if (command.current != null) sheet.overview.currentHitPoints = command.current
      if (command.temp != null) sheet.overview.tempHitPoints = command.temp
      sheet.overview.maxHitPointsOverride = command.maxOverride ?? null
      if (command.maxOverride != null) sheet.overview.maxHitPoints = command.maxOverride
      break
    case 'SET_EXHAUSTION':
      sheet.overview.exhaustionLevel = command.level
      sheet.overview.exhaustionNotes = command.notes || undefined
      break
    case 'ADD_CONDITION': {
      const conditionOption = sheet.reference.conditionOptions.find((option) => option.id === command.conditionTypeId)
      const existingCondition = sheet.overview.conditions.find((condition) => condition.conditionTypeId === command.conditionTypeId)
      if (existingCondition) {
        existingCondition.notes = command.notes || undefined
      } else if (conditionOption) {
        sheet.overview.conditions.push({
          conditionTypeId: conditionOption.id,
          label: conditionOption.label,
          description: conditionOption.description,
          notes: command.notes || undefined
        })
      }
      break
    }
    case 'REMOVE_CONDITION':
      sheet.overview.conditions = sheet.overview.conditions.filter(
        (condition) => condition.conditionTypeId !== command.conditionTypeId
      )
      break
    case 'USE_RESOURCE':
      sheet.resources.items = sheet.resources.items.map((resource) => resource.id === command.resourceGrantId
        ? {
            ...resource,
            used: Math.min(resource.used + 1, resource.max),
            remaining: Math.max(resource.remaining - 1, 0)
          }
        : resource)
      break
    case 'RESTORE_RESOURCE':
      sheet.resources.items = sheet.resources.items.map((resource) => {
        if (resource.id !== command.resourceGrantId) return resource
        const restored = command.all ? resource.used : 1
        return {
          ...resource,
          used: Math.max(resource.used - restored, 0),
          remaining: Math.min(resource.remaining + restored, resource.max)
        }
      })
      break
    case 'APPLY_REST':
      if (command.restKind === 'LONG') {
        sheet.resources.items = sheet.resources.items.map((resource) => ({
          ...resource,
          used: 0,
          remaining: resource.max
        }))
        sheet.spells.slots = sheet.spells.slots.map((slot) => ({
          ...slot,
          used: 0,
          remaining: slot.max
        }))
      }
      break
    case 'USE_HIT_DIE':
      sheet.resources.hitDice = sheet.resources.hitDice.map((hitDie) => hitDie.die === command.die
        ? {
            ...hitDie,
            used: Math.min(hitDie.used + 1, hitDie.total),
            remaining: Math.max(hitDie.remaining - 1, 0)
          }
        : hitDie)
      break
    case 'USE_SPELL_SLOT':
      sheet.spells.slots = sheet.spells.slots.map((slot) => slot.slotKey === command.slotKey
        ? {
            ...slot,
            used: Math.min(slot.used + 1, slot.max),
            remaining: Math.max(slot.remaining - 1, 0)
          }
        : slot)
      break
    case 'RESTORE_SPELL_SLOT':
      sheet.spells.slots = sheet.spells.slots.map((slot) => {
        if (slot.slotKey !== command.slotKey) return slot
        const restored = command.all ? slot.used : 1
        return {
          ...slot,
          used: Math.max(slot.used - restored, 0),
          remaining: Math.min(slot.remaining + restored, slot.max)
        }
      })
      break
    case 'SET_PREPARED_SPELLS':
      sheet.spells.preparationSources = (sheet.spells.preparationSources ?? []).map((source) => source.classId === command.classId
        ? { ...source, preparedSpellIds: command.spellIds }
        : source)
      sheet.spells.spells = sheet.spells.spells.map((spell) => {
        const prepared = command.spellIds.includes(spell.id)
        return {
          ...spell,
          prepared: spell.sources?.some((source) => source.classId === command.classId) ? prepared : spell.prepared,
          sources: spell.sources?.map((source) => source.classId === command.classId
            ? { ...source, prepared }
            : source)
        }
      })
      break
    case 'ADD_INVENTORY_ITEM': {
      const equipment = sheet.reference.equipmentOptions.find((option) => option.id === command.equipmentId)
      if (equipment) {
        sheet.inventory.items.push({
          id: `story-inventory-${sheet.inventory.items.length + 1}`,
          equipmentId: equipment.id,
          label: equipment.label,
          quantity: command.quantity,
          equipped: false,
          attuned: false
        })
      }
      break
    }
    case 'UPDATE_INVENTORY_ITEM':
      sheet.inventory.items = sheet.inventory.items.map((item) => item.id === command.itemId
        ? {
            ...item,
            quantity: command.quantity ?? item.quantity,
            customName: command.customName ?? item.customName,
            notes: command.notes ?? item.notes
          }
        : item)
      break
    case 'REMOVE_INVENTORY_ITEM':
      sheet.inventory.items = sheet.inventory.items.flatMap((item) => {
        if (item.id !== command.itemId) return [item]
        const quantityToRemove = command.quantity ?? item.quantity
        return quantityToRemove >= item.quantity
          ? []
          : [{ ...item, quantity: item.quantity - quantityToRemove }]
      })
      break
    case 'EQUIP_ITEM':
    case 'UNEQUIP_ITEM':
      sheet.inventory.items = sheet.inventory.items.map((item) => item.id === command.itemId
        ? { ...item, equipped: command.type === 'EQUIP_ITEM' }
        : item)
      break
    case 'ATTUNE_ITEM':
    case 'UNATTUNE_ITEM':
      sheet.inventory.items = sheet.inventory.items.map((item) => item.id === command.itemId
        ? { ...item, attuned: command.type === 'ATTUNE_ITEM' }
        : item)
      break
    case 'ADJUST_CURRENCY': {
      const currency = sheet.inventory.currencies.find((row) => row.currencyId === command.currencyId)
      if (currency) {
        currency.amount += command.amount
      } else {
        const currencyOption = sheet.reference.currencyOptions.find((option) => option.id === command.currencyId)
        sheet.inventory.currencies.push({
          currencyId: command.currencyId,
          label: currencyOption?.label ?? command.currencyId,
          amount: command.amount
        })
      }
      break
    }
    case 'UPDATE_NOTES':
      sheet.notes.notes = command.notes ?? undefined
      break
  }

  return sheet
}

function createHistoryEntry(
  command: CharacterSheetCommandInputDto,
  sheet: CharacterSheetResponseDto
): CharacterHistoryEntryDto {
  return {
    eventId: `story-command-${sheet.meta.streamVersion}`,
    occurredAt: new Date('2026-05-05T14:30:00.000Z').toISOString(),
    actorId: 'storybook-user',
    eventType: 'CHARACTER_SHEET_COMMAND_APPLIED',
    summary: `${formatCommandType(command.type)} applied`
  }
}

function createStackedInventorySheet(): CharacterSheetResponseDto {
  return {
    ...characterSheetFixture,
    meta: {
      ...characterSheetFixture.meta,
      characterId: STACKED_INVENTORY_CHARACTER_ID
    },
    inventory: {
      ...characterSheetFixture.inventory,
      items: characterSheetFixture.inventory.items.map((item) => item.id === 'inventory-staff'
        ? { ...item, quantity: 5 }
        : item)
    }
  }
}

function formatCommandType(commandType: CharacterSheetCommandInputDto['type']) {
  return commandType.toLowerCase().replaceAll('_', ' ')
}
