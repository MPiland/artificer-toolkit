import { v5 as uuidV5 } from 'uuid'
import { compilePublicationDocument } from '@artificer-toolkit/rules-runtime/authoredPublicationCompile'
import { parsePublicationDocument } from '@artificer-toolkit/rules-runtime/authoredPublicationRead'
import { equipmentOptionFacts } from '@artificer-toolkit/rules-runtime/character/equipmentOptionFacts'
import {
  buildContentSnapshotKind,
  type ContentSnapshotListSource
} from '@artificer-toolkit/rules-runtime/contentSnapshots'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type {
  ClassAuthored,
  CreatureAuthored,
  EquipmentAuthored,
  SpellAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import { resolveEquipmentAuthored } from '@artificer-toolkit/shared/subjects/compilers'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { elf } from '@artificer-toolkit/source-data/srd/races/elf.js'
import { human } from '@artificer-toolkit/source-data/srd/races/human.js'
import { srdSpells } from '@artificer-toolkit/source-data/srd/spells/index.js'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'

// The captured Character's starting-equipment choice; the Background below offers exactly it.
const GROUP_ID = '3b74a8d0-eb08-47c9-b103-8d3ec46bd283'
const OPTION_ID = '319962bb-3446-4b1e-bc19-3f3d5e78a36d'

// A Class the Character never takes, so a Resource maximum scaled by its level cannot be evaluated.
const UNHELD_CLASS_ID = '00000000-0000-4000-8000-0000000000b1'

/** `true` keeps the SRD fixed one-use charge; `'UNRESOLVED_MAXIMUM'` bases it on the unheld Class's level. */
type SecondWind = boolean | 'UNRESOLVED_MAXIMUM'

/** Spells the captured Character's Class casts from, published with the Wizard's spellcasting rules. */
export type ClassSpells = readonly SpellAuthored[]

/** A Feature the SRD Fighter can carry. */
export type ClassFeature = NonNullable<typeof fighter.features>[number]

// The Elf's 60 ft Darkvision Feature, the one way the captured Character gains a Sense.
const darkvisionFeature = elf.features![1]!

/** The SRD spells a subclass grants, which its Character's source must publish to evaluate them. */
function subclassSpells(subclass: ClassAuthored | undefined): readonly SpellAuthored[] {
  const ids = new Set(
    (subclass?.features ?? []).flatMap((feature) =>
      (feature.grants?.spells ?? []).flatMap((grant) =>
        ('progression' in grant ? grant.progression.levels : []).flatMap((level) =>
          'spellIds' in level ? level.spellIds : []
        )
      )
    )
  )
  return srdSpells.filter((spell) => ids.has(spell.id))
}

/**
 * The SRD roots the captured Character was built from, shaped like the Convex Character fixtures:
 * no Features or proficiencies, a Class (the Fighter by default) without starting equipment sets or
 * spellcasting of its own, and a Background whose one choice grants two Clubs and 15 gp.
 */
function buildRoots(
  characterClass: ClassAuthored,
  secondWind: SecondWind,
  extraClassFeatures: readonly ClassFeature[],
  extraEquipment: readonly EquipmentAuthored[],
  spells: ClassSpells | undefined,
  creatures: readonly CreatureAuthored[] | undefined,
  characterSubclass: ClassAuthored | undefined
) {
  if (characterClass.category !== 'BASE') throw new Error('The Character’s Class is a base Class.')
  const { spellcasting: _ownSpellcasting, ...classRoot } = structuredClone(characterClass)
  const background = {
    ...acolyte,
    features: [],
    proficiencies: [],
    startingEquipment: {
      id: '00000000-0000-4000-8000-0000000000a1',
      sets: [
        {
          id: '00000000-0000-4000-8000-0000000000a2',
          order: 0,
          groups: [
            {
              id: GROUP_ID,
              order: 0,
              options: [
                {
                  id: OPTION_ID,
                  order: 0,
                  items: [
                    {
                      id: '00000000-0000-4000-8000-0000000000a3',
                      order: 0,
                      startingEquipmentKind: 'EQUIPMENT' as const,
                      selectionKind: 'GRANTED' as const,
                      authoringModeKind: 'SELECTED' as const,
                      equipmentIds: [club.id],
                      quantity: 2
                    },
                    {
                      id: '00000000-0000-4000-8000-0000000000a4',
                      order: 1,
                      startingEquipmentKind: 'CURRENCY' as const,
                      currencies: [
                        {
                          currencyId: classRoot.startingGold.currencyId,
                          amount: 15
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  }
  return [
    {
      subjectKind: 'RACE' as const,
      document: { ...human, features: [] as (typeof darkvisionFeature)[] }
    },
    {
      subjectKind: 'CLASS' as const,
      document: {
        ...classRoot,
        features: [
          ...(secondWind
            ? (classRoot.features ?? [])
                .filter(({ label }) => label === 'Second Wind')
                .map((feature) =>
                  secondWind === 'UNRESOLVED_MAXIMUM' && feature.charges
                    ? {
                        ...feature,
                        charges: {
                          id: feature.charges.id,
                          resetKind: 'SHORT_REST' as const,
                          limitKind: 'CLASS_LEVEL' as const,
                          scalingKind: 'NONE' as const,
                          classId: UNHELD_CLASS_ID
                        }
                      }
                    : feature
                )
            : []),
          ...extraClassFeatures
        ],
        proficiencies: [],
        startingEquipment: { ...classRoot.startingEquipment, sets: [] },
        ...(spells && {
          spellcasting: {
            ...wizard.spellcasting!,
            spellLimits: [
              {
                classLevel: 1,
                // One slot of each level up to the highest the spells need, at least 5th.
                slots: Array.from(
                  { length: Math.max(5, ...spells.map(({ level }) => level)) },
                  (_, index) => ({ spellLevel: index + 1, slotCount: index === 0 ? 2 : 1 })
                ),
                cantripsLimit: 0
              }
            ]
          }
        })
      }
    },
    ...(characterSubclass
      ? [{ subjectKind: 'CLASS' as const, document: structuredClone(characterSubclass) }]
      : []),
    { subjectKind: 'BACKGROUND' as const, document: background },
    ...[club, ...extraEquipment].map((document) => ({
      subjectKind: 'EQUIPMENT' as const,
      document
    })),
    ...subclassSpells(characterSubclass).map((document) => ({
      subjectKind: 'SPELL' as const,
      document
    })),
    ...(spells ?? []).map((spell) => ({
      subjectKind: 'SPELL' as const,
      document: { ...spell, classIds: [...(spell.classIds ?? []), classRoot.id] }
    })),
    ...(creatures ?? []).map((document) => ({ subjectKind: 'CREATURE' as const, document }))
  ]
}

/**
 * One SRD root as the Convex importer stores it and the snapshot build reads it back: the JSON
 * round trip, canonical checksum and name-based version identity are the production ones. An
 * Equipment variant compiles against its parents among the published Equipment, as publication does.
 */
function listSource(
  root: ReturnType<typeof buildRoots>[number],
  parentOf: (equipmentId: string) => EquipmentAuthored | undefined
): ContentSnapshotListSource {
  const { subjectKind, document: authored } = root
  const document = JSON.parse(JSON.stringify(authored))
  const publication = parsePublicationDocument(subjectKind, document)
  // Publication checksums the parsed document, so the pin and its compilation agree.
  const checksum = checksumRuleDocument(publication.document)
  const publicationVersion = {
    identity: {
      subjectKind,
      subjectId: publication.document.id,
      systemId: publication.document.systemId,
      contentSourceId: SRD_CONTENT_SOURCE.id,
      versionId: uuidV5(
        canonicalizeRuleDocument({
          id: publication.document.id,
          kind: subjectKind,
          checksum
        }),
        uuidV5.URL
      ),
      checksum
    },
    version: 1
  }
  const effective =
    root.subjectKind === 'EQUIPMENT' ? resolveEquipmentAuthored(root.document, parentOf) : undefined
  const identity = {
    publicId: publication.document.id,
    publicationVersion,
    compilation: compilePublicationDocument(publication, effective)
  }
  if (publication.subjectKind === 'SPELL') {
    const school = srdSystemRecord.magicSchools.find(
      ({ id }) => id === publication.document.magicSchoolId
    )
    if (!school) throw new Error('The Spell Magic School is not in the SRD System.')
    return { ...publication, ...identity, magicSchoolLabel: school.label }
  }
  if (publication.subjectKind !== 'EQUIPMENT') return { ...publication, ...identity }
  const { builder } = equipmentOptionFacts(publication.document, checksum, effective)
  if (!builder) throw new Error('The Equipment option facts have no Builder projection.')
  return {
    subjectKind: 'EQUIPMENT',
    document: publication.document,
    builder,
    ...identity
  }
}

/**
 * The SRD source's snapshot builds, one per kind, as the content snapshot build writes them.
 * `darkvision` gives the Race its Darkvision Feature; `secondWind` gives the Fighter its Second Wind Feature, the Resource pool the stripped Class otherwise lacks; `classFeatures` are further Features the Fighter carries; `spells` make the Fighter a spellcaster
 * (with the Wizard's spellcasting rules) whose Class spell list they join, and add the SPELL kind;
 * `creatures` add the CREATURE kind; `characterClass` is the SRD Class standing in for the Fighter.
 */
export function buildSrdSourceKinds(
  darkvision: boolean,
  secondWind: SecondWind = false,
  classFeatures: readonly ClassFeature[] = [],
  equipment: readonly EquipmentAuthored[] = [],
  spells?: ClassSpells,
  creatures?: readonly CreatureAuthored[],
  characterClass: ClassAuthored = fighter,
  characterSubclass?: ClassAuthored
) {
  const kinds = [
    'RACE',
    'CLASS',
    'BACKGROUND',
    'EQUIPMENT',
    ...(spells || subclassSpells(characterSubclass).length > 0 ? ['SPELL' as const] : []),
    ...(creatures ? ['CREATURE' as const] : [])
  ] as const
  const roots = buildRoots(
    characterClass,
    secondWind,
    classFeatures,
    equipment,
    spells,
    creatures,
    characterSubclass
  )
  const publishedEquipment = roots.flatMap((root) =>
    root.subjectKind === 'EQUIPMENT' ? [root.document] : []
  )
  const parentOf = (equipmentId: string) =>
    publishedEquipment.find((document) => document.id === equipmentId)
  return kinds.map((kind) => {
    const header = {
      format: 3 as const,
      scope: 'SOURCE' as const,
      scopeId: SRD_CONTENT_SOURCE.id,
      kind
    }
    const built = buildContentSnapshotKind(
      header,
      roots
        .filter((root) => root.subjectKind === kind)
        .map((root) =>
          darkvision && root.subjectKind === 'RACE'
            ? {
                ...root,
                document: { ...root.document, features: [darkvisionFeature] }
              }
            : root
        )
        .map((root) => listSource(root, parentOf))
    )
    return { kind, header, built }
  })
}
