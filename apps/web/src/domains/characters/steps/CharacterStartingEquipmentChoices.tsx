import { Stack, Text } from '@mantine/core'
import { AppSelect } from '#ui/primitives/Select'
import {
  type CharacterStartingEquipmentDecision,
  createStartingEquipmentDecision
} from '../characterBuilder.utils'
import * as styles from '../characterBuilder.css'
import {
  type ChosenStartingEquipmentItem,
  type StartingEquipmentGroup,
  formatStartingEquipmentOption,
  getStartingEquipmentItemOptions,
  getStartingEquipmentSelections,
  isChosenStartingEquipmentItem,
  isStartingEquipmentDecision,
  setStartingEquipmentGroupOption,
  setStartingEquipmentSelections
} from './CharacterStartingEquipmentChoices.utils'
import type {
  CharacterBuilderChoiceOptionDto,
  CharacterBuilderStartingEquipmentViewDto
} from '@artificer-toolkit/schema/api/characters'

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
            onChange(setStartingEquipmentSelections(decision, group.id, item.id, [equipmentId]))
          }}
        />
      )
    : (
        <Stack gap='xs'>
          {Array.from({ length: item.count }, (_, index) => (
            <AppSelect
              key={`${item.id}:${index}`}
              label={`${label} ${index + 1} of ${item.count}`}
              data={options}
              value={selectedEquipmentIds[index]}
              required
              disabled={readOnly}
              onChange={(equipmentId) => {
                if (!equipmentId || readOnly) return
                const nextEquipmentIds = Array.from({ length: item.count }, (__, equipmentIndex) => selectedEquipmentIds[equipmentIndex] ?? '')
                nextEquipmentIds[index] = equipmentId
                onChange(setStartingEquipmentSelections(decision, group.id, item.id, nextEquipmentIds))
              }}
            />
          ))}
        </Stack>
      )
}
