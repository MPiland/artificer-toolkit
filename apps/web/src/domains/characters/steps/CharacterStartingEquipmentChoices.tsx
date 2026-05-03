import { Stack, Text } from '@mantine/core'
import { AppMultiSelect, AppSelect } from '#ui/primitives/Select'
import {
  type CharacterStartingEquipmentDecision,
  createStartingEquipmentDecision
} from '../characterBuilder.utils'
import * as styles from '../characterBuilder.css'
import type {
  CharacterBuilderChoiceOptionDto,
  CharacterBuilderStartingEquipmentViewDto
} from '@artificer-toolkit/schema/api/characters'
import type { StartingEquipmentDto } from '@artificer-toolkit/schema/shared'

type StartingEquipmentGroup = StartingEquipmentDto['sets'][number]['groups'][number]
type StartingEquipmentOption = StartingEquipmentGroup['options'][number]
type StartingEquipmentItem = StartingEquipmentOption['items'][number]
type ChosenStartingEquipmentItem = StartingEquipmentItem & {
  startingEquipmentKind: 'EQUIPMENT'
  selectionKind: 'CHOSEN'
  count: number
}

export function CharacterStartingEquipmentChoices({
  currencyOptions,
  decision,
  equipmentOptions,
  onChange,
  readOnly,
  view
}: {
  currencyOptions: CharacterBuilderChoiceOptionDto[]
  decision: unknown
  equipmentOptions: CharacterBuilderChoiceOptionDto[]
  onChange: (decision: CharacterStartingEquipmentDecision) => void
  readOnly: boolean
  view: CharacterBuilderStartingEquipmentViewDto
}) {
  const currentDecision = isStartingEquipmentDecision(decision)
    ? decision
    : createStartingEquipmentDecision(view.source)

  return (
    <Stack gap='md' className={styles.inlinePanel}>
      <div>
        <Text fw={700}>{`${view.sourceLabel} starting equipment`}</Text>
        <Text className={styles.mutedText} size='sm'>Choose the source-local equipment groups before finalizing.</Text>
      </div>
      {view.startingEquipment.sets.flatMap((set) => set.groups).map((group) => {
        const groupSelection = currentDecision.groups?.find((selection) => selection.groupId === group.id)
        const selectedOption = group.options.find((option) => option.id === groupSelection?.optionId)

        return (
          <Stack key={group.id} gap='sm'>
            <AppSelect
              label={`Group ${group.order}`}
              data={group.options.map((option) => ({
                value: option.id,
                label: formatStartingEquipmentOption(option, equipmentOptions, currencyOptions)
              }))}
              value={groupSelection?.optionId}
              required
              disabled={readOnly}
              onChange={(optionId) => {
                if (!optionId || readOnly) return
                onChange(setStartingEquipmentGroupOption(currentDecision, group.id, optionId))
              }}
            />
            {selectedOption?.items.map((item) => isChosenStartingEquipmentItem(item)
              ? (
                  <StartingEquipmentChosenItemField
                    key={item.id}
                    decision={currentDecision}
                    equipmentOptions={equipmentOptions}
                    group={group}
                    item={item}
                    readOnly={readOnly}
                    onChange={onChange}
                  />
                )
              : null)}
          </Stack>
        )
      })}
    </Stack>
  )
}

function StartingEquipmentChosenItemField({
  decision,
  equipmentOptions,
  group,
  item,
  onChange,
  readOnly
}: {
  decision: CharacterStartingEquipmentDecision
  equipmentOptions: CharacterBuilderChoiceOptionDto[]
  group: StartingEquipmentGroup
  item: ChosenStartingEquipmentItem
  onChange: (decision: CharacterStartingEquipmentDecision) => void
  readOnly: boolean
}) {
  const selectedEquipmentIds = getStartingEquipmentSelections(decision, group.id, item.id)
  const options = getStartingEquipmentItemOptions(item, equipmentOptions)
  const label = item.count === 1 ? 'Choose equipment' : `Choose ${item.count} equipment items`

  return item.count === 1
    ? (
        <AppSelect
          label={label}
          data={options}
          value={selectedEquipmentIds[0]}
          required
          disabled={readOnly}
          onChange={(equipmentId) => {
            if (!equipmentId || readOnly) return
            onChange(setStartingEquipmentSelections(decision, group.id, item.id, [equipmentId], 1))
          }}
        />
      )
    : (
        <AppMultiSelect
          label={label}
          data={options}
          value={selectedEquipmentIds}
          required
          disabled={readOnly}
          maxValues={item.count}
          onChange={(equipmentIds) => {
            if (readOnly) return
            onChange(setStartingEquipmentSelections(decision, group.id, item.id, equipmentIds, 1))
          }}
        />
      )
}

function setStartingEquipmentGroupOption(
  decision: CharacterStartingEquipmentDecision,
  groupId: string,
  optionId: string
): CharacterStartingEquipmentDecision {
  const groups = decision.groups ?? []
  const hasGroup = groups.some((group) => group.groupId === groupId)
  const nextGroup = {
    groupId,
    optionId,
    selections: []
  }

  return {
    ...decision,
    groups: hasGroup
      ? groups.map((group) => group.groupId === groupId ? nextGroup : group)
      : [...groups, nextGroup]
  }
}

function setStartingEquipmentSelections(
  decision: CharacterStartingEquipmentDecision,
  groupId: string,
  selectionKey: string,
  equipmentIds: string[],
  quantity: number
): CharacterStartingEquipmentDecision {
  const groups = decision.groups ?? []

  return {
    ...decision,
    groups: groups.map((group) => {
      if (group.groupId !== groupId) return group

      const selections = [
        ...(group.selections ?? []).filter((selection) => selection.selectionKey !== selectionKey),
        ...equipmentIds.map((equipmentId) => ({
          selectionKey,
          equipmentId,
          quantity
        }))
      ]

      return {
        ...group,
        selections
      }
    })
  }
}

function getStartingEquipmentSelections(
  decision: CharacterStartingEquipmentDecision,
  groupId: string,
  selectionKey: string
): string[] {
  return decision.groups
    ?.find((group) => group.groupId === groupId)
    ?.selections
    ?.filter((selection) => selection.selectionKey === selectionKey)
    .map((selection) => selection.equipmentId) ?? []
}

function getStartingEquipmentItemOptions(
  item: ChosenStartingEquipmentItem,
  equipmentOptions: CharacterBuilderChoiceOptionDto[]
) {
  const allowedIds = 'equipmentIds' in item ? new Set(item.equipmentIds) : null

  return equipmentOptions
    .filter((option) => !allowedIds || allowedIds.has(option.id))
    .map((option) => ({
      value: option.id,
      label: option.label,
      disabled: option.disabled
    }))
}

function formatStartingEquipmentOption(
  option: StartingEquipmentOption,
  equipmentOptions: CharacterBuilderChoiceOptionDto[],
  currencyOptions: CharacterBuilderChoiceOptionDto[]
): string {
  return option.items
    .map((item) => formatStartingEquipmentItem(item, equipmentOptions, currencyOptions))
    .join(' + ') || `Option ${option.order}`
}

function formatStartingEquipmentItem(
  item: StartingEquipmentItem,
  equipmentOptions: CharacterBuilderChoiceOptionDto[],
  currencyOptions: CharacterBuilderChoiceOptionDto[]
): string {
  if (item.startingEquipmentKind === 'CURRENCY') {
    return item.currencies
      .map((currency) => `${currency.amount} ${findOptionLabel(currencyOptions, currency.currencyId)}`)
      .join(', ')
  }

  const amount = item.selectionKind === 'CHOSEN' ? `choose ${item.count}` : `${item.quantity}`
  const target = 'equipmentIds' in item
    ? item.equipmentIds.map((equipmentId) => findOptionLabel(equipmentOptions, equipmentId)).join(' or ')
    : 'matching equipment'

  return `${amount} ${target}`
}

function findOptionLabel(options: CharacterBuilderChoiceOptionDto[], id: string): string {
  return options.find((option) => option.id === id)?.label ?? id
}

function isStartingEquipmentDecision(value: unknown): value is CharacterStartingEquipmentDecision {
  return Boolean(
    value
    && typeof value === 'object'
    && 'source' in value
    && 'tookGold' in value
  )
}

function isChosenStartingEquipmentItem(item: StartingEquipmentItem): item is ChosenStartingEquipmentItem {
  return item.startingEquipmentKind === 'EQUIPMENT'
    && 'selectionKind' in item
    && item.selectionKind === 'CHOSEN'
    && 'count' in item
}
