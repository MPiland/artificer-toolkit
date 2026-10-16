import { describe, expect, it } from 'vitest'
import { srdBaselineContent } from './index.js'

/**
 * SPELLS-27.T5. Printed text that ends an effect when its holder is harmed, damaged, attacks or casts
 * a spell must be authored as an end event on the record's effects (`endOnTriggers` / `endOnEvents`),
 * or the record must be listed here with the mechanism that covers it. A listing never excuses a
 * record that authors the event: that would let the authoring and the list drift apart.
 */
type EndEventCover =
  | {
      /** The record has no engine effect, or ends in a way the GM applies at the table. */
      mechanism: 'GM_ADJUDICATED'
      reason: string
    }
  | {
      /** Needs a mechanic the effect forms do not carry yet; the follow-up is tracked in the roadmap. */
      mechanism: 'REGISTERED_FOLLOW_UP'
      reason: string
    }

const NO_ENGINE_EFFECT =
  'a closed rule or manual adjudication: it creates no effect to carry the end'

const COVERED_END_EVENTS: Record<string, EndEventCover> = {
  'spells/Animal Friendship': { mechanism: 'GM_ADJUDICATED', reason: NO_ENGINE_EFFECT },
  'spells/Awaken': { mechanism: 'GM_ADJUDICATED', reason: NO_ENGINE_EFFECT },
  'spells/Calm Emotions': { mechanism: 'GM_ADJUDICATED', reason: NO_ENGINE_EFFECT },
  'spells/Eyebite': { mechanism: 'GM_ADJUDICATED', reason: NO_ENGINE_EFFECT },
  'spells/Mass Suggestion': { mechanism: 'GM_ADJUDICATED', reason: NO_ENGINE_EFFECT },
  'spells/Mislead': { mechanism: 'GM_ADJUDICATED', reason: NO_ENGINE_EFFECT },
  'spells/Modify Memory': { mechanism: 'GM_ADJUDICATED', reason: NO_ENGINE_EFFECT },
  'spells/Produce Flame': { mechanism: 'GM_ADJUDICATED', reason: NO_ENGINE_EFFECT },
  'spells/Project Image': { mechanism: 'GM_ADJUDICATED', reason: NO_ENGINE_EFFECT },
  'spells/Sequester': { mechanism: 'GM_ADJUDICATED', reason: NO_ENGINE_EFFECT },
  'spells/Suggestion': { mechanism: 'GM_ADJUDICATED', reason: NO_ENGINE_EFFECT },
  'classes/Oath of Devotion > Channel Divinity: Turn the Unholy': {
    mechanism: 'GM_ADJUDICATED',
    reason: NO_ENGINE_EFFECT
  },
  'spells/Hypnotic Pattern': {
    mechanism: 'REGISTERED_FOLLOW_UP',
    reason:
      'charmed, incapacitated and speed 0 from one timed effect, which has one condition today'
  },
  'spells/Phantom Steed': {
    mechanism: 'REGISTERED_FOLLOW_UP',
    reason: 'the end is damage to the manifested steed, not to the spell holder'
  },
  'spells/Sanctuary': {
    mechanism: 'REGISTERED_FOLLOW_UP',
    reason: 'SPELLS-27.T7: a Wisdom-save targeting ward that ends when its holder attacks an enemy'
  },
  'spells/Sleep': {
    mechanism: 'REGISTERED_FOLLOW_UP',
    reason: 'targets by a hit point pool, lowest first'
  },
  'creatures/Drow > Hand Crossbow': {
    mechanism: 'REGISTERED_FOLLOW_UP',
    reason: 'unconscious on failing by 5 or more, ending on damage'
  },
  'creatures/Pseudodragon > Sting': {
    mechanism: 'REGISTERED_FOLLOW_UP',
    reason: 'unconscious on failing by 5 or more, ending on damage'
  },
  'creatures/Sprite > Shortbow': {
    mechanism: 'REGISTERED_FOLLOW_UP',
    reason: 'unconscious on failing by 5 or more, ending on damage'
  },
  'creatures/Green Hag > Invisible Passage': {
    mechanism: 'REGISTERED_FOLLOW_UP',
    reason: 'invisibility with no duration, kept by concentration, ending on an attack or a cast'
  },
  'creatures/Imp > Invisibility': {
    mechanism: 'REGISTERED_FOLLOW_UP',
    reason: 'invisibility with no duration, kept by concentration, ending on an attack or a cast'
  },
  'creatures/Quasit > Invisibility': {
    mechanism: 'REGISTERED_FOLLOW_UP',
    reason: 'invisibility with no duration, kept by concentration, ending on an attack or a cast'
  },
  'creatures/Sprite > Invisibility': {
    mechanism: 'REGISTERED_FOLLOW_UP',
    reason: 'invisibility with no duration, kept by concentration, ending on an attack or a cast'
  },
  "creatures/Will-o'-Wisp > Invisibility": {
    mechanism: 'REGISTERED_FOLLOW_UP',
    reason: 'invisibility with no duration, kept by concentration, ending on an attack or a cast'
  }
}

const END_WORD = /\b(?:ends|wakes|disappears)\b|\bend\b(?! of)|\buntil\b(?! the (?:end|start))/i
/** The holder is hurt: damage taken, or harm done to it by someone. */
const HOLDER_HARMED =
  /\btakes? (?:any )?damage\b|\bharm(?:s|ed)?\b|\bharmful\b|\bdamages? a creature\b|\bis attacked\b/i
/** The holder acts: it attacks or casts a spell. */
const HOLDER_ACTS =
  /\buntil\b[^.,]{0,40}\b(?:attacks?|casts? a spell)\b|\bends (?:if|for)\b[^.]*\b(?:attacks?|casts? a spell)\b|\bdoing so ends\b/i
/** "Until the spell ends, your attacks…" names the duration, not an early end. */
const SPELL_DURATION = /\b(?:until|before) (?:the|this) (?:spell|effect) ends\b/gi
const AUTHORED_END = /"(?:endOnTriggers|endOnEvents|endOnConditionIds)"/

function sentencesOf(description: string) {
  return description
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .split(/(?<=[.!?])\s+/)
}

function endsOnHolderEvent(sentence: string) {
  const text = sentence.replace(/\bto end\b/gi, '')
  return (
    (HOLDER_HARMED.test(text) && END_WORD.test(text)) ||
    HOLDER_ACTS.test(text.replace(SPELL_DURATION, ''))
  )
}

type Hit = { key: string; authored: boolean }

/** Every record whose description prints such an end, keyed by its labels from the subject down. */
function endEventHits(node: unknown, path: readonly string[], found: Hit[]): Hit[] {
  if (Array.isArray(node)) {
    for (const child of node) endEventHits(child, path, found)
    return found
  }
  if (typeof node !== 'object' || node === null) return found
  const record = node as Record<string, unknown>
  const here =
    typeof record.label === 'string' && record.label !== path.at(-1)
      ? [...path, record.label]
      : path
  if (
    typeof record.description === 'string' &&
    typeof record.label === 'string' &&
    sentencesOf(record.description).some(endsOnHolderEvent)
  )
    found.push({
      key: here.join(' > '),
      authored: AUTHORED_END.test(JSON.stringify(record.effects ?? []))
    })
  for (const child of Object.values(record)) endEventHits(child, here, found)
  return found
}

const hits = Object.entries(srdBaselineContent.subjects).flatMap(([collection, records]) =>
  endEventHits(records, [], []).map(({ key, authored }) => ({
    key: `${collection}/${key}`,
    authored
  }))
)

describe('SRD text that ends an effect when its holder is harmed, attacks or casts (SPELLS-27.T5)', () => {
  it('finds the printed end events the SRD carries', () => {
    expect(hits.filter(({ authored }) => authored).map(({ key }) => key)).toEqual(
      expect.arrayContaining([
        'spells/Charm Person',
        'spells/Invisibility',
        'creatures/Duergar > Invisibility (Recharges after a Short or Long Rest)'
      ])
    )
  })

  it('authors the end event of every record that prints one, or names what covers it', () => {
    const uncovered = hits
      .filter(({ authored, key }) => !authored && !(key in COVERED_END_EVENTS))
      .map(({ key }) => key)
    expect(uncovered).toEqual([])
  })

  it('lists only records that print an end event and do not author it', () => {
    const unauthored = new Set(hits.filter(({ authored }) => !authored).map(({ key }) => key))
    expect(Object.keys(COVERED_END_EVENTS).filter((key) => !unauthored.has(key))).toEqual([])
  })
})
