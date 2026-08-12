import {
  createCampaignContentRepository,
  createCampaignRepository,
  createCampaignVehicleRepository,
  withTransaction,
  type DBLike
} from '@artificer-toolkit/db'
import {
  campaignVehicleDtoSchema,
  campaignVehiclesDtoSchema,
  type CampaignVehicleDto,
  type CreateCampaignVehicleInput,
  type UpdateCampaignVehicleInput
} from '@artificer-toolkit/schema/api/campaigns'
import {
  assertActiveCampaignMember,
  assertCampaignOwner,
  assertCampaignWritable,
  CampaignAccessError,
  CampaignConflictError,
  resolveCampaignAuthority
} from './campaignService.js'

export async function listCampaignVehicles(db: DBLike, userId: string, campaignId: string) {
  const authority = await resolveCampaignAuthority(db, campaignId, userId)
  assertActiveCampaignMember(authority)
  return campaignVehiclesDtoSchema.parse(await createCampaignVehicleRepository(db).list(campaignId))
}

export async function createCampaignVehicle(
  db: DBLike,
  userId: string,
  input: CreateCampaignVehicleInput
): Promise<CampaignVehicleDto> {
  const vehicle = await withTransaction(db, async (trx) => {
    await createCampaignRepository(trx).lockCampaign(input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    const version = await createCampaignContentRepository(trx).findContentVersion({
      campaignId: input.campaignId,
      id: input.contentVersionId
    })
    if (!version || version.subjectKind !== 'VEHICLE' || version.state !== 'APPROVED') {
      throw new CampaignAccessError('Choose an approved Vehicle revision from this Campaign.')
    }
    return createCampaignVehicleRepository(trx).insert({
      campaignId: input.campaignId,
      contentVersionId: input.contentVersionId,
      label: input.label ?? null
    })
  })
  return campaignVehicleDtoSchema.parse(vehicle)
}

export async function updateCampaignVehicle(
  db: DBLike,
  userId: string,
  input: UpdateCampaignVehicleInput
): Promise<CampaignVehicleDto> {
  const vehicle = await withTransaction(db, async (trx) => {
    await createCampaignRepository(trx).lockCampaign(input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    const saved = await createCampaignVehicleRepository(trx).update({
      campaignId: input.campaignId,
      id: input.vehicleId,
      label: input.label,
      expectedVersion: input.expectedVersion
    })
    if (!saved) throw new CampaignConflictError()
    return saved
  })
  return campaignVehicleDtoSchema.parse(vehicle)
}

export async function deleteCampaignVehicle(
  db: DBLike,
  userId: string,
  input: { campaignId: string; vehicleId: string; expectedVersion: number }
): Promise<void> {
  await withTransaction(db, async (trx) => {
    await createCampaignRepository(trx).lockCampaign(input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    if (
      !(await createCampaignVehicleRepository(trx).delete({
        campaignId: input.campaignId,
        id: input.vehicleId,
        expectedVersion: input.expectedVersion
      }))
    )
      throw new CampaignConflictError()
  })
}
