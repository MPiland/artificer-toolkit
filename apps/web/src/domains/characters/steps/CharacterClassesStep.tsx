import { useState } from 'react'
import { Button, Group, NumberInput, Stack, Text } from '@mantine/core'
import { withForm } from '#forms/app-form/AppForm'
import { AppSelect } from '#ui/primitives/Select'
import {
  clearClassDependents,
  clearClassOwnedChoices,
  clearPrimaryClassDependents,
  clearSubclassDependents,
  clearSubclassOwnedChoices,
  choiceOptions,
  createFallbackCharacterFormValues,
  isChoiceOptionDisabled
} from '../characterBuilder.utils'
import * as styles from '../characterBuilder.css'
import { CharacterChosenGrantChoices } from './CharacterChosenGrantChoices'
import { CharacterClassGrantedSummary } from './CharacterClassGrantedSummary'
import { CharacterGrantedFeatures } from './CharacterGrantedFeatures'
import { CharacterSpellChoices } from './CharacterSpellChoices'
import type { CharacterFormValues } from '../characterBuilder.utils'
import type { CharacterBuilderStepProps } from './CharacterBuilderStep.types'

type CharacterClassRow = CharacterFormValues['intent']['classes'][number]

export const CharacterClassesStep = withForm({
  defaultValues: createFallbackCharacterFormValues(),
  props: {} as CharacterBuilderStepProps,
  render: function RenderCharacterClasses({ form, payload, readOnly }) {
    const [classToAdd, setClassToAdd] = useState<string | null>(null)
    const addClassOptions = choiceOptions(payload.view.classes.classOptions)

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
                          data={addClassOptions}
                          value={classToAdd}
                          placeholder='Choose a class'
                          onChange={setClassToAdd}
                        />
                        <Button
                          type='button'
                          disabled={!classToAdd || isChoiceOptionDisabled(payload.view.classes.classOptions, classToAdd)}
                          onClick={() => {
                            if (!classToAdd || isChoiceOptionDisabled(payload.view.classes.classOptions, classToAdd)) return
                            form.setFieldValue('intent.classes', [...rows, {
                              classId: classToAdd,
                              classLevel: 1
                            }])
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
                      const rowClassOptions = choiceOptions(view?.classOptions ?? payload.view.classes.classOptions)
                      const rowLabel = view?.classLabel
                        ?? rowClassOptions.find((option) => option.value === row.classId)?.label
                        ?? row.classId
                        ?? `Class ${index + 1}`

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
                                    onClick={() => {
                                      const nextRows = rows.filter((_, rowIndex) => rowIndex !== index)
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
                                data={rowClassOptions}
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
                                allowDecimal={false}
                                hideControls
                                label='Class Level'
                                min={1}
                                max={20}
                                value={row.classLevel}
                                disabled={readOnly}
                                onChange={(value) => {
                                  field.replaceValue(index, toClassRow({
                                    ...row,
                                    classLevel: toClassLevel(value)
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
                                        const nextCharacter = clearSubclassOwnedChoices({
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
                            resourceLabels={view?.resourceLabels ?? []}
                            spellcastingLabels={view?.spellcastingLabels ?? []}
                          />
                          <form.AppField name='intent.chosenGrantSelections'>
                            {(grantField) => (
                              <CharacterChosenGrantChoices
                                choices={view?.grantChoices ?? []}
                                selections={grantField.state.value}
                                readOnly={readOnly}
                                onChange={grantField.handleChange}
                              />
                            )}
                          </form.AppField>
                          <form.AppField name='intent.featureAcquisitions'>
                            {(featureField) => (
                              <CharacterGrantedFeatures
                                features={view?.features ?? []}
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

function toClassLevel(value: number | string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1

  return Math.min(20, Math.max(1, Math.trunc(value)))
}
