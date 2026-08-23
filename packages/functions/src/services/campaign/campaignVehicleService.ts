import {
  createCampaignContentShareRepository,
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

async function lockCurrentVehicleDefinitionForUse(
  db: DBLike,
  campaignId: string,
  vehicleDefinitionId: string
): Promise<boolean> {
  const repository = createCampaignContentShareRepository(db)
  const share = await repository.findShare({
    campaignId,
    subjectKind: 'VEHICLE',
    subjectId: vehicleDefinitionId
  })
  if (!share) {
    return (
      (
        await repository.lockCurrentRoot({
          subjectKind: 'VEHICLE',
          subjectId: vehicleDefinitionId
        })
      )?.isMaster === true
    )
  }

  const current = (await repository.listCurrentSources(campaignId)).find(
    (candidate) =>
      candidate.share.subjectKind === 'VEHICLE' &&
      candidate.share.subjectId === vehicleDefinitionId &&
      candidate.share.sharedBy === share.sharedBy
  )
  if (!current) return false
  const locked = await repository.lockSharesForUse({
    campaignId,
    shares: [
      {
        subjectKind: 'VEHICLE',
        subjectId: vehicleDefinitionId,
        sharedBy: share.sharedBy,
        versionId: current.source.authored.versionId,
        version: current.source.authored.version,
        checksum: current.source.authored.checksum
      }
    ]
  })
  return locked.missing.length === 0
}

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
    if (
      !(await lockCurrentVehicleDefinitionForUse(trx, input.campaignId, input.vehicleDefinitionId))
    ) {
      throw new CampaignAccessError(
        'Choose a current Master Vehicle or a Vehicle shared with this Campaign.'
      )
    }
    return createCampaignVehicleRepository(trx).insert({
      campaignId: input.campaignId,
      vehicleDefinitionId: input.vehicleDefinitionId,
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
    const repository = createCampaignVehicleRepository(trx)
    const existing = await repository.find(input.campaignId, input.vehicleId)
    if (
      !existing ||
      !(await lockCurrentVehicleDefinitionForUse(
        trx,
        input.campaignId,
        existing.vehicleDefinitionId
      ))
    ) {
      throw new CampaignAccessError('This Campaign Vehicle definition is no longer available.')
    }
    const saved = await repository.update({
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
