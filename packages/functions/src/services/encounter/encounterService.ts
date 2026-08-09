import { createHash, randomInt, randomUUID } from 'node:crypto'
import { sql } from 'kysely'

import {
  createCampaignRepository,
  createCharacterRepository,
  createAccountEntitlementsRepository,
  createCreatureRepository,
  createEncounterRepository,
  withTransaction,
  type DBLike,
  type CampaignRoomEntry,
  type EncounterActorRecord,
  type EncounterRecord,
  type EncounterStatus,
  type EncounterTemplateEnemy,
  type Json
} from '@artificer-toolkit/db'
import {
  encounterFeatureReferenceDtoSchema,
  encounterCommandResultDtoSchema,
  encounterGmProjectionDtoSchema,
  encounterTimelineDtoSchema,
  encounterTemplateDtoSchema,
  encounterTemplateListDtoSchema,
  encounterPlayerProjectionDtoSchema,
  type AddEncounterTemplateInputDto,
  type CreateEncounterTemplateInputDto,
  type CreateEncounterInputDto,
  type EncounterCommandInputDto,
  type EncounterCommandResultDto,
  type EncounterGmProjectionDto,
  type EncounterPlayerProjectionDto,
  type EncounterTimelineDto,
  type UpdateEncounterActorInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { rollResultDtoSchema } from '@artificer-toolkit/schema/api/rolls'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import { featureDtoSchema, type FeatureDto } from '@artificer-toolkit/schema/features/feature'
import { compileCharge, resolveCompiledChargeMaximum } from '@artificer-toolkit/shared/compilers'
import {
  evaluateRollExpression,
  parseRollExpression
} from '@artificer-toolkit/shared/rolls'
import { executeDiceConfiguration } from '../rolls/rollService.js'
import { ENTITLEMENT_LIMITS, assertEntitlementLimit } from '../account/entitlementService.js'
import { executeCharacterSheetCommand } from '../character/sheetService.js'
import { getCharacterSheetForUser } from '../character/characterApplicationService.js'
import {
  assertActiveCampaignMember,
  assertCampaignOwner,
  assertCampaignWritable,
  resolveCampaignAuthority,
  CampaignConflictError
} from '../campaign/campaignService.js'
import { insertPreEvaluatedCampaignTableRoll } from '../campaign/campaignCollaborationService.js'
import { broadcastCampaignInvalidation } from '../campaign/realtimeService.js'

export class EncounterNotFoundError extends Error {
  constructor() {
    super('Encounter not found.')
    this.name = 'EncounterNotFoundError'
  }
}

export class EncounterConflictError extends Error {
  constructor(message = 'Encounter changed before this action completed.') {
    super(message)
    this.name = 'EncounterConflictError'
  }
}

export class EncounterValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EncounterValidationError'
  }
}

function fingerprint(input: unknown): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex')
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505'
  )
}

function healthBand(current: number, maximum: number) {
  if (current <= 0) return 'DEFEATED' as const
  if (maximum <= 0 || current >= maximum * 0.75) return 'HEALTHY' as const
  if (current >= maximum * 0.5) return 'WOUNDED' as const
  if (current >= maximum * 0.25) return 'BLOODIED' as const
  return 'CRITICAL' as const
}

function snapshotFeatureDefinitions(actor: EncounterActorRecord): FeatureDto[] {
  if (
    actor.kind !== 'CREATURE' ||
    typeof actor.snapshot !== 'object' ||
    actor.snapshot === null ||
    Array.isArray(actor.snapshot)
  ) {
    return []
  }
  const payload = actor.snapshot.payload
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return []
  const features = payload.features
  if (!Array.isArray(features)) return []

  return features.flatMap((feature) => {
    const parsed = featureDtoSchema.safeParse(feature)
    return parsed.success ? [parsed.data] : []
  })
}

function featureChargeMaximum(actor: EncounterActorRecord, feature: FeatureDto): number | null {
  const charge = feature.charges
  if (
    !charge ||
    charge.limitKind === 'SOURCE_CHARGES' ||
    charge.scalingKind !== 'NONE' ||
    (charge.limitKind !== 'FIXED_AMOUNT' && charge.limitKind !== 'ABILITY_MODIFIER') ||
    charge.bonuses?.some((bonus) => bonus.bonusKind !== 'ABILITY_MODIFIER')
  ) {
    return null
  }
  let abilities: Record<string, number> = {}
  if (charge.limitKind === 'ABILITY_MODIFIER' || charge.bonuses?.length) {
    if (
      typeof actor.snapshot !== 'object' ||
      actor.snapshot === null ||
      Array.isArray(actor.snapshot)
    ) {
      return null
    }
    const payload = actor.snapshot.payload
    const abilityScores =
      typeof payload === 'object' && payload !== null && !Array.isArray(payload)
        ? payload.abilityScores
        : null
    if (
      typeof abilityScores !== 'object' ||
      abilityScores === null ||
      Array.isArray(abilityScores)
    ) {
      return null
    }
    abilities = Object.fromEntries(
      Object.entries(abilityScores).filter(
        (entry): entry is [string, number] =>
          typeof entry[1] === 'number' && Number.isFinite(entry[1])
      )
    )
  }

  try {
    const maximum = resolveCompiledChargeMaximum(compileCharge(charge), {
      abilities,
      proficiencyBonus: 0,
      totalLevel: 0
    })
    return maximum > 0 ? maximum : null
  } catch {
    return null
  }
}

function featureChargeUsed(actor: EncounterActorRecord, featureId: string): number {
  if (
    typeof actor.resources !== 'object' ||
    actor.resources === null ||
    Array.isArray(actor.resources)
  ) {
    return 0
  }
  const charges = actor.resources.featureCharges
  if (typeof charges !== 'object' || charges === null || Array.isArray(charges)) return 0
  const used = charges[featureId]
  return typeof used === 'number' && Number.isInteger(used) && used >= 0 ? used : 0
}

function withFeatureChargeUsed(actor: EncounterActorRecord, featureId: string, used: number): Json {
  const resources =
    typeof actor.resources === 'object' &&
    actor.resources !== null &&
    !Array.isArray(actor.resources)
      ? actor.resources
      : {}
  const existing = resources.featureCharges
  const featureCharges =
    typeof existing === 'object' && existing !== null && !Array.isArray(existing) ? existing : {}
  return { ...resources, featureCharges: { ...featureCharges, [featureId]: used } }
}

function snapshotFeatures(actor: EncounterActorRecord) {
  return snapshotFeatureDefinitions(actor).map((feature) => {
    const maximum = featureChargeMaximum(actor, feature)
    const used = maximum === null ? 0 : Math.min(featureChargeUsed(actor, feature.id), maximum)
    return encounterFeatureReferenceDtoSchema.parse({
      ...feature,
      resource:
        maximum === null
          ? null
          : {
              used,
              maximum,
              remaining: maximum - used,
              resetKind:
                feature.charges && feature.charges.limitKind !== 'SOURCE_CHARGES'
                  ? feature.charges.resetKind
                  : 'MANUAL'
            }
    })
  })
}

function stringValues(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function snapshotStatBlock(actor: EncounterActorRecord) {
  if (
    actor.kind !== 'CREATURE' ||
    typeof actor.snapshot !== 'object' ||
    actor.snapshot === null ||
    Array.isArray(actor.snapshot)
  )
    return null
  const payload = actor.snapshot.payload
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null
  const abilityScores = payload.abilityScores
  const abilities =
    typeof abilityScores === 'object' && abilityScores !== null && !Array.isArray(abilityScores)
      ? Object.fromEntries(
          Object.entries(abilityScores).filter(
            (entry): entry is [string, number] =>
              typeof entry[1] === 'number' && Number.isFinite(entry[1])
          )
        )
      : null
  return {
    armorClass:
      typeof payload.armorClass === 'number' &&
      Number.isInteger(payload.armorClass) &&
      payload.armorClass >= 0
        ? payload.armorClass
        : null,
    abilityScores: abilities,
    speeds: Array.isArray(payload.speeds) ? payload.speeds : [],
    senses: stringValues(payload.senses),
    damageVulnerabilities: stringValues(payload.damageVulnerabilities),
    damageResistances: stringValues(payload.damageResistances),
    damageImmunities: stringValues(payload.damageImmunities),
    conditionImmunities: stringValues(payload.conditionImmunities)
  }
}

function diceConfiguration(expression: { count: number; die: number; modifier: number }): string {
  const dice = `${expression.count}d${expression.die}`
  return expression.modifier === 0
    ? dice
    : `${dice} ${expression.modifier > 0 ? '+' : '-'} ${Math.abs(expression.modifier)}`
}

function executeEnemyRoll(
  expression: { count: number; die: number; modifier: number },
  rollMode: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE'
) {
  return rollResultDtoSchema.parse({
    id: randomUUID(),
    ...evaluateRollExpression(
      parseRollExpression(diceConfiguration(expression)),
      {
        nextInt: (maxExclusive) => randomInt(maxExclusive)
      },
      rollMode
    )
  })
}

function stableActors(encounter: EncounterRecord): EncounterActorRecord[] {
  return [...encounter.actors].sort((left, right) => {
    const manualLeft = left.manualOrder ?? Number.MAX_SAFE_INTEGER
    const manualRight = right.manualOrder ?? Number.MAX_SAFE_INTEGER
    if (manualLeft !== manualRight) return manualLeft - manualRight
    const initiativeLeft = left.initiative ?? Number.MIN_SAFE_INTEGER
    const initiativeRight = right.initiative ?? Number.MIN_SAFE_INTEGER
    if (initiativeLeft !== initiativeRight) return initiativeRight - initiativeLeft
    return left.stableTieKey.localeCompare(right.stableTieKey)
  })
}

function projectGm(encounter: EncounterRecord): EncounterGmProjectionDto {
  return encounterGmProjectionDtoSchema.parse({
    id: encounter.id,
    campaignId: encounter.campaignId,
    sessionId: encounter.sessionId,
    templateId: encounter.templateId,
    templateVersion: encounter.templateVersion,
    name: encounter.name,
    status: encounter.status,
    version: encounter.version,
    round: encounter.round,
    currentActorId: encounter.currentActorId,
    actors: stableActors(encounter).map((actor) => ({
      id: actor.id,
      encounterId: actor.encounterId,
      kind: actor.kind,
      label: actor.label,
      sourceId: actor.sourceId,
      sourceRevision: actor.sourceRevision,
      systemId: actor.systemId,
      stableTieKey: actor.stableTieKey,
      public: actor.public,
      currentHitPoints: actor.currentHitPoints,
      maxHitPoints: actor.maxHitPoints,
      tempHitPoints: actor.tempHitPoints,
      conditions: actor.conditions,
      resources: actor.resources,
      gmNotes: actor.gmNotes,
      statBlock: snapshotStatBlock(actor),
      features: snapshotFeatures(actor),
      initiative: actor.initiative,
      manualOrder: actor.manualOrder,
      healthBand: healthBand(actor.currentHitPoints, actor.maxHitPoints)
    })),
    reminders: encounter.reminders.map((reminder) => ({
      id: reminder.id,
      label: reminder.label,
      timing: reminder.timing,
      round: reminder.round,
      actorId: reminder.actorId,
      public: reminder.public,
      notes: reminder.notes,
      order: reminder.order
    })),
    createdAt: encounter.createdAt,
    updatedAt: encounter.updatedAt
  })
}

function projectPlayer(encounter: EncounterRecord): EncounterPlayerProjectionDto {
  return encounterPlayerProjectionDtoSchema.parse({
    id: encounter.id,
    campaignId: encounter.campaignId,
    sessionId: encounter.sessionId,
    templateId: encounter.templateId,
    templateVersion: encounter.templateVersion,
    name: encounter.name,
    status: encounter.status,
    version: encounter.version,
    round: encounter.round,
    currentActorId:
      encounter.currentActorId &&
      encounter.actors.find((actor) => actor.id === encounter.currentActorId)?.public
        ? encounter.currentActorId
        : null,
    actors: stableActors(encounter)
      .filter((actor) => actor.public)
      .map((actor) => ({
        id: actor.id,
        encounterId: actor.encounterId,
        kind: actor.kind,
        label: actor.label,
        sourceId: actor.kind === 'CHARACTER' ? actor.sourceId : null,
        sourceRevision: null,
        public: actor.public,
        initiative: actor.initiative,
        manualOrder: actor.manualOrder,
        conditions: actor.conditions,
        healthBand: healthBand(actor.currentHitPoints, actor.maxHitPoints)
      })),
    createdAt: encounter.createdAt,
    updatedAt: encounter.updatedAt
  })
}

async function assertOwner(db: DBLike, campaignId: string, userId: string) {
  const authority = await resolveCampaignAuthority(db, campaignId, userId)
  assertCampaignOwner(authority)
  assertCampaignWritable(authority)
  return authority
}

async function lockEncounter(db: DBLike, encounterId: string, userId: string) {
  const repository = createEncounterRepository(db)
  const encounter = await repository.lock(encounterId)
  if (!encounter) throw new EncounterNotFoundError()
  await assertOwner(db, encounter.campaignId, userId)
  const session = await sql<{ status: string }>`
    SELECT status FROM public.campaign_sessions WHERE id = ${encounter.sessionId} FOR SHARE
  `.execute(db)
  if (session.rows[0]?.status !== 'OPEN') {
    throw new EncounterConflictError('Finished Sessions cannot change Encounters.')
  }
  return encounter
}

function requireActor(encounter: EncounterRecord, actorId: string): EncounterActorRecord {
  const actor = encounter.actors.find((candidate) => candidate.id === actorId)
  if (!actor) throw new EncounterValidationError('Encounter actor was not found.')
  return actor
}

async function applyCharacterCommand(
  db: DBLike,
  userId: string,
  actor: EncounterActorRecord,
  input: UpdateEncounterActorInputDto
): Promise<{ actor: EncounterActorRecord; correlationId: string }> {
  const command = input.characterCommand
  if (!command) return { actor, correlationId: '' }
  if (actor.kind !== 'CHARACTER' || !actor.sourceId) {
    throw new EncounterValidationError('Sheet command does not target this Character actor.')
  }
  const correlationId = randomUUID()
  const result = await executeCharacterSheetCommand({
    db,
    characterId: actor.sourceId,
    command,
    userId
  })
  await sql`
    UPDATE public.character_events
    SET event_data = event_data || jsonb_build_object('correlationId', ${correlationId}::text)
    WHERE character_id = ${actor.sourceId} AND command_id = ${command.commandId}
  `.execute(db)
  return {
    correlationId,
    actor: {
      ...actor,
      currentHitPoints: Math.max(result.sheet.overview.currentHitPoints, 0),
      maxHitPoints: Math.max(result.sheet.overview.maxHitPoints, 0),
      tempHitPoints: Math.max(result.sheet.overview.tempHitPoints, 0),
      conditions: result.sheet.overview.conditions as unknown as Json
    }
  }
}

function commandResult(encounter: EncounterRecord, roll: RollRecordDto | null = null): Json {
  return encounterCommandResultDtoSchema.parse({
    projection: projectGm(encounter),
    roll
  }) as unknown as Json
}

export async function createEncounter(
  db: DBLike,
  userId: string,
  input: CreateEncounterInputDto
): Promise<EncounterGmProjectionDto> {
  const encounter = await withTransaction(db, async (trx) => {
    await assertOwner(trx, input.campaignId, userId)
    const encounterRepository = createEncounterRepository(trx)
    const campaign = createCampaignRepository(trx)
    if (!(await campaign.lockCampaign(input.campaignId))) {
      throw new CampaignConflictError('Campaign not found.')
    }
    const session = await sql<{ id: string; status: string }>`
      SELECT id, status FROM public.campaign_sessions
      WHERE id = ${input.sessionId} AND campaign_id = ${input.campaignId}
      FOR UPDATE
    `.execute(trx)
    if (session.rows[0]?.status !== 'OPEN') {
      throw new EncounterConflictError('Encounters can only be added to open Sessions.')
    }
    const template = await encounterRepository.findTemplate(input.campaignId, input.templateId)
    if (!template) throw new EncounterNotFoundError()
    const commandFingerprint = fingerprint(input)
    const prior = await encounterRepository.findEventByCampaignCommand(
      input.campaignId,
      input.commandId
    )
    if (prior) {
      if (prior.commandType !== 'CREATE' || prior.commandFingerprint !== commandFingerprint) {
        throw new EncounterConflictError('Command ID was already used with different input.')
      }
      const existing = await encounterRepository.find(prior.encounterId)
      if (!existing) throw new EncounterNotFoundError()
      return existing
    }
    const attendance = await sql<{ character_id: string }>`
      SELECT character_id FROM public.campaign_session_attendance
      WHERE session_id = ${input.sessionId} AND present = true
      ORDER BY character_id ASC
    `.execute(trx)
    let created: EncounterRecord
    try {
      created = await encounterRepository.create({
        id: randomUUID(),
        campaignId: input.campaignId,
        sessionId: input.sessionId,
        templateId: template.id,
        templateVersion: template.version,
        name: template.name
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new EncounterConflictError('This Campaign already has an active Encounter.')
      }
      throw error
    }
    for (const row of attendance.rows) {
      const [character, authored, sheet] = await Promise.all([
        createCharacterRepository(trx).findById(row.character_id),
        createCharacterRepository(trx).findAuthoredById(row.character_id),
        getCharacterSheetForUser(trx, row.character_id, userId)
      ])
      if (!character || !authored || !sheet) continue
      await encounterRepository.addActor({
        id: randomUUID(),
        encounterId: created.id,
        kind: 'CHARACTER',
        sourceId: row.character_id,
        sourceRevision: character.stream_version,
        label: authored.label,
        systemId: authored.systemId,
        stableTieKey: randomUUID(),
        public: true,
        currentHitPoints: Math.max(sheet.overview.currentHitPoints, 0),
        maxHitPoints: Math.max(sheet.overview.maxHitPoints, 0),
        tempHitPoints: Math.max(sheet.overview.tempHitPoints, 0),
        conditions: sheet.overview.conditions as unknown as Json,
        resources: {},
        gmNotes: null,
        initiative: null,
        manualOrder: null,
        snapshot: {
          kind: 'CHARACTER',
          id: authored.id,
          label: authored.label,
          systemId: authored.systemId,
          sourceRevision: character.stream_version
        } as unknown as Json
      })
    }
    for (const enemy of template.enemies) {
      await encounterRepository.addActor({
        id: randomUUID(),
        encounterId: created.id,
        kind: enemy.kind,
        sourceId: enemy.sourceId,
        sourceRevision: enemy.sourceRevision,
        label: enemy.label,
        systemId: enemy.systemId,
        stableTieKey: randomUUID(),
        public: true,
        currentHitPoints: enemy.maxHitPoints,
        maxHitPoints: enemy.maxHitPoints,
        tempHitPoints: 0,
        conditions: [],
        resources: {},
        gmNotes: null,
        initiative: null,
        manualOrder: null,
        snapshot: enemy.snapshot
      })
    }
    const hydrated = await encounterRepository.find(created.id)
    if (!hydrated) throw new EncounterNotFoundError()
    created = hydrated
    await encounterRepository.appendEvent({
      id: randomUUID(),
      encounterId: created.id,
      campaignId: created.campaignId,
      version: 0,
      commandId: input.commandId,
      commandType: 'CREATE',
      commandFingerprint,
      commandPayload: input as unknown as Json,
      resultPayload: commandResult(created),
      actorUserId: userId,
      correlationId: null
    })
    return created
  })
  return projectGm(encounter)
}

export async function createEncounterTemplate(
  db: DBLike,
  userId: string,
  input: CreateEncounterTemplateInputDto
) {
  return withTransaction(db, async (trx) => {
    await assertOwner(trx, input.campaignId, userId)
    const tier = await createAccountEntitlementsRepository(trx).lockTier(userId)
    const repository = createEncounterRepository(trx)
    assertEntitlementLimit(
      'savedEncounters',
      await repository.countTemplatesForOwner(userId),
      ENTITLEMENT_LIMITS[tier].savedEncounters
    )
    const creatureRepository = createCreatureRepository(trx)
    const enemies: EncounterTemplateEnemy[] = await Promise.all(
      input.enemies.map(async (enemy) => {
        if (enemy.kind === 'CUSTOM') {
          return {
            kind: 'CUSTOM' as const,
            sourceId: null,
            sourceRevision: null,
            label: enemy.label,
            systemId: null,
            maxHitPoints: enemy.maxHitPoints,
            snapshot: {
              kind: 'CUSTOM',
              label: enemy.label,
              maxHitPoints: enemy.maxHitPoints
            } as unknown as Json
          }
        }

        const creature = await creatureRepository.findById(enemy.sourceId, {
          userId,
          includeMaster: true
        })
        if (!creature || creature.status !== 'ACTIVE') {
          throw new EncounterValidationError('Creature is unavailable.')
        }
        const maxHitPoints = Math.max(creature.hitPoints, 0)
        const sourceRevision = null
        return {
          kind: 'CREATURE' as const,
          sourceId: creature.id,
          sourceRevision,
          label: creature.label,
          systemId: creature.systemId,
          maxHitPoints,
          snapshot: {
            kind: 'CREATURE',
            id: creature.id,
            label: creature.label,
            systemId: creature.systemId,
            sourceRevision,
            maxHitPoints,
            payload: creature as unknown as Json
          } as unknown as Json
        }
      })
    )
    const template = await repository.createTemplate({
      id: randomUUID(),
      campaignId: input.campaignId,
      name: input.name,
      enemies
    })
    return encounterTemplateDtoSchema.parse(template)
  })
}

export async function listEncounterTemplates(db: DBLike, userId: string, campaignId: string) {
  await assertOwner(db, campaignId, userId)
  return encounterTemplateListDtoSchema.parse(
    await createEncounterRepository(db).listTemplates(campaignId)
  )
}

export async function executeEncounterCommand(
  db: DBLike,
  userId: string,
  input: EncounterCommandInputDto
): Promise<EncounterCommandResultDto> {
  const { command, tableEntry } = await withTransaction(db, async (trx) => {
    const repository = createEncounterRepository(trx)
    const locked = await lockEncounter(trx, input.encounterId, userId)
    const commandFingerprint = fingerprint(input)
    const prior = await repository.findEventByCampaignCommand(locked.campaignId, input.commandId)
    if (prior) {
      if (
        prior.encounterId !== input.encounterId ||
        prior.commandFingerprint !== commandFingerprint ||
        prior.commandType !== input.type
      ) {
        throw new EncounterConflictError('Command ID was already used with different input.')
      }
      return {
        command: encounterCommandResultDtoSchema.parse(prior.resultPayload),
        tableEntry: null
      }
    }
    if (locked.version !== input.expectedVersion) {
      throw new EncounterConflictError('Encounter version is stale.')
    }
    if (locked.status === 'COMPLETED') {
      throw new EncounterConflictError('Completed Encounters are read-only.')
    }
    let nextStatus: EncounterStatus = locked.status
    let nextRound = locked.round
    let nextCurrentActorId = locked.currentActorId
    let correlationId: string | null = null
    let rolled: RollRecordDto | null = null
    let tableEntry: CampaignRoomEntry | null = null

    switch (input.type) {
      case 'UPDATE_ACTOR': {
        const current = requireActor(locked, input.actorId)
        if (
          current.kind === 'CHARACTER' &&
          (input.currentHitPoints !== undefined ||
            input.tempHitPoints !== undefined ||
            input.conditions !== undefined)
        ) {
          throw new EncounterValidationError(
            'Character HP must be changed through its Sheet command.'
          )
        }
        const characterMutation = await applyCharacterCommand(trx, userId, current, input)
        let next = characterMutation.actor
        if (input.currentHitPoints !== undefined)
          next = { ...next, currentHitPoints: input.currentHitPoints }
        if (input.tempHitPoints !== undefined)
          next = { ...next, tempHitPoints: input.tempHitPoints }
        if (input.conditions !== undefined) next = { ...next, conditions: input.conditions }
        if (input.gmNotes !== undefined) next = { ...next, gmNotes: input.gmNotes }
        if (input.public !== undefined) next = { ...next, public: input.public }
        await repository.updateActor(next)
        if (input.characterCommand) correlationId = characterMutation.correlationId
        break
      }
      case 'REMOVE_ACTOR': {
        requireActor(locked, input.actorId)
        if (!(await repository.removeActor(locked.id, input.actorId))) {
          throw new EncounterConflictError('Encounter actor changed before removal.')
        }
        if (nextCurrentActorId === input.actorId) nextCurrentActorId = null
        break
      }
      case 'SET_INITIATIVE': {
        const current = requireActor(locked, input.actorId)
        await repository.updateActor({
          ...current,
          initiative: input.initiative,
          manualOrder: input.manualOrder === undefined ? current.manualOrder : input.manualOrder
        })
        break
      }
      case 'ROLL_ACTOR_INITIATIVE': {
        const current = requireActor(locked, input.actorId)
        let modifier = 0
        if (current.kind === 'CHARACTER' && current.sourceId) {
          modifier =
            (await getCharacterSheetForUser(trx, current.sourceId, userId))?.overview.initiative ??
            0
        } else if (
          current.kind === 'CREATURE' &&
          typeof current.snapshot === 'object' &&
          current.snapshot !== null &&
          !Array.isArray(current.snapshot)
        ) {
          const payload = current.snapshot.payload
          const abilityScores =
            typeof payload === 'object' && payload !== null && !Array.isArray(payload)
              ? payload.abilityScores
              : null
          const dexterity =
            typeof abilityScores === 'object' &&
            abilityScores !== null &&
            !Array.isArray(abilityScores)
              ? abilityScores.DEXTERITY
              : null
          if (typeof dexterity === 'number' && Number.isFinite(dexterity)) {
            modifier = Math.floor((dexterity - 10) / 2)
          }
        }
        const result = executeDiceConfiguration({ configuration: '1d20' })
        await repository.updateActor({ ...current, initiative: result.evidence.total + modifier })
        break
      }
      case 'REORDER': {
        const expected = new Set(locked.actors.map((candidate) => candidate.id))
        if (
          input.actorIds.length !== expected.size ||
          input.actorIds.some((id) => !expected.has(id))
        ) {
          throw new EncounterValidationError(
            'Reorder must include each Encounter actor exactly once.'
          )
        }
        await repository.reorder(locked.id, input.actorIds)
        break
      }
      case 'START':
        if (locked.status !== 'PREPARED')
          throw new EncounterConflictError('Only prepared Encounters can start.')
        if (locked.actors.length === 0)
          throw new EncounterValidationError('Add an actor before starting.')
        nextStatus = 'ACTIVE'
        nextRound = 1
        nextCurrentActorId = stableActors(locked)[0]?.id ?? null
        break
      case 'ADVANCE_TURN': {
        if (locked.status !== 'ACTIVE')
          throw new EncounterConflictError('Only active Encounters can advance.')
        const ordered = stableActors(locked)
        if (ordered.length === 0)
          throw new EncounterValidationError('Add an actor before advancing.')
        const index = Math.max(
          ordered.findIndex((candidate) => candidate.id === locked.currentActorId),
          -1
        )
        const nextIndex = (index + 1) % ordered.length
        if (nextIndex === 0) nextRound += 1
        nextCurrentActorId = ordered[nextIndex].id
        break
      }
      case 'PREVIOUS_TURN': {
        if (locked.status !== 'ACTIVE')
          throw new EncounterConflictError('Only active Encounters can move turns.')
        const ordered = stableActors(locked)
        if (ordered.length === 0)
          throw new EncounterValidationError('Add an actor before moving turns.')
        const currentIndex = ordered.findIndex(
          (candidate) => candidate.id === locked.currentActorId
        )
        const index = currentIndex < 0 ? 0 : currentIndex
        const previousIndex = (index - 1 + ordered.length) % ordered.length
        if (index === 0 && nextRound > 1) nextRound -= 1
        nextCurrentActorId = ordered[previousIndex].id
        break
      }
      case 'SET_CURRENT_ACTOR':
        if (locked.status !== 'ACTIVE')
          throw new EncounterConflictError('Only active Encounters have a current turn.')
        if (input.actorId !== null) requireActor(locked, input.actorId)
        nextCurrentActorId = input.actorId
        break
      case 'SET_ROUND':
        if (locked.status !== 'ACTIVE')
          throw new EncounterConflictError('Only active Encounters have a round to correct.')
        nextRound = input.round
        break
      case 'ADJUST_FEATURE_RESOURCE': {
        const current = requireActor(locked, input.actorId)
        if (current.kind === 'CHARACTER') {
          throw new EncounterValidationError(
            'Character resources must be changed through the Character Sheet.'
          )
        }
        const feature = snapshotFeatureDefinitions(current).find(
          (candidate) => candidate.id === input.featureId
        )
        const maximum = feature ? featureChargeMaximum(current, feature) : null
        if (!feature || maximum === null) {
          throw new EncounterValidationError('This enemy feature does not have usable charges.')
        }
        const used = featureChargeUsed(current, feature.id)
        const nextUsed = input.direction === 'USE' ? used + input.amount : used - input.amount
        if (nextUsed < 0 || nextUsed > maximum) {
          throw new EncounterValidationError('The enemy feature does not have that many charges.')
        }
        await repository.updateActor({
          ...current,
          resources: withFeatureChargeUsed(current, feature.id, nextUsed)
        })
        break
      }
      case 'UPSERT_REMINDER': {
        if (input.reminder.actorId !== null) requireActor(locked, input.reminder.actorId)
        await repository.upsertReminder({
          id: input.reminder.id ?? randomUUID(),
          encounterId: locked.id,
          label: input.reminder.label,
          timing: input.reminder.timing,
          round: input.reminder.round,
          actorId: input.reminder.actorId,
          public: input.reminder.public,
          notes: input.reminder.notes,
          order: input.reminder.order
        })
        break
      }
      case 'REMOVE_REMINDER':
        if (!(await repository.removeReminder(locked.id, input.reminderId)))
          throw new EncounterValidationError('Encounter reminder was not found.')
        break
      case 'ROLL_ENEMY_ACTION': {
        const current = requireActor(locked, input.actorId)
        if (current.kind === 'CHARACTER') {
          throw new EncounterValidationError('Enemy actions must target an enemy actor.')
        }
        const feature = snapshotFeatureDefinitions(current).find(
          (candidate) => candidate.id === input.featureId
        )
        const definition = feature?.rollDefinitions?.find(
          (candidate) => candidate.id === input.rollDefinitionId
        )
        if (!feature || !definition) {
          throw new EncounterValidationError('Enemy roll definition was not found.')
        }
        const maximum = featureChargeMaximum(current, feature)
        const used = featureChargeUsed(current, feature.id)
        if (definition.chargeCost) {
          if (maximum === null || used + definition.chargeCost > maximum) {
            throw new EncounterValidationError('The enemy feature does not have enough charges.')
          }
          await repository.updateActor({
            ...current,
            resources: withFeatureChargeUsed(current, feature.id, used + definition.chargeCost)
          })
        }
        const result = executeEnemyRoll(definition.expression, definition.rollMode ?? 'NORMAL')
        const ruleset = current.systemId ? await repository.findRuleset(current.systemId) : null
        if (!ruleset) throw new EncounterValidationError('Enemy system ruleset was not found.')
        rolled = {
          id: result.id,
          normalizedExpression: result.normalizedExpression,
          evidence: result.evidence,
          characterId: null,
          characterLabel: current.label,
          source: {
            kind: definition.kind,
            label: `${feature.label}: ${definition.label}`.slice(0, 80)
          },
          ruleset,
          createdAt: new Date().toISOString()
        }
        if (input.visibility === 'TABLE') {
          tableEntry = await insertPreEvaluatedCampaignTableRoll(
            trx,
            {
              campaignId: locked.campaignId,
              clientNonce: input.commandId,
              roll: rolled
            },
            userId
          )
        }
        break
      }
      case 'COMPLETE':
        if (locked.status !== 'ACTIVE')
          throw new EncounterConflictError('Only active Encounters can complete.')
        nextStatus = 'COMPLETED'
        nextCurrentActorId = null
        break
    }

    const nextVersion = locked.version + 1
    await repository.update({
      encounterId: locked.id,
      status: nextStatus,
      version: nextVersion,
      round: nextRound,
      currentActorId: nextCurrentActorId
    })
    const updated = await repository.find(locked.id)
    if (!updated) throw new EncounterNotFoundError()
    const command = encounterCommandResultDtoSchema.parse({
      projection: projectGm(updated),
      roll: rolled
    })
    await repository.appendEvent({
      id: randomUUID(),
      encounterId: updated.id,
      campaignId: updated.campaignId,
      version: nextVersion,
      commandId: input.commandId,
      commandType: input.type,
      commandFingerprint,
      commandPayload: input as unknown as Json,
      resultPayload: command as unknown as Json,
      actorUserId: userId,
      correlationId
    })
    return { command, tableEntry }
  })
  if (tableEntry) {
    await broadcastCampaignInvalidation(db, tableEntry.campaignId, {
      scope: 'TABLE',
      entity: 'CHAT',
      entityId: tableEntry.id,
      event: 'CREATED',
      eventId: randomUUID(),
      cursor: tableEntry.createdAt
    })
  }
  return command
}

export async function getEncounterProjection(
  db: DBLike,
  userId: string,
  encounterId: string
): Promise<EncounterGmProjectionDto | EncounterPlayerProjectionDto> {
  const encounter = await createEncounterRepository(db).find(encounterId)
  if (!encounter) throw new EncounterNotFoundError()
  const authority = await resolveCampaignAuthority(db, encounter.campaignId, userId)
  assertActiveCampaignMember(authority)
  return authority.membership.role === 'OWNER' ? projectGm(encounter) : projectPlayer(encounter)
}

export async function getActiveEncounterProjection(
  db: DBLike,
  userId: string,
  campaignId: string
): Promise<EncounterGmProjectionDto | EncounterPlayerProjectionDto | null> {
  const authority = await resolveCampaignAuthority(db, campaignId, userId)
  assertActiveCampaignMember(authority)
  const encounter = await createEncounterRepository(db).findActiveForCampaign(campaignId)
  if (!encounter) return null
  return authority.membership.role === 'OWNER' ? projectGm(encounter) : projectPlayer(encounter)
}

export async function listCampaignEncounterProjections(
  db: DBLike,
  userId: string,
  campaignId: string
): Promise<Array<EncounterGmProjectionDto | EncounterPlayerProjectionDto>> {
  const authority = await resolveCampaignAuthority(db, campaignId, userId)
  assertActiveCampaignMember(authority)
  const encounters = await createEncounterRepository(db).listForCampaign(campaignId)
  return authority.membership.role === 'OWNER'
    ? encounters.map(projectGm)
    : encounters.filter((encounter) => encounter.status === 'ACTIVE').map(projectPlayer)
}

function eventVisibility(event: {
  commandType: string
  commandPayload: Json
}): 'PRIVATE' | 'TABLE' {
  if (
    event.commandType === 'ROLL_ENEMY_ACTION' &&
    typeof event.commandPayload === 'object' &&
    event.commandPayload !== null &&
    !Array.isArray(event.commandPayload) &&
    event.commandPayload.visibility === 'TABLE'
  )
    return 'TABLE'
  return 'PRIVATE'
}

function eventRoll(resultPayload: Json): RollRecordDto | null {
  const parsed = encounterCommandResultDtoSchema.safeParse(resultPayload)
  return parsed.success ? parsed.data.roll : null
}

export async function getEncounterTimeline(
  db: DBLike,
  userId: string,
  input: { encounterId: string; cursor?: string; limit: number }
): Promise<EncounterTimelineDto> {
  const encounter = await createEncounterRepository(db).find(input.encounterId)
  if (!encounter) throw new EncounterNotFoundError()
  const authority = await resolveCampaignAuthority(db, encounter.campaignId, userId)
  assertActiveCampaignMember(authority)
  const events = await createEncounterRepository(db).listEventsPage(
    encounter.id,
    input.cursor,
    input.limit + 1
  )
  const visible =
    authority.membership.role === 'OWNER'
      ? events
      : events.filter((event) => eventVisibility(event) === 'TABLE')
  const entries = visible.slice(0, input.limit).map((event) => ({
    id: event.id,
    version: event.version,
    commandType: event.commandType,
    visibility: eventVisibility(event),
    actorUserId: event.actorUserId,
    createdAt: event.createdAt,
    roll: eventRoll(event.resultPayload)
  }))
  return encounterTimelineDtoSchema.parse({
    entries,
    nextCursor: visible.length > input.limit ? (entries.at(-1)?.id ?? null) : null
  })
}
