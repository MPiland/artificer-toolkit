import { describe, expect, it } from 'vitest'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import type { SourceImportSubjectDto } from '@artificer-toolkit/schema/api/sourceImport'
import type { CompiledFeature } from '@artificer-toolkit/shared/compilers'
import type { CharacterBuilderResolution } from '@artificer-toolkit/rules-runtime/character/builderTypes'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { championMartialArchetype } from '@artificer-toolkit/source-data/srd/classes/champion.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { srdClasses } from '@artificer-toolkit/source-data/srd/classes/index.js'
import { schoolOfEvocation } from '@artificer-toolkit/source-data/srd/classes/school-of-evocation.js'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { srdEquipment } from '@artificer-toolkit/source-data/srd/equipment/index.js'
import { human } from '@artificer-toolkit/source-data/srd/races/human.js'
import { srdRaces } from '@artificer-toolkit/source-data/srd/races/index.js'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'
import { fixture, input } from '../../tests/fixtures/characters'
import {
  countDatabaseIo,
  createDatabaseIoTotals,
  type DatabaseIoTotals
} from '../../tests/fixtures/databaseIo'
import { importedSubject, syncImportedDerived } from '../../tests/fixtures/publication'
import { api, internal } from '../_generated/api'
import { prepareCharacterBuilder } from './builderPreparation'
import { commitCharacter } from './commit'

// ADR 0036 S7 and D84: commit reads each referenced document once. Its database I/O (read plus
// write) budget is 450 KB for one Class and 200 KB more for each further distinct Class.
const SINGLE_CLASS_COMMIT_BUDGET_BYTES = 450 * 1024
/** D84: each further distinct Class adds 200 KB. */
const FURTHER_CLASS_COMMIT_BUDGET_BYTES = 200 * 1024

type Test = Awaited<ReturnType<typeof fixture>>['t']

function startingDecision(
  source: 'CLASS' | 'BACKGROUND',
  startingEquipment: NonNullable<typeof acolyte.startingEquipment>
) {
  return {
    source,
    tookGold: false,
    groups: startingEquipment.sets.flatMap((set) =>
      set.groups.map((group) => {
        const option = group.options[0]!
        return {
          groupId: group.id,
          optionId: option.id,
          selections: option.items.flatMap((item) => {
            if (!('selectionKind' in item) || item.selectionKind !== 'CHOSEN') return []
            const category = 'category' in item ? item.category : undefined
            const properties: readonly string[] =
              ('properties' in item ? item.properties : undefined) ?? []
            const equipmentId =
              ('equipmentIds' in item ? item.equipmentIds[0] : undefined) ??
              srdEquipment.find(
                (equipment) =>
                  equipment.category !== 'VARIANT' &&
                  (!category || equipment.category === category) &&
                  properties.every((property) =>
                    (equipment.properties ?? []).some((owned) => owned === property)
                  )
              )?.id
            if (!equipmentId) throw new Error(`No SRD Equipment for starting item ${item.id}.`)
            return [
              { selectionKey: item.id, equipmentId, quantity: 'count' in item ? item.count : 1 }
            ]
          })
        }
      })
    )
  }
}

function pickResolution(resolution: CharacterBuilderResolution) {
  const { readiness, validations, chosenGrantChoices, grants, registry } = resolution
  return {
    readiness,
    validations,
    chosenGrantChoices,
    grants: { features: grants.features },
    registry: {
      features: registry.features,
      classes: registry.classes,
      races: registry.races,
      backgrounds: registry.backgrounds,
      feats: registry.feats
    }
  }
}

/** The Builder resolution's plain parts; a transaction returns only Convex values. */
async function resolve(t: Test, character: CharacterAuthored) {
  const json = await t.run(async (ctx) => {
    const { resolution } = await prepareCharacterBuilder(ctx, {
      character: structuredClone(character),
      current: null,
      mode: 'create'
    })
    return JSON.stringify(pickResolution(resolution))
  })
  return JSON.parse(json) as ReturnType<typeof pickResolution>
}

/** Fills the Builder's outstanding choices from the resolution until the Character is ready. */
async function makeReady(t: Test, character: CharacterAuthored) {
  for (let pass = 0; pass < 8; pass += 1) {
    const resolution = await resolve(t, character)
    if (resolution.readiness.ready) return character
    const used = new Set<string>()
    character.intent.chosenGrantSelections = resolution.chosenGrantChoices.flatMap((choice) => {
      const kind = choice.proficiencyKind ?? choice.grantKind
      const targetIds = choice.options
        .filter((option) => !option.disabled && !used.has(`${kind}:${option.id}`))
        .slice(0, choice.requiredCount)
        .map((option) => option.id)
      for (const id of targetIds) used.add(`${kind}:${id}`)
      return [
        {
          id: crypto.randomUUID(),
          grantId: choice.grantId,
          source: choice.source,
          timing: choice.timing,
          ...(choice.progressionLevel === undefined
            ? {}
            : { progressionLevel: choice.progressionLevel }),
          targetIds
        }
      ]
    })
    const definitions = new Map<string, CompiledFeature>(
      [
        ...resolution.registry.features,
        ...[
          ...resolution.registry.classes,
          ...resolution.registry.races,
          ...resolution.registry.backgrounds,
          ...(resolution.registry.feats ?? [])
        ].flatMap((root) => root.features ?? [])
      ].map((feature) => [feature.id, feature])
    )
    const levelOf = (source: (typeof resolution.grants.features)[number]['source']) =>
      source.kind === 'CLASS'
        ? (character.intent.classes.find((row) => row.classId === source.classId)?.classLevel ?? 0)
        : source.kind === 'SUBCLASS'
          ? (character.intent.classes.find((row) => row.subclassId === source.subclassId)
              ?.classLevel ?? 0)
          : character.intent.classes.reduce((sum, row) => sum + row.classLevel, 0)
    for (const granted of resolution.grants.features) {
      const feature = definitions.get(granted.id)
      const count = (feature?.optionChoices ?? [])
        .filter((choice) => choice.level <= levelOf(granted.source))
        .reduce((sum, choice) => sum + choice.count, 0)
      if (!feature || count === 0) continue
      if (character.intent.featureAcquisitions.some((row) => row.featureId === feature.id)) continue
      character.intent.featureAcquisitions.push({
        id: crypto.randomUUID(),
        featureId: feature.id,
        source: granted.source,
        timing: { kind: 'IMMEDIATE' },
        selections: [
          {
            selectionKey: 'options',
            values: [
              {
                kind: 'IDS',
                ids: (feature.options ?? []).slice(0, count).map((option) => option.id)
              }
            ]
          }
        ]
      })
    }
    for (const row of character.intent.classes) {
      const spellcasting = resolution.registry.classes.find(
        (record) => record.id === row.classId
      )?.spellcasting
      const limit = spellcasting?.spellLimits
        .filter((entry) => entry.classLevel <= row.classLevel)
        .sort((left, right) => right.classLevel - left.classLevel)[0]
      if (!limit) continue
      const maxLevel = Math.max(0, ...limit.slots.map((slot) => slot.spellLevel))
      const classSpells = srdSpells.filter((spell) => spell.classIds?.includes(row.classId))
      character.intent.spellSelections = [
        {
          id: crypto.randomUUID(),
          source: { kind: 'CLASS', classId: row.classId, classLevel: row.classLevel },
          timing: { kind: 'IMMEDIATE' },
          spells: [
            ...classSpells
              .filter((spell) => spell.level === 0)
              .slice(0, limit.cantripsLimit ?? 0)
              .map((spell) => spell.id),
            ...classSpells
              .filter((spell) => spell.level > 0 && spell.level <= maxLevel)
              .slice(0, limit.learnedSpellsLimit ?? 0)
              .map((spell) => spell.id)
          ]
        }
      ]
    }
  }
  const resolution = await resolve(t, character)
  throw new Error(
    `Character is not ready: ${JSON.stringify([resolution.readiness, resolution.validations])}`
  )
}

async function importSubjects(t: Test, subjects: SourceImportSubjectDto[]) {
  for (let start = 0; start < subjects.length; start += 10)
    await t.mutation(internal.content.import.importSubjects, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: subjects.slice(start, start + 10)
    })
  await syncImportedDerived(t, subjects)
}

describe('commit read budget', () => {
  it('stays within 450 KB per level-5 Character plus 200 KB per further Class, reading no payload', async () => {
    const { t, owner } = await fixture()
    await importSubjects(t, [
      ...srdRaces.map((document) =>
        importedSubject({ subjectKind: 'RACE', ...document, document })
      ),
      ...srdClasses.map((document) =>
        importedSubject({ subjectKind: 'CLASS', ...document, document })
      ),
      importedSubject({ subjectKind: 'BACKGROUND', ...acolyte, document: acolyte }),
      ...srdEquipment.map((document) =>
        importedSubject({ subjectKind: 'EQUIPMENT', ...document, document })
      ),
      ...srdSpells.map((document) =>
        importedSubject({ subjectKind: 'SPELL', ...document, document })
      )
    ])

    const ready = []
    for (const [name, classes] of [
      ['martial', [{ baseClass: fighter, classLevel: 5, subclass: championMartialArchetype }]],
      ['caster', [{ baseClass: wizard, classLevel: 5, subclass: schoolOfEvocation }]],
      [
        'multiclass',
        [
          { baseClass: fighter, classLevel: 3, subclass: championMartialArchetype },
          { baseClass: wizard, classLevel: 2, subclass: schoolOfEvocation }
        ]
      ]
    ] as const) {
      const levels = classes.flatMap(({ baseClass, classLevel }) => {
        if (baseClass.category !== 'BASE') throw new Error('Expected a base Class.')
        const hitDie = Number(baseClass.hitpoint.dieConfig.replace(/\D/g, ''))
        return Array.from({ length: classLevel }, (_, index) => ({
          classId: baseClass.id,
          classLevel: index + 1,
          hitDie
        }))
      })
      const [first] = classes
      if (first.baseClass.category !== 'BASE') throw new Error('Expected a base Class.')
      const draft = await owner.caller.mutation(api.characters.drafts.create, input())
      // Validated Character DTOs bridge to the authored type as the Builder does.
      const character = characterAuthoredDtoSchema.parse({
        ...draft.payload.character,
        label: `Budget ${name}`,
        intent: {
          ...draft.payload.character.intent,
          race: { raceId: human.id },
          background: { backgroundId: acolyte.id },
          classes: classes.map(({ baseClass, classLevel, subclass }) => ({
            classId: baseClass.id,
            classLevel,
            subclassId: subclass.id
          })),
          abilities: {
            method: 'STANDARD_ARRAY',
            // Meets both multiclass prerequisites: Strength 13 for Fighter, Intelligence 13 for Wizard.
            assignments: [
              { ability: 'STRENGTH', option: '15' },
              { ability: 'DEXTERITY', option: '12' },
              { ability: 'CONSTITUTION', option: '14' },
              { ability: 'INTELLIGENCE', option: '13' },
              { ability: 'WISDOM', option: '10' },
              { ability: 'CHARISMA', option: '8' }
            ]
          },
          hitpoints: {
            method: 'FIXED',
            levels: levels.map(({ classId, classLevel, hitDie }, index) => ({
              level: index + 1,
              classId,
              classLevel,
              value: index === 0 ? hitDie : hitDie / 2 + 1
            }))
          },
          startingEquipment: {
            class: startingDecision('CLASS', first.baseClass.startingEquipment),
            background: startingDecision('BACKGROUND', acolyte.startingEquipment!)
          }
        }
      }) as CharacterAuthored
      ready.push({
        name,
        draftId: draft.id,
        character: await makeReady(t, character),
        budget:
          SINGLE_CLASS_COMMIT_BUDGET_BYTES + (classes.length - 1) * FURTHER_CLASS_COMMIT_BUDGET_BYTES
      })
    }

    // The root catalogue facts D163 added, by kind: what each root read now also carries.
    console.info(
      'D163 root catalogue fact bytes',
      await t.run(async (ctx) => {
        const growth: Record<string, { roots: number; bytes: number }> = {}
        for (const root of await ctx.db.query('authoredRoots').collect()) {
          const { publishedActive, race, class: classFacts, background, equipment } =
            root.catalogue ?? {}
          const entry = (growth[root.subjectKind] ??= { roots: 0, bytes: 0 })
          entry.roots += 1
          entry.bytes += JSON.stringify({
            publishedActive,
            race,
            class: classFacts,
            background,
            equipment
          }).length
        }
        return growth
      })
    )

    // D163: commit reads no authored payload. Every stored payload is now unreadable, so a commit
    // that loaded one would fail.
    await t.run(async (ctx) => {
      for (const chunk of await ctx.db.query('authoredVersionPayloadChunks').collect())
        await ctx.db.delete(chunk._id)
      for (const version of await ctx.db.query('authoredVersions').collect())
        await ctx.db.patch(version._id, {
          documentJson: '{}',
          documentChunkCount: undefined,
          documentByteLength: undefined
        })
    })
    const measured: Record<string, DatabaseIoTotals['reads'] & { kb: number }> = {}
    for (const { name, draftId, character, budget } of ready) {
      const totals = createDatabaseIoTotals()
      const result = await owner.caller.run((ctx) =>
        commitCharacter(
          { ...ctx, db: countDatabaseIo(ctx.db, totals) },
          { expectedDraftId: draftId, mode: 'create', character }
        )
      )
      expect(result.character.status).toBe('ACTIVE')
      const bytes = totals.reads.bytes + totals.writes.bytes
      measured[name] = { ...totals.reads, kb: Math.round(bytes / 102.4) / 10 }
      console.info('S7 commit reads', name, JSON.stringify(measured[name]))
      expect(bytes).toBeLessThanOrEqual(budget)
    }
    console.info('S7 commit reads', measured)
  }, 600_000)
})
