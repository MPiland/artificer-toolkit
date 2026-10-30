import {
  ActionIcon,
  Button,
  Collapse,
  NumberInput,
  Popover,
  SegmentedControl,
  Select,
  Text,
  Tooltip
} from '@mantine/core'
import { Dices, Plus, RotateCcw, Settings, Trash2 } from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'
import type { OfferedRollModeDto } from '@artificer-toolkit/schema/shared/systemCoreCode'
import { findOption } from '#app/forms/utils/valueGuards'
import { DiceSettingsControls } from '#app/settings/DiceSettingsControls'
import { useDicePresentationPreferences } from '#app/settings/dicePreferences'
import { CharacterSheetRollDestination } from './CharacterSheetRollDestination'
import type { ManualDieRow } from './dice.types'
import { toManualRollRequest } from './dice.utils'
import { useCharacterSheetRoll, useCharacterSheetRollDestination } from './rollContext'
import * as diceStyles from './dice.css'

const dieSides = [4, 6, 8, 10, 12, 20, 100] as const

const dieOptions = dieSides.map((die) => ({
  label: `d${die}`,
  value: String(die)
}))

const initialRows = (): ManualDieRow[] => [{ id: 'manual-die-1', count: 1, die: 20, modifier: 0 }]

export function CharacterSheetManualRoll({
  className,
  rollModes
}: {
  className?: string
  /** The roll modes the System offers a d20; the one that keeps a single face is the default. */
  rollModes: readonly OfferedRollModeDto[]
}) {
  const [opened, setOpened] = useState(false)
  const [settingsOpened, setSettingsOpened] = useState(false)
  const [rows, setRows] = useState<ManualDieRow[]>(initialRows)
  const defaultRollMode = rollModes.find(({ keep }) => keep === 'FIRST') ?? rollModes[0]
  const [rollMode, setRollMode] = useState(defaultRollMode?.code)
  const [preferences, setPreferences] = useDicePresentationPreferences()
  const rolls = useCharacterSheetRoll()
  const destinations = useCharacterSheetRollDestination()
  const totalDice = rows.reduce((sum, row) => sum + row.count, 0)
  const supportsD20Mode = rows.length === 1 && rows[0]?.count === 1 && rows[0].die === 20

  if (!supportsD20Mode && rollMode !== defaultRollMode?.code) setRollMode(defaultRollMode?.code)

  function reset() {
    setRows(initialRows())
    setRollMode(defaultRollMode?.code)
  }

  if (!rolls || !destinations) return null
  const { clearManualRoll, executeRoll, hasManualRoll, pending } = rolls
  const { destination, destinationOptions, setDestination } = destinations

  return (
    <Popover
      hideDetached={false}
      opened={opened}
      position='top-start'
      shadow='none'
      transitionProps={{ duration: 120 }}
      withinPortal
      onChange={setOpened}
    >
      <Popover.Target>
        <ActionIcon
          aria-label='Open manual dice roller'
          className={clsx(diceStyles.manualRollButton, className)}
          size='xl'
          variant='filled'
          onClick={() => setOpened((current) => !current)}
        >
          <Dices aria-hidden='true' size={22} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown className={diceStyles.manualPopover}>
        <div className={diceStyles.manualHeader}>
          <div>
            <Text fw={750}>Manual roll</Text>
            <Text c='dimmed' size='xs'>
              Build a roll, then leave the dice on the sheet until cleared.
            </Text>
          </div>
          <Tooltip label='Dice settings'>
            <ActionIcon
              aria-expanded={settingsOpened}
              aria-label='Toggle dice settings'
              size='lg'
              variant='subtle'
              onClick={() => setSettingsOpened((current) => !current)}
            >
              <Settings aria-hidden='true' size={18} />
            </ActionIcon>
          </Tooltip>
        </div>

        <Collapse expanded={settingsOpened}>
          <div className={diceStyles.manualSettings}>
            <DiceSettingsControls compact value={preferences} onChange={setPreferences} />
          </div>
        </Collapse>

        <CharacterSheetRollDestination
          options={destinationOptions}
          value={destination}
          onChange={setDestination}
        />

        <div className={diceStyles.manualRows}>
          {rows.map((row, index) => (
            <div className={diceStyles.manualRow} key={row.id}>
              <Select
                aria-label={`Die type for row ${index + 1}`}
                comboboxProps={{ withinPortal: false }}
                data={dieOptions}
                label={index === 0 ? 'Die' : undefined}
                value={String(row.die)}
                onChange={(value) =>
                  setRows((current) =>
                    current.map((candidate) =>
                      candidate.id === row.id
                        ? {
                            ...candidate,
                            die: findOption(dieSides, Number(value)) ?? candidate.die
                          }
                        : candidate
                    )
                  )
                }
              />
              <NumberInput
                aria-label={`Number of dice for row ${index + 1}`}
                clampBehavior='strict'
                label={index === 0 ? 'Count' : undefined}
                max={40}
                min={1}
                value={row.count}
                onChange={(value) =>
                  setRows((current) =>
                    current.map((candidate) =>
                      candidate.id === row.id
                        ? { ...candidate, count: typeof value === 'number' ? value : 1 }
                        : candidate
                    )
                  )
                }
              />
              <NumberInput
                aria-label={`Modifier for row ${index + 1}`}
                label={index === 0 ? 'Modifier' : undefined}
                value={row.modifier}
                onChange={(value) =>
                  setRows((current) =>
                    current.map((candidate) =>
                      candidate.id === row.id
                        ? {
                            ...candidate,
                            modifier: typeof value === 'number' ? Math.trunc(value) : 0
                          }
                        : candidate
                    )
                  )
                }
              />
              <ActionIcon
                aria-label={`Remove dice row ${index + 1}`}
                disabled={rows.length === 1}
                variant='subtle'
                onClick={() =>
                  setRows((current) => current.filter((candidate) => candidate.id !== row.id))
                }
              >
                <Trash2 aria-hidden='true' size={17} />
              </ActionIcon>
              {index === rows.length - 1 ? (
                <Tooltip label='Add die'>
                  <ActionIcon
                    aria-label='Add another die'
                    disabled={rows.length >= 10}
                    variant='subtle'
                    onClick={() =>
                      setRows((current) => [
                        ...current,
                        { id: crypto.randomUUID(), count: 1, die: 6, modifier: 0 }
                      ])
                    }
                  >
                    <Plus aria-hidden='true' size={17} />
                  </ActionIcon>
                </Tooltip>
              ) : (
                <span aria-hidden='true' />
              )}
            </div>
          ))}
        </div>

        {totalDice > 40 ? (
          <Text c='red' role='alert' size='xs'>
            A roll can contain at most 40 dice.
          </Text>
        ) : null}

        <div className={diceStyles.manualActions}>
          <SegmentedControl
            aria-label='Roll mode'
            className={diceStyles.manualMode}
            data={rollModes.map(({ code, label, keep }) => ({
              label,
              value: code,
              disabled: !supportsD20Mode && keep !== 'FIRST'
            }))}
            size='xs'
            value={rollMode}
            onChange={setRollMode}
          />
          <div className={diceStyles.manualActionButtons}>
            <Button
              leftSection={<RotateCcw aria-hidden='true' size={15} />}
              size='xs'
              variant='default'
              onClick={reset}
            >
              Reset
            </Button>
            <Button disabled={!hasManualRoll} size='xs' variant='default' onClick={clearManualRoll}>
              Clear dice
            </Button>
            <Button
              disabled={pending || totalDice > 40}
              loading={pending}
              size='xs'
              onClick={() =>
                void executeRoll(toManualRollRequest(rows, supportsD20Mode ? rollMode : undefined))
              }
            >
              Roll
            </Button>
          </div>
        </div>
      </Popover.Dropdown>
    </Popover>
  )
}
