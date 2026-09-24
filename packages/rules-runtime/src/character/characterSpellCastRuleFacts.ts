import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import {
  createCharacterSpellSourceKey,
  type CharacterSpellSourceRef
} from '@artificer-toolkit/shared/character'
import type { CharacterBuildSnapshot } from '@artificer-toolkit/shared/core'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  isCharacterSpellActionAccessCandidate,
  type CharacterSpellAccessCandidate
} from './characterSpellRuleFacts.js'

type ResourcePoolCandidate = CharacterRulePolicyInput['resourcePoolCandidates'][number]
type SpellCastCandidate = CharacterRulePolicyInput['spellCastCandidates'][number]

export function createCharacterSpellCastCandidateId(
  source: CharacterSpellSourceRef,
  castLevel: number
): string {
  return `${createCharacterSpellSourceKey(source)}:level:${castLevel}`
}

function castMode(candidate: CharacterSpellAccessCandidate): SpellCastCandidate['castMode'] {
  const attributes = new Set(candidate.attributes)
  if (attributes.has('LIMITED_USE')) return 'LIMITED_USE'
  if (attributes.has('CAST_AT_WILL')) return 'AT_WILL'
  if (attributes.has('CAST_AT_LEVEL')) return 'FIXED_LEVEL'
  if (attributes.has('RITUAL')) return 'RITUAL'
  return 'SPELL_SLOT'
}

function castLevels(spellLevel: number, mode: SpellCastCandidate['castMode'], fixedLevel?: number) {
  const baseLevel = fixedLevel ?? spellLevel
  if (spellLevel === 0 || mode !== 'SPELL_SLOT') return [baseLevel]
  return Array.from({ length: 10 - baseLevel }, (_, index) => baseLevel + index)
}

export function buildCharacterSpellCastRuleFacts(params: {
  snapshot: CharacterBuildSnapshot
  spellCatalog: readonly Pick<SpellAuthored, 'id' | 'label' | 'level'>[]
  spellAccessCandidates: readonly CharacterSpellAccessCandidate[]
  resourcePoolCandidates: readonly ResourcePoolCandidate[]
}): Pick<
  CharacterRulePolicyInput,
  'spellCastCandidates' | 'spellCastSlots' | 'spellCastResources'
> {
  const spellById = new Map(params.spellCatalog.map((spell) => [spell.id, spell]))
  const spellPoolByAccessId = new Map(
    params.resourcePoolCandidates.flatMap((pool) =>
      pool.ownerKind === 'SPELL_SOURCE' ? [[pool.accessId, pool.poolId] as const] : []
    )
  )
  const spellCastCandidates: SpellCastCandidate[] = []
  const seen = new Set<string>()

  const append = (
    source: CharacterSpellSourceRef,
    label: string,
    spellLevel: number,
    mode: SpellCastCandidate['castMode'],
    resourceOwnerKey: string | null,
    fixedLevel?: number
  ) => {
    const levels = castLevels(spellLevel, mode, fixedLevel)
    for (const [index, level] of levels.entries()) {
      const candidateId = createCharacterSpellCastCandidateId(source, level)
      if (seen.has(candidateId)) continue
      seen.add(candidateId)
      spellCastCandidates.push({
        sequence: spellCastCandidates.length,
        candidateId,
        label,
        spellId: source.spellId,
        source,
        spellLevel,
        castMode: mode,
        castLevel: level,
        baseEntry: index === 0,
        resourceOwnerKey
      })
    }
  }

  for (const source of params.snapshot.spellSources ?? []) {
    const spell = spellById.get(source.spellId)
    if (!spell) continue
    append(source, spell.label, spell.level, 'SPELL_SLOT', null)
  }

  for (const access of params.spellAccessCandidates) {
    if (!isCharacterSpellActionAccessCandidate(access)) continue
    const spell = spellById.get(access.spellId)
    if (!spell) continue
    const source: CharacterSpellSourceRef = {
      spellId: access.spellId,
      sourceKind: 'FEATURE',
      sourceInstanceId: access.sourceInstanceId
    }
    const mode = castMode(access)
    append(
      source,
      spell.label,
      spell.level,
      mode,
      spellPoolByAccessId.get(access.accessId) ?? null,
      mode === 'FIXED_LEVEL' ? (access.castAtLevel ?? spell.level) : undefined
    )
  }

  return {
    spellCastCandidates,
    // Retained in contract v3 for immutable historical revisions. The current policy resolves
    // both collections from same-evaluation spell-slot and resource outputs instead.
    spellCastSlots: [],
    spellCastResources: []
  }
}
