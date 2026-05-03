import { useState } from 'react'
import { Button, Group, NumberInput, Stack, Text } from '@mantine/core'
import { withForm } from '#forms'
import { AppSelect } from '#ui/primitives/Select'
import {
  clearClassDependents,
  clearClassOwnedChoices,
  clearPrimaryClassDependents,
  clearSubclassDependents,
  choiceOptions,
  createFallbackCharacterFormValues,
  isChoiceOptionDisabled
} from '../characterBuilder.utils'
import * as styles from '../characterBuilder.css'
import { CharacterClassGrantedSummary } from './CharacterClassGrantedSummary'
import { CharacterFeatureChoices } from './CharacterFeatureChoices'
import { CharacterSpellChoices } from './CharacterSpellChoices'
import type { CharacterFormValues } from '../characterBuilder.utils'
import type { CharacterBuilderStepProps } from './CharacterBuilderStep.types'

type CharacterClassRow = CharacterFormValues['intent']['classes'][number]

export const CharacterClassesStep = withForm({
  defaultValues: createFallbackCharacterFormValues(),
  props: {} as CharacterBuilderStepProps,
  render: function RenderCharacterClasses({ form, payload, readOnly }) {
    const [classToAdd, setClassToAdd] = useState<string | null>(null)
    const classOptions = choiceOptions(payload.view.classes.classOptions)

    return (
      <section className={styles.section} aria-labelledby='character-classes-title'>
        <div className={styles.sectionHeader}>
          <h3 id='character-classes-title' className={styles.sectionTitle}>Classes</h3>
        </div>
        <form.AppField name='intent.classes' mode='array'>
          {(field) => {
            const rows = field.state.value ?? []

            return (
              <Stack gap='md'>
                {!readOnly
                  ? (
                      <Group align='flex-end'>
                        <AppSelect
                          label='Add Class'
                          data={classOptions}
                          value={classToAdd}
                          placeholder='Choose a class'
                          onChange={setClassToAdd}
                        />
                        <Button
                          type='button'
                          disabled={!classToAdd || isChoiceOptionDisabled(payload.view.classes.classOptions, classToAdd)}
                          onClick={() => {
                            if (!classToAdd || isChoiceOptionDisabled(payload.view.classes.classOptions, classToAdd)) return
                            field.pushValue({
                              classId: classToAdd,
                              classLevel: 1
                            })
                            setClassToAdd(null)
                          }}
                        >
                          Add Class
                        </Button>
                      </Group>
                    )
                  : null}
                {rows.length === 0
                  ? <Text className={styles.mutedText}>No classes have been added yet.</Text>
                  : rows.map((row, index) => {
                      const view = payload.view.classes.selectedClasses[index]
                      const rowLabel = view?.classLabel ?? row.classId ?? `Class ${index + 1}`

                      return (
                        <div key={`${row.classId}-${index}`} className={styles.inlinePanel}>
                          <Group justify='space-between' align='flex-start'>
                            <div>
                              <Text fw={700}>{rowLabel}</Text>
                              <Text className={styles.mutedText} size='sm'>{`Level ${row.classLevel}`}</Text>
                            </div>
                            {!readOnly
                              ? (
                                  <Button
                                    type='button'
                                    variant='subtle'
                                    color='red'
                                    onClick={() => field.removeValue(index)}
                                  >
                                    Remove
                                  </Button>
                                )
                              : null}
                          </Group>
                          <div className={styles.fieldGrid}>
                            <div className={styles.fieldSpan4}>
                              <AppSelect
                                label='Class'
                                data={classOptions}
                                value={row.classId}
                                disabled={readOnly}
                                onChange={(value) => {
                                  const nextRows = rows.map((candidate, rowIndex) => rowIndex === index
                                    ? clearClassDependents(toClassRow({
                                        classId: value ?? '',
                                        classLevel: row.classLevel
                                      }))
                                    : candidate)
                                  const nextCharacter = clearClassOwnedChoices({
                                    ...form.state.values,
                                    intent: {
                                      ...form.state.values.intent,
                                      classes: nextRows
                                    }
                                  }, row)
                                  const nextIntent = index === 0
                                    ? clearPrimaryClassDependents(nextCharacter).intent
                                    : nextCharacter.intent

                                  form.setFieldValue('intent', nextIntent)
                                }}
                              />
                            </div>
                            <div className={styles.fieldSpan4}>
                              <NumberInput
                                hideControls
                                label='Class Level'
                                min={1}
                                max={20}
                                value={row.classLevel}
                                disabled={readOnly}
                                onChange={(value) => {
                                  field.replaceValue(index, toClassRow({
                                    ...row,
                                    classLevel: typeof value === 'number' ? value : 1
                                  }))
                                }}
                              />
                            </div>
                            {view?.subclassOptions.length
                              ? (
                                  <div className={styles.fieldSpan4}>
                                    <AppSelect
                                      label='Subclass'
                                      data={choiceOptions(view.subclassOptions)}
                                      value={row.subclassId}
                                      clearable
                                      disabled={readOnly}
                                      onChange={(value) => {
                                        const nextRows = rows.map((candidate, rowIndex) => rowIndex === index
                                          ? clearSubclassDependents(toClassRow({
                                              ...row,
                                              subclassId: value ?? undefined
                                            }))
                                          : candidate)
                                        const nextCharacter = clearClassOwnedChoices({
                                          ...form.state.values,
                                          intent: {
                                            ...form.state.values.intent,
                                            classes: nextRows
                                          }
                                        }, row)

                                        form.setFieldValue('intent', nextCharacter.intent)
                                      }}
                                    />
                                  </div>
                                )
                              : null}
                            {view?.specializationOptions.length
                              ? (
                                  <div className={styles.fieldSpan4}>
                                    <AppSelect
                                      label='Specialization'
                                      data={choiceOptions(view.specializationOptions)}
                                      value={row.specializationId}
                                      clearable
                                      disabled={readOnly}
                                      onChange={(value) => {
                                        field.replaceValue(index, toClassRow({
                                          ...row,
                                          specializationId: value ?? undefined
                                        }))
                                      }}
                                    />
                                  </div>
                                )
                              : null}
                          </div>
                          <CharacterClassGrantedSummary
                            featureLabels={view?.featureLabels ?? []}
                            resourceLabels={view?.resourceLabels ?? []}
                            spellcastingLabels={view?.spellcastingLabels ?? []}
                          />
                          <form.AppField name='intent.featureAcquisitions'>
                            {(featureField) => (
                              <CharacterFeatureChoices
                                choices={view?.featureChoices ?? []}
                                acquisitions={featureField.state.value}
                                readOnly={readOnly}
                                onChange={featureField.handleChange}
                              />
                            )}
                          </form.AppField>
                          <form.AppField name='intent.spellSelections'>
                            {(spellField) => (
                              <CharacterSpellChoices
                                choices={view?.spellChoices ?? []}
                                selections={spellField.state.value}
                                readOnly={readOnly}
                                onChange={spellField.handleChange}
                              />
                            )}
                          </form.AppField>
                        </div>
                      )
                    })}
              </Stack>
            )
          }}
        </form.AppField>
      </section>
    )
  }
})

function toClassRow(row: CharacterClassRow): CharacterClassRow {
  return row
}
