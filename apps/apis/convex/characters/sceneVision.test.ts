import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CharacterMechanicsReadInput,
  CharacterSceneVisionResult
} from '@artificer-toolkit/schema/api/characterMechanicsRead'
import {
  senseReusableDefinitionDocumentDtoSchema,
  type SenseReusableDefinitionDocumentDto
} from '@artificer-toolkit/schema/shared/combatPerception'
import type {
  CharacterBuilderCommitOutput,
  CharacterBuilderResolveInput
} from '@artificer-toolkit/schema/api/characterBuilderQueries'
import type {
  SourceImportBatchResultDto,
  SourceImportDefinitionsInput
} from '@artificer-toolkit/schema/api/sourceImport'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_SENSE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/senses.js'
import { tiefling } from '@artificer-toolkit/source-data/srd/races/tiefling.js'
import { SRD_SYSTEM_ID, SRD_USER_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const commit = makeFunctionReference<
  'mutation',
  CharacterBuilderResolveInput,
  CharacterBuilderCommitOutput
>('characters/commit:commit')
const importDefinitions = makeFunctionReference<
  'mutation',
  SourceImportDefinitionsInput,
  SourceImportBatchResultDto
>('content/import:importDefinitions')
const readSceneVision = makeFunctionReference<
  'query',
  CharacterMechanicsReadInput,
  CharacterSceneVisionResult
>('characters/sceneVision:read')

async function setup() {
  const darkvisionFeature = tiefling.features?.find((feature) => feature.label === 'Darkvision')
  if (!darkvisionFeature) throw new Error('Tiefling Darkvision feature is required.')
  const base = await readyCharacterFixture({ features: [darkvisionFeature] })
  await base.t.mutation(importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: SRD_SENSE_DEFINITIONS.map((definition) => ({
      ...definition,
      definitionFamilyKey: 'sense'
    }))
  })
  const { draft, character } = await base.createCharacter()
  const committed = await base.owner.caller.mutation(commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
  const campaign = await base.other.caller.mutation(createCampaign, {
    name: 'Scene vision campaign',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: SRD_SYSTEM_ID,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  await base.t.run(async (ctx) => {
    await ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.owner.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
    await ctx.db.insert('campaignCharacterAssignments', {
      campaignId: campaign.id,
      userId: base.owner.userId,
      characterId: character.id,
      assignedAt: campaign.createdAt
    })
  })
  const input: CharacterMechanicsReadInput = {
    campaignId: campaign.id,
    characterId: character.id,
    systemId: character.systemId,
    streamVersion: committed.streamVersion
  }
  return { ...base, campaign, character, input }
}

async function patchSense(
  base: Awaited<ReturnType<typeof setup>>,
  patch: (document: SenseReusableDefinitionDocumentDto) => SenseReusableDefinitionDocumentDto
) {
  await base.t.run(async (ctx) => {
    const root = await ctx.db
      .query('reusableDefinitions')
      .withIndex('by_publicId', (q) => q.eq('id', SRD_SENSE_DEFINITIONS[0]!.id))
      .unique()
    if (!root || !root.document || !root.checksum) throw new Error('Missing imported Sense.')
    const document = patch(senseReusableDefinitionDocumentDtoSchema.parse(root.document))
    await ctx.db.patch(root._id, {
      document,
      checksum: checksumRuleDocument(document),
      version: root.version + 1,
      contractVersion: root.contractVersion ?? 1,
      publishedAt: root.publishedAt ?? new Date(root._creationTime).toISOString(),
      publishedBy: root.publishedBy ?? SRD_USER_ID
    })
  })
}

describe('native Character scene vision boundary', () => {
  it('rejects stale, foreign, and unauthenticated reads', async () => {
    const base = await setup()
    const cases: Array<[string, CharacterMechanicsReadInput, 'owner' | 'anonymous']> = [
      [
        'stale stream version',
        { ...base.input, streamVersion: base.input.streamVersion + 1 },
        'owner'
      ],
      ['wrong System', { ...base.input, systemId: crypto.randomUUID() }, 'owner'],
      ['wrong Campaign', { ...base.input, campaignId: crypto.randomUUID() }, 'owner'],
      ['anonymous', base.input, 'anonymous']
    ]
    for (const [label, input, actor] of cases) {
      const call =
        actor === 'owner'
          ? base.owner.caller.query(readSceneVision, input)
          : base.t.query(readSceneVision, input)
      await expect(call, label).rejects.toThrow()
    }
    await base.t.run(async (ctx) => {
      const assignment = await ctx.db
        .query('campaignCharacterAssignments')
        .withIndex('by_characterId', (q) => q.eq('characterId', base.character.id))
        .unique()
      if (!assignment) throw new Error('Missing assignment.')
      await ctx.db.delete(assignment._id)
    })
    await expect(base.owner.caller.query(readSceneVision, base.input)).rejects.toThrow()
  })

  it.each(['missing', 'corrupt', 'wrong System'] as const)(
    'fails closed for a %s Sense source',
    async (kind) => {
      const base = await setup()
      if (kind === 'missing') {
        await base.t.run(async (ctx) => {
          const root = await ctx.db
            .query('reusableDefinitions')
            .withIndex('by_publicId', (q) => q.eq('id', SRD_SENSE_DEFINITIONS[0]!.id))
            .unique()
          if (!root) throw new Error('Missing imported Sense.')
          await ctx.db.delete(root._id)
        })
      } else if (kind === 'corrupt') {
        await patchSense(base, (document) => ({ ...document, id: crypto.randomUUID() }))
      } else {
        await base.t.run(async (ctx) => {
          const root = await ctx.db
            .query('reusableDefinitions')
            .withIndex('by_publicId', (q) => q.eq('id', SRD_SENSE_DEFINITIONS[0]!.id))
            .unique()
          if (!root) throw new Error('Missing imported Sense.')
          await ctx.db.patch(root._id, { gameSystemId: crypto.randomUUID() })
        })
      }
      await expect(base.owner.caller.query(readSceneVision, base.input)).rejects.toThrow()
    }
  )

  it('does not expose a private Sense source to the Campaign GM', async () => {
    const base = await setup()
    await base.t.run(async (ctx) => {
      const sourceId = crypto.randomUUID()
      await ctx.db.insert('contentSources', {
        ...SRD_CONTENT_SOURCE,
        id: sourceId,
        code: 'PRIVATE_SCENE_VISION_TEST',
        kind: 'USER',
        ownerUserId: base.owner.userId
      })
      const root = await ctx.db
        .query('reusableDefinitions')
        .withIndex('by_publicId', (q) => q.eq('id', SRD_SENSE_DEFINITIONS[0]!.id))
        .unique()
      if (!root) throw new Error('Missing imported Sense.')
      await ctx.db.patch(root._id, {
        contentSourceId: sourceId,
        ownerUserId: base.owner.userId,
        contractVersion: 1,
        publishedAt: base.campaign.createdAt,
        publishedBy: base.owner.userId
      })
    })
    await expect(base.owner.caller.query(readSceneVision, base.input)).resolves.toEqual({
      characterId: base.character.id,
      dimRange: { amount: 60, unit: 'FEET' }
    })
    await expect(base.other.caller.query(readSceneVision, base.input)).rejects.toThrow(
      'Reusable definition unavailable.'
    )
  })
})
