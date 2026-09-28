import { describe, expect, it } from 'vitest'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import type { SourceImportSubjectDto } from '@artificer-toolkit/schema/api/sourceImport'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
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
import { importedSubject } from '../../tests/fixtures/publication'
import { api, internal } from '../_generated/api'
import { prepareCharacterBuilder } from './builderPreparation'
import { commitCharacter } from './commit'

// ADR 0036 S7: commit reads only referenced content. The budget is 300 KB for a level-5 Character.
// Reads of a document this transaction wrote (the new Character row, read back by the stored-stat
// evaluation, the active-effect check and account usage) are reported apart from the budget.
const COMMIT_READ_BUDGET_BYTES = 300 * 1024

type Test = Awaited<ReturnType<typeof fixture>>['t']
type Totals = {
  documents: number
  bytes: number
  byTable: Record<string, { documents: number; distinct: number; bytes: number }>
  ownWrites: { documents: number; bytes: number }
}

/** Counts every document a transaction reads through `db`, at its JSON size, per table. */
function countReads<T extends object>(db: T, totals: Totals): T {
  const seen = new Set<string>()
  const written = new Set<string>()
  const count = (table: string, value: unknown) => {
    const documents = Array.isArray(value)
      ? value
      : value !== null && typeof value === 'object' && 'page' in value && Array.isArray(value.page)
        ? value.page
        : [value]
    for (const document of documents)
      if (document !== null && typeof document === 'object' && '_id' in document) {
        const bytes = JSON.stringify(document).length
        if (written.has(String(document._id))) {
          totals.ownWrites.documents += 1
          totals.ownWrites.bytes += bytes
          continue
        }
        const entry = (totals.byTable[table] ??= { documents: 0, distinct: 0, bytes: 0 })
        entry.documents += 1
        if (!seen.has(String(document._id))) entry.distinct += 1
        seen.add(String(document._id))
        entry.bytes += bytes
        totals.documents += 1
        totals.bytes += bytes
      }
  }
  const wrap = <U extends object>(target: U, table: string): U =>
    new Proxy(target, {
      get(object, property) {
        const value: unknown = Reflect.get(object, property)
        if (typeof value !== 'function') return value
        const method = value as (...args: unknown[]) => unknown
        if (property === Symbol.asyncIterator)
          return () => {
            const iterator = method.call(object) as AsyncIterator<unknown>
            return {
              next: async () => {
                const step = await iterator.next()
                if (!step.done) count(table, step.value)
                return step
              },
              [Symbol.asyncIterator]() {
                return this
              }
            }
          }
        return (...args: unknown[]) => {
          const result = method.apply(object, args)
          if (['patch', 'replace', 'delete'].includes(String(property)))
            written.add(String(args[0]))
          if (property === 'insert' && result instanceof Promise)
            return result.then((id: unknown) => {
              written.add(String(id))
              return id
            })
          const label = property === 'query' && typeof args[0] === 'string' ? args[0] : table
          if (result instanceof Promise)
            return result.then((resolved: unknown) => {
              count(label, resolved)
              return resolved
            })
          return result !== null && typeof result === 'object' ? wrap(result, label) : result
        }
      }
    })
  return wrap(db, 'get')
}

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
      mode: 'create',
      catalogScope: 'selectors'
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
    const definitions = new Map<string, FeatureAuthored>(
      [
        ...resolution.registry.features,
        ...[
          ...resolution.registry.classes,
          ...resolution.registry.races,
          ...resolution.registry.backgrounds,
          ...(resolution.registry.feats ?? [])
        ].flatMap((root) => (root.features ?? []) as FeatureAuthored[])
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
}

describe('commit read budget', () => {
  it('reads at most 300 KB for level-5 martial and caster Characters', async () => {
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

    const measured: Record<string, Totals & { kb: number }> = {}
    for (const [name, baseClass, subclass] of [
      ['martial', fighter, championMartialArchetype],
      ['caster', wizard, schoolOfEvocation]
    ] as const) {
      if (baseClass.category !== 'BASE') throw new Error('Expected a base Class.')
      const draft = await owner.caller.mutation(api.characters.drafts.create, input())
      const hitDie = Number(baseClass.hitpoint.dieConfig.replace(/\D/g, ''))
      // Validated Character DTOs bridge to the authored type as the Builder does.
      const character = characterAuthoredDtoSchema.parse({
        ...draft.payload.character,
        label: `Budget ${name}`,
        intent: {
          ...draft.payload.character.intent,
          race: { raceId: human.id },
          background: { backgroundId: acolyte.id },
          classes: [{ classId: baseClass.id, classLevel: 5, subclassId: subclass.id }],
          abilities: {
            method: 'STANDARD_ARRAY',
            assignments: [
              { ability: 'STRENGTH', option: '15' },
              { ability: 'DEXTERITY', option: '14' },
              { ability: 'CONSTITUTION', option: '13' },
              { ability: 'INTELLIGENCE', option: '12' },
              { ability: 'WISDOM', option: '10' },
              { ability: 'CHARISMA', option: '8' }
            ]
          },
          hitpoints: {
            method: 'FIXED',
            levels: [1, 2, 3, 4, 5].map((level) => ({
              level,
              classId: baseClass.id,
              classLevel: level,
              value: level === 1 ? hitDie : hitDie / 2 + 1
            }))
          },
          startingEquipment: {
            class: startingDecision('CLASS', baseClass.startingEquipment),
            background: startingDecision('BACKGROUND', acolyte.startingEquipment!)
          }
        }
      }) as CharacterAuthored
      const ready = await makeReady(t, character)
      const totals: Totals = {
        documents: 0,
        bytes: 0,
        byTable: {},
        ownWrites: { documents: 0, bytes: 0 }
      }
      const result = await owner.caller.run((ctx) =>
        commitCharacter(
          { ...ctx, db: countReads(ctx.db, totals) },
          { expectedDraftId: draft.id, mode: 'create', character: ready }
        )
      )
      expect(result.character.status).toBe('ACTIVE')
      measured[name] = { ...totals, kb: Math.round(totals.bytes / 102.4) / 10 }
      console.info('S7 commit reads', name, JSON.stringify(measured[name]))
      expect(totals.bytes).toBeLessThanOrEqual(COMMIT_READ_BUDGET_BYTES)
    }
    console.info('S7 commit reads', measured)
  }, 600_000)
})
