import { Accordion, Button, Text, TextInput } from '@mantine/core'
import { Minus, Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { AuthoredDetailProse } from '#app/components/AuthoredDetail'
import type { CharacterSheet, SubmitSheetCommand } from '../core/CharacterSheet.types'
import { sheetFieldClassNames } from '../shared/characterSheetFieldStyles'
import * as rowStyles from '../shared/rows.css'
import * as statusEditorStyles from './statusEditor.css'

export function ExhaustionEditor({
  pending,
  sheet,
  submitCommand
}: {
  pending: boolean
  sheet: CharacterSheet
  submitCommand: SubmitSheetCommand
}) {
  const [detailsOpen, setDetailsOpen] = useState(true)
  const [notes, setNotes] = useState(sheet.overview.exhaustion.notes ?? '')
  const [exhaustionError, setExhaustionError] = useState<string | null>(null)
  const savedNotes = useRef(sheet.overview.exhaustion.notes ?? '')

  async function submitExhaustion(level: number, nextNotes = notes) {
    setExhaustionError(null)
    const succeeded = await submitCommand({
      type: 'SET_EXHAUSTION',
      level,
      notes: nextNotes.trim() || undefined,
      expectedVersion: sheet.meta.streamVersion
    })

    if (succeeded) {
      savedNotes.current = nextNotes
      return
    }

    setExhaustionError('Exhaustion could not be updated. Your notes were kept; try again.')
  }

  return (
    <div
      className={`${statusEditorStyles.statusEditorSection} ${statusEditorStyles.statusEditorSectionDivided}`}
    >
      <Accordion
        chevronPosition='right'
        classNames={{
          chevron: statusEditorStyles.exhaustionAccordionChevron,
          content: statusEditorStyles.exhaustionAccordionContent,
          control: statusEditorStyles.exhaustionAccordionControl,
          item: statusEditorStyles.exhaustionAccordionItem,
          label: statusEditorStyles.exhaustionAccordionLabel,
          root: statusEditorStyles.exhaustionAccordion
        }}
        order={3}
        unstyled
        value={detailsOpen ? 'details' : null}
        onChange={(value) => setDetailsOpen(value === 'details')}
      >
        <Accordion.Item value='details'>
          <div className={statusEditorStyles.exhaustionAccordionHeader}>
            <Accordion.Control
              aria-label={`${detailsOpen ? 'Collapse' : 'Expand'} exhaustion details`}
            >
              <span className={statusEditorStyles.exhaustionDisclosureCopy}>
                <Text component='span' className={statusEditorStyles.statusEditorTitle}>
                  {sheet.overview.exhaustion.label}
                </Text>
                <Text
                  component='span'
                  className={`${statusEditorStyles.statusEditorMeta} ${statusEditorStyles.exhaustionAccordionMeta}`}
                >
                  Cumulative effects apply through the current level.
                </Text>
              </span>
            </Accordion.Control>
            <div className={statusEditorStyles.exhaustionLevelControls}>
              <Button
                aria-label='Decrease exhaustion level'
                className={statusEditorStyles.exhaustionLevelButton}
                disabled={
                  pending ||
                  sheet.overview.exhaustion.level <= sheet.overview.exhaustion.minimumLevel
                }
                size='xs'
                variant='default'
                onClick={() =>
                  void submitExhaustion(
                    Math.max(
                      sheet.overview.exhaustion.minimumLevel,
                      sheet.overview.exhaustion.level - 1
                    )
                  )
                }
              >
                <Minus aria-hidden='true' size={16} />
              </Button>
              <Text
                aria-live='polite'
                className={statusEditorStyles.exhaustionLevelValue}
              >{`Level ${sheet.overview.exhaustion.level}`}</Text>
              <Button
                aria-label='Increase exhaustion level'
                className={statusEditorStyles.exhaustionLevelButton}
                disabled={
                  pending ||
                  sheet.overview.exhaustion.level >= sheet.overview.exhaustion.maximumLevel
                }
                size='xs'
                variant='default'
                onClick={() =>
                  void submitExhaustion(
                    Math.min(
                      sheet.overview.exhaustion.maximumLevel,
                      sheet.overview.exhaustion.level + 1
                    )
                  )
                }
              >
                <Plus aria-hidden='true' size={16} />
              </Button>
            </div>
          </div>
          <Accordion.Panel>
            <div className={statusEditorStyles.exhaustionDetails}>
              <div className={statusEditorStyles.exhaustionEffects}>
                <Text className={statusEditorStyles.statusEditorLabel}>Effects by level</Text>
                <AuthoredDetailProse
                  html={sheet.overview.exhaustion.description}
                  fallback={sheet.overview.exhaustion.description}
                />
              </div>
              <TextInput
                aria-label='Exhaustion notes'
                classNames={sheetFieldClassNames}
                disabled={pending}
                label='Exhaustion notes (optional)'
                placeholder='Cause or context'
                value={notes}
                onBlur={() => {
                  if (notes !== savedNotes.current) {
                    void submitExhaustion(sheet.overview.exhaustion.level)
                  }
                }}
                onChange={(event) => setNotes(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                }}
              />
            </div>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
      {exhaustionError ? (
        <Text className={rowStyles.commandInlineError} role='alert'>
          {exhaustionError}
        </Text>
      ) : null}
    </div>
  )
}
