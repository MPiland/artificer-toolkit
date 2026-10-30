import {
  ActionIcon,
  Alert,
  Button,
  Drawer,
  Group,
  List,
  MultiSelect,
  Radio,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Tooltip
} from '@mantine/core'
import { Swords } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type {
  EncounterActionChoiceDto,
  EncounterActionChoicesDto,
  EncounterActionItemChoicesDto,
  EncounterEffectOfferChoiceDto,
  EncounterEscapeChoiceDto,
  EncounterHeldGrantEndChoiceDto,
  EncounterOptionalActionChoicesDto,
  EncounterReleaseChoiceDto,
  GetEncounterActionItemChoicesInputDto,
  GetEncounterOptionalActionChoicesInputDto
} from '@artificer-toolkit/schema/api/encounterActionChoices'
import type {
  EncounterCommandResultDto,
  EncounterGmProjectionDto,
  EncounterPlayerProjectionDto,
  EndHeldGrantInputDto,
  EscapeRelationshipInputDto,
  MoveHeldEffectInputDto,
  ReleaseRelationshipInputDto,
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
  authoredLengthInSceneCoordinates,
  directedAreaSizeInSceneCoordinates,
  pointAreaInSceneCoordinates,
  type SpatialWallSide,
  spatialTokensInsideArea,
  wallAreaBoundsInSceneCoordinates
} from '@artificer-toolkit/shared/vtt'
import { GmRollVisibilityToggle } from '#app/components/dice/GmRollVisibilityToggle'
import { useGmRollVisibilityPreference } from '#app/settings/useGmRollVisibilityPreference'
import { CampaignTabletopActionConfirmation } from './CampaignTabletopActionConfirmation'
import { CampaignTabletopBasicActions } from './CampaignTabletopBasicActions'
import { CampaignTabletopEscapes } from './CampaignTabletopEscapes'
import { CampaignTabletopFormCreaturePicker } from './CampaignTabletopFormCreaturePicker'
import { CampaignTabletopEffectOffers } from './CampaignTabletopEffectOffers'
import { CampaignTabletopHeldGrantEnds } from './CampaignTabletopHeldGrantEnds'
import { CampaignTabletopReleases } from './CampaignTabletopReleases'
import { CampaignTabletopSummonPicks } from './CampaignTabletopSummonPicks'
import { summonPicks } from './summonPicks.model'
import { CampaignTabletopProjectileTargets } from './CampaignTabletopProjectileTargets'
import { LiveSessionCommandRejectedError } from './liveSessionClient'
import {
  aimedAreaShape,
  type VttActionPreview,
  type VttAreaAim,
  type VttAreaSize
} from './vttSceneRenderer.model'
import { effectOfferKey, isMoveEffectOffer } from './effectOffers.model'
import { targetableEncounterActors, type VttTargetingRequest } from './vttTargeting.model'

const NO_TOKENS: CampaignSceneStateDto['tokens'] = []

/** How the drawer words each way of aiming an area on the map. */
const AREA_AIM_COPY = {
  POINT: { title: 'Area origin', pick: 'Pick on map', clear: 'Clear origin', hint: null },
  DIRECTED: {
    title: 'Area direction',
    pick: 'Aim on map',
    clear: 'Clear aim',
    hint: "Drag from your token's edge toward where it points."
  },
  WALL: {
    title: 'Wall',
    pick: 'Draw on map',
    clear: 'Clear wall',
    hint: 'Drag from one end of the wall to the other.'
  },
  RING: {
    title: 'Ring',
    pick: 'Draw on map',
    clear: 'Clear ring',
    hint: "Drag from the ring's center out to its edge."
  }
} as const

/** The sides of a drawn wall a zone's band can reach (D154): a wall's as drawn, or a ring's. */
const BAND_SIDES = {
  WALL: [
    { label: 'Left as drawn', value: 'LEFT' },
    { label: 'Right as drawn', value: 'RIGHT' }
  ],
  RING: [
    { label: 'Inside', value: 'INSIDE' },
    { label: 'Outside', value: 'OUTSIDE' }
  ]
} as const satisfies Record<
  'WALL' | 'RING',
  ReadonlyArray<{ label: string; value: SpatialWallSide }>
>

function attackSlotLabel({ number, total }: NonNullable<EncounterActionChoiceDto['attackSlot']>) {
  return `Attack ${number} of ${total}`
}

export function CampaignTabletopActionDrawer({
  actions,
  basicActionChoices,
  escapes,
  heldGrantEnds,
  effectOffers,
  releases,
  openAttackAction,
  defaultActionId,
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
  onMoveHeldEffect,
  onRelease,
  onLoadOptionalChoices,
  onLoadItemChoices
}: {
  actions: EncounterActionChoiceDto[]
  /** The System's authored basic actions, which resolve like any action. */
  basicActionChoices: EncounterActionChoiceDto[]
  escapes: EncounterEscapeChoiceDto[]
  heldGrantEnds: EncounterHeldGrantEndChoiceDto[]
  effectOffers: EncounterEffectOfferChoiceDto[]
  releases: EncounterReleaseChoiceDto[]
  /** The Attack action opened this turn; its last target is preselected for the next attack. */
  openAttackAction: EncounterActionChoicesDto['openAttackAction']
  /** The action the server picks to start on: the open Attack action's weapon, else the held weapon's (D107). */
  defaultActionId: EncounterActionChoicesDto['defaultActionId']
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
  onMoveHeldEffect: (command: MoveHeldEffectInputDto) => Promise<EncounterCommandResultDto>
  onRelease: (command: ReleaseRelationshipInputDto) => Promise<EncounterCommandResultDto>
  onLoadOptionalChoices: (
    request: GetEncounterOptionalActionChoicesInputDto
  ) => Promise<EncounterOptionalActionChoicesDto>
  /** The items of the picked creature an action that `choosesItem` may be used on. */
  onLoadItemChoices: (
    request: GetEncounterActionItemChoicesInputDto
  ) => Promise<EncounterActionItemChoicesDto>
}) {
  // `undefined` is untouched (the server's default action and the open Attack action's last target apply); `null` is cleared.
  const [pickedActionId, setPickedActionId] = useState<string | null | undefined>(undefined)
  // The attacks made when the viewer chose "Done attacking"; the next attack opens the panel again.
  const [endedAttackActionAfter, setEndedAttackActionAfter] = useState<number | null>(null)
  const [pickedActorIds, setPickedActorIds] = useState<string[]>([])
  const [chosenOfferKey, setChosenOfferKey] = useState<string | null>(null)
  const [unaffectedActorIds, setUnaffectedActorIds] = useState<string[]>([])
  const [pickedChoiceOptionId, setPickedChoiceOptionId] = useState<string | null>(null)
  const [pickedFormId, setPickedFormId] = useState<string | null>(null)
  const [pickedFormCreatureId, setPickedFormCreatureId] = useState<string | null>(null)
  const [pickedCreatureTypeId, setPickedCreatureTypeId] = useState<string | null>(null)
  const [pickedBandSide, setPickedBandSide] = useState<SpatialWallSide | null>(null)
  const [pickedOptionalRuleId, setOptionalRuleId] = useState<string | null>(null)
  const [optionalChoices, setOptionalChoices] = useState<{
    requestIdentity: string
    value: EncounterOptionalActionChoicesDto
  } | null>(null)
  const [optionalValues, setOptionalValues] = useState<Record<string, string>>({})
  const [itemChoices, setItemChoices] = useState<{
    requestIdentity: string
    value: EncounterActionItemChoicesDto['items'] | string
  } | null>(null)
  const [pickedItemId, setPickedItemId] = useState<string | null>(null)
  // The last ammunition stack picked stays preselected across actions while it still fits; it is
  // this panel's state only, never saved (ATTACK-19.4).
  const [pickedAmmunitionId, setPickedAmmunitionId] = useState<string | null>(null)
  const [optionalChoicesError, setOptionalChoicesError] = useState<{
    requestIdentity: string
    value: string
  } | null>(null)
  const { gmRollVisibility } = useGmRollVisibilityPreference()
  const [submitting, setSubmitting] = useState(false)
  const [stowConfirmationIdentity, setStowConfirmationIdentity] = useState<string | null>(null)
  // The hold the attacker lets go of to free a hand, picked for this exact selection.
  const [handRelease, setHandRelease] = useState<{
    requestIdentity: string
    activeEffectId: string | null
  } | null>(null)
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
  // "Done attacking" is the viewer's own: it ends the panel and the preselection, while the server's
  // Attack action stays open until the turn ends.
  const attackActionEnded =
    openAttackAction !== null && endedAttackActionAfter === openAttackAction.made
  const liveAttackAction = attackActionEnded ? null : openAttackAction
  const noAttackActionOpen = openAttackAction === null
  if (noAttackActionOpen && endedAttackActionAfter !== null) setEndedAttackActionAfter(null)
  const offeredAttackLabels = [
    ...new Set(actions.flatMap((action) => (action.attackSlot ? [action.label] : [])))
  ]
  const attackActionLeft = offeredAttackLabels.length
    ? `${liveAttackAction?.complete ? 'Optional' : 'Left'}: ${offeredAttackLabels.join(', ')}`
    : 'No attack left in this action.'
  const preselectedActionId = attackActionEnded
    ? null
    : (actions.find((action) => action.id === defaultActionId)?.id ?? null)
  const preselectedTargetActorId =
    liveAttackAction?.lastTargetIds.find((id) =>
      encounter.actors.some((actor) => actor.id === id && !actor.defeated)
    ) ?? null
  const actionId = pickedActionId === undefined ? preselectedActionId : pickedActionId
  const selectedAction = actions.find((action) => action.id === actionId) ?? null
  const choiceTarget = selectedAction?.target
  // A defeated creature isn't a target (D63; the server still warns if one is named), and neither is
  // the acting creature when the action refuses itself (Help, First Aid).
  const selfRefused = choiceTarget?.kind === 'ACTOR' && choiceTarget.self === 'REFUSED'
  const onlyActorIds =
    choiceTarget?.kind === 'ACTOR' && choiceTarget.heldBySource
      ? releases.map(({ heldActorId }) => heldActorId)
      : undefined
  const targetableActors = targetableEncounterActors(
    encounter.actors,
    currentActorId,
    selfRefused,
    onlyActorIds
  )
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
  const summonChoices = summonPicks(choiceTarget, pickedFormId, pickedCreatureTypeId)
  // A cast that picks one of several zones (D140, D154) or what it does to its targets (D148) sends
  // the chosen one; the first is preselected. A zone option is then aimed as its own target asks.
  const zoneOptions = choiceTarget?.kind === 'ZONE_OPTIONS' ? choiceTarget.options : undefined
  const chosenZoneOption =
    zoneOptions?.find((option) => option.id === pickedChoiceOptionId) ?? zoneOptions?.[0] ?? null
  const actionChoiceOptions =
    choiceTarget && 'choiceOptions' in choiceTarget ? choiceTarget.choiceOptions : undefined
  const chosenActionOption =
    actionChoiceOptions?.find((option) => option.id === pickedChoiceOptionId) ??
    actionChoiceOptions?.[0] ??
    null
  const choiceOptions = zoneOptions ?? actionChoiceOptions
  const chosenOption = chosenZoneOption ?? chosenActionOption
  const castChoice = chosenOption ? { choiceOptionId: chosenOption.id } : {}
  // An action used on an item (Shillelagh, Heat Metal) sends the item picked from its creature's.
  const choosesItem = choiceTarget?.kind === 'ACTOR' && choiceTarget.choosesItem === true
  const itemOwnerActorId = choosesItem ? targetActorId : null
  const itemRequestIdentity = JSON.stringify([
    encounter.id,
    encounter.version,
    currentActorId,
    selectedAction?.id,
    itemOwnerActorId
  ])
  const currentItemChoices =
    itemChoices?.requestIdentity === itemRequestIdentity ? itemChoices.value : null
  const itemOptions = Array.isArray(currentItemChoices) ? currentItemChoices : null
  const itemChoicesError = typeof currentItemChoices === 'string' ? currentItemChoices : null
  const chosenItemId =
    itemOptions?.find((item) => item.id === pickedItemId)?.id ?? itemOptions?.[0]?.id ?? null
  const itemChoice = chosenItemId ? { boundItemInstanceId: chosenItemId } : {}
  const ammunitionOptions = selectedAction?.ammunition ?? []
  const chosenAmmunition =
    ammunitionOptions.find((stack) => stack.itemInstanceId === pickedAmmunitionId) ??
    ammunitionOptions[0] ??
    null
  const ammunitionChoice = chosenAmmunition
    ? { ammunitionItemInstanceId: chosenAmmunition.itemInstanceId }
    : {}
  const aimedTarget = chosenZoneOption?.target ?? choiceTarget
  const areaTarget =
    aimedTarget?.kind === 'POINT' || aimedTarget?.kind === 'DIRECTED'
      ? aimedTarget
      : actorsTarget?.area
        ? { kind: 'POINT' as const, area: actorsTarget.area }
        : null
  // A wall's endpoints or a ring's center and size are drawn on the map (D154).
  const drawnTarget =
    aimedTarget?.kind === 'WALL' || aimedTarget?.kind === 'RING' ? aimedTarget : null
  const aimKind = areaTarget?.kind ?? drawnTarget?.kind ?? null
  // A zone that also reaches a band beside its wall takes the side the caster picks after aiming.
  const bandSides = drawnTarget?.sideBand ? BAND_SIDES[drawnTarget.kind] : null
  const bandSide = bandSides?.find((side) => side.value === pickedBandSide)?.value ?? null
  // A caster-centered area takes no aim, so it has no target to pick.
  const centeredTarget = aimedTarget?.kind === 'CASTER_CENTERED' ? aimedTarget : null
  // A zone the action places can spare creatures the caster designates at cast.
  const sparesCreatures =
    choiceTarget !== undefined &&
    'choosesUnaffected' in choiceTarget &&
    choiceTarget.choosesUnaffected === true
  const zoneChoices = {
    ...(sparesCreatures && unaffectedActorIds.length ? { unaffectedActorIds } : {}),
    ...castChoice
  }
  const namesNoCreature =
    areaTarget !== null || drawnTarget !== null || centeredTarget !== null || actorsTarget !== null
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
    if (!sceneGrid) return null
    if (drawnTarget) {
      const bounds = wallAreaBoundsInSceneCoordinates(
        drawnTarget.kind === 'WALL'
          ? { kind: 'WALL', ...drawnTarget.area }
          : { kind: 'RING', ...drawnTarget.area },
        sceneGrid
      )
      const bandDistance =
        drawnTarget.sideBand &&
        authoredLengthInSceneCoordinates(drawnTarget.sideBand.distance, sceneGrid)
      if (!bounds || bandDistance === null) return null
      return {
        kind: drawnTarget.kind,
        ...bounds,
        ...(bandDistance && bandSide ? { band: { distance: bandDistance, side: bandSide } } : {})
      }
    }
    if (!areaTarget) return null
    if (areaTarget.kind === 'POINT') return pointAreaInSceneCoordinates(areaTarget.area, sceneGrid)
    return sourceTokenId ? directedAreaSizeInSceneCoordinates(areaTarget.area, sceneGrid) : null
  }, [areaTarget, bandSide, drawnTarget, sceneGrid, sourceTokenId])
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
  const drawnShape = drawnTarget && areaSize && areaAim ? aimedAreaShape(areaSize, areaAim) : null
  const drawnCommandTarget: ResolveEncounterActionInputDto['target'] | null =
    !scene || !areaAim || !drawnShape || (bandSides && !bandSide)
      ? null
      : drawnShape.kind === 'WALL'
        ? {
            kind: 'WALL',
            sceneId: scene.id,
            expectedSceneVersion: scene.version,
            from: areaAim.origin,
            to: drawnShape.to,
            ...(bandSide === 'LEFT' || bandSide === 'RIGHT' ? { side: bandSide } : {}),
            ...zoneChoices
          }
        : drawnShape.kind === 'RING'
          ? {
              kind: 'RING',
              sceneId: scene.id,
              expectedSceneVersion: scene.version,
              center: areaAim.origin,
              outerRadius: drawnShape.outerRadius,
              ...(bandSide === 'INSIDE' || bandSide === 'OUTSIDE' ? { side: bandSide } : {}),
              ...zoneChoices
            }
          : null
  const areaCommandTarget: ResolveEncounterActionInputDto['target'] | null =
    !areaTarget || !scene || !areaAim || !areaSize
      ? null
      : areaTarget.kind === 'POINT'
        ? {
            kind: 'POINT',
            sceneId: scene.id,
            expectedSceneVersion: scene.version,
            point: areaAim.origin,
            ...zoneChoices,
            ...summonChoices
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
          ...castChoice,
          ...ammunitionChoice,
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
      : drawnTarget
        ? drawnCommandTarget
        : centeredTarget
          ? scene
            ? {
                kind: 'CASTER_CENTERED',
                sceneId: scene.id,
                expectedSceneVersion: scene.version,
                ...zoneChoices
              }
            : null
          : targetActorId && (!choosesItem || chosenItemId)
            ? {
                kind: 'ACTOR',
                actorId: targetActorId,
                ...castChoice,
                ...itemChoice,
                ...ammunitionChoice
              }
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
  // An effect offer's pick is measured from the effect's holder, and only a live creature other than the holder may take it.
  const moveOffers = effectOffers.filter(isMoveEffectOffer)
  const chosenOffer = moveOffers.find((offer) => effectOfferKey(offer) === chosenOfferKey) ?? null
  const offerTargetActorId =
    chosenOffer &&
    pickedTargetActorId &&
    pickedTargetActorId !== chosenOffer.holderActorId &&
    encounter.actors.some((actor) => actor.id === pickedTargetActorId && !actor.defeated)
      ? pickedTargetActorId
      : null
  const tokenIdOfActor = (actorId: string | null) =>
    actorId
      ? (sceneTokens.find((token) => actorIdByTokenId.get(token.id) === actorId)?.id ?? null)
      : null
  // The Scene measure between two actors' tokens, when both stand on the bound Scene.
  const sceneContextBetween = (sourceActorId: string, targetActorId: string) => {
    const sourceTokenId = tokenIdOfActor(sourceActorId)
    const targetTokenId = tokenIdOfActor(targetActorId)
    return scene && sourceTokenId && targetTokenId
      ? { sceneId: scene.id, expectedSceneVersion: scene.version, sourceTokenId, targetTokenId }
      : null
  }
  const offerHolderTokenId = tokenIdOfActor(chosenOffer?.holderActorId ?? null)
  const offerTargetTokenId = tokenIdOfActor(offerTargetActorId)
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
  const selectionControlsDisabled =
    !connected ||
    pending ||
    submitting ||
    waitingOn !== null ||
    actionsLoading ||
    actionChoicesError !== null
  const optionalChoicesLoading =
    opened &&
    currentActorId !== null &&
    selectedActionId !== null &&
    targetActorId !== null &&
    selectedOptionalRuleId !== null &&
    currentOptionalChoices === null &&
    currentOptionalChoicesError === null
  const dependentControlsDisabled = selectionControlsDisabled || optionalChoicesLoading
  // A held-weapon stow is offered only on a basic action (D152).
  const wieldConflict =
    optionalRuleId === null && selectedAction?.wieldConflict?.kind === 'STOW_SHIELD'
      ? selectedAction.wieldConflict
      : null
  const confirmingStow =
    wieldConflict !== null && stowConfirmationIdentity === choiceRequestIdentity
  // Releasing a held creature to free a hand for the attack is offered when it is the only blocker.
  const handReleaseHolds = optionalRuleId === null ? (selectedAction?.handRelease?.holds ?? []) : []
  const confirmingHandRelease =
    handReleaseHolds.length > 0 && handRelease?.requestIdentity === choiceRequestIdentity
  const handReleaseChoice = confirmingHandRelease
    ? (handRelease.activeEffectId ??
      (handReleaseHolds.length === 1 ? handReleaseHolds[0]!.activeEffectId : null))
    : null
  const confirmingWarnings =
    ruleWarnings?.requestIdentity === choiceRequestIdentity ? ruleWarnings : null
  const incompleteOptionalChoices =
    optionalRuleId !== null &&
    (!selectedOptionalRule ||
      !currentOptionalChoices ||
      currentOptionalChoices.fields.some((field) => !optionalValues[field.fieldId]))

  const [trackedTurnActorId, setTrackedTurnActorId] = useState(encounter.currentActorId)
  if (trackedTurnActorId !== encounter.currentActorId) {
    setTrackedTurnActorId(encounter.currentActorId)
    setPickedActionId(undefined)
    setPickedActorIds([])
    setChosenOfferKey(null)
    setOptionalRuleId(null)
    setFeedback(null)
    setError(null)
  }
  useEffect(() => {
    onTargetPick(undefined)
  }, [encounter.currentActorId, onTargetPick])

  const [trackedChoiceRequest, setTrackedChoiceRequest] = useState({
    identity: choiceRequestIdentity,
    opened
  })
  if (
    trackedChoiceRequest.identity !== choiceRequestIdentity ||
    trackedChoiceRequest.opened !== opened
  ) {
    setTrackedChoiceRequest({ identity: choiceRequestIdentity, opened })
    setOptionalValues({})
  }

  useEffect(() => {
    if (
      !opened ||
      !currentActorId ||
      !selectedActionId ||
      !targetActorId ||
      !selectedOptionalRuleId
    )
      return
    let current = true
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
        if (!current) return
        setOptionalChoices({ requestIdentity: choiceRequestIdentity, value: nextChoices })
        setOptionalChoicesError(null)
      })
      .catch((nextError: unknown) => {
        if (!current) return
        setOptionalChoices(null)
        setOptionalChoicesError({
          requestIdentity: choiceRequestIdentity,
          value:
            nextError instanceof Error ? nextError.message : 'Optional choices could not be loaded.'
        })
      })
    return () => {
      current = false
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

  useEffect(() => {
    if (!opened || !currentActorId || !selectedActionId || !itemOwnerActorId) return
    let current = true
    const requestIdentity = itemRequestIdentity
    void onLoadItemChoices({
      encounterId: encounter.id,
      expectedVersion: encounter.version,
      actorId: currentActorId,
      actionId: selectedActionId,
      targetActorId: itemOwnerActorId
    })
      .then(({ items }) => {
        if (current)
          setItemChoices({
            requestIdentity,
            value: items.length ? items : 'The target has no item this action can be used on.'
          })
      })
      .catch((nextError: unknown) => {
        if (current)
          setItemChoices({
            requestIdentity,
            value: nextError instanceof Error ? nextError.message : 'Items could not be loaded.'
          })
      })
    return () => {
      current = false
    }
  }, [
    currentActorId,
    encounter.id,
    encounter.version,
    itemOwnerActorId,
    itemRequestIdentity,
    onLoadItemChoices,
    opened,
    selectedActionId
  ])

  // An origin belongs to the action, and the zone, it was picked for.
  const chosenZoneOptionId = chosenZoneOption?.id ?? null
  useEffect(() => {
    onAreaAimChange(null)
  }, [onAreaAimChange, selectedActionId, chosenZoneOptionId])

  // So do the creatures chosen.
  const [trackedActionId, setTrackedActionId] = useState(selectedActionId)
  if (trackedActionId !== selectedActionId) {
    setTrackedActionId(selectedActionId)
    setPickedActorIds([])
    setUnaffectedActorIds([])
    setPickedChoiceOptionId(null)
    setPickedFormId(null)
    setPickedCreatureTypeId(null)
    setPickedBandSide(null)
    setPickedItemId(null)
  }

  useEffect(() => {
    onAreaSizeChange(areaSize)
    return () => onAreaSizeChange(null)
  }, [areaSize, onAreaSizeChange])

  // An area's target is its origin, which the stage draws as the area, so only a creature target is ringed.
  const actionPreview = useMemo<VttActionPreview | null>(
    () =>
      chosenOffer
        ? offerHolderTokenId
          ? {
              range: { kind: 'WITHIN', distance: chosenOffer.range },
              sourceTokenId: offerHolderTokenId,
              targetTokenId: offerTargetTokenId
            }
          : null
        : selectedAction && sourceTokenId
          ? {
              range: selectedAction.range,
              sourceTokenId,
              targetTokenId: selectedAction.target.kind === 'ACTOR' ? targetTokenId : null
            }
          : null,
    [
      chosenOffer,
      offerHolderTokenId,
      offerTargetTokenId,
      selectedAction,
      sourceTokenId,
      targetTokenId
    ]
  )

  useEffect(() => {
    onActionPreviewChange(actionPreview)
    return () => onActionPreviewChange(null)
  }, [actionPreview, onActionPreviewChange])

  async function releaseThenResolve(
    activeEffectId: string | null,
    stow: typeof wieldConflict
  ): Promise<void> {
    const hold = releases.find((release) => release.activeEffectId === activeEffectId)
    if (!currentActor || !hold) return
    setError(null)
    try {
      const released = await onRelease({
        type: 'RELEASE_RELATIONSHIP',
        encounterId: encounter.id,
        commandId: crypto.randomUUID(),
        expectedVersion: encounter.version,
        actorId: currentActor.id,
        heldActorId: hold.heldActorId,
        activeEffectId: hold.activeEffectId
      })
      await resolveAction(
        stow ? { kind: stow.kind, shieldItemInstanceId: stow.shieldItemInstanceId } : null,
        [],
        released.projection.version
      )
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : 'The creature could not be released.'
      )
    }
  }

  async function resolveAction(
    acceptedWieldConflict: ResolveEncounterActionInputDto['acceptedWieldConflict'],
    acknowledgedWarnings: ResolveEncounterActionInputDto['acknowledgedWarnings'],
    expectedVersion = encounter.version
  ): Promise<void> {
    setStowConfirmationIdentity(null)
    setHandRelease(null)
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
        expectedVersion,
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
      if (aimKind) onAreaAimChange(null)
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
              {liveAttackAction ? (
                <Group align='center' justify='space-between' wrap='nowrap'>
                  <Stack gap={0}>
                    <Text fw={600} size='sm'>
                      {`Attack action: ${liveAttackAction.made} of ${liveAttackAction.total} made`}
                    </Text>
                    <Text c='dimmed' size='sm'>
                      {attackActionLeft}
                    </Text>
                  </Stack>
                  <Button
                    size='compact-sm'
                    variant='subtle'
                    onClick={() => setEndedAttackActionAfter(liveAttackAction.made)}
                  >
                    Done attacking
                  </Button>
                </Group>
              ) : null}
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
              {choiceTarget?.kind === 'POINT' ? (
                <CampaignTabletopSummonPicks
                  target={choiceTarget}
                  {...summonChoices}
                  disabled={selectionControlsDisabled}
                  onFormChange={setPickedFormId}
                  onCreatureTypeChange={setPickedCreatureTypeId}
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
              {actorsTarget?.allowRepeatedTargets && actorsTarget.maxTargets !== undefined ? (
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
                  // A list with no cap names each creature once (Pass without Trace).
                  label={
                    actorsTarget.maxTargets === undefined
                      ? 'Targets'
                      : `Targets (up to ${actorsTarget.maxTargets})`
                  }
                  maxValues={actorsTarget.maxTargets}
                  searchable
                  value={pickedActorIds}
                  onChange={setPickedActorIds}
                />
              ) : null}
              {choiceOptions ? (
                <Select
                  allowDeselect={false}
                  comboboxProps={{ withinPortal: false }}
                  data={choiceOptions.map((option) => ({
                    label: option.label,
                    value: option.id
                  }))}
                  disabled={selectionControlsDisabled}
                  label='Option'
                  value={chosenOption?.id ?? null}
                  onChange={setPickedChoiceOptionId}
                />
              ) : null}
              {itemOptions ? (
                <Select
                  allowDeselect={false}
                  comboboxProps={{ withinPortal: false }}
                  data={itemOptions.map((item) => ({ label: item.label, value: item.id }))}
                  disabled={selectionControlsDisabled}
                  label='Item'
                  value={chosenItemId}
                  onChange={setPickedItemId}
                />
              ) : null}
              {ammunitionOptions.length ? (
                <Select
                  allowDeselect={false}
                  comboboxProps={{ withinPortal: false }}
                  data={ammunitionOptions.map((stack) => ({
                    label: `${stack.label} (${stack.quantity})`,
                    value: stack.itemInstanceId
                  }))}
                  disabled={selectionControlsDisabled}
                  label='Ammunition'
                  value={chosenAmmunition?.itemInstanceId ?? null}
                  onChange={setPickedAmmunitionId}
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
              {aimKind ? (
                <Stack gap='xs'>
                  <Text fw={600} size='sm'>
                    {AREA_AIM_COPY[aimKind].title}
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
                          {AREA_AIM_COPY[aimKind].pick}
                        </Button>
                        {aimKind === 'POINT' ? (
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
                            {AREA_AIM_COPY[aimKind].hint}
                          </Text>
                        )}
                      </Group>
                      {areaAim ? (
                        <>
                          {bandSides && drawnTarget?.sideBand ? (
                            <Stack gap={4}>
                              <Text size='sm'>
                                It also reaches{' '}
                                {formatLengthMeasurement(drawnTarget.sideBand.distance)} on one
                                side:
                              </Text>
                              <SegmentedControl
                                aria-label='Side the zone also reaches'
                                data={[...bandSides]}
                                disabled={selectionControlsDisabled}
                                fullWidth
                                value={bandSide ?? ''}
                                onChange={(value) =>
                                  setPickedBandSide(
                                    bandSides.find((side) => side.value === value)?.value ?? null
                                  )
                                }
                              />
                            </Stack>
                          ) : null}
                          <Text size='sm'>
                            In the area: {tokensInArea.length ? tokensInArea.join(', ') : 'no one'}
                          </Text>
                          <Button
                            disabled={selectionControlsDisabled}
                            size='compact-sm'
                            variant='subtle'
                            onClick={() => onAreaAimChange(null)}
                          >
                            {AREA_AIM_COPY[aimKind].clear}
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
                    : centeredTarget.area.kind === 'OWN_SPACE'
                      ? 'Creatures sharing your space are caught.'
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
                        onPickTargetOnMap({
                          actionId: selectedAction.id,
                          selfRefused,
                          onlyActorIds
                        })
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
              {selectedAction?.componentsLabel ? (
                <Text c='dimmed' size='sm'>
                  Components: {selectedAction.componentsLabel}
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
              ) : confirmingHandRelease ? (
                <CampaignTabletopActionConfirmation
                  confirmIsPrimary
                  confirmLabel='Release and attack'
                  disabled={dependentControlsDisabled || handReleaseChoice === null}
                  title='Free a hand?'
                  onCancel={() => setHandRelease(null)}
                  onConfirm={() => void releaseThenResolve(handReleaseChoice, wieldConflict)}
                >
                  <Radio.Group
                    label='Release which creature?'
                    value={handReleaseChoice}
                    onChange={(activeEffectId) =>
                      setHandRelease({ requestIdentity: choiceRequestIdentity, activeEffectId })
                    }
                  >
                    <Stack gap='xs' mt='xs'>
                      {handReleaseHolds.map(({ activeEffectId }) => (
                        <Radio
                          key={activeEffectId}
                          label={
                            releases.find((release) => release.activeEffectId === activeEffectId)
                              ?.label ?? 'Held creature'
                          }
                          value={activeEffectId}
                        />
                      ))}
                    </Stack>
                  </Radio.Group>
                  <Text c='dimmed' size='xs'>
                    Releasing is free. The attack draws the weapon into the freed hand
                    {wieldConflict ? ' and stows your shield' : ''}.
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
                      handReleaseHolds.length
                        ? setHandRelease({
                            requestIdentity: choiceRequestIdentity,
                            activeEffectId: null
                          })
                        : wieldConflict
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
              sceneContext={(targetActorId) => sceneContextBetween(currentActor.id, targetActorId)}
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
          {currentActor && !actionsLoading && !actionChoicesError && effectOffers.length ? (
            <CampaignTabletopEffectOffers
              actorId={currentActor.id}
              chosenOfferKey={chosenOffer ? chosenOfferKey : null}
              creatures={encounter.actors.filter((actor) => !actor.defeated)}
              disabled={selectionControlsDisabled}
              encounterId={encounter.id}
              encounterVersion={encounter.version}
              holderLabel={(holderActorId) =>
                encounter.actors.find((actor) => actor.id === holderActorId)?.label ?? 'a creature'
              }
              offers={effectOffers}
              sceneContext={(offer, newHolderActorId) =>
                sceneContextBetween(offer.holderActorId, newHolderActorId)
              }
              repeatSceneContext={(offer) =>
                sceneContextBetween(offer.originActorId ?? currentActor.id, offer.holderActorId)
              }
              targetActorId={offerTargetActorId}
              onChooseOffer={setChosenOfferKey}
              onMove={onMoveHeldEffect}
              onResolve={onResolve}
              onPickOnMap={() =>
                onPickTargetOnMap({
                  actionId: null,
                  selfRefused: false,
                  onlyActorIds: undefined
                })
              }
              onTargetPick={onTargetPick}
            />
          ) : null}
          {currentActor && !actionsLoading && !actionChoicesError && releases.length ? (
            <CampaignTabletopReleases
              disabled={selectionControlsDisabled}
              encounterId={encounter.id}
              encounterVersion={encounter.version}
              releases={releases.map((release) => ({ ...release, sourceActorId: currentActor.id }))}
              onRelease={onRelease}
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
          {itemChoicesError ? (
            <Alert aria-live='assertive' color='red'>
              {itemChoicesError}
            </Alert>
          ) : null}
        </Stack>
      </Drawer>
    </>
  )
}
