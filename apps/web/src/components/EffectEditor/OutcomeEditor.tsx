import { useId, useState } from 'react'
import { ActionIcon, NumberInput, Text, TextInput, Tooltip } from '@mantine/core'
import IEdit from '#assets/icons/IEdit'
import { IExternalLink } from '#assets/icons/IExternalLink'
import { IMinus } from '#assets/icons/IMinus'
import { AppSelect } from '#components/Select'
import {
  destructiveActionIcon,
  outcomeActions,
  outcomeCard,
  outcomeGrid,
  outcomePrimaryRow,
  outcomeRollBadge,
  outcomeRowText
} from './EffectEditor.css'
import type { EffectEditorReferenceData, OutcomeDraft } from './effectEditor.types'
import { getSelectData, outcomeKindOptions, unitOptions } from './effectEditor.utils'

export function OutcomeEditor({
  outcome,
  references,
  readOnly,
  defaultExpanded,
  onChange,
  onRemove
}: {
  outcome: OutcomeDraft
  references: EffectEditorReferenceData
  readOnly?: boolean
  defaultExpanded?: boolean
  onChange: (outcome: OutcomeDraft) => void
  onRemove: () => void
}) {
  const detailsId = useId()
  const [isExpanded, setIsExpanded] = useState(defaultExpanded ?? false)
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
                    <IMinus size={18} />
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
                      <AppSelect
                        label='Damage type'
                        data={getSelectData(references.damageTypes)}
                        value={String(outcome.damageTypeId ?? '')}
                        disabled={readOnly}
                        onChange={(value) => onChange({ ...outcome, damageTypeId: value ?? '' })}
                      />
                      <TextInput
                        label='Dice'
                        value={String(outcome.diceConfig ?? '')}
                        readOnly={readOnly}
                        onChange={(event) => onChange({ ...outcome, valueKind: 'DICE', scalingKind: 'NONE', diceConfig: event.currentTarget.value })}
                      />
                    </>
                  )
                : null}
              {kind === 'CONDITION'
                ? (
                    <AppSelect
                      label='Condition'
                      data={getSelectData(references.conditionTypes)}
                      value={String(outcome.conditionId ?? '')}
                      disabled={readOnly}
                      onChange={(value) => onChange({ ...outcome, conditionId: value ?? '' })}
                    />
                  )
                : null}
              {kind === 'HEAL'
                ? (
                    <TextInput
                      label='Healing dice'
                      value={String(outcome.diceConfig ?? '')}
                      readOnly={readOnly}
                      onChange={(event) => onChange({ ...outcome, valueKind: 'DICE', scalingKind: 'NONE', diceConfig: event.currentTarget.value })}
                    />
                  )
                : null}
              {kind === 'FORCED_MOVEMENT'
                ? (
                    <>
                      <AppSelect
                        label='Direction'
                        data={[
                          { value: 'AWAY_FROM_SOURCE', label: 'Away from source' },
                          { value: 'TOWARD_SOURCE', label: 'Toward source' },
                          { value: 'CHOICE', label: 'Player choice' }
                        ]}
                        value={String(outcome.direction ?? 'AWAY_FROM_SOURCE')}
                        disabled={readOnly}
                        onChange={(value) => onChange({ ...outcome, direction: value ?? 'AWAY_FROM_SOURCE' })}
                      />
                      <NumberInput
                        label='Distance'
                        value={Number(outcome.amount ?? 10)}
                        disabled={readOnly}
                        onChange={(value) => onChange({ ...outcome, amount: typeof value === 'number' ? value : 10 })}
                      />
                    </>
                  )
                : null}
              {kind === 'TELEPORT'
                ? (
                    <>
                      <AppSelect
                        label='Target'
                        data={[
                          { value: 'SELF', label: 'Self' },
                          { value: 'TARGET', label: 'Target' },
                          { value: 'CHOSEN_CREATURES', label: 'Chosen creatures' }
                        ]}
                        value={String(outcome.targetKind ?? 'TARGET')}
                        disabled={readOnly}
                        onChange={(value) => onChange({ ...outcome, targetKind: value ?? 'TARGET' })}
                      />
                      <AppSelect
                        label='Destination'
                        data={[
                          { value: 'VISIBLE', label: 'Visible point' },
                          { value: 'SPECIFIED_POINT', label: 'Specified point' },
                          { value: 'LINKED_LOCATION', label: 'Linked location' },
                          { value: 'SPECIAL', label: 'Special' }
                        ]}
                        value={String(outcome.destinationKind ?? 'VISIBLE')}
                        disabled={readOnly}
                        onChange={(value) => onChange({ ...outcome, destinationKind: value ?? 'VISIBLE' })}
                      />
                    </>
                  )
                : null}
              {kind === 'MANIFEST'
                ? (
                    <>
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
                        value={String(outcome.manifestKind ?? 'ZONE')}
                        disabled={readOnly}
                        onChange={(value) => onChange({ ...outcome, manifestKind: value ?? 'ZONE' })}
                      />
                      <TextInput
                        label='Label'
                        value={String(outcome.label ?? '')}
                        readOnly={readOnly}
                        onChange={(event) => onChange({ ...outcome, label: event.currentTarget.value })}
                      />
                      {outcome.manifestKind === 'CREATURE'
                        ? (
                            <AppSelect
                              label='Creature'
                              data={getSelectData(references.creatures)}
                              value={String(outcome.creatureId ?? '')}
                              disabled={readOnly}
                              onChange={(value) => onChange({ ...outcome, creatureId: value ?? undefined })}
                            />
                          )
                        : null}
                    </>
                  )
                : null}
              {kind === 'MOVE_MANIFEST'
                ? (
                    <>
                      <TextInput
                        label='Manifest id'
                        value={String(outcome.manifestId ?? '')}
                        readOnly={readOnly}
                        onChange={(event) => onChange({ ...outcome, manifestId: event.currentTarget.value })}
                      />
                      <NumberInput
                        label='Distance'
                        value={Number(outcome.amount ?? 30)}
                        disabled={readOnly}
                        onChange={(value) => onChange({ ...outcome, amount: typeof value === 'number' ? value : 30 })}
                      />
                    </>
                  )
                : null}
              {kind === 'COMMAND_MANIFEST'
                ? (
                    <TextInput
                      label='Manifest id'
                      value={String(outcome.manifestId ?? '')}
                      readOnly={readOnly}
                      onChange={(event) => onChange({ ...outcome, manifestId: event.currentTarget.value })}
                    />
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
                    <AppSelect
                      label='Unit'
                      data={unitOptions}
                      value={String(outcome.unit ?? 'FEET')}
                      disabled={readOnly}
                      onChange={(value) => onChange({ ...outcome, unit: value ?? 'FEET' })}
                    />
                  )
                : null}
            </div>
          )
        : null}
    </article>
  )
}

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
