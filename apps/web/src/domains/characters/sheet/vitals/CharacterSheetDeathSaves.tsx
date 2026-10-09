import type { CharacterSheetCommonDto } from '@artificer-toolkit/schema/api/characterSheetSlices'
import { isCharacterDead } from '@artificer-toolkit/schema/shared/characterDeathSaves'
import { Button, Checkbox, Text } from '@mantine/core'
import type { SubmitSheetCommand } from '../core/CharacterSheet.types'
import * as rowStyles from '../shared/rows.css'
import { marksAfterToggle } from './deathSaveMarks'
import * as vitalsStyles from './vitals.css'

const MARK_INDEXES = [0, 1, 2] as const

/** Death saves (D96) at 0 hit points: marks Sheet editors set, and the roll while dying. */
export function CharacterSheetDeathSaves({
  pending,
  sheet,
  submitCommand
}: {
  pending: boolean
  sheet: Omit<CharacterSheetCommonDto, 'hasSpellcasting'>
  submitCommand: SubmitSheetCommand
}) {
  const { currentHitPoints, deathSaves } = sheet.overview
  if (currentHitPoints > 0) return null

  const expectedVersion = sheet.meta.streamVersion
  const editable = sheet.meta.capabilities.managePlayState
  const dead = isCharacterDead(deathSaves)
  const setMarks = (successes: number, failures: number) =>
    submitCommand({ type: 'SET_DEATH_SAVES', successes, failures, expectedVersion })

  return (
    <div aria-label='Death saves' className={vitalsStyles.deathSaves} role='group'>
      <div className={vitalsStyles.deathSaveMarks}>
        <Text className={vitalsStyles.deathSaveLabel}>Successes</Text>
        {MARK_INDEXES.map((index) => (
          <Checkbox
            aria-label={`Death save success ${index + 1}`}
            checked={index < deathSaves.successes}
            className={vitalsStyles.deathSaveSuccessMark}
            disabled={!editable || pending}
            key={index}
            readOnly={!editable}
            onChange={() =>
              setMarks(marksAfterToggle(deathSaves.successes, index), deathSaves.failures)
            }
          />
        ))}
      </div>
      <div className={vitalsStyles.deathSaveMarks}>
        <Text className={vitalsStyles.deathSaveLabel}>Failures</Text>
        {MARK_INDEXES.map((index) => (
          <Checkbox
            aria-label={`Death save failure ${index + 1}`}
            checked={index < deathSaves.failures}
            className={vitalsStyles.deathSaveFailureMark}
            disabled={!editable || pending}
            key={index}
            readOnly={!editable}
            onChange={() =>
              setMarks(deathSaves.successes, marksAfterToggle(deathSaves.failures, index))
            }
          />
        ))}
      </div>
      {dead ? (
        <Text className={rowStyles.commandInlineError} role='status'>
          Dead
        </Text>
      ) : deathSaves.stable ? (
        <Text className={vitalsStyles.deathSaveLabel} role='status'>
          Stable
        </Text>
      ) : editable ? (
        <Button
          className={rowStyles.compactActionControl}
          disabled={pending}
          size='xs'
          variant='default'
          onClick={() => submitCommand({ type: 'ROLL_DEATH_SAVE', expectedVersion })}
        >
          Roll death save
        </Button>
      ) : null}
    </div>
  )
}
