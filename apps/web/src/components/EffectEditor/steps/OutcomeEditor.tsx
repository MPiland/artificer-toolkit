import { useId, useState } from 'react'
import { ActionIcon, NumberInput, Text, TextInput, Tooltip } from '@mantine/core'
import IEdit from '#assets/icons/IEdit'
import { IExternalLink } from '#assets/icons/IExternalLink'
import ITrash from '#assets/icons/ITrash'
import { AppSelect } from '#app/ui/primitives/Select'
import { integerMinimum, validatorsFor, withFieldGroup } from '#components/Form/runtime'
import { getFieldError } from '#components/Form/runtime/utils/formUtils'
import {
  destructiveActionIcon,
  outcomeActions,
  outcomeCard,
  outcomeGrid,
  outcomePrimaryRow,
  outcomeRollBadge,
  outcomeRowText
} from '../EffectEditor.css'
import type { EffectEditorReferenceData, OutcomeDraft } from '../effectEditor.types'
import { getSelectData, outcomeKindOptions, unitOptions } from '../effectEditor.utils'

type OutcomeEditorFieldGroupValues = {
  outcome: OutcomeDraft
}

const outcomeEditorDefaultValues: OutcomeEditorFieldGroupValues = {
  outcome: {}
}

const emptyReferences: EffectEditorReferenceData = {
  damageTypes: [],
  conditionTypes: [],
  creatures: []
}

export const OutcomeEditor = withFieldGroup({
  defaultValues: outcomeEditorDefaultValues,
  props: {
    references: emptyReferences,
    readOnly: false,
    defaultExpanded: false,
    onRemove: noop
  },
  render: function OutcomeEditorRender({ group, references, readOnly, defaultExpanded, onRemove }) {
    const detailsId = useId()
    const [isExpanded, setIsExpanded] = useState(defaultExpanded ?? false)

    return (
      <group.Subscribe selector={(state) => state.values.outcome}>
        {(outcome) => {
          const kind = String(outcome.effectKind)
          const label = outcomeKindOptions.find((option) => option.value === kind)?.label ?? kind
          const detailsAction = isExpanded ? 'Hide' : readOnly ? 'View' : 'Edit'

          return (
            <article className={outcomeCard}>
              <div className={outcomePrimaryRow}>
                <span className={outcomeRollBadge}>{String(outcome.rollLabel ?? '')}</span>
                <div className={outcomeRowText}>
                  <Text fw={600}>{label}</Text>
                  <Text c='dimmed' size='xs'>{describeOutcome(outcome)}</Text>
                </div>
                <div className={outcomeActions}>
                  <Tooltip label={`${detailsAction} outcome details`}>
                    <ActionIcon
                      aria-label={`${detailsAction} ${label} outcome details`}
                      aria-expanded={isExpanded}
                      aria-controls={detailsId}
                      variant='subtle'
                      onClick={() => setIsExpanded((current) => !current)}
                    >
                      {readOnly ? <IExternalLink size={18} /> : <IEdit size={18} />}
                    </ActionIcon>
                  </Tooltip>
                  {!readOnly
                    ? (
                        <Tooltip label='Remove outcome'>
                          <ActionIcon
                            aria-label={`Remove ${label} outcome`}
                            className={destructiveActionIcon}
                            variant='subtle'
                            onClick={onRemove}
                          >
                            <ITrash size={18} />
                          </ActionIcon>
                        </Tooltip>
                      )
                    : null}
                </div>
              </div>
              {isExpanded
                ? (
                    <div id={detailsId} className={outcomeGrid}>
                      {kind === 'DAMAGE'
                        ? (
                            <>
                              <group.AppField name='outcome.damageTypeId'>
                                {(field) => (
                                  <AppSelect
                                    label='Damage type'
                                    data={getSelectData(references.damageTypes)}
                                    value={toOptionalString(field.state.value)}
                                    error={getFieldError(field)}
                                    disabled={readOnly}
                                    onBlur={field.handleBlur}
                                    onChange={(value) => field.handleChange(value ?? '')}
                                  />
                                )}
                              </group.AppField>
                              <group.AppField name='outcome.diceConfig'>
                                {(field) => (
                                  <TextInput
                                    label='Dice'
                                    value={toStringValue(field.state.value)}
                                    error={getFieldError(field)}
                                    readOnly={readOnly}
                                    onBlur={field.handleBlur}
                                    onChange={(event) => field.handleChange(event.currentTarget.value)}
                                  />
                                )}
                              </group.AppField>
                            </>
                          )
                        : null}
                      {kind === 'CONDITION'
                        ? (
                            <group.AppField name='outcome.conditionId'>
                              {(field) => (
                                <AppSelect
                                  label='Condition'
                                  data={getSelectData(references.conditionTypes)}
                                  value={toOptionalString(field.state.value)}
                                  error={getFieldError(field)}
                                  disabled={readOnly}
                                  onBlur={field.handleBlur}
                                  onChange={(value) => field.handleChange(value ?? '')}
                                />
                              )}
                            </group.AppField>
                          )
                        : null}
                      {kind === 'HEAL'
                        ? (
                            <group.AppField name='outcome.diceConfig'>
                              {(field) => (
                                <TextInput
                                  label='Healing dice'
                                  value={toStringValue(field.state.value)}
                                  error={getFieldError(field)}
                                  readOnly={readOnly}
                                  onBlur={field.handleBlur}
                                  onChange={(event) => field.handleChange(event.currentTarget.value)}
                                />
                              )}
                            </group.AppField>
                          )
                        : null}
                      {kind === 'FORCED_MOVEMENT'
                        ? (
                            <>
                              <group.AppField name='outcome.direction'>
                                {(field) => (
                                  <AppSelect
                                    label='Direction'
                                    data={[
                                      { value: 'AWAY_FROM_SOURCE', label: 'Away from source' },
                                      { value: 'TOWARD_SOURCE', label: 'Toward source' },
                                      { value: 'CHOICE', label: 'Player choice' }
                                    ]}
                                    value={toStringValue(field.state.value, 'AWAY_FROM_SOURCE')}
                                    error={getFieldError(field)}
                                    disabled={readOnly}
                                    onBlur={field.handleBlur}
                                    onChange={(value) => field.handleChange(value ?? 'AWAY_FROM_SOURCE')}
                                  />
                                )}
                              </group.AppField>
                              <group.AppField
                                name='outcome.amount'
                                validators={validatorsFor(integerMinimum('Distance', 1))}
                              >
                                {(field) => (
                                  <NumberInput
                                    label='Distance'
                                    value={toNumberValue(field.state.value, 10)}
                                    error={getFieldError(field)}
                                    disabled={readOnly}
                                    onBlur={field.handleBlur}
                                    onChange={(value) => field.handleChange(typeof value === 'number' ? value : 10)}
                                  />
                                )}
                              </group.AppField>
                            </>
                          )
                        : null}
                      {kind === 'TELEPORT'
                        ? (
                            <>
                              <group.AppField name='outcome.targetKind'>
                                {(field) => (
                                  <AppSelect
                                    label='Target'
                                    data={[
                                      { value: 'SELF', label: 'Self' },
                                      { value: 'TARGET', label: 'Target' },
                                      { value: 'CHOSEN_CREATURES', label: 'Chosen creatures' }
                                    ]}
                                    value={toStringValue(field.state.value, 'TARGET')}
                                    error={getFieldError(field)}
                                    disabled={readOnly}
                                    onBlur={field.handleBlur}
                                    onChange={(value) => field.handleChange(value ?? 'TARGET')}
                                  />
                                )}
                              </group.AppField>
                              <group.AppField name='outcome.destinationKind'>
                                {(field) => (
                                  <AppSelect
                                    label='Destination'
                                    data={[
                                      { value: 'VISIBLE', label: 'Visible point' },
                                      { value: 'SPECIFIED_POINT', label: 'Specified point' },
                                      { value: 'LINKED_LOCATION', label: 'Linked location' },
                                      { value: 'SPECIAL', label: 'Special' }
                                    ]}
                                    value={toStringValue(field.state.value, 'VISIBLE')}
                                    error={getFieldError(field)}
                                    disabled={readOnly}
                                    onBlur={field.handleBlur}
                                    onChange={(value) => field.handleChange(value ?? 'VISIBLE')}
                                  />
                                )}
                              </group.AppField>
                            </>
                          )
                        : null}
                      {kind === 'MANIFEST'
                        ? (
                            <>
                              <group.AppField name='outcome.manifestKind'>
                                {(field) => (
                                  <AppSelect
                                    label='Manifest type'
                                    data={[
                                      { value: 'ZONE', label: 'Zone' },
                                      { value: 'CREATURE', label: 'Creature' },
                                      { value: 'SUMMON', label: 'Summon' },
                                      { value: 'SENSOR', label: 'Sensor' },
                                      { value: 'WEAPON', label: 'Weapon' },
                                      { value: 'OBJECT', label: 'Object' },
                                      { value: 'ILLUSION', label: 'Illusion' }
                                    ]}
                                    value={toStringValue(field.state.value, 'ZONE')}
                                    error={getFieldError(field)}
                                    disabled={readOnly}
                                    onBlur={field.handleBlur}
                                    onChange={(value) => field.handleChange(value ?? 'ZONE')}
                                  />
                                )}
                              </group.AppField>
                              <group.AppField name='outcome.label'>
                                {(field) => (
                                  <TextInput
                                    label='Label'
                                    value={toStringValue(field.state.value)}
                                    error={getFieldError(field)}
                                    readOnly={readOnly}
                                    onBlur={field.handleBlur}
                                    onChange={(event) => field.handleChange(event.currentTarget.value)}
                                  />
                                )}
                              </group.AppField>
                              {outcome.manifestKind === 'CREATURE'
                                ? (
                                    <group.AppField name='outcome.creatureId'>
                                      {(field) => (
                                        <AppSelect
                                          label='Creature'
                                          data={getSelectData(references.creatures)}
                                          value={toOptionalString(field.state.value)}
                                          error={getFieldError(field)}
                                          disabled={readOnly}
                                          onBlur={field.handleBlur}
                                          onChange={(value) => field.handleChange(value ?? undefined)}
                                        />
                                      )}
                                    </group.AppField>
                                  )
                                : null}
                            </>
                          )
                        : null}
                      {kind === 'MOVE_MANIFEST'
                        ? (
                            <>
                              <group.AppField name='outcome.manifestId'>
                                {(field) => (
                                  <TextInput
                                    label='Manifest id'
                                    value={toStringValue(field.state.value)}
                                    error={getFieldError(field)}
                                    readOnly={readOnly}
                                    onBlur={field.handleBlur}
                                    onChange={(event) => field.handleChange(event.currentTarget.value)}
                                  />
                                )}
                              </group.AppField>
                              <group.AppField
                                name='outcome.amount'
                                validators={validatorsFor(integerMinimum('Distance', 1))}
                              >
                                {(field) => (
                                  <NumberInput
                                    label='Distance'
                                    value={toNumberValue(field.state.value, 30)}
                                    error={getFieldError(field)}
                                    disabled={readOnly}
                                    onBlur={field.handleBlur}
                                    onChange={(value) => field.handleChange(typeof value === 'number' ? value : 30)}
                                  />
                                )}
                              </group.AppField>
                            </>
                          )
                        : null}
                      {kind === 'COMMAND_MANIFEST'
                        ? (
                            <group.AppField name='outcome.manifestId'>
                              {(field) => (
                                <TextInput
                                  label='Manifest id'
                                  value={toStringValue(field.state.value)}
                                  error={getFieldError(field)}
                                  readOnly={readOnly}
                                  onBlur={field.handleBlur}
                                  onChange={(event) => field.handleChange(event.currentTarget.value)}
                                />
                              )}
                            </group.AppField>
                          )
                        : null}
                      {kind === 'APPLY_GRANT' || kind === 'RULE'
                        ? (
                            <Text c='dimmed' size='sm'>
                              {kind === 'APPLY_GRANT'
                                ? 'Grant payload is preserved for backend contracts; detailed grant editing lands with supporting feature surfaces.'
                                : 'Rules are engine-readable markers with no extra fields yet.'}
                            </Text>
                          )
                        : null}
                      {kind === 'FORCED_MOVEMENT' || kind === 'MOVE_MANIFEST'
                        ? (
                            <group.AppField name='outcome.unit'>
                              {(field) => (
                                <AppSelect
                                  label='Unit'
                                  data={unitOptions}
                                  value={toStringValue(field.state.value, 'FEET')}
                                  error={getFieldError(field)}
                                  disabled={readOnly}
                                  onBlur={field.handleBlur}
                                  onChange={(value) => field.handleChange(value ?? 'FEET')}
                                />
                              )}
                            </group.AppField>
                          )
                        : null}
                    </div>
                  )
                : null}
            </article>
          )
        }}
      </group.Subscribe>
    )
  }
})

function describeOutcome(outcome: OutcomeDraft) {
  const kind = String(outcome.effectKind)
  if (kind === 'DAMAGE') return 'Damage with type and dice scaling.'
  if (kind === 'CONDITION') return 'Applies a condition when this path resolves.'
  if (kind === 'HEAL') return 'Restores hit points or temporary hit points.'
  if (kind === 'FORCED_MOVEMENT') return 'Pushes, pulls, or otherwise moves the target.'
  if (kind === 'TELEPORT') return 'Teleports the selected target instantly.'
  if (kind === 'MANIFEST') return 'Creates a summon, zone, sensor, object, or illusion.'
  if (kind === 'APPLY_GRANT') return 'Applies modifier, proficiency, and sense grants.'
  if (kind === 'RULE') return 'Adds custom rule text.'
  return 'Configure this outcome.'
}

function toOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function toNumberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' ? value : fallback
}

function noop(): void {}
