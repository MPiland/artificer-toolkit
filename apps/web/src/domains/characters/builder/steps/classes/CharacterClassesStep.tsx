import { useState } from 'react'
import { Button, Group, Stack, Text } from '@mantine/core'
import { withForm } from '#forms/app-form/AppForm'
import { AppSelect } from '#ui/primitives/Select'
import {
  clearClassDependents,
  clearClassOwnedChoices,
  clearPrimaryClassDependents,
  clearSubclassDependents,
  clearSubclassOwnedChoices
} from '../../shared/dependencyClearing'
import { getAssignedAbilityScores } from '../abilities/abilityGeneration'
import {
  choiceOptions,
  getAllChosenGrantChoices,
  isChoiceOptionDisabled
} from '../../choices/choiceOptions'
import { EMPTY_CHARACTER_FORM_VALUES } from '../../shared/formNormalization'
import * as sharedStyles from '../../shared/builderShared.css'
import * as choiceStyles from '../../choices/characterChoices.css'
import { CharacterSelectionModal } from '../../selection/CharacterSelectionModal'
import {
  applyClassChoiceEligibility,
  buildClassSelectionGroups
} from '../../selection/characterSelectionOptions'
import { CharacterChosenGrantChoices } from '../../choices/CharacterChosenGrantChoices'
import { CharacterGrantedFeatures } from '../../choices/CharacterGrantedFeatures'
import { CharacterSpellChoices } from '../../choices/CharacterSpellChoices'
import type { CharacterBuilderStepProps } from '../../core/CharacterBuilderStep.types'
import { CharacterClassCard } from './CharacterClassCard'
import { ClassProficiencies } from './ClassProficiencies'
import { toClassLevel } from './characterClasses'

export const CharacterClassesStep = withForm({
  defaultValues: EMPTY_CHARACTER_FORM_VALUES,
  props: {} as CharacterBuilderStepProps,
  render: function RenderCharacterClasses({ form, payload, readOnly }) {
    const [classChooserOpened, setClassChooserOpened] = useState(false)
    const [classReplacementIndex, setClassReplacementIndex] = useState<number | null>(null)
    const [stagedClassId, setStagedClassId] = useState<string | null>(null)
    const serverClassChooserChoices =
      classReplacementIndex === null
        ? payload.view.classes.classOptions
        : (payload.view.classes.selectedClasses[classReplacementIndex]?.classOptions ??
          payload.view.classes.classOptions)
    const currentBaseScores = getAssignedAbilityScores(form.state.values.intent.abilities)
    const resolvedBaseScores = getAssignedAbilityScores(payload.character.intent.abilities)
    const abilityScores: typeof currentBaseScores = {}
    for (const [ability, score] of Object.entries(currentBaseScores)) {
      if (score === undefined) continue
      abilityScores[ability] =
        score +
        ((payload.resolution.summary.abilities[ability] ?? score) -
          (resolvedBaseScores[ability] ?? score))
    }
    const classChooserChoices = applyClassChoiceEligibility({
      abilityScores,
      choices: serverClassChooserChoices,
      currentClassIds: form.state.values.intent.classes.map((row) => row.classId),
      references: payload.references.classes,
      replacementIndex: classReplacementIndex ?? undefined
    })
    const classSelectionGroups = buildClassSelectionGroups(
      payload.references.classes,
      classChooserChoices
    )
    const allGrantChoices = getAllChosenGrantChoices(payload.view)

    return (
      <div className={sharedStyles.section}>
        <form.AppField name='intent.classes' mode='array'>
          {(field) => {
            const rows = field.state.value ?? []

            return (
              <Stack gap='md'>
                {!readOnly ? (
                  <Group>
                    <Button
                      type='button'
                      onClick={() => {
                        setClassReplacementIndex(null)
                        setStagedClassId(null)
                        setClassChooserOpened(true)
                      }}
                    >
                      Add Class
                    </Button>
                  </Group>
                ) : null}
                {rows.length === 0 ? (
                  <Text className={sharedStyles.mutedText}>No classes have been added yet.</Text>
                ) : (
                  rows.map((row, index) => {
                    const view = payload.view.classes.selectedClasses[index]
                    const rowClassOptions = choiceOptions(
                      view?.classOptions ?? payload.view.classes.classOptions
                    )
                    const rowLabel =
                      view?.classLabel ??
                      rowClassOptions.find((option) => option.value === row.classId)?.label ??
                      row.classId ??
                      `Class ${index + 1}`
                    const featureGrantChoices =
                      view?.grantChoices.filter((choice) => choice.ownerFeatureId) ?? []
                    const standaloneGrantChoices =
                      view?.grantChoices.filter((choice) => !choice.ownerFeatureId) ?? []
                    const proficiencyChoiceIds = new Set(
                      view?.proficiencyGroups.flatMap((group) => group.choiceIds) ?? []
                    )
                    const otherStandaloneGrantChoices = standaloneGrantChoices.filter(
                      (choice) => !proficiencyChoiceIds.has(choice.id)
                    )
                    const subclassControls = view?.subclassOptions.length ? (
                      <Stack gap='sm' className={choiceStyles.grantedFeatureChoices}>
                        <AppSelect
                          label='Subclass'
                          data={choiceOptions(view.subclassOptions)}
                          value={row.subclassId}
                          required
                          clearable
                          disabled={readOnly}
                          onChange={(value) => {
                            const nextRows = rows.map((candidate, rowIndex) =>
                              rowIndex === index
                                ? clearSubclassDependents({
                                    ...row,
                                    subclassId: value ?? undefined
                                  })
                                : candidate
                            )
                            const nextCharacter = clearSubclassOwnedChoices(
                              {
                                ...form.state.values,
                                intent: {
                                  ...form.state.values.intent,
                                  classes: nextRows
                                }
                              },
                              row
                            )

                            form.setFieldValue('intent', nextCharacter.intent)
                          }}
                        />
                        {view.specializationOptions.length ? (
                          <AppSelect
                            label='Specialization'
                            data={choiceOptions(view.specializationOptions)}
                            value={row.specializationId}
                            required
                            clearable
                            disabled={readOnly}
                            onChange={(value) => {
                              field.replaceValue(index, {
                                ...row,
                                specializationId: value ?? undefined
                              })
                            }}
                          />
                        ) : null}
                      </Stack>
                    ) : null

                    const featureContent = (
                      <>
                        <form.AppField name='intent.chosenGrantSelections'>
                          {(grantField) => (
                            <>
                              <ClassProficiencies
                                allChoices={allGrantChoices}
                                view={view}
                                grantChoices={standaloneGrantChoices}
                                selections={grantField.state.value}
                                readOnly={readOnly}
                                onChange={grantField.handleChange}
                              />
                              <CharacterChosenGrantChoices
                                allChoices={allGrantChoices}
                                choices={otherStandaloneGrantChoices}
                                presentation='feature'
                                selections={grantField.state.value}
                                readOnly={readOnly}
                                onChange={grantField.handleChange}
                              />
                              <form.AppField name='intent.featureAcquisitions'>
                                {(featureField) => (
                                  <CharacterGrantedFeatures
                                    features={view?.features ?? []}
                                    choices={view?.featureChoices ?? []}
                                    acquisitions={featureField.state.value}
                                    readOnly={readOnly}
                                    presentation='cards'
                                    showSourceBadge={false}
                                    showTitle={false}
                                    renderFeatureControls={(feature) => (
                                      <>
                                        {feature.id === view?.subclassSelectionFeatureId
                                          ? subclassControls
                                          : null}
                                        <CharacterChosenGrantChoices
                                          allChoices={allGrantChoices}
                                          choices={featureGrantChoices.filter(
                                            (choice) => choice.ownerFeatureId === feature.id
                                          )}
                                          presentation='controls'
                                          selections={grantField.state.value}
                                          readOnly={readOnly}
                                          onChange={grantField.handleChange}
                                        />
                                      </>
                                    )}
                                    onChange={featureField.handleChange}
                                  >
                                    {subclassControls && !view?.subclassSelectionFeatureId ? (
                                      <article className={choiceStyles.grantedFeatureItem}>
                                        <div className={choiceStyles.grantedFeatureHeader}>
                                          <Text fw={700}>Subclass</Text>
                                        </div>
                                        {subclassControls}
                                      </article>
                                    ) : null}
                                  </CharacterGrantedFeatures>
                                )}
                              </form.AppField>
                            </>
                          )}
                        </form.AppField>
                      </>
                    )

                    return (
                      <CharacterClassCard
                        key={`${row.classId}-${index}`}
                        featureContent={featureContent}
                        label={rowLabel}
                        level={row.classLevel}
                        readOnly={readOnly}
                        spellContent={
                          view?.spellChoices.length ? (
                            <form.AppField name='intent.spellSelections'>
                              {(spellField) => (
                                <CharacterSpellChoices
                                  choices={view.spellChoices}
                                  selections={spellField.state.value}
                                  readOnly={readOnly}
                                  onChange={spellField.handleChange}
                                />
                              )}
                            </form.AppField>
                          ) : undefined
                        }
                        onChangeClass={() => {
                          setClassReplacementIndex(index)
                          setStagedClassId(null)
                          setClassChooserOpened(true)
                        }}
                        onLevelChange={(value) => {
                          field.replaceValue(index, {
                            ...row,
                            classLevel: toClassLevel(value)
                          })
                        }}
                        onRemove={() => {
                          const nextRows = rows.filter((_, rowIndex) => rowIndex !== index)
                          const nextCharacter = clearClassOwnedChoices(
                            {
                              ...form.state.values,
                              intent: {
                                ...form.state.values.intent,
                                classes: nextRows
                              }
                            },
                            row
                          )
                          const nextIntent =
                            index === 0
                              ? clearPrimaryClassDependents(nextCharacter).intent
                              : nextCharacter.intent

                          form.setFieldValue('intent', nextIntent)
                        }}
                      />
                    )
                  })
                )}
                <CharacterSelectionModal
                  title={classReplacementIndex === null ? 'Choose a class' : 'Change class'}
                  description='Compare hit dice, saving throws, proficiencies, and class descriptions before choosing.'
                  actionLabel={classReplacementIndex === null ? 'Add Class' : 'Change Class'}
                  currentId={
                    classReplacementIndex === null
                      ? null
                      : (rows[classReplacementIndex]?.classId ?? null)
                  }
                  groups={classSelectionGroups}
                  opened={classChooserOpened}
                  selectedId={stagedClassId}
                  onSelectedIdChange={setStagedClassId}
                  onClose={() => {
                    setStagedClassId(null)
                    setClassChooserOpened(false)
                  }}
                  onCommit={(nextClassId) => {
                    if (!nextClassId || isChoiceOptionDisabled(classChooserChoices, nextClassId))
                      return

                    if (classReplacementIndex === null) {
                      form.setFieldValue('intent.classes', [
                        ...rows,
                        {
                          classId: nextClassId,
                          classLevel: 1
                        }
                      ])
                    } else {
                      const previousRow = rows[classReplacementIndex]
                      if (!previousRow) return
                      if (previousRow.classId === nextClassId) {
                        setStagedClassId(null)
                        setClassChooserOpened(false)
                        return
                      }
                      const nextRows = rows.map((candidate, rowIndex) =>
                        rowIndex === classReplacementIndex
                          ? clearClassDependents({
                              classId: nextClassId,
                              classLevel: previousRow.classLevel
                            })
                          : candidate
                      )
                      const nextCharacter = clearClassOwnedChoices(
                        {
                          ...form.state.values,
                          intent: {
                            ...form.state.values.intent,
                            classes: nextRows
                          }
                        },
                        previousRow
                      )
                      const nextIntent =
                        classReplacementIndex === 0
                          ? clearPrimaryClassDependents(nextCharacter).intent
                          : nextCharacter.intent

                      form.setFieldValue('intent', nextIntent)
                    }

                    setStagedClassId(null)
                    setClassChooserOpened(false)
                  }}
                />
              </Stack>
            )
          }}
        </form.AppField>
      </div>
    )
  }
})
