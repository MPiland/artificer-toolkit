import type {
  LiveSessionCharacterInputs,
  LiveSessionCharacterRulesInput
} from '@artificer-toolkit/schema/api/liveSessionCharacterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type {
  ContentSnapshotObject,
  ContentSnapshotPublicationVersion
} from '@artificer-toolkit/schema/api/contentSnapshots'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { CharacterAuthored, ClassAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'
import type { CharacterSheetCampaignContext } from '@artificer-toolkit/rules-runtime/character/campaignCharacterSheet'
import {
  prepareActiveCharacterBuilderContext,
  prepareCharacterRuleContext
} from '@artificer-toolkit/rules-runtime/character/contextPreparation'
import { createSnapshotReaders } from '@artificer-toolkit/rules-runtime/character/snapshotReaders'
import { prepareCharacterSheetFromContext } from '@artificer-toolkit/rules-runtime/character/sheetPreparation'
import { readCharacterRecord } from '@artificer-toolkit/schema/projections/characterStoredState'

export type PreparedLiveCharacterSheet = Awaited<
  ReturnType<typeof prepareLiveCharacterSheetFacts>
> & {
  revisions: LiveSessionRulesRevisions
}

/**
 * Prepares a Character's sheet facts from its stored inputs and the content snapshot objects of its
 * authorized manifest (ADR 0036 S10), as the browser Builder evaluates them. The caller authorizes
 * the objects' scopes; roots merge by id with SOURCE shadowing CAMPAIGN, and the build already
 * applied the Campaign parent-share rule.
 */
export async function prepareLiveCharacterSheetFacts(input: {
  scope: LiveSessionCharacterRulesInput
  inputs: LiveSessionCharacterInputs
  system: SystemAuthoredDto
  objects: readonly ContentSnapshotObject[]
}) {
  const { scope, inputs, system, objects } = input
  if (
    inputs.owner.id !== scope.characterId ||
    inputs.campaign.id !== scope.campaignId ||
    system.id !== inputs.owner.systemId
  )
    throw new Error('Character rules input binding mismatch.')
  if (inputs.owner.status !== 'ACTIVE') throw new Error('Character owner binding mismatch.')
  // Validated DTOs use literal starting-equipment sources for the authored string enum.
  const character = readCharacterRecord(inputs.owner) as CharacterAuthored
  const versions = new Map<string, ContentSnapshotPublicationVersion>()
  const classes = new Map<string, ClassAuthored>()
  const ordered = [...objects].sort(
    (left, right) => Number(left.scope === 'CAMPAIGN') - Number(right.scope === 'CAMPAIGN')
  )
  for (const object of ordered) {
    if (object.part !== 'documents') continue
    for (const [index, root] of object.roots.entries()) {
      if (root.systemId !== character.systemId)
        throw new Error('Character rules source System mismatch.')
      const pin = object.versions[index]!
      const previous = versions.get(root.id)
      if (previous) {
        const identity = ({
          identity,
          version,
          storedParentId
        }: ContentSnapshotPublicationVersion) =>
          canonicalizeJson({ identity, version, storedParentId: storedParentId ?? null })
        if (identity(previous) !== identity(pin))
          throw new Error('Character rules source versions disagree.')
        continue
      }
      versions.set(root.id, pin)
      if (object.kind === 'CLASS') classes.set(root.id, root as ClassAuthored)
    }
  }
  const readers = createSnapshotReaders(objects)
  const ruleContext = await prepareCharacterRuleContext(character, system, undefined, readers)
  const context = await prepareActiveCharacterBuilderContext(character, ruleContext, async () =>
    [...classes.values()].sort(
      (left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id)
    )
  )
  const campaignContext: CharacterSheetCampaignContext = {
    currencyOptions: inputs.campaign.currencyOptions,
    viewer: character.userId === scope.expectedUserId ? 'CHARACTER_OWNER' : 'CAMPAIGN_OWNER',
    isCampaignOwner: scope.expectedRole === 'OWNER',
    campaignId: inputs.campaign.id,
    campaignStatus: inputs.campaign.status,
    contentMaturity: inputs.campaign.contentMaturity,
    attunementSlotOverride: inputs.campaign.attunementSlotOverride,
    adjustments: inputs.campaign.state.adjustments.map((record) => ({
      ...record.adjustment,
      id: record.id,
      characterId: character.id,
      createdBy: record.createdBy,
      updatedBy: record.createdBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    })),
    secretAdjustmentIds: new Set(
      inputs.campaign.state.adjustments
        .filter((record) => record.visibility === 'SECRET')
        .map((record) => record.id)
    ),
    conditions: inputs.campaign.state.conditions
  }
  const preparedSheet = await prepareCharacterSheetFromContext({
    character,
    context,
    sheetState: inputs.sheetState,
    campaignContext
  })
  return {
    active: inputs.owner,
    character,
    sheetState: inputs.sheetState,
    campaignContext,
    ...preparedSheet,
    /** The pinned source version of every root the manifest supplies. */
    sourceVersions: versions as ReadonlyMap<string, ContentSnapshotPublicationVersion>
  }
}
