import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { srdBaselineContent } from '../source-data/srd/index.js'

const PROSE_KEYS = new Set(['cargoCapacity', 'description', 'notes', 'quote', 'speedNote'])

// These exact paths were visually verified against the tracked PDF because its TXT extraction
// reorders table cells, omits symbols, or separates otherwise contiguous paragraphs.
const PDF_ONLY_PROSE_PATHS = new Set([
  // Acolyte characteristic table, PDF 61.
  'backgrounds.Acolyte.details[0].description',
  'backgrounds.Acolyte.details[2].description',
  'backgrounds.Acolyte.details[4].description',
  'backgrounds.Acolyte.details[6].description',
  'backgrounds.Acolyte.details[8].description',
  'backgrounds.Acolyte.details[10].description',
  'backgrounds.Acolyte.details[12].description',
  'backgrounds.Acolyte.details[14].description',
  'backgrounds.Acolyte.details[16].description',
  'backgrounds.Acolyte.details[20].description',
  'backgrounds.Acolyte.details[22].description',
  'backgrounds.Acolyte.details[24].description',
  // Class tables and interrupted prose flows, PDF 16, 20-21, 31, 39-40, 43-45, 47, and 53.
  'classes.Cleric.spellcasting.details[2].description',
  'classes.Cleric.features[1].description',
  'classes.Cleric.features[3].description',
  'classes.Cleric.features[6].description',
  'classes.Cleric.features[8].description',
  'classes.Cleric.features[11].description',
  'classes.Druid.spellcasting.details[2].description',
  'classes.Druid.features[2].description',
  'classes.Druid.features[12].description',
  'classes.Paladin.spellcasting.details[1].description',
  'classes.Paladin.features[1].description',
  'classes.Rogue.features[1].description',
  'classes.Rogue.features[8].description',
  'classes.Sorcerer.features[3].description',
  'classes.Sorcerer.features[4].options[0].description',
  'classes.Warlock.spellcasting.details[2].description',
  'classes.Wizard.spellcasting.details[3].description',
  'classes.Life Domain.features[0].description',
  'classes.Draconic Bloodline.features[0].description',
  'classes.Draconic Bloodline.features[4].description',
  // Equipment packs, PDF 70.
  "equipment.Burglar's Pack.description",
  "equipment.Diplomat's Pack.description",
  "equipment.Dungeoneer's Pack.description",
  "equipment.Entertainer's Pack.description",
  "equipment.Explorer's Pack.description",
  "equipment.Priest's Pack.description",
  "equipment.Scholar's Pack.description",
  // Creature stat blocks interrupted by adjacent PDF columns.
  'creatures.Behir.features[4].description', // PDF 266.
  'creatures.Bulette.features[1].description', // PDF 267.
  'creatures.Hell Hound.features[1].description', // PDF 322.
  'creatures.Mimic.features[4].description', // PDF 333.
  'creatures.Minotaur.features[0].description', // PDF 333.
  'creatures.Shadow.features[2].description', // PDF 345.
  'creatures.Shambling Mound.features[1].description', // PDF 345.
  "creatures.Will-o'-Wisp.features[3].description", // PDF 355.
  'creatures.Young White Dragon.features[2].description' // PDF 290.
])

interface ProseEntry {
  path: string
  text: string
}

function normalizeSrdText(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&(?:rsquo|#39);/g, "'")
    .replace(/[‘’]/g, "'")
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/\b11\/2\b/g, '1½')
    .replace(/\b21\/2\b/g, '2½')
    .replace(/\s+/g, ' ')
    .trim()
}

function collectProse(value: unknown, path: string): ProseEntry[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectProse(entry, `${path}[${index}]`))
  }

  if (!value || typeof value !== 'object') return []

  return Object.entries(value).flatMap(([key, entry]) => {
    const entryPath = path ? `${path}.${key}` : key

    if (PROSE_KEYS.has(key) && typeof entry === 'string') {
      return [{ path: entryPath, text: entry }]
    }

    return collectProse(entry, entryPath)
  })
}

describe('SRD authored prose', () => {
  it('keeps prose in all eight authored domains verbatim from the tracked SRD', () => {
    const source = normalizeSrdText(
      readFileSync(new URL('../source-data/srd/SRD_CC_v5.1.txt', import.meta.url), 'utf8')
    )
    const mismatches = Object.entries(srdBaselineContent.subjects).flatMap(([domain, records]) =>
      (records as readonly { label: string }[]).flatMap((record) =>
        collectProse(record, `${domain}.${record.label}`)
          .filter(
            ({ path, text }) =>
              !source.includes(normalizeSrdText(text)) && !PDF_ONLY_PROSE_PATHS.has(path)
          )
          .map(({ path, text }) => `${path}: ${text}`)
      )
    )

    expect(mismatches).toEqual([])
  })
})
