import { authoredEquipmentOptionFactsSchema } from '@artificer-toolkit/schema/api/authoredOptions'
import type { AuthoredPublicationDocument } from '@artificer-toolkit/schema/api/authoredPublication'
import {
  contentSnapshotDocumentsObjectSchema,
  contentSnapshotIndexObjectSchema,
  type ContentSnapshotObject,
  type ContentSnapshotScope
} from '@artificer-toolkit/schema/api/contentSnapshots'
import type { CharacterRestPreviewRequestDto } from '@artificer-toolkit/schema/api/characterSheetCommands'
import type { CharacterSheetCurrencyOptionDto } from '@artificer-toolkit/schema/api/characterSheetData'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { DEFAULT_CHARACTER_PARTY_VISIBILITY } from '@artificer-toolkit/schema/api/healthDisplay'
import {
  characterSheetStateSchema,
  type CharacterSheetState
} from '@artificer-toolkit/schema/projections/characterSheetState'
import {
  systemAuthoredDtoSchema,
  type SystemAuthoredDto
} from '@artificer-toolkit/schema/vocabulary/system'
import { createEmptyCharacterAuthored } from '@artificer-toolkit/shared/character'
import type { CharacterResourceUsage } from '@artificer-toolkit/shared/core'
import type {
  CharacterAuthored,
  EquipmentAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import { resolveEquipmentAuthored } from '@artificer-toolkit/shared/subjects/compilers'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { human } from '@artificer-toolkit/source-data/srd/races/human.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { parsePublicationDocument } from '../authoredPublicationRead.js'
import { toCharacterBuilderEquipmentCatalogRecord } from '../character/builderCatalog.js'
import { prepareCharacterBuilderFromContext } from '../character/builderPreparation.js'
import {
  prepareActiveCharacterBuilderContext,
  prepareCharacterRuleContext
} from '../character/contextPreparation.js'
import { resolveCharacterRecordStats } from '../character/characterRecordStats.js'
import { createSnapshotReaders } from '../character/snapshotReaders.js'
import { evaluateCharacterActiveGrantRules } from '../character/characterRuleEvaluation.js'
import { prepareCharacterSheetFromContext } from '../character/sheetPreparation.js'
import { projectCharacterSheetBundle } from '../character/sheetProjection.js'
import { buildCharacterRestPreview } from '../character/sheetRest.js'
import { buildContentSnapshotKind } from '../contentSnapshots.js'
import { storedCompilationOf } from './storedCompilations.js'

export const system = systemAuthoredDtoSchema.parse(srdSystemRecord)
export type PublicationKind = AuthoredPublicationDocument['subjectKind']

/** Index and documents objects of one scope, as the S2 build writes them. */
export function scopeObjects(
  documents: Partial<Record<PublicationKind, readonly unknown[]>>,
  scope: ContentSnapshotScope = 'SOURCE'
): ContentSnapshotObject[] {
  const scopeId = crypto.randomUUID()
  return Object.entries(documents).flatMap(([key, raw]) => {
    const kind = key as PublicationKind
    // Documents reach publication as JSON, so a fixture drops undefined fields as transport does.
    const published = (raw ?? []).map((document) =>
      parsePublicationDocument(kind, JSON.parse(JSON.stringify(document)))
    )
    const equipment = new Map(
      published.flatMap((entry) =>
        entry.subjectKind === 'EQUIPMENT' ? [[entry.document.id, entry.document] as const] : []
      )
    )
    const sources = published.map((entry) => {
      const document = entry.document
      const compilation = storedCompilationOf(entry, published)
      const listFacts = {
        publicId: document.id,
        magicSchoolLabel: 'School',
        compilation,
        publicationVersion: {
          identity: {
            subjectKind: entry.subjectKind,
            subjectId: document.id,
            systemId: document.systemId,
            contentSourceId: scopeId,
            versionId: document.id,
            checksum: compilation.authoredChecksum
          },
          version: 1,
          storedParentId:
            'parentRaceId' in document
              ? document.parentRaceId
              : 'parentClassId' in document
                ? document.parentClassId
                : 'parentEquipmentId' in document
                  ? document.parentEquipmentId
                  : null
        }
      }
      if (entry.subjectKind !== 'EQUIPMENT') return { ...entry, ...listFacts }
      // The stored projection the build reads: the effective facts along the variant chain.
      const effective = resolveEquipmentAuthored(
        entry.document as EquipmentAuthored,
        (id) => equipment.get(id) as EquipmentAuthored | undefined
      )
      const record = toCharacterBuilderEquipmentCatalogRecord(effective)
      const { builder } = authoredEquipmentOptionFactsSchema.parse({
        checksum: '0'.repeat(64),
        category: entry.document.category,
        properties: entry.document.properties ?? [],
        builder: {
          version: 1,
          parentEquipmentId:
            entry.document.category === 'VARIANT' ? entry.document.parentEquipmentId : null,
          category: record.category,
          properties: record.properties,
          isContainer: record.isContainer,
          ...(record.maxStack === undefined ? {} : { maxStack: record.maxStack }),
          requiresAttunement: record.requiresAttunement
        }
      })
      if (!builder) throw new Error('Expected Equipment builder facts.')
      return { ...entry, builder, ...listFacts }
    })
    const { index, documents: part } = buildContentSnapshotKind(
      { format: 3, scope, scopeId, kind },
      sources
    )
    return [
      contentSnapshotIndexObjectSchema.parse(JSON.parse(index.json)),
      contentSnapshotDocumentsObjectSchema.parse(JSON.parse(part.json))
    ]
  })
}

export function emptyCharacter(): CharacterAuthored {
  return createEmptyCharacterAuthored({
    id: crypto.randomUUID(),
    systemId: system.id,
    userId: crypto.randomUUID()
  })
}

if (fighter.category !== 'BASE') throw new Error('Expected the canonical parent Fighter class.')
const fighterClass = fighter

/**
 * A ready level 1 Human Fighter with a Short Rest Resource, over the SRD documents the Builder
 * needs. Features and starting equipment are stripped, and so are proficiencies unless
 * `languageChoice` keeps the Acolyte's two chosen languages, which the Character must then select.
 * `resourceLabel` names the Short Rest Resource.
 */
export function readyFighterFixture({
  languageChoice = false,
  resourceLabel = 'Short Resource'
} = {}) {
  const shortRestResource = {
    id: crypto.randomUUID(),
    label: resourceLabel,
    order: 0,
    availableAtLevel: 1,
    charges: {
      id: crypto.randomUUID(),
      resetKind: 'SHORT_REST' as const,
      limitKind: 'FIXED_AMOUNT' as const,
      scalingKind: 'NONE' as const,
      amount: 2
    }
  }
  const baseClass = {
    ...structuredClone(fighterClass),
    resources: shortRestResource,
    features: [],
    proficiencies: [],
    startingEquipment: { ...fighterClass.startingEquipment!, sets: [] }
  }
  const background = {
    ...acolyte,
    features: [],
    proficiencies: languageChoice ? acolyte.proficiencies : [],
    startingEquipment: { id: crypto.randomUUID(), sets: [] }
  }
  const empty = emptyCharacter()
  const character: CharacterAuthored = {
    ...empty,
    label: 'Aria',
    intent: {
      ...empty.intent,
      race: { raceId: human.id },
      background: { backgroundId: background.id },
      classes: [{ classId: baseClass.id, classLevel: 1 }],
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
        levels: [{ level: 1, classId: baseClass.id, classLevel: 1, value: 10 }]
      }
    }
  }
  return {
    character,
    shortRestResource,
    documents: {
      RACE: [{ ...human, features: [] }],
      CLASS: [baseClass],
      BACKGROUND: [background],
      EQUIPMENT: [club]
    } satisfies Partial<Record<PublicationKind, readonly unknown[]>>
  }
}

type FixtureDocuments = Partial<Record<PublicationKind, readonly unknown[]>>

/**
 * The Character's prepared rules context over in-memory content snapshot objects, with no
 * persistence: the same preparation the Convex and Worker paths run behind their readers.
 */
export async function prepareFixtureContext(
  character: CharacterAuthored,
  documents: FixtureDocuments,
  gameSystem: SystemAuthoredDto = system
) {
  const readers = createSnapshotReaders(scopeObjects(documents))
  const ruleContext = await prepareCharacterRuleContext(character, gameSystem, undefined, readers)
  return prepareActiveCharacterBuilderContext(character, ruleContext, async () => [])
}

/** The Builder's reconciled Character and resolution for `character` over the fixture documents. */
export async function prepareFixtureBuilder(input: {
  character: CharacterAuthored
  documents: FixtureDocuments
  current?: CharacterAuthored | null
}) {
  const current = input.current ?? null
  return prepareCharacterBuilderFromContext({
    character: input.character,
    current,
    mode: current ? 'edit' : 'create',
    context: await prepareFixtureContext(input.character, input.documents)
  })
}

/** The Sheet and rule evaluation of a ready `character` over the fixture documents. */
export async function prepareFixtureSheet(input: {
  character: CharacterAuthored
  documents: FixtureDocuments
  resourceUsage?: readonly Pick<CharacterResourceUsage, 'owner' | 'used'>[]
  streamVersion?: number
  adjustments?: CharacterSheetState['adjustments']
  movementDisplayPreference?: CharacterSheetState['movementDisplayPreference']
  gameSystem?: SystemAuthoredDto
  /** The Campaign's currency options, as a Campaign Sheet read adds them. */
  campaignCurrencyOptions?: readonly CharacterSheetCurrencyOptionDto[]
  /** The Character's active effects, as the Sheet reads them from its store. */
  activeEffects?: readonly ActiveRuleEffectRecord[]
}) {
  const { character } = input
  const context = await prepareFixtureContext(character, input.documents, input.gameSystem)
  const timestamp = new Date(0).toISOString()
  const sheetState = characterSheetStateSchema.parse({
    adjustments: input.adjustments ?? [],
    movementDisplayPreference: input.movementDisplayPreference ?? { mode: 'AUTO' },
    partyVisibility: DEFAULT_CHARACTER_PARTY_VISIBILITY,
    resourceUsage: (input.resourceUsage ?? []).map((usage) => ({
      id: crypto.randomUUID(),
      characterId: character.id,
      createdBy: character.userId,
      updatedBy: character.userId,
      createdAt: timestamp,
      updatedAt: timestamp,
      ...usage
    }))
  })
  const prepared = await prepareCharacterSheetFromContext({
    character,
    context,
    sheetState,
    campaignContext: {
      viewer: 'CHARACTER_OWNER',
      isCampaignOwner: false,
      campaignId: null,
      campaignStatus: null,
      contentMaturity: null,
      attunementSlotOverride: null,
      adjustments: [],
      secretAdjustmentIds: new Set(),
      conditions: []
    }
  })
  const { sheet, ruleProjection } = projectCharacterSheetBundle({
    character: prepared.prepared.character,
    resolution: prepared.prepared.resolution,
    streamVersion: input.streamVersion ?? 1,
    adjustments: prepared.adjustments,
    additionalCurrencyOptions: input.campaignCurrencyOptions,
    presentation: prepared.prepared.context.presentation,
    ruleEvaluation: evaluateCharacterActiveGrantRules({
      gameSystemId: prepared.prepared.character.systemId,
      evaluation: prepared.ruleEvaluation,
      activeEffects: input.activeEffects ?? [],
      vocabularySnapshot: prepared.prepared.context.vocabularySnapshot
    }),
    activeEffects: input.activeEffects ?? [],
    concentration: null
  })
  return { ...prepared, sheet, ruleProjection, sheetState }
}

/** The inputs the rest functions take, from a Sheet prepared by `prepareFixtureSheet`. */
export function restParamsFromFixtureSheet(
  prepared: Awaited<ReturnType<typeof prepareFixtureSheet>>
) {
  return {
    character: prepared.prepared.character,
    resolution: prepared.prepared.resolution,
    sheet: prepared.sheet,
    restPolicy: prepared.ruleEvaluation.output.rest,
    effectiveMaximum: resolveCharacterRecordStats(prepared.ruleEvaluation).maximumHitPoints
  }
}

/** The rest preview the Convex `characters/rest:preview` query builds for a prepared fixture Sheet. */
export function previewFixtureRest(
  prepared: Awaited<ReturnType<typeof prepareFixtureSheet>>,
  input: CharacterRestPreviewRequestDto
) {
  return buildCharacterRestPreview({ ...restParamsFromFixtureSheet(prepared), input })
}
