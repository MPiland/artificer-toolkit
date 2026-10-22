import { zoneMovementCostMultiplierSchema } from '@artificer-toolkit/schema/shared/spatial'
import type {
  CompiledEffectGroup,
  CompiledManifestComponent
} from '@artificer-toolkit/shared/compilers'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type {
  CharacterRuleActionActiveEffectPlan,
  CharacterRuleActionZoneChoicePlan,
  CharacterRuleActionZonePlacementPlan
} from '../../characterRuleActionSystemAdapter.js'
import { encounterZoneChoiceTarget } from '../../encounterAreaAction.js'
import { castChoiceOptions } from '../../encounterCastChoice.js'
import {
  passiveMeleeRetaliationZone,
  placedSpaceZone,
  zoneTriggers,
  type PlacedSpaceZone
} from '../../encounterZonePlacement.js'
import { selectScalingRow } from '../../scalingRowSelection.js'
import { scaledShapeMeasurements } from '../../shapeMeasurement.js'
import { dnd5eAttackKind } from './attackKind.js'
import {
  DND5E_ACTIVE_EFFECT_SAVE_SUCCESS_IMMUNITY_FACT_KEY,
  DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
  UUID,
  damageMultiplier,
  damageTypeIdentity,
  unsupported,
  uuid,
  type EntryDiceDamageOutcome,
  type Outcome
} from './effectActionContracts.js'
import type { Dnd5eCompiledEffectActionSource, ZoneCompilerPieces } from './effectActionCompiler.js'
import { conditionDurationTurns, dnd5eRepeatSave } from './effectActionFollowUp.js'
import { boundedDiceTerm } from './effectActionScalingFacts.js'

/**
 * The zone an action places (D140, D153–D156): a passive melee trait's retaliating zone, the zones a
 * cast picks one of, or a placed-space or source manifest's zone; null for any other action. It
 * composes the compiler's test-phase, outcome and lifetime pieces, passed in until RULES-2.T6g gives
 * them modules of their own.
 */
export function compileDnd5eZonePlacement(
  pieces: ZoneCompilerPieces,
  action: Dnd5eCompiledEffectActionSource,
  label: string | undefined
): CharacterRuleActionZonePlacementPlan | CharacterRuleActionZoneChoicePlan | null {
  const zone = passiveMeleeRetaliationZone(action.compiledEffect, label, dnd5eAttackKind)
  return zone
    ? zoneComponentPlan(pieces, action, zone, zone.components[0]!)
    : (zoneChoicePlan(pieces, action) ?? zonePlacementPlan(pieces, action))
}

/**
 * The one authored row a placed zone deals on a save result: its only row, or, for damage that
 * scales by the level its action is cast at, the row that level reaches (compiled one row per level).
 */
function zoneDamageRow(
  rows: readonly CompiledEffectGroup['entries'][number][],
  spellCastLevel: number | undefined
): CompiledEffectGroup['entries'][number] {
  const [first] = rows
  if (!first || !('outcome' in first))
    unsupported('D&D test actions require direct authored outcomes.')
  const { outcome } = first
  if (
    outcome.effectKind !== 'DAMAGE' ||
    outcome.valueKind !== 'DICE' ||
    outcome.scalingKind === 'NONE'
  ) {
    if (rows.length !== 1) unsupported('A placed zone deals one damage outcome per save result.')
    return first
  }
  if (spellCastLevel === undefined)
    unsupported('A placed zone damage that scales needs the level its action is cast at.')
  const candidates = rows.flatMap((entry) =>
    'outcome' in entry &&
    entry.outcome.effectKind === 'DAMAGE' &&
    entry.outcome.valueKind === 'DICE' &&
    entry.outcome.scalingKind === 'PER_LEVEL' &&
    entry.outcome.scalingSource === 'SPELL_CAST_LEVEL'
      ? [{ level: entry.outcome.level, order: entry.outcome.order, entry }]
      : []
  )
  if (candidates.length !== rows.length)
    unsupported('A placed zone damage scales only by the level its action is cast at.')
  const selected = selectScalingRow(candidates, spellCastLevel)
  if (!selected) unsupported('A placed zone damage scaling does not select an authored value.')
  return selected.entry
}

/**
 * A placed zone's damage on one result: fixed, or one unmodified dice roll that the entry graph
 * rolls itself (D133). The failed save, or an outcome with no save, deals the roll in full; the made
 * save may deal half of it. Bonuses and other multipliers belong to the zone turn trigger.
 */
function zoneDamageOutcome(
  pieces: ZoneCompilerPieces,
  entry: CompiledEffectGroup['entries'][number],
  pathCode: 'ON_USE' | 'ON_SAVE_FAIL' | 'ON_SAVE_SUCCESS'
): Outcome | EntryDiceDamageOutcome {
  if (!('outcome' in entry)) unsupported('D&D test actions require direct authored outcomes.')
  const { outcome } = entry
  if (outcome.effectKind !== 'DAMAGE' || outcome.valueKind !== 'DICE')
    return pieces.boundedTestOutcome(entry)
  const authored = pieces.specializedTestOutcome(entry)
  if (authored.kind === 'DAMAGE') return authored
  const multiplier = damageMultiplier(outcome)
  if (
    outcome.bonuses?.length ||
    multiplier !== (pathCode === 'ON_SAVE_SUCCESS' ? 0.5 : 1) ||
    boundedDiceTerm(outcome.dice).modifier !== 0
  )
    unsupported(
      'A placed zone dice damage is one unmodified roll: in full with no save or a failed one, halved on a made one.'
    )
  uuid(outcome.damageTypeId, 'D&D damage type identity')
  return {
    kind: 'ENTRY_DICE_DAMAGE',
    diceConfig: outcome.dice,
    damageTypeId: outcome.damageTypeId,
    entryId: entry.entryId,
    multiplier
  }
}

/**
 * The zones an action lets its caster pick one of at cast (D140), one plan per option, or null when
 * it offers no zone pick. The options must agree on what is settled before the pick: where the zone
 * is anchored, whether the caster spares creatures, and the Concentration the cast opens; each may
 * have its own area, aimed after the pick (D154).
 */
function zoneChoicePlan(
  pieces: ZoneCompilerPieces,
  action: Dnd5eCompiledEffectActionSource
): CharacterRuleActionZoneChoicePlan | null {
  const choices = castChoiceOptions(action.compiledEffect)
  if (!choices) return null
  const options = choices.flatMap(({ optionId, label, compiledEffect }) => {
    const zone = zonePlacementPlan(pieces, { ...action, compiledEffect })
    return zone ? [{ optionId, label, zone }] : []
  })
  if (options.length !== choices.length) return null
  // Zones that use the caster's save DC share its save too, since the cast resolves one.
  const settled = ({ zone }: (typeof options)[number]) =>
    checksumCanonicalJson([
      zone.attachment,
      zone.choosesUnaffected ?? false,
      zone.maintenance,
      zone.entry.castSaveDcFactKey ? zone.entry.adapterFacts : null
    ])
  if (new Set(options.map(settled)).size !== 1)
    unsupported(
      'The zones a cast picks between share their anchor, the creatures they spare, their Concentration and any save at the caster’s DC.'
    )
  return { options }
}

/**
 * The zone a PLACED_SPACE or SOURCE manifest action places: its first component over the zone's
 * shape, each later one over a band beside its wall on the side the caster picks (D154), all
 * maintained by the Concentration the cast opens, and the grant its placer holds (D153).
 */
function zonePlacementPlan(
  pieces: ZoneCompilerPieces,
  action: Dnd5eCompiledEffectActionSource
): CharacterRuleActionZonePlacementPlan | null {
  const zone = placedSpaceZone(action.compiledEffect)
  if (!zone) return null
  const [first, ...later] = zone.components
  const { appearSave } = zone
  if (later.length > 1) unsupported('A zone reaches at most one band beside its wall.')
  // A passive zone's radius scaled by class level is resolved when it is placed on its source's
  // token (D155); a cast's area is aimed before any source resolves it, and no other size scales.
  const passive = action.compiledEffect.invocation.kind === 'PASSIVE'
  if (
    scaledShapeMeasurements(zone.shape).some(
      ({ measurement, scalingSource }) =>
        !passive || measurement !== 'radius' || scalingSource !== 'CLASS_LEVEL'
    )
  )
    unsupported('A zone size scales only as a passive zone’s radius by class level.')
  const placementKind = encounterZoneChoiceTarget(
    { ...zone, regionComponents: later.map(({ component }) => ({ region: component.region! })) },
    action.compiledEffect.invocation.range.rangeKind
  )?.kind
  // A directed area is aimed, not placed; a zone is left where its action is centered or its wall
  // is drawn (D154), and a source zone is centered on the caster. Only a wall has a side to reach.
  if (zone.attachment === 'SOURCE' ? placementKind !== 'CASTER_CENTERED' : !placementKind)
    unsupported(
      later.length
        ? 'A zone with a band beside it is a straight wall or a ring.'
        : zone.attachment === 'SOURCE'
          ? 'A source zone is centered on the caster.'
          : 'A placed zone takes a point, a wall or a ring within range, or the caster as its center.'
    )
  // A zone no creature interacts with is placed with no triggers; its appear save, if any, is its
  // provenance and names the condition it holds (Entangle's restraint), and its one component, if
  // any, only prices movement there (Entangle's difficult terrain, or Plant Growth's with no save).
  // A zone with components holds only theirs.
  const terrain =
    first && !first.behavior && !first.component.occupantSaveBonus ? first.component : null
  if (terrain && later.length)
    unsupported('A zone whose component only prices movement has no band beside its wall.')
  if (
    first &&
    !terrain &&
    appearSave?.entries.some((entry) => 'lifecycle' in entry && entry.lifecycle?.heldBySource)
  )
    unsupported(
      'Only a zone no creature interacts with holds the condition its appear save applies.'
    )
  if (first && !first.behavior && !terrain)
    return occupantBonusZonePlacementPlan(pieces, action, zone, first.component)
  const primary =
    first && (!terrain || !appearSave)
      ? zoneComponentPlan(pieces, action, zone, first, terrain ? { triggerModes: [] } : undefined)
      : zoneComponentPlan(
          pieces,
          action,
          zone,
          {
            component: { id: appearSave!.id, order: 1, label: zone.label, ...terrain },
            behavior: appearSave!
          },
          { triggerModes: [] }
        )
  // Each band is a record of its own, sparing whom the zone spares.
  const regionComponents = later.map((planned) => {
    const { region, choosesUnaffected, perDistanceMoved, label } = planned.component
    if (!planned.behavior) unsupported('A zone’s band beside its wall acts where it reaches.')
    if (choosesUnaffected)
      unsupported('A zone’s region component spares the creatures the zone spares.')
    if (perDistanceMoved) unsupported('Only a zone’s own component acts per distance moved.')
    const { attachment, shape, ringThickness, maintenance, ...component } = zoneComponentPlan(
      pieces,
      action,
      zone,
      planned
    )
    if (checksumCanonicalJson(maintenance) !== checksumCanonicalJson(primary.maintenance))
      unsupported('Every component of a zone depends on the Concentration its cast opens.')
    return { region: region!, ...component, label }
  })
  const sourceGrant =
    zone.sourceGrantEntry && sourceGrantPlan(pieces, action, zone.sourceGrantEntry)
  return {
    ...primary,
    ...(regionComponents.length ? { regionComponents } : {}),
    ...(sourceGrant ? { sourceGrant } : {})
  }
}

/**
 * A zone that only lends its occupants a save bonus (D155): an untriggered source zone with one
 * component and no other rule, whose entry is a lasting graph so its spatial definition keeps the
 * shape every zone has. Placement resolves a passive zone's amount and class-level radius against
 * its source.
 */
function occupantBonusZonePlacementPlan(
  pieces: ZoneCompilerPieces,
  action: Dnd5eCompiledEffectActionSource,
  zone: PlacedSpaceZone,
  component: PlacedSpaceZone['components'][number]['component']
): CharacterRuleActionZonePlacementPlan {
  const bonus = component.occupantSaveBonus
  if (!bonus) unsupported('A placed zone component needs exactly one behavior.')
  if (zone.attachment !== 'SOURCE')
    unsupported('An occupant save bonus is lent by a zone centered on its source.')
  if (bonus.amountKind !== 'FIXED' && action.compiledEffect.invocation.kind !== 'PASSIVE')
    unsupported('A save bonus of its source’s modifier is lent by a passive zone.')
  if (
    zone.components.length !== 1 ||
    component.interactionKinds?.length ||
    component.bypassAtHalfSpeed ||
    component.choosesUnaffected ||
    component.maxApplicationsPerTurn !== undefined ||
    component.requiresFullyWithin ||
    component.requiredSight?.length ||
    component.movementCostMultiplier !== undefined ||
    component.perDistanceMoved ||
    component.blockingRules?.length ||
    component.automaticSaveSuccessImmunityDamageTypeId !== undefined ||
    zone.ringThickness ||
    zone.sourceGrantEntry
  )
    unsupported('A zone lending an occupant save bonus has no trigger or other rule.')
  return {
    attachment: 'SOURCE',
    label: zone.label,
    shape: zone.shape,
    triggerModes: [],
    occupantSaveBonus: {
      domain: bonus.domain,
      dispositionFilter: bonus.dispositionFilter,
      amount:
        bonus.amountKind === 'FIXED'
          ? { kind: 'FIXED', value: bonus.amount }
          : {
              kind: 'SOURCE_ABILITY_MODIFIER',
              ability: bonus.ability,
              minimum: bonus.minimum ?? null
            }
    },
    ...lastingZoneEntry(pieces, action, zone)
  }
}

/**
 * The entry of a zone that runs no rule of its own (an occupant save bonus, or terrain placed with
 * no appear save): a lasting graph from the zone's manifest entry, so its spatial definition keeps
 * the shape every zone has, maintained only by the Concentration its cast opens.
 */
function lastingZoneEntry(
  pieces: ZoneCompilerPieces,
  action: Dnd5eCompiledEffectActionSource,
  zone: PlacedSpaceZone
): Pick<CharacterRuleActionZonePlacementPlan, 'entry' | 'grant' | 'maintenance'> {
  const { entry } = zone
  if (!UUID.test(entry.entryId)) unsupported('A placed zone outcome needs a compiled identity.')
  const plan: Omit<CharacterRuleActionActiveEffectPlan, 'frozenGraph'> = {
    authoredEffectId: action.effectId,
    compiledEntryId: entry.entryId,
    frozenGraphNodeId: 'proposal-on_use',
    capabilityContractVersion: DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
    recurrenceStage: 'NONE',
    initialRemaining: null,
    adapterFacts: {},
    castSaveDcFactKey: null,
    perceptionContributions: [],
    maintenance: null,
    marginRiders: []
  }
  return {
    entry: {
      ...plan,
      frozenGraph: pieces.durationPublishedGraph({ effectId: action.effectId, plan })
    },
    grant: null,
    maintenance: pieces.maintenancePlan(action, entry)
  }
}

/**
 * What one component of a placed zone does where it reaches (D154). Its one entering behavior is a
 * saving throw against a fixed DC or the caster's save DC (stored when the zone is placed) whose
 * failure stops the mover, deals damage and may leave a grant that lasts until its authored end
 * event; or, for a zone that acts only at turn boundaries or on entry, damage dealt with no save
 * (D144). Anything else the behavior authors is refused rather than partly honored.
 */
function zoneComponentPlan(
  pieces: ZoneCompilerPieces,
  action: Dnd5eCompiledEffectActionSource,
  zone: PlacedSpaceZone,
  { component, behavior }: PlacedSpaceZone['components'][number],
  triggers = zoneTriggers(component)
): Omit<CharacterRuleActionZonePlacementPlan, 'regionComponents' | 'sourceGrant'> {
  if (!behavior && !component.movementCostMultiplier)
    unsupported('Only a zone’s own component lends an occupant save bonus.')
  const {
    requiresFullyWithin,
    requiredSight,
    movementCostMultiplier,
    perDistanceMoved,
    blockingRules,
    automaticSaveSuccessImmunityDamageTypeId: successImmunity
  } = component
  if (requiresFullyWithin && triggers?.triggerModes.length)
    unsupported('A zone that catches only creatures fully within it acts only at turn boundaries.')
  if (!triggers) unsupported('A placed zone behavior is a saving throw with direct save outcomes.')
  if (
    movementCostMultiplier !== undefined &&
    !zoneMovementCostMultiplierSchema.safeParse(movementCostMultiplier).success
  )
    unsupported('A zone movement cost multiplies the cost of moving by more than 1, up to 100.')
  if (triggers.retaliatesMeleeHits && zone.attachment !== 'SOURCE')
    unsupported('Only a zone centered on its source answers a melee hit on that source.')
  // Transitional (D156): per distance moved, a zone deals damage to whoever enters or moves within
  // it, until content needs a save, a turn boundary or a per-turn limit beside it.
  if (
    perDistanceMoved &&
    (!triggers.triggerModes.includes('ENTER') ||
      triggers.turnTriggers ||
      triggers.retaliatesMeleeHits ||
      component.maxApplicationsPerTurn !== undefined ||
      action.compiledEffect.invocation.triggerCode === 'SAVING_THROW')
  )
    unsupported('A zone acting per distance moved deals damage with no save to whoever enters it.')
  const placement = {
    attachment: zone.attachment,
    label: zone.label,
    shape: zone.shape,
    ...(zone.ringThickness ? { ringThickness: zone.ringThickness } : {}),
    ...triggers,
    bypassAtHalfSpeed: component.bypassAtHalfSpeed === true,
    ...(component.choosesUnaffected ? { choosesUnaffected: true } : {}),
    ...(component.maxApplicationsPerTurn
      ? { maxApplicationsPerTurn: component.maxApplicationsPerTurn }
      : {}),
    ...(requiresFullyWithin ? { requiresFullyWithin: true } : {}),
    ...(requiredSight?.length ? { requiredSight: [...new Set(requiredSight)].sort() } : {}),
    ...(movementCostMultiplier ? { movementCostMultiplier } : {}),
    ...(perDistanceMoved
      ? { perDistanceMoved: { amount: perDistanceMoved.amount, unit: perDistanceMoved.unit } }
      : {}),
    ...(blockingRules?.length ? { blockingRules: [...new Set(blockingRules)] } : {})
  }
  if (!behavior) return { ...placement, ...lastingZoneEntry(pieces, action, zone) }
  const { invocation, entries } = behavior
  const savingThrow = 'savingThrow' in invocation ? invocation.savingThrow : undefined
  const zoneSave =
    savingThrow &&
    dnd5eRepeatSave({
      abilityDefinitionId: savingThrow.abilityDefinitionId,
      savingThrow,
      requestNodeId: 'd20'
    })
  if (requiredSight?.length && invocation.triggerCode !== 'SAVING_THROW')
    unsupported('A zone that needs sight of its source gates a saving throw.')
  if (invocation.triggerCode !== 'SAVING_THROW')
    return unsavedZonePlacementPlan(pieces, action, placement, entries, successImmunity)
  if (
    invocation.triggerCode !== 'SAVING_THROW' ||
    !zoneSave ||
    entries.some(
      (entry) =>
        entry.resolutionKind !== 'DIRECT' ||
        !('outcome' in entry) ||
        (entry.pathCode !== 'ON_SAVE_FAIL' && entry.pathCode !== 'ON_SAVE_SUCCESS') ||
        entry.rangeOverride ||
        entry.targetingOverride
    )
  )
    unsupported('A placed zone behavior is a saving throw with direct save outcomes.')
  const failEntries = entries.filter((entry) => entry.pathCode === 'ON_SAVE_FAIL')
  const madeEntries = entries.filter((entry) => entry.pathCode === 'ON_SAVE_SUCCESS')
  if (requiredSight?.length && madeEntries.length)
    unsupported('A zone that needs sight of its source has no outcome for a made save.')
  // D142: a failed save composes damage rows with at most one of each other outcome kind.
  const outcomeEntries = (effectKind: string, ruleKind?: string) =>
    failEntries.filter(
      (entry) =>
        'outcome' in entry &&
        entry.outcome.effectKind === effectKind &&
        (ruleKind === undefined ||
          ('ruleKind' in entry.outcome && entry.outcome.ruleKind === ruleKind))
    )
  const damageRows = outcomeEntries('DAMAGE')
  const singles = {
    stop: outcomeEntries('MOVEMENT_RULE', 'STOP_CURRENT_MOVEMENT'),
    grant: outcomeEntries('APPLY_GRANT'),
    condition: outcomeEntries('CONDITION'),
    lostAction: outcomeEntries('ACTION_ECONOMY_RULE', 'LOSE_ACTION')
  }
  const [stop] = singles.stop
  const [grant] = singles.grant
  const [condition] = singles.condition
  const [lostAction] = singles.lostAction
  const composed = Object.values(singles).reduce((count, list) => count + list.length, 0)
  if (
    failEntries.length === 0 ||
    Object.values(singles).some((list) => list.length > 1) ||
    damageRows.length + composed !== failEntries.length ||
    madeEntries.some((entry) => !('outcome' in entry) || entry.outcome.effectKind !== 'DAMAGE')
  )
    unsupported(
      'A placed zone failure composes damage with at most one stop, grant, condition and lost action; a made save only deals damage.'
    )
  if (
    condition &&
    'outcome' in condition &&
    condition.outcome.effectKind === 'CONDITION' &&
    !(action.conditionDefinitionIds ?? []).includes(condition.outcome.conditionId)
  )
    unsupported('A placed zone condition is not in the pinned System vocabulary.')
  // The Action is lost for the turn just starting, after its allowances refresh.
  if (
    lostAction &&
    (triggers.triggerModes.length > 0 ||
      triggers.turnTriggers?.length !== 1 ||
      triggers.turnTriggers[0] !== 'START_OF_TURN')
  )
    unsupported('A placed zone failure that costs the Action acts only at the start of a turn.')
  // The graph proposes the damage, else the condition; a condition beside damage has a proposal of
  // its own, and a failure without either binds the save itself.
  const proposed =
    damageRows.length > 0 ? zoneDamageRow(damageRows, action.spellCastLevel) : condition
  const besideDamage = damageRows.length > 0 ? condition : undefined
  const heldCondition = condition ? zoneHeldCondition(condition) : null
  const primary = proposed ?? lostAction ?? grant ?? stop
  const madeDamageRows =
    madeEntries.length > 0 ? [zoneDamageRow(madeEntries, action.spellCastLevel)] : []
  if (!primary || !UUID.test(primary.entryId))
    unsupported('A placed zone outcome needs a compiled identity.')
  const entryPlan: Omit<CharacterRuleActionActiveEffectPlan, 'frozenGraph'> = {
    authoredEffectId: action.effectId,
    compiledEntryId: primary.entryId,
    frozenGraphNodeId: proposed ? 'proposal-on_save_fail' : 'test',
    capabilityContractVersion: DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
    recurrenceStage: 'NONE',
    initialRemaining: null,
    adapterFacts: {
      ...zoneSave.adapterFacts,
      ...(successImmunity
        ? {
            [DND5E_ACTIVE_EFFECT_SAVE_SUCCESS_IMMUNITY_FACT_KEY]:
              damageTypeIdentity(successImmunity)
          }
        : {})
    },
    castSaveDcFactKey: zoneSave.castSaveDcFactKey,
    perceptionContributions: [],
    maintenance: null,
    marginRiders: []
  }
  const saveGraph = pieces.compileTestDefinition(
    action,
    {
      kind: 'SAVE',
      branches: new Map([
        ...(proposed
          ? [['ON_SAVE_FAIL', zoneDamageOutcome(pieces, proposed, 'ON_SAVE_FAIL')] as const]
          : []),
        ...madeDamageRows.map(
          (row) => ['ON_SAVE_SUCCESS', zoneDamageOutcome(pieces, row, 'ON_SAVE_SUCCESS')] as const
        )
      ]),
      ...(besideDamage
        ? {
            conditions: new Map([
              [
                'ON_SAVE_FAIL',
                { outcome: pieces.boundedTestOutcome(besideDamage), entryId: besideDamage.entryId }
              ]
            ])
          }
        : {})
    },
    entryPlan
  )
  const lingeringPlan = grant
    ? pieces.modifierGrantEntryPlan({
        action,
        entry: grant,
        resultGated: false,
        untilEndEvent: true
      })
    : null
  const lingering = lingeringPlan?.modifierGrantContribution
  // The grant is read only for its modifiers and end events; one that is also consumed or
  // maintained would silently lose that behavior on a creature.
  if (
    grant &&
    (!lingering || lingering.consumeOnFirstEvents.length > 0 || lingeringPlan?.maintenance)
  )
    unsupported('A placed zone grant must last until its end event.')
  const maintenance = pieces.maintenancePlan(action, primary)
  // A held condition ends with its zone through the zone's maintenance, which nothing else ends.
  if (heldCondition && !heldCondition.endsAtEndOfHolderTurn && !maintenance)
    unsupported('A zone-held condition needs a zone that Concentration maintains.')
  if (heldCondition?.escape && !zone.label)
    unsupported('A zone-held condition escape names its zone.')
  return {
    ...placement,
    // A creature leaving the area is released there: the exit ends its holder effect, never a save.
    ...(heldCondition?.endsOnLeavingArea
      ? {
          triggerModes: (['ENTER', 'EXIT', 'CROSS'] as const).filter(
            (trigger) => trigger === 'EXIT' || placement.triggerModes.includes(trigger)
          )
        }
      : {}),
    ...(lostAction ? { failedSaveLosesAction: true } : {}),
    ...(heldCondition ? { heldCondition } : {}),
    entry: {
      ...entryPlan,
      frozenGraph: stop ? pieces.withMovementInterruption(saveGraph, 'ON_SAVE_FAIL') : saveGraph
    },
    grant: lingering
      ? {
          applyGrantOutcomeId: lingering.applyGrantOutcomeId,
          modifiers: [...lingering.modifiers],
          senses: [...lingering.senses],
          endOnEvents: [...lingering.endOnEvents]
        }
      : null,
    maintenance
  }
}

/**
 * The condition a zone holds on a creature failing its save (D146), or null when it is unheld. An
 * unheld condition carries none of the held terms (the result's other lifecycle is its grant's); a
 * held one ends with its zone, and when authored on leaving the area or through its escape.
 */
function zoneHeldCondition(
  entry: CompiledEffectGroup['entries'][number]
): NonNullable<CharacterRuleActionZonePlacementPlan['heldCondition']> | null {
  if (!('outcome' in entry) || entry.outcome.effectKind !== 'CONDITION')
    unsupported('A placed zone condition is a direct condition outcome.')
  const {
    heldBySource,
    endOnEvents = [],
    escape,
    turnAnchor,
    ...otherLifecycle
  } = entry.lifecycle ?? {}
  const unread =
    turnAnchor !== undefined || Object.values(otherLifecycle).some((value) => value !== undefined)
  if (!heldBySource) {
    if (endOnEvents.includes('ON_LEAVING_AREA') || escape)
      unsupported('A placed zone condition that its zone does not hold has no leave or escape.')
    if (!turnAnchor) return null
    // The one timed form: until the end of the holder's turn, which the occupant's own turn
    // boundary counts, so it neither outlasts the turn nor depends on the zone's lifetime.
    if (
      turnAnchor.actor !== 'TARGET' ||
      turnAnchor.boundary !== 'END_OF_TURN' ||
      !entry.duration ||
      conditionDurationTurns(entry.duration) !== 1 ||
      endOnEvents.length > 0 ||
      Object.values(otherLifecycle).some((value) => value !== undefined)
    )
      unsupported(
        'A placed zone condition that its zone does not hold lasts until the end of its holder turn.'
      )
    return {
      conditionId: entry.outcome.conditionId,
      endsAtEndOfHolderTurn: true as const,
      ...(entry.outcome.recordsSource ? { recordsSource: true as const } : {})
    }
  }
  if (unread || endOnEvents.some((event) => event !== 'ON_LEAVING_AREA'))
    unsupported(
      'A zone-held condition ends only with its zone, on leaving the area, or through its escape.'
    )
  return {
    conditionId: entry.outcome.conditionId,
    ...(endOnEvents.length > 0 ? { endsOnLeavingArea: true as const } : {}),
    ...(escape
      ? { escape: { activation: escape.activation, checks: escape.checks, dc: escape.dc } }
      : {})
  }
}

/**
 * The timed grant a zone's placer receives when the zone is placed (D153), counted on its own
 * active-effect clock rather than the zone's, compiled as any timed modifier grant. A grant that is not one is refused rather than dropped.
 */
function sourceGrantPlan(
  pieces: ZoneCompilerPieces,
  action: Dnd5eCompiledEffectActionSource,
  entry: CompiledEffectGroup['entries'][number]
): CharacterRuleActionActiveEffectPlan {
  const plan = pieces.modifierGrantEntryPlan({
    action,
    entry,
    resultGated: false,
    untilEndEvent: false
  })
  if (!plan) unsupported('A zone’s placer holds a timed modifier grant.')
  return {
    ...plan,
    frozenGraph: pieces.durationPublishedGraph({ effectId: action.effectId, plan })
  }
}

/**
 * A zone whose outcome needs no save (D144, D154): it rolls one unmodified damage dice row and deals
 * it in full, with no test node, at a turn boundary or when a mover enters it; its source rolls the
 * dice.
 */
function unsavedZonePlacementPlan(
  pieces: ZoneCompilerPieces,
  action: Dnd5eCompiledEffectActionSource,
  placement: Omit<CharacterRuleActionZonePlacementPlan, 'entry' | 'grant' | 'maintenance'>,
  entries: readonly CompiledEffectGroup['entries'][number][],
  successImmunity: CompiledManifestComponent['automaticSaveSuccessImmunityDamageTypeId']
): CharacterRuleActionZonePlacementPlan {
  if (
    successImmunity ||
    entries.length === 0 ||
    entries.some(
      (entry) =>
        entry.resolutionKind !== 'DIRECT' ||
        entry.pathCode !== 'ON_USE' ||
        entry.rangeOverride ||
        entry.targetingOverride
    )
  )
    unsupported('A zone outcome with no save is direct damage on use.')
  const row = zoneDamageRow(entries, action.spellCastLevel)
  const outcome = zoneDamageOutcome(pieces, row, 'ON_USE')
  if (outcome.kind !== 'ENTRY_DICE_DAMAGE' || !UUID.test(row.entryId))
    unsupported('A zone outcome with no save rolls one damage dice row.')
  const entryPlan: Omit<CharacterRuleActionActiveEffectPlan, 'frozenGraph'> = {
    authoredEffectId: action.effectId,
    compiledEntryId: row.entryId,
    frozenGraphNodeId: 'proposal-on_use',
    capabilityContractVersion: DND5E_EFFECT_ACTION_CAPABILITY_CONTRACT_VERSION,
    recurrenceStage: 'NONE',
    initialRemaining: null,
    adapterFacts: {},
    castSaveDcFactKey: null,
    perceptionContributions: [],
    maintenance: null,
    marginRiders: []
  }
  const definition = pieces.diceGraphDefinition({
    action,
    entry: row,
    diceConfig: outcome.diceConfig,
    recurring: entryPlan
  })
  return {
    ...placement,
    entry: {
      ...entryPlan,
      frozenGraph: pieces.publishedGraph(definition)
    },
    grant: null,
    maintenance: pieces.maintenancePlan(action, row)
  }
}
