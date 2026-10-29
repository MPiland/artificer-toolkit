import { Button, Group, NumberInput, SegmentedControl, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import {
  type EncounterCommandResultDto,
  type EncounterD20RollModeDto,
  type EncounterEvidenceRollDto,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import { rollModeKeepFaceCount } from '@artificer-toolkit/schema/shared/systemCoreCode'
import { DiceRollPresentation } from '#app/components/dice/DiceRollPresentation'
import { addedDieEntries, keptFaceIndex } from './CampaignTabletopDecisionDrawer.model'
import * as styles from './CampaignTabletopEvidenceRollRow.css'

/**
 * One required roll: typed value(s) plus "Roll dice", which asks the server for a recorded,
 * non-settling roll. Submit settles by the latest app roll while the row still shows it, otherwise
 * with the entered values.
 */
export function CampaignTabletopEvidenceRollRow({
  disabled,
  latestRoll,
  pending,
  onRoll,
  onSubmit
}: {
  disabled: boolean
  /** The viewer's latest app roll for their pending request, restored after a reload. */
  latestRoll: EncounterEvidenceRollDto | null
  pending: Extract<
    PendingEncounterRuleOccurrenceSummaryDto,
    {
      kind: 'ACTION_OUTCOME_EVIDENCE' | 'D20_EVIDENCE' | 'INITIATIVE_EVIDENCE' | 'RECHARGE_EVIDENCE'
    }
  >
  onRoll: (rollMode: EncounterD20RollModeDto | null) => Promise<EncounterCommandResultDto | null>
  onSubmit: (resolution: ResolveRuleOccurrenceInputDto['resolution']) => void
}) {
  const { request } = pending
  const derivedMode = pending.kind === 'D20_EVIDENCE' ? pending.request.rollMode : null
  // The modes the System offers for this roll, each with its label and the face it keeps.
  const offeredModes = pending.kind === 'D20_EVIDENCE' ? pending.request.rollModes : []
  // The d20 already entered while the server waits for one more; the request then rolls Normal.
  const heldD20 = pending.kind === 'D20_EVIDENCE' ? pending.request.heldD20 : undefined
  // Why the rules recommend the mode, e.g. "Flanking"; empty for a normal roll.
  const derivedReasons =
    pending.kind === 'D20_EVIDENCE' ? pending.request.derivedRollModeReasons : []
  // The conditions that make this save fail automatically; the d20 is still rolled.
  const autoFail = pending.kind === 'D20_EVIDENCE' ? (pending.request.autoFail ?? []) : []
  // The dice the test adds to or subtracts from its d20 (D156), entered or app-rolled with it.
  const addedEntries =
    pending.kind === 'D20_EVIDENCE' ? addedDieEntries(pending.request.addedDice ?? []) : []
  const [rolled, setRolled] = useState<{
    evidence: EncounterEvidenceRollDto
    roll: RollRecordDto | null
  } | null>(null)
  const [rolling, setRolling] = useState(false)
  const [selectedMode, setSelectedMode] = useState<EncounterD20RollModeDto | null>(null)
  const [entered, setEntered] = useState<(number | string)[] | null>(null)
  const [enteredAdded, setEnteredAdded] = useState<(number | string)[] | null>(null)
  const restored =
    latestRoll?.occurrenceId === pending.occurrenceId &&
    latestRoll.occurrenceVersion === pending.occurrenceVersion &&
    latestRoll.requestId === request.requestId
      ? latestRoll
      : null
  const latest =
    rolled && (!restored || rolled.evidence.attempt >= restored.attempt)
      ? rolled.evidence
      : restored
  const rollMode = derivedMode === null ? null : (selectedMode ?? latest?.rollMode ?? derivedMode)
  const derivedLabel = offeredModes.find((mode) => mode.code === derivedMode)?.label ?? derivedMode
  const offered = offeredModes.find((mode) => mode.code === rollMode)
  const keep = offered?.keep ?? 'FIRST'
  const faceCount = rollModeKeepFaceCount(keep)
  const shown = entered ?? (latest ? (rollMode === null ? [latest.value] : latest.faces) : [])
  const values = Array.from({ length: faceCount }, (_, index) => shown[index] ?? '')
  const faces = values.filter((value): value is number => typeof value === 'number')
  const shownAdded = enteredAdded ?? latest?.addedFaces ?? []
  const addedValues = addedEntries.map((_, index) => shownAdded[index] ?? '')
  const addedFaces = addedValues.filter((value): value is number => typeof value === 'number')
  const appRoll =
    entered === null && enteredAdded === null && latest?.rollMode === rollMode ? latest : null
  const complete = faces.length === faceCount && addedFaces.length === addedEntries.length
  const keptIndex = rollMode === null || faceCount === 1 ? null : keptFaceIndex(keep, values)

  async function roll(): Promise<void> {
    setRolling(true)
    try {
      const result = await onRoll(rollMode)
      if (!result?.evidenceRoll) return
      setRolled({ evidence: result.evidenceRoll, roll: result.roll })
      setSelectedMode(null)
      setEntered(null)
      setEnteredAdded(null)
    } finally {
      setRolling(false)
    }
  }

  function submit(): void {
    if (appRoll) {
      onSubmit({ kind: 'SYSTEM_ROLL', requestId: request.requestId, rollId: appRoll.rollId })
    } else if (complete) {
      onSubmit(
        rollMode === null
          ? { kind: 'ENTER_INTEGER', requestId: request.requestId, value: faces[0]! }
          : {
              kind: 'ENTER_DICE',
              requestId: request.requestId,
              rawFaces: faces,
              rollMode,
              ...(addedFaces.length > 0 ? { addedFaces } : {})
            }
      )
    }
  }

  return (
    <Stack gap='sm'>
      {heldD20 ? (
        <div>
          <Text fw={600} size='sm'>
            Die 1: {heldD20.faces[0]}
          </Text>
          {heldD20.caption ? (
            <Text c='dimmed' size='xs'>
              {heldD20.caption}
            </Text>
          ) : null}
        </div>
      ) : null}
      {derivedMode && rollMode && !heldD20 ? (
        <div>
          <SegmentedControl
            aria-label='Roll mode'
            data={offeredModes.map(({ code, label }) => ({
              value: code,
              label:
                code === derivedMode ? (
                  <Text c='orange' fw={700} inherit span>
                    {label}
                  </Text>
                ) : (
                  label
                )
            }))}
            disabled={disabled}
            fullWidth
            size='xs'
            value={rollMode}
            onChange={setSelectedMode}
          />
          <Text c='dimmed' mt={4} size='xs'>
            {rollMode === derivedMode
              ? `Recommended: ${derivedLabel}${derivedReasons.length ? `: ${derivedReasons.join(', ')}` : ''}`
              : `Changed from ${derivedLabel}, the recommended mode`}
          </Text>
        </div>
      ) : null}
      {autoFail.length ? (
        <Text size='xs'>
          Fails automatically: {autoFail.map((reason) => reason.label).join(', ')}
        </Text>
      ) : null}
      <Group align='end' gap='xs' wrap='nowrap'>
        {values.map((value, index) => (
          <NumberInput
            description={keptIndex === index ? 'Kept' : undefined}
            disabled={disabled}
            flex={1}
            key={index}
            label={heldD20 ? 'One more d20' : rollMode === null ? 'Result' : `Die ${index + 1}`}
            max={request.max}
            min={request.min}
            value={value}
            onChange={(next) =>
              setEntered(values.map((current, position) => (position === index ? next : current)))
            }
          />
        ))}
        <Button disabled={disabled} loading={rolling} variant='default' onClick={() => void roll()}>
          Roll dice
        </Button>
      </Group>
      {addedEntries.length > 0 ? (
        <Group gap='xs' wrap='wrap'>
          {addedValues.map((value, index) => (
            <NumberInput
              disabled={disabled}
              key={index}
              label={addedEntries[index]!.label}
              max={addedEntries[index]!.faces}
              min={1}
              value={value}
              w={120}
              onChange={(next) =>
                setEnteredAdded(
                  addedValues.map((current, position) => (position === index ? next : current))
                )
              }
            />
          ))}
        </Group>
      ) : null}
      {latest ? (
        <Text aria-live='polite' c='dimmed' size='xs'>
          {appRoll
            ? `Rolled by the app · attempt ${appRoll.attempt}`
            : 'Your entered values replace the app roll.'}
        </Text>
      ) : null}
      {rolling || rolled?.roll ? (
        <div className={styles.diceStage}>
          <DiceRollPresentation
            pending={rolling}
            roll={rolled?.roll ?? undefined}
            onRollRevealed={() => undefined}
          />
        </div>
      ) : null}
      <Group>
        <Button disabled={disabled || (!appRoll && !complete)} onClick={submit}>
          Submit roll
        </Button>
      </Group>
    </Stack>
  )
}
