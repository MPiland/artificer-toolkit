import assert from 'node:assert/strict'
import type {
  CampaignAdjustmentDto,
  CampaignAdjustmentInput,
  CampaignConditionDto,
  SaveCampaignConditionInput
} from '@artificer-toolkit/schema/api/campaignLiveState'
import type { DevelopmentCampaignInspection } from '@artificer-toolkit/schema/api/developmentCampaignLifecycle'
import { campaignStoredEventSchema } from '@artificer-toolkit/schema/projections/campaignEventPersistence'
import {
  campaignCharacterStateSchema,
  type CampaignCharacterState
} from '@artificer-toolkit/schema/projections/campaignCharacterState'
import { sceneVisionRevisionSchema } from '@artificer-toolkit/schema/projections/sceneVisionRevisions'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { getCharacterSheetAdjustmentSlotKey } from '@artificer-toolkit/rules-runtime/character/sheetAdjustmentIdentity'
import { SRD_CONDITION_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api } from '../convex/_generated/api'
import type { DevelopmentClient } from './developmentClient'

type TableMap = Record<string, Array<Record<string, unknown>>>
type Snapshot = { campaign: TableMap; personal: TableMap }

type ExpectedEvent = {
  type: string
  visibility: 'OWNER' | 'SUBJECT'
  payload: Record<string, unknown>
}

export async function verifyCampaignGmState(input: {
  owner: DevelopmentClient
  player: DevelopmentClient
  outsider: DevelopmentClient
  ownerUserId: string
  campaignId: string
  characterId: string
  unrelatedCharacterId: string
  inspect: () => Promise<DevelopmentCampaignInspection>
  onStage?: (label: string, details: Record<string, unknown>) => void
}): Promise<void> {
  const scope = { campaignId: input.campaignId, characterId: input.characterId }
  const baseline = await snapshot(input.inspect)
  assert.equal(targetRows(baseline.campaign, 'campaigns', input.campaignId).length, 1)
  const initialized = targetRows(baseline.campaign, 'campaignCharacterStates', input.characterId)
  assert.equal(initialized.length, 1)
  const emptyState = { adjustments: [], conditions: [] }
  assert.deepEqual(withoutMetadata(initialized[0]!), {
    campaignId: input.campaignId,
    characterId: input.characterId,
    documentJson: JSON.stringify(emptyState),
    checksum: checksumRuleDocument(emptyState)
  })
  marker(baseline.personal, input.characterId)

  const ownerCampaign = await input.owner.query(api.campaigns.queries.get, { id: input.campaignId })
  assert.equal(ownerCampaign?.status, 'ACTIVE')
  const playerPersonalBaseline = await input.player.query(api.characters.sheet.get, {
    id: input.characterId
  })
  const playerScoped = await input.player.query(api.campaigns.characterSheet.get, scope)
  assert.ok(playerPersonalBaseline)
  assert.equal(await input.owner.query(api.characters.sheet.get, { id: input.characterId }), null)
  assert.equal(
    await input.owner.query(api.characters.builder.activeCharacter, { id: input.characterId }),
    null
  )

  const baselineEventCount = (baseline.campaign.campaignEvents ?? []).length
  let state: CampaignCharacterState = { adjustments: [], conditions: [] }
  let current = baseline
  let stageBefore = baseline
  const stage = (label: string, details: Record<string, unknown>) => {
    input.onStage?.(label, {
      ...details,
      events: current.campaign.campaignEvents,
      before: stageBefore,
      after: current
    })
    stageBefore = current
  }
  const hpAdjustment = {
    id: crypto.randomUUID(),
    family: 'HIT_POINTS',
    field: 'MAXIMUM_MODIFIER',
    value: 4,
    sourceNote: 'secret HP source'
  } as const
  const hpRequest: CampaignAdjustmentInput = {
    ...scope,
    expectedVersion: 0,
    visibility: 'SECRET',
    adjustment: hpAdjustment
  }
  const strengthRequest: CampaignAdjustmentInput = {
    ...scope,
    expectedVersion: 0,
    visibility: 'VISIBLE',
    adjustment: {
      family: 'ABILITY',
      ability: 'STRENGTH',
      field: 'SCORE_OVERRIDE',
      value: 21,
      sourceNote: 'visible Strength source'
    }
  }
  const secretConditionRequest: SaveCampaignConditionInput = {
    ...scope,
    expectedVersion: 0,
    visibility: 'SECRET',
    conditionTypeId: SRD_CONDITION_TYPES[0]!.id,
    notes: '  secret condition note  '
  }
  const visibleConditionRequest: SaveCampaignConditionInput = {
    ...scope,
    expectedVersion: 0,
    visibility: 'VISIBLE',
    conditionTypeId: SRD_CONDITION_TYPES[1]!.id,
    notes: '  visible condition note  '
  }

  const hp = await input.owner.mutation(api.campaigns.gmWrites.saveAdjustment, hpRequest)
  assert.notEqual(hp.id, hpRequest.adjustment.id)
  assert.deepEqual(
    { ...hp, id: null, createdAt: null, updatedAt: null },
    {
      ...scope,
      id: null,
      createdAt: null,
      updatedAt: null,
      version: 0,
      visibility: 'SECRET',
      adjustment: {
        family: 'HIT_POINTS',
        field: 'MAXIMUM_MODIFIER',
        value: 4,
        sourceNote: 'secret HP source'
      }
    }
  )
  assert.equal(hp.createdAt, hp.updatedAt)
  state.adjustments.push({ ...hp, createdBy: input.ownerUserId })
  current = await assertCommit({
    before: current,
    inspect: input.inspect,
    campaignId: input.campaignId,
    characterId: input.characterId,
    ownerUserId: input.ownerUserId,
    state,
    event: adjustmentEvent('CAMPAIGN_ADJUSTMENT_SAVED', hp, 'SAVED')
  })
  stage('secret HP saved', { request: hpRequest, result: hp, before: baseline, after: current })

  const strength = await input.owner.mutation(
    api.campaigns.gmWrites.saveAdjustment,
    strengthRequest
  )
  assert.deepEqual(
    { ...strength, id: null, createdAt: null, updatedAt: null },
    {
      ...scope,
      id: null,
      createdAt: null,
      updatedAt: null,
      version: 0,
      visibility: 'VISIBLE',
      adjustment: strengthRequest.adjustment
    }
  )
  assert.equal(strength.createdAt, strength.updatedAt)
  assert.notEqual(strength.id, hp.id)
  state.adjustments.push({ ...strength, createdBy: input.ownerUserId })
  current = await assertCommit({
    before: current,
    inspect: input.inspect,
    campaignId: input.campaignId,
    characterId: input.characterId,
    ownerUserId: input.ownerUserId,
    state,
    event: adjustmentEvent('CAMPAIGN_ADJUSTMENT_SAVED', strength, 'SAVED')
  })
  stage('visible Strength saved', { request: strengthRequest, result: strength, before: current })

  const secretCondition = await input.owner.mutation(
    api.campaigns.gmWrites.saveCondition,
    secretConditionRequest
  )
  assert.deepEqual(
    { ...secretCondition, id: null, createdAt: null, updatedAt: null },
    {
      ...scope,
      id: null,
      createdAt: null,
      updatedAt: null,
      version: 0,
      visibility: 'SECRET',
      conditionTypeId: secretConditionRequest.conditionTypeId,
      notes: 'secret condition note'
    }
  )
  assert.equal(secretCondition.createdAt, secretCondition.updatedAt)
  state.conditions.push({ ...secretCondition, createdBy: input.ownerUserId })
  current = await assertCommit({
    before: current,
    inspect: input.inspect,
    campaignId: input.campaignId,
    characterId: input.characterId,
    ownerUserId: input.ownerUserId,
    state,
    event: conditionEvent('CAMPAIGN_CONDITION_SAVED', secretCondition, 'SAVED')
  })
  stage('secret condition saved', {
    request: secretConditionRequest,
    result: secretCondition,
    before: current
  })

  const visibleCondition = await input.owner.mutation(
    api.campaigns.gmWrites.saveCondition,
    visibleConditionRequest
  )
  assert.deepEqual(
    { ...visibleCondition, id: null, createdAt: null, updatedAt: null },
    {
      ...scope,
      id: null,
      createdAt: null,
      updatedAt: null,
      version: 0,
      visibility: 'VISIBLE',
      conditionTypeId: visibleConditionRequest.conditionTypeId,
      notes: 'visible condition note'
    }
  )
  assert.equal(visibleCondition.createdAt, visibleCondition.updatedAt)
  assert.notEqual(visibleCondition.id, secretCondition.id)
  state.conditions.push({ ...visibleCondition, createdBy: input.ownerUserId })
  current = await assertCommit({
    before: current,
    inspect: input.inspect,
    campaignId: input.campaignId,
    characterId: input.characterId,
    ownerUserId: input.ownerUserId,
    state,
    event: conditionEvent('CAMPAIGN_CONDITION_SAVED', visibleCondition, 'SAVED')
  })
  stage('visible condition saved', {
    request: visibleConditionRequest,
    result: visibleCondition,
    before: current
  })

  await assertReadPrivacy(input, scope, state, hp, secretCondition)
  const scopedWithInitialOverlay = await input.player.query(api.campaigns.characterSheet.get, scope)
  assert.equal(
    scopedWithInitialOverlay.overview.maxHitPoints,
    playerScoped.overview.maxHitPoints + 4
  )
  assert.equal(
    characterPlayRow(current.personal, input.characterId).maximumHitPoints,
    scopedWithInitialOverlay.overview.maxHitPoints
  )
  assert.equal(
    scopedWithInitialOverlay.overview.abilities.find((entry) => entry.ability === 'STRENGTH')
      ?.score,
    21
  )
  const visibleConditionProjection = {
    conditionTypeId: visibleCondition.conditionTypeId,
    label: SRD_CONDITION_TYPES[1]!.label,
    description: SRD_CONDITION_TYPES[1]!.description,
    notes: visibleCondition.notes
  }
  assert.deepEqual(scopedWithInitialOverlay.overview.conditions, [
    ...playerScoped.overview.conditions,
    visibleConditionProjection
  ])
  const personalWithInitialOverlay = await input.player.query(api.characters.sheet.get, {
    id: input.characterId
  })
  assert.ok(personalWithInitialOverlay)
  assert.equal(
    personalWithInitialOverlay.overview.maxHitPoints,
    playerPersonalBaseline.overview.maxHitPoints + 4
  )
  assert.equal(
    personalWithInitialOverlay.overview.abilities.find((entry) => entry.ability === 'STRENGTH')
      ?.score,
    21
  )

  assert.deepEqual(personalWithInitialOverlay.overview.conditions, [
    ...playerPersonalBaseline.overview.conditions,
    visibleConditionProjection
  ])

  const updatedHp = await input.owner.mutation(api.campaigns.gmWrites.saveAdjustment, {
    ...hpRequest,
    expectedVersion: 0,
    adjustment: { ...hpAdjustment, value: 6 }
  })
  assert.equal(updatedHp.id, hp.id)
  assert.equal(updatedHp.createdAt, hp.createdAt)
  assert.deepEqual(
    { ...updatedHp, updatedAt: hp.updatedAt },
    { ...hp, version: 1, adjustment: { ...hp.adjustment, value: 6 } }
  )
  state.adjustments = state.adjustments.map((entry) =>
    entry.id === hp.id ? { ...updatedHp, createdBy: input.ownerUserId } : entry
  )
  current = await assertCommit({
    before: current,
    inspect: input.inspect,
    campaignId: input.campaignId,
    characterId: input.characterId,
    ownerUserId: input.ownerUserId,
    state,
    event: adjustmentEvent('CAMPAIGN_ADJUSTMENT_SAVED', updatedHp, 'SAVED')
  })
  stage('secret HP updated', {
    request: {
      ...hpRequest,
      expectedVersion: 0,
      adjustment: { ...hpRequest.adjustment, value: 6 }
    },
    result: updatedHp
  })

  const updatedVisibleCondition = await input.owner.mutation(api.campaigns.gmWrites.saveCondition, {
    ...visibleConditionRequest,
    expectedVersion: 0,
    notes: ''
  })
  assert.equal(updatedVisibleCondition.id, visibleCondition.id)
  assert.equal(updatedVisibleCondition.createdAt, visibleCondition.createdAt)
  assert.equal('notes' in updatedVisibleCondition, false)
  const { notes: _previousNotes, ...previousCondition } = visibleCondition
  assert.deepEqual(
    { ...updatedVisibleCondition, updatedAt: visibleCondition.updatedAt },
    { ...previousCondition, version: 1 }
  )
  state.conditions = state.conditions.map((entry) =>
    entry.id === visibleCondition.id
      ? { ...updatedVisibleCondition, createdBy: input.ownerUserId }
      : entry
  )
  current = await assertCommit({
    before: current,
    inspect: input.inspect,
    campaignId: input.campaignId,
    characterId: input.characterId,
    ownerUserId: input.ownerUserId,
    state,
    event: conditionEvent('CAMPAIGN_CONDITION_SAVED', updatedVisibleCondition, 'SAVED')
  })
  stage('visible condition cleared', {
    request: { ...visibleConditionRequest, expectedVersion: 0, notes: '' },
    result: updatedVisibleCondition
  })

  await assertRefusals({
    input,
    scope,
    hp: updatedHp,
    condition: updatedVisibleCondition,
    snapshot: current
  })
  const scopedWithUpdatedOverlay = await input.player.query(api.campaigns.characterSheet.get, scope)
  assert.equal(
    scopedWithUpdatedOverlay.overview.maxHitPoints,
    playerScoped.overview.maxHitPoints + 6
  )
  assert.equal(
    characterPlayRow(current.personal, input.characterId).maximumHitPoints,
    scopedWithUpdatedOverlay.overview.maxHitPoints
  )
  const personalWithUpdatedOverlay = await input.player.query(api.characters.sheet.get, {
    id: input.characterId
  })
  assert.ok(personalWithUpdatedOverlay)
  assert.equal(
    personalWithUpdatedOverlay.overview.maxHitPoints,
    playerPersonalBaseline.overview.maxHitPoints + 6
  )
  await assertReadPrivacy(input, scope, state, updatedHp, secretCondition)
  for (const sheet of [
    scopedWithInitialOverlay,
    personalWithInitialOverlay,
    scopedWithUpdatedOverlay,
    personalWithUpdatedOverlay
  ]) {
    const visibleSheet = JSON.stringify(sheet)
    for (const secret of [hp.id, secretCondition.id, 'secret HP source', 'secret condition note']) {
      assert.equal(visibleSheet.includes(secret), false)
    }
  }

  const deleteUpdatedHpRequest = {
    ...scope,
    adjustmentId: updatedHp.id,
    expectedVersion: 1
  }
  const deleteUpdatedHpResult = await input.owner.mutation(
    api.campaigns.gmWrites.deleteAdjustment,
    deleteUpdatedHpRequest
  )
  assert.deepEqual(deleteUpdatedHpResult, { ok: true })
  state.adjustments = state.adjustments.filter((entry) => entry.id !== updatedHp.id)
  current = await assertCommit({
    before: current,
    inspect: input.inspect,
    campaignId: input.campaignId,
    characterId: input.characterId,
    ownerUserId: input.ownerUserId,
    state,
    event: adjustmentEvent('CAMPAIGN_ADJUSTMENT_DELETED', updatedHp, 'DELETED')
  })
  stage('secret HP deleted', { request: deleteUpdatedHpRequest, result: deleteUpdatedHpResult })

  const deleteStrengthRequest = {
    ...scope,
    adjustmentId: strength.id,
    expectedVersion: 0
  }
  const deleteStrengthResult = await input.owner.mutation(
    api.campaigns.gmWrites.deleteAdjustment,
    deleteStrengthRequest
  )
  assert.deepEqual(deleteStrengthResult, { ok: true })
  state.adjustments = []
  current = await assertCommit({
    before: current,
    inspect: input.inspect,
    campaignId: input.campaignId,
    characterId: input.characterId,
    ownerUserId: input.ownerUserId,
    state,
    event: adjustmentEvent('CAMPAIGN_ADJUSTMENT_DELETED', strength, 'DELETED')
  })
  stage('visible Strength deleted', {
    request: deleteStrengthRequest,
    result: deleteStrengthResult
  })

  const deleteSecretConditionRequest = {
    ...scope,
    conditionId: secretCondition.id,
    expectedVersion: 0
  }
  const deleteSecretConditionResult = await input.owner.mutation(
    api.campaigns.gmWrites.deleteCondition,
    deleteSecretConditionRequest
  )
  assert.deepEqual(deleteSecretConditionResult, { ok: true })
  state.conditions = state.conditions.filter((entry) => entry.id !== secretCondition.id)
  current = await assertCommit({
    before: current,
    inspect: input.inspect,
    campaignId: input.campaignId,
    characterId: input.characterId,
    ownerUserId: input.ownerUserId,
    state,
    event: conditionEvent('CAMPAIGN_CONDITION_DELETED', secretCondition, 'DELETED')
  })
  stage('secret condition deleted', {
    request: deleteSecretConditionRequest,
    result: deleteSecretConditionResult
  })

  const deleteUpdatedVisibleConditionRequest = {
    ...scope,
    conditionId: updatedVisibleCondition.id,
    expectedVersion: 1
  }
  const deleteUpdatedVisibleConditionResult = await input.owner.mutation(
    api.campaigns.gmWrites.deleteCondition,
    deleteUpdatedVisibleConditionRequest
  )
  assert.deepEqual(deleteUpdatedVisibleConditionResult, { ok: true })
  state.conditions = []
  current = await assertCommit({
    before: current,
    inspect: input.inspect,
    campaignId: input.campaignId,
    characterId: input.characterId,
    ownerUserId: input.ownerUserId,
    state,
    event: conditionEvent('CAMPAIGN_CONDITION_DELETED', updatedVisibleCondition, 'DELETED')
  })
  stage('visible condition deleted', {
    request: deleteUpdatedVisibleConditionRequest,
    result: deleteUpdatedVisibleConditionResult
  })

  assert.equal(targetRows(current.campaign, 'campaignCharacterStates', input.characterId).length, 0)
  assert.deepEqual(await input.player.query(api.campaigns.characterSheet.get, scope), playerScoped)
  assert.deepEqual(
    await input.player.query(api.characters.sheet.get, { id: input.characterId }),
    playerPersonalBaseline
  )
  assert.equal(await input.owner.query(api.characters.sheet.get, { id: input.characterId }), null)
  assert.equal(
    await input.owner.query(api.characters.builder.activeCharacter, { id: input.characterId }),
    null
  )
  assert.equal((current.campaign.campaignEvents ?? []).length - baselineEventCount, 10)
}

function adjustmentEvent(
  type: string,
  adjustment: CampaignAdjustmentDto,
  action: 'SAVED' | 'DELETED'
): ExpectedEvent {
  return {
    type,
    visibility: adjustment.visibility === 'VISIBLE' ? 'SUBJECT' : 'OWNER',
    payload: {
      action,
      adjustmentId: adjustment.id,
      family: adjustment.adjustment.family,
      slotKey: getCharacterSheetAdjustmentSlotKey(adjustment.adjustment),
      version: adjustment.version
    }
  }
}

function conditionEvent(
  type: string,
  condition: CampaignConditionDto,
  action: 'SAVED' | 'DELETED'
): ExpectedEvent {
  return {
    type,
    visibility: condition.visibility === 'VISIBLE' ? 'SUBJECT' : 'OWNER',
    payload: {
      action,
      conditionId: condition.id,
      conditionTypeId: condition.conditionTypeId,
      version: condition.version
    }
  }
}

async function assertCommit(input: {
  before: Snapshot
  inspect: () => Promise<DevelopmentCampaignInspection>
  campaignId: string
  characterId: string
  ownerUserId: string
  state: CampaignCharacterState
  event: ExpectedEvent
}): Promise<Snapshot> {
  const after = await snapshot(input.inspect)
  const expectedCampaign: TableMap = {
    ...input.before.campaign,
    campaignEvents: [...input.before.campaign.campaignEvents]
  }
  const expectedPersonal: TableMap = { ...input.before.personal }
  const expectedState = campaignCharacterStateSchema.parse(input.state)
  const existing = targetRows(expectedCampaign, 'campaignCharacterStates', input.characterId)
  const actual = targetRows(after.campaign, 'campaignCharacterStates', input.characterId)
  if (expectedState.adjustments.length === 0 && expectedState.conditions.length === 0) {
    assert.equal(actual.length, 0)
    expectedCampaign.campaignCharacterStates = expectedCampaign.campaignCharacterStates.filter(
      (row) => !matchesCharacter(row, input.characterId)
    )
  } else {
    assert.equal(actual.length, 1)
    const stateRow = actual[0]!
    assert.deepEqual(withoutMetadata(stateRow), {
      campaignId: input.campaignId,
      characterId: input.characterId,
      documentJson: JSON.stringify(expectedState),
      checksum: checksumRuleDocument(expectedState)
    })
    expectedCampaign.campaignCharacterStates = expectedCampaign.campaignCharacterStates.filter(
      (row) => !matchesCharacter(row, input.characterId)
    )
    expectedCampaign.campaignCharacterStates.push(
      existing[0] ? { ...existing[0], ...withoutMetadata(stateRow) } : stateRow
    )
  }

  const previousEventIds = new Set(
    (expectedCampaign.campaignEvents ?? []).map((row) => String(row._id))
  )
  const newEvents = (after.campaign.campaignEvents ?? []).filter(
    (row) => !previousEventIds.has(String(row._id))
  )
  assert.equal(newEvents.length, 1)
  const event = newEvents[0]!
  const stored = campaignStoredEventSchema.parse(withoutMetadata(event))
  assert.equal(stored.campaignId, input.campaignId)
  assert.equal(stored.actorUserId, input.ownerUserId)
  assert.equal(stored.visibleInHistory, true)
  assert.equal(stored.type, input.event.type)
  assert.equal(stored.visibility, input.event.visibility)
  assert.equal(stored.subjectCharacterId, input.characterId)
  assert.deepEqual(JSON.parse(stored.payloadJson), input.event.payload)
  assert.match(stored.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  assert.match(stored.createdAt, /^\d{4}-\d{2}-\d{2}T/)
  expectedCampaign.campaignEvents.push(event)

  const beforeMarker = marker(expectedPersonal, input.characterId)
  const afterMarker = marker(after.personal, input.characterId)
  assert.equal(afterMarker._id, beforeMarker._id)
  assert.deepEqual({ ...afterMarker, revision: beforeMarker.revision }, beforeMarker)
  sceneVisionRevisionSchema.parse(withoutMetadata(afterMarker))
  assert.notEqual(afterMarker.revision, beforeMarker.revision)
  expectedPersonal.sceneVisionRevisions = expectedPersonal.sceneVisionRevisions.map((row) =>
    row._id === beforeMarker._id ? afterMarker : row
  )
  // Campaign overlays feed the Character's evaluation; only its stored maximum may move, and it
  // lives on the play record.
  const { maximumHitPoints } = characterPlayRow(after.personal, input.characterId)
  expectedPersonal.characterPlayStates = expectedPersonal.characterPlayStates.map((row) =>
    matchesCharacter(row, input.characterId) ? { ...row, maximumHitPoints } : row
  )
  // The same evaluation re-derives that Character's stored Sheet sections (ADR 0040); every other
  // Character's stay as they were.
  for (const table of ['characterSheetSections', 'characterSheetDerivations'])
    expectedPersonal[table] = [
      ...(expectedPersonal[table] ?? []).filter((row) => !matchesCharacter(row, input.characterId)),
      ...targetRows(after.personal, table, input.characterId)
    ]

  assert.deepEqual(normalize(after.campaign), normalize(expectedCampaign))
  assert.deepEqual(normalize(after.personal), normalize(expectedPersonal))
  return after
}

async function assertReadPrivacy(
  input: Parameters<typeof verifyCampaignGmState>[0],
  scope: { campaignId: string; characterId: string },
  state: CampaignCharacterState,
  secretAdjustment: CampaignAdjustmentDto,
  secretCondition: CampaignConditionDto
): Promise<void> {
  const before = await snapshot(input.inspect)
  const ownerAdjustments = await input.owner.query(api.campaigns.gmReads.adjustments, scope)
  const ownerConditions = await input.owner.query(api.campaigns.gmReads.conditions, scope)
  const expectedAdjustments = state.adjustments
    .map(({ createdBy: _createdBy, ...record }) => record)
    .sort(
      (left, right) =>
        left.adjustment.family.localeCompare(right.adjustment.family) ||
        getCharacterSheetAdjustmentSlotKey(left.adjustment).localeCompare(
          getCharacterSheetAdjustmentSlotKey(right.adjustment)
        ) ||
        left.id.localeCompare(right.id)
    )
  const expectedConditions = state.conditions
    .map(({ createdBy: _createdBy, ...record }) => record)
    .sort(
      (left, right) =>
        left.conditionTypeId.localeCompare(right.conditionTypeId) || left.id.localeCompare(right.id)
    )
  assert.deepEqual(ownerAdjustments, expectedAdjustments)
  assert.deepEqual(ownerConditions, expectedConditions)
  const playerAdjustments = await input.player.query(api.campaigns.gmReads.adjustments, scope)
  const playerConditions = await input.player.query(api.campaigns.gmReads.conditions, scope)
  assert.deepEqual(
    playerAdjustments,
    expectedAdjustments.filter((record) => record.visibility === 'VISIBLE')
  )
  assert.deepEqual(
    playerConditions,
    expectedConditions.filter((record) => record.visibility === 'VISIBLE')
  )
  const visible = JSON.stringify({ playerAdjustments, playerConditions })
  for (const secret of [
    secretAdjustment.id,
    secretCondition.id,
    'secret HP source',
    'secret condition note'
  ])
    assert.equal(visible.includes(secret), false)
  assert.equal(JSON.stringify(ownerAdjustments).includes('createdBy'), false)
  assert.equal(JSON.stringify(ownerConditions).includes('createdBy'), false)
  await assert.rejects(
    () => input.outsider.query(api.campaigns.gmReads.adjustments, scope),
    /Campaign not found\./
  )
  await assert.rejects(
    () => input.outsider.query(api.campaigns.gmReads.conditions, scope),
    /Campaign not found\./
  )
  assert.deepEqual(await snapshot(input.inspect), before)
}

async function assertRefusals(input: {
  input: Parameters<typeof verifyCampaignGmState>[0]
  scope: { campaignId: string; characterId: string }
  hp: CampaignAdjustmentDto
  condition: CampaignConditionDto
  snapshot: Snapshot
}): Promise<void> {
  const staleAdjustment = {
    ...input.scope,
    visibility: 'SECRET' as const,
    expectedVersion: 0,
    adjustment: {
      id: input.hp.adjustment.id,
      family: 'HIT_POINTS' as const,
      field: 'MAXIMUM_MODIFIER' as const,
      value: 7,
      sourceNote: input.hp.adjustment.sourceNote
    }
  }
  const staleCondition = {
    ...input.scope,
    visibility: 'VISIBLE' as const,
    expectedVersion: 0,
    conditionTypeId: input.condition.conditionTypeId,
    notes: 'stale'
  }
  await rejectsWithoutChange(
    input,
    () => input.input.owner.mutation(api.campaigns.gmWrites.saveAdjustment, staleAdjustment),
    /Campaign adjustment changed before this save completed\./
  )
  await rejectsWithoutChange(
    input,
    () => input.input.owner.mutation(api.campaigns.gmWrites.saveCondition, staleCondition),
    /Campaign condition changed before this save completed\./
  )
  await rejectsWithoutChange(
    input,
    () =>
      input.input.owner.mutation(api.campaigns.gmWrites.deleteAdjustment, {
        ...input.scope,
        adjustmentId: input.hp.id,
        expectedVersion: 0
      }),
    /Campaign adjustment changed before this delete completed\./
  )
  await rejectsWithoutChange(
    input,
    () =>
      input.input.owner.mutation(api.campaigns.gmWrites.deleteCondition, {
        ...input.scope,
        conditionId: input.condition.id,
        expectedVersion: 0
      }),
    /Campaign condition changed before this delete completed\./
  )
  await rejectsWithoutChange(
    input,
    () =>
      input.input.owner.mutation(api.campaigns.gmWrites.deleteAdjustment, {
        ...input.scope,
        adjustmentId: input.condition.id,
        expectedVersion: 1
      }),
    /Campaign adjustment changed before this delete completed\./
  )
  await rejectsWithoutChange(
    input,
    () =>
      input.input.owner.mutation(api.campaigns.gmWrites.deleteCondition, {
        ...input.scope,
        conditionId: input.hp.id,
        expectedVersion: 1
      }),
    /Campaign condition changed before this delete completed\./
  )
  for (const scope of [
    { ...input.scope, characterId: input.input.unrelatedCharacterId },
    { ...input.scope, campaignId: crypto.randomUUID() }
  ]) {
    const error =
      scope.campaignId === input.scope.campaignId
        ? /Assigned Character not found\./
        : /Campaign not found\./
    await writerRefusals(input, input.input.owner, scope, error)
  }
  await writerRefusals(
    input,
    input.input.player,
    input.scope,
    /You cannot perform this Campaign action\./
  )
  await writerRefusals(input, input.input.outsider, input.scope, /Campaign not found\./)
  assert.deepEqual(await snapshot(input.input.inspect), input.snapshot)
}

async function writerRefusals(
  input: Parameters<typeof assertRefusals>[0],
  caller: DevelopmentClient,
  scope: { campaignId: string; characterId: string },
  error: RegExp
): Promise<void> {
  await rejectsWithoutChange(
    input,
    () =>
      caller.mutation(api.campaigns.gmWrites.saveAdjustment, {
        ...scope,
        visibility: 'SECRET',
        expectedVersion: 0,
        adjustment: { family: 'HIT_POINTS', field: 'MAXIMUM_MODIFIER', value: 1 }
      }),
    error
  )
  await rejectsWithoutChange(
    input,
    () =>
      caller.mutation(api.campaigns.gmWrites.saveCondition, {
        ...scope,
        visibility: 'SECRET',
        expectedVersion: 0,
        conditionTypeId: SRD_CONDITION_TYPES[0]!.id
      }),
    error
  )
  await rejectsWithoutChange(
    input,
    () =>
      caller.mutation(api.campaigns.gmWrites.deleteAdjustment, {
        ...scope,
        adjustmentId: input.hp.id,
        expectedVersion: 1
      }),
    error
  )
  await rejectsWithoutChange(
    input,
    () =>
      caller.mutation(api.campaigns.gmWrites.deleteCondition, {
        ...scope,
        conditionId: input.condition.id,
        expectedVersion: 1
      }),
    error
  )
}

async function rejectsWithoutChange(
  input: Pick<Parameters<typeof assertRefusals>[0], 'input'>,
  operation: () => Promise<unknown>,
  error: RegExp
): Promise<void> {
  const before = await snapshot(input.input.inspect)
  await assert.rejects(operation, error)
  assert.deepEqual(await snapshot(input.input.inspect), before)
}

async function snapshot(inspect: () => Promise<DevelopmentCampaignInspection>): Promise<Snapshot> {
  const result = await inspect()
  return {
    campaign: parseTables(result.campaignStateJson),
    personal: parseTables(result.personalStateJson)
  }
}

function parseTables(value: string): TableMap {
  const parsed: unknown = JSON.parse(value)
  assert.ok(parsed && typeof parsed === 'object' && !Array.isArray(parsed))
  const result: TableMap = {}
  for (const [table, rows] of Object.entries(parsed)) {
    assert.ok(Array.isArray(rows), `Expected table rows for ${table}.`)
    result[table] = rows.map((row) => {
      assert.ok(row && typeof row === 'object' && !Array.isArray(row), `Expected row in ${table}.`)
      return row as Record<string, unknown>
    })
  }
  return result
}

function normalize(value: TableMap): TableMap {
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([table, rows]) => [
        table,
        [...rows].sort((left, right) => String(left._id).localeCompare(String(right._id)))
      ])
  )
}

function targetRows(tables: TableMap, table: string, identity: string) {
  return (tables[table] ?? []).filter((row) =>
    table === 'campaigns' ? row.id === identity : matchesCharacter(row, identity)
  )
}

function matchesCharacter(row: Record<string, unknown>, characterId: string) {
  return row.characterId === characterId
}

function marker(tables: TableMap, characterId: string): Record<string, unknown> {
  const rows = (tables.sceneVisionRevisions ?? []).filter(
    (row) => row.scope === 'CHARACTER' && row.id === characterId
  )
  assert.equal(rows.length, 1)
  return rows[0]!
}

function characterPlayRow(tables: TableMap, characterId: string): Record<string, unknown> {
  const rows = (tables.characterPlayStates ?? []).filter((row) =>
    matchesCharacter(row, characterId)
  )
  assert.equal(rows.length, 1)
  return rows[0]!
}

function withoutMetadata(row: Record<string, unknown>) {
  const { _id: _ignoredId, _creationTime: _ignoredCreationTime, ...stored } = row
  return stored
}
