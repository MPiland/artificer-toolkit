import type { ResolvedSpellSlotExchange } from '@artificer-toolkit/schema/api/characterActionRules'
import type { CharacterSheetActionsDto } from '@artificer-toolkit/schema/api/characterSheetSlices'
import { useState } from 'react'
import { Button, NumberInput, Text } from '@mantine/core'
import type { SubmitSheetCommand } from '../core/CharacterSheet.types'
import * as actionSummaryStyles from './actionSummary.css'
import * as rowStyles from '../shared/rows.css'

/** Chooses the slots or slot level an action's spell slot exchange works on, then sends it. */
export function CharacterSheetSpellSlotExchange({
  actionId,
  actionLabel,
  available,
  exchange,
  pending,
  sheet,
  submitCommand
}: {
  actionId: string
  actionLabel: string
  available: boolean
  exchange: ResolvedSpellSlotExchange
  pending: boolean
  sheet: Pick<CharacterSheetActionsDto, 'meta' | 'resources' | 'spells'>
  submitCommand: SubmitSheetCommand
}) {
  const [recoverCounts, setRecoverCounts] = useState<Record<string, number>>({})
  const [failed, setFailed] = useState(false)
  const disabled = pending || !available
  const exchangeSlots = async (
    selection: { kind: 'SLOTS'; slotKeys: string[] } | { kind: 'SLOT_LEVEL'; slotLevel: number }
  ) => {
    setFailed(false)
    const succeeded = await submitCommand({
      type: 'EXCHANGE_SPELL_SLOTS',
      actionId,
      selection,
      expectedVersion: sheet.meta.streamVersion
    })
    if (succeeded) setRecoverCounts({})
    else setFailed(true)
  }
  const pool =
    exchange.mode === 'RECOVER_SLOTS'
      ? undefined
      : sheet.resources.items.find((resource) => resource.id === exchange.resourcePoolId)
  const leveledSlots = sheet.spells.slots.flatMap((slot) =>
    slot.level === null ? [] : [{ ...slot, level: slot.level }]
  )

  const controls = (() => {
    switch (exchange.mode) {
      case 'RECOVER_SLOTS': {
        const recoverable = leveledSlots.filter(
          (slot) => slot.level <= exchange.maximumSlotLevel && slot.used > 0
        )
        const chosenLevels = recoverable.reduce(
          (total, slot) => total + slot.level * (recoverCounts[slot.slotKey] ?? 0),
          0
        )
        if (!recoverable.length) return <Text size='xs'>No expended slots can be recovered.</Text>
        return (
          <>
            {recoverable.map((slot) => (
              <NumberInput
                aria-label={`${slot.label} slots to recover`}
                className={actionSummaryStyles.actionSpellSlotCount}
                clampBehavior='strict'
                disabled={disabled}
                key={slot.slotKey}
                label={slot.label}
                max={slot.used}
                min={0}
                size='xs'
                value={recoverCounts[slot.slotKey] ?? 0}
                onChange={(value) =>
                  setRecoverCounts((counts) => ({ ...counts, [slot.slotKey]: Number(value) || 0 }))
                }
              />
            ))}
            <Text size='xs'>
              {chosenLevels} of {exchange.levelBudget} slot levels
            </Text>
            <Button
              disabled={disabled || chosenLevels === 0 || chosenLevels > exchange.levelBudget}
              size='xs'
              variant='default'
              onClick={() =>
                void exchangeSlots({
                  kind: 'SLOTS',
                  slotKeys: recoverable.flatMap((slot) =>
                    Array.from({ length: recoverCounts[slot.slotKey] ?? 0 }, () => slot.slotKey)
                  )
                })
              }
            >
              Recover slots
            </Button>
          </>
        )
      }
      case 'SLOT_TO_RESOURCE':
        return leveledSlots
          .filter(
            (slot) =>
              slot.remaining > 0 &&
              (exchange.maximumSlotLevel === null || slot.level <= exchange.maximumSlotLevel)
          )
          .map((slot) => (
            <Button
              disabled={disabled || !pool || pool.remaining >= pool.max}
              key={slot.slotKey}
              size='xs'
              variant='default'
              onClick={() => void exchangeSlots({ kind: 'SLOTS', slotKeys: [slot.slotKey] })}
            >
              {`Convert ${slot.label} slot to ${slot.level} ${pool?.label ?? 'charges'}`}
            </Button>
          ))
      case 'RESOURCE_TO_SLOT':
        return exchange.costs.map(({ slotLevel, cost }) => (
          <Button
            disabled={disabled || !pool || pool.remaining < cost}
            key={slotLevel}
            size='xs'
            variant='default'
            onClick={() => void exchangeSlots({ kind: 'SLOT_LEVEL', slotLevel })}
          >
            {`Create level ${slotLevel} slot for ${cost} ${pool?.label ?? 'charges'}`}
          </Button>
        ))
    }
  })()

  return (
    <>
      <div
        aria-label={`${actionLabel} spell slots`}
        className={actionSummaryStyles.actionSpellSlotExchange}
        role='group'
      >
        {controls}
      </div>
      {failed ? (
        <Text className={rowStyles.commandInlineError} role='alert'>
          Spell slots could not be exchanged. The sheet was refreshed; try again.
        </Text>
      ) : null}
    </>
  )
}
