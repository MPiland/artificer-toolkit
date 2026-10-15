import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { CreateCampaignInput } from '@artificer-toolkit/schema/api/campaignCore'
import { ruleGraphDefinitionDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'
import { initiativePolicyReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/initiativePolicy'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  createDnd5eReactionChoiceDefinition,
  createDnd5eOpportunityReactionEligibilityDefinition
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/reactionEligibilityPolicy'
import { createEncounterLifecyclePolicyFixture } from '../../tests/fixtures/encounterInitiative'
import { fixture } from '../../tests/fixtures/characters'
import { api, components, internal } from '../_generated/api'

type PolicyFixture = ReturnType<typeof createEncounterLifecyclePolicyFixture>

const removeFixtureState = makeFunctionReference<'mutation', PolicyFixture['cleanup'], null>(
  'encounters/developmentPolicies:removeFixtureState'
)
const removeFixtureCampaign = makeFunctionReference<
  'mutation',
  { ownerUserId: string; playerUserId: string; campaignId: string; characterId: string },
  null
>('encounters/developmentCampaign:removeFixtureCampaign')

async function setup(importDefinitions = true, includeMovementReactionPolicies = false) {
  const base = await fixture()
  const canonicalSystem = await base.t.run((ctx) =>
    ctx.db
      .query('systems')
      .withIndex('by_publicId', (q) => q.eq('id', srdSystemRecord.id))
      .unique()
  )
  await base.t.run(async (ctx) => {
    for (const [index, userId] of [base.owner.userId, base.other.userId].entries()) {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
      if (!profile) throw new Error('Missing fixture profile.')
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }],
          update: { email: `draft_123456abcde${index}@example.invalid` }
        }
      })
    }
  })
  const policies = createEncounterLifecyclePolicyFixture(base.owner.userId, {
    includeMovementReactionPolicies
  })
  await base.t.mutation(internal.content.import.bootstrap, policies.bootstrap)
  if (importDefinitions)
    await base.t.mutation(internal.content.import.importDefinitions, policies.imported)
  return { ...base, policies, canonicalSystem }
}

async function state(base: Awaited<ReturnType<typeof setup>>) {
  return base.t.run(async (ctx) => ({
    canonicalSystem: await ctx.db
      .query('systems')
      .withIndex('by_publicId', (q) => q.eq('id', srdSystemRecord.id))
      .unique(),
    fixtureSource: await ctx.db
      .query('contentSources')
      .withIndex('by_publicId', (q) => q.eq('id', base.policies.cleanup.contentSourceId))
      .unique(),
    fixtureCatalogue: await ctx.db
      .query('rulesCatalogues')
      .withIndex('by_publicId', (q) => q.eq('id', base.policies.cleanup.catalogueId))
      .unique(),
    fixtureDefinitions: await ctx.db
      .query('reusableDefinitions')
      .withIndex('by_contentSourceId', (q) =>
        q.eq('contentSourceId', base.policies.cleanup.contentSourceId)
      )
      .take(20),
    canonicalSource: await ctx.db
      .query('contentSources')
      .withIndex('by_publicId', (q) => q.eq('id', SRD_CONTENT_SOURCE.id))
      .unique(),
    canonicalCatalogue: await ctx.db
      .query('rulesCatalogues')
      .withIndex('by_publicId', (q) => q.eq('id', SRD_RULES_CATALOGUE.id))
      .unique(),
    canonicalDefinitions: await ctx.db
      .query('reusableDefinitions')
      .withIndex('by_contentSourceId', (q) => q.eq('contentSourceId', SRD_CONTENT_SOURCE.id))
      .take(20),
    campaigns: await ctx.db
      .query('campaigns')
      .withIndex('by_ownerUserId_status', (q) => q.eq('ownerUserId', base.owner.userId))
      .take(20)
  }))
}

async function createFixtureCampaign(base: Awaited<ReturnType<typeof setup>>) {
  const input: CreateCampaignInput = {
    name: 'Encounter execution fixture',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: base.policies.cleanup.catalogueId
  }
  const campaign = await base.owner.caller.mutation(api.campaigns.create.create, input)
  return {
    campaign,
    cleanup: {
      ownerUserId: base.owner.userId,
      playerUserId: base.other.userId,
      campaignId: campaign.id,
      characterId: crypto.randomUUID()
    }
  }
}

describe('development lifecycle policy cleanup', () => {
  it('cleans up when setup stops after bootstrap and before definition import', async () => {
    const base = await setup(false)
    const before = await state(base)
    expect(before.fixtureSource).not.toBeNull()
    expect(before.fixtureCatalogue).not.toBeNull()
    expect(before.fixtureDefinitions).toEqual([])

    await base.t.mutation(removeFixtureState, base.policies.cleanup)
    expect(await state(base)).toEqual({
      ...before,
      fixtureSource: null,
      fixtureCatalogue: null
    })
    await expect(base.t.mutation(removeFixtureState, base.policies.cleanup)).resolves.toBeNull()
  }, 30_000)

  it('cleans up the optional eight-definition movement policy fixture', async () => {
    const base = await setup(true, true)
    expect(base.policies.imported.definitions).toHaveLength(8)
    expect((await state(base)).fixtureDefinitions).toHaveLength(8)

    await base.t.mutation(removeFixtureState, base.policies.cleanup)
    expect(await state(base)).toMatchObject({
      fixtureSource: null,
      fixtureCatalogue: null,
      fixtureDefinitions: []
    })
  }, 30_000)

  it('cleans up the legacy eight-definition movement policy fixture', async () => {
    const base = await setup()
    const legacyDefinitions = [
      createDnd5eOpportunityReactionEligibilityDefinition(),
      createDnd5eReactionChoiceDefinition()
    ].map((published) => ({
      id: published.id,
      definitionFamilyKey: published.definitionFamilyKey,
      label: 'Movement reaction browser fixture',
      description: 'Current D&D movement reaction policy fixture.',
      document: published.definition,
      checksum: published.checksum
    }))
    await base.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: base.policies.cleanup.contentSourceId,
      definitions: legacyDefinitions
    })
    const cleanup = {
      ...base.policies.cleanup,
      definitionIds: [
        ...base.policies.cleanup.definitionIds,
        ...legacyDefinitions.map(({ id }) => id)
      ]
    }
    expect((await state(base)).fixtureDefinitions).toHaveLength(8)

    await base.t.mutation(removeFixtureState, cleanup)
    expect(await state(base)).toMatchObject({
      fixtureSource: null,
      fixtureCatalogue: null,
      fixtureDefinitions: []
    })
  }, 30_000)

  it('removes the isolated policy fixture only after its Campaign is gone and rolls back atomically', async () => {
    const base = await setup()
    expect(
      await base.t.mutation(internal.content.import.bootstrap, base.policies.bootstrap)
    ).toEqual({ inserted: 0, reused: 3 })
    expect(
      await base.t.mutation(internal.content.import.importDefinitions, base.policies.imported)
    ).toEqual({ inserted: 0, reused: 6 })
    const campaign = await createFixtureCampaign(base)
    const blocked = await state(base)
    expect(blocked.canonicalSystem).toEqual(base.canonicalSystem)
    expect(blocked.fixtureDefinitions).toHaveLength(6)
    expect(blocked.canonicalSource).not.toBeNull()
    expect(blocked.canonicalCatalogue).not.toBeNull()
    await expect(base.t.mutation(removeFixtureState, base.policies.cleanup)).rejects.toThrow(
      'Lifecycle fixture policies are still referenced.'
    )
    expect(await state(base)).toEqual(blocked)

    await base.t.mutation(removeFixtureCampaign, campaign.cleanup)
    const beforeRollback = await state(base)
    await expect(
      base.t.run(async (ctx) => {
        await ctx.runMutation(removeFixtureState, base.policies.cleanup)
        throw new Error('Injected policy cleanup rollback')
      })
    ).rejects.toThrow('Injected policy cleanup rollback')
    expect(await state(base)).toEqual(beforeRollback)

    await base.t.mutation(removeFixtureState, base.policies.cleanup)
    expect(await state(base)).toMatchObject({
      fixtureSource: null,
      fixtureCatalogue: null,
      fixtureDefinitions: [],
      canonicalSource: beforeRollback.canonicalSource,
      canonicalSystem: base.canonicalSystem,
      canonicalCatalogue: beforeRollback.canonicalCatalogue,
      canonicalDefinitions: beforeRollback.canonicalDefinitions,
      campaigns: []
    })
    await expect(base.t.mutation(removeFixtureState, base.policies.cleanup)).resolves.toBeNull()
  }, 30_000)

  it('rejects a foreign native definition that retains a fixture graph reference without writes', async () => {
    const base = await setup()
    const template = base.policies.imported.definitions.find(
      (definition) => definition.definitionFamilyKey === 'initiative-policy'
    )
    if (!template) throw new Error('Missing fixture initiative policy.')
    const document = initiativePolicyReusableDefinitionDocumentDtoSchema.parse(template.document)
    const foreign = { ...document, id: crypto.randomUUID() }
    await base.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: [
        {
          id: foreign.id,
          definitionFamilyKey: 'initiative-policy',
          label: 'Foreign lifecycle policy reference',
          description: 'Foreign fixture retention proof.',
          document: foreign,
          checksum: checksumRuleDocument(foreign)
        }
      ]
    })
    const before = await state(base)

    await expect(base.t.mutation(removeFixtureState, base.policies.cleanup)).rejects.toThrow(
      'Lifecycle fixture policies are still referenced.'
    )

    expect(await state(base)).toEqual(before)
  }, 30_000)

  it.each(['wrong owner', 'canonical target', 'unexpected fixture definition'])(
    'rejects %s without writes',
    async (kind) => {
      const base = await setup()
      if (kind === 'unexpected fixture definition') {
        const template = base.policies.imported.definitions[0]
        if (!template) throw new Error('Missing fixture graph definition.')
        const document = {
          ...ruleGraphDefinitionDtoSchema.parse(template.document),
          id: crypto.randomUUID()
        }
        await base.t.mutation(internal.content.import.importDefinitions, {
          contentSourceId: base.policies.cleanup.contentSourceId,
          definitions: [
            {
              id: document.id,
              definitionFamilyKey: 'rules-runtime-graph',
              label: 'Unexpected fixture definition',
              description: 'Overflow proof.',
              document,
              checksum: checksumRuleDocument(document)
            }
          ]
        })
      }
      const before = await state(base)
      const cleanup =
        kind === 'wrong owner'
          ? { ...base.policies.cleanup, ownerUserId: base.other.userId }
          : kind === 'canonical target'
            ? {
                ...base.policies.cleanup,
                contentSourceId: SRD_CONTENT_SOURCE.id,
                catalogueId: SRD_RULES_CATALOGUE.id
              }
            : base.policies.cleanup

      await expect(base.t.mutation(removeFixtureState, cleanup)).rejects.toThrow()
      expect(await state(base)).toEqual(before)
    },
    30_000
  )
})
