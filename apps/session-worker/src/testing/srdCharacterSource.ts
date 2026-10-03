import { v5 as uuidV5 } from 'uuid'
import { parsePublicationDocument } from '@artificer-toolkit/rules-runtime/authoredPublicationRead'
import { equipmentOptionFacts } from '@artificer-toolkit/rules-runtime/character/equipmentOptionFacts'
import {
  buildContentSnapshotKind,
  type ContentSnapshotListSource
} from '@artificer-toolkit/rules-runtime/contentSnapshots'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { resolveEquipmentAuthored } from '@artificer-toolkit/shared/subjects/compilers'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { elf } from '@artificer-toolkit/source-data/srd/races/elf.js'
import { human } from '@artificer-toolkit/source-data/srd/races/human.js'

// The captured Character's starting-equipment choice; the Background below offers exactly it.
const GROUP_ID = '3b74a8d0-eb08-47c9-b103-8d3ec46bd283'
const OPTION_ID = '319962bb-3446-4b1e-bc19-3f3d5e78a36d'

// The Elf's 60 ft Darkvision Feature, the one way the captured Character gains a Sense.
const darkvisionFeature = elf.features![1]!

/**
 * The SRD roots the captured Character was built from, shaped like the Convex Character fixtures:
 * no Features or proficiencies, a Fighter without starting equipment sets, and a Background whose
 * one choice grants two Clubs and 15 gp.
 */
const roots = (() => {
  if (fighter.category !== 'BASE') throw new Error('The SRD Fighter is a base Class.')
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
                          currencyId: fighter.startingGold.currencyId,
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
        ...structuredClone(fighter),
        features: [],
        proficiencies: [],
        startingEquipment: { ...fighter.startingEquipment, sets: [] }
      }
    },
    { subjectKind: 'BACKGROUND' as const, document: background },
    { subjectKind: 'EQUIPMENT' as const, document: club }
  ]
})()

/**
 * One SRD root as the Convex importer stores it and the snapshot build reads it back: the JSON
 * round trip, canonical checksum and name-based version identity are the production ones.
 */
function listSource({
  subjectKind,
  document: authored
}: (typeof roots)[number]): ContentSnapshotListSource {
  const document = JSON.parse(JSON.stringify(authored))
  const checksum = checksumRuleDocument(document)
  const publication = parsePublicationDocument(subjectKind, document)
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
  const identity = { publicId: publication.document.id, publicationVersion }
  if (publication.subjectKind !== 'EQUIPMENT') return { ...publication, ...identity }
  const { builder } = equipmentOptionFacts(
    publication.document,
    checksum,
    resolveEquipmentAuthored(club, () => undefined)
  )
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
 * `darkvision` gives the Race its Darkvision Feature.
 */
export function buildSrdSourceKinds(darkvision: boolean) {
  return (['RACE', 'CLASS', 'BACKGROUND', 'EQUIPMENT'] as const).map((kind) => {
    const header = {
      format: 2 as const,
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
        .map(listSource)
    )
    return { kind, header, built }
  })
}
