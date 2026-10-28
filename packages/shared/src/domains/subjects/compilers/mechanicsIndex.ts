import type {
  BackgroundAuthored,
  ClassAuthored,
  CreatureAuthored,
  EquipmentAuthored,
  FeatAuthored,
  RaceAuthored,
  SpellAuthored,
  VehicleAuthored
} from '#authored'
import type { CompiledChargeUse, CompiledEffectGroup } from '#compilers'

import { compileBackground, type CompiledBackground } from './background.js'
import { compileClass, type CompiledClass } from './class.js'
import { compileCreature, type CompiledCreature } from './creature.js'
import {
  compileEquipment,
  compileResolvedEquipment,
  type CompiledEquipment,
  type CompiledEquipmentVariant,
  type ResolvedEquipment
} from './equipment.js'
import { compileFeat, type CompiledFeat } from './feat.js'
import {
  compileRace,
  compileSubraceSource,
  type CompiledRace,
  type CompiledSubraceSource,
  type ResolvedRace
} from './race.js'
import { compileSpell, type CompiledSpell } from './spell.js'
import { compileVehicle, type CompiledVehicle } from './vehicle.js'

export type CompiledSubjectKind =
  | 'BACKGROUND'
  | 'CLASS'
  | 'CREATURE'
  | 'EQUIPMENT'
  | 'FEAT'
  | 'RACE'
  | 'SPELL'
  | 'VEHICLE'

export type CompiledSubjectProjection =
  | CompiledBackground
  | CompiledClass
  | CompiledCreature
  | CompiledEquipment
  | CompiledEquipmentVariant
  | CompiledFeat
  | CompiledRace
  | CompiledSubraceSource
  | CompiledSpell
  | CompiledVehicle

export type CompiledSubjectMechanicsNode =
  | {
      kind: 'ROOT_COMPILED_SEMANTICS'
      nodeKind: 'ROOT_COMPILED_SEMANTICS'
      sourcePath: readonly [string]
      semanticDescriptor: CompiledSubjectMechanicsDescriptor
    }
  | {
      kind: 'UUID_COMPILED_SEMANTICS'
      nodeKind: CompiledSubjectMechanicsNodeKind
      nodeId: string
      sourcePath: readonly string[]
      semanticDescriptor: CompiledSubjectMechanicsDescriptor
    }
  | {
      kind: 'COMPILED_EFFECT_GROUP'
      nodeKind: 'EFFECT_GROUP'
      effectId: string
      sourcePath: readonly string[]
      compiledEffect: CompiledEffectGroup
    }

/**
 * A reproducible source audit artifact. It is intentionally not a persisted execution plan:
 * compiled projections remain the runtime-authoritative output and this index names only the
 * UUID-owned authored mechanics that produced them.
 */
export type CompiledSubjectMechanicsIndex = {
  contractVersion: 1
  subjectKind: CompiledSubjectKind
  rootId: string
  nodes: readonly CompiledSubjectMechanicsNode[]
}

export type CompiledSubjectMechanicsNodeKind =
  | 'ROOT_COMPILED_SEMANTICS'
  | 'FEATURE'
  | 'FEATURE_OPTION'
  | 'FEAT_GRANT'
  | 'MODIFIER_GRANT'
  | 'PROFICIENCY_GRANT'
  | 'SENSE_GRANT'
  | 'SPELL_GRANT'
  | 'CHARGE'
  | 'CHARGE_USE'
  | 'CLASS_RESOURCE'
  | 'SPECIALIZATION'
  | 'MULTICLASS'
  | 'MULTICLASS_REQUIREMENT_GROUPS'
  | 'MULTICLASS_REQUIREMENT_GROUP'
  | 'MULTICLASS_REQUIREMENT'
  | 'STARTING_EQUIPMENT'
  | 'STARTING_EQUIPMENT_SET'
  | 'STARTING_EQUIPMENT_GROUP'
  | 'STARTING_EQUIPMENT_OPTION'
  | 'STARTING_EQUIPMENT_ITEM'
  | 'RACE_ANCESTRY'
  | 'RACE_ANCESTRY_OPTION'
  | 'EFFECT_GROUP'

type MechanicsScalar = string | number | boolean | null
type MechanicsValue =
  | MechanicsScalar
  | readonly MechanicsValue[]
  | { readonly [key: string]: MechanicsValue }
export type CompiledSubjectMechanicsDescriptor = {
  nodeKind: CompiledSubjectMechanicsNodeKind
  fields: readonly { key: string; value: MechanicsValue }[]
}

export type CompiledSubjectWithMechanicsIndex = {
  compiled: CompiledSubjectProjection
  mechanicsIndex: CompiledSubjectMechanicsIndex
}

type CompiledFeatureLike = {
  id: string
  effects?: readonly CompiledEffectGroup[]
  options?: readonly CompiledFeatureLike[]
  charges?: CompiledChargeUse
  feats?: readonly CompiledGrantLike[]
  modifiers?: readonly { id: string }[]
  proficiencies?: readonly { id: string }[]
  senses?: readonly CompiledGrantLike[]
  spells?: readonly CompiledGrantLike[]
}

type CompiledGrantLike = {
  id: string
  charges?: { id: string; limitKind: string; resetKind?: string }
}

type CompiledStartingEquipmentLike = {
  id: string
  sets: readonly {
    id: string
    groups: readonly {
      id: string
      options: readonly {
        id: string
        items: readonly { id?: string }[]
      }[]
    }[]
  }[]
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function field<T>(
  key: string,
  value: T | undefined
): readonly { key: string; value: MechanicsValue }[] {
  return value === undefined ? [] : [{ key, value: value as MechanicsValue }]
}
function descriptor(
  nodeKind: CompiledSubjectMechanicsNodeKind,
  ...fields: readonly (readonly { key: string; value: MechanicsValue }[])[]
): CompiledSubjectMechanicsDescriptor {
  return { nodeKind, fields: fields.flat() }
}
function rootDescriptor(
  subjectKind: CompiledSubjectKind,
  compiled: object
): CompiledSubjectMechanicsDescriptor {
  switch (subjectKind) {
    case 'BACKGROUND':
      return descriptor('ROOT_COMPILED_SEMANTICS')
    case 'CLASS': {
      const value = compiled as CompiledClass
      return descriptor(
        'ROOT_COMPILED_SEMANTICS',
        field('category', value.category),
        field('parentClassId', 'parentClassId' in value ? value.parentClassId : undefined),
        field('hitpoint', 'hitpoint' in value ? value.hitpoint : undefined),
        field('startingGold', 'startingGold' in value ? value.startingGold : undefined),
        field('spellcasting', value.spellcasting)
      )
    }
    case 'CREATURE': {
      const value = compiled as CompiledCreature
      return descriptor(
        'ROOT_COMPILED_SEMANTICS',
        field('category', value.category),
        field('creatureTypeId', value.creatureTypeId),
        field('size', value.size),
        field('alignmentId', value.alignmentId),
        field('speeds', value.speeds),
        field('abilityScores', value.abilityScores),
        field('naturalArmorBonus', value.naturalArmorBonus),
        field('hitPoints', value.hitPoints),
        field('hitDice', value.hitDice),
        field('passivePerception', value.passivePerception),
        field('damageVulnerabilities', value.damageVulnerabilities),
        field('damageResistances', value.damageResistances),
        field('damageImmunities', value.damageImmunities),
        field('qualifiedDamageDefenses', value.qualifiedDamageDefenses),
        field('conditionImmunities', value.conditionImmunities),
        field('challengeRatingId', value.challengeRatingId),
        field('xp', value.xp),
        field('cost', value.cost),
        field('carryingCapacity', value.carryingCapacity)
      )
    }
    case 'EQUIPMENT': {
      const value = compiled as CompiledEquipment | CompiledEquipmentVariant
      return descriptor(
        'ROOT_COMPILED_SEMANTICS',
        field('category', value.category),
        field(
          'parentEquipmentId',
          'parentEquipmentId' in value ? value.parentEquipmentId : undefined
        ),
        field('properties', value.properties),
        field('restrictions', value.restrictions),
        field('requiresAttunement', value.requiresAttunement),
        field('cost', value.cost),
        field('weight', value.weight),
        field('attributes', value.attributes),
        field('capacity', value.capacity),
        field('maxStack', value.maxStack),
        field('rarityId', value.rarityId),
        field('armorClass', value.armorClass),
        field('ammunitionEquipmentId', value.ammunitionEquipmentId),
        field('contains', value.contains)
      )
    }
    case 'FEAT':
      return descriptor(
        'ROOT_COMPILED_SEMANTICS',
        field('prerequisites', (compiled as CompiledFeat).prerequisites)
      )
    case 'RACE': {
      const value = compiled as CompiledRace | CompiledSubraceSource
      return descriptor(
        'ROOT_COMPILED_SEMANTICS',
        field('category', value.category),
        field('parentRaceId', 'parentRaceId' in value ? value.parentRaceId : undefined),
        field('selectionMode', 'selectionMode' in value ? value.selectionMode : undefined),
        field('heritageIds', value.heritageIds),
        field('size', 'size' in value ? value.size : undefined),
        field('speeds', 'speeds' in value ? value.speeds : undefined)
      )
    }
    case 'SPELL': {
      const value = compiled as CompiledSpell
      return descriptor(
        'ROOT_COMPILED_SEMANTICS',
        field('level', value.level),
        field('attributes', value.attributes),
        field('components', value.components),
        field('classIds', value.classIds),
        field('magicSchoolId', value.magicSchoolId),
        field('castingTime', value.castingTime)
      )
    }
    case 'VEHICLE': {
      const value = compiled as CompiledVehicle
      return descriptor(
        'ROOT_COMPILED_SEMANTICS',
        field('category', value.category),
        field('size', value.size),
        field('armorClass', value.armorClass),
        field('hitPoints', value.hitPoints),
        field('speed', value.speed),
        field('crewMin', value.crewMin),
        field('crewMax', value.crewMax),
        field('passengerCapacity', value.passengerCapacity),
        field('cargoCapacity', value.cargoCapacity),
        field('weight', value.weight),
        field('cost', value.cost),
        field('properties', value.properties)
      )
    }
  }
}
function nodeDescriptor(
  nodeKind: Exclude<CompiledSubjectMechanicsNodeKind, 'ROOT_COMPILED_SEMANTICS' | 'EFFECT_GROUP'>,
  compiled: object
): CompiledSubjectMechanicsDescriptor {
  const value = compiled as Record<string, MechanicsValue | undefined>
  switch (nodeKind) {
    case 'FEATURE':
    case 'FEATURE_OPTION':
      return descriptor(
        nodeKind,
        field('order', value.order),
        field('attributes', value.attributes),
        field('restrictions', value.restrictions),
        field('rollDefinitions', value.rollDefinitions),
        field('ruleDefinitionIds', value.ruleDefinitionIds)
      )
    case 'MODIFIER_GRANT':
      return descriptor(
        nodeKind,
        field('order', value.order),
        field('grantKind', value.grantKind),
        field('selectionKind', value.selectionKind),
        field('modifierKind', value.modifierKind),
        field('scope', value.scope),
        field('valueDomainCode', value.valueDomainCode),
        field('payload', value.payload),
        field('restrictions', value.restrictions)
      )
    case 'CHARGE':
      return descriptor(
        nodeKind,
        field('resetKind', value.resetKind),
        field('limitKind', value.limitKind),
        field('scalingKind', value.scalingKind),
        field('amount', value.amount),
        field('levels', value.levels),
        field('ability', value.ability),
        field('classId', value.classId),
        field('multiplier', value.multiplier),
        field('min', value.min),
        field('max', value.max),
        field('bonuses', value.bonuses)
      )
    case 'CHARGE_USE':
      return descriptor(
        nodeKind,
        field('limitKind', value.limitKind),
        field('scalingKind', value.scalingKind),
        field('cost', value.cost),
        field('resetKind', value.resetKind),
        field('amount', value.amount),
        field('levels', value.levels)
      )
    case 'CLASS_RESOURCE':
      return descriptor(nodeKind, field('availableAtLevel', value.availableAtLevel))
    case 'MULTICLASS_REQUIREMENT':
      return descriptor(nodeKind, field('ability', value.ability), field('min', value.min))
    case 'SPECIALIZATION':
    case 'RACE_ANCESTRY_OPTION':
      return descriptor(nodeKind, field('order', value.order))
    case 'STARTING_EQUIPMENT_OPTION':
      return descriptor(
        nodeKind,
        field('quantity', value.quantity),
        field('equipmentId', value.equipmentId)
      )
    case 'STARTING_EQUIPMENT_ITEM':
      return descriptor(
        nodeKind,
        field('equipmentId', value.equipmentId),
        field('quantity', value.quantity)
      )
    case 'FEAT_GRANT':
    case 'SENSE_GRANT':
    case 'SPELL_GRANT':
      return descriptor(
        nodeKind,
        field('order', value.order),
        field('grantKind', value.grantKind),
        field('selectionKind', value.selectionKind),
        field('scalingKind', value.scalingKind),
        field('authoringModeKind', value.authoringModeKind),
        field('featIds', value.featIds),
        field('senseIds', value.senseIds),
        field('spellIds', value.spellIds),
        field('count', value.count),
        field('selectionDuplicatePolicy', value.selectionDuplicatePolicy),
        field('levels', value.levels),
        field('range', value.range),
        field('castAtLevel', value.castAtLevel),
        field('castingAbility', value.castingAbility),
        field('spellSaveDc', value.spellSaveDc),
        field('attributes', value.attributes),
        field('filters', value.filters),
        field('restrictions', value.restrictions)
      )
    case 'PROFICIENCY_GRANT':
      return descriptor(
        nodeKind,
        field('order', value.order),
        field('grantKind', value.grantKind),
        field('selectionKind', value.selectionKind),
        field('authoringModeKind', value.authoringModeKind),
        field('proficiencyIds', value.proficiencyIds),
        field('count', value.count),
        field('selectionDuplicatePolicy', value.selectionDuplicatePolicy)
      )
    case 'MULTICLASS':
    case 'MULTICLASS_REQUIREMENT_GROUPS':
    case 'MULTICLASS_REQUIREMENT_GROUP':
    case 'STARTING_EQUIPMENT':
    case 'STARTING_EQUIPMENT_SET':
    case 'STARTING_EQUIPMENT_GROUP':
    case 'RACE_ANCESTRY':
      return descriptor(nodeKind)
  }
}

function requireId(value: string | undefined, context: string): string {
  if (!value || !UUID.test(value))
    throw new Error(`${context} must retain its compiler-owned UUID.`)
  return value
}

function addUuidNode(
  nodes: CompiledSubjectMechanicsNode[],
  nodeKind: Exclude<CompiledSubjectMechanicsNodeKind, 'ROOT_COMPILED_SEMANTICS' | 'EFFECT_GROUP'>,
  nodeId: string,
  sourcePath: readonly string[],
  compiled: object
): void {
  nodes.push({
    kind: 'UUID_COMPILED_SEMANTICS',
    nodeKind,
    nodeId,
    sourcePath,
    semanticDescriptor: nodeDescriptor(nodeKind, compiled)
  })
}

function addEffectGroups(
  nodes: CompiledSubjectMechanicsNode[],
  sourcePath: readonly string[],
  effects: readonly CompiledEffectGroup[] | undefined
): void {
  for (const effect of effects ?? [])
    nodes.push({
      kind: 'COMPILED_EFFECT_GROUP',
      nodeKind: 'EFFECT_GROUP',
      effectId: effect.id,
      sourcePath: [...sourcePath, effect.id],
      compiledEffect: effect
    })
}

function addFeature(
  nodes: CompiledSubjectMechanicsNode[],
  feature: CompiledFeatureLike,
  sourcePath: readonly string[],
  nodeKind: 'FEATURE' | 'FEATURE_OPTION'
): void {
  const path = [...sourcePath, feature.id]
  addUuidNode(nodes, nodeKind, feature.id, path, feature)
  addEffectGroups(nodes, path, feature.effects)
  if (feature.charges)
    addUuidNode(
      nodes,
      feature.charges.limitKind === 'SOURCE_CHARGES' ? 'CHARGE_USE' : 'CHARGE',
      feature.charges.id,
      [...path, feature.charges.id],
      feature.charges
    )
  for (const [kind, grants] of [
    ['FEAT_GRANT', feature.feats],
    ['MODIFIER_GRANT', feature.modifiers],
    ['PROFICIENCY_GRANT', feature.proficiencies],
    ['SENSE_GRANT', feature.senses],
    ['SPELL_GRANT', feature.spells]
  ] as const)
    for (const grant of grants ?? []) {
      const grantPath = [...path, grant.id]
      addUuidNode(nodes, kind, grant.id, grantPath, grant)
      addGrantCharge(nodes, grantPath, grant)
    }
  for (const option of feature.options ?? []) addFeature(nodes, option, path, 'FEATURE_OPTION')
}

function addGrantCharge(
  nodes: CompiledSubjectMechanicsNode[],
  grantPath: readonly string[],
  grant: CompiledGrantLike
): void {
  if (!grant.charges) return
  const charge = grant.charges
  const nodeKind = charge.resetKind === undefined ? 'CHARGE_USE' : 'CHARGE'
  addUuidNode(nodes, nodeKind, charge.id, [...grantPath, charge.id], charge)
}

function addFeatures(
  nodes: CompiledSubjectMechanicsNode[],
  sourcePath: readonly string[],
  features: readonly CompiledFeatureLike[] | undefined
): void {
  for (const feature of features ?? []) addFeature(nodes, feature, sourcePath, 'FEATURE')
}

function addStartingEquipment(
  nodes: CompiledSubjectMechanicsNode[],
  sourcePath: readonly string[],
  startingEquipment: CompiledStartingEquipmentLike | undefined
): void {
  if (!startingEquipment) return
  const equipmentPath = [...sourcePath, startingEquipment.id]
  addUuidNode(nodes, 'STARTING_EQUIPMENT', startingEquipment.id, equipmentPath, {})
  for (const set of startingEquipment.sets) {
    const setPath = [...equipmentPath, set.id]
    addUuidNode(nodes, 'STARTING_EQUIPMENT_SET', set.id, setPath, {})
    for (const group of set.groups) {
      const groupPath = [...setPath, group.id]
      addUuidNode(nodes, 'STARTING_EQUIPMENT_GROUP', group.id, groupPath, {})
      for (const option of group.options) {
        const optionPath = [...groupPath, option.id]
        addUuidNode(nodes, 'STARTING_EQUIPMENT_OPTION', option.id, optionPath, option)
        for (const item of option.items) {
          if (!item.id) continue
          addUuidNode(nodes, 'STARTING_EQUIPMENT_ITEM', item.id, [...optionPath, item.id], item)
        }
      }
    }
  }
}

type RootCollectionSource = Partial<
  Record<
    | 'proficiencies'
    | 'modifiers'
    | 'feats'
    | 'senses'
    | 'spells'
    | 'specializations'
    | 'charges'
    | 'effects'
    | 'features'
    | 'startingEquipment',
    unknown
  >
>

function addRootCollections(
  nodes: CompiledSubjectMechanicsNode[],
  rootId: string,
  compiled: RootCollectionSource
): void {
  const rootPath = [rootId]
  const directCollections = [
    ['proficiencies', 'PROFICIENCY_GRANT'],
    ['modifiers', 'MODIFIER_GRANT'],
    ['feats', 'FEAT_GRANT'],
    ['senses', 'SENSE_GRANT'],
    ['spells', 'SPELL_GRANT'],
    ['specializations', 'SPECIALIZATION']
  ] as const
  for (const [key, kind] of directCollections) {
    const values = compiled[key]
    if (!Array.isArray(values)) continue
    for (const value of values) {
      // Creature display senses and similar inline scalar policy values stay in root semantics.
      if (!value || typeof value !== 'object' || !('id' in value)) continue
      const id = requireId((value as { id?: string }).id, kind)
      addUuidNode(nodes, kind, id, [...rootPath, id], value)
      if (kind === 'FEAT_GRANT' || kind === 'SENSE_GRANT' || kind === 'SPELL_GRANT') {
        addGrantCharge(nodes, [...rootPath, id], value as CompiledGrantLike)
      }
    }
  }
  const charges = compiled.charges
  if (charges && typeof charges === 'object') {
    const id = requireId((charges as { id?: string }).id, 'CHARGE')
    addUuidNode(nodes, 'CHARGE', id, [...rootPath, id], charges)
  }
  addEffectGroups(nodes, rootPath, compiled.effects as CompiledEffectGroup[] | undefined)
  addFeatures(nodes, rootPath, compiled.features as CompiledFeatureLike[] | undefined)
  addStartingEquipment(
    nodes,
    rootPath,
    compiled.startingEquipment as CompiledStartingEquipmentLike | undefined
  )
}

function addClassNodes(nodes: CompiledSubjectMechanicsNode[], compiled: CompiledClass): void {
  const rootPath = [compiled.id]
  addRootCollections(nodes, compiled.id, compiled)
  if (compiled.resources) {
    const resourcePath = [...rootPath, compiled.resources.id]
    addUuidNode(nodes, 'CLASS_RESOURCE', compiled.resources.id, resourcePath, compiled.resources)
    addUuidNode(
      nodes,
      'CHARGE',
      compiled.resources.charges.id,
      [...resourcePath, compiled.resources.charges.id],
      compiled.resources.charges
    )
  }
  if ('multiclass' in compiled) {
    const multiclass = compiled.multiclass
    const multiclassPath = [...rootPath, multiclass.id]
    addUuidNode(nodes, 'MULTICLASS', multiclass.id, multiclassPath, multiclass)
    const groups = multiclass.requirementGroups
    const groupsPath = [...multiclassPath, groups.id]
    addUuidNode(nodes, 'MULTICLASS_REQUIREMENT_GROUPS', groups.id, groupsPath, groups)
    for (const group of groups.groups) {
      const groupPath = [...groupsPath, group.id]
      addUuidNode(nodes, 'MULTICLASS_REQUIREMENT_GROUP', group.id, groupPath, group)
      for (const requirement of group.requirements)
        addUuidNode(
          nodes,
          'MULTICLASS_REQUIREMENT',
          requirement.id,
          [...groupPath, requirement.id],
          requirement
        )
    }
    for (const grant of multiclass.proficiencies ?? [])
      addUuidNode(nodes, 'PROFICIENCY_GRANT', grant.id, [...multiclassPath, grant.id], grant)
  }
  if (compiled.spellcasting?.charges) {
    const charge = compiled.spellcasting.charges
    addUuidNode(nodes, 'CHARGE', charge.id, [...rootPath, charge.id], charge)
  }
}

function addRaceNodes(nodes: CompiledSubjectMechanicsNode[], compiled: CompiledRace): void {
  const rootPath = [compiled.id]
  addRootCollections(nodes, compiled.id, compiled)
  if (!compiled.ancestry) return
  const ancestryPath = [...rootPath, compiled.ancestry.id]
  addUuidNode(nodes, 'RACE_ANCESTRY', compiled.ancestry.id, ancestryPath, compiled.ancestry)
  for (const option of compiled.ancestry.options) {
    const optionPath = [...ancestryPath, option.id]
    addUuidNode(nodes, 'RACE_ANCESTRY_OPTION', option.id, optionPath, option)
    addFeatures(nodes, optionPath, option.features as CompiledFeatureLike[] | undefined)
  }
}

function buildMechanicsIndex(
  subjectKind: CompiledSubjectKind,
  compiled: CompiledSubjectProjection
): CompiledSubjectMechanicsIndex {
  const rootId = compiled.id
  const nodes: CompiledSubjectMechanicsNode[] = [
    {
      kind: 'ROOT_COMPILED_SEMANTICS',
      nodeKind: 'ROOT_COMPILED_SEMANTICS',
      sourcePath: [rootId],
      semanticDescriptor: rootDescriptor(subjectKind, compiled)
    }
  ]
  switch (subjectKind) {
    case 'CLASS':
      addClassNodes(nodes, compiled as CompiledClass)
      break
    case 'RACE':
      if ('size' in compiled) addRaceNodes(nodes, compiled as CompiledRace)
      else addRootCollections(nodes, rootId, compiled)
      break
    default:
      addRootCollections(nodes, rootId, compiled)
      break
  }
  return { contractVersion: 1, subjectKind, rootId, nodes }
}

function compileSubject(
  subjectKind: CompiledSubjectKind,
  authored: unknown,
  sourceOnly = true
): CompiledSubjectProjection {
  switch (subjectKind) {
    case 'BACKGROUND':
      return compileBackground(authored as BackgroundAuthored)
    case 'CLASS':
      return compileClass(authored as ClassAuthored)
    case 'CREATURE':
      return compileCreature(authored as CreatureAuthored)
    case 'EQUIPMENT':
      return sourceOnly
        ? compileEquipment(authored as EquipmentAuthored)
        : compileResolvedEquipment(authored as ResolvedEquipment)
    case 'FEAT':
      return compileFeat(authored as FeatAuthored)
    case 'RACE': {
      const race = authored as RaceAuthored
      if (sourceOnly && race.category === 'SUBRACE') return compileSubraceSource(race)
      return compileRace(race as ResolvedRace)
    }
    case 'SPELL':
      return compileSpell(authored as SpellAuthored)
    case 'VEHICLE':
      return compileVehicle(authored as VehicleAuthored)
  }
}

/** Compiles authored source once and exposes its non-persisted mechanics audit index. */
export function compileSubjectWithMechanicsIndex(input: {
  subjectKind: CompiledSubjectKind
  authored: unknown
  effectiveAuthored?: unknown
}): CompiledSubjectWithMechanicsIndex {
  const sourceCompiled = compileSubject(input.subjectKind, input.authored)
  const compiled =
    input.effectiveAuthored === undefined
      ? sourceCompiled
      : compileSubject(input.subjectKind, input.effectiveAuthored, false)
  return { compiled, mechanicsIndex: buildMechanicsIndex(input.subjectKind, sourceCompiled) }
}

/** Guards the reproducible audit artifact before publication or source auditing consumes it. */
export function assertCompiledSubjectMechanicsIndex(index: CompiledSubjectMechanicsIndex): void {
  if (!UUID.test(index.rootId))
    throw new Error('Compiled mechanics index root identity must be a UUID.')
  const identities = new Set<string>()
  for (const node of index.nodes) {
    if (node.sourcePath.some((id) => !UUID.test(id))) {
      throw new Error('Compiled mechanics index paths must contain UUID identities only.')
    }
    if (node.kind === 'COMPILED_EFFECT_GROUP' && !UUID.test(node.effectId)) {
      throw new Error('Compiled mechanics index effect identity must be a UUID.')
    }
    if (node.kind === 'UUID_COMPILED_SEMANTICS' && !UUID.test(node.nodeId)) {
      throw new Error('Compiled mechanics index node identity must be a UUID.')
    }
    if (
      node.sourcePath[0] !== index.rootId ||
      node.sourcePath.filter((id) => id === index.rootId).length !== 1
    )
      throw new Error('Compiled mechanics index paths must begin with the root UUID exactly once.')
    const identity =
      node.kind === 'COMPILED_EFFECT_GROUP'
        ? `${node.kind}:${node.effectId}:${node.sourcePath.join('/')}`
        : node.kind === 'ROOT_COMPILED_SEMANTICS'
          ? node.kind
          : `${node.nodeKind}:${node.nodeId}:${node.sourcePath.join('/')}`
    if (identities.has(identity))
      throw new Error(`Compiled mechanics index has duplicate node ${identity}.`)
    identities.add(identity)
  }
}
