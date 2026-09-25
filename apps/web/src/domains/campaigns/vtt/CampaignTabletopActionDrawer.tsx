import {
  ActionIcon,
  Alert,
  Button,
  Drawer,
  Group,
  Select,
  Stack,
  Text,
  Tooltip
} from '@mantine/core'
import { Swords } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  EncounterActionChoiceDto,
  EncounterActionChoicesDto,
  EncounterOptionalActionChoicesDto,
  GetEncounterOptionalActionChoicesInputDto
} from '@artificer-toolkit/schema/api/encounterActionChoices'
import type {
  EncounterCommandResultDto,
  EncounterGmProjectionDto,
  EncounterPlayerProjectionDto,
  ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'

export function CampaignTabletopActionDrawer({
  actions,
  actionsLoading,
  actionChoicesError,
  optionalRules,
  actorIdByTokenId,
  connected,
  encounter,
  opened,
  onOpen,
  onClose,
  pending,
  scene,
  onResolve,
  onLoadOptionalChoices
}: {
  actions: EncounterActionChoiceDto[]
  actionsLoading: boolean
  actionChoicesError: string | null
  optionalRules: EncounterActionChoicesDto['optionalRules']
  actorIdByTokenId: ReadonlyMap<string, string>
  connected: boolean
  encounter: EncounterGmProjectionDto | EncounterPlayerProjectionDto
  opened: boolean
  onOpen: () => void
  onClose: () => void
  pending: boolean
  scene: CampaignSceneStateDto
  onResolve: (command: ResolveEncounterActionInputDto) => Promise<EncounterCommandResultDto>
  onLoadOptionalChoices: (
    request: GetEncounterOptionalActionChoicesInputDto
  ) => Promise<EncounterOptionalActionChoicesDto>
}) {
  const [actionId, setActionId] = useState<string | null>(null)
  const [targetActorId, setTargetActorId] = useState<string | null>(null)
  const [optionalRuleId, setOptionalRuleId] = useState<string | null>(null)
  const [optionalChoices, setOptionalChoices] = useState<{
    requestIdentity: string
    value: EncounterOptionalActionChoicesDto
  } | null>(null)
  const [optionalValues, setOptionalValues] = useState<Record<string, string>>({})
  const [optionalChoicesLoading, setOptionalChoicesLoading] = useState(false)
  const [optionalChoicesError, setOptionalChoicesError] = useState<{
    requestIdentity: string
    value: string
  } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [stowConfirmationIdentity, setStowConfirmationIdentity] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const currentActor =
    encounter.actors.find((actor) => actor.id === encounter.currentActorId) ?? null
  const currentActorId = currentActor?.id ?? null
  const selectedAction = actions.find((action) => action.id === actionId) ?? null
  const selectedOptionalRule =
    optionalRules.find((rule) => rule.definitionId === optionalRuleId) ?? null
  const selectedActionId = selectedAction?.id ?? null
  const selectedOptionalRuleId = selectedOptionalRule?.definitionId ?? null
  const sourceToken = useMemo(
    () => scene.tokens.find((token) => actorIdByTokenId.get(token.id) === currentActor?.id),
    [actorIdByTokenId, currentActor?.id, scene.tokens]
  )
  const targetToken = useMemo(
    () => scene.tokens.find((token) => actorIdByTokenId.get(token.id) === targetActorId),
    [actorIdByTokenId, scene.tokens, targetActorId]
  )
  const sourceTokenId = sourceToken?.id ?? null
  const targetTokenId = targetToken?.id ?? null
  const sceneContext = useMemo(
    () =>
      sourceTokenId && targetTokenId
        ? {
            sceneId: scene.id,
            expectedSceneVersion: scene.version,
            sourceTokenId,
            targetTokenId
          }
        : null,
    [scene.id, scene.version, sourceTokenId, targetTokenId]
  )
  const choiceRequestIdentity = JSON.stringify([
    encounter.id,
    encounter.version,
    currentActorId,
    selectedActionId,
    targetActorId,
    selectedOptionalRuleId,
    scene.id,
    scene.version,
    sourceTokenId,
    targetTokenId
  ])
  const currentOptionalChoices =
    optionalChoices?.requestIdentity === choiceRequestIdentity ? optionalChoices.value : null
  const currentOptionalChoicesError =
    optionalChoicesError?.requestIdentity === choiceRequestIdentity
      ? optionalChoicesError.value
      : null
  const choiceRequestSequence = useRef(0)
  const selectionControlsDisabled =
    !connected || pending || submitting || actionsLoading || actionChoicesError !== null
  const dependentControlsDisabled = selectionControlsDisabled || optionalChoicesLoading
  const wieldConflict = optionalRuleId === null ? (selectedAction?.wieldConflict ?? null) : null
  const confirmingStow =
    wieldConflict !== null && stowConfirmationIdentity === choiceRequestIdentity
  const incompleteOptionalChoices =
    optionalRuleId !== null &&
    (!selectedOptionalRule ||
      !currentOptionalChoices ||
      currentOptionalChoices.fields.some((field) => !optionalValues[field.fieldId]))

  useEffect(() => {
    setActionId(null)
    setTargetActorId(null)
    setOptionalRuleId(null)
    setFeedback(null)
    setError(null)
  }, [encounter.currentActorId])

  useEffect(() => {
    const sequence = ++choiceRequestSequence.current
    setOptionalChoices(null)
    setOptionalChoicesError(null)
    setOptionalValues({})
    if (
      !opened ||
      !currentActorId ||
      !selectedActionId ||
      !targetActorId ||
      !selectedOptionalRuleId
    ) {
      setOptionalChoicesLoading(false)
      return
    }
    setOptionalChoicesLoading(true)
    void onLoadOptionalChoices({
      encounterId: encounter.id,
      expectedVersion: encounter.version,
      actorId: currentActorId,
      actionId: selectedActionId,
      targetActorId,
      sceneContext:
        sourceTokenId && targetTokenId
          ? {
              sceneId: scene.id,
              expectedSceneVersion: scene.version,
              sourceTokenId,
              targetTokenId
            }
          : null,
      definitionId: selectedOptionalRuleId
    })
      .then((nextChoices) => {
        if (choiceRequestSequence.current !== sequence) return
        setOptionalChoices({ requestIdentity: choiceRequestIdentity, value: nextChoices })
      })
      .catch((nextError: unknown) => {
        if (choiceRequestSequence.current !== sequence) return
        setOptionalChoicesError({
          requestIdentity: choiceRequestIdentity,
          value:
            nextError instanceof Error ? nextError.message : 'Optional choices could not be loaded.'
        })
      })
      .finally(() => {
        if (choiceRequestSequence.current === sequence) setOptionalChoicesLoading(false)
      })
    return () => {
      if (choiceRequestSequence.current === sequence) choiceRequestSequence.current += 1
    }
  }, [
    choiceRequestIdentity,
    currentActorId,
    encounter.id,
    encounter.version,
    onLoadOptionalChoices,
    opened,
    scene.id,
    scene.version,
    selectedActionId,
    selectedOptionalRuleId,
    sourceTokenId,
    targetActorId,
    targetTokenId
  ])

  async function resolveAction(
    acceptedWieldConflict: ResolveEncounterActionInputDto['acceptedWieldConflict']
  ): Promise<void> {
    setStowConfirmationIdentity(null)
    if (
      !currentActor ||
      !selectedAction ||
      !targetActorId ||
      selectionControlsDisabled ||
      optionalChoicesLoading ||
      currentOptionalChoicesError !== null ||
      incompleteOptionalChoices
    )
      return
    setSubmitting(true)
    setError(null)
    setFeedback(null)
    try {
      const response = await onResolve({
        type: 'RESOLVE_ACTION',
        encounterId: encounter.id,
        commandId: crypto.randomUUID(),
        expectedVersion: encounter.version,
        actorId: currentActor.id,
        actionId: selectedAction.id,
        targetActorId,
        sceneContext,
        acceptedWieldConflict,
        optionalCombatIntent: currentOptionalChoices
          ? {
              definitionId: currentOptionalChoices.definitionId,
              optionId: currentOptionalChoices.optionId,
              selectionContract: currentOptionalChoices.selectionContract,
              selections: currentOptionalChoices.fields.map((field) => ({
                fieldId: field.fieldId,
                value: { kind: 'ENTITY' as const, entityId: optionalValues[field.fieldId]! }
              }))
            }
          : null
      })
      if (response.occurrence?.status === 'PENDING') {
        setFeedback('Action paused for a required decision.')
      } else if (response.resolution) {
        const applied = response.resolution.appliedOutcomes.filter(
          (outcome) => outcome.status === 'APPLIED'
        ).length
        setFeedback(
          applied === 0
            ? 'Action resolved with no applied outcomes.'
            : `Action resolved · ${applied} ${applied === 1 ? 'outcome' : 'outcomes'} applied.`
        )
      } else if (response.roll) {
        setFeedback(`Action resolved · rolled ${response.roll.evidence.total}.`)
      } else {
        setFeedback('Action resolved.')
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'The action could not be resolved.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Tooltip label='Actions'>
        <ActionIcon aria-label='Open actions' size='lg' variant='default' onClick={onOpen}>
          <Swords aria-hidden size={18} />
        </ActionIcon>
      </Tooltip>
      <Drawer
        closeButtonProps={{ 'aria-label': 'Close actions' }}
        opened={opened}
        position='right'
        size='min(28rem, 100vw)'
        title='Actions'
        zIndex={400}
        onClose={onClose}
      >
        <Stack gap='md' aria-busy={submitting || undefined}>
          <div>
            <Text fw={650}>{currentActor?.label ?? 'No active combatant'}</Text>
            <Text c='dimmed' size='sm'>
              Choose an available action and its target. The server validates range and eligibility.
            </Text>
          </div>
          {!connected ? (
            <Alert color='yellow'>Actions will return when live play reconnects.</Alert>
          ) : null}
          {actionChoicesError ? (
            <Alert aria-live='assertive' color='red'>
              {actionChoicesError}
            </Alert>
          ) : null}
          {actionsLoading ? <Text c='dimmed'>Loading available actions…</Text> : null}
          {!actionsLoading && !actionChoicesError && actions.length ? (
            <>
              <Select
                comboboxProps={{ withinPortal: false }}
                data={actions.map((action) => ({
                  label: action.sourceLabel
                    ? `${action.label} · ${action.sourceLabel}`
                    : action.label,
                  value: action.id
                }))}
                disabled={selectionControlsDisabled}
                label='Action'
                searchable
                value={actionId}
                onChange={setActionId}
              />
              <Select
                comboboxProps={{ withinPortal: false }}
                data={encounter.actors.map((actor) => ({ label: actor.label, value: actor.id }))}
                disabled={selectionControlsDisabled}
                label='Target'
                searchable
                value={targetActorId}
                onChange={setTargetActorId}
              />
              {selectedAction ? (
                <Text c='dimmed' size='sm'>
                  {selectedAction.rangeLabel ?? 'System-defined range'}
                  {selectedAction.attackBonus === undefined
                    ? ''
                    : ` · ${selectedAction.attackBonus >= 0 ? '+' : ''}${selectedAction.attackBonus} to hit`}
                </Text>
              ) : null}
              {optionalRules.length ? (
                <Select
                  clearable
                  comboboxProps={{ withinPortal: false }}
                  data={optionalRules.map((rule) => ({
                    label: rule.label,
                    value: rule.definitionId
                  }))}
                  disabled={selectionControlsDisabled}
                  label='Optional rule'
                  placeholder='No optional rule'
                  searchable
                  value={optionalRuleId}
                  onChange={setOptionalRuleId}
                />
              ) : null}
              {selectedOptionalRule &&
                currentOptionalChoices?.fields.map((field) => (
                  <Select
                    comboboxProps={{ withinPortal: false }}
                    data={field.options.map((option) => ({
                      label: option.label,
                      value: option.id
                    }))}
                    disabled={dependentControlsDisabled}
                    key={field.fieldId}
                    label={field.label}
                    searchable
                    value={optionalValues[field.fieldId] ?? null}
                    onChange={(value) => {
                      setOptionalValues((current) =>
                        value === null
                          ? Object.fromEntries(
                              Object.entries(current).filter(
                                ([fieldId]) => fieldId !== field.fieldId
                              )
                            )
                          : { ...current, [field.fieldId]: value }
                      )
                    }}
                  />
                ))}
              {confirmingStow ? (
                <Alert color='yellow' title='Stow shield?'>
                  <Stack gap='sm'>
                    <Text size='sm'>
                      Attacking with this weapon stows your shield. AC −
                      {-wieldConflict.armorClassDelta} until you equip it again.
                    </Text>
                    <Group>
                      <Button
                        disabled={dependentControlsDisabled}
                        onClick={() =>
                          void resolveAction({
                            kind: wieldConflict.kind,
                            shieldItemInstanceId: wieldConflict.shieldItemInstanceId
                          })
                        }
                      >
                        Stow shield and attack
                      </Button>
                      <Button variant='default' onClick={() => setStowConfirmationIdentity(null)}>
                        Cancel
                      </Button>
                    </Group>
                  </Stack>
                </Alert>
              ) : (
                <Group>
                  <Button
                    disabled={
                      dependentControlsDisabled ||
                      !selectedAction ||
                      !targetActorId ||
                      incompleteOptionalChoices ||
                      currentOptionalChoicesError !== null
                    }
                    loading={submitting}
                    onClick={() =>
                      wieldConflict
                        ? setStowConfirmationIdentity(choiceRequestIdentity)
                        : void resolveAction(null)
                    }
                  >
                    Resolve action
                  </Button>
                </Group>
              )}
            </>
          ) : !actionsLoading && !actionChoicesError ? (
            <Text c='dimmed'>No structured actions are available for the active combatant.</Text>
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
          {currentOptionalChoicesError ? (
            <Alert aria-live='assertive' color='red'>
              {currentOptionalChoicesError}
            </Alert>
          ) : null}
        </Stack>
      </Drawer>
    </>
  )
}
