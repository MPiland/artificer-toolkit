// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { abilityModifier } from '@artificer-toolkit/rules-runtime/systems/dnd5e/abilityModifier'
import {
  hitDieAverage,
  parseHitDie
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/hitPointRules'
import { proficiencyBonus } from '@artificer-toolkit/rules-runtime/systems/dnd5e/proficiencyBonus'
import { prepareCharacterHitpointProgression } from '@artificer-toolkit/rules-runtime/character/builderHitPoints'
import {
  previewSnapshotCharacterBuilder,
  resolveSnapshotCharacterBuilderPayload
} from '@artificer-toolkit/rules-runtime/character/snapshotBuilderEvaluation'
import { createSnapshotReaders } from '@artificer-toolkit/rules-runtime/character/snapshotReaders'
import { parentClassAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/class'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { compileClass } from '@artificer-toolkit/shared/subjects/compilers'
import { barbarian } from '@artificer-toolkit/source-data/srd/classes/barbarian.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { human } from '@artificer-toolkit/source-data/srd/races/human.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { buildClassDetailModel } from '#app/domains/classes/pages/ClassDetail.model'
import { buildCreatureDetailModel } from '#app/domains/creatures/pages/CreatureDetail.model'
import { ownedMonsterFixture } from '#app/domains/creatures/creature.fixtures'
import { syncHitpointLevels } from '#app/domains/characters/builder/steps/abilities/characterAbilities'
import { srdSnapshot } from '#app/domains/characters/builder/evaluation/builderSnapshot.fixtures'
import {
  createFallbackCharacterFormValues,
  normalizeCharacterForDraft
} from '#app/domains/characters/builder/shared/formNormalization'

// RELIABILITY-7.2. The Builder, class detail and creature surfaces show the numbers the server
// computes because they call the same shared rules (ADR 0036); these tests run real SRD content
// through the real server evaluation and compare, so a reintroduced local copy shows as drift.

const USER_ID = '00000000-0000-4000-8000-000000000901'
const readers = createSnapshotReaders(srdSnapshot.objects)
const noReferences = { currencies: [], equipment: [], languages: [], skills: [] }

const abilities: CharacterAuthored['intent']['abilities'] = {
  method: 'STANDARD_ARRAY',
  assignments: [
    { ability: 'STRENGTH', option: '15' },
    { ability: 'DEXTERITY', option: '13' },
    { ability: 'CONSTITUTION', option: '14' },
    { ability: 'INTELLIGENCE', option: '12' },
    { ability: 'WISDOM', option: '10' },
    { ability: 'CHARISMA', option: '8' }
  ]
}

type ClassLevels = { classId: string; classLevel: number }[]
type HitpointLevel = CharacterAuthored['intent']['hitpoints']['levels'][number]

const baseClasses = [fighter, wizard, barbarian].map((record) =>
  parentClassAuthoredDtoSchema.parse(record)
)
const fighterClass = parentClassAuthoredDtoSchema.parse(fighter)

function hitDieOf(classId: string): number {
  const record = baseClasses.find((candidate) => candidate.id === classId)
  const die = parseHitDie(record?.hitpoint?.dieConfig)
  if (die === null) throw new Error(`Expected ${classId} to have a hit die.`)
  return die
}

function placeholderLevels(classes: ClassLevels, method: 'FIXED' | 'MANUAL'): HitpointLevel[] {
  return classes.flatMap(({ classId, classLevel }, classIndex) =>
    Array.from({ length: classLevel }, (_, index) => {
      const level =
        classes.slice(0, classIndex).reduce((total, entry) => total + entry.classLevel, 0) +
        index +
        1
      return {
        level,
        classId,
        classLevel: index + 1,
        value: 1,
        ...(method === 'MANUAL' && level > 1
          ? { rolls: [{ die: hitDieOf(classId), value: 2 }] }
          : {})
      }
    })
  )
}

function characterWith(
  classes: ClassLevels,
  method: 'FIXED' | 'MANUAL',
  levels: HitpointLevel[] = placeholderLevels(classes, method)
) {
  const values = createFallbackCharacterFormValues(srdSystemRecord.id)
  return normalizeCharacterForDraft({
    ...values,
    id: '00000000-0000-4000-8000-000000000902',
    label: 'Parity hero',
    userId: USER_ID,
    intent: {
      ...values.intent,
      race: { raceId: human.id },
      classes,
      abilities,
      hitpoints: { method, levels }
    }
  })
}

async function evaluateOnServer(character: ReturnType<typeof characterWith>) {
  const input = {
    character: { ...character, userId: USER_ID, status: 'DRAFT' } as CharacterAuthored,
    previousCharacter: null,
    mode: 'create' as const,
    system: srdSystemRecord,
    publicId: 'parity-hero',
    baseActiveUpdatedAt: null,
    contentMaturity: null
  }
  const [preview, payload] = await Promise.all([
    previewSnapshotCharacterBuilder(input, readers),
    resolveSnapshotCharacterBuilderPayload(input, readers)
  ])
  return { preview, payload }
}

const parityCases: { name: string; classes: ClassLevels; method: 'FIXED' | 'MANUAL' }[] = [
  { name: 'Fighter 3, fixed', classes: [{ classId: fighter.id, classLevel: 3 }], method: 'FIXED' },
  { name: 'Wizard 3, manual', classes: [{ classId: wizard.id, classLevel: 3 }], method: 'MANUAL' },
  {
    name: 'Barbarian 3, manual',
    classes: [{ classId: barbarian.id, classLevel: 3 }],
    method: 'MANUAL'
  },
  {
    name: 'Fighter 2 / Wizard 2, fixed',
    classes: [
      { classId: fighter.id, classLevel: 2 },
      { classId: wizard.id, classLevel: 2 }
    ],
    method: 'FIXED'
  }
]

describe('Builder hit points match the server', () => {
  it.each(parityCases)('$name', async ({ classes, method }) => {
    const character = characterWith(classes, method)
    const { preview, payload } = await evaluateOnServer(character)

    const web = syncHitpointLevels({
      character,
      classReferences: payload.references.classes,
      resolvedAbilityScores: payload.resolution.summary.abilities,
      rows: character.intent.hitpoints.levels
    })

    expect(web).toEqual(preview.character.intent.hitpoints.levels)
    expect(web.length).toBe(classes.reduce((total, entry) => total + entry.classLevel, 0))
  })

  it('does not recompute a hit die the shared rules cannot parse (2d6)', async () => {
    const classes = [{ classId: fighter.id, classLevel: 2 }]
    const character = characterWith(classes, 'FIXED', [
      { level: 1, classId: fighter.id, classLevel: 1, value: 10 },
      { level: 2, classId: fighter.id, classLevel: 2, value: 5 }
    ])
    const { payload } = await evaluateOnServer(character)
    const hitpoint = { ...fighterClass.hitpoint, dieConfig: '2d6' }
    const classReferences = payload.references.classes.map((reference) =>
      reference.id === fighter.id ? { ...reference, hitpoint } : reference
    )

    const customFighter = { ...fighter, hitpoint }
    const serverRows = prepareCharacterHitpointProgression(
      character as CharacterAuthored,
      [compileClass(customFighter)],
      null
    ).facts.rows
    const web = syncHitpointLevels({
      character,
      classReferences,
      resolvedAbilityScores: payload.resolution.summary.abilities,
      rows: character.intent.hitpoints.levels
    })

    expect(serverRows.every((row) => row.die === null)).toBe(true)
    expect(web.map((row) => row.value)).toEqual([10, 5])
    expect(
      buildClassDetailModel({ ...fighterClass, hitpoint }, noReferences).hitPointHtml
    ).not.toContain('(or ')
  })
})

describe('class detail matches the shared rules', () => {
  it.each(baseClasses)('shows the hit die average for $label', (record) => {
    const die = hitDieOf(record.id)
    const { hitPointHtml } = buildClassDetailModel(record, noReferences)

    expect(hitPointHtml).toContain(`1d${die} (or ${hitDieAverage(die)})`)
    expect(hitPointHtml).toContain(`Hit Points at 1st Level:</strong> ${die} +`)
  })

  it('shows the proficiency bonus the server derives for every level', () => {
    const { progressionHtml } = buildClassDetailModel(fighterClass, noReferences)
    const shown = [
      ...progressionHtml.matchAll(/data-progression-column="proficiency">\+(\d+)</g)
    ].map((match) => Number(match[1]))

    expect(shown).toEqual(Array.from({ length: 20 }, (_, index) => proficiencyBonus(index + 1)))
    expect(shown.at(0)).toBe(2)
    expect(shown.at(-1)).toBe(6)
  })
})

describe('creature detail matches the shared ability modifier', () => {
  it.each(Array.from({ length: 30 }, (_, index) => index + 1))('score %i', (score) => {
    const model = buildCreatureDetailModel(
      {
        ...ownedMonsterFixture,
        abilityScores: {
          STRENGTH: score,
          DEXTERITY: score,
          CONSTITUTION: score,
          INTELLIGENCE: score,
          WISDOM: score,
          CHARISMA: score
        }
      },
      {
        abilities: srdSystemRecord.abilities.map(({ code, short }) => ({
          value: code,
          short: short ?? code
        })),
        challengeRatings: [],
        conditionTypes: [],
        creatureTypes: [],
        damageTypes: [],
        equipment: [],
        speeds: []
      },
      null
    )
    const modifier = abilityModifier(score)

    expect(model.stats.abilities.map((ability) => ability.modifier)).toEqual(
      Array(6).fill(modifier >= 0 ? `+${modifier}` : String(modifier))
    )
  })
})
