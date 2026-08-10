import * as encounterContracts from '@artificer-toolkit/schema/api/encounters'
import {
  createImageUploadIntentOutputSchema,
  finalizeImageUploadOutputSchema,
  signedImageDeliveryDtoSchema,
  type AttachImageInput,
  type CreateImageUploadIntentInput,
  type FinalizeImageUploadInput,
  type ImageLookupInput,
  type RemoveImageInput
} from '@artificer-toolkit/schema/api/media'
import {
  executeDiceConfigurationInputDtoSchema,
  rollHistoryResponseDtoSchema,
  rollRecordDtoSchema,
  rollResultDtoSchema,
  type ExecuteDiceConfigurationInputDto,
  type ExecuteRollInputDto
} from '@artificer-toolkit/schema/api/rolls'
import {
  nodeRuntimeNormalizeValuesResponseDtoSchema,
  nodeRuntimeResolveResponseDtoSchema,
  type NodeRuntimeNormalizeValuesRequestDto,
  type NodeRuntimeResolveRequestDto
} from '@artificer-toolkit/schema/api/nodeRuntime'
import {
  routeIdentityDtoSchema,
  type RouteIdentityBySubjectRequestDto,
  type RouteIdentityResolveRequestDto
} from '@artificer-toolkit/schema/api/routeIds'
import {
  systemListResponseDtoSchema,
  systemResponseDtoSchema
} from '@artificer-toolkit/schema/api/systems'
import { okResponseSchema, request, type SchemaInput, type TrpcClient } from './transport'

export function buildPlatformApi(client: TrpcClient) {
  return {
    rolls: {
      clearHistory: () =>
        request('rolls.clearHistory', okResponseSchema, () => client.rolls.clearHistory.mutate()),
      discard: (id: string) =>
        request('rolls.discard', okResponseSchema, () => client.rolls.discard.mutate({ id })),
      executeConfiguration: (input: ExecuteDiceConfigurationInputDto) =>
        request('rolls.executeConfiguration', rollResultDtoSchema, () =>
          client.rolls.executeConfiguration.mutate(
            executeDiceConfigurationInputDtoSchema.parse(input)
          )
        ),
      execute: (input: ExecuteRollInputDto) =>
        request('rolls.execute', rollRecordDtoSchema, () => client.rolls.execute.mutate(input)),
      history: () =>
        request('rolls.history', rollHistoryResponseDtoSchema, () => client.rolls.history.query())
    },
    encounters: {
      templates: {
        list: (campaignId: string) =>
          request(
            'encounters.templates.list',
            encounterContracts.encounterTemplateListDtoSchema,
            () => client.encounters.templates.list.query({ campaignId })
          ),
        create: (input: encounterContracts.CreateEncounterTemplateInputDto) =>
          request(
            'encounters.templates.create',
            encounterContracts.encounterTemplateDtoSchema,
            () => client.encounters.templates.create.mutate(input)
          )
      },
      create: (input: encounterContracts.CreateEncounterInputDto) =>
        request('encounters.create', encounterContracts.encounterGmProjectionDtoSchema, () =>
          client.encounters.create.mutate(input)
        ),
      get: (encounterId: string) =>
        request('encounters.get', encounterContracts.encounterProjectionDtoSchema, () =>
          client.encounters.get.query({ encounterId })
        ),
      active: (campaignId: string) =>
        request(
          'encounters.active',
          encounterContracts.encounterProjectionDtoSchema.nullable(),
          () => client.encounters.active.query({ campaignId })
        ),
      list: (campaignId: string) =>
        request('encounters.list', encounterContracts.encounterProjectionListDtoSchema, () =>
          client.encounters.list.query({ campaignId })
        ),
      command: (input: encounterContracts.EncounterCommandInputDto) =>
        request('encounters.command', encounterContracts.encounterCommandResultDtoSchema, () =>
          client.encounters.command.mutate(input)
        ),
      timeline: (
        input: SchemaInput<typeof encounterContracts.getEncounterTimelineInputDtoSchema>
      ) =>
        request('encounters.timeline', encounterContracts.encounterTimelineDtoSchema, () =>
          client.encounters.timeline.query(input)
        )
    },
    systems: {
      get: (id: string) =>
        request('systems.get', systemResponseDtoSchema, () => client.systems.get.query({ id })),
      list: () =>
        request('systems.list', systemListResponseDtoSchema, () => client.systems.list.query())
    },
    media: {
      attachImage: (input: AttachImageInput) =>
        request('media.attachImage', okResponseSchema, () =>
          client.media.attachImage.mutate(input)
        ),
      createImageUpload: (input: CreateImageUploadIntentInput) =>
        request('media.createImageUpload', createImageUploadIntentOutputSchema, () =>
          client.media.createImageUpload.mutate(input)
        ),
      finalizeImageUpload: (input: FinalizeImageUploadInput) =>
        request('media.finalizeImageUpload', finalizeImageUploadOutputSchema, () =>
          client.media.finalizeImageUpload.mutate(input)
        ),
      getImage: (input: ImageLookupInput) =>
        request('media.getImage', signedImageDeliveryDtoSchema.nullable(), () =>
          client.media.getImage.query(input)
        ),
      removeImage: (input: RemoveImageInput) =>
        request('media.removeImage', okResponseSchema, () => client.media.removeImage.mutate(input))
    },
    nodeRuntime: {
      normalizeValues: (input: NodeRuntimeNormalizeValuesRequestDto) =>
        request('nodeRuntime.normalizeValues', nodeRuntimeNormalizeValuesResponseDtoSchema, () =>
          client.nodeRuntime.normalizeValues.mutate(input)
        ),
      resolve: (input: NodeRuntimeResolveRequestDto) =>
        request('nodeRuntime.resolve', nodeRuntimeResolveResponseDtoSchema, () =>
          client.nodeRuntime.resolve.mutate(input)
        )
    },
    routeIds: {
      bySubject: (input: RouteIdentityBySubjectRequestDto) =>
        request('routeIds.bySubject', routeIdentityDtoSchema.nullable(), () =>
          client.routeIds.bySubject.query(input)
        ),
      resolve: (input: RouteIdentityResolveRequestDto) =>
        request('routeIds.resolve', routeIdentityDtoSchema.nullable(), () =>
          client.routeIds.resolve.query(input)
        )
    }
  }
}

export type PlatformApi = ReturnType<typeof buildPlatformApi>
