import { sql } from 'kysely'

import {
  campaignCharacterMechanicsProjectionSchema,
  type CampaignCharacterMechanicsProjection,
  type ResolvedCampaignCharacterMechanicsProjection
} from '@artificer-toolkit/schema/projections/campaignCharacterMechanics'
import type { CharacterMechanicsProjection } from '@artificer-toolkit/schema/projections/characterMechanics'

import type { DBLike } from '#types'
import { checksumCampaignCharacterMechanicsProjection } from '../utils/index.js'

interface AssignmentRow {
  campaign_id: string
  character_id: string
}

interface CampaignCharacterMechanicsProjectionRow {
  base_mechanics_projection_checksum: string
  campaign_id: string
  character_id: string
  mechanical_context_checksum: string
  projection_checksum: string
  projection_schema_version: number
  projection_kind: 'BASE_REFERENCE' | 'MATERIALIZED'
  rule_policy_input: unknown | null
  rule_policy_output: unknown | null
  stream_version: number
}

interface CurrentCampaignCharacterMechanicsProjectionRow
  extends CampaignCharacterMechanicsProjectionRow {
  base_projection_checksum: string
  base_stream_version: number
  character_stream_version: number
}

export interface CampaignCharacterMechanicsProjectionMetadata
  extends CampaignCharacterMechanicsProjectionIdentity {
  kind: CampaignCharacterMechanicsProjection['kind']
  projectionChecksum: string
}

export class CampaignCharacterMechanicsProjectionMismatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CampaignCharacterMechanicsProjectionMismatchError'
  }
}

export interface CampaignCharacterMechanicsProjectionIdentity {
  baseMechanicsProjectionChecksum: string
  characterStreamVersion: number
  mechanicalContextChecksum: string
  projectionSchemaVersion: number
}

export function hasSameCampaignCharacterMechanicsProjectionIdentity(
  left: CampaignCharacterMechanicsProjectionIdentity,
  right: CampaignCharacterMechanicsProjectionIdentity
): boolean {
  return (
    left.characterStreamVersion === right.characterStreamVersion &&
    left.baseMechanicsProjectionChecksum === right.baseMechanicsProjectionChecksum &&
    left.mechanicalContextChecksum === right.mechanicalContextChecksum &&
    left.projectionSchemaVersion === right.projectionSchemaVersion
  )
}

export type CampaignCharacterMechanicsProjectionPublicationDecision =
  | 'PUBLISH'
  | 'IDEMPOTENT'
  | 'REJECT_EXPECTED_PRIOR'
  | 'REJECT_CONFLICT'

export function decideCampaignCharacterMechanicsProjectionPublication(input: {
  candidate: CampaignCharacterMechanicsProjectionIdentity & { projectionChecksum: string }
  existing: (CampaignCharacterMechanicsProjectionIdentity & { projectionChecksum: string }) | null
  expectedPriorOverlayChecksum: string | null
}): CampaignCharacterMechanicsProjectionPublicationDecision {
  if (!input.existing) {
    return input.expectedPriorOverlayChecksum === null ? 'PUBLISH' : 'REJECT_EXPECTED_PRIOR'
  }
  if (input.expectedPriorOverlayChecksum !== input.existing.projectionChecksum) {
    return 'REJECT_EXPECTED_PRIOR'
  }
  if (!hasSameCampaignCharacterMechanicsProjectionIdentity(input.existing, input.candidate)) {
    return 'PUBLISH'
  }
  return input.existing.projectionChecksum === input.candidate.projectionChecksum
    ? 'IDEMPOTENT'
    : 'REJECT_CONFLICT'
}

export function assertCurrentCampaignCharacterMechanicsProjection(input: {
  current: CampaignCharacterMechanicsProjectionIdentity & { projectionChecksum: string }
  expectedBaseMechanicsProjectionChecksum: string
  expectedCharacterStreamVersion: number
  expectedMechanicalContextChecksum: string
  expectedProjectionSchemaVersion: number
  liveBaseMechanicsProjectionChecksum: string
  liveBaseStreamVersion: number
  liveCharacterStreamVersion: number
}): void {
  const { current } = input
  if (
    input.liveCharacterStreamVersion !== current.characterStreamVersion ||
    input.liveBaseStreamVersion !== current.characterStreamVersion ||
    input.liveBaseMechanicsProjectionChecksum !== current.baseMechanicsProjectionChecksum
  ) {
    throw new CampaignCharacterMechanicsProjectionMismatchError(
      'Campaign Character mechanics overlay is stale against its live Character mechanics projection.'
    )
  }
  if (current.characterStreamVersion !== input.expectedCharacterStreamVersion) {
    throw new CampaignCharacterMechanicsProjectionMismatchError(
      'Campaign Character mechanics overlay stream version does not match the command expectation.'
    )
  }
  if (current.baseMechanicsProjectionChecksum !== input.expectedBaseMechanicsProjectionChecksum) {
    throw new CampaignCharacterMechanicsProjectionMismatchError(
      'Campaign Character mechanics overlay base projection does not match the command expectation.'
    )
  }
  if (current.mechanicalContextChecksum !== input.expectedMechanicalContextChecksum) {
    throw new CampaignCharacterMechanicsProjectionMismatchError(
      'Campaign Character mechanics overlay mechanical context does not match the command expectation.'
    )
  }
  if (current.projectionSchemaVersion !== input.expectedProjectionSchemaVersion) {
    throw new CampaignCharacterMechanicsProjectionMismatchError(
      'Campaign Character mechanics overlay schema version does not match the command expectation.'
    )
  }
}

function mapProjection(
  row: CampaignCharacterMechanicsProjectionRow
): CampaignCharacterMechanicsProjection {
  const projection = campaignCharacterMechanicsProjectionSchema.parse({
    campaignId: row.campaign_id,
    characterId: row.character_id,
    characterStreamVersion: row.stream_version,
    baseMechanicsProjectionChecksum: row.base_mechanics_projection_checksum,
    mechanicalContextChecksum: row.mechanical_context_checksum,
    projectionSchemaVersion: row.projection_schema_version,
    projectionChecksum: row.projection_checksum,
    kind: row.projection_kind,
    ...(row.projection_kind === 'MATERIALIZED'
      ? {
          rulePolicyInput: row.rule_policy_input,
          rulePolicyOutput: row.rule_policy_output
        }
      : {})
  })
  if (checksumCampaignCharacterMechanicsProjection(projection) !== projection.projectionChecksum) {
    throw new CampaignCharacterMechanicsProjectionMismatchError(
      `Campaign "${projection.campaignId}" Character "${projection.characterId}" has an overlay projection with an invalid checksum.`
    )
  }
  return projection
}

async function lockAssignment(db: DBLike, campaignId: string, characterId: string): Promise<AssignmentRow | null> {
  const result = await sql<AssignmentRow>`
    select campaign_id, character_id
    from public.campaign_character_assignments
    where campaign_id = ${campaignId}
      and character_id = ${characterId}
    for update
  `.execute(db)
  return result.rows[0] ?? null
}

async function readCurrentProjection(
  db: DBLike,
  campaignId: string,
  characterId: string
): Promise<
  | {
      baseMechanicsProjectionChecksum: string
      baseStreamVersion: number
      characterStreamVersion: number
      projection: CampaignCharacterMechanicsProjection
    }
  | null
> {
  const result = await sql<CurrentCampaignCharacterMechanicsProjectionRow>`
    select
      overlay.campaign_id,
      overlay.character_id,
      overlay.stream_version,
      overlay.base_mechanics_projection_checksum,
      overlay.mechanical_context_checksum,
      overlay.projection_schema_version,
      overlay.projection_checksum,
      overlay.projection_kind,
      overlay.rule_policy_input,
      overlay.rule_policy_output,
      character.stream_version as character_stream_version,
      base.stream_version as base_stream_version,
      base.projection_checksum as base_projection_checksum
    from public.campaign_character_mechanics_projections overlay
    join public.campaign_character_assignments assignment
      on assignment.campaign_id = overlay.campaign_id
      and assignment.character_id = overlay.character_id
    join public.characters character
      on character.id = overlay.character_id
    join public.character_mechanics_projections base
      on base.character_id = overlay.character_id
    where overlay.campaign_id = ${campaignId}
      and overlay.character_id = ${characterId}
    limit 1
  `.execute(db)
  const row = result.rows[0]
  return row
    ? {
        characterStreamVersion: row.character_stream_version,
        baseMechanicsProjectionChecksum: row.base_projection_checksum,
        baseStreamVersion: row.base_stream_version,
        projection: mapProjection(row)
      }
    : null
}

async function readCurrentProjectionMetadata(
  db: DBLike,
  campaignId: string,
  characterId: string
): Promise<
  | {
      baseMechanicsProjectionChecksum: string
      baseStreamVersion: number
      characterStreamVersion: number
      projection: CampaignCharacterMechanicsProjectionMetadata
    }
  | null
> {
  const result = await sql<
    Pick<
      CurrentCampaignCharacterMechanicsProjectionRow,
      | 'base_mechanics_projection_checksum'
      | 'base_projection_checksum'
      | 'base_stream_version'
      | 'campaign_id'
      | 'character_id'
      | 'character_stream_version'
      | 'mechanical_context_checksum'
      | 'projection_checksum'
      | 'projection_kind'
      | 'projection_schema_version'
      | 'stream_version'
    >
  >`
    select
      overlay.stream_version,
      overlay.base_mechanics_projection_checksum,
      overlay.mechanical_context_checksum,
      overlay.projection_schema_version,
      overlay.projection_checksum,
      overlay.projection_kind,
      character.stream_version as character_stream_version,
      base.stream_version as base_stream_version,
      base.projection_checksum as base_projection_checksum
    from public.campaign_character_mechanics_projections overlay
    join public.campaign_character_assignments assignment
      on assignment.campaign_id = overlay.campaign_id
      and assignment.character_id = overlay.character_id
    join public.characters character on character.id = overlay.character_id
    join public.character_mechanics_projections base on base.character_id = overlay.character_id
    where overlay.campaign_id = ${campaignId}
      and overlay.character_id = ${characterId}
    limit 1
  `.execute(db)
  const row = result.rows[0]
  return row
    ? {
        characterStreamVersion: row.character_stream_version,
        baseMechanicsProjectionChecksum: row.base_projection_checksum,
        baseStreamVersion: row.base_stream_version,
        projection: {
          characterStreamVersion: row.stream_version,
          baseMechanicsProjectionChecksum: row.base_mechanics_projection_checksum,
          mechanicalContextChecksum: row.mechanical_context_checksum,
          projectionSchemaVersion: row.projection_schema_version,
          projectionChecksum: row.projection_checksum,
          kind: row.projection_kind
        }
      }
    : null
}

export interface CampaignCharacterMechanicsProjectionRepository {
  lockAssignment(input: { campaignId: string; characterId: string }): Promise<void>
  publish(input: {
    expectedPriorOverlayChecksum: string | null
    projection: CampaignCharacterMechanicsProjection
  }): Promise<CampaignCharacterMechanicsProjection>
  requireCurrent(input: {
    campaignId: string
    characterId: string
    expectedBaseMechanicsProjectionChecksum: string
    expectedCharacterStreamVersion: number
    expectedMechanicalContextChecksum: string
    expectedProjectionSchemaVersion: number
    baseMechanicsProjection: Pick<
      CharacterMechanicsProjection,
      'characterId' | 'characterStreamVersion' | 'projectionChecksum' | 'rulePolicyInput' | 'rulePolicyOutput'
    >
  }): Promise<ResolvedCampaignCharacterMechanicsProjection>
  requireCurrentMetadata(input: {
    campaignId: string
    characterId: string
    expectedBaseMechanicsProjectionChecksum: string
    expectedCharacterStreamVersion: number
    expectedMechanicalContextChecksum: string
    expectedProjectionChecksum: string
    expectedProjectionSchemaVersion: number
  }): Promise<CampaignCharacterMechanicsProjectionMetadata>
}

export function createCampaignCharacterMechanicsProjectionRepository(
  db: DBLike
): CampaignCharacterMechanicsProjectionRepository {
  return {
    async lockAssignment(input) {
      const assignment = await lockAssignment(db, input.campaignId, input.characterId)
      if (!assignment) {
        throw new CampaignCharacterMechanicsProjectionMismatchError(
          `Campaign "${input.campaignId}" no longer assigns Character "${input.characterId}".`
        )
      }
    },
    async publish(input) {
      const projection = campaignCharacterMechanicsProjectionSchema.parse(input.projection)
      if (checksumCampaignCharacterMechanicsProjection(projection) !== projection.projectionChecksum) {
        throw new CampaignCharacterMechanicsProjectionMismatchError(
          `Campaign "${projection.campaignId}" Character "${projection.characterId}" overlay projection checksum does not match its contents.`
        )
      }

      const result = await sql<CampaignCharacterMechanicsProjectionRow>`
          insert into public.campaign_character_mechanics_projections (
            campaign_id,
            character_id,
            stream_version,
            base_mechanics_projection_checksum,
            mechanical_context_checksum,
            projection_schema_version,
            projection_checksum,
            projection_kind,
            rule_policy_input,
            rule_policy_output,
            updated_at
          )
          select
            ${projection.campaignId},
            ${projection.characterId},
            ${projection.characterStreamVersion},
            ${projection.baseMechanicsProjectionChecksum},
            ${projection.mechanicalContextChecksum},
            ${projection.projectionSchemaVersion},
            ${projection.projectionChecksum},
            ${projection.kind},
            ${projection.kind === 'MATERIALIZED' ? JSON.stringify(projection.rulePolicyInput) : null}::jsonb,
            ${projection.kind === 'MATERIALIZED' ? JSON.stringify(projection.rulePolicyOutput) : null}::jsonb,
            now()
          from public.campaign_character_assignments assignment
          join public.characters character on character.id = assignment.character_id
          join public.character_mechanics_projections base on base.character_id = assignment.character_id
          where assignment.campaign_id = ${projection.campaignId}
            and assignment.character_id = ${projection.characterId}
            and character.stream_version = ${projection.characterStreamVersion}
            and base.stream_version = ${projection.characterStreamVersion}
            and base.projection_checksum = ${projection.baseMechanicsProjectionChecksum}
            and (
              ${input.expectedPriorOverlayChecksum}::text is null
              or exists (
                select 1
                from public.campaign_character_mechanics_projections current
                where current.campaign_id = ${projection.campaignId}
                  and current.character_id = ${projection.characterId}
                  and current.projection_checksum = ${input.expectedPriorOverlayChecksum}
              )
            )
          on conflict (campaign_id, character_id) do update set
            stream_version = excluded.stream_version,
            base_mechanics_projection_checksum = excluded.base_mechanics_projection_checksum,
            mechanical_context_checksum = excluded.mechanical_context_checksum,
            projection_schema_version = excluded.projection_schema_version,
            projection_checksum = excluded.projection_checksum,
            projection_kind = excluded.projection_kind,
            rule_policy_input = excluded.rule_policy_input,
            rule_policy_output = excluded.rule_policy_output,
            updated_at = now()
          where public.campaign_character_mechanics_projections.projection_checksum = ${input.expectedPriorOverlayChecksum}
            and (
              public.campaign_character_mechanics_projections.projection_checksum = excluded.projection_checksum
              or public.campaign_character_mechanics_projections.stream_version <> excluded.stream_version
              or public.campaign_character_mechanics_projections.base_mechanics_projection_checksum <> excluded.base_mechanics_projection_checksum
              or public.campaign_character_mechanics_projections.mechanical_context_checksum <> excluded.mechanical_context_checksum
              or public.campaign_character_mechanics_projections.projection_schema_version <> excluded.projection_schema_version
            )
          returning
            campaign_id,
            character_id,
            stream_version,
            base_mechanics_projection_checksum,
            mechanical_context_checksum,
            projection_schema_version,
            projection_checksum,
            projection_kind,
            rule_policy_input,
            rule_policy_output
      `.execute(db)
      const row = result.rows[0]
      if (!row) {
        throw new CampaignCharacterMechanicsProjectionMismatchError(
          `Campaign "${projection.campaignId}" Character "${projection.characterId}" overlay publication lost assignment, base, or compare-and-swap currentness.`
        )
      }
      return mapProjection(row)
    },

    async requireCurrent(input) {
      const current = await readCurrentProjection(db, input.campaignId, input.characterId)
      if (!current) {
        throw new CampaignCharacterMechanicsProjectionMismatchError(
          `Campaign "${input.campaignId}" Character "${input.characterId}" has no current mechanics overlay.`
        )
      }
      assertCurrentCampaignCharacterMechanicsProjection({
        current: current.projection,
        expectedBaseMechanicsProjectionChecksum: input.expectedBaseMechanicsProjectionChecksum,
        expectedCharacterStreamVersion: input.expectedCharacterStreamVersion,
        expectedMechanicalContextChecksum: input.expectedMechanicalContextChecksum,
        expectedProjectionSchemaVersion: input.expectedProjectionSchemaVersion,
        liveBaseMechanicsProjectionChecksum: current.baseMechanicsProjectionChecksum,
        liveBaseStreamVersion: current.baseStreamVersion,
        liveCharacterStreamVersion: current.characterStreamVersion
      })
      if (
        input.baseMechanicsProjection.characterId !== input.characterId ||
        input.baseMechanicsProjection.characterStreamVersion !== input.expectedCharacterStreamVersion ||
        input.baseMechanicsProjection.projectionChecksum !== input.expectedBaseMechanicsProjectionChecksum
      ) {
        throw new CampaignCharacterMechanicsProjectionMismatchError(
          'Campaign Character mechanics overlay base projection input does not match the required live identity.'
        )
      }
      return current.projection.kind === 'BASE_REFERENCE'
        ? {
            ...current.projection,
            rulePolicyInput: input.baseMechanicsProjection.rulePolicyInput,
            rulePolicyOutput: input.baseMechanicsProjection.rulePolicyOutput
          }
        : current.projection
    },

    async requireCurrentMetadata(input) {
      const current = await readCurrentProjectionMetadata(db, input.campaignId, input.characterId)
      if (!current) {
        throw new CampaignCharacterMechanicsProjectionMismatchError(
          `Campaign "${input.campaignId}" Character "${input.characterId}" has no current mechanics overlay.`
        )
      }
      assertCurrentCampaignCharacterMechanicsProjection({
        current: current.projection,
        expectedBaseMechanicsProjectionChecksum: input.expectedBaseMechanicsProjectionChecksum,
        expectedCharacterStreamVersion: input.expectedCharacterStreamVersion,
        expectedMechanicalContextChecksum: input.expectedMechanicalContextChecksum,
        expectedProjectionSchemaVersion: input.expectedProjectionSchemaVersion,
        liveBaseMechanicsProjectionChecksum: current.baseMechanicsProjectionChecksum,
        liveBaseStreamVersion: current.baseStreamVersion,
        liveCharacterStreamVersion: current.characterStreamVersion
      })
      const projection = campaignCharacterMechanicsProjectionSchema.parse({
        campaignId: input.campaignId,
        characterId: input.characterId,
        ...current.projection
      })
      if (projection.kind !== 'BASE_REFERENCE') {
        throw new CampaignCharacterMechanicsProjectionMismatchError(
          'Campaign Character mechanics materialized overlays require an exact policy read.'
        )
      }
      if (checksumCampaignCharacterMechanicsProjection(projection) !== projection.projectionChecksum) {
        throw new CampaignCharacterMechanicsProjectionMismatchError(
          'Campaign Character mechanics base-reference overlay has an invalid checksum.'
        )
      }
      if (current.projection.projectionChecksum !== input.expectedProjectionChecksum) {
        throw new CampaignCharacterMechanicsProjectionMismatchError(
          'Campaign Character mechanics overlay checksum does not match the room snapshot expectation.'
        )
      }
      return projection
    }
  }
}
