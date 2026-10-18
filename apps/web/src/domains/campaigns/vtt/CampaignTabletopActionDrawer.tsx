import {
  ActionIcon,
  Alert,
  Button,
  Drawer,
  Group,
  List,
  MultiSelect,
  SegmentedControl,
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
  EncounterEscapeChoiceDto,
  EncounterHeldGrantEndChoiceDto,
  EncounterOptionalActionChoicesDto,
  GetEncounterOptionalActionChoicesInputDto
} from '@artificer-toolkit/schema/api/encounterActionChoices'
import type {
  EncounterCommandResultDto,
  EncounterGmProjectionDto,
  EncounterPlayerProjectionDto,
  EndHeldGrantInputDto,
  EscapeRelationshipInputDto,
  ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type { EncounterSessionStateDto } from '@artificer-toolkit/schema/api/encounterData'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import type { EncounterRuleWarningDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import {
  ACTIVATION_REGISTRY,
  EQUIPMENT_GRIP_REGISTRY,
  formatLengthMeasurement
} from '@artificer-toolkit/shared/core'
import {
  directedAreaSizeInSceneCoordinates,
  pointAreaInSceneCoordinates,
  spatialTokensInsideArea
} from '@artificer-toolkit/shared/vtt'
import { GmRollVisibilityToggle } from '#app/components/dice/GmRollVisibilityToggle'
import { useGmRollVisibilityPreference } from '#app/settings/useGmRollVisibilityPreference'
import { CampaignTabletopActionConfirmation } from './CampaignTabletopActionConfirmation'
import { CampaignTabletopBasicActions } from './CampaignTabletopBasicActions'
import { CampaignTabletopEscapes } from './CampaignTabletopEscapes'
import { CampaignTabletopFormCreaturePicker } from './CampaignTabletopFormCreaturePicker'
import { CampaignTabletopHeldGrantEnds } from './CampaignTabletopHeldGrantEnds'
import { CampaignTabletopProjectileTargets } from './CampaignTabletopProjectileTargets'
import { LiveSessionCommandRejectedError } from './liveSessionClient'
import {
  aimedAreaShape,
  type VttActionPreview,
  type VttAreaAim,
  type VttAreaSize
} from './vttSceneRenderer.model'
import { targetableEncounterActors, type VttTargetingRequest } from './vttTargeting.model'

const NO_TOKENS: CampaignSceneStateDto['tokens'] = []

function attackSlotLabel({ number, total }: NonNullable<EncounterActionChoiceDto['attackSlot']>) {
  return `Attack ${number} of ${total}`
}

export function CampaignTabletopActionDrawer({
  actions,
  basicActionChoices,
  escapes,
  heldGrantEnds,
  openAttackAction,
  actionsLoading,
  actionChoicesError,
  unavailableActions,
  optionalRules,
  actorIdByTokenId,
  connected,
  encounter,
  isGm,
  opened,
  onOpen,
  onClose,
  pending,
  scene,
  areaAim,
  waitingOn,
  onAreaAimChange,
  onAreaSizeChange,
  onActionPreviewChange,
  onPickAreaOrigin,
  pickedTargetActorId,
  onPickTargetOnMap,
  onTargetPick,
  onResolve,
  onEscape,
  onEndHeldGrant,
  onLoadOptionalChoices
}: {
  actions: EncounterActionChoiceDto[]
  /** The System's authored basic actions, which resolve like any action. */
  basicActionChoices: EncounterActionChoiceDto[]
  escapes: EncounterEscapeChoiceDto[]
  heldGrantEnds: EncounterHeldGrantEndChoiceDto[]
  /** The Attack action opened this turn; its last weapon and target are preselected for the next attack. */
  openAttackAction: EncounterActionChoicesDto['openAttackAction']
  actionsLoading: boolean
  actionChoicesError: string | null
  unavailableActions: EncounterActionChoicesDto['unavailableActions']
  optionalRules: EncounterActionChoicesDto['optionalRules']
  actorIdByTokenId: ReadonlyMap<string, string>
  connected: boolean
  /** The Campaign owner chooses whether their creatures' rolls are Public or Private (Q14). */
  isGm: boolean
  encounter: EncounterGmProjectionDto | EncounterPlayerProjectionDto
  opened: boolean
  onOpen: () => void
  onClose: () => void
  pending: boolean
  /** The Scene the Encounter is bound to; null when the presented Scene is not that one. */
  scene: CampaignSceneStateDto | null
  /**
   * Where the caster aimed the area: a point area's center, or a directed area's origin on their
   * token's edge and the point it extends toward; the stage draws it and keeps it while the drawer
   * is closed.
   */
  areaAim: VttAreaAim | null
  /** Who must answer a pending decision the viewer can't; derived by the server. */
  waitingOn: EncounterSessionStateDto['waitingOn']
  onAreaAimChange: (aim: VttAreaAim | null) => void
  /** The selected action's area in Scene coordinates, for the stage's aiming and preview; null when none. */
  onAreaSizeChange: (size: VttAreaSize | null) => void
  /** The selected action's range and target token, for the stage's preview; null when none is selected. */
  onActionPreviewChange: (preview: VttActionPreview | null) => void
  /** Asks the stage to let the caster aim the area on the map: click its center, or drag from their token's edge. */
  onPickAreaOrigin: () => void
  /**
   * The creature the caster chose; the stage owns it so a pick on the map or in the turn-order
   * list lands here. `undefined` is untouched (the open Attack action's last target applies);
   * `null` is cleared.
   */
  pickedTargetActorId: string | null | undefined
  /** Asks the stage to let the caster pick this action's target on the map or in the turn-order list. */
  onPickTargetOnMap: (request: VttTargetingRequest) => void
  onTargetPick: (actorId: string | null | undefined) => void
  onResolve: (command: ResolveEncounterActionInputDto) => Promise<EncounterCommandResultDto>
  onEscape: (command: EscapeRelationshipInputDto) => Promise<EncounterCommandResultDto>
  onEndHeldGrant: (command: EndHeldGrantInputDto) => Promise<EncounterCommandResultDto>
  onLoadOptionalChoices: (
    request: GetEncounterOptionalActionChoicesInputDto
  ) => Promise<EncounterOptionalActionChoicesDto>
}) {
  // `undefined` is untouched (the open Attack action's last weapon and target apply); `null` is cleared.
  const [pickedActionId, setPickedActionId] = useState<string | null | undefined>(undefined)
  const [pickedActorIds, setPickedActorIds] = useState<string[]>([])
  const [unaffectedActorIds, setUnaffectedActorIds] = useState<string[]>([])
  const [pickedChoiceOptionId, setPickedChoiceOptionId] = useState<string | null>(null)
  const [pickedFormId, setPickedFormId] = useState<string | null>(null)
  const [pickedFormCreatureId, setPickedFormCreatureId] = useState<string | null>(null)
  const [pickedOptionalRuleId, setOptionalRuleId] = useState<string | null>(null)
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
  const { gmRollVisibility } = useGmRollVisibilityPreference()
  const [submitting, setSubmitting] = useState(false)
  const [stowConfirmationIdentity, setStowConfirmationIdentity] = useState<string | null>(null)
  // Warnings the server raised for this exact selection; "Do it anyway" resends acknowledging them.
  const [ruleWarnings, setRuleWarnings] = useState<{
    requestIdentity: string
    acceptedWieldConflict: ResolveEncounterActionInputDto['acceptedWieldConflict']
    warnings: EncounterRuleWarningDto[]
  } | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const currentActor =
    encounter.actors.find((actor) => actor.id === encounter.currentActorId) ?? null
  const currentActorId = currentActor?.id ?? null
  // The server marks a weapon that still fits the open Attack action with an `attackSlot`.
  const preselectedActionId =
    actions.find(
      (action) => action.id === openAttackAction?.lastActionId && action.attackSlot !== null
    )?.id ?? null
  const preselectedTargetActorId =
    openAttackAction?.lastTargetIds.find((id) =>
      encounter.actors.some((actor) => actor.id === id && !actor.defeated)
    ) ?? null
  const actionId = pickedActionId === undefined ? preselectedActionId : pickedActionId
  const selectedAction = actions.find((action) => action.id === actionId) ?? null
  const choiceTarget = selectedAction?.target
  // A defeated creature isn't a target (D63; the server still warns if one is named), and neither is
  // the acting creature when the action refuses itself (Help, First Aid).
  const selfRefused = choiceTarget?.kind === 'ACTOR' && choiceTarget.self === 'REFUSED'
  const targetableActors = targetableEncounterActors(encounter.actors, currentActorId, selfRefused)
  const pickedOrPreselectedTargetActorId =
    pickedTargetActorId === undefined ? preselectedTargetActorId : pickedTargetActorId
  const targetActorId = targetableActors.some(
    (actor) => actor.id === pickedOrPreselectedTargetActorId
  )
    ? pickedOrPreselectedTargetActorId
    : null
  // A list of chosen creatures inside an area is aimed at a point like any point area.
  const choiceActorsTarget = choiceTarget?.kind === 'ACTORS' ? choiceTarget : null
  // An action that swaps its targets into a creature form takes one form for the whole cast, and
  // that form caps how many creatures it reaches (D130).
  const chosenForm =
    choiceActorsTarget?.forms?.find((form) => form.id === pickedFormId) ??
    choiceActorsTarget?.forms?.[0] ??
    null
  const actorsTarget = choiceActorsTarget && {
    ...choiceActorsTarget,
    maxTargets: chosenForm?.maxTargets ?? choiceActorsTarget.maxTargets
  }
  const areaTarget =
    choiceTarget?.kind === 'POINT' || choiceTarget?.kind === 'DIRECTED'
      ? choiceTarget
      : actorsTarget?.area
        ? { kind: 'POINT' as const, area: actorsTarget.area }
        : null
  // A caster-centered area takes no aim, so it has no target to pick.
  const centeredTarget = choiceTarget?.kind === 'CASTER_CENTERED' ? choiceTarget : null
  const zoneTarget =
    choiceTarget?.kind === 'POINT' || choiceTarget?.kind === 'CASTER_CENTERED' ? choiceTarget : null
  // A zone the action places can spare creatures the caster designates at cast.
  const sparesCreatures = zoneTarget?.choosesUnaffected === true
  // A zone the cast picks between places the chosen one (D140); the first is preselected.
  const chosenOption =
    zoneTarget?.choiceOptions?.find((option) => option.id === pickedChoiceOptionId) ??
    zoneTarget?.choiceOptions?.[0] ??
    null
  const zoneChoices = {
    ...(sparesCreatures && unaffectedActorIds.length ? { unaffectedActorIds } : {}),
    ...(chosenOption ? { choiceOptionId: chosenOption.id } : {})
  }
  const namesNoCreature = areaTarget !== null || centeredTarget !== null || actorsTarget !== null
  // Optional rules choose among the target creature's entities, so an area has none.
  const optionalRuleId = namesNoCreature ? null : pickedOptionalRuleId
  const sceneTokens = scene?.tokens ?? NO_TOKENS
  const sceneGrid = scene?.grid ?? null
  const sourceToken = useMemo(
    () => sceneTokens.find((token) => actorIdByTokenId.get(token.id) === currentActor?.id),
    [actorIdByTokenId, currentActor?.id, sceneTokens]
  )
  const sourceTokenId = sourceToken?.id ?? null
  // A directed area starts on the caster's own token, so it cannot be drawn without one.
  const areaSize = useMemo<VttAreaSize | null>(() => {
    if (!areaTarget || !sceneGrid) return null
    if (areaTarget.kind === 'POINT') return pointAreaInSceneCoordinates(areaTarget.area, sceneGrid)
    return sourceTokenId ? directedAreaSizeInSceneCoordinates(areaTarget.area, sceneGrid) : null
  }, [areaTarget, sceneGrid, sourceTokenId])
  const tokensInArea = useMemo(() => {
    const shape = areaSize && areaAim ? aimedAreaShape(areaSize, areaAim) : null
    if (!areaAim || !shape) return []
    const caught = spatialTokensInsideArea({
      origin: areaAim.origin,
      shape,
      tokens: sceneTokens,
      casterTokenId: sourceTokenId
    })
    const inside = new Set(caught)
    return sceneTokens.filter((token) => inside.has(token.id)).map((token) => token.label)
  }, [areaAim, areaSize, sceneTokens, sourceTokenId])
  const areaCommandTarget: ResolveEncounterActionInputDto['target'] | null =
    !areaTarget || !scene || !areaAim || !areaSize
      ? null
      : areaTarget.kind === 'POINT'
        ? {
            kind: 'POINT',
            sceneId: scene.id,
            expectedSceneVersion: scene.version,
            point: areaAim.origin,
            ...zoneChoices
          }
        : areaAim.toward
          ? {
              kind: 'DIRECTED',
              sceneId: scene.id,
              expectedSceneVersion: scene.version,
              origin: areaAim.origin,
              toward: areaAim.toward
            }
          : null
  const actorsPoint = actorsTarget?.area ? (areaAim?.origin ?? null) : null
  const target: ResolveEncounterActionInputDto['target'] | null = actorsTarget
    ? pickedActorIds.length &&
      (!actorsTarget.area || (areaSize && actorsPoint)) &&
      (!actorsTarget.choosesCreatureForm || pickedFormCreatureId)
      ? {
          kind: 'ACTORS',
          actorIds: pickedActorIds,
          ...(chosenForm ? { formId: chosenForm.id } : {}),
          ...(actorsTarget.choosesCreatureForm && pickedFormCreatureId
            ? { creatureId: pickedFormCreatureId }
            : {}),
          scene: scene
            ? { sceneId: scene.id, expectedSceneVersion: scene.version, point: actorsPoint }
            : null
        }
      : null
    : areaTarget
      ? areaCommandTarget
      : centeredTarget
        ? scene
          ? {
              kind: 'CASTER_CENTERED',
              sceneId: scene.id,
              expectedSceneVersion: scene.version,
              ...zoneChoices
            }
          : null
        : targetActorId
          ? { kind: 'ACTOR', actorId: targetActorId }
          : null
  // One entry per attack: a versatile weapon's one- and two-hand actions share an attack key.
  const actionGroups = useMemo(() => {
    const groups = new Map<
      string,
      { lead: EncounterActionChoiceDto; grips: EncounterActionChoiceDto[] }
    >()
    for (const action of actions) {
      const key = action.grip?.attackKey ?? action.id
      const group = groups.get(key)
      if (group) group.grips.push(action)
      else groups.set(key, { lead: action, grips: action.grip ? [action] : [] })
    }
    return groups
  }, [actions])
  const selectedAttackKey = selectedAction
    ? (selectedAction.grip?.attackKey ?? selectedAction.id)
    : null
  const gripActions =
    (selectedAttackKey === null ? undefined : actionGroups.get(selectedAttackKey))?.grips ?? []
  const selectedOptionalRule =
    optionalRules.find((rule) => rule.definitionId === optionalRuleId) ?? null
  const selectedActionId = selectedAction?.id ?? null
  const selectedOptionalRuleId = selectedOptionalRule?.definitionId ?? null
  const targetToken = useMemo(
    () => sceneTokens.find((token) => actorIdByTokenId.get(token.id) === targetActorId),
    [actorIdByTokenId, sceneTokens, targetActorId]
  )
  const targetTokenId = targetToken?.id ?? null
  const sceneContext = useMemo(
    () =>
      scene && sourceTokenId && targetTokenId
        ? {
            sceneId: scene.id,
            expectedSceneVersion: scene.version,
            sourceTokenId,
            targetTokenId
          }
        : null,
    [scene, sourceTokenId, targetTokenId]
  )
  const choiceRequestIdentity = JSON.stringify([
    encounter.id,
    encounter.version,
    currentActorId,
    selectedActionId,
    targetActorId,
    selectedOptionalRuleId,
    scene?.id,
    scene?.version,
    sourceTokenId,
    targetTokenId,
    areaAim?.origin.x,
    areaAim?.origin.y,
    areaAim?.toward?.x,
    areaAim?.toward?.y
  ])
  const currentOptionalChoices =
    optionalChoices?.requestIdentity === choiceRequestIdentity ? optionalChoices.value : null
  const currentOptionalChoicesError =
    optionalChoicesError?.requestIdentity === choiceRequestIdentity
      ? optionalChoicesError.value
      : null
  const choiceRequestSequence = useRef(0)
  const selectionControlsDisabled =
    !connected ||
    pending ||
    submitting ||
    waitingOn !== null ||
    actionsLoading ||
    actionChoicesError !== null
  const dependentControlsDisabled = selectionControlsDisabled || optionalChoicesLoading
  // A held-weapon stow is offered only on a basic action (D152).
  const wieldConflict =
    optionalRuleId === null && selectedAction?.wieldConflict?.kind === 'STOW_SHIELD'
      ? selectedAction.wieldConflict
      : null
  const confirmingStow =
    wieldConflict !== null && stowConfirmationIdentity === choiceRequestIdentity
  const confirmingWarnings =
    ruleWarnings?.requestIdentity === choiceRequestIdentity ? ruleWarnings : null
  const incompleteOptionalChoices =
    optionalRuleId !== null &&
    (!selectedOptionalRule ||
      !currentOptionalChoices ||
      currentOptionalChoices.fields.some((field) => !optionalValues[field.fieldId]))

  useEffect(() => {
    setPickedActionId(undefined)
    onTargetPick(undefined)
    setPickedActorIds([])
    setOptionalRuleId(null)
    setFeedback(null)
    setError(null)
  }, [encounter.currentActorId, onTargetPick])

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
      sceneContext,
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
    sceneContext,
    selectedActionId,
    selectedOptionalRuleId,
    targetActorId
  ])

  // An origin belongs to the action it was picked for.
  useEffect(() => {
    onAreaAimChange(null)
  }, [onAreaAimChange, selectedActionId])

  // So do the creatures chosen.
  useEffect(() => {
    setPickedActorIds([])
    setUnaffectedActorIds([])
    setPickedChoiceOptionId(null)
    setPickedFormId(null)
  }, [selectedActionId])

  useEffect(() => {
    onAreaSizeChange(areaSize)
    return () => onAreaSizeChange(null)
  }, [areaSize, onAreaSizeChange])

  // An area's target is its origin, which the stage draws as the area, so only a creature target is ringed.
  const actionPreview = useMemo<VttActionPreview | null>(
    () =>
      selectedAction && sourceTokenId
        ? {
            range: selectedAction.range,
            sourceTokenId,
            targetTokenId: selectedAction.target.kind === 'ACTOR' ? targetTokenId : null
          }
        : null,
    [selectedAction, sourceTokenId, targetTokenId]
  )

  useEffect(() => {
    onActionPreviewChange(actionPreview)
    return () => onActionPreviewChange(null)
  }, [actionPreview, onActionPreviewChange])

  async function resolveAction(
    acceptedWieldConflict: ResolveEncounterActionInputDto['acceptedWieldConflict'],
    acknowledgedWarnings: ResolveEncounterActionInputDto['acknowledgedWarnings']
  ): Promise<void> {
    setStowConfirmationIdentity(null)
    setRuleWarnings(null)
    if (
      !currentActor ||
      !selectedAction ||
      !target ||
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
        target,
        sceneContext: namesNoCreature ? null : sceneContext,
        acceptedWieldConflict,
        acknowledgedWarnings,
        ...(isGm ? { visibility: gmRollVisibility } : {}),
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
      if (areaTarget) onAreaAimChange(null)
      if (response.occurrence?.status === 'PENDING') {
        setFeedback('Action paused for a required decision.')
      } else if (response.roll) {
        setFeedback(`Action resolved · rolled ${response.roll.evidence.total}.`)
      } else {
        setFeedback('Action resolved.')
      }
    } catch (nextError) {
      if (nextError instanceof LiveSessionCommandRejectedError && nextError.rejection.warnings)
        setRuleWarnings({
          requestIdentity: choiceRequestIdentity,
          acceptedWieldConflict,
          warnings: nextError.rejection.warnings
        })
      else
        setError(
          nextError instanceof Error ? nextError.message : 'The action could not be resolved.'
        )
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
          {waitingOn ? (
            <Alert
              aria-live='polite'
              color='blue'
              title={waitingOn === 'GM' ? 'Waiting on the GM' : 'Waiting on another player'}
            >
              {waitingOn === 'GM' ? 'The GM' : 'Another player'} is answering a decision. You can
              act again once it settles.
            </Alert>
          ) : null}
          {actionChoicesError ? (
            <Alert aria-live='assertive' color='red'>
              {actionChoicesError}
            </Alert>
          ) : null}
          {actionsLoading ? <Text c='dimmed'>Loading available actions…</Text> : null}
          {!actionsLoading &&
          !actionChoicesError &&
          (actions.length || unavailableActions.length) ? (
            <>
              <Select
                comboboxProps={{ withinPortal: false }}
                data={[
                  ...[...actionGroups].map(([key, { lead }]) => ({
                    label: [
                      lead.label,
                      lead.sourceLabel,
                      lead.actionCost && ACTIVATION_REGISTRY[lead.actionCost].label
                    ]
                      .filter(Boolean)
                      .join(' · '),
                    value: key
                  })),
                  // An action whose authored mechanics cannot run is listed, never selectable.
                  ...unavailableActions.map((action) => ({
                    label: action.label,
                    value: action.id,
                    disabled: true
                  }))
                ]}
                disabled={selectionControlsDisabled}
                label='Action'
                renderOption={({ option }) => {
                  const lead = actionGroups.get(option.value)?.lead
                  const reasons = lead
                    ? lead.warnings.map((warning) => warning.message).join(' ')
                    : unavailableActions.find((action) => action.id === option.value)?.reason
                  return reasons || lead?.attackSlot ? (
                    <div>
                      <Text c={reasons ? 'dimmed' : undefined} size='sm'>
                        {option.label}
                      </Text>
                      {lead?.attackSlot ? (
                        <Text c='dimmed' size='xs'>
                          {attackSlotLabel(lead.attackSlot)}
                        </Text>
                      ) : null}
                      {reasons ? (
                        <Text c='dimmed' size='xs'>
                          {reasons}
                        </Text>
                      ) : null}
                    </div>
                  ) : (
                    option.label
                  )
                }}
                searchable
                value={selectedAttackKey}
                onChange={(key) =>
                  setPickedActionId(key === null ? null : (actionGroups.get(key)?.lead.id ?? null))
                }
              />
              {gripActions.length > 1 ? (
                <SegmentedControl
                  aria-label='Grip'
                  data={gripActions.map((action) => ({
                    label: `${action.grip ? EQUIPMENT_GRIP_REGISTRY[action.grip.value].label : action.label}${action.damageLabel ? ` · ${action.damageLabel}` : ''}`,
                    value: action.id
                  }))}
                  disabled={selectionControlsDisabled}
                  fullWidth
                  value={actionId ?? undefined}
                  onChange={setPickedActionId}
                />
              ) : null}
              {choiceActorsTarget?.forms ? (
                <SegmentedControl
                  aria-label='Creature form'
                  data={choiceActorsTarget.forms.map((form) => ({
                    label: form.label,
                    value: form.id
                  }))}
                  disabled={selectionControlsDisabled}
                  fullWidth
                  value={chosenForm?.id}
                  onChange={(formId) => {
                    setPickedFormId(formId)
                    const cap = choiceActorsTarget.forms?.find(
                      (form) => form.id === formId
                    )?.maxTargets
                    if (cap !== undefined) setPickedActorIds((ids) => ids.slice(0, cap))
                  }}
                />
              ) : null}
              {choiceActorsTarget?.choosesCreatureForm ? (
                <CampaignTabletopFormCreaturePicker
                  disabled={selectionControlsDisabled}
                  systemId={encounter.gameSystemId}
                  value={pickedFormCreatureId}
                  onChange={setPickedFormCreatureId}
                />
              ) : null}
              {actorsTarget?.allowRepeatedTargets ? (
                <CampaignTabletopProjectileTargets
                  // A defeated creature isn't a target (D63); the server still warns if one is named.
                  creatures={encounter.actors.filter((actor) => !actor.defeated)}
                  disabled={selectionControlsDisabled}
                  maxTargets={actorsTarget.maxTargets}
                  value={pickedActorIds}
                  onChange={setPickedActorIds}
                />
              ) : actorsTarget ? (
                <MultiSelect
                  comboboxProps={{ withinPortal: false }}
                  // A defeated creature isn't a target (D63); the server still warns if one is named.
                  data={encounter.actors
                    .filter((actor) => !actor.defeated)
                    .map((actor) => ({ label: actor.label, value: actor.id }))}
                  disabled={selectionControlsDisabled}
                  label={`Targets (up to ${actorsTarget.maxTargets})`}
                  maxValues={actorsTarget.maxTargets}
                  searchable
                  value={pickedActorIds}
                  onChange={setPickedActorIds}
                />
              ) : null}
              {zoneTarget?.choiceOptions ? (
                <Select
                  allowDeselect={false}
                  comboboxProps={{ withinPortal: false }}
                  data={zoneTarget.choiceOptions.map((option) => ({
                    label: option.label,
                    value: option.id
                  }))}
                  disabled={selectionControlsDisabled}
                  label='Option'
                  value={chosenOption?.id ?? null}
                  onChange={setPickedChoiceOptionId}
                />
              ) : null}
              {sparesCreatures ? (
                <MultiSelect
                  comboboxProps={{ withinPortal: false }}
                  data={encounter.actors
                    .filter((actor) => actor.id !== currentActor?.id)
                    .map((actor) => ({ label: actor.label, value: actor.id }))}
                  disabled={selectionControlsDisabled}
                  label='Unaffected creatures'
                  searchable
                  value={unaffectedActorIds}
                  onChange={setUnaffectedActorIds}
                />
              ) : null}
              {areaTarget ? (
                <Stack gap='xs'>
                  <Text fw={600} size='sm'>
                    {areaTarget.kind === 'POINT' ? 'Area origin' : 'Area direction'}
                  </Text>
                  {scene === null ? (
                    <Text c='dimmed' size='sm'>
                      There is no Scene for this Encounter, so an area cannot be placed.
                    </Text>
                  ) : areaSize === null ? (
                    <Text c='dimmed' size='sm'>
                      This area cannot be drawn on the current Scene.
                    </Text>
                  ) : (
                    <>
                      <Group align='flex-end'>
                        <Button
                          disabled={selectionControlsDisabled}
                          variant='default'
                          onClick={onPickAreaOrigin}
                        >
                          {areaTarget.kind === 'POINT' ? 'Pick on map' : 'Aim on map'}
                        </Button>
                        {areaTarget.kind === 'POINT' ? (
                          <Select
                            comboboxProps={{ withinPortal: false }}
                            data={sceneTokens.map((token) => ({
                              label: token.label,
                              value: token.id
                            }))}
                            disabled={selectionControlsDisabled}
                            label='Center on token'
                            placeholder='Choose a token'
                            searchable
                            value={null}
                            onChange={(tokenId) => {
                              const token = sceneTokens.find(
                                (candidate) => candidate.id === tokenId
                              )
                              if (token) onAreaAimChange({ origin: token.position, toward: null })
                            }}
                          />
                        ) : (
                          <Text c='dimmed' size='sm'>
                            Drag from your token's edge toward where it points.
                          </Text>
                        )}
                      </Group>
                      {areaAim ? (
                        <>
                          <Text size='sm'>
                            In the area: {tokensInArea.length ? tokensInArea.join(', ') : 'no one'}
                          </Text>
                          <Button
                            disabled={selectionControlsDisabled}
                            size='compact-sm'
                            variant='subtle'
                            onClick={() => onAreaAimChange(null)}
                          >
                            {areaTarget.kind === 'POINT' ? 'Clear origin' : 'Clear aim'}
                          </Button>
                        </>
                      ) : null}
                    </>
                  )}
                </Stack>
              ) : centeredTarget ? (
                <Text c='dimmed' size='sm'>
                  {scene === null
                    ? 'There is no Scene for this Encounter, so an area cannot be placed.'
                    : `Centered on you: creatures within ${formatLengthMeasurement(centeredTarget.area.radius)} of your space are caught.`}
                </Text>
              ) : actorsTarget ? null : (
                <Group align='flex-end' wrap='nowrap'>
                  <Select
                    comboboxProps={{ withinPortal: false }}
                    data={targetableActors.map((actor) => ({
                      label: actor.label,
                      value: actor.id
                    }))}
                    disabled={selectionControlsDisabled}
                    label='Target'
                    searchable
                    value={targetActorId}
                    onChange={onTargetPick}
                  />
                  {selectedAction?.target.kind === 'ACTOR' ? (
                    <Button
                      disabled={selectionControlsDisabled}
                      variant='default'
                      onClick={() =>
                        onPickTargetOnMap({ actionId: selectedAction.id, selfRefused })
                      }
                    >
                      Pick on map
                    </Button>
                  ) : null}
                </Group>
              )}
              {selectedAction?.attackSlot ? (
                <Text fw={600} size='sm'>
                  {attackSlotLabel(selectedAction.attackSlot)}
                </Text>
              ) : null}
              {selectedAction ? (
                <Text c='dimmed' size='sm'>
                  {selectedAction.rangeLabel ?? 'System-defined range'}
                  {selectedAction.attackBonus === undefined
                    ? ''
                    : ` · ${selectedAction.attackBonus >= 0 ? '+' : ''}${selectedAction.attackBonus} to hit`}
                </Text>
              ) : null}
              {selectedAction?.warnings.length ? (
                <List c='dimmed' size='sm'>
                  {selectedAction.warnings.map((warning) => (
                    <List.Item key={warning.code}>{warning.message}</List.Item>
                  ))}
                </List>
              ) : null}
              {optionalRules.length && !namesNoCreature ? (
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
              {confirmingWarnings ? (
                <CampaignTabletopActionConfirmation
                  confirmIsPrimary={false}
                  confirmLabel='Do it anyway'
                  disabled={dependentControlsDisabled}
                  title='This breaks a rule'
                  onCancel={() => setRuleWarnings(null)}
                  onConfirm={() =>
                    void resolveAction(
                      confirmingWarnings.acceptedWieldConflict,
                      confirmingWarnings.warnings.map((warning) => warning.code)
                    )
                  }
                >
                  <List size='sm'>
                    {confirmingWarnings.warnings.map((warning) => (
                      <List.Item key={warning.code}>{warning.message}</List.Item>
                    ))}
                  </List>
                  <Text c='dimmed' size='xs'>
                    The GM sees every override in the Encounter history.
                  </Text>
                </CampaignTabletopActionConfirmation>
              ) : confirmingStow ? (
                <CampaignTabletopActionConfirmation
                  confirmIsPrimary
                  confirmLabel='Stow shield and attack'
                  disabled={dependentControlsDisabled}
                  title='Stow shield?'
                  onCancel={() => setStowConfirmationIdentity(null)}
                  onConfirm={() =>
                    void resolveAction(
                      {
                        kind: wieldConflict.kind,
                        shieldItemInstanceId: wieldConflict.shieldItemInstanceId
                      },
                      []
                    )
                  }
                >
                  <Text size='sm'>
                    Attacking with this weapon stows your shield. AC −
                    {-wieldConflict.armorClassDelta} until you equip it again.
                  </Text>
                </CampaignTabletopActionConfirmation>
              ) : (
                <Group>
                  {isGm ? <GmRollVisibilityToggle /> : null}
                  <Button
                    disabled={
                      dependentControlsDisabled ||
                      !selectedAction ||
                      !target ||
                      incompleteOptionalChoices ||
                      currentOptionalChoicesError !== null
                    }
                    loading={submitting}
                    onClick={() =>
                      wieldConflict
                        ? setStowConfirmationIdentity(choiceRequestIdentity)
                        : void resolveAction(null, [])
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
          {currentActor && !actionsLoading && !actionChoicesError && basicActionChoices.length ? (
            <CampaignTabletopBasicActions
              actorId={currentActor.id}
              authoredActions={basicActionChoices}
              creatures={encounter.actors
                .filter((actor) => actor.id === currentActor.id || !actor.defeated)
                .map((actor) => ({ id: actor.id, label: actor.label }))}
              disabled={selectionControlsDisabled}
              encounterId={encounter.id}
              encounterVersion={encounter.version}
              onResolve={onResolve}
            />
          ) : null}
          {currentActor && !actionsLoading && !actionChoicesError && escapes.length ? (
            <CampaignTabletopEscapes
              actorId={currentActor.id}
              disabled={selectionControlsDisabled}
              encounterId={encounter.id}
              encounterVersion={encounter.version}
              escapes={escapes}
              onEscape={onEscape}
            />
          ) : null}
          {currentActor && !actionsLoading && !actionChoicesError && heldGrantEnds.length ? (
            <CampaignTabletopHeldGrantEnds
              actorId={currentActor.id}
              disabled={selectionControlsDisabled}
              encounterId={encounter.id}
              encounterVersion={encounter.version}
              heldGrantEnds={heldGrantEnds}
              onEnd={onEndHeldGrant}
            />
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
