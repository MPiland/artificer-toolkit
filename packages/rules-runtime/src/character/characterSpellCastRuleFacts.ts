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
import { createSpellCastCandidateList, spellCastMode } from '../spellCastCandidates.js'

type ResourcePoolCandidate = CharacterRulePolicyInput['resourcePoolCandidates'][number]

export function createCharacterSpellCastCandidateId(
  source: CharacterSpellSourceRef,
  castLevel: number
): string {
  return `${createCharacterSpellSourceKey(source)}:level:${castLevel}`
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
  const { candidates: spellCastCandidates, append } = createSpellCastCandidateList(
    createCharacterSpellCastCandidateId
  )

  for (const source of params.snapshot.spellSources ?? []) {
    const spell = spellById.get(source.spellId)
    if (!spell) continue
    append(source, spell.label, spell.level, 'SPELL_SLOT', null)
  }

  for (const { source } of params.snapshot.classRitualSources ?? []) {
    const spell = spellById.get(source.spellId)
    if (spell) append(source, spell.label, spell.level, 'RITUAL', null)
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
    const mode = spellCastMode(access.attributes)
    append(
      source,
      spell.label,
      spell.level,
      mode,
      spellPoolByAccessId.get(access.accessId) ?? null,
      {
        fixedLevel: access.attributes.includes('CAST_AT_LEVEL')
          ? (access.castAtLevel ?? undefined)
          : undefined
      }
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
