import { useState } from 'react'
import { Button, Menu, Stack, Text, TextInput } from '@mantine/core'
import type { PathDto } from '@artificer-toolkit/schema'
import { AppSelect } from '#app/ui/primitives/Select'
import { dieConfig, requiredSelect, validatorsFor, withFieldGroup } from '#components/Form/runtime'
import { getFieldError } from '#components/Form/runtime/utils/formUtils'
import { EffectCollapse } from '../components/EffectCollapse'
import { OutcomeEditorItem } from './OutcomeEditorItem'
import {
  editorGrid,
  outcomeAddButton,
  outcomeList,
  outcomeMenuDropdown,
  outcomeMenuItem,
  pathStatus,
  pathSummaryRow
} from '../EffectEditor.css'
import type { EffectEditorReferenceData, FixedPathDto, OutcomeDraft } from '../effectEditor.types'
import { isFixedPath } from '../effectEditor.types'
import {
  createDefaultPath,
  createOutcome,
  createPathForSelection,
  getPathOutcomes,
  outcomeKindGroups,
  pathCodeOptions
} from '../effectEditor.utils'

type PathEditorFieldGroupValues = {
  path: PathDto
}

const pathDefaultValues: PathEditorFieldGroupValues = {
  path: createDefaultPath(1)
}

const emptyReferences: EffectEditorReferenceData = {
  damageTypes: [],
  conditionTypes: [],
  creatures: []
}

const selectionKindOptions = [
  { value: 'FIXED', label: 'Fixed result' },
  { value: 'CHOICE', label: 'Choice (coming soon)', disabled: true },
  { value: 'ROLL_TABLE', label: 'Roll table (coming soon)', disabled: true }
] satisfies Array<{ value: PathDto['selectionKind'], label: string, disabled?: boolean }>

export const PathEditor = withFieldGroup({
  defaultValues: pathDefaultValues,
  props: {
    references: emptyReferences,
    readOnly: false
  },
  render: function PathEditorRender({ group, references, readOnly }) {
    const [expandedOutcomeId, setExpandedOutcomeId] = useState<string | null>(null)

    return (
      <group.Subscribe selector={(state) => state.values.path}>
        {(path) => {
          const outcomes = getPathOutcomes(path)

          return (
            <Stack gap={16}>
              <EffectCollapse title='Path Basics' id='path-basics-heading'>
                <div className={editorGrid}>
                  <group.AppField
                    name='path.pathCode'
                    validators={validatorsFor(requiredSelect('Path'))}
                  >
                    {(field) => (
                      <AppSelect
                        label='Path'
                        data={pathCodeOptions}
                        value={field.state.value}
                        error={getFieldError(field)}
                        disabled={readOnly}
                        onBlur={field.handleBlur}
                        onChange={(value) => field.handleChange(toPathCode(value))}
                      />
                    )}
                  </group.AppField>
                  <group.AppField
                    name='path.selectionKind'
                    validators={validatorsFor(requiredSelect('How results resolve'))}
                  >
                    {(field) => (
                      <AppSelect
                        label='How results resolve'
                        data={selectionKindOptions}
                        value={field.state.value}
                        error={getFieldError(field)}
                        disabled={readOnly}
                        onBlur={field.handleBlur}
                        onChange={(value) => {
                          group.setFieldValue('path', createPathForSelection({
                            id: path.id,
                            order: path.order,
                            pathCode: path.pathCode,
                            selectionKind: toSelectionKind(value)
                          }))
                        }}
                      />
                    )}
                  </group.AppField>
                  {path.selectionKind === 'ROLL_TABLE'
                    ? (
                        <group.AppField
                          name='path.dieConfig'
                          validators={validatorsFor(dieConfig('Die'))}
                        >
                          {(field) => (
                            <TextInput
                              label='Die'
                              value={field.state.value ?? '1d100'}
                              error={getFieldError(field)}
                              readOnly={readOnly}
                              onBlur={field.handleBlur}
                              onChange={(event) => field.handleChange(event.currentTarget.value)}
                            />
                          )}
                        </group.AppField>
                      )
                    : null}
                </div>
              </EffectCollapse>

              <EffectCollapse title='Outcomes' id='outcomes-heading'>
                <div className={pathSummaryRow}>
                  <Stack gap={2}>
                    <Text fw={600}>{pathCodeOptions.find((option) => option.value === path.pathCode)?.label ?? path.pathCode}</Text>
                    <Text c='dimmed' size='sm'>Configure the results this path applies when it resolves.</Text>
                  </Stack>
                  <Text className={pathStatus}>
                    {path.selectionKind.replace('_', ' ').toLowerCase()}
                    {' '}
                    / path
                  </Text>
                </div>

                {isFixedPath(path)
                  ? (
                      <>
                        {outcomes.length === 0
                          ? (
                              <Text c='dimmed' size='sm'>No outcomes yet.</Text>
                            )
                          : (
                              <div className={outcomeList}>
                                {outcomes.map((outcome, index) => (
                                  <OutcomeEditorItem
                                    key={String(outcome.id)}
                                    outcome={outcome}
                                    references={references}
                                    readOnly={readOnly}
                                    defaultExpanded={expandedOutcomeId === String(outcome.id)}
                                    onChange={(nextOutcome) => {
                                      group.setFieldValue('path', replaceOutcome(path, index, nextOutcome))
                                    }}
                                    onRemove={() => {
                                      group.setFieldValue('path', removeOutcome(path, index))
                                    }}
                                  />
                                ))}
                              </div>
                            )}
                        {!readOnly
                          ? (
                              <Menu shadow='md' width={260} position='top-start'>
                                <Menu.Target>
                                  <Button className={outcomeAddButton}>+ Add outcome</Button>
                                </Menu.Target>
                                <Menu.Dropdown className={outcomeMenuDropdown}>
                                  {outcomeKindGroups.map((outcomeGroup) => (
                                    <div key={outcomeGroup.label}>
                                      <Menu.Label>{outcomeGroup.label}</Menu.Label>
                                      {outcomeGroup.options.map((option) => (
                                        <Menu.Item
                                          key={option.value}
                                          onClick={() => {
                                            const nextOutcome = createOutcome(option.value, references)
                                            setExpandedOutcomeId(typeof nextOutcome.id === 'string' ? nextOutcome.id : null)
                                            group.setFieldValue('path', appendOutcome(path, nextOutcome))
                                          }}
                                        >
                                          <span className={outcomeMenuItem}>
                                            <Text size='sm'>{option.label}</Text>
                                            <Text size='xs' c='dimmed'>{option.description}</Text>
                                          </span>
                                        </Menu.Item>
                                      ))}
                                    </div>
                                  ))}
                                </Menu.Dropdown>
                              </Menu>
                            )
                          : null}
                      </>
                    )
                  : (
                      <Text c='dimmed' size='sm'>
                        This path type is preserved in the DTO. Detailed choice and roll-table row editing will use this same outcome row pattern.
                      </Text>
                    )}
              </EffectCollapse>
            </Stack>
          )
        }}
      </group.Subscribe>
    )
  }
})

function replaceOutcome(path: FixedPathDto, index: number, outcome: OutcomeDraft): PathDto {
  return {
    ...path,
    resultBlock: {
      ...path.resultBlock,
      outcomes: path.resultBlock.outcomes.map((item, itemIndex) => itemIndex === index ? outcome : item)
    }
  }
}

function removeOutcome(path: FixedPathDto, index: number): PathDto {
  return {
    ...path,
    resultBlock: {
      ...path.resultBlock,
      outcomes: path.resultBlock.outcomes.filter((_item, itemIndex) => itemIndex !== index)
    }
  }
}

function appendOutcome(path: FixedPathDto, outcome: OutcomeDraft): PathDto {
  return {
    ...path,
    resultBlock: {
      ...path.resultBlock,
      outcomes: [...path.resultBlock.outcomes, outcome]
    }
  }
}

function toPathCode(value: string | null): PathDto['pathCode'] {
  return pathCodeOptions.find((option) => option.value === value)?.value ?? 'ON_USE'
}

function toSelectionKind(value: string | null): PathDto['selectionKind'] {
  return selectionKindOptions.find((option) => option.value === value)?.value ?? 'FIXED'
}
