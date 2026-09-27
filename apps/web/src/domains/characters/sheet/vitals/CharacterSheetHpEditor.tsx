import { Button, NumberInput, Text } from '@mantine/core'
import { useRef, useState } from 'react'
import type { CharacterSheet, SubmitSheetCommand } from '../core/CharacterSheet.types'
import { formatSigned, toNumber } from '../core/characterSheet.utils'
import * as overviewStyles from '../overview/overview.css'
import { sheetFieldClassNames } from '../shared/characterSheetFieldStyles'
import * as rowStyles from '../shared/rows.css'

export function CharacterSheetHpEditor({
  pending,
  sheet,
  submitCommand,
  version
}: {
  pending: boolean
  sheet: CharacterSheet
  submitCommand: SubmitSheetCommand
  version: number
}) {
  const [hitPointDelta, setHitPointDelta] = useState(1)
  const [tempHitPoints, setTempHitPoints] = useState(sheet.overview.tempHitPoints)
  const [maxOverride, setMaxOverride] = useState<string | number>(
    sheet.overview.maxHitPointsOverride ?? ''
  )
  const [maxModifier, setMaxModifier] = useState<string | number>(
    sheet.overview.maxHitPointsModifier
  )
  const [settingsError, setSettingsError] = useState(false)
  const [modifierError, setModifierError] = useState(false)
  const lastSubmittedSettings = useRef({
    temp: sheet.overview.tempHitPoints,
    maxOverride: sheet.overview.maxHitPointsOverride
  })
  const lastSubmittedModifier = useRef(sheet.overview.maxHitPointsModifier)

  const normalizedMaxOverride = maxOverride === '' ? null : toNumber(maxOverride)
  const commitSettings = async () => {
    if (
      tempHitPoints === lastSubmittedSettings.current.temp &&
      normalizedMaxOverride === lastSubmittedSettings.current.maxOverride
    ) {
      return
    }

    setSettingsError(false)
    const succeeded = await submitCommand({
      type: 'SET_HIT_POINTS',
      temp: tempHitPoints,
      maxOverride: normalizedMaxOverride,
      expectedVersion: version
    })

    if (succeeded) {
      lastSubmittedSettings.current = {
        temp: tempHitPoints,
        maxOverride: normalizedMaxOverride
      }
      return
    }

    setTempHitPoints(sheet.overview.tempHitPoints)
    setMaxOverride(sheet.overview.maxHitPointsOverride ?? '')
    setSettingsError(true)
  }

  const commitMaxModifier = async () => {
    const normalizedModifier = toNumber(maxModifier)
    if (normalizedModifier === lastSubmittedModifier.current) return

    setModifierError(false)
    const adjustmentId = sheet.overview.maxHitPointsModifierAdjustmentId
    const succeeded =
      normalizedModifier === 0 && adjustmentId
        ? await submitCommand({
            type: 'REMOVE_SHEET_ADJUSTMENT',
            adjustmentId,
            target: { kind: 'HIT_POINTS' },
            family: 'HIT_POINTS',
            expectedVersion: version
          })
        : await submitCommand({
            type: 'UPSERT_SHEET_ADJUSTMENT',
            adjustment: {
              ...(adjustmentId ? { id: adjustmentId } : {}),
              family: 'HIT_POINTS',
              field: 'MAXIMUM_MODIFIER',
              value: normalizedModifier
            },
            expectedVersion: version
          })

    if (succeeded) {
      lastSubmittedModifier.current = normalizedModifier
      return
    }

    setModifierError(true)
  }

  return (
    <div className={overviewStyles.hpControlGrid}>
      {sheet.overview.maxHitPointsReductions.length ? (
        <ul aria-label='Maximum hit point reductions' className={overviewStyles.hpReductionList}>
          {sheet.overview.maxHitPointsReductions.map((reduction, index) => (
            <li className={overviewStyles.hpReductionRow} key={`${reduction.id}:${index}`}>
              <Text>
                {reduction.label}
                <span className={overviewStyles.hpReductionRecovery}>
                  {' · '}
                  {reduction.recoveryTags.includes('LONG_REST')
                    ? 'Until long rest'
                    : 'Until restored'}
                </span>
              </Text>
              <Text className={overviewStyles.hpReductionAmount}>
                {formatSigned(-reduction.amount)}
              </Text>
            </li>
          ))}
        </ul>
      ) : null}
      <div className={overviewStyles.hpDeltaRow}>
        <Button
          className={rowStyles.hpControlTarget}
          color='red'
          disabled={pending || hitPointDelta <= 0}
          onClick={() =>
            submitCommand({
              type: 'ADJUST_HIT_POINTS',
              amount: hitPointDelta,
              mode: 'DAMAGE',
              expectedVersion: version
            })
          }
        >
          Damage
        </Button>
        <NumberInput
          aria-label='Hit point amount'
          classNames={sheetFieldClassNames}
          disabled={pending}
          hideControls
          min={0}
          value={hitPointDelta}
          onChange={(value) => setHitPointDelta(toNumber(value))}
        />
        <Button
          className={rowStyles.hpControlTarget}
          disabled={pending || hitPointDelta <= 0}
          variant='default'
          onClick={() =>
            submitCommand({
              type: 'ADJUST_HIT_POINTS',
              amount: hitPointDelta,
              mode: 'HEAL',
              expectedVersion: version
            })
          }
        >
          Heal
        </Button>
      </div>
      <div className={overviewStyles.hpSettingsRow}>
        <NumberInput
          classNames={sheetFieldClassNames}
          disabled={pending}
          hideControls
          label='Temp HP'
          min={0}
          value={tempHitPoints}
          onBlur={commitSettings}
          onChange={(value) => setTempHitPoints(toNumber(value))}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
        <NumberInput
          classNames={sheetFieldClassNames}
          disabled={pending}
          hideControls
          label='Max HP adjustment'
          placeholder='0'
          value={maxModifier}
          onBlur={commitMaxModifier}
          onChange={setMaxModifier}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
        <NumberInput
          classNames={sheetFieldClassNames}
          disabled={pending}
          hideControls
          label='Max HP override'
          min={0}
          placeholder={String(sheet.overview.maxHitPoints)}
          value={maxOverride}
          onBlur={commitSettings}
          onChange={setMaxOverride}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
      </div>
      {settingsError ? (
        <Text className={rowStyles.commandInlineError} role='alert'>
          Hit point settings could not be updated. The sheet was refreshed; try again.
        </Text>
      ) : null}
      {modifierError ? (
        <Text className={rowStyles.commandInlineError} role='alert'>
          Maximum HP adjustment could not be updated. The Sheet was refreshed; try again.
        </Text>
      ) : null}
    </div>
  )
}
