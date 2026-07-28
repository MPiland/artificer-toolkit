import { Button, Collapse, Select, Text, TextInput } from '@mantine/core'
import { CirclePlus } from 'lucide-react'
import { useRef, useState } from 'react'
import IInspiration from '#assets/icons/IInspiration'
import { AuthoredDetailProse } from '#app/components/AuthoredDetail'
import * as styles from './characterSheet.css'
import type { CharacterSheetSectionProps } from './CharacterSheet.types'

export function CharacterSheetOverviewStatusStrip({
  conditionsOnly = false,
  pending,
  sheet,
  submitCommand
}: CharacterSheetSectionProps & { conditionsOnly?: boolean }) {
  const version = sheet.meta.streamVersion
  const [conditionsOpen, setConditionsOpen] = useState(false)
  const [conditionTypeId, setConditionTypeId] = useState<string | null>(null)
  const [conditionNotes, setConditionNotes] = useState('')
  const [exhaustionNotes, setExhaustionNotes] = useState(sheet.overview.exhaustion.notes ?? '')
  const [statusError, setStatusError] = useState<string | null>(null)
  const savedExhaustionNotes = useRef(sheet.overview.exhaustion.notes ?? '')
  const conditionSubmitRef = useRef<HTMLButtonElement>(null)
  const activeCondition = sheet.overview.conditions.find(
    (condition) => condition.conditionTypeId === conditionTypeId
  )
  const selectedCondition = sheet.reference.conditionOptions.find(
    (option) => option.id === conditionTypeId
  )
  const conditions = sheet.overview.conditions.length
    ? sheet.overview.conditions.map((condition) => condition.label).join(', ')
    : 'Add Condition'

  async function submitCondition() {
    if (!conditionTypeId) return

    setStatusError(null)
    const succeeded = await submitCommand({
      type: 'ADD_CONDITION',
      conditionTypeId,
      notes: conditionNotes.trim() || undefined,
      expectedVersion: version
    })

    if (!succeeded) {
      setStatusError('Condition could not be saved. Review the current Sheet and try again.')
      return
    }

    setConditionTypeId(null)
    setConditionNotes('')
  }

  async function submitExhaustion(level: number, notes = exhaustionNotes) {
    setStatusError(null)
    const succeeded = await submitCommand({
      type: 'SET_EXHAUSTION',
      level,
      notes: notes.trim() || undefined,
      expectedVersion: version
    })

    if (succeeded) {
      savedExhaustionNotes.current = notes
      return
    }

    setStatusError('Exhaustion could not be updated. Your notes were kept; try again.')
  }

  async function removeCondition(conditionTypeId: string) {
    setStatusError(null)
    const succeeded = await submitCommand({
      type: 'REMOVE_CONDITION',
      conditionTypeId,
      expectedVersion: version
    })

    if (!succeeded) {
      setStatusError('Condition could not be removed. The Sheet was refreshed; try again.')
    }
  }

  return (
    <section
      className={styles.statusStripPanel}
      aria-label={conditionsOnly ? 'Conditions and exhaustion' : 'Status summary'}
    >
      <div className={`${styles.statusStrip} ${conditionsOnly ? styles.conditionsOnlyStrip : ''}`}>
        <div className={styles.statusStripItem}>
          <Text className={styles.statusStripLabel}>{sheet.overview.exhaustion.label}</Text>
          <div className={`${styles.statusStripContent} ${styles.statusStripContentStart}`}>
            <div className={styles.statusStripStack}>
              <Text className={styles.statusStripValue}>
                Level {sheet.overview.exhaustion.level}
              </Text>
              <div className={styles.exhaustionPips}>
                {Array.from(
                  {
                    length:
                      sheet.overview.exhaustion.maximumLevel -
                      sheet.overview.exhaustion.minimumLevel
                  },
                  (_, index) => {
                    const level = sheet.overview.exhaustion.minimumLevel + index + 1
                    const active = level <= sheet.overview.exhaustion.level
                    const nextLevel =
                      active && level === sheet.overview.exhaustion.level
                        ? sheet.overview.exhaustion.minimumLevel
                        : level

                    return (
                      <button
                        className={styles.exhaustionPip}
                        aria-label={
                          nextLevel === sheet.overview.exhaustion.minimumLevel
                            ? 'Clear exhaustion'
                            : `Set exhaustion level ${level}`
                        }
                        aria-pressed={active}
                        data-active={active}
                        disabled={pending}
                        key={level}
                        type='button'
                        onClick={() => void submitExhaustion(nextLevel)}
                      >
                        <span
                          className={styles.exhaustionPipVisual}
                          aria-hidden='true'
                          data-active={active}
                        />
                      </button>
                    )
                  }
                )}
              </div>
            </div>
          </div>
        </div>
        {conditionsOnly ? null : (
          <>
            <div className={styles.statusStripItem}>
              <Text className={styles.statusStripLabel}>Inspiration</Text>
              <div className={`${styles.statusStripContent} ${styles.statusStripContentCenter}`}>
                <button
                  aria-label={sheet.overview.inspiration ? 'Use inspiration' : 'Gain inspiration'}
                  aria-pressed={sheet.overview.inspiration ?? false}
                  className={styles.inspirationPip}
                  data-active={sheet.overview.inspiration ?? false}
                  disabled={pending}
                  type='button'
                  onClick={() =>
                    submitCommand({
                      type: 'SET_INSPIRATION',
                      inspired: !(sheet.overview.inspiration ?? false),
                      expectedVersion: version
                    })
                  }
                >
                  <IInspiration />
                </button>
              </div>
            </div>
          </>
        )}
        <div className={styles.conditionSummary}>
          <Text className={styles.statusStripLabel}>Conditions</Text>
          <div className={`${styles.statusStripContent} ${styles.statusStripContentStart}`}>
            {conditionsOnly ? (
              <Text className={styles.statusStripValue}>{conditions}</Text>
            ) : (
              <button
                className={styles.conditionAddShell}
                aria-expanded={conditionsOpen}
                disabled={pending}
                type='button'
                onClick={() => setConditionsOpen((current) => !current)}
              >
                <Text truncate>{conditions}</Text>
                <CirclePlus aria-hidden='true' size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      <Collapse expanded={conditionsOnly || conditionsOpen}>
        <div className={styles.statusControlPanel}>
          <div className={styles.statusControlGrid}>
            <Select
              aria-label='Add condition'
              classNames={{ input: styles.compactActionControl }}
              data={sheet.reference.conditionOptions
                .filter((option) => option.code !== 'EXHAUSTION')
                .map((option) => ({
                  value: option.id,
                  label: option.label
                }))}
              disabled={pending}
              placeholder='Add condition'
              searchable
              value={conditionTypeId}
              onChange={(value) => {
                const existing = sheet.overview.conditions.find(
                  (condition) => condition.conditionTypeId === value
                )
                setConditionTypeId(value)
                setConditionNotes(existing?.notes ?? '')
              }}
            />
            <TextInput
              aria-label='Condition notes'
              classNames={{ input: styles.compactActionControl }}
              disabled={pending}
              placeholder='Notes'
              value={conditionNotes}
              onBlur={(event) => {
                if (
                  activeCondition &&
                  conditionNotes.trim() !== (activeCondition.notes ?? '') &&
                  event.relatedTarget !== conditionSubmitRef.current
                ) {
                  void submitCondition()
                }
              }}
              onChange={(event) => setConditionNotes(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              }}
            />
            <Button
              className={styles.compactActionControl}
              disabled={pending || !conditionTypeId}
              ref={conditionSubmitRef}
              size='xs'
              onClick={() => void submitCondition()}
            >
              {activeCondition ? 'Save' : 'Add'}
            </Button>
          </div>
          <TextInput
            aria-label='Exhaustion notes'
            classNames={{ input: styles.compactActionControl }}
            description='Commit on blur or Enter.'
            disabled={pending}
            label='Notes'
            placeholder='What caused the exhaustion?'
            value={exhaustionNotes}
            onBlur={() => {
              if (exhaustionNotes !== savedExhaustionNotes.current) {
                void submitExhaustion(sheet.overview.exhaustion.level)
              }
            }}
            onChange={(event) => setExhaustionNotes(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
            }}
          />
          <AuthoredDetailProse
            html={sheet.overview.exhaustion.description}
            fallback={sheet.overview.exhaustion.description}
          />
          {statusError ? (
            <Text className={styles.commandInlineError} role='alert'>
              {statusError}
            </Text>
          ) : null}
          {selectedCondition?.description ? (
            <AuthoredDetailProse html={selectedCondition.description} fallback='' />
          ) : null}
          {sheet.overview.conditions.length ? (
            <div className={styles.statusConditionList}>
              {sheet.overview.conditions.map((condition) => (
                <div
                  className={styles.statusConditionRow}
                  key={`${condition.conditionTypeId}:${condition.notes ?? ''}`}
                >
                  <div>
                    <Text className={styles.proficiencyName}>{condition.label}</Text>
                    {condition.notes ? (
                      <Text className={styles.proficiencyMeta}>{condition.notes}</Text>
                    ) : null}
                    {condition.description ? (
                      <AuthoredDetailProse html={condition.description} fallback='' />
                    ) : null}
                  </div>
                  <div className={styles.compactActions}>
                    <Button
                      className={styles.compactActionControl}
                      aria-label={`Edit ${condition.label} notes`}
                      disabled={pending}
                      size='xs'
                      variant='default'
                      onClick={() => {
                        setConditionTypeId(condition.conditionTypeId)
                        setConditionNotes(condition.notes ?? '')
                      }}
                    >
                      Notes
                    </Button>
                    <Button
                      className={styles.compactActionControl}
                      aria-label={`Remove ${condition.label} condition`}
                      disabled={pending}
                      size='xs'
                      variant='default'
                      onClick={() => void removeCondition(condition.conditionTypeId)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </Collapse>
    </section>
  )
}
