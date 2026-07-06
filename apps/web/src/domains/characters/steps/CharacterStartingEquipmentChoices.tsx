import { NumberInput, Stack, Text } from '@mantine/core'
import { AppSelect } from '#ui/primitives/Select'
import {
  type CharacterStartingEquipmentDecision,
  createStartingEquipmentDecision
} from '../characterBuilder.utils'
import * as styles from '../characterBuilder.css'
import {
  STARTING_EQUIPMENT_MODE,
  type ChosenStartingEquipmentItem,
  type StartingEquipmentGroup,
  type StartingGold,
  formatStartingGoldOption,
  formatStartingEquipmentOption,
  getStartingEquipmentItemOptions,
  getStartingEquipmentSelections,
  isChosenStartingEquipmentItem,
  isStartingEquipmentDecision,
  setStartingEquipmentGoldTotal,
  setStartingEquipmentGroupOption,
  setStartingEquipmentMode,
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
  const selectedMode = view.startingGold && currentDecision.tookGold
    ? STARTING_EQUIPMENT_MODE.GOLD
    : STARTING_EQUIPMENT_MODE.EQUIPMENT

  return (
    <Stack gap='md' className={styles.inlinePanel}>
      <div>
        <Text fw={700}>{`${view.sourceLabel} starting equipment`}</Text>
        <Text className={styles.mutedText} size='sm'>Choose the source-local equipment groups before finalizing.</Text>
      </div>
      {view.startingGold
        ? (
            <AppSelect
              label={`${view.sourceLabel} starting option`}
              data={[
                { value: STARTING_EQUIPMENT_MODE.EQUIPMENT, label: 'Take starting equipment' },
                {
                  value: STARTING_EQUIPMENT_MODE.GOLD,
                  label: `Take starting gold (${formatStartingGoldOption(view.startingGold, currencyOptions)})`
                }
              ]}
              value={selectedMode}
              disabled={readOnly}
              onChange={(mode) => {
                if (!mode || readOnly) return
                const nextMode = mode === STARTING_EQUIPMENT_MODE.GOLD ? STARTING_EQUIPMENT_MODE.GOLD : STARTING_EQUIPMENT_MODE.EQUIPMENT
                onChange(setStartingEquipmentMode(currentDecision, view.source, nextMode, view.startingGold))
              }}
            />
          )
        : null}
      {selectedMode === STARTING_EQUIPMENT_MODE.GOLD && view.startingGold
        ? (
            <StartingEquipmentGoldField
              currencyOptions={currencyOptions}
              decision={currentDecision}
              readOnly={readOnly}
              source={view.source}
              startingGold={view.startingGold}
              onChange={onChange}
            />
          )
        : view.startingEquipment.sets.flatMap((set) => set.groups).map((group, index) => {
            const groupSelection = currentDecision.groups?.find((selection) => selection.groupId === group.id)
            const selectedOption = group.options.find((option) => option.id === groupSelection?.optionId)

            return (
              <Stack key={group.id} gap='sm'>
                <AppSelect
                  label={`Group ${index + 1}`}
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

function StartingEquipmentGoldField({
  currencyOptions,
  decision,
  onChange,
  readOnly,
  source,
  startingGold
}: {
  currencyOptions: CharacterBuilderChoiceOptionDto[]
  decision: CharacterStartingEquipmentDecision
  onChange: (decision: CharacterStartingEquipmentDecision) => void
  readOnly: boolean
  source: CharacterBuilderStartingEquipmentViewDto['source']
  startingGold: StartingGold
}) {
  return (
    <Stack gap='xs'>
      <Text className={styles.mutedText} size='sm'>
        {`Roll ${formatStartingGoldOption(startingGold, currencyOptions)}, then enter the total starting gold.`}
      </Text>
      <NumberInput
        hideControls
        label='Starting gold total'
        min={1}
        required
        disabled={readOnly}
        value={decision.gold?.totalGold ?? 0}
        onChange={(value) => {
          if (readOnly) return
          onChange(setStartingEquipmentGoldTotal(decision, source, startingGold, typeof value === 'number' ? value : 0))
        }}
      />
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
