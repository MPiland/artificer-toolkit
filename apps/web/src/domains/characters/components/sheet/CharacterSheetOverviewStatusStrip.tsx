import { Button, Collapse, Select, Text, TextInput } from '@mantine/core'
import { CirclePlus } from 'lucide-react'
import { useState } from 'react'
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
  const activeCondition = sheet.overview.conditions.find(
    (condition) => condition.conditionTypeId === conditionTypeId
  )
  const selectedCondition = sheet.reference.conditionOptions.find(
    (option) => option.id === conditionTypeId
  )
  const conditions = sheet.overview.conditions.length
    ? sheet.overview.conditions.map((condition) => condition.label).join(', ')
    : 'Add Condition'

  function submitCondition() {
    if (!conditionTypeId) return

    void submitCommand({
      type: 'ADD_CONDITION',
      conditionTypeId,
      notes: conditionNotes.trim() || undefined,
      expectedVersion: version
    })
    setConditionTypeId(null)
    setConditionNotes('')
  }

  return (
    <section
      className={styles.statusStripPanel}
      aria-label={conditionsOnly ? 'Conditions and exhaustion' : 'Status summary'}
    >
      <div className={`${styles.statusStrip} ${conditionsOnly ? styles.conditionsOnlyStrip : ''}`}>
        <div className={styles.statusStripItem}>
          <Text className={styles.statusStripLabel}>Exhaustion</Text>
          <div className={`${styles.statusStripContent} ${styles.statusStripContentStart}`}>
            <div className={styles.statusStripStack}>
              <Text className={styles.statusStripValue}>
                Level {sheet.overview.exhaustionLevel}
              </Text>
              <div className={styles.exhaustionPips}>
                {Array.from({ length: 6 }, (_, index) => {
                  const level = index + 1
                  const active = index < sheet.overview.exhaustionLevel
                  const nextLevel = active && level === sheet.overview.exhaustionLevel ? 0 : level

                  return (
                    <button
                      className={styles.exhaustionPip}
                      aria-label={
                        nextLevel === 0 ? 'Clear exhaustion' : `Set exhaustion level ${level}`
                      }
                      aria-pressed={active}
                      data-active={active}
                      disabled={pending}
                      key={level}
                      type='button'
                      onClick={() =>
                        submitCommand({
                          type: 'SET_EXHAUSTION',
                          level: nextLevel,
                          expectedVersion: version
                        })
                      }
                    />
                  )
                })}
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
              data={sheet.reference.conditionOptions.map((option) => ({
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
              onChange={(event) => setConditionNotes(event.currentTarget.value)}
            />
            <Button
              className={styles.compactActionControl}
              disabled={pending || !conditionTypeId}
              size='xs'
              onClick={submitCondition}
            >
              {activeCondition ? 'Save' : 'Add'}
            </Button>
          </div>
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
                      onClick={() =>
                        submitCommand({
                          type: 'REMOVE_CONDITION',
                          conditionTypeId: condition.conditionTypeId,
                          expectedVersion: version
                        })
                      }
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
