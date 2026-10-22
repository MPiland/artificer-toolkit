import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import type { CharacterSpellSourceRef } from '@artificer-toolkit/shared/character'
import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'
import type { CompiledSpell } from '@artificer-toolkit/shared/subjects/compilers'
import { v5 as uuidv5 } from 'uuid'

export type SpellCastCandidate = CharacterRulePolicyInput['spellCastCandidates'][number]

/** How a grant's attributes say the spell is paid for; a grant with none casts from a slot. */
export function spellCastMode(attributes: readonly string[]): SpellCastCandidate['castMode'] {
  const set = new Set(attributes)
  if (set.has('LIMITED_USE')) return 'LIMITED_USE'
  if (set.has('CAST_AT_WILL')) return 'AT_WILL'
  if (set.has('CAST_AT_LEVEL')) return 'FIXED_LEVEL'
  if (set.has('RITUAL')) return 'RITUAL'
  return 'SPELL_SLOT'
}

function castLevels(spellLevel: number, mode: SpellCastCandidate['castMode'], fixedLevel?: number) {
  const baseLevel = fixedLevel ?? spellLevel
  if (spellLevel === 0 || mode !== 'SPELL_SLOT') return [baseLevel]
  return Array.from({ length: 10 - baseLevel }, (_, index) => baseLevel + index)
}

/**
 * The cast candidates of any holder, in the order they are appended: one per cast level of each
 * spell source, never twice for one candidate id. The holder supplies the id of a source's cast and
 * decides which sources and levels it may offer.
 */
export function createSpellCastCandidateList(
  createCandidateId: (source: CharacterSpellSourceRef, castLevel: number) => string
) {
  const candidates: SpellCastCandidate[] = []
  const seen = new Set<string>()
  return {
    candidates,
    append(
      source: CharacterSpellSourceRef,
      label: string,
      spellLevel: number,
      mode: SpellCastCandidate['castMode'],
      resourceOwnerKey: string | null,
      options: {
        fixedLevel?: number
        /** Narrows a slot-mode spell's cast levels to those the holder can pay for. */
        offersLevel?: (castLevel: number) => boolean
        /** The slot pool a limited-use cast also spends a slot from (D175); null for none. */
        slotPoolCode?: SpellCastCandidate['slotPoolCode']
      } = {}
    ) {
      const levels = castLevels(spellLevel, mode, options.fixedLevel)
      for (const [index, level] of levels.entries()) {
        if (options.offersLevel && !options.offersLevel(level)) continue
        const candidateId = createCandidateId(source, level)
        if (seen.has(candidateId)) continue
        seen.add(candidateId)
        candidates.push({
          sequence: candidates.length,
          candidateId,
          label,
          spellId: source.spellId,
          source,
          spellLevel,
          castMode: mode,
          castLevel: level,
          baseEntry: index === 0,
          resourceOwnerKey,
          slotPoolCode: options.slotPoolCode ?? null
        })
      }
    }
  }
}

const SPELL_CAST_ACTION_NAMESPACE = 'b7a2f1d6-3c4e-5a89-9d10-6e2f4c8a1b35'

/**
 * A Spell cast resolves through the action seam under this identity; the candidate carries the rest.
 * The candidate id embeds the source and the spell and can outgrow an action identity, so the action
 * id is a fixed-length digest of it. A spell's first Effect group keeps that id; each further group
 * (Shield's reaction to being targeted) is its own action, named by its Effect id as well.
 */
export function spellCastActionId(candidateId: string, laterEffectId?: string): string {
  return `spell-cast:${uuidv5(laterEffectId === undefined ? candidateId : `${candidateId}#${laterEffectId}`, SPELL_CAST_ACTION_NAMESPACE)}`
}

const LEVEL_SUFFIXES = ['th', 'st', 'nd', 'rd']

/** "Cure Wounds (2nd level)"; a cantrip is just its name. */
export function spellCastLabel(
  spell: Pick<CompiledSpell, 'label'>,
  cast: Pick<SpellCastCandidate, 'spellLevel' | 'castLevel'>
): string {
  return cast.spellLevel === 0
    ? spell.label
    : `${spell.label} (${cast.castLevel}${LEVEL_SUFFIXES[cast.castLevel] ?? 'th'} level)`
}

/**
 * The Effect groups a cast of the spell runs, one action each. One cast action runs one group, so a
 * spell with several is offered only when each group is a reaction of its own (Shield answering an
 * attack, and answering Magic Missile); any other multi-group spell has none.
 */
export function castableEffectGroups(spell: CompiledSpell): readonly CompiledEffectGroup[] {
  const effects = (spell.effects ?? []).filter((effect) => effect.invocation.kind !== 'PASSIVE')
  return effects.length > 1 &&
    !effects.every(
      ({ invocation }) => 'activation' in invocation && invocation.activation.code === 'REACTION'
    )
    ? []
    : effects
}
