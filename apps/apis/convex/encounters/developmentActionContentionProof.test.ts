// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import type { CreateCampaignInput } from '@artificer-toolkit/schema/api/campaignCore'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { verifyEncounterActionTransactions } from '../../tests/developmentEncounterActionTransactions'
import {
  automaticChargedCreature,
  automaticChargedCreatureId
} from '../../tests/fixtures/encounterAction'
import { createEncounterLifecyclePolicyFixture } from '../../tests/fixtures/encounterInitiative'
import { fixture } from '../../tests/fixtures/characters'
import { api, internal } from '../_generated/api'
import {
  attachRoomWorker,
  checkpointRoom,
  roomDevelopmentClient,
  roomPeerClient,
  seedRoomContentSnapshots,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

useLocalRoomWorker()
afterEach(() => {
  vi.unstubAllEnvs()
})

it('proves V14 native RESOLVE_ACTION contention through public commands', async () => {
  const base = await fixture()
  await base.t.mutation(internal.accountEntitlements.setTier, {
    userId: base.owner.userId,
    tier: 'GM'
  })
  const policies = createEncounterLifecyclePolicyFixture(base.owner.userId)
  expect(await base.t.mutation(internal.content.import.bootstrap, policies.bootstrap)).toEqual({
    inserted: 2,
    reused: 1
  })
  expect(
    await base.t.mutation(internal.content.import.importDefinitions, policies.imported)
  ).toEqual({
    inserted: 6,
    reused: 0
  })
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: SRD_RULE_STATE_DEFINITIONS.filter(
      (definition) => definition.id === SRD_ACTION_ALLOWANCE_DEFINITION_ID
    )
  })
  const draft = await base.owner.caller.mutation(api.content.drafts.save, {
    subjectKind: 'CREATURE',
    subjectId: automaticChargedCreatureId,
    systemId: srdSystemRecord.id,
    label: automaticChargedCreature.label,
    payload: automaticChargedCreature
  })
  if (!draft.subjectId || !draft.updatedAt)
    throw new Error('V14 action fixture draft is missing publication identity.')
  await base.owner.caller.mutation(api.content.publication.publishDraft, {
    subjectKind: 'CREATURE',
    subjectId: draft.subjectId,
    expectedDraftUpdatedAt: draft.updatedAt
  })
  const campaignInput = {
    name: 'V14 native action contention fixture',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  } satisfies CreateCampaignInput
  const duplicateCampaign = await base.owner.caller.mutation(
    api.campaigns.create.create,
    campaignInput
  )
  const contentionCampaign = await base.owner.caller.mutation(
    api.campaigns.create.create,
    campaignInput
  )
  for (const campaign of [duplicateCampaign, contentionCampaign])
    await base.owner.caller.mutation(api.campaigns.update.update, {
      campaignId: campaign.id,
      expectedVersion: campaign.version,
      additionalRulesCatalogueIds: [policies.bootstrap.catalogue.id]
    })
  await attachRoomWorker(base.t)
  await seedRoomContentSnapshots(duplicateCampaign.id)
  await seedRoomContentSnapshots(contentionCampaign.id)
  await verifyEncounterActionTransactions({
    owner: roomDevelopmentClient(base.owner.caller),
    peer: roomPeerClient(base.owner.caller),
    checkpoint: async () => {
      await checkpointRoom(duplicateCampaign.id)
      await checkpointRoom(contentionCampaign.id)
    },
    duplicateCampaignId: duplicateCampaign.id,
    contentionCampaignId: contentionCampaign.id,
    initiativePolicyDefinitionId: policies.scenarios[0]!.definitionId,
    initiativePolicyCatalogueId: policies.bootstrap.catalogue.id,
    creatureId: draft.subjectId
  })
}, 120000)
