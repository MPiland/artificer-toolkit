import { useState } from 'react'
import {
  ActionIcon,
  Button,
  Group,
  NumberInput,
  Stack,
  Tabs,
  Text,
  Tooltip,
  VisuallyHidden
} from '@mantine/core'
import { IconReplace, IconTrash } from '@tabler/icons-react'
import type {
  CharacterBuilderChosenGrantChoiceViewDto,
  CharacterBuilderClassViewItemDto
} from '@artificer-toolkit/schema/api/characters'
import { withForm } from '#forms/app-form/AppForm'
import { AppSelect } from '#ui/primitives/Select'
import {
  clearClassDependents,
  clearClassOwnedChoices,
  clearPrimaryClassDependents,
  clearSubclassDependents,
  clearSubclassOwnedChoices,
  abilityCodes,
  choiceOptions,
  createFallbackCharacterFormValues,
  getAllChosenGrantChoices,
  getAssignedAbilityScores,
  isChoiceOptionDisabled
} from '../characterBuilder.utils'
import * as styles from '../characterBuilder.css'
import { CharacterSelectionModal } from '../components/CharacterSelectionModal'
import {
  applyClassChoiceEligibility,
  buildClassSelectionGroups
} from '../components/characterSelectionOptions'
import { CharacterChosenGrantChoices } from './CharacterChosenGrantChoices'
import { CharacterGrantedFeatures } from './CharacterGrantedFeatures'
import { CharacterSpellChoices } from './CharacterSpellChoices'
import type { CharacterFormValues } from '../characterBuilder.utils'
import type { CharacterBuilderStepProps } from './CharacterBuilderStep.types'

type CharacterClassRow = CharacterFormValues['intent']['classes'][number]

export const CharacterClassesStep = withForm({
  defaultValues: createFallbackCharacterFormValues(),
  props: {} as CharacterBuilderStepProps,
  render: function RenderCharacterClasses({ form, payload, readOnly }) {
    const [classChooserOpened, setClassChooserOpened] = useState(false)
    const [classReplacementIndex, setClassReplacementIndex] = useState<number | null>(null)
    const [stagedClassId, setStagedClassId] = useState<string | null>(null)
    const serverClassChooserChoices = classReplacementIndex === null
      ? payload.view.classes.classOptions
      : (payload.view.classes.selectedClasses[classReplacementIndex]?.classOptions
        ?? payload.view.classes.classOptions)
    const currentBaseScores = getAssignedAbilityScores(form.state.values.intent.abilities)
    const resolvedBaseScores = getAssignedAbilityScores(payload.character.intent.abilities)
    const abilityScores: typeof currentBaseScores = {}
    for (const ability of abilityCodes) {
      const score = currentBaseScores[ability]
      if (score === undefined) continue
      abilityScores[ability] = score + (
        (payload.resolution.summary.abilities[ability] ?? score)
        - (resolvedBaseScores[ability] ?? score)
      )
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
      <div className={styles.section}>
        <form.AppField name='intent.classes' mode='array'>
          {(field) => {
            const rows = field.state.value ?? []

            return (
              <Stack gap='md'>
                {!readOnly
                  ? (
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
                      const featureGrantChoices = view?.grantChoices.filter((choice) => choice.ownerFeatureId) ?? []
                      const standaloneGrantChoices = view?.grantChoices.filter((choice) => !choice.ownerFeatureId) ?? []
                      const proficiencyChoiceIds = new Set(
                        view?.proficiencyGroups.flatMap((group) => group.choiceIds) ?? []
                      )
                      const otherStandaloneGrantChoices = standaloneGrantChoices.filter(
                        (choice) => !proficiencyChoiceIds.has(choice.id)
                      )
                      const subclassControls = view?.subclassOptions.length
                        ? (
                            <Stack gap='sm' className={styles.grantedFeatureChoices}>
                              <AppSelect
                                label='Subclass'
                                data={choiceOptions(view.subclassOptions)}
                                value={row.subclassId}
                                required
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
                              {view.specializationOptions.length
                                ? (
                                    <AppSelect
                                      label='Specialization'
                                      data={choiceOptions(view.specializationOptions)}
                                      value={row.specializationId}
                                      required
                                      clearable
                                      disabled={readOnly}
                                      onChange={(value) => {
                                        field.replaceValue(index, toClassRow({
                                          ...row,
                                          specializationId: value ?? undefined
                                        }))
                                      }}
                                    />
                                  )
                                : null}
                            </Stack>
                          )
                        : null

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
                                            choices={featureGrantChoices.filter((choice) => choice.ownerFeatureId === feature.id)}
                                            presentation='controls'
                                            selections={grantField.state.value}
                                            readOnly={readOnly}
                                            onChange={grantField.handleChange}
                                          />
                                        </>
                                      )}
                                      onChange={featureField.handleChange}
                                    >
                                      {subclassControls && !view?.subclassSelectionFeatureId
                                        ? (
                                            <article className={styles.grantedFeatureItem}>
                                              <div className={styles.grantedFeatureHeader}>
                                                <Text fw={700}>Subclass</Text>
                                              </div>
                                              {subclassControls}
                                            </article>
                                          )
                                        : null}
                                    </CharacterGrantedFeatures>
                                  )}
                                </form.AppField>
                              </>
                            )}
                          </form.AppField>
                        </>
                      )

                      return (
                        <section key={`${row.classId}-${index}`} className={styles.classSection}>
                          <div className={styles.classHeader}>
                            <div className={styles.classIdentity}>
                              <h3 className={styles.classTitle}>{rowLabel}</h3>
                              <NumberInput
                                allowDecimal={false}
                                className={styles.classLevelField}
                                hideControls
                                aria-label={`${rowLabel} level`}
                                size='xs'
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
                            {!readOnly
                              ? (
                                  <Group gap='xs'>
                                    <Tooltip label='Change class'>
                                      <ActionIcon
                                        aria-label={`Change class: ${rowLabel}`}
                                        type='button'
                                        variant='default'
                                        onClick={() => {
                                          setClassReplacementIndex(index)
                                          setStagedClassId(null)
                                          setClassChooserOpened(true)
                                        }}
                                      >
                                        <IconReplace aria-hidden size={17} />
                                      </ActionIcon>
                                    </Tooltip>
                                    <Tooltip label='Remove class'>
                                      <ActionIcon
                                        aria-label={`Remove class: ${rowLabel}`}
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
                                        <IconTrash aria-hidden size={17} />
                                      </ActionIcon>
                                    </Tooltip>
                                  </Group>
                                )
                              : null}
                          </div>
                          {view?.spellChoices.length
                            ? (
                                <Tabs defaultValue='features'>
                                  <Tabs.List>
                                    <Tabs.Tab value='features'>Features</Tabs.Tab>
                                    <Tabs.Tab value='spells'>Spells</Tabs.Tab>
                                  </Tabs.List>
                                  <Tabs.Panel value='features' pt='sm'>{featureContent}</Tabs.Panel>
                                  <Tabs.Panel value='spells' pt='sm'>
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
                                  </Tabs.Panel>
                                </Tabs>
                              )
                            : featureContent}
                        </section>
                      )
                    })}
                <CharacterSelectionModal
                  title={classReplacementIndex === null ? 'Choose a class' : 'Change class'}
                  description='Compare hit dice, saving throws, proficiencies, and class descriptions before choosing.'
                  actionLabel={classReplacementIndex === null ? 'Add Class' : 'Change Class'}
                  currentId={classReplacementIndex === null
                    ? null
                    : rows[classReplacementIndex]?.classId ?? null}
                  groups={classSelectionGroups}
                  opened={classChooserOpened}
                  selectedId={stagedClassId}
                  onSelectedIdChange={setStagedClassId}
                  onClose={() => {
                    setStagedClassId(null)
                    setClassChooserOpened(false)
                  }}
                  onCommit={(nextClassId) => {
                    if (
                      !nextClassId
                      || isChoiceOptionDisabled(classChooserChoices, nextClassId)
                    ) return

                    if (classReplacementIndex === null) {
                      form.setFieldValue('intent.classes', [...rows, {
                        classId: nextClassId,
                        classLevel: 1
                      }])
                    } else {
                      const previousRow = rows[classReplacementIndex]
                      if (!previousRow) return
                      if (previousRow.classId === nextClassId) {
                        setStagedClassId(null)
                        setClassChooserOpened(false)
                        return
                      }
                      const nextRows = rows.map((candidate, rowIndex) => rowIndex === classReplacementIndex
                        ? clearClassDependents(toClassRow({
                            classId: nextClassId,
                            classLevel: previousRow.classLevel
                          }))
                        : candidate)
                      const nextCharacter = clearClassOwnedChoices({
                        ...form.state.values,
                        intent: {
                          ...form.state.values.intent,
                          classes: nextRows
                        }
                      }, previousRow)
                      const nextIntent = classReplacementIndex === 0
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

function ClassProficiencies({
  allChoices,
  grantChoices,
  onChange,
  readOnly,
  selections,
  view
}: {
  allChoices: CharacterBuilderChosenGrantChoiceViewDto[]
  grantChoices: CharacterBuilderChosenGrantChoiceViewDto[]
  onChange: (selections: CharacterFormValues['intent']['chosenGrantSelections']) => void
  readOnly: boolean
  selections: CharacterFormValues['intent']['chosenGrantSelections']
  view: CharacterBuilderClassViewItemDto | undefined
}) {
  if (!view?.proficiencyGroups.length) return null

  return (
    <section className={styles.classProficiencyCard} aria-label='Proficiencies'>
      <Text fw={700}>Proficiencies</Text>
      {view.proficiencyGroups.map((group) => {
        const choices = grantChoices.filter((choice) => group.choiceIds.includes(choice.id))

        return (
          <div key={group.category} className={styles.classProficiencyRow}>
            <Text fw={600} size='sm'>{group.label}</Text>
            <div className={styles.classProficiencyContent}>
              {group.grantedEntries.length
                ? <Text size='sm'>{group.grantedEntries.join(', ')}</Text>
                : null}
              {group.choiceInstructions.map((instruction) => (
                <Text key={instruction.label} size='sm'>
                  {instruction.label}
                  {instruction.required
                    ? (
                        <>
                          <span aria-hidden='true'> *</span>
                          <VisuallyHidden> Required</VisuallyHidden>
                        </>
                      )
                    : null}
                </Text>
              ))}
              <CharacterChosenGrantChoices
                allChoices={allChoices}
                choices={choices}
                presentation='controls'
                selections={selections}
                readOnly={readOnly}
                showControlLabels={false}
                onChange={onChange}
              />
            </div>
          </div>
        )
      })}
    </section>
  )
}

function toClassRow(row: CharacterClassRow): CharacterClassRow {
  return row
}

function toClassLevel(value: number | string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1

  return Math.min(20, Math.max(1, Math.trunc(value)))
}
