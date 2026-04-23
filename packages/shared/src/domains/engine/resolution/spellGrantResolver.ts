import { CLASS_CATEGORY, SCALING_SOURCE } from '#core'

import type { AssembledCharacterSpellAccess } from '../../core/assemblerContract.js'
import type { CharacterAssemblyRegistry } from '../registry.js'
import type { CharacterBuildSnapshot } from '../snapshot.js'
import type { CompiledClass } from '../../subjects/compilers/class.js'
import type { CompiledCharacterClassState } from '../../subjects/compilers/character/state.js'
import type { CompiledFeature } from '../../features/compilers/feature.js'
import type { CompiledSpellGrant } from '../../grants/compilers/spell.js'

export interface ResolvedSpellGrantState {
  spellState?: CompiledCharacterClassState[]
  spellAccess: AssembledCharacterSpellAccess[]
}

type SnapshotClassEntry = CharacterBuildSnapshot['classes'][number]

type SpellBuckets = {
  learned: string[]
  prepared: string[]
}

export function resolveSpellGrantState(
  snapshot: CharacterBuildSnapshot,
  registry: CharacterAssemblyRegistry
): ResolvedSpellGrantState {
  const spellState: CompiledCharacterClassState[] = []
  const spellAccess: AssembledCharacterSpellAccess[] = []
  const seenAccessSpellIds = new Set<string>()

  for (const classEntry of snapshot.classes) {
    const resolved = resolveClassSpellGrantState(classEntry, snapshot, registry)
    if (resolved.spells.learned.length || resolved.spells.prepared.length) {
      spellState.push({
        classId: classEntry.classId,
        spells: {
          learned: resolved.spells.learned.length ? resolved.spells.learned : undefined,
          prepared: resolved.spells.prepared.length ? resolved.spells.prepared : undefined
        }
      })
    }

    for (const access of resolved.spellAccess) {
      if (seenAccessSpellIds.has(access.spellId)) continue
      seenAccessSpellIds.add(access.spellId)
      spellAccess.push(access)
    }
  }

  return {
    spellState: spellState.length ? spellState : undefined,
    spellAccess
  }
}

function resolveClassSpellGrantState(
  classEntry: SnapshotClassEntry,
  snapshot: CharacterBuildSnapshot,
  registry: CharacterAssemblyRegistry
): { spells: SpellBuckets; spellAccess: AssembledCharacterSpellAccess[] } {
  const spells: SpellBuckets = { learned: [], prepared: [] }
  const spellAccess: AssembledCharacterSpellAccess[] = []

  const baseClass = registry.classes[classEntry.classId]
  if (baseClass) {
    resolveSpellGrantsFromCompiledClass(
      baseClass,
      classEntry,
      snapshot,
      spells,
      spellAccess,
      'CLASS'
    )
  }

  if (classEntry.subclassId) {
    const subclass = registry.classes[classEntry.subclassId]
    if (subclass?.category === CLASS_CATEGORY.SUBCLASS && subclass.parentClassId === classEntry.classId) {
      resolveSpellGrantsFromCompiledClass(
        subclass,
        classEntry,
        snapshot,
        spells,
        spellAccess,
        'SUBCLASS'
      )
    }
  }

  return { spells, spellAccess }
}

function resolveSpellGrantsFromCompiledClass(
  compiledClass: CompiledClass,
  classEntry: SnapshotClassEntry,
  snapshot: CharacterBuildSnapshot,
  spells: SpellBuckets,
  spellAccess: AssembledCharacterSpellAccess[],
  sourceKind: 'CLASS' | 'SUBCLASS'
): void {
  for (const feature of compiledClass.features ?? []) {
    if ((feature.availableAtLevel ?? 1) > classEntry.level) continue
    resolveFeatureSpellGrants(feature, classEntry, snapshot, spells, spellAccess, sourceKind)
  }
}

function resolveFeatureSpellGrants(
  feature: CompiledFeature,
  classEntry: SnapshotClassEntry,
  snapshot: CharacterBuildSnapshot,
  spells: SpellBuckets,
  spellAccess: AssembledCharacterSpellAccess[],
  sourceKind: 'CLASS' | 'SUBCLASS'
): void {
  for (const grant of feature.spells ?? []) {
    resolveSpellGrant(
      grant,
      classEntry,
      snapshot,
      spells,
      spellAccess,
      sourceKind,
      feature.id
    )
  }
}

function resolveSpellGrant(
  grant: CompiledSpellGrant,
  classEntry: SnapshotClassEntry,
  snapshot: CharacterBuildSnapshot,
  spells: SpellBuckets,
  spellAccess: AssembledCharacterSpellAccess[],
  sourceKind: 'CLASS' | 'SUBCLASS',
  sourceFeatureId: string
): void {
  if (!spellGrantMatchesSpecialization(grant, classEntry.specializationId)) {
    return
  }

  const spellIds = resolveGrantSpellIds(grant, classEntry, snapshot)
  if (!spellIds.length) return

  const grantAttributes = grant.attributes ?? []
  const isPrepared = grantAttributes.includes('PREPARED')
  const isKnown = grantAttributes.includes('KNOWN')

  for (const spellId of spellIds) {
    if (isPrepared) {
      pushUnique(spells.prepared, spellId)
    }
    if (isKnown || !isPrepared) {
      pushUnique(spells.learned, spellId)
    }

    spellAccess.push({
      id: `${sourceFeatureId}:${classEntry.classId}:${spellId}`,
      spellId,
      source:
        sourceKind === 'SUBCLASS'
          ? { kind: 'SUBCLASS', subclassId: classEntry.subclassId ?? classEntry.classId }
          : { kind: 'CLASS', classId: classEntry.classId },
      timing: {
        kind: 'CLASS_LEVEL',
        classId: classEntry.classId,
        classLevel: classEntry.level
      }
    })
  }
}

function resolveGrantSpellIds(
  grant: CompiledSpellGrant,
  classEntry: SnapshotClassEntry,
  snapshot: CharacterBuildSnapshot
): string[] {
  if (grant.scalingKind === 'NONE') {
    return grant.authoringModeKind === 'SELECTED' ? [...(grant.spellIds ?? [])] : []
  }

  if (grant.scalingKind !== 'PER_LEVEL') {
    return []
  }

  const effectiveLevel = resolveGrantLevelGate(grant, classEntry, snapshot)
  if (effectiveLevel <= 0) return []

  const spellIds: string[] = []
  for (const levelEntry of grant.levels) {
    if (levelEntry.level > effectiveLevel) continue
    if (levelEntry.authoringModeKind !== 'SELECTED') continue
    spellIds.push(...(levelEntry.spellIds ?? []))
  }

  return spellIds
}

function resolveGrantLevelGate(
  grant: CompiledSpellGrant,
  classEntry: SnapshotClassEntry,
  snapshot: CharacterBuildSnapshot
): number {
  const source = grant.scalingKind === 'PER_LEVEL' ? grant.scalingSource : undefined

  switch (source) {
    case SCALING_SOURCE.CHARACTER_LEVEL:
      return snapshot.totalLevel

    case SCALING_SOURCE.PARENT_CLASS_LEVEL:
    case SCALING_SOURCE.CLASS_LEVEL:
      return classEntry.level

    case SCALING_SOURCE.SPELL_CAST_LEVEL:
      return classEntry.level

    default:
      return classEntry.level
  }
}

function spellGrantMatchesSpecialization(
  grant: CompiledSpellGrant,
  specializationId: string | undefined
): boolean {
  const restrictionIds = collectSpecializationRestrictionIds(grant.restrictions)
  if (!restrictionIds) return true
  if (!specializationId) return false
  return restrictionIds.has(specializationId)
}

function collectSpecializationRestrictionIds(
  restrictions: unknown
): Set<string> | undefined {
  const ids = new Set<string>()
  let found = false

  walk(restrictions, (value) => {
    if (value?.predicateCode !== 'SUBCLASS_SPECIALIZATION') return
    found = true
    const specializationIds = Array.isArray(value.specializationIds)
      ? value.specializationIds
      : []
    for (const specializationId of specializationIds) {
      ids.add(String(specializationId))
    }
  })

  return found ? ids : undefined
}

function walk(
  value: unknown,
  visit: (record: Record<string, unknown>) => void
): void {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const entry of value) walk(entry, visit)
    return
  }

  const record = value as Record<string, unknown>
  visit(record)
  for (const child of Object.values(record)) {
    walk(child, visit)
  }
}

function pushUnique(list: string[], value: string): void {
  if (!list.includes(value)) {
    list.push(value)
  }
}
