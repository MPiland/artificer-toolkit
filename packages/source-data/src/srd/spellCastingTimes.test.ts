import { readFileSync } from 'node:fs'

import { CASTING_TIME_UNIT_CODE } from '@artificer-toolkit/shared'
import { describe, expect, it } from 'vitest'

import { srdSpells } from './spells/index.js'

const lines = readFileSync(new URL('./SRD_CC_v5.1.txt', import.meta.url), 'utf8').split(/\r?\n/)

/** One entry per spell: the name line, then the level/school line, then the Casting Time line. */
const srdCastingTimeLines = lines.flatMap((line, index) => {
  const match = /^Casting Time: (.+?)(?: Range:.*)?$/.exec(line)
  const levelLine = lines[index - 1] ?? ''
  if (!match || !/-level |cantrip/.test(levelLine)) return []
  return [{ name: lines[index - 2] ?? '', text: match[1] ?? '' }]
})

/** Actions, bonus actions and reactions are authored as one round; longer times keep their unit. */
const expectedCastingTime = (text: string) => {
  const timed = /^(\d+) (minute|hour)s?\b/.exec(text)
  return timed
    ? {
        unit: timed[2] === 'hour' ? CASTING_TIME_UNIT_CODE.HOUR : CASTING_TIME_UNIT_CODE.MINUTE,
        amount: Number(timed[1])
      }
    : { unit: CASTING_TIME_UNIT_CODE.ROUND, amount: 1 }
}

const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '')

describe('SRD spell casting times', () => {
  it('reads one Casting Time line per authored spell', () => {
    expect(srdCastingTimeLines).toHaveLength(srdSpells.length)
  })

  it.each(srdCastingTimeLines)('$name matches the SRD line "$text"', ({ name, text }) => {
    const spell = srdSpells.find((candidate) => normalize(candidate.label) === normalize(name))
    expect(spell, `no authored spell for SRD spell ${name}`).toBeDefined()
    expect(spell?.castingTime).toEqual(expectedCastingTime(text))
  })
})
