import { useCallback, useEffect, useState } from 'react'
import { Button, NumberInput, Stack, Text } from '@mantine/core'
import type { RollResultDto } from '@artificer-toolkit/schema/api/rolls'
import { useExecuteDiceConfigurationMutation } from '#app/data/rolls'
import { AppSelect } from '#ui/primitives/Select'
import type { CharacterStartingEquipmentDecision } from '../../core/characterBuilder.types'
import { DiceRollPresentation } from '#app/components/dice/DiceRollPresentation'
import { useDismissRollOnClick } from '#app/components/dice/useDismissRollOnClick'
import { createStartingEquipmentDecision } from './startingEquipment'
import * as sharedStyles from '../../shared/builderShared.css'
import * as styles from './characterEquipment.css'
import {
  STARTING_EQUIPMENT_MODE,
  type ChosenStartingEquipmentItem,
  type StartingEquipmentGroup,
  type StartingGold,
  ensureDefaultStartingEquipmentGroupOptions,
  formatStartingEquipmentItems,
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
} from './startingEquipmentChoices'
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
  const selectedMode =
    view.startingGold && currentDecision.tookGold
      ? STARTING_EQUIPMENT_MODE.GOLD
      : STARTING_EQUIPMENT_MODE.EQUIPMENT
  const equipmentDecision =
    selectedMode === STARTING_EQUIPMENT_MODE.EQUIPMENT
      ? ensureDefaultStartingEquipmentGroupOptions(currentDecision, view.startingEquipment)
      : currentDecision
  const equipmentGroups = view.startingEquipment.sets.flatMap((set) => set.groups)

  useEffect(() => {
    if (
      readOnly ||
      selectedMode !== STARTING_EQUIPMENT_MODE.EQUIPMENT ||
      equipmentDecision === currentDecision
    ) {
      return
    }

    onChange(equipmentDecision)
  }, [currentDecision, equipmentDecision, onChange, readOnly, selectedMode])

  return (
    <Stack gap='sm' className={`${sharedStyles.inlinePanel} ${styles.startingEquipmentPanel}`}>
      <div className={styles.startingEquipmentHeader}>
        <Text fw={700}>{view.sourceLabel}</Text>
        {view.startingGold ? (
          <div className={styles.startingEquipmentMode}>
            <AppSelect
              label='Starting option'
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
                const nextMode =
                  mode === STARTING_EQUIPMENT_MODE.GOLD
                    ? STARTING_EQUIPMENT_MODE.GOLD
                    : STARTING_EQUIPMENT_MODE.EQUIPMENT
                onChange(
                  setStartingEquipmentMode(
                    currentDecision,
                    view.source,
                    nextMode,
                    view.startingGold
                  )
                )
              }}
            />
          </div>
        ) : null}
      </div>
      {selectedMode === STARTING_EQUIPMENT_MODE.GOLD && view.startingGold ? (
        <StartingEquipmentGoldField
          currencyOptions={currencyOptions}
          decision={currentDecision}
          readOnly={readOnly}
          source={view.source}
          startingGold={view.startingGold}
          onChange={onChange}
        />
      ) : (
        <div className={styles.startingEquipmentGroups}>
          {equipmentGroups.map((group, index) => {
            const groupSelection = equipmentDecision.groups?.find(
              (selection) => selection.groupId === group.id
            )
            const selectedOption =
              group.options.length === 1
                ? group.options[0]
                : group.options.find((option) => option.id === groupSelection?.optionId)
            const includedItems =
              selectedOption?.items.filter((item) => !isChosenStartingEquipmentItem(item)) ?? []
            const chosenItems = selectedOption?.items.filter(isChosenStartingEquipmentItem) ?? []

            return (
              <section
                key={group.id}
                className={styles.startingEquipmentGroup}
                aria-label={
                  equipmentGroups.length > 1 ? `Group ${index + 1}` : 'Starting equipment group'
                }
              >
                {equipmentGroups.length > 1 ? (
                  <div className={styles.startingEquipmentGroupHeader}>
                    <Text fw={700}>{`Group ${index + 1}`}</Text>
                  </div>
                ) : null}
                <div className={styles.startingEquipmentControlRow}>
                  {group.options.length > 1 ? (
                    <AppSelect
                      label='Choose one'
                      data={group.options.map((option) => ({
                        value: option.id,
                        label: formatStartingEquipmentOption(
                          option,
                          equipmentOptions,
                          currencyOptions
                        )
                      }))}
                      value={groupSelection?.optionId}
                      required
                      disabled={readOnly}
                      onChange={(optionId) => {
                        if (!optionId || readOnly) return
                        onChange(
                          setStartingEquipmentGroupOption(equipmentDecision, group.id, optionId)
                        )
                      }}
                    />
                  ) : null}
                  {chosenItems.length ? (
                    <div className={styles.startingEquipmentChoiceList}>
                      {chosenItems.map((item) => (
                        <StartingEquipmentChosenItemField
                          key={item.id}
                          decision={equipmentDecision}
                          equipmentOptions={equipmentOptions}
                          group={group}
                          item={item}
                          label={view.choiceLabels[item.id]}
                          readOnly={readOnly}
                          onChange={onChange}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
                {includedItems.length ? (
                  <div className={styles.startingEquipmentIncludedList}>
                    <Text>
                      {formatStartingEquipmentItems(
                        includedItems,
                        equipmentOptions,
                        currencyOptions
                      )}
                    </Text>
                  </div>
                ) : null}
              </section>
            )
          })}
        </div>
      )}
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
  const executeConfiguration = useExecuteDiceConfigurationMutation()
  const [presentedRoll, setPresentedRoll] = useState<RollResultDto>()
  const [rolling, setRolling] = useState(false)
  const totalGold = decision.gold?.totalGold ?? 0
  const [goldInput, setGoldInput] = useState<string | number>(totalGold)
  const [seenTotalGold, setSeenTotalGold] = useState(totalGold)

  if (seenTotalGold !== totalGold) {
    setSeenTotalGold(totalGold)
    setGoldInput(totalGold)
  }

  const dismissRoll = useCallback(() => setPresentedRoll(undefined), [])
  useDismissRollOnClick(presentedRoll !== undefined && !rolling, dismissRoll)

  return (
    <Stack gap='xs'>
      <Text className={sharedStyles.mutedText} size='sm'>
        {`Roll ${formatStartingGoldOption(startingGold, currencyOptions)}. The total is filled automatically and can be overridden.`}
      </Text>
      <div className={styles.startingGoldControls}>
        <Button
          type='button'
          loading={rolling}
          disabled={readOnly}
          onClick={() => {
            setPresentedRoll(undefined)
            setRolling(true)
            executeConfiguration.reset()
            void executeConfiguration
              .mutateAsync({ configuration: startingGold.dieConfig })
              .then(setPresentedRoll)
              .catch(() => setRolling(false))
          }}
        >
          Roll {startingGold.dieConfig}
        </Button>
        <NumberInput
          hideControls
          label='Starting gold total'
          min={1}
          required
          disabled={readOnly || rolling}
          error={
            executeConfiguration.error
              ? 'Unable to roll. Enter a total manually or try again.'
              : undefined
          }
          value={goldInput}
          onChange={(value) => {
            if (readOnly || rolling) return
            setGoldInput(value)
            if (typeof value !== 'number') return
            executeConfiguration.reset()
            onChange(setStartingEquipmentGoldTotal(decision, source, startingGold, value))
          }}
        />
      </div>
      <DiceRollPresentation
        pending={executeConfiguration.isPending}
        roll={presentedRoll}
        onRollRevealed={(rollId) => {
          if (!presentedRoll || presentedRoll.id !== rollId) return
          onChange(
            setStartingEquipmentGoldTotal(
              decision,
              source,
              startingGold,
              presentedRoll.evidence.total * startingGold.multiplier
            )
          )
          setRolling(false)
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
  label,
  onChange,
  readOnly
}: {
  decision: CharacterStartingEquipmentDecision
  equipmentOptions: CharacterBuilderChoiceOptionDto[]
  group: StartingEquipmentGroup
  item: ChosenStartingEquipmentItem
  label: string
  onChange: (decision: CharacterStartingEquipmentDecision) => void
  readOnly: boolean
}) {
  const selectedEquipmentIds = getStartingEquipmentSelections(decision, group.id, item.id)
  const options = getStartingEquipmentItemOptions(item, equipmentOptions)
  return item.count === 1 ? (
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
  ) : (
    <Stack gap='xs'>
      {Array.from({ length: item.count }, (_, index) => (
        <AppSelect
          key={`${item.id}:${index}`}
          label={`${label}: ${index + 1} of ${item.count}`}
          data={options}
          value={selectedEquipmentIds[index]}
          required
          disabled={readOnly}
          onChange={(equipmentId) => {
            if (!equipmentId || readOnly) return
            const nextEquipmentIds = Array.from(
              { length: item.count },
              (__, equipmentIndex) => selectedEquipmentIds[equipmentIndex] ?? ''
            )
            nextEquipmentIds[index] = equipmentId
            onChange(setStartingEquipmentSelections(decision, group.id, item.id, nextEquipmentIds))
          }}
        />
      ))}
    </Stack>
  )
}
