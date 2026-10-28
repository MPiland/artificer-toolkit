import {
  contentSnapshotIndexObjectSchema,
  type ContentSnapshotIndexObject,
  type ContentSnapshotObject
} from '@artificer-toolkit/schema/api/contentSnapshots'
import type {
  CharacterAuthored,
  EquipmentAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import {
  compileSpell,
  resolveEquipmentAuthored
} from '@artificer-toolkit/shared/subjects/compilers'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { championMartialArchetype } from '@artificer-toolkit/source-data/srd/classes/champion.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { srdClasses } from '@artificer-toolkit/source-data/srd/classes/index.js'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { backpack } from '@artificer-toolkit/source-data/srd/equipment/backpack.js'
import { clubPlus1 } from '@artificer-toolkit/source-data/srd/equipment/club-plus-1.js'
import { srdEquipment } from '@artificer-toolkit/source-data/srd/equipment/index.js'
import { grappler } from '@artificer-toolkit/source-data/srd/feats/grappler.js'
import { human } from '@artificer-toolkit/source-data/srd/races/human.js'
import { srdRaces } from '@artificer-toolkit/source-data/srd/races/index.js'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'
import { fireBolt } from '@artificer-toolkit/source-data/srd/spells/fire-bolt.js'
import { magicMissile } from '@artificer-toolkit/source-data/srd/spells/magic-missile.js'
import { describe, expect, it, vi } from 'vitest'

import { parsePublicationDocument } from '../authoredPublicationRead.js'
import { createCharacterBuilderCatalog } from '../character/builderCatalog.js'
import { createCharacterBuilderChangePreview } from '../character/builderPresentation.js'
import { prepareCharacterBuilderFromContext } from '../character/builderPreparation.js'
import { toCharacterBuilderPayload } from '../character/characterBuilderView.js'
import { evaluateCharacterRules } from '../character/characterRuleEvaluation.js'
import { getSheetSpellIdsByClass } from '../character/sheetSpellIds.js'
import {
  assembleCharacterBuilderContext,
  prepareCharacterRuleContext,
  requireCharacterPresentation
} from '../character/contextPreparation.js'
import { createLazySnapshotReaders, createSnapshotReaders } from '../character/snapshotReaders.js'
import { toContentSnapshotIndexEntry } from '../contentSnapshots.js'
import {
  emptyCharacter,
  scopeObjects,
  system,
  type PublicationKind as Kind
} from '../testing/characterContextFixtures.js'
import { pinnedRetainedRulesJson } from '../testing/pinnedRetainedRules.js'

// ADR 0036 S9: the Builder's picker pools come only from content snapshots, so the catalogue
// rules the server once asserted over Convex reads are asserted here over snapshot objects.

async function selectorsCatalogue(objects: readonly ContentSnapshotObject[]) {
  const character = emptyCharacter()
  const readers = createSnapshotReaders(objects)
  const context = await assembleCharacterBuilderContext(
    character,
    await prepareCharacterRuleContext(character, system, undefined, readers),
    { scope: 'selectors', readers }
  )
  return context.catalog
}

describe('Builder catalogue from content snapshots', () => {
  it('keeps the complete Spell picker and readiness while hydrating only selected mechanics', async () => {
    const objects = scopeObjects({ CLASS: [wizard], SPELL: [fireBolt, magicMissile] })
    const indexes = objects.filter(
      (object): object is ContentSnapshotIndexObject => object.part === 'index'
    )
    const loadDocuments = vi.fn(async (kinds: readonly Kind[]) =>
      objects.filter((object) => object.part === 'documents' && kinds.includes(object.kind))
    )
    const readers = createLazySnapshotReaders(indexes, loadDocuments)
    const character = emptyCharacter()
    character.intent.classes = [{ classId: wizard.id, classLevel: 1 }]
    const unselected = await prepareCharacterRuleContext(character, system, undefined, readers)
    expect(unselected.catalog.spells.map((spell) => spell.id)).toEqual([
      fireBolt.id,
      magicMissile.id
    ])
    expect(unselected.spellsById.size).toBe(0)
    expect(loadDocuments.mock.calls.some(([kinds]) => kinds.includes('SPELL'))).toBe(false)

    character.intent.spellSelections = [
      {
        id: crypto.randomUUID(),
        source: { kind: 'CLASS', classId: wizard.id },
        timing: { kind: 'CLASS_LEVEL', classId: wizard.id, classLevel: 1 },
        spells: [fireBolt.id]
      }
    ]
    const selected = await prepareCharacterRuleContext(character, system, undefined, readers)
    expect([...selected.currentSpellsById.keys()]).toEqual([fireBolt.id])
    expect(selected.spellsById.has(magicMissile.id)).toBe(false)
    const fullSpells = new Map(
      [fireBolt, magicMissile].map((spell) => [spell.id, compileSpell(spell)])
    )
    const prepared = await Promise.all(
      [selected, { ...selected, spellsById: fullSpells }].map(async (ruleContext) =>
        prepareCharacterBuilderFromContext({
          character,
          current: null,
          mode: 'create',
          context: await assembleCharacterBuilderContext(character, ruleContext, {
            scope: 'selectors',
            readers
          })
        })
      )
    )
    expect(prepared[0]!.resolution).toEqual(prepared[1]!.resolution)
    expect(prepared[0]!.character).toEqual(prepared[1]!.character)
    expect(prepared[0]!.context.catalog.spells.map((spell) => spell.id)).toEqual([
      fireBolt.id,
      magicMissile.id
    ])
    const evaluationInput = {
      character: prepared[0]!.character,
      context: prepared[0]!.context,
      spellsById: selected.spellsById
    }
    const evaluation = evaluateCharacterRules(evaluationInput)
    expect(getSheetSpellIdsByClass(evaluation.output, evaluation.facts).get(wizard.id)).toContain(
      magicMissile.id
    )
    expect(
      evaluation.facts.spellActionFacts.some((spell) => spell.spellId === magicMissile.id)
    ).toBe(false)
    const inspected = evaluateCharacterRules({
      ...evaluationInput,
      spellsById: fullSpells,
      referenceSpellIds: [magicMissile.id]
    })
    expect(
      inspected.facts.spellActionFacts.some((spell) => spell.spellId === magicMissile.id)
    ).toBe(true)
    const readSpellCatalogue = vi.fn(readers.readSpellCatalogue)
    const reused = await prepareCharacterRuleContext(character, system, selected, {
      ...readers,
      readSpellCatalogue
    })
    expect(reused.spellCatalogueEntries).toBe(selected.spellCatalogueEntries)
    expect(reused.currentSpellsById).toEqual(selected.currentSpellsById)
    expect(readSpellCatalogue).not.toHaveBeenCalled()

    character.intent.spellSelections[0]!.spells.push(magicMissile.id)
    const extended = await prepareCharacterRuleContext(character, system, selected, {
      ...readers,
      readSpellCatalogue
    })
    expect(readSpellCatalogue).toHaveBeenCalledExactlyOnceWith(
      new Set([fireBolt.id, magicMissile.id]),
      expect.objectContaining({ classIds: [wizard.id] })
    )
    expect([...extended.currentSpellsById.keys()]).toEqual([fireBolt.id, magicMissile.id])
    expect(extended.catalog.spells).toEqual(selected.catalog.spells)
  })

  it('keeps retained inaccessible Equipment spells in mechanics without restoring picker access', async () => {
    const equipment: EquipmentAuthored = {
      ...backpack,
      features: [
        {
          id: crypto.randomUUID(),
          label: 'Retained cantrip',
          description: 'The acquired item grants Fire Bolt.',
          order: 0,
          grants: {
            spells: [
              {
                id: crypto.randomUUID(),
                grantKind: 'SPELL_GRANT',
                selectionKind: 'GRANTED',
                scalingKind: 'NONE',
                authoringModeKind: 'SELECTED',
                spellIds: [fireBolt.id],
                attributes: ['KNOWN', 'CAST_AT_WILL'],
                castingAbility: 'INTELLIGENCE',
                order: 0
              }
            ]
          }
        }
      ]
    }
    const character = emptyCharacter()
    character.state.equipment.inventory.push({
      id: crypto.randomUUID(),
      equipmentId: equipment.id,
      quantity: 1,
      retainedRulesJson: pinnedRetainedRulesJson({
        systemId: system.id,
        equipment,
        spells: [fireBolt]
      })
    })
    const readers = createSnapshotReaders(scopeObjects({ SPELL: [magicMissile] }))
    const context = await prepareCharacterRuleContext(character, system, undefined, readers)
    expect(context.spellsById.get(fireBolt.id)?.label).toBe(fireBolt.label)
    expect(context.currentSpellsById.has(fireBolt.id)).toBe(false)
    const builder = await assembleCharacterBuilderContext(character, context, {
      scope: 'selectors',
      readers
    })
    expect(builder.catalog.spells.map((spell) => spell.id)).toEqual([magicMissile.id])
  })

  it.each(['valid', 'missing parent', 'non-base parent'] as const)(
    'validates Class catalogue parents from the complete pool: %s',
    async (scenario) => {
      const base = { ...fighter, label: 'Z base Class' }
      const child = {
        ...championMartialArchetype,
        label: 'A subclass',
        parentClassId: scenario === 'non-base parent' ? championMartialArchetype.id : base.id
      }
      const catalogue = selectorsCatalogue(
        scopeObjects({ CLASS: scenario === 'missing parent' ? [child] : [base, child] })
      )
      if (scenario !== 'valid') {
        await expect(catalogue).rejects.toThrow(
          'A readable base class in the same System is required.'
        )
        return
      }
      expect((await catalogue).classes).toEqual(
        createCharacterBuilderCatalog({
          system,
          races: [],
          classes: [child, base].map((document) =>
            toContentSnapshotIndexEntry(parsePublicationDocument('CLASS', document))
          ),
          backgrounds: [],
          equipment: [],
          feats: [],
          spells: []
        }).classes
      )
    }
  )

  it('resolves variant Equipment from projected facts exactly as from its documents', async () => {
    const base = { ...backpack, label: 'Z parent', maxStack: 5 }
    const child = {
      ...clubPlus1,
      label: 'A child',
      parentEquipmentId: base.id,
      requiresAttunement: true
    }
    const grandchild = {
      ...clubPlus1,
      id: crypto.randomUUID(),
      label: 'A grandchild',
      parentEquipmentId: child.id
    }
    const documents = [base, child, grandchild]
    const catalogue = await selectorsCatalogue(scopeObjects({ EQUIPMENT: documents }))
    expect(catalogue.equipment).toEqual(
      createCharacterBuilderCatalog({
        system,
        races: [],
        classes: [],
        backgrounds: [],
        equipment: [...documents]
          .sort((left, right) => left.label.localeCompare(right.label))
          .map((document) =>
            resolveEquipmentAuthored(document, (id) => documents.find((parent) => parent.id === id))
          ),
        feats: [],
        spells: []
      }).equipment
    )
    expect(catalogue.equipment.find((row) => row.id === grandchild.id)).toMatchObject({
      category: 'ADVENTURING_GEAR',
      isContainer: true,
      maxStack: 5,
      requiresAttunement: true,
      properties: ['CONTAINER', 'MAGIC']
    })
  })

  it.each([
    ['missing parent', 'Readable parent Equipment in the same System is required.'],
    ['cycle', 'Equipment variant cycle detected.']
  ] as const)('rejects Equipment inheritance with a %s', async (failure, message) => {
    const child = { ...clubPlus1, parentEquipmentId: backpack.id }
    const objects = scopeObjects({ EQUIPMENT: [backpack, child] }).map((object) =>
      object.kind === 'EQUIPMENT' && object.part === 'index'
        ? contentSnapshotIndexObjectSchema.parse({
            ...object,
            roots:
              failure === 'missing parent'
                ? object.roots.filter((root) => root.id !== backpack.id)
                : object.roots.map((root) =>
                    root.id === child.id ? { ...root, parentEquipmentId: child.id } : root
                  )
          })
        : object
    )
    await expect(selectorsCatalogue(objects)).rejects.toThrow(message)
  })

  it('merges Feats across Source and Campaign scopes, a Source root shadowing its share', async () => {
    const direct = { ...grappler, id: crypto.randomUUID(), label: 'Direct Feat' }
    const shared = { ...grappler, id: crypto.randomUUID(), label: 'Shared Feat' }
    const catalogue = await selectorsCatalogue([
      ...scopeObjects({ FEAT: [{ ...direct, label: 'Stale share' }, shared] }, 'CAMPAIGN'),
      ...scopeObjects({ FEAT: [direct] })
    ])
    expect(catalogue.feats).toEqual([
      { id: direct.id, label: 'Direct Feat' },
      { id: shared.id, label: 'Shared Feat' }
    ])
  })

  it('keeps the resolution scope exact while reading fewer pools', async () => {
    if (fighter.category !== 'BASE' || fighter.subclassSelectionLevel === undefined)
      throw new Error('Expected the canonical Fighter subclass selection level.')
    const readers = createSnapshotReaders(
      scopeObjects({
        RACE: srdRaces,
        CLASS: srdClasses,
        BACKGROUND: [acolyte],
        EQUIPMENT: srdEquipment,
        SPELL: srdSpells
      })
    )
    const empty = emptyCharacter()
    const withIntent = (intent: Partial<CharacterAuthored['intent']>): CharacterAuthored => ({
      ...empty,
      intent: { ...empty.intent, ...intent }
    })
    const selectedFighter = withIntent({
      race: { raceId: human.id },
      background: { backgroundId: acolyte.id },
      classes: [{ classId: fighter.id, classLevel: 1 }]
    })
    const cases: Array<{
      name: string
      character: CharacterAuthored
      current: CharacterAuthored | null
    }> = [
      { name: 'empty draft', character: empty, current: null },
      { name: 'selected race/background/Fighter1', character: selectedFighter, current: null },
      {
        name: 'missing race',
        character: withIntent({ ...selectedFighter.intent, race: { raceId: '' } }),
        current: null
      },
      {
        name: 'subclass selection plus Wizard1',
        character: withIntent({
          ...selectedFighter.intent,
          classes: [
            { classId: fighter.id, classLevel: fighter.subclassSelectionLevel },
            { classId: wizard.id, classLevel: 1 }
          ]
        }),
        current: null
      },
      {
        name: 'unavailable selected race UUID',
        character: withIntent({ ...selectedFighter.intent, race: { raceId: crypto.randomUUID() } }),
        current: null
      },
      {
        name: 'edit to incomplete selection',
        character: withIntent({ ...selectedFighter.intent, classes: [] }),
        current: selectedFighter
      }
    ]
    for (const testCase of cases) {
      const mode = testCase.current ? ('edit' as const) : ('create' as const)
      const candidate = {
        ...testCase.character,
        state: testCase.current?.state ?? testCase.character.state
      }
      const ruleContext = requireCharacterPresentation(
        await prepareCharacterRuleContext(candidate, system, undefined, readers)
      )
      const [selectors, resolution] = await Promise.all(
        (['selectors', 'resolution'] as const).map(async (scope) => {
          const context = await assembleCharacterBuilderContext(candidate, ruleContext, {
            scope,
            readers
          })
          const prepared = await prepareCharacterBuilderFromContext({
            character: testCase.character,
            current: testCase.current,
            mode,
            context
          })
          const predictedStatus = prepared.resolution.readiness.ready ? 'ACTIVE' : 'DRAFT'
          const { catalog: _catalog, ...rest } = prepared.resolution
          return {
            character: prepared.character,
            resolution: rest,
            view: toCharacterBuilderPayload(
              prepared.character,
              prepared.resolution,
              prepared.context.presentation
            ).resolution,
            preview: createCharacterBuilderChangePreview({
              previousCharacter: testCase.current ?? prepared.candidate,
              nextCharacter: prepared.character,
              predictedStatus,
              context: prepared.context
            })
          }
        })
      )
      expect(resolution, testCase.name).toEqual(selectors)
      if (testCase.name === 'subclass selection plus Wizard1')
        expect(
          resolution!.resolution.outstandingChoices.some(
            (choice) => choice.code === 'SUBCLASS_SELECTION_REQUIRED'
          )
        ).toBe(true)
    }
    // Twelve full Builder assemblies over the whole SRD exceed the 5 s default under load.
  }, 30_000)
})
