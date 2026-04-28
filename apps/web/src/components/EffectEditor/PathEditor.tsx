import { useState } from 'react'
import { Button, Menu, Stack, Text, TextInput } from '@mantine/core'
import type { PathDto } from '@artificer-toolkit/schema'
import { AppSelect } from '#components/Select'
import { EffectCollapse } from './EffectCollapse'
import { OutcomeEditor } from './OutcomeEditor'
import {
  editorGrid,
  outcomeAddButton,
  outcomeList,
  outcomeMenuDropdown,
  outcomeMenuItem,
  pathStatus,
  pathSummaryRow
} from './EffectEditor.css'
import type { EffectEditorReferenceData, OutcomeDraft } from './effectEditor.types'
import { isFixedPath } from './effectEditor.types'
import {
  createOutcome,
  createPathForSelection,
  getPathOutcomes,
  outcomeKindGroups,
  pathCodeOptions
} from './effectEditor.utils'

export function PathEditor({
  path,
  references,
  readOnly,
  onChange
}: {
  path: PathDto
  references: EffectEditorReferenceData
  readOnly?: boolean
  onChange: (path: PathDto) => void
}) {
  const outcomes = getPathOutcomes(path)
  const [expandedOutcomeId, setExpandedOutcomeId] = useState<string | null>(null)

  function updateFixedOutcomes(nextOutcomes: OutcomeDraft[]) {
    if (!isFixedPath(path)) return

    onChange({
      ...path,
      resultBlock: {
        ...path.resultBlock,
        outcomes: nextOutcomes
      }
    } as PathDto)
  }

  return (
    <Stack gap={16}>
      <EffectCollapse title='Path Basics' id='path-basics-heading'>
        <div className={editorGrid}>
          <AppSelect
            label='Path'
            data={pathCodeOptions}
            value={path.pathCode}
            disabled={readOnly}
            onChange={(value) => onChange({ ...path, pathCode: toPathCode(value) } as PathDto)}
          />
          <AppSelect
            label='How results resolve'
            data={[
              { value: 'FIXED', label: 'Fixed result' },
              { value: 'CHOICE', label: 'Choice (coming soon)', disabled: true },
              { value: 'ROLL_TABLE', label: 'Roll table (coming soon)', disabled: true }
            ]}
            value={path.selectionKind}
            disabled={readOnly}
            onChange={(value) => {
              onChange(createPathForSelection({
                id: path.id,
                order: path.order,
                pathCode: path.pathCode,
                selectionKind: (value ?? 'FIXED') as 'FIXED' | 'CHOICE' | 'ROLL_TABLE'
              }))
            }}
          />
          {path.selectionKind === 'ROLL_TABLE'
            ? (
                <TextInput
                  label='Die'
                  value={'dieConfig' in path ? path.dieConfig : '1d100'}
                  readOnly={readOnly}
                  onChange={(event) => onChange({ ...path, dieConfig: event.currentTarget.value } as PathDto)}
                />
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
                          <OutcomeEditor
                            key={String(outcome.id)}
                            outcome={{
                              ...outcome,
                              rollLabel: outcome.rollLabel ?? formatOutcomeBadge(index, path.selectionKind)
                            }}
                            references={references}
                            readOnly={readOnly}
                            defaultExpanded={expandedOutcomeId === String(outcome.id)}
                            onChange={(next) => updateFixedOutcomes(outcomes.map((item, itemIndex) => itemIndex === index ? next : item))}
                            onRemove={() => updateFixedOutcomes(outcomes.filter((item) => item.id !== outcome.id))}
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
                          {outcomeKindGroups.map((group) => (
                            <div key={group.label}>
                              <Menu.Label>{group.label}</Menu.Label>
                              {group.options.map((option) => (
                                <Menu.Item
                                  key={option.value}
                                  onClick={() => {
                                    const nextOutcome = createOutcome(option.value, references)
                                    setExpandedOutcomeId(typeof nextOutcome.id === 'string' ? nextOutcome.id : null)
                                    updateFixedOutcomes([...outcomes, nextOutcome])
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
}

function formatOutcomeBadge(index: number, selectionKind: PathDto['selectionKind']) {
  if (selectionKind !== 'ROLL_TABLE') return ''
  const start = index * 10
  return `${start}-${start + 10}`
}

function toPathCode(value: string | null): PathDto['pathCode'] {
  return pathCodeOptions.find((option) => option.value === value)?.value ?? 'ON_USE'
}
