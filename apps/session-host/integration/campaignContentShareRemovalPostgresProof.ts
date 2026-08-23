import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import {
  checksumCharacterMechanicsCommandLane,
  checksumCharacterMechanicsProjection,
  createAuthoredVersionRepository,
  createCampaignCharacterMechanicsProjectionRepository,
  createCampaignContentShareRepository,
  createCampaignRepository,
  createCharacterMechanicsProjectionRepository,
  createCharacterRepository,
  createDb,
  srdBaselineContent,
  withTransaction,
  type DBLike
} from '@artificer-toolkit/db'
import {
  activateAuthoredDomainDraft,
  activateAuthoredDomainInput,
  authoredDomainConfigs,
  createCampaignVehicle,
  deleteAuthoredDomainActive,
  getCharacterSheetBundleForUser,
  leaveCampaign,
  listCampaignContentShares,
  removeCampaignMember,
  saveAuthoredDomainInputDraft,
  shareCampaignContent,
  unshareCampaignContent
} from '@artificer-toolkit/functions/services'
import type { AuthoredDomainRuntimeConfig } from '@artificer-toolkit/functions/services'
import type { CharacterMechanicsProjection } from '@artificer-toolkit/schema/projections/characterMechanics'
import { backgroundAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/background'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import { vehicleAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/vehicle'
import { SUBJECT } from '@artificer-toolkit/shared/core'
import { sql } from 'kysely'

import { prepareCampaignCharacterMechanicsProjection } from '../../../packages/functions/src/services/campaign/campaignCharacterMechanicsProjection.js'
import { resolveCharacterLiveSessionRuleContext } from '../../../packages/functions/src/services/character/campaignCharacterSheet.js'
import { advanceCharacterMechanicsProjectionCommandState } from '../../../packages/functions/src/services/character/characterMechanicsCompiler.js'

const OPERATION_TIMEOUT_MS = 10_000
const CONTENTION_TIMEOUT_MS = 5_000
const EVENT_FAILURE_MESSAGE = 'campaign-content-removal-proof-event-failure'
const ACTIVATION_EVENT_FAILURE_MESSAGE = 'authored-campaign-activation-proof-event-failure'

export type CampaignContentShareRemovalProofGroup =
  | 'activation'
  | 'deletion'
  | 'membership'
  | 'unshare'
  | 'vehicle'

export interface CampaignContentShareRemovalCharacter {
  characterId: string
  classId: string
  userId: string
}

export interface CampaignContentShareRemovalProofOptions {
  authorUserId: string
  campaignId: string
  character?: CampaignContentShareRemovalCharacter
  connectionString: string
  gmUserId: string
  group: CampaignContentShareRemovalProofGroup
  onInventoryRowCreated(
    table:
      | 'campaign_vehicles'
      | 'inventory_currency_balances'
      | 'inventory_currency_groups'
      | 'inventory_items'
      | 'inventory_owners',
    id: string
  ): void
  onRootCreated(subjectKind: 'BACKGROUND' | 'SPELL' | 'VEHICLE', subjectId: string): void
  otherAuthorUserId?: string
  readerUserId?: string
  systemId: string
}

interface OwnedSource {
  checksum: string
  id: string
  subjectKind: 'BACKGROUND' | 'SPELL' | 'VEHICLE'
  version: number
  versionId: string
}

interface CharacterStateSnapshot {
  base: unknown
  campaignEvents: unknown
  character: unknown
  characterEvents: unknown
  classSpells: unknown
  draft: unknown
  overlay: unknown
  share: unknown
}

function taggedConnectionString(connectionString: string, label: string): string {
  const url = new URL(connectionString)
  url.searchParams.set('application_name', `artificer-removal-proof-${label}`)
  return url.toString()
}

function createTaggedDb(connectionString: string, label: string) {
  return createDb({ connectionString: taggedConnectionString(connectionString, label) })
}

function deleteAuthoredDomainActiveAsUser(
  db: DBLike,
  config: AuthoredDomainRuntimeConfig,
  id: string,
  userId: string
) {
  return withTransaction(db, async (trx) => {
    await sql`select set_config('request.jwt.claim.sub', ${userId}, true)`.execute(trx)
    return deleteAuthoredDomainActive(trx, config, id, userId)
  })
}

async function withTimeout<T>(label: string, promise: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`${label} exceeded ${OPERATION_TIMEOUT_MS} ms.`)),
          OPERATION_TIMEOUT_MS
        )
      })
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function waitForBlockedActivity(
  observer: DBLike,
  label: string,
  queryFragment: string
): Promise<void> {
  const applicationName = `artificer-removal-proof-${label}`
  const deadline = Date.now() + CONTENTION_TIMEOUT_MS
  while (Date.now() < deadline) {
    const result = await sql<{ blocked: boolean }>`
      select exists (
        select 1
        from pg_stat_activity
        where datname = current_database()
          and application_name = ${applicationName}
          and wait_event_type = 'Lock'
          and query ilike ${`%${queryFragment}%`}
      ) as blocked
    `.execute(observer)
    if (result.rows[0]?.blocked) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  assert.fail(`${label} did not block on ${queryFragment} within ${CONTENTION_TIMEOUT_MS} ms.`)
}

async function campaignVersion(db: DBLike, campaignId: string): Promise<number> {
  const result = await sql<{ version: number }>`
    select version from public.campaigns where id = ${campaignId}::uuid
  `.execute(db)
  const version = result.rows[0]?.version
  assert.notEqual(version, undefined)
  return version as number
}

async function characterRow(db: DBLike, characterId: string) {
  const row = await createCharacterRepository(db).findById(characterId)
  assert.ok(row)
  return row
}

async function activeSource(
  db: DBLike,
  subjectKind: OwnedSource['subjectKind'],
  subjectId: string
): Promise<OwnedSource> {
  const record = await createAuthoredVersionRepository(db).findActive({ subjectKind, subjectId })
  assert.ok(record)
  return {
    checksum: record.authored.checksum,
    id: subjectId,
    subjectKind,
    version: record.authored.version,
    versionId: record.authored.versionId
  }
}

async function createOwnedSpell(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions,
  ownerUserId: string,
  label: string
): Promise<OwnedSource> {
  assert.ok(options.character)
  const template = await sql<{ id: string }>`
    select spell.id
    from public.spells spell
    join public.spell_catalog_classes spell_class
      on spell_class.spell_id = spell.id
     and spell_class.authored_version_id = spell.active_version_id
    join public.spell_catalog_index_versions marker
      on marker.spell_id = spell.id
     and marker.authored_version_id = spell.active_version_id
    where spell_class.class_id = ${options.character.classId}::uuid
      and spell.level > 0
    order by spell.id
    limit 1
  `.execute(db)
  const templateId = template.rows[0]?.id
  assert.ok(templateId, `Class "${options.character.classId}" has no eligible Spell template.`)
  const templateRecord = await createAuthoredVersionRepository(db).findActive({
    subjectKind: 'SPELL',
    subjectId: templateId
  })
  assert.ok(templateRecord)
  const source = spellAuthoredDtoSchema.parse(templateRecord.authored.document)
  const id = randomUUID()
  options.onRootCreated('SPELL', id)
  await activateAuthoredDomainInput(
    db,
    authoredDomainConfigs.spells,
    spellAuthoredDtoSchema.parse({
      ...source,
      id,
      label: `Removal proof ${label} ${id}`,
      systemId: options.systemId,
      userId: ownerUserId
    }),
    ownerUserId
  )
  return activeSource(db, 'SPELL', id)
}

async function createOwnedBackground(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions,
  label: string
): Promise<OwnedSource> {
  const source = srdBaselineContent.subjects.backgrounds[0]
  assert.ok(source, 'The seeded corpus must contain a Background.')
  const id = randomUUID()
  options.onRootCreated('BACKGROUND', id)
  await activateAuthoredDomainInput(
    db,
    authoredDomainConfigs.backgrounds,
    backgroundAuthoredDtoSchema.parse({
      ...source,
      id,
      label: `Removal proof ${label} ${id}`,
      systemId: options.systemId,
      userId: options.authorUserId
    }),
    options.authorUserId
  )
  return activeSource(db, 'BACKGROUND', id)
}

async function createOwnedVehicleDefinition(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions
): Promise<OwnedSource> {
  const source = srdBaselineContent.subjects.vehicles[0]
  assert.ok(source, 'The seeded corpus must contain a Vehicle.')
  const id = randomUUID()
  options.onRootCreated('VEHICLE', id)
  await activateAuthoredDomainInput(
    db,
    authoredDomainConfigs.vehicles,
    vehicleAuthoredDtoSchema.parse({
      ...source,
      id,
      label: `Removal proof Vehicle ${id}`,
      systemId: options.systemId,
      userId: options.authorUserId
    }),
    options.authorUserId
  )
  return activeSource(db, 'VEHICLE', id)
}

async function shareSource(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions,
  source: OwnedSource,
  ownerUserId = options.authorUserId
): Promise<void> {
  await shareCampaignContent(db, ownerUserId, {
    campaignId: options.campaignId,
    subjectKind: source.subjectKind,
    subjectId: source.id
  })
}

async function setPreparedSpellFixture(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions,
  spellId: string,
  selected: boolean
): Promise<number> {
  const target = options.character
  assert.ok(target)
  const row = await characterRow(db, target.characterId)
  const mechanicsRepository = createCharacterMechanicsProjectionRepository(db)
  const mechanics = await mechanicsRepository.requireCurrent({
    characterId: target.characterId,
    expectedRuleRevisionId: row.rule_pack_revision_id as string,
    expectedStreamVersion: row.stream_version
  })
  const source = selected ? await activeSource(db, 'SPELL', spellId) : null
  const nextCharacter = structuredClone(mechanics.commandState)
  const classes = [...(nextCharacter.state.classes ?? [])]
  let classState = classes.find((entry) => entry.classId === target.classId)
  if (!classState) {
    classState = { classId: target.classId }
    classes.push(classState)
  }
  classState.spells = {
    ...(classState.spells?.learned ? { learned: [...classState.spells.learned] } : {}),
    prepared: selected ? [spellId] : []
  }
  nextCharacter.state.classes = classes
  const advanced = advanceCharacterMechanicsProjectionCommandState({
    current: mechanics,
    characterCommandState: nextCharacter,
    characterStreamVersion: row.stream_version + 1
  })
  const vectorByRoot = new Map(
    advanced.authoredVersionVector
      .filter(
        (entry) => selected || !(entry.subjectKind === SUBJECT.SPELL && entry.subjectId === spellId)
      )
      .map((entry) => [`${entry.subjectKind}:${entry.subjectId}`, entry])
  )
  if (source) {
    vectorByRoot.set(`SPELL:${spellId}`, {
      subjectKind: 'SPELL',
      subjectId: spellId,
      versionId: source.versionId,
      version: source.version,
      checksum: source.checksum
    })
  }
  const projection: CharacterMechanicsProjection = {
    ...advanced,
    authoredVersionVector: [...vectorByRoot.values()].sort((left, right) =>
      `${left.subjectKind}:${left.subjectId}`.localeCompare(
        `${right.subjectKind}:${right.subjectId}`
      )
    ),
    commandLaneChecksum: '0'.repeat(64),
    projectionChecksum: '0'.repeat(64)
  }
  projection.commandLaneChecksum = checksumCharacterMechanicsCommandLane(projection)
  projection.projectionChecksum = checksumCharacterMechanicsProjection(projection)
  const overlays = createCampaignCharacterMechanicsProjectionRepository(db)
  const priorOverlayChecksum = await overlays.findCurrentChecksum({
    campaignId: options.campaignId,
    characterId: target.characterId
  })
  let lockedCampaign: Awaited<
    ReturnType<ReturnType<typeof createCampaignRepository>['lockCampaign']>
  >
  const streamVersion = await createCharacterRepository(db).patchSheetState(
    target.characterId,
    [{ kind: 'CLASS_SPELLS', value: nextCharacter.state.classes }],
    {
      expectedStreamVersion: row.stream_version,
      beforeCharacterLock: async (trx) => {
        lockedCampaign = await createCampaignRepository(trx).lockCampaign(options.campaignId)
        assert.ok(lockedCampaign)
        await createCampaignCharacterMechanicsProjectionRepository(trx).lockAssignment({
          campaignId: options.campaignId,
          characterId: target.characterId
        })
      },
      afterPersist: async (trx, persistedStreamVersion) => {
        assert.equal(persistedStreamVersion, projection.characterStreamVersion)
        await createCharacterMechanicsProjectionRepository(trx).publish(projection)
        assert.ok(lockedCampaign)
        const context = await resolveCharacterLiveSessionRuleContext(
          trx,
          target.characterId,
          lockedCampaign
        )
        assert.ok(context)
        const overlay = await prepareCampaignCharacterMechanicsProjection({
          db: trx,
          campaignId: options.campaignId,
          character: nextCharacter,
          characterStreamVersion: persistedStreamVersion,
          mechanics: projection,
          campaignAdjustments: context.adjustments,
          attunementSlotOverride: context.attunementSlotOverride
        })
        await createCampaignCharacterMechanicsProjectionRepository(trx).publish({
          expectedPriorOverlayChecksum: priorOverlayChecksum,
          projection: overlay
        })
      }
    }
  )
  assert.equal(streamVersion, projection.characterStreamVersion)
  assert.equal(
    projection.authoredVersionVector.some(
      (entry) => entry.subjectKind === SUBJECT.SPELL && entry.subjectId === spellId
    ),
    selected
  )
  await assertCurrentCharacter(db, options)
  return streamVersion
}

async function attachPreparedSpell(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions,
  spellId: string
): Promise<number> {
  return setPreparedSpellFixture(db, options, spellId, true)
}

async function detachPreparedSpell(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions,
  spellId: string
): Promise<number> {
  return setPreparedSpellFixture(db, options, spellId, false)
}

async function attachBackground(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions,
  backgroundId: string
): Promise<number> {
  const target = options.character
  assert.ok(target)
  const row = await characterRow(db, target.characterId)
  const mechanics = await createCharacterMechanicsProjectionRepository(db).requireCurrent({
    characterId: target.characterId,
    expectedRuleRevisionId: row.rule_pack_revision_id as string,
    expectedStreamVersion: row.stream_version
  })
  const source = await activeSource(db, 'BACKGROUND', backgroundId)
  const nextCharacter = structuredClone(mechanics.commandState)
  nextCharacter.intent.background.backgroundId = backgroundId
  const advanced = advanceCharacterMechanicsProjectionCommandState({
    current: mechanics,
    characterCommandState: nextCharacter,
    characterStreamVersion: row.stream_version + 1
  })
  const vectorByRoot = new Map(
    advanced.authoredVersionVector
      .filter((entry) => entry.subjectKind !== SUBJECT.BACKGROUND)
      .map((entry) => [`${entry.subjectKind}:${entry.subjectId}`, entry])
  )
  vectorByRoot.set(`BACKGROUND:${backgroundId}`, {
    subjectKind: 'BACKGROUND',
    subjectId: backgroundId,
    versionId: source.versionId,
    version: source.version,
    checksum: source.checksum
  })
  const projection: CharacterMechanicsProjection = {
    ...advanced,
    authoredVersionVector: [...vectorByRoot.values()].sort((left, right) =>
      `${left.subjectKind}:${left.subjectId}`.localeCompare(
        `${right.subjectKind}:${right.subjectId}`
      )
    ),
    commandLaneChecksum: '0'.repeat(64),
    projectionChecksum: '0'.repeat(64)
  }
  projection.commandLaneChecksum = checksumCharacterMechanicsCommandLane(projection)
  projection.projectionChecksum = checksumCharacterMechanicsProjection(projection)
  const overlays = createCampaignCharacterMechanicsProjectionRepository(db)
  const priorOverlayChecksum = await overlays.findCurrentChecksum({
    campaignId: options.campaignId,
    characterId: target.characterId
  })
  const streamVersion = await db.transaction().execute(async (trx) => {
    const lockedCampaign = await createCampaignRepository(trx).lockCampaign(options.campaignId)
    assert.ok(lockedCampaign)
    await createCampaignCharacterMechanicsProjectionRepository(trx).lockAssignment({
      campaignId: options.campaignId,
      characterId: target.characterId
    })
    return createCharacterRepository(trx).upsertAuthored(nextCharacter, {
      expectedStreamVersion: row.stream_version,
      incrementStreamVersion: true,
      rulePackRevisionId: row.rule_pack_revision_id,
      afterPersist: async (persistDb, persistedStreamVersion) => {
        assert.equal(persistedStreamVersion, projection.characterStreamVersion)
        await createCharacterMechanicsProjectionRepository(persistDb).publish(projection)
        const context = await resolveCharacterLiveSessionRuleContext(
          persistDb,
          target.characterId,
          lockedCampaign
        )
        assert.ok(context)
        const overlay = await prepareCampaignCharacterMechanicsProjection({
          db: persistDb,
          campaignId: options.campaignId,
          character: nextCharacter,
          characterStreamVersion: persistedStreamVersion,
          mechanics: projection,
          campaignAdjustments: context.adjustments,
          attunementSlotOverride: context.attunementSlotOverride
        })
        await createCampaignCharacterMechanicsProjectionRepository(persistDb).publish({
          expectedPriorOverlayChecksum: priorOverlayChecksum,
          projection: overlay
        })
      }
    })
  })
  assert.equal(streamVersion, projection.characterStreamVersion)
  await assertCurrentCharacter(db, options)
  return streamVersion
}

async function readCharacterState(
  db: DBLike,
  campaignId: string,
  characterId: string,
  subjectKind: string,
  subjectId: string
): Promise<CharacterStateSnapshot> {
  const result = await sql<CharacterStateSnapshot>`
    select
      (select to_jsonb(row) from (select * from public.characters where id = ${characterId}::uuid) row) as character,
      (select coalesce(jsonb_agg(to_jsonb(row) order by row.class_id, row.state, row.spell_id), '[]'::jsonb) from (select * from public.character_class_spells where character_id = ${characterId}::uuid) row) as class_spells,
      (select to_jsonb(row) from (select * from public.character_builder_drafts where character_id = ${characterId}::uuid) row) as draft,
      (select to_jsonb(row) from (select * from public.character_mechanics_projections where character_id = ${characterId}::uuid) row) as base,
      (select to_jsonb(row) from (select * from public.campaign_character_mechanics_projections where campaign_id = ${campaignId}::uuid and character_id = ${characterId}::uuid) row) as overlay,
      (select coalesce(jsonb_agg(to_jsonb(row) order by row.occurred_at, row.event_id), '[]'::jsonb) from (select * from public.character_events where character_id = ${characterId}::uuid) row) as character_events,
      (select coalesce(jsonb_agg(to_jsonb(row) order by row.id), '[]'::jsonb) from (select * from public.campaign_events where campaign_id = ${campaignId}::uuid) row) as campaign_events,
      (select to_jsonb(row) from (select * from public.campaign_content_shares where campaign_id = ${campaignId}::uuid and subject_kind = ${subjectKind} and subject_id = ${subjectId}::uuid) row) as share
  `.execute(db)
  const row = result.rows[0]
  assert.ok(row)
  return row
}

async function assertCurrentCharacter(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions
): Promise<void> {
  const target = options.character
  assert.ok(target)
  const row = await characterRow(db, target.characterId)
  if (row.status !== 'ACTIVE') return
  const base = await createCharacterMechanicsProjectionRepository(db).requireCurrent({
    characterId: target.characterId,
    expectedRuleRevisionId: row.rule_pack_revision_id as string,
    expectedStreamVersion: row.stream_version
  })
  assert.equal(base.characterStreamVersion, row.stream_version)
  assert.ok(await getCharacterSheetBundleForUser(db, target.characterId, target.userId))
}

async function installRemovalEventFailure(trx: DBLike, campaignId: string): Promise<void> {
  await sql`select set_config('artificer.removal_proof_campaign_id', ${campaignId}, true)`.execute(
    trx
  )
  await sql`
    create function pg_temp.raise_campaign_removal_event_failure()
    returns trigger
    language plpgsql
    as $$
    begin
      raise exception 'campaign-content-removal-proof-event-failure';
    end;
    $$
  `.execute(trx)
  await sql`
    create trigger campaign_removal_event_failure
    before insert on public.campaign_events
    for each row
    when (
      new.campaign_id = current_setting('artificer.removal_proof_campaign_id')::uuid
      and new.kind = 'CAMPAIGN_CONTENT_SHARES_REMOVED'
    )
    execute function pg_temp.raise_campaign_removal_event_failure()
  `.execute(trx)
}

async function runSchedule(name: string, operation: () => Promise<void>): Promise<void> {
  try {
    await withTimeout(name, operation())
    console.log(JSON.stringify({ schedule: name, status: 'PASS' }))
  } catch (error) {
    console.error(
      JSON.stringify({
        schedule: name,
        status: 'FAIL',
        error: error instanceof Error ? error.message : String(error)
      })
    )
    throw error
  }
}

async function unshare(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions,
  source: OwnedSource,
  actorUserId = options.gmUserId,
  sharedBy = options.authorUserId,
  expectedCampaignVersion?: number,
  commandId = randomUUID()
) {
  return unshareCampaignContent(db, actorUserId, {
    campaignId: options.campaignId,
    subjectKind: source.subjectKind,
    subjectId: source.id,
    sharedBy,
    expectedCampaignVersion:
      expectedCampaignVersion ?? (await campaignVersion(db, options.campaignId)),
    commandId
  })
}

async function proveActivePrune(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions
): Promise<void> {
  const spell = await createOwnedSpell(db, options, options.authorUserId, 'active-prune')
  await shareSource(db, options, spell)
  const beforeStream = await attachPreparedSpell(db, options, spell.id)
  const receipt = await unshare(db, options, spell)
  const target = options.character
  assert.ok(target)
  const row = await characterRow(db, target.characterId)
  assert.equal(row.status, 'ACTIVE')
  assert.equal(row.stream_version, beforeStream + 1)
  assert.deepEqual(receipt.affectedCharacters, [
    { characterId: target.characterId, status: 'ACTIVE', streamVersion: row.stream_version }
  ])
  const spells = await sql<{ count: number }>`
    select count(*)::int as count
    from public.character_class_spells
    where character_id = ${target.characterId}::uuid and spell_id = ${spell.id}::uuid
  `.execute(db)
  assert.equal(spells.rows[0]?.count, 0)
  await assertCurrentCharacter(db, options)
  assert.ok(
    await createAuthoredVersionRepository(db).findActive({
      subjectKind: 'SPELL',
      subjectId: spell.id
    })
  )
}

async function proveAlternateOwnerAccess(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions
): Promise<void> {
  const target = options.character
  assert.ok(target)
  const spell = await createOwnedSpell(db, options, target.userId, 'alternate-owner')
  await shareSource(db, options, spell, target.userId)
  const beforeStream = await attachPreparedSpell(db, options, spell.id)
  const receipt = await unshare(db, options, spell, options.gmUserId, target.userId)
  const row = await characterRow(db, target.characterId)
  assert.equal(row.stream_version, beforeStream)
  assert.deepEqual(receipt.affectedCharacters, [])
  const spells = await sql<{ count: number }>`
    select count(*)::int as count from public.character_class_spells
    where character_id = ${target.characterId}::uuid and spell_id = ${spell.id}::uuid
  `.execute(db)
  assert.equal(spells.rows[0]?.count, 1)
  await assertCurrentCharacter(db, options)
  await detachPreparedSpell(db, options, spell.id)
}

async function proveLateRollback(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions
): Promise<void> {
  const spell = await createOwnedSpell(db, options, options.authorUserId, 'late-rollback')
  await shareSource(db, options, spell)
  await attachPreparedSpell(db, options, spell.id)
  const target = options.character
  assert.ok(target)
  const before = await readCharacterState(
    db,
    options.campaignId,
    target.characterId,
    spell.subjectKind,
    spell.id
  )
  await assert.rejects(
    db.transaction().execute(async (trx) => {
      await installRemovalEventFailure(trx, options.campaignId)
      await unshare(trx, options, spell)
    }),
    new RegExp(EVENT_FAILURE_MESSAGE)
  )
  const after = await readCharacterState(
    db,
    options.campaignId,
    target.characterId,
    spell.subjectKind,
    spell.id
  )
  assert.deepEqual(after, before)
  await assertCurrentCharacter(db, options)
  await unshare(db, options, spell)
  await assertCurrentCharacter(db, options)
}

async function proveSameVersion(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions
): Promise<void> {
  const spell = await createOwnedSpell(db, options, options.authorUserId, 'same-version')
  await shareSource(db, options, spell)
  const expectedVersion = await campaignVersion(db, options.campaignId)
  const first = createTaggedDb(options.connectionString, 'same-version-first')
  const second = createTaggedDb(options.connectionString, 'same-version-second')
  try {
    const settled = await withTimeout(
      'same-version settlement',
      Promise.allSettled([
        unshare(first, options, spell, options.gmUserId, options.authorUserId, expectedVersion),
        unshare(second, options, spell, options.gmUserId, options.authorUserId, expectedVersion)
      ])
    )
    assert.equal(settled.filter((entry) => entry.status === 'fulfilled').length, 1)
    assert.equal(settled.filter((entry) => entry.status === 'rejected').length, 1)
    assert.equal(await campaignVersion(db, options.campaignId), expectedVersion + 1)
  } finally {
    await Promise.all([first.destroy(), second.destroy()])
  }
}

async function holdShareUse(
  db: ReturnType<typeof createDb>,
  options: CampaignContentShareRemovalProofOptions,
  source: OwnedSource,
  ready: () => void,
  released: Promise<void>
): Promise<void> {
  await db.transaction().execute(async (trx) => {
    const result = await createCampaignContentShareRepository(trx).lockSharesForUse({
      campaignId: options.campaignId,
      shares: [
        {
          subjectKind: source.subjectKind,
          subjectId: source.id,
          sharedBy: options.authorUserId,
          versionId: source.versionId,
          version: source.version,
          checksum: source.checksum
        }
      ]
    })
    assert.deepEqual(result.missing, [])
    ready()
    await released
  })
}

async function proveUseFirst(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions
): Promise<void> {
  const spell = await createOwnedSpell(db, options, options.authorUserId, 'use-first')
  await shareSource(db, options, spell)
  const holder = createTaggedDb(options.connectionString, 'use-first-holder')
  const remover = createTaggedDb(options.connectionString, 'use-first-remover')
  const observer = createTaggedDb(options.connectionString, 'use-first-observer')
  let release: (() => void) | undefined
  let markReady: (() => void) | undefined
  const ready = new Promise<void>((resolve) => {
    markReady = resolve
  })
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  let held: Promise<void> | undefined
  let removal: Promise<unknown> | undefined
  try {
    held = holdShareUse(holder, options, spell, () => markReady?.(), released)
    await withTimeout('use-first lock acquisition', ready)
    removal = unshare(remover, options, spell)
    void removal.catch(() => undefined)
    await waitForBlockedActivity(observer, 'use-first-remover', 'campaigns')
    release?.()
    await withTimeout('use-first settlement', Promise.all([held, removal]))
  } finally {
    release?.()
    await Promise.allSettled(
      [held, removal].filter((value): value is Promise<unknown> => Boolean(value))
    )
    await Promise.all([holder.destroy(), remover.destroy(), observer.destroy()])
  }
}

async function proveUnshareFirst(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions
): Promise<void> {
  const spell = await createOwnedSpell(db, options, options.authorUserId, 'unshare-first')
  await shareSource(db, options, spell)
  const owner = await sql<{ id: string }>`
    select id from public.inventory_owners
    where kind = 'CAMPAIGN' and campaign_id = ${options.campaignId}::uuid
  `.execute(db)
  const ownerId = owner.rows[0]?.id
  assert.ok(ownerId)
  const holder = createTaggedDb(options.connectionString, 'unshare-first-holder')
  const remover = createTaggedDb(options.connectionString, 'unshare-first-remover')
  const user = createTaggedDb(options.connectionString, 'unshare-first-use')
  const observer = createTaggedDb(options.connectionString, 'unshare-first-observer')
  let release: (() => void) | undefined
  let markHeld: (() => void) | undefined
  const heldReady = new Promise<void>((resolve) => {
    markHeld = resolve
  })
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  const ownerHolder = holder.transaction().execute(async (trx) => {
    await sql`select id from public.inventory_owners where id = ${ownerId}::uuid for update`.execute(
      trx
    )
    markHeld?.()
    await released
  })
  let removal: Promise<unknown> | undefined
  let use: Promise<unknown> | undefined
  try {
    await withTimeout('unshare-first owner holder', heldReady)
    removal = unshare(remover, options, spell)
    void removal.catch(() => undefined)
    await waitForBlockedActivity(observer, 'unshare-first-remover', 'inventory_owners')
    use = createCampaignContentShareRepository(user).lockSharesForUse({
      campaignId: options.campaignId,
      shares: [
        {
          subjectKind: 'SPELL',
          subjectId: spell.id,
          sharedBy: options.authorUserId,
          versionId: spell.versionId,
          version: spell.version,
          checksum: spell.checksum
        }
      ]
    })
    void use.catch(() => undefined)
    await waitForBlockedActivity(observer, 'unshare-first-use', 'campaigns')
    release?.()
    const settled = await withTimeout(
      'unshare-first settlement',
      Promise.allSettled([ownerHolder, removal, use])
    )
    assert.equal(settled[0]?.status, 'fulfilled')
    assert.equal(settled[1]?.status, 'fulfilled')
    assert.equal(settled[2]?.status, 'fulfilled')
    const useResult = settled[2]
    if (useResult?.status === 'fulfilled') {
      const value = useResult.value as Awaited<
        ReturnType<ReturnType<typeof createCampaignContentShareRepository>['lockSharesForUse']>
      >
      assert.equal(value.missing.length, 1)
    }
  } finally {
    release?.()
    await Promise.allSettled(
      [ownerHolder, removal, use].filter((value): value is Promise<unknown> => Boolean(value))
    )
    await Promise.all([holder.destroy(), remover.destroy(), user.destroy(), observer.destroy()])
  }
}

async function prepareStructuralDraft(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions
): Promise<{ background: OwnedSource; beforeStream: number }> {
  const background = await createOwnedBackground(db, options, 'structural-draft')
  await shareSource(db, options, background)
  const beforeStream = await attachBackground(db, options, background.id)
  return { background, beforeStream }
}

async function proveStructuralDraft(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions,
  fixture: Awaited<ReturnType<typeof prepareStructuralDraft>>
): Promise<void> {
  const target = options.character
  assert.ok(target)
  const receipt = await unshare(db, options, fixture.background)
  const row = await characterRow(db, target.characterId)
  assert.equal(row.status, 'DRAFT')
  assert.equal(row.stream_version, fixture.beforeStream + 1)
  assert.deepEqual(receipt.affectedCharacters, [
    { characterId: target.characterId, status: 'DRAFT', streamVersion: row.stream_version }
  ])
  const base = await sql<{ count: number }>`
    select count(*)::int as count from public.character_mechanics_projections
    where character_id = ${target.characterId}::uuid
  `.execute(db)
  assert.equal(base.rows[0]?.count, 0)
  const overlay = await sql<{ count: number }>`
    select count(*)::int as count from public.campaign_character_mechanics_projections
    where campaign_id = ${options.campaignId}::uuid and character_id = ${target.characterId}::uuid
  `.execute(db)
  assert.equal(overlay.rows[0]?.count, 0)
}

async function proveUnshareResult(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions
): Promise<void> {
  assert.ok(options.character)
  await runSchedule('active-spell-prune', () => proveActivePrune(db, options))
  await runSchedule('alternate-owner-access', () => proveAlternateOwnerAccess(db, options))
  await runSchedule('late-rollback', () => proveLateRollback(db, options))
  await runSchedule('same-version', () => proveSameVersion(db, options))
  await runSchedule('use-first-unshare', () => proveUseFirst(db, options))
  await runSchedule('unshare-first-use', () => proveUnshareFirst(db, options))
  const structural = await prepareStructuralDraft(db, options)
  await runSchedule('structural-loss-draft', () => proveStructuralDraft(db, options, structural))
}

async function membershipState(
  db: DBLike,
  campaignId: string,
  userId: string
): Promise<{ accessStartedAt: string; status: string; version: number }> {
  const result = await sql<{ accessStartedAt: string; status: string; version: number }>`
    select
      member.access_started_at::text as "accessStartedAt",
      member.status,
      campaign.version
    from public.campaigns campaign
    join public.campaign_memberships member on member.campaign_id = campaign.id
    where campaign.id = ${campaignId}::uuid and member.user_id = ${userId}::uuid
  `.execute(db)
  const row = result.rows[0]
  assert.ok(row)
  return row
}

async function proveAuthorLeavesWithAllShares(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions
): Promise<void> {
  const target = options.character
  assert.ok(target)
  const spell = await createOwnedSpell(db, options, options.authorUserId, 'member-exit-spell')
  const background = await createOwnedBackground(db, options, 'member-exit-background')
  await shareSource(db, options, spell)
  await shareSource(db, options, background)
  await attachPreparedSpell(db, options, spell.id)
  await attachBackground(db, options, background.id)
  const before = await membershipState(db, options.campaignId, options.authorUserId)

  await leaveCampaign(
    db,
    options.authorUserId,
    options.campaignId,
    before.version,
    before.accessStartedAt,
    randomUUID()
  )

  const after = await membershipState(db, options.campaignId, options.authorUserId)
  assert.equal(after.status, 'LEFT')
  assert.equal(after.version, before.version + 1)
  const remaining = await sql<{ count: number }>`
    select count(*)::int as count from public.campaign_content_shares
    where campaign_id = ${options.campaignId}::uuid and shared_by = ${options.authorUserId}::uuid
  `.execute(db)
  assert.equal(remaining.rows[0]?.count, 0)
  const character = await createCharacterRepository(db).findAuthoredById(target.characterId)
  assert.ok(character)
  assert.equal(character.status, 'DRAFT')
  assert.equal(character.intent.background.backgroundId, '')
  assert.equal(
    character.state.classes?.some(
      (entry) =>
        entry.spells?.learned?.includes(spell.id) || entry.spells?.prepared?.includes(spell.id)
    ) ?? false,
    false
  )
  assert.ok(
    await createAuthoredVersionRepository(db).findActive({
      subjectKind: 'SPELL',
      subjectId: spell.id
    })
  )
  assert.ok(
    await createAuthoredVersionRepository(db).findActive({
      subjectKind: 'BACKGROUND',
      subjectId: background.id
    })
  )
}

async function removeMember(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions,
  userId: string
) {
  const state = await membershipState(db, options.campaignId, userId)
  return removeCampaignMember(
    db,
    options.gmUserId,
    options.campaignId,
    userId,
    state.version,
    state.accessStartedAt,
    randomUUID()
  )
}

async function proveListFirstMemberRemoval(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions,
  source: OwnedSource
): Promise<void> {
  const readerUserId = options.readerUserId
  assert.ok(readerUserId)
  const lister = createTaggedDb(options.connectionString, 'member-list-first')
  const remover = createTaggedDb(options.connectionString, 'member-remove-after-list')
  const observer = createTaggedDb(options.connectionString, 'member-list-observer')
  let release: (() => void) | undefined
  let ready: (() => void) | undefined
  const listed = new Promise<void>((resolve) => {
    ready = resolve
  })
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  let listOperation: Promise<unknown> | undefined
  let removal: Promise<unknown> | undefined
  try {
    listOperation = lister.transaction().execute(async (trx) => {
      const rows = await listCampaignContentShares(trx, readerUserId, options.campaignId)
      assert.equal(
        rows.some((row) => row.subjectId === source.id),
        true
      )
      ready?.()
      await released
    })
    await withTimeout('list-first membership list', listed)
    removal = removeMember(remover, options, readerUserId)
    void removal.catch(() => undefined)
    await waitForBlockedActivity(observer, 'member-remove-after-list', 'campaigns')
    release?.()
    await withTimeout('list-first membership settlement', Promise.all([listOperation, removal]))
    await assert.rejects(listCampaignContentShares(db, readerUserId, options.campaignId))
  } finally {
    release?.()
    await Promise.allSettled(
      [listOperation, removal].filter((value): value is Promise<unknown> => Boolean(value))
    )
    await Promise.all([lister.destroy(), remover.destroy(), observer.destroy()])
  }
}

async function proveRemovalFirstList(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions,
  source: OwnedSource
): Promise<void> {
  const readerUserId = options.readerUserId
  assert.ok(readerUserId)
  const owner = await sql<{ id: string }>`
    select id from public.inventory_owners
    where kind = 'CAMPAIGN' and campaign_id = ${options.campaignId}::uuid
  `.execute(db)
  const ownerId = owner.rows[0]?.id
  assert.ok(ownerId)
  const holder = createTaggedDb(options.connectionString, 'member-remove-first-holder')
  const remover = createTaggedDb(options.connectionString, 'member-remove-first')
  const lister = createTaggedDb(options.connectionString, 'member-list-after-remove')
  const observer = createTaggedDb(options.connectionString, 'member-remove-first-observer')
  let release: (() => void) | undefined
  let ready: (() => void) | undefined
  const held = new Promise<void>((resolve) => {
    ready = resolve
  })
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  const ownerHolder = holder.transaction().execute(async (trx) => {
    await sql`select id from public.inventory_owners where id = ${ownerId}::uuid for update`.execute(
      trx
    )
    ready?.()
    await released
  })
  let removal: Promise<unknown> | undefined
  let listOperation: Promise<unknown> | undefined
  try {
    await withTimeout('removal-first inventory holder', held)
    removal = removeMember(remover, options, readerUserId)
    void removal.catch(() => undefined)
    await waitForBlockedActivity(observer, 'member-remove-first', 'inventory_owners')
    listOperation = listCampaignContentShares(lister, readerUserId, options.campaignId)
    void listOperation.catch(() => undefined)
    await waitForBlockedActivity(observer, 'member-list-after-remove', 'campaigns')
    release?.()
    await withTimeout('removal-first member removal', removal)
    await assert.rejects(withTimeout('removal-first list rejection', listOperation))
    const share = await createCampaignContentShareRepository(db).findShare({
      campaignId: options.campaignId,
      subjectKind: source.subjectKind,
      subjectId: source.id
    })
    assert.equal(share, null)
  } finally {
    release?.()
    await Promise.allSettled(
      [ownerHolder, removal, listOperation].filter((value): value is Promise<unknown> =>
        Boolean(value)
      )
    )
    await Promise.all([holder.destroy(), remover.destroy(), lister.destroy(), observer.destroy()])
  }
}

async function proveMembershipResult(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions
): Promise<void> {
  assert.ok(options.character)
  const readerUserId = options.readerUserId
  assert.ok(readerUserId)
  await runSchedule('author-leave-multi-share', () => proveAuthorLeavesWithAllShares(db, options))

  const listFirstSource = await createOwnedSpell(db, options, readerUserId, 'list-first-member')
  await shareSource(db, options, listFirstSource, readerUserId)
  await runSchedule('list-first-member-removal', () =>
    proveListFirstMemberRemoval(db, options, listFirstSource)
  )

  await createCampaignRepository(db).activatePlayerMembership(
    options.campaignId,
    readerUserId,
    new Date().toISOString()
  )
  const removalFirstSource = await createOwnedSpell(
    db,
    options,
    readerUserId,
    'remove-first-member'
  )
  await shareSource(db, options, removalFirstSource, readerUserId)
  await runSchedule('member-removal-first-list', () =>
    proveRemovalFirstList(db, options, removalFirstSource)
  )
}

interface VehicleFixture {
  campaignOwnerId: string
  childItemId: string
  destinationUngroupedBalanceId: string
  explicitBalanceId: string
  explicitGroupId: string
  rulesetCurrencyId: string
  sourceOwnerId: string
  sourceUngroupedBalanceId: string
  topItemId: string
  vehicleId: string
}

async function createVehicleInventoryFixture(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions,
  source: OwnedSource
): Promise<VehicleFixture> {
  const vehicle = await createCampaignVehicle(db, options.gmUserId, {
    campaignId: options.campaignId,
    vehicleDefinitionId: source.id,
    label: 'Evacuation target'
  })
  const owners = await sql<{ campaignOwnerId: string; sourceOwnerId: string }>`
    select
      (select id from public.inventory_owners where kind = 'CAMPAIGN' and campaign_id = ${options.campaignId}::uuid) as "campaignOwnerId",
      (select id from public.inventory_owners where kind = 'VEHICLE' and vehicle_id = ${vehicle.id}::uuid) as "sourceOwnerId"
  `.execute(db)
  const owner = owners.rows[0]
  assert.ok(owner?.campaignOwnerId)
  assert.ok(owner.sourceOwnerId)
  const equipmentId = srdBaselineContent.subjects.equipment[0]?.id
  assert.ok(equipmentId)
  const currency = await sql<{ id: string }>`
    select id from public.currencies where system_id = ${options.systemId}::uuid order by id limit 1
  `.execute(db)
  const rulesetCurrencyId = currency.rows[0]?.id
  assert.ok(rulesetCurrencyId)
  const fixture: VehicleFixture = {
    campaignOwnerId: owner.campaignOwnerId,
    childItemId: randomUUID(),
    destinationUngroupedBalanceId: randomUUID(),
    explicitBalanceId: randomUUID(),
    explicitGroupId: randomUUID(),
    rulesetCurrencyId,
    sourceOwnerId: owner.sourceOwnerId,
    sourceUngroupedBalanceId: randomUUID(),
    topItemId: randomUUID(),
    vehicleId: vehicle.id
  }
  options.onInventoryRowCreated('campaign_vehicles', fixture.vehicleId)
  options.onInventoryRowCreated('inventory_owners', fixture.campaignOwnerId)
  options.onInventoryRowCreated('inventory_owners', fixture.sourceOwnerId)
  options.onInventoryRowCreated('inventory_items', fixture.topItemId)
  options.onInventoryRowCreated('inventory_items', fixture.childItemId)
  options.onInventoryRowCreated('inventory_currency_groups', fixture.explicitGroupId)
  options.onInventoryRowCreated(
    'inventory_currency_balances',
    fixture.destinationUngroupedBalanceId
  )
  options.onInventoryRowCreated('inventory_currency_balances', fixture.sourceUngroupedBalanceId)
  options.onInventoryRowCreated('inventory_currency_balances', fixture.explicitBalanceId)
  await sql`
    insert into public.inventory_items
      (id, owner_id, equipment_id, quantity, custom_name, notes, equipped, attuned, placement_kind, placement_id)
    values
      (${fixture.topItemId}::uuid, ${fixture.sourceOwnerId}::uuid, ${equipmentId}::uuid, 2,
       'Evacuation chest', 'Preserve metadata', true, true, 'VEHICLE', ${fixture.vehicleId}::uuid),
      (${fixture.childItemId}::uuid, ${fixture.sourceOwnerId}::uuid, ${equipmentId}::uuid, 3,
       'Nested cargo', 'Preserve nesting', false, false, null, null)
  `.execute(db)
  await sql`
    update public.inventory_items set container_id = ${fixture.topItemId}::uuid
    where id = ${fixture.childItemId}::uuid
  `.execute(db)
  await sql`
    insert into public.inventory_currency_groups (id, owner_id, container_item_id)
    values (${fixture.explicitGroupId}::uuid, ${fixture.sourceOwnerId}::uuid, ${fixture.topItemId}::uuid)
  `.execute(db)
  await sql`
    insert into public.inventory_currency_balances
      (id, owner_id, group_id, ruleset_currency_id, amount)
    values
      (${fixture.destinationUngroupedBalanceId}::uuid, ${fixture.campaignOwnerId}::uuid, null, ${fixture.rulesetCurrencyId}::uuid, 10),
      (${fixture.sourceUngroupedBalanceId}::uuid, ${fixture.sourceOwnerId}::uuid, null, ${fixture.rulesetCurrencyId}::uuid, 5),
      (${fixture.explicitBalanceId}::uuid, ${fixture.sourceOwnerId}::uuid, ${fixture.explicitGroupId}::uuid, ${fixture.rulesetCurrencyId}::uuid, 7)
  `.execute(db)
  return fixture
}

async function vehicleState(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions,
  fixture: VehicleFixture
) {
  const result = await sql<{
    balances: unknown
    campaign: unknown
    events: unknown
    groups: unknown
    items: unknown
    owners: unknown
    shares: unknown
    vehicles: unknown
  }>`
    select
      (select to_jsonb(row) from (select * from public.campaigns where id = ${options.campaignId}::uuid) row) as campaign,
      (select coalesce(jsonb_agg(to_jsonb(row) order by row.subject_kind, row.subject_id), '[]'::jsonb) from (select * from public.campaign_content_shares where campaign_id = ${options.campaignId}::uuid) row) as shares,
      (select coalesce(jsonb_agg(to_jsonb(row) order by row.id), '[]'::jsonb) from (select * from public.campaign_vehicles where id = ${fixture.vehicleId}::uuid) row) as vehicles,
      (select coalesce(jsonb_agg(to_jsonb(row) order by row.id), '[]'::jsonb) from (select * from public.inventory_owners where id in (${fixture.campaignOwnerId}::uuid, ${fixture.sourceOwnerId}::uuid)) row) as owners,
      (select coalesce(jsonb_agg(to_jsonb(row) order by row.id), '[]'::jsonb) from (select * from public.inventory_items where id in (${fixture.topItemId}::uuid, ${fixture.childItemId}::uuid)) row) as items,
      (select coalesce(jsonb_agg(to_jsonb(row) order by row.id), '[]'::jsonb) from (select * from public.inventory_currency_groups where id = ${fixture.explicitGroupId}::uuid) row) as groups,
      (select coalesce(jsonb_agg(to_jsonb(row) order by row.id), '[]'::jsonb) from (select * from public.inventory_currency_balances where id in (${fixture.destinationUngroupedBalanceId}::uuid, ${fixture.sourceUngroupedBalanceId}::uuid, ${fixture.explicitBalanceId}::uuid)) row) as balances,
      (select coalesce(jsonb_agg(to_jsonb(row) order by row.id), '[]'::jsonb) from (select * from public.campaign_events where campaign_id = ${options.campaignId}::uuid) row) as events
  `.execute(db)
  const row = result.rows[0]
  assert.ok(row)
  return row
}

async function proveVehicleResult(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions
): Promise<void> {
  const source = await createOwnedVehicleDefinition(db, options)
  await shareSource(db, options, source)
  const fixture = await createVehicleInventoryFixture(db, options, source)
  const before = await vehicleState(db, options, fixture)
  await runSchedule('vehicle-evacuation-late-rollback', async () => {
    await assert.rejects(
      db.transaction().execute(async (trx) => {
        await installRemovalEventFailure(trx, options.campaignId)
        await unshare(trx, options, source)
      }),
      new RegExp(EVENT_FAILURE_MESSAGE)
    )
    assert.deepEqual(await vehicleState(db, options, fixture), before)
  })

  await runSchedule('vehicle-lossless-evacuation', async () => {
    const receipt = await unshare(db, options, source)
    assert.deepEqual(receipt.evacuatedVehicles, [
      {
        vehicleId: fixture.vehicleId,
        vehicleDefinitionId: source.id,
        transferredTopLevelItemIds: [fixture.topItemId],
        transferredCurrencyGroupIds: [fixture.explicitGroupId]
      }
    ])
    const itemRows = await sql<{
      attuned: boolean
      containerId: string | null
      customName: string | null
      equipped: boolean
      id: string
      notes: string | null
      ownerId: string
      placementId: string | null
      placementKind: string | null
      quantity: number
    }>`
      select id, owner_id as "ownerId", container_id as "containerId", quantity,
        custom_name as "customName", notes, equipped, attuned,
        placement_kind as "placementKind", placement_id as "placementId"
      from public.inventory_items
      where id in (${fixture.topItemId}::uuid, ${fixture.childItemId}::uuid)
      order by id
    `.execute(db)
    assert.equal(itemRows.rows.length, 2)
    const top = itemRows.rows.find((row) => row.id === fixture.topItemId)
    const child = itemRows.rows.find((row) => row.id === fixture.childItemId)
    assert.deepEqual(top, {
      id: fixture.topItemId,
      ownerId: fixture.campaignOwnerId,
      containerId: null,
      quantity: 2,
      customName: 'Evacuation chest',
      notes: 'Preserve metadata',
      equipped: true,
      attuned: true,
      placementKind: null,
      placementId: null
    })
    assert.equal(child?.ownerId, fixture.campaignOwnerId)
    assert.equal(child?.containerId, fixture.topItemId)
    const group = await sql<{ containerItemId: string | null; id: string; ownerId: string }>`
      select id, owner_id as "ownerId", container_item_id as "containerItemId"
      from public.inventory_currency_groups where id = ${fixture.explicitGroupId}::uuid
    `.execute(db)
    assert.deepEqual(group.rows[0], {
      id: fixture.explicitGroupId,
      ownerId: fixture.campaignOwnerId,
      containerItemId: fixture.topItemId
    })
    const balances = await sql<{
      amount: string
      groupId: string | null
      id: string
      ownerId: string
    }>`
      select id, owner_id as "ownerId", group_id as "groupId", amount::text as amount
      from public.inventory_currency_balances
      where id in (${fixture.destinationUngroupedBalanceId}::uuid, ${fixture.sourceUngroupedBalanceId}::uuid, ${fixture.explicitBalanceId}::uuid)
      order by id
    `.execute(db)
    assert.equal(
      balances.rows.some((row) => row.id === fixture.sourceUngroupedBalanceId),
      false
    )
    assert.deepEqual(
      balances.rows.find((row) => row.id === fixture.destinationUngroupedBalanceId),
      {
        id: fixture.destinationUngroupedBalanceId,
        ownerId: fixture.campaignOwnerId,
        groupId: null,
        amount: '15'
      }
    )
    assert.deepEqual(
      balances.rows.find((row) => row.id === fixture.explicitBalanceId),
      {
        id: fixture.explicitBalanceId,
        ownerId: fixture.campaignOwnerId,
        groupId: fixture.explicitGroupId,
        amount: '7'
      }
    )
    const removed = await sql<{ ownerCount: number; vehicleCount: number }>`
      select
        (select count(*)::int from public.campaign_vehicles where id = ${fixture.vehicleId}::uuid) as "vehicleCount",
        (select count(*)::int from public.inventory_owners where id = ${fixture.sourceOwnerId}::uuid) as "ownerCount"
    `.execute(db)
    assert.deepEqual(removed.rows[0], { ownerCount: 0, vehicleCount: 0 })
    assert.ok(
      await createAuthoredVersionRepository(db).findActive({
        subjectKind: 'VEHICLE',
        subjectId: source.id
      })
    )
    const audit = await sql<{ id: string; payload: Record<string, unknown> }>`
      select id, payload from public.campaign_events
      where campaign_id = ${options.campaignId}::uuid and kind = 'CAMPAIGN_VEHICLE_EVACUATED'
      order by created_at desc limit 1
    `.execute(db)
    const event = audit.rows[0]
    assert.ok(event)
    assert.equal(event.payload.formerCampaignVehicleId, fixture.vehicleId)
    assert.equal(event.payload.authoredVehicleId, source.id)
    assert.deepEqual(event.payload.transferredTopLevelItemIds, [fixture.topItemId])
    assert.deepEqual(event.payload.transferredCurrencyGroupIds, [fixture.explicitGroupId])
    await sql`
      update public.campaign_events set created_at = now() - interval '181 days'
      where id = ${event.id}::uuid
    `.execute(db)
    await sql`
      insert into public.campaign_events (campaign_id, actor_user_id, kind, visibility, payload)
      values (${options.campaignId}::uuid, ${options.gmUserId}::uuid, 'PARTY_ITEM_ADD', 'OWNER', '{}'::jsonb)
    `.execute(db)
    const retained = await sql<{ count: number }>`
      select count(*)::int as count from public.campaign_events where id = ${event.id}::uuid
    `.execute(db)
    assert.equal(retained.rows[0]?.count, 1)
  })
}

async function nextSpellDocument(db: DBLike, spellId: string, ownerUserId: string, label: string) {
  const current = await createAuthoredVersionRepository(db).findActive({
    subjectKind: 'SPELL',
    subjectId: spellId
  })
  assert.ok(current)
  return spellAuthoredDtoSchema.parse({
    ...spellAuthoredDtoSchema.parse(current.authored.document),
    id: spellId,
    label,
    userId: ownerUserId
  })
}

async function activateNextSpellVersion(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions,
  source: OwnedSource,
  ownerUserId: string,
  label: string
): Promise<OwnedSource> {
  const document = await nextSpellDocument(db, source.id, ownerUserId, label)
  await activateAuthoredDomainInput(db, authoredDomainConfigs.spells, document, ownerUserId)
  const next = await activeSource(db, 'SPELL', source.id)
  assert.equal(next.version, source.version + 1)
  assert.notEqual(next.versionId, source.versionId)
  return next
}

async function assertExactPinnedSpellDependency(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions,
  pinnedSource: OwnedSource,
  expectedStreamVersion: number
): Promise<void> {
  const target = options.character
  assert.ok(target)
  const row = await characterRow(db, target.characterId)
  assert.equal(row.stream_version, expectedStreamVersion)
  const mechanics = await createCharacterMechanicsProjectionRepository(db).requireCurrent({
    characterId: target.characterId,
    expectedRuleRevisionId: row.rule_pack_revision_id as string,
    expectedStreamVersion
  })
  const matches = mechanics.authoredVersionVector.filter(
    (entry) => entry.subjectKind === SUBJECT.SPELL && entry.subjectId === pinnedSource.id
  )
  assert.deepEqual(matches, [
    {
      subjectKind: SUBJECT.SPELL,
      subjectId: pinnedSource.id,
      versionId: pinnedSource.versionId,
      version: pinnedSource.version,
      checksum: pinnedSource.checksum
    }
  ])
  const overlay = await sql<{ baseChecksum: string; streamVersion: number }>`
    select
      stream_version as "streamVersion",
      base_mechanics_projection_checksum as "baseChecksum"
    from public.campaign_character_mechanics_projections
    where campaign_id = ${options.campaignId}::uuid
      and character_id = ${target.characterId}::uuid
  `.execute(db)
  assert.deepEqual(overlay.rows[0], {
    streamVersion: expectedStreamVersion,
    baseChecksum: mechanics.projectionChecksum
  })
  assert.ok(await getCharacterSheetBundleForUser(db, target.characterId, target.userId))
}

async function installActivationEventFailure(trx: DBLike, campaignId: string): Promise<void> {
  await sql`select set_config('artificer.activation_proof_campaign_id', ${campaignId}, true)`.execute(
    trx
  )
  await sql`
    create function pg_temp.raise_authored_campaign_activation_event_failure()
    returns trigger
    language plpgsql
    as $$
    begin
      raise exception 'authored-campaign-activation-proof-event-failure';
    end;
    $$
  `.execute(trx)
  await sql`
    create trigger authored_campaign_activation_event_failure
    before insert on public.campaign_events
    for each row
    when (
      new.campaign_id = current_setting('artificer.activation_proof_campaign_id')::uuid
      and new.kind = 'CAMPAIGN_AUTHORED_CONTENT_ACTIVATED'
    )
    execute function pg_temp.raise_authored_campaign_activation_event_failure()
  `.execute(trx)
}

async function spellMutationState(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions,
  spellId: string
): Promise<unknown> {
  const target = options.character
  assert.ok(target)
  const result = await sql<{ value: unknown }>`
    select jsonb_build_object(
      'root', (select to_jsonb(row) from (select * from public.spells where id = ${spellId}::uuid) row),
      'versions', (select coalesce(jsonb_agg(to_jsonb(row) order by row.version), '[]'::jsonb) from (select * from public.spell_versions where spell_id = ${spellId}::uuid) row),
      'classes', (select coalesce(jsonb_agg(to_jsonb(row) order by row.class_id), '[]'::jsonb) from (select * from public.spell_catalog_classes where spell_id = ${spellId}::uuid) row),
      'marker', (select to_jsonb(row) from (select * from public.spell_catalog_index_versions where spell_id = ${spellId}::uuid) row),
      'route', (select to_jsonb(row) from (select * from public.authored_route_ids where subject_kind = 'SPELL' and subject_id = ${spellId}::uuid) row),
      'character', (select to_jsonb(row) from (select * from public.characters where id = ${target.characterId}::uuid) row),
      'classSpells', (select coalesce(jsonb_agg(to_jsonb(row) order by row.class_id, row.state, row.spell_id), '[]'::jsonb) from (select * from public.character_class_spells where character_id = ${target.characterId}::uuid) row),
      'base', (select to_jsonb(row) from (select * from public.character_mechanics_projections where character_id = ${target.characterId}::uuid) row),
      'overlay', (select to_jsonb(row) from (select * from public.campaign_character_mechanics_projections where campaign_id = ${options.campaignId}::uuid and character_id = ${target.characterId}::uuid) row),
      'events', (select coalesce(jsonb_agg(to_jsonb(row) order by row.created_at, row.id), '[]'::jsonb) from (select * from public.campaign_events where campaign_id = ${options.campaignId}::uuid) row),
      'share', (select to_jsonb(row) from (select * from public.campaign_content_shares where campaign_id = ${options.campaignId}::uuid and subject_kind = 'SPELL' and subject_id = ${spellId}::uuid) row),
      'campaign', (select to_jsonb(row) from (select * from public.campaigns where id = ${options.campaignId}::uuid) row)
    ) as value
  `.execute(db)
  return result.rows[0]?.value
}

async function proveActivationSuccess(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions
): Promise<void> {
  const spell = await createOwnedSpell(db, options, options.authorUserId, 'activation-success')
  await shareSource(db, options, spell)
  const beforeStream = await attachPreparedSpell(db, options, spell.id)
  const beforeCampaignVersion = await campaignVersion(db, options.campaignId)
  const beforeCharacter = await readCharacterState(
    db,
    options.campaignId,
    options.character!.characterId,
    spell.subjectKind,
    spell.id
  )
  const next = await activateNextSpellVersion(
    db,
    options,
    spell,
    options.authorUserId,
    `Activation success ${spell.id}`
  )
  assert.equal(await campaignVersion(db, options.campaignId), beforeCampaignVersion + 1)
  await assertExactPinnedSpellDependency(db, options, spell, beforeStream)
  const afterCharacter = await readCharacterState(
    db,
    options.campaignId,
    options.character!.characterId,
    spell.subjectKind,
    spell.id
  )
  assert.deepEqual(afterCharacter.character, beforeCharacter.character)
  assert.deepEqual(afterCharacter.classSpells, beforeCharacter.classSpells)
  assert.deepEqual(afterCharacter.draft, beforeCharacter.draft)
  assert.deepEqual(afterCharacter.base, beforeCharacter.base)
  assert.deepEqual(afterCharacter.overlay, beforeCharacter.overlay)
  assert.deepEqual(afterCharacter.share, beforeCharacter.share)
  const event = await sql<{ count: number }>`
    select count(*)::int as count
    from public.campaign_events
    where campaign_id = ${options.campaignId}::uuid
      and kind = 'CAMPAIGN_AUTHORED_CONTENT_ACTIVATED'
      and payload ->> 'subjectId' = ${spell.id}
      and payload ->> 'versionId' = ${next.versionId}
  `.execute(db)
  assert.equal(event.rows[0]?.count, 1)
}

async function proveActivationLateRollback(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions
): Promise<void> {
  const spell = await createOwnedSpell(db, options, options.authorUserId, 'activation-rollback')
  await shareSource(db, options, spell)
  await attachPreparedSpell(db, options, spell.id)
  const document = await nextSpellDocument(
    db,
    spell.id,
    options.authorUserId,
    `Activation rollback ${spell.id}`
  )
  const before = await spellMutationState(db, options, spell.id)
  await assert.rejects(
    db.transaction().execute(async (trx) => {
      await installActivationEventFailure(trx, options.campaignId)
      await activateAuthoredDomainInput(
        trx,
        authoredDomainConfigs.spells,
        document,
        options.authorUserId
      )
    }),
    new RegExp(ACTIVATION_EVENT_FAILURE_MESSAGE)
  )
  assert.deepEqual(await spellMutationState(db, options, spell.id), before)
  await assertExactPinnedSpellDependency(
    db,
    options,
    spell,
    (await characterRow(db, options.character?.characterId ?? '')).stream_version
  )
}

async function proveActivationUseFirst(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions
): Promise<void> {
  const spell = await createOwnedSpell(db, options, options.authorUserId, 'activation-use-first')
  await shareSource(db, options, spell)
  const beforeStream = await attachPreparedSpell(db, options, spell.id)
  const holder = createTaggedDb(options.connectionString, 'activation-use-first-holder')
  const activator = createTaggedDb(options.connectionString, 'activation-use-first-activator')
  const observer = createTaggedDb(options.connectionString, 'activation-use-first-observer')
  let release: (() => void) | undefined
  let ready: (() => void) | undefined
  const heldReady = new Promise<void>((resolve) => {
    ready = resolve
  })
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  let held: Promise<void> | undefined
  let activation: Promise<OwnedSource> | undefined
  try {
    held = holdShareUse(holder, options, spell, () => ready?.(), released)
    await withTimeout('activation use-first share-use lock', heldReady)
    activation = activateNextSpellVersion(
      activator,
      options,
      spell,
      options.authorUserId,
      `Activation use first ${spell.id}`
    )
    void activation.catch(() => undefined)
    await waitForBlockedActivity(observer, 'activation-use-first-activator', 'campaigns')
    release?.()
    await withTimeout('activation use-first settlement', Promise.all([held, activation]))
    await assertExactPinnedSpellDependency(db, options, spell, beforeStream)
  } finally {
    release?.()
    const pending: Promise<unknown>[] = []
    if (held) pending.push(held)
    if (activation) pending.push(activation)
    await Promise.allSettled(pending)
    await Promise.all([holder.destroy(), activator.destroy(), observer.destroy()])
  }
}

async function proveActivationFirstUse(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions
): Promise<void> {
  const target = options.character
  assert.ok(target)
  const spell = await createOwnedSpell(db, options, options.authorUserId, 'activation-first-use')
  await shareSource(db, options, spell)
  const beforeStream = await attachPreparedSpell(db, options, spell.id)
  const beforeCharacter = await readCharacterState(
    db,
    options.campaignId,
    target.characterId,
    spell.subjectKind,
    spell.id
  )
  const holder = createTaggedDb(options.connectionString, 'activation-first-holder')
  const activator = createTaggedDb(options.connectionString, 'activation-first-activator')
  const user = createTaggedDb(options.connectionString, 'activation-first-use')
  let release: (() => void) | undefined
  let ready: (() => void) | undefined
  const heldReady = new Promise<void>((resolve) => {
    ready = resolve
  })
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  const characterHolder = holder.transaction().execute(async (trx) => {
    await sql`select id from public.characters where id = ${target.characterId}::uuid for update`.execute(
      trx
    )
    ready?.()
    await released
  })
  let activation: Promise<OwnedSource> | undefined
  let use:
    | ReturnType<ReturnType<typeof createCampaignContentShareRepository>['lockSharesForUse']>
    | undefined
  try {
    await withTimeout('activation-first Character holder', heldReady)
    activation = withTimeout(
      'activation-first completes while Character remains locked',
      activateNextSpellVersion(
        activator,
        options,
        spell,
        options.authorUserId,
        `Activation first ${spell.id}`
      )
    )
    void activation.catch(() => undefined)
    const next = await activation
    assert.equal(next.version, spell.version + 1)
    const activationState = await sql<{ valid: boolean }>`
      select exists(
        select 1
        from public.spells root
        join public.spell_versions version on version.id = root.active_version_id
        join public.spell_catalog_index_versions marker
          on marker.spell_id = root.id
         and marker.authored_version_id = root.active_version_id
        where root.id = ${spell.id}::uuid
          and root.status = 'ACTIVE'
          and root.active_version_id = ${next.versionId}::uuid
          and version.version = ${next.version}
      ) as valid
    `.execute(db)
    assert.equal(activationState.rows[0]?.valid, true)
    use = createCampaignContentShareRepository(user).lockSharesForUse({
      campaignId: options.campaignId,
      shares: [
        {
          subjectKind: spell.subjectKind,
          subjectId: spell.id,
          sharedBy: options.authorUserId,
          versionId: spell.versionId,
          version: spell.version,
          checksum: spell.checksum
        }
      ]
    })
    void use.catch(() => undefined)
    const useResult = await withTimeout('activation-first exact old-pin use', use)
    assert.equal(useResult.locked.length, 1)
    assert.equal(useResult.missing.length, 0)
    await assertExactPinnedSpellDependency(db, options, spell, beforeStream)
    const afterCharacter = await readCharacterState(
      db,
      options.campaignId,
      target.characterId,
      spell.subjectKind,
      spell.id
    )
    assert.deepEqual(afterCharacter.character, beforeCharacter.character)
    assert.deepEqual(afterCharacter.classSpells, beforeCharacter.classSpells)
    assert.deepEqual(afterCharacter.draft, beforeCharacter.draft)
    assert.deepEqual(afterCharacter.base, beforeCharacter.base)
    assert.deepEqual(afterCharacter.overlay, beforeCharacter.overlay)
    release?.()
    const settled = await withTimeout(
      'activation-first settlement',
      Promise.allSettled([characterHolder, activation, use])
    )
    assert.equal(settled[0]?.status, 'fulfilled')
    assert.equal(settled[1]?.status, 'fulfilled')
    assert.equal(settled[2]?.status, 'fulfilled')
  } finally {
    release?.()
    const pending: Promise<unknown>[] = [characterHolder]
    if (activation) pending.push(activation)
    if (use) pending.push(use)
    await Promise.allSettled(pending)
    await Promise.all([holder.destroy(), activator.destroy(), user.destroy()])
  }
}

async function proveActivationSameDraftRace(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions
): Promise<void> {
  const spell = await createOwnedSpell(db, options, options.authorUserId, 'activation-race')
  await shareSource(db, options, spell)
  const beforeStream = await attachPreparedSpell(db, options, spell.id)
  const beforeCampaignVersion = await campaignVersion(db, options.campaignId)
  const document = await nextSpellDocument(
    db,
    spell.id,
    options.authorUserId,
    `Activation race ${spell.id}`
  )
  await saveAuthoredDomainInputDraft(
    db,
    authoredDomainConfigs.spells,
    document,
    options.authorUserId
  )
  const first = createTaggedDb(options.connectionString, 'activation-race-first')
  const second = createTaggedDb(options.connectionString, 'activation-race-second')
  try {
    const settled = await withTimeout(
      'activation same-draft race',
      Promise.allSettled([
        activateAuthoredDomainDraft(
          first,
          authoredDomainConfigs.spells,
          spell.id,
          options.authorUserId
        ),
        activateAuthoredDomainDraft(
          second,
          authoredDomainConfigs.spells,
          spell.id,
          options.authorUserId
        )
      ])
    )
    assert.equal(settled.filter((entry) => entry.status === 'fulfilled').length, 1)
    assert.equal(settled.filter((entry) => entry.status === 'rejected').length, 1)
    const next = await activeSource(db, 'SPELL', spell.id)
    assert.equal(next.version, spell.version + 1)
    assert.equal(await campaignVersion(db, options.campaignId), beforeCampaignVersion + 1)
    await assertExactPinnedSpellDependency(db, options, spell, beforeStream)
  } finally {
    await Promise.all([first.destroy(), second.destroy()])
  }
}

async function proveAlternateOwnerActivation(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions
): Promise<void> {
  const target = options.character
  assert.ok(target)
  const spell = await createOwnedSpell(db, options, target.userId, 'activation-owner-access')
  await shareSource(db, options, spell, target.userId)
  const beforeStream = await attachPreparedSpell(db, options, spell.id)
  await activateNextSpellVersion(db, options, spell, target.userId, `Owner activation ${spell.id}`)
  await assertExactPinnedSpellDependency(db, options, spell, beforeStream)
  const selected = await sql<{ count: number }>`
    select count(*)::int as count from public.character_class_spells
    where character_id = ${target.characterId}::uuid and spell_id = ${spell.id}::uuid
  `.execute(db)
  assert.equal(selected.rows[0]?.count, 1)
}

async function proveActivationResult(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions
): Promise<void> {
  assert.ok(options.character)
  await runSchedule('activation-success-current-vector', () => proveActivationSuccess(db, options))
  await runSchedule('activation-late-rollback', () => proveActivationLateRollback(db, options))
  await runSchedule('activation-use-first', () => proveActivationUseFirst(db, options))
  await runSchedule('activation-first-use', () => proveActivationFirstUse(db, options))
  await runSchedule('activation-same-draft-race', () => proveActivationSameDraftRace(db, options))
  await runSchedule('activation-alternate-owner-access', () =>
    proveAlternateOwnerActivation(db, options)
  )
}

async function assertDeletedRoot(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions,
  source: OwnedSource
): Promise<void> {
  assert.equal(
    await createAuthoredVersionRepository(db).findActive({
      subjectKind: source.subjectKind,
      subjectId: source.id
    }),
    null
  )
  const remaining = await sql<{ routes: number; shares: number }>`
    select
      (select count(*)::int from public.campaign_content_shares where subject_kind = ${source.subjectKind} and subject_id = ${source.id}::uuid) as shares,
      (select count(*)::int from public.authored_route_ids where subject_kind = ${source.subjectKind} and subject_id = ${source.id}::uuid) as routes
  `.execute(db)
  assert.deepEqual(remaining.rows[0], { routes: 0, shares: 0 })
}

async function proveSharedSpellDeletion(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions
): Promise<void> {
  const target = options.character
  assert.ok(target)
  const spell = await createOwnedSpell(db, options, options.authorUserId, 'delete-spell')
  await shareSource(db, options, spell)
  const beforeStream = await attachPreparedSpell(db, options, spell.id)
  await deleteAuthoredDomainActiveAsUser(
    db,
    authoredDomainConfigs.spells,
    spell.id,
    options.authorUserId
  )
  await assertDeletedRoot(db, options, spell)
  const row = await characterRow(db, target.characterId)
  assert.equal(row.status, 'ACTIVE')
  assert.equal(row.stream_version, beforeStream + 1)
  const selected = await sql<{ count: number }>`
    select count(*)::int as count from public.character_class_spells
    where character_id = ${target.characterId}::uuid and spell_id = ${spell.id}::uuid
  `.execute(db)
  assert.equal(selected.rows[0]?.count, 0)
  await assertCurrentCharacter(db, options)
}

async function proveDeletionLateRollback(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions
): Promise<void> {
  const spell = await createOwnedSpell(db, options, options.authorUserId, 'delete-rollback')
  await shareSource(db, options, spell)
  await attachPreparedSpell(db, options, spell.id)
  const before = await spellMutationState(db, options, spell.id)
  await assert.rejects(
    db.transaction().execute(async (trx) => {
      await installRemovalEventFailure(trx, options.campaignId)
      await deleteAuthoredDomainActiveAsUser(
        trx,
        authoredDomainConfigs.spells,
        spell.id,
        options.authorUserId
      )
    }),
    new RegExp(EVENT_FAILURE_MESSAGE)
  )
  assert.deepEqual(await spellMutationState(db, options, spell.id), before)
  await assertCurrentCharacter(db, options)
}

async function proveDeletionSameVersionRace(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions
): Promise<void> {
  const spell = await createOwnedSpell(db, options, options.authorUserId, 'delete-race')
  await shareSource(db, options, spell)
  await attachPreparedSpell(db, options, spell.id)
  const first = createTaggedDb(options.connectionString, 'delete-race-first')
  const second = createTaggedDb(options.connectionString, 'delete-race-second')
  try {
    const settled = await withTimeout(
      'authored delete race',
      Promise.allSettled([
        deleteAuthoredDomainActiveAsUser(
          first,
          authoredDomainConfigs.spells,
          spell.id,
          options.authorUserId
        ),
        deleteAuthoredDomainActiveAsUser(
          second,
          authoredDomainConfigs.spells,
          spell.id,
          options.authorUserId
        )
      ])
    )
    assert.equal(settled.filter((entry) => entry.status === 'fulfilled').length, 1)
    assert.equal(settled.filter((entry) => entry.status === 'rejected').length, 1)
    await assertDeletedRoot(db, options, spell)
    await assertCurrentCharacter(db, options)
  } finally {
    await Promise.all([first.destroy(), second.destroy()])
  }
}

async function proveSharedStructuralDeletion(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions
): Promise<void> {
  const target = options.character
  assert.ok(target)
  const background = await createOwnedBackground(db, options, 'delete-structural')
  await shareSource(db, options, background)
  const beforeStream = await attachBackground(db, options, background.id)
  await deleteAuthoredDomainActiveAsUser(
    db,
    authoredDomainConfigs.backgrounds,
    background.id,
    options.authorUserId
  )
  await assertDeletedRoot(db, options, background)
  const row = await characterRow(db, target.characterId)
  assert.equal(row.status, 'DRAFT')
  assert.equal(row.stream_version, beforeStream + 1)
  const projections = await sql<{ base: number; overlay: number }>`
    select
      (select count(*)::int from public.character_mechanics_projections where character_id = ${target.characterId}::uuid) as base,
      (select count(*)::int from public.campaign_character_mechanics_projections where campaign_id = ${options.campaignId}::uuid and character_id = ${target.characterId}::uuid) as overlay
  `.execute(db)
  assert.deepEqual(projections.rows[0], { base: 0, overlay: 0 })
}

async function proveSharedVehicleDeletion(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions
): Promise<void> {
  const source = await createOwnedVehicleDefinition(db, options)
  await shareSource(db, options, source)
  const fixture = await createVehicleInventoryFixture(db, options, source)
  await deleteAuthoredDomainActiveAsUser(
    db,
    authoredDomainConfigs.vehicles,
    source.id,
    options.authorUserId
  )
  await assertDeletedRoot(db, options, source)
  const rows = await sql<{
    destinationAmount: string
    explicitBalanceOwnerId: string
    explicitGroupOwnerId: string
    sourceBalanceCount: number
    sourceOwnerCount: number
    vehicleCount: number
  }>`
    select
      (select count(*)::int from public.campaign_vehicles where id = ${fixture.vehicleId}::uuid) as "vehicleCount",
      (select count(*)::int from public.inventory_owners where id = ${fixture.sourceOwnerId}::uuid) as "sourceOwnerCount",
      (select count(*)::int from public.inventory_currency_balances where id = ${fixture.sourceUngroupedBalanceId}::uuid) as "sourceBalanceCount",
      (select amount::text from public.inventory_currency_balances where id = ${fixture.destinationUngroupedBalanceId}::uuid) as "destinationAmount",
      (select owner_id from public.inventory_currency_groups where id = ${fixture.explicitGroupId}::uuid) as "explicitGroupOwnerId",
      (select owner_id from public.inventory_currency_balances where id = ${fixture.explicitBalanceId}::uuid) as "explicitBalanceOwnerId"
  `.execute(db)
  assert.deepEqual(rows.rows[0], {
    vehicleCount: 0,
    sourceOwnerCount: 0,
    sourceBalanceCount: 0,
    destinationAmount: '15',
    explicitGroupOwnerId: fixture.campaignOwnerId,
    explicitBalanceOwnerId: fixture.campaignOwnerId
  })
  const items = await sql<{ containerId: string | null; id: string; ownerId: string }>`
    select id, owner_id as "ownerId", container_id as "containerId"
    from public.inventory_items
    where id in (${fixture.topItemId}::uuid, ${fixture.childItemId}::uuid)
    order by id
  `.execute(db)
  assert.equal(items.rows.length, 2)
  assert.equal(
    items.rows.every((row) => row.ownerId === fixture.campaignOwnerId),
    true
  )
  assert.equal(
    items.rows.find((row) => row.id === fixture.childItemId)?.containerId,
    fixture.topItemId
  )
  const evidence = await sql<{ count: number }>`
    select count(*)::int as count from public.campaign_events
    where campaign_id = ${options.campaignId}::uuid
      and kind = 'CAMPAIGN_VEHICLE_EVACUATED'
      and payload ->> 'formerCampaignVehicleId' = ${fixture.vehicleId}
      and payload ->> 'authoredVehicleId' = ${source.id}
  `.execute(db)
  assert.equal(evidence.rows[0]?.count, 1)
}

async function proveDeletionResult(
  db: DBLike,
  options: CampaignContentShareRemovalProofOptions
): Promise<void> {
  assert.ok(options.character)
  await runSchedule('delete-shared-spell', () => proveSharedSpellDeletion(db, options))
  await runSchedule('delete-late-rollback', () => proveDeletionLateRollback(db, options))
  await runSchedule('delete-same-version-race', () => proveDeletionSameVersionRace(db, options))
  await runSchedule('delete-shared-vehicle-evacuation', () =>
    proveSharedVehicleDeletion(db, options)
  )
  await runSchedule('delete-shared-structural-root', () =>
    proveSharedStructuralDeletion(db, options)
  )
}

export async function proveCampaignContentShareRemovalPostgresSemantics(
  options: CampaignContentShareRemovalProofOptions
): Promise<void> {
  const db = createDb({ connectionString: options.connectionString })
  try {
    if (options.group === 'activation') await proveActivationResult(db, options)
    else if (options.group === 'deletion') await proveDeletionResult(db, options)
    else if (options.group === 'unshare') await proveUnshareResult(db, options)
    else if (options.group === 'membership') await proveMembershipResult(db, options)
    else await proveVehicleResult(db, options)
    console.log(JSON.stringify({ gate4Result: options.group, status: 'PASS' }))
  } finally {
    await db.destroy()
  }
}
