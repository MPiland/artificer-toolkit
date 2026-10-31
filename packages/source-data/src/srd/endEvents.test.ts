import { describe, expect, it } from 'vitest'
import { srdBaselineContent } from './index.js'

/**
 * SPELLS-27.T5 (D122 amendments of 2026-10-16). Printed text that ends an effect when its holder is
 * harmed, damaged, attacks or casts a spell must be authored as an end event on the record's effects
 * (an `endTriggers` entry that is not used up, or `endOnConditionIds`), or the record must be listed here under the category that covers
 * it. A listing never excuses a record that authors the event: that would let the authoring and the
 * list drift apart. A closed rule creates no effect, so it is `GM_ADJUDICATED`, never "covered".
 * AC 27.2 closes when no entry is `REGISTERED_FOLLOW_UP`.
 */
type EndEventCover =
  | {
      /** A closed rule or manual adjudication with no effect; the GM applies the end at the table. */
      mechanism: 'GM_ADJUDICATED'
    }
  | {
      /** An effect that ends with its Concentration, so no holder event is needed. */
      mechanism: 'CONCENTRATION'
    }
  | {
      /** An effect the holder or caster dismisses. */
      mechanism: 'DISMISSAL'
    }
  | {
      /** An effect that ends by distance. */
      mechanism: 'DISTANCE'
    }
  | {
      /** An effect that ends by its timed duration. */
      mechanism: 'DURATION'
    }
  | {
      /** Needs a mechanic the effect forms do not carry yet; the named task adds it. */
      mechanism: 'REGISTERED_FOLLOW_UP'
      task: 'T7 Sanctuary'
    }

const GM_ADJUDICATED: EndEventCover = { mechanism: 'GM_ADJUDICATED' }

const COVERED_END_EVENTS: Record<string, EndEventCover> = {
  'spells/Awaken': GM_ADJUDICATED,
  'spells/Calm Emotions': GM_ADJUDICATED,
  'spells/Eyebite': GM_ADJUDICATED,
  'spells/Mass Suggestion': GM_ADJUDICATED,
  'spells/Mislead': GM_ADJUDICATED,
  'spells/Modify Memory': GM_ADJUDICATED,
  'spells/Phantom Steed': GM_ADJUDICATED,
  'spells/Produce Flame': GM_ADJUDICATED,
  'spells/Project Image': GM_ADJUDICATED,
  'spells/Suggestion': GM_ADJUDICATED,
  'classes/Cleric > Channel Divinity': GM_ADJUDICATED,
  'classes/Oath of Devotion > Channel Divinity: Turn the Unholy': GM_ADJUDICATED
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
/** Whether an effect authors an end: a trigger that ends it (a use-up is not an end) or end conditions. */
function authorsEnd(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(authorsEnd)
  if (typeof node !== 'object' || node === null) return false
  const record = node as Record<string, unknown>
  if ('endOnConditionIds' in record) return true
  const { endTriggers } = record
  if (
    Array.isArray(endTriggers) &&
    endTriggers.some((trigger: { timing?: string }) => trigger.timing !== 'CONSUME')
  )
    return true
  return Object.values(record).some(authorsEnd)
}

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
      authored: authorsEnd(record.effects ?? [])
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
