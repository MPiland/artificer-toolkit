import {
  ActionIcon,
  Alert,
  Button,
  Drawer,
  Group,
  Indicator,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Text,
  Tooltip
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { CircleHelp } from 'lucide-react'
import { useEffect, useState } from 'react'
import type {
  EncounterGmProjectionDto,
  EncounterCommandResultDto,
  EncounterPlayerProjectionDto,
  ResolveRuleOccurrenceInputDto,
  VoidRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { initiativeDeclarationSelectionDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import {
  adjudicationSelectionValues,
  decisionTitle,
  type InitiativeDeclarationAdjudicationValues
} from './CampaignTabletopDecisionDrawer.model'

export function CampaignTabletopDecisionDrawer({
  canVoid,
  connected,
  encounter,
  pending,
  submitting,
  onResolve
}: {
  /** The GM may void a stuck decision. */
  canVoid: boolean
  connected: boolean
  encounter: EncounterGmProjectionDto | EncounterPlayerProjectionDto
  pending: PendingEncounterRuleOccurrenceSummaryDto
  submitting: boolean
  onResolve: (
    command: ResolveRuleOccurrenceInputDto | VoidRuleOccurrenceInputDto
  ) => Promise<EncounterCommandResultDto>
}) {
  const [opened, { close, open }] = useDisclosure(false)
  const [localPending, setLocalPending] = useState(false)
  const [firstFace, setFirstFace] = useState<number | string>('')
  const [secondFace, setSecondFace] = useState<number | string>('')
  const [integerValue, setIntegerValue] = useState<number | string>('')
  const [primaryOptionId, setPrimaryOptionId] = useState<string | null>(null)
  const [bonusOptionId, setBonusOptionId] = useState<string | null>(null)
  const [adjudicationValues, setAdjudicationValues] =
    useState<InitiativeDeclarationAdjudicationValues>({})
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const disabled = !connected || submitting || localPending

  useEffect(() => {
    setFirstFace('')
    setSecondFace('')
    setIntegerValue('')
    setPrimaryOptionId(null)
    setBonusOptionId(null)
    setAdjudicationValues({})
    setFeedback(null)
    setError(null)
  }, [pending.occurrenceId, pending.occurrenceVersion])

  async function resolve(
    resolution: ResolveRuleOccurrenceInputDto['resolution'] | 'VOID'
  ): Promise<void> {
    if (disabled) return
    setLocalPending(true)
    setFeedback(null)
    setError(null)
    const target = {
      encounterId: encounter.id,
      commandId: crypto.randomUUID(),
      expectedVersion: pending.encounterVersion,
      occurrenceId: pending.occurrenceId,
      expectedOccurrenceVersion: pending.occurrenceVersion
    }
    try {
      const result = await onResolve(
        resolution === 'VOID'
          ? { type: 'VOID_RULE_OCCURRENCE', ...target }
          : { type: 'RESOLVE_RULE_OCCURRENCE', ...target, correlationId: null, resolution }
      )
      setFeedback(
        result.occurrence?.status === 'PENDING'
          ? 'Decision recorded. Another decision is ready.'
          : resolution === 'VOID'
            ? 'Decision voided.'
            : 'Decision resolved.'
      )
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : 'The decision could not be resolved.'
      )
    } finally {
      setLocalPending(false)
    }
  }

  return (
    <>
      <Tooltip label='Pending decision'>
        <Indicator color='orange' size={8}>
          <ActionIcon aria-label='Open pending decision' size='lg' variant='filled' onClick={open}>
            <CircleHelp aria-hidden size={18} />
          </ActionIcon>
        </Indicator>
      </Tooltip>
      <Drawer
        closeButtonProps={{ 'aria-label': 'Close pending decision' }}
        opened={opened}
        position='right'
        size='min(30rem, 100vw)'
        title='Pending decision'
        zIndex={410}
        onClose={close}
      >
        <Stack gap='md' aria-busy={localPending || undefined}>
          <div>
            <Text fw={650}>
              {pending.kind === 'OPTIONAL_COMBAT_CLEAVING'
                ? 'Cleaving choice'
                : decisionTitle(pending.kind)}
            </Text>
            <Text c='dimmed' size='sm'>
              This choice is durable. Reconnecting returns to the same decision.
            </Text>
          </div>
          {!connected ? (
            <Alert color='yellow'>Decision controls will return when live play reconnects.</Alert>
          ) : null}
          {pending.kind === 'D20_EVIDENCE' ? (
            <>
              <Text size='sm'>Roll mode: {pending.request.rollMode.toLowerCase()}</Text>
              <Group grow>
                <NumberInput
                  disabled={disabled}
                  label='Die 1'
                  min={1}
                  max={20}
                  value={firstFace}
                  onChange={setFirstFace}
                />
                {pending.request.rollMode === 'NORMAL' ? null : (
                  <NumberInput
                    disabled={disabled}
                    label='Die 2'
                    min={1}
                    max={20}
                    value={secondFace}
                    onChange={setSecondFace}
                  />
                )}
              </Group>
              <Group>
                <Button
                  disabled={disabled}
                  onClick={() =>
                    void resolve({ kind: 'SYSTEM_ROLL', requestId: pending.request.requestId })
                  }
                >
                  Roll in VTT
                </Button>
                <Button
                  disabled={
                    disabled ||
                    typeof firstFace !== 'number' ||
                    (pending.request.rollMode !== 'NORMAL' && typeof secondFace !== 'number')
                  }
                  variant='default'
                  onClick={() =>
                    typeof firstFace === 'number' &&
                    void resolve({
                      kind: 'ENTER_DICE',
                      requestId: pending.request.requestId,
                      rawFaces:
                        pending.request.rollMode === 'NORMAL' || typeof secondFace !== 'number'
                          ? [firstFace]
                          : [firstFace, secondFace]
                    })
                  }
                >
                  Submit physical roll
                </Button>
              </Group>
            </>
          ) : pending.kind === 'INITIATIVE_EVIDENCE' ||
            pending.kind === 'RECHARGE_EVIDENCE' ||
            pending.kind === 'ACTION_OUTCOME_EVIDENCE' ? (
            <>
              <NumberInput
                disabled={disabled}
                label='Result'
                min={pending.request.min}
                max={pending.request.max}
                value={integerValue}
                onChange={setIntegerValue}
              />
              <Group>
                <Button
                  disabled={disabled}
                  onClick={() =>
                    void resolve({ kind: 'SYSTEM_ROLL', requestId: pending.request.requestId })
                  }
                >
                  Roll in VTT
                </Button>
                <Button
                  disabled={disabled || typeof integerValue !== 'number'}
                  variant='default'
                  onClick={() =>
                    typeof integerValue === 'number' &&
                    void resolve({
                      kind: 'ENTER_INTEGER',
                      requestId: pending.request.requestId,
                      value: integerValue
                    })
                  }
                >
                  Submit result
                </Button>
              </Group>
            </>
          ) : pending.kind === 'MOVEMENT_REACTION' ? (
            <Stack gap='xs'>
              {pending.choice.options.map((option) => (
                <Button
                  disabled={disabled}
                  key={option.optionId}
                  onClick={() => void resolve({ kind: 'OPTION', optionId: option.optionId })}
                >
                  Use {option.actionId}
                </Button>
              ))}
              <Button
                disabled={disabled}
                variant='default'
                onClick={() => void resolve({ kind: 'DECLINE' })}
              >
                Decline reaction
              </Button>
            </Stack>
          ) : pending.kind === 'MOVEMENT_PASSAGE_CHOICE' ? (
            <Stack gap='xs'>
              {pending.options.map((option) => (
                <Button
                  disabled={disabled}
                  key={option.optionId}
                  onClick={() =>
                    void resolve({ kind: 'PASSAGE_OPTION', optionId: option.optionId })
                  }
                >
                  {option.ruleKind === 'OVERRUN' ? 'Overrun' : 'Tumble'} ·{' '}
                  {option.economy === 'ACTION' ? 'Action' : 'Bonus action'}
                </Button>
              ))}
              <Button
                disabled={disabled}
                variant='default'
                onClick={() => void resolve({ kind: 'PASSAGE_DECLINE' })}
              >
                Decline passage
              </Button>
            </Stack>
          ) : pending.kind === 'LEGENDARY_RESISTANCE_CHOICE' ? (
            <Group>
              <Button
                disabled={disabled}
                onClick={() =>
                  void resolve({ kind: 'OPTION', optionId: pending.options[0].optionId })
                }
              >
                Use resistance
              </Button>
              <Button
                disabled={disabled}
                variant='default'
                onClick={() => void resolve({ kind: 'DECLINE' })}
              >
                Decline
              </Button>
            </Group>
          ) : pending.kind === 'LEGENDARY_ACTION_CHOICE' ? (
            <Stack gap='xs'>
              {pending.options.map((option) => (
                <Button
                  disabled={disabled}
                  key={option.optionId}
                  onClick={() => void resolve({ kind: 'OPTION', optionId: option.optionId })}
                >
                  {option.actionId} ·{' '}
                  {encounter.actors.find((actor) => actor.id === option.targetActorId)?.label ??
                    'Target'}
                </Button>
              ))}
              <Button
                disabled={disabled}
                variant='default'
                onClick={() => void resolve({ kind: 'DECLINE' })}
              >
                Pass
              </Button>
            </Stack>
          ) : pending.kind === 'OPTIONAL_COMBAT_CLEAVING' ? (
            <Stack gap='xs'>
              {pending.options.map((option) => (
                <Button
                  disabled={disabled}
                  key={option.optionId}
                  onClick={() => void resolve({ kind: 'OPTION', optionId: option.optionId })}
                >
                  Cleave{' '}
                  {encounter.actors.find((actor) => actor.id === option.targetActorId)?.label ??
                    'Target'}
                </Button>
              ))}
              <Button
                disabled={disabled}
                variant='default'
                onClick={() => void resolve({ kind: 'DECLINE' })}
              >
                Decline cleaving
              </Button>
            </Stack>
          ) : pending.kind === 'INITIATIVE_ORDER' ? (
            <Stack gap='xs'>
              {pending.optionIds.map((optionId) => (
                <Button
                  disabled={disabled}
                  key={optionId}
                  onClick={() =>
                    void resolve({
                      kind: 'INITIATIVE_ENTITY',
                      requestId: pending.requestId,
                      entityId: optionId
                    })
                  }
                >
                  {encounter.actors.find((actor) => actor.id === optionId)?.label ?? optionId}
                </Button>
              ))}
            </Stack>
          ) : pending.kind === 'INITIATIVE_DECLARATION' ? (
            <InitiativeDeclarationControls
              adjudicationValues={adjudicationValues}
              bonusOptionId={bonusOptionId}
              disabled={disabled}
              pending={pending}
              primaryOptionId={primaryOptionId}
              onAdjudicationValuesChange={setAdjudicationValues}
              onBonusOptionIdChange={setBonusOptionId}
              onPrimaryOptionIdChange={setPrimaryOptionId}
              onSubmit={(resolution) => void resolve(resolution)}
            />
          ) : null}
          {canVoid ? (
            <Stack gap={4}>
              <Button
                color='red'
                disabled={disabled}
                variant='subtle'
                onClick={() => void resolve('VOID')}
              >
                Void decision
              </Button>
              <Text c='dimmed' size='xs'>
                Cancels a paused action or declines an optional choice. Rolls play can't continue
                without stay open.
              </Text>
            </Stack>
          ) : null}
          {feedback ? (
            <Alert aria-live='polite' color='green'>
              {feedback}
            </Alert>
          ) : null}
          {error ? (
            <Alert aria-live='assertive' color='red'>
              {error}
            </Alert>
          ) : null}
        </Stack>
      </Drawer>
    </>
  )
}

function InitiativeDeclarationControls({
  adjudicationValues,
  bonusOptionId,
  disabled,
  pending,
  primaryOptionId,
  onAdjudicationValuesChange,
  onBonusOptionIdChange,
  onPrimaryOptionIdChange,
  onSubmit
}: {
  adjudicationValues: InitiativeDeclarationAdjudicationValues
  bonusOptionId: string | null
  disabled: boolean
  pending: Extract<PendingEncounterRuleOccurrenceSummaryDto, { kind: 'INITIATIVE_DECLARATION' }>
  primaryOptionId: string | null
  onAdjudicationValuesChange: (value: InitiativeDeclarationAdjudicationValues) => void
  onBonusOptionIdChange: (value: string | null) => void
  onPrimaryOptionIdChange: (value: string | null) => void
  onSubmit: (resolution: ResolveRuleOccurrenceInputDto['resolution']) => void
}) {
  const primary =
    pending.primaryOptions.find((option) => option.optionId === primaryOptionId) ?? null
  const bonus = pending.bonusOptions.find((option) => option.optionId === bonusOptionId) ?? null
  const needsAdjudication = primary?.kind === 'GM_ADJUDICATED' || bonus?.kind === 'GM_ADJUDICATED'

  function selection(option: NonNullable<typeof primary>) {
    if (option.kind !== 'GM_ADJUDICATED') return { kind: option.kind, optionId: option.optionId }
    const parsed = initiativeDeclarationSelectionDtoSchema.safeParse({
      kind: 'GM_ADJUDICATED' as const,
      optionId: 'GM_ADJUDICATED' as const,
      ...adjudicationSelectionValues(pending.adjudicationFields, adjudicationValues)
    })
    return parsed.success ? parsed.data : null
  }

  const primarySelection = primary ? selection(primary) : null
  const bonusSelection = bonus ? selection(bonus) : null
  const canSubmit = primarySelection !== null && (bonus === null || bonusSelection !== null)

  return (
    <Stack gap='sm'>
      <Select
        data={pending.primaryOptions.map((option) => ({
          value: option.optionId,
          label: option.label
        }))}
        disabled={disabled}
        label='Primary action'
        value={primaryOptionId}
        onChange={onPrimaryOptionIdChange}
      />
      <Select
        clearable
        data={pending.bonusOptions.map((option) => ({
          value: option.optionId,
          label: option.label
        }))}
        disabled={disabled}
        label='Bonus action'
        value={bonusOptionId}
        onChange={onBonusOptionIdChange}
      />
      {needsAdjudication ? (
        <>
          {pending.adjudicationFields.map((field) => {
            const value = adjudicationValues[field.key]
            if (field.kind === 'SELECT') {
              return (
                <Select
                  data={field.options}
                  disabled={disabled}
                  key={field.key}
                  label={field.label}
                  value={typeof value === 'string' ? value : null}
                  onChange={(nextValue) =>
                    onAdjudicationValuesChange({ ...adjudicationValues, [field.key]: nextValue })
                  }
                />
              )
            }
            if (field.kind === 'MULTI_SELECT') {
              return (
                <MultiSelect
                  data={field.options}
                  disabled={disabled}
                  key={field.key}
                  label={field.label}
                  maxValues={field.maximumSelections}
                  value={Array.isArray(value) ? value : []}
                  onChange={(nextValue) =>
                    onAdjudicationValuesChange({ ...adjudicationValues, [field.key]: nextValue })
                  }
                />
              )
            }
            return (
              <NumberInput
                disabled={disabled}
                key={field.key}
                label={field.label}
                max={field.maximum}
                min={field.minimum}
                value={typeof value === 'number' ? value : ''}
                onChange={(nextValue) =>
                  onAdjudicationValuesChange({
                    ...adjudicationValues,
                    [field.key]: typeof nextValue === 'number' ? nextValue : null
                  })
                }
              />
            )
          })}
        </>
      ) : null}
      <Button
        disabled={disabled || !canSubmit}
        onClick={() => {
          if (!primary) return
          if (!primarySelection) return
          if (bonus && !bonusSelection) return
          onSubmit({
            kind: 'INITIATIVE_DECLARATION',
            requestId: pending.requestId,
            primary: primarySelection,
            bonus: bonusSelection
          })
        }}
      >
        Declare actions
      </Button>
    </Stack>
  )
}
