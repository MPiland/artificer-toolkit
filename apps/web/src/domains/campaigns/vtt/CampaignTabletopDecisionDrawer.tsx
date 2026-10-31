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
import { useState } from 'react'
import type {
  EncounterD20RollModeDto,
  EncounterEvidenceRollDto,
  EncounterGmProjectionDto,
  EncounterCommandResultDto,
  EncounterPlayerProjectionDto,
  RemoveAreaTargetInputDto,
  ResolveRuleOccurrenceInputDto,
  RollRuleEvidenceInputDto,
  VoidRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { initiativeDeclarationSelectionDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import { MOVEMENT_DECISION_SKIPPED_MESSAGE } from '@artificer-toolkit/schema/api/campaignCommunication'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import {
  adjudicationSelectionValues,
  contestCheckEvidence,
  decisionTitle,
  onHitChoiceTitle,
  onHitOptionLabel,
  movementPassageOptionLabel,
  rollPromptText,
  type InitiativeDeclarationAdjudicationValues
} from './CampaignTabletopDecisionDrawer.model'
import { GmRollVisibilityToggle } from '#app/components/dice/GmRollVisibilityToggle'
import { useGmRollVisibilityPreference } from '#app/settings/useGmRollVisibilityPreference'
import { CampaignTabletopEvidenceRollRow } from './CampaignTabletopEvidenceRollRow'

export function CampaignTabletopDecisionDrawer({
  canVoid,
  connected,
  encounter,
  latestRoll,
  pending,
  skipped,
  submitting,
  onResolve
}: {
  /** The GM may void a stuck decision and chooses whether their rolls are Public or Private. */
  canVoid: boolean
  connected: boolean
  encounter: EncounterGmProjectionDto | EncounterPlayerProjectionDto
  /** The viewer's latest "Roll dice" attempt for this decision's request, if any. */
  latestRoll: EncounterEvidenceRollDto | null
  pending: PendingEncounterRuleOccurrenceSummaryDto
  /**
   * Set once the GM skipped this decision after it was shown (D39): the drawer says so instead of
   * asking, and closing it dismisses the decision.
   */
  skipped: { onDismiss: () => void } | null
  submitting: boolean
  onResolve: (
    command:
      | RemoveAreaTargetInputDto
      | ResolveRuleOccurrenceInputDto
      | RollRuleEvidenceInputDto
      | VoidRuleOccurrenceInputDto
  ) => Promise<EncounterCommandResultDto>
}) {
  const [opened, { close, open }] = useDisclosure(false)
  const [localPending, setLocalPending] = useState(false)
  const [primaryOptionId, setPrimaryOptionId] = useState<string | null>(null)
  const [bonusOptionId, setBonusOptionId] = useState<string | null>(null)
  const [adjudicationValues, setAdjudicationValues] =
    useState<InitiativeDeclarationAdjudicationValues>({})
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { gmRollVisibility } = useGmRollVisibilityPreference()
  const disabled = !connected || submitting || localPending
  // The GM skips a pending movement choice for its player; the movement continues (D26).
  const movementChoice =
    pending.kind === 'MOVEMENT_REACTION' || pending.kind === 'MOVEMENT_PASSAGE_CHOICE'

  const [trackedOccurrence, setTrackedOccurrence] = useState({
    id: pending.occurrenceId,
    version: pending.occurrenceVersion
  })
  if (
    trackedOccurrence.id !== pending.occurrenceId ||
    trackedOccurrence.version !== pending.occurrenceVersion
  ) {
    setTrackedOccurrence({ id: pending.occurrenceId, version: pending.occurrenceVersion })
    setPrimaryOptionId(null)
    setBonusOptionId(null)
    setAdjudicationValues({})
    setFeedback(null)
    setError(null)
  }

  function commandTarget() {
    return {
      encounterId: encounter.id,
      commandId: crypto.randomUUID(),
      expectedVersion: pending.encounterVersion,
      occurrenceId: pending.occurrenceId,
      expectedOccurrenceVersion: pending.occurrenceVersion
    }
  }

  /** "Roll dice": records a server roll for one request without settling the decision. */
  async function rollEvidence(
    requestId: string,
    rollMode: EncounterD20RollModeDto | null
  ): Promise<EncounterCommandResultDto | null> {
    if (disabled) return null
    setLocalPending(true)
    setFeedback(null)
    setError(null)
    try {
      return await onResolve({
        type: 'ROLL_RULE_EVIDENCE',
        ...commandTarget(),
        requestId,
        rollMode,
        ...(canVoid ? { visibility: gmRollVisibility } : {})
      })
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'The dice could not be rolled.')
      return null
    } finally {
      setLocalPending(false)
    }
  }

  async function resolve(
    resolution: ResolveRuleOccurrenceInputDto['resolution'] | 'VOID'
  ): Promise<void> {
    if (disabled) return
    setLocalPending(true)
    setFeedback(null)
    setError(null)
    const target = commandTarget()
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
            ? movementChoice
              ? 'Decision skipped.'
              : 'Decision voided.'
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

  /** GM-only: takes one creature out of the pending area, proving the caught set it last read. */
  async function removeAreaTarget(checksum: string, actorId: string): Promise<void> {
    if (disabled) return
    setLocalPending(true)
    setFeedback(null)
    setError(null)
    try {
      await onResolve({
        type: 'REMOVE_AREA_TARGET',
        ...commandTarget(),
        expectedCaughtChecksum: checksum,
        actorId
      })
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : 'The creature could not be removed.'
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
        onClose={() => {
          close()
          skipped?.onDismiss()
        }}
      >
        <Stack gap='md' aria-busy={localPending || undefined}>
          <div>
            <Text fw={650}>
              {pending.kind === 'OPTIONAL_COMBAT_CLEAVING'
                ? 'Cleaving choice'
                : pending.kind === 'D20_EVIDENCE' && pending.trigger?.kind === 'CONCENTRATION'
                  ? 'Concentration check'
                  : pending.kind === 'D20_EVIDENCE' && pending.trigger?.kind === 'DEATH_SAVE'
                    ? 'Death save'
                    : pending.kind === 'ON_HIT_CHOICE'
                      ? onHitChoiceTitle(pending.options)
                      : decisionTitle(pending.kind)}
            </Text>
            {skipped ? null : (
              <Text c='dimmed' size='sm'>
                This choice is durable. Reconnecting returns to the same decision.
              </Text>
            )}
          </div>
          {!connected && !skipped ? (
            <Alert color='yellow'>Decision controls will return when live play reconnects.</Alert>
          ) : null}
          {skipped ? (
            <Alert aria-live='polite' color='blue'>
              {MOVEMENT_DECISION_SKIPPED_MESSAGE}
            </Alert>
          ) : pending.kind === 'D20_EVIDENCE' ||
            pending.kind === 'INITIATIVE_EVIDENCE' ||
            pending.kind === 'RECHARGE_EVIDENCE' ||
            pending.kind === 'ACTION_OUTCOME_EVIDENCE' ? (
            <>
              {'rollerActorId' in pending && pending.rollerActorId ? (
                <Text size='sm'>
                  {rollPromptText(
                    encounter.actors.find((actor) => actor.id === pending.rollerActorId)?.label ??
                      'a hidden combatant',
                    'trigger' in pending ? pending.trigger : undefined
                  )}
                </Text>
              ) : null}
              {canVoid ? <GmRollVisibilityToggle /> : null}
              <CampaignTabletopEvidenceRollRow
                disabled={disabled}
                key={`${pending.occurrenceId}:${pending.occurrenceVersion}:${pending.request.requestId}`}
                latestRoll={latestRoll}
                pending={pending}
                onRoll={(rollMode) => rollEvidence(pending.request.requestId, rollMode)}
                onSubmit={(resolution) => void resolve(resolution)}
              />
            </>
          ) : pending.kind === 'CONTEST_CHECK' ? (
            <>
              <Text size='sm'>
                {pending.actionLabel}: roll for{' '}
                {encounter.actors.find((actor) => actor.id === pending.rollerActorId)?.label ??
                  'a hidden combatant'}
              </Text>
              {canVoid ? <GmRollVisibilityToggle /> : null}
              <ContestCheckControls
                disabled={disabled}
                key={`${pending.occurrenceId}:${pending.occurrenceVersion}`}
                latestRoll={latestRoll}
                pending={pending}
                onRoll={(rollMode) => rollEvidence(pending.requestId, rollMode)}
                onSubmit={(resolution) => void resolve(resolution)}
              />
            </>
          ) : pending.kind === 'AREA_SAVES' ? (
            <AreaSavesControls
              actors={encounter.actors}
              disabled={disabled}
              latestRoll={latestRoll}
              pending={pending}
              onRemove={(actorId) => {
                if (pending.caughtChecksum) void removeAreaTarget(pending.caughtChecksum, actorId)
              }}
              onRoll={rollEvidence}
              onSubmit={(resolution) => void resolve(resolution)}
            />
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
                  {movementPassageOptionLabel(option)}
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
          ) : pending.kind === 'REACTION_CHOICE' ? (
            <Stack gap='xs'>
              {pending.options.map((option) => (
                <Button
                  disabled={disabled}
                  key={option.optionId}
                  onClick={() => void resolve({ kind: 'OPTION', optionId: option.optionId })}
                >
                  {pending.options.length === 1 ? 'Use reaction' : `Use ${option.actionId}`}
                </Button>
              ))}
              <Button
                disabled={disabled}
                variant='default'
                onClick={() => void resolve({ kind: 'DECLINE' })}
              >
                Decline
              </Button>
            </Stack>
          ) : pending.kind === 'ON_HIT_CHOICE' ? (
            <Stack gap='xs'>
              {pending.options.map((option) => (
                <Button
                  disabled={disabled}
                  key={option.optionId}
                  onClick={() => void resolve({ kind: 'OPTION', optionId: option.optionId })}
                >
                  {onHitOptionLabel(option)}
                </Button>
              ))}
              <Button
                disabled={disabled}
                variant='default'
                onClick={() => void resolve({ kind: 'DECLINE' })}
              >
                Decline
              </Button>
            </Stack>
          ) : pending.kind === 'D20_WINDOW' ? (
            <Stack gap='xs'>
              <Text size='sm'>
                {rollPromptText(
                  encounter.actors.find((actor) => actor.id === pending.rollerActorId)?.label ??
                    'a hidden combatant',
                  pending.trigger
                )}
                : rolled {pending.d20.selectedNatural}, total {pending.d20.total}
              </Text>
              {pending.options.map((option) => (
                <Button
                  disabled={disabled}
                  key={option.optionId}
                  onClick={() =>
                    void resolve({
                      kind: 'D20_WINDOW_USE',
                      requestId: pending.requestId,
                      optionId: option.optionId
                    })
                  }
                >
                  Add {option.label} ({option.sign === 'SUBTRACT' ? '-' : '+'}
                  {option.count}d{option.faces})
                </Button>
              ))}
              <Button
                disabled={disabled}
                variant='default'
                onClick={() =>
                  void resolve({ kind: 'D20_WINDOW_DECLINE', requestId: pending.requestId })
                }
              >
                Keep the roll
              </Button>
            </Stack>
          ) : pending.kind === 'ATTACK_RETARGET_CHOICE' ? (
            <Stack gap='xs'>
              {pending.options.map((option) => (
                <Button
                  disabled={disabled}
                  key={option.optionId}
                  onClick={() => void resolve({ kind: 'OPTION', optionId: option.optionId })}
                >
                  Target{' '}
                  {encounter.actors.find((actor) => actor.id === option.targetActorId)?.label ??
                    'Target'}
                </Button>
              ))}
              <Button
                disabled={disabled}
                variant='default'
                onClick={() => void resolve({ kind: 'DECLINE' })}
              >
                Lose the action
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
            <LegendaryActionControls
              actors={encounter.actors}
              disabled={disabled}
              key={`${pending.occurrenceId}:${pending.occurrenceVersion}`}
              pending={pending}
              onSubmit={(resolution) => void resolve(resolution)}
            />
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
          {canVoid && !skipped ? (
            <Stack gap={4}>
              <Button
                color='red'
                disabled={disabled}
                variant='subtle'
                onClick={() => void resolve('VOID')}
              >
                {movementChoice ? 'Skip decision' : 'Void decision'}
              </Button>
              <Text c='dimmed' size='xs'>
                {movementChoice
                  ? "Declines the choice for whoever it's waiting on; the movement continues."
                  : "Cancels a paused action or declines an optional choice. Rolls play can't continue without stay open."}
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

/** A contest participant picks one of its checks, when offered several, and rolls its d20. */
function ContestCheckControls({
  disabled,
  latestRoll,
  pending,
  onRoll,
  onSubmit
}: {
  disabled: boolean
  latestRoll: EncounterEvidenceRollDto | null
  pending: Extract<PendingEncounterRuleOccurrenceSummaryDto, { kind: 'CONTEST_CHECK' }>
  onRoll: (rollMode: EncounterD20RollModeDto | null) => Promise<EncounterCommandResultDto | null>
  onSubmit: (resolution: ResolveRuleOccurrenceInputDto['resolution']) => void
}) {
  const [checkDefinitionId, setCheckDefinitionId] = useState(
    pending.checks.length === 1 ? (pending.checks[0]?.checkDefinitionId ?? null) : null
  )
  const check = pending.checks.find((entry) => entry.checkDefinitionId === checkDefinitionId)

  return (
    <Stack gap='sm'>
      {pending.checks.length > 1 ? (
        <Select
          comboboxProps={{ withinPortal: false }}
          data={pending.checks.map((entry) => ({
            value: entry.checkDefinitionId,
            label: entry.label
          }))}
          disabled={disabled}
          label='Check'
          value={checkDefinitionId}
          onChange={setCheckDefinitionId}
        />
      ) : check ? (
        <Text size='sm'>{check.label}</Text>
      ) : null}
      {check ? (
        <CampaignTabletopEvidenceRollRow
          disabled={disabled}
          key={check.checkDefinitionId}
          latestRoll={latestRoll}
          pending={contestCheckEvidence(pending, check)}
          onRoll={onRoll}
          onSubmit={(roll) => {
            if (roll.kind === 'ENTER_DICE' || roll.kind === 'SYSTEM_ROLL')
              onSubmit({
                kind: 'CONTEST_CHECK',
                requestId: pending.requestId,
                checkDefinitionId: check.checkDefinitionId,
                roll
              })
          }}
        />
      ) : null}
    </Stack>
  )
}

/**
 * What this viewer may answer while an area's saves are open: their own saves (every one for the
 * GM, who can also remove a creature before it rolls) and Legendary Resistance choices. A viewer
 * with nothing to answer only sees who is caught.
 */
function AreaSavesControls({
  actors,
  disabled,
  latestRoll,
  pending,
  onRemove,
  onRoll,
  onSubmit
}: {
  actors: readonly { id: string; label: string }[]
  disabled: boolean
  latestRoll: EncounterEvidenceRollDto | null
  pending: Extract<PendingEncounterRuleOccurrenceSummaryDto, { kind: 'AREA_SAVES' }>
  onRemove: (actorId: string) => void
  onRoll: (
    requestId: string,
    rollMode: EncounterD20RollModeDto | null
  ) => Promise<EncounterCommandResultDto | null>
  onSubmit: (resolution: ResolveRuleOccurrenceInputDto['resolution']) => void
}) {
  const labelOf = (actorId: string) =>
    actors.find((actor) => actor.id === actorId)?.label ?? 'Hidden combatant'
  const canRemove = pending.caughtChecksum !== null

  return (
    <Stack gap='md'>
      {pending.caught.length > 0 ? (
        <Text size='sm'>Caught in the area: {pending.caught.join(', ')}</Text>
      ) : null}
      {pending.saves.map((save) => (
        <Stack
          aria-label={labelOf(save.targetActorId)}
          gap='xs'
          key={save.request.requestId}
          role='group'
        >
          <Group justify='space-between'>
            <Text fw={600} size='sm'>
              {labelOf(save.targetActorId)}
            </Text>
            {canRemove ? (
              <Button
                color='red'
                disabled={disabled}
                size='compact-sm'
                variant='subtle'
                onClick={() => onRemove(save.targetActorId)}
              >
                Remove from area
              </Button>
            ) : null}
          </Group>
          <CampaignTabletopEvidenceRollRow
            disabled={disabled}
            latestRoll={latestRoll}
            pending={{
              kind: 'D20_EVIDENCE',
              occurrenceId: pending.occurrenceId,
              occurrenceVersion: pending.occurrenceVersion,
              encounterVersion: pending.encounterVersion,
              rollerActorId: save.actorId,
              request: save.request,
              allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
            }}
            onRoll={(rollMode) => onRoll(save.request.requestId, rollMode)}
            onSubmit={onSubmit}
          />
        </Stack>
      ))}
      {pending.legendaryResistance.map((offer) => (
        <Stack gap='xs' key={offer.actorId}>
          <Text size='sm'>{labelOf(offer.actorId)} failed its save</Text>
          <Group>
            <Button
              disabled={disabled}
              onClick={() =>
                onSubmit({
                  kind: 'AREA_LEGENDARY_RESISTANCE',
                  actorId: offer.actorId,
                  decision: { kind: 'USE', optionId: offer.optionId }
                })
              }
            >
              Use Legendary Resistance
            </Button>
            <Button
              disabled={disabled}
              variant='default'
              onClick={() =>
                onSubmit({
                  kind: 'AREA_LEGENDARY_RESISTANCE',
                  actorId: offer.actorId,
                  decision: { kind: 'DECLINE' }
                })
              }
            >
              Decline
            </Button>
          </Group>
        </Stack>
      ))}
      {pending.saves.length === 0 && pending.legendaryResistance.length === 0 ? (
        <Text c='dimmed' size='sm'>
          Waiting for saves.
        </Text>
      ) : null}
    </Stack>
  )
}

/** Picks one Legendary Action option and, unless it only targets its user, its target (D51). */
function LegendaryActionControls({
  actors,
  disabled,
  pending,
  onSubmit
}: {
  actors: readonly { id: string; label: string }[]
  disabled: boolean
  pending: Extract<PendingEncounterRuleOccurrenceSummaryDto, { kind: 'LEGENDARY_ACTION_CHOICE' }>
  onSubmit: (resolution: ResolveRuleOccurrenceInputDto['resolution']) => void
}) {
  const [optionId, setOptionId] = useState<string | null>(null)
  const [targetActorId, setTargetActorId] = useState<string | null>(null)
  const option = pending.options.find((entry) => entry.optionId === optionId) ?? null
  const targetIds = option?.targetActorIds ?? []
  // A self action has exactly one target: its user.
  const target = targetIds.length === 1 ? (targetIds[0] ?? null) : targetActorId

  return (
    <Stack gap='sm'>
      <Select
        comboboxProps={{ withinPortal: false }}
        data={pending.options.map((entry) => ({
          value: entry.optionId,
          label: `${entry.label} · ${entry.featureCost === 1 ? '1 action' : `${entry.featureCost} actions`}`
        }))}
        disabled={disabled}
        label='Legendary Action'
        value={optionId}
        onChange={(value) => {
          setOptionId(value)
          setTargetActorId(null)
        }}
      />
      {option && targetIds.length > 1 ? (
        <Select
          comboboxProps={{ withinPortal: false }}
          data={targetIds.map((actorId) => ({
            value: actorId,
            label: actors.find((actor) => actor.id === actorId)?.label ?? 'Hidden combatant'
          }))}
          disabled={disabled}
          label='Target'
          searchable
          value={targetActorId}
          onChange={setTargetActorId}
        />
      ) : null}
      <Group>
        <Button
          disabled={disabled || !option || !target}
          onClick={() => {
            if (!option || !target) return
            onSubmit({ kind: 'LEGENDARY_OPTION', optionId: option.optionId, targetActorId: target })
          }}
        >
          Use Legendary Action
        </Button>
        <Button disabled={disabled} variant='default' onClick={() => onSubmit({ kind: 'DECLINE' })}>
          Pass
        </Button>
      </Group>
    </Stack>
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
