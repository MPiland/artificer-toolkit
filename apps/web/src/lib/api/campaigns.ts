import * as campaignContracts from '@artificer-toolkit/schema/api/campaigns'
import { rollRecordDtoSchema } from '@artificer-toolkit/schema/api/rolls'
import { okResponseSchema, request, type SchemaInput, type TrpcClient } from './transport'

export function buildCampaignsApi(client: TrpcClient) {
  return {
    list: () =>
      request('campaigns.list', campaignContracts.campaignSummariesDtoSchema, () =>
        client.campaigns.list.query()
      ),
    get: (campaignId: string) =>
      request('campaigns.get', campaignContracts.campaignDetailDtoSchema, () =>
        client.campaigns.get.query({ campaignId })
      ),
    create: (input: campaignContracts.CreateCampaignInput) =>
      request('campaigns.create', campaignContracts.campaignDetailDtoSchema, () =>
        client.campaigns.create.mutate(input)
      ),
    update: (input: campaignContracts.UpdateCampaignInput) =>
      request('campaigns.update', campaignContracts.campaignDetailDtoSchema, () =>
        client.campaigns.update.mutate(input)
      ),
    archive: (campaignId: string, expectedVersion: number) =>
      request('campaigns.archive', campaignContracts.campaignDetailDtoSchema, () =>
        client.campaigns.archive.mutate({ campaignId, expectedVersion })
      ),
    delete: async (campaignId: string, expectedVersion: number) => {
      await request('campaigns.delete', okResponseSchema, () =>
        client.campaigns.delete.mutate({ campaignId, expectedVersion, confirmation: 'DELETE' })
      )
    },
    invites: {
      create: (input: campaignContracts.CreateCampaignInviteInput) =>
        request('campaigns.invites.create', campaignContracts.campaignInviteDtoSchema, () =>
          client.campaigns.invites.create.mutate(input)
        ),
      revoke: async (campaignId: string, inviteId: string) => {
        await request('campaigns.invites.revoke', okResponseSchema, () =>
          client.campaigns.invites.revoke.mutate({ campaignId, inviteId })
        )
      },
      accept: (token: string) =>
        request('campaigns.invites.accept', campaignContracts.campaignDetailDtoSchema, () =>
          client.campaigns.invites.accept.mutate({ token })
        )
    },
    leave: async (campaignId: string) => {
      await request('campaigns.leave', okResponseSchema, () =>
        client.campaigns.leave.mutate({ campaignId })
      )
    },
    removeMember: async (campaignId: string, userId: string) => {
      await request('campaigns.removeMember', okResponseSchema, () =>
        client.campaigns.removeMember.mutate({ campaignId, userId })
      )
    },
    assignCharacter: async (campaignId: string, characterId: string) => {
      await request('campaigns.assignCharacter', okResponseSchema, () =>
        client.campaigns.assignCharacter.mutate({ campaignId, characterId })
      )
    },
    unassignCharacter: async (campaignId: string, characterId?: string) => {
      await request('campaigns.unassignCharacter', okResponseSchema, () =>
        client.campaigns.unassignCharacter.mutate({ campaignId, characterId })
      )
    },
    conversations: {
      list: (campaignId: string) =>
        request(
          'campaigns.conversations.list',
          campaignContracts.campaignConversationsDtoSchema,
          () => client.campaigns.conversations.list.query({ campaignId })
        ),
      markRead: (
        input: SchemaInput<typeof campaignContracts.markCampaignConversationReadInputSchema>
      ) =>
        request('campaigns.conversations.markRead', okResponseSchema, () =>
          client.campaigns.conversations.markRead.mutate(input)
        )
    },
    chat: {
      list: (
        campaignId: string,
        room: 'TABLE' | 'PARTY' | 'DIRECT',
        cursor?: string,
        limit = 50,
        directUserId?: string
      ) =>
        request('campaigns.chat.list', campaignContracts.campaignChatPageDtoSchema, () =>
          client.campaigns.chat.list.query({ campaignId, room, cursor, limit, directUserId })
        ),
      send: (input: campaignContracts.SendCampaignChatEntryInput) =>
        request('campaigns.chat.send', campaignContracts.campaignChatEntryDtoSchema, () =>
          client.campaigns.chat.send.mutate(input)
        ),
      roll: (input: campaignContracts.ExecuteCampaignRollInput) =>
        request('campaigns.chat.roll', campaignContracts.campaignChatEntryDtoSchema, () =>
          client.campaigns.chat.roll.mutate(input)
        ),
      privateRoll: (input: campaignContracts.ExecuteCampaignPrivateRollInput) =>
        request('campaigns.chat.privateRoll', rollRecordDtoSchema, () =>
          client.campaigns.chat.privateRoll.mutate(input)
        ),
      edit: (campaignId: string, entryId: string, body: string) =>
        request('campaigns.chat.edit', campaignContracts.campaignChatEntryDtoSchema, () =>
          client.campaigns.chat.edit.mutate({ campaignId, entryId, body })
        ),
      unsend: (campaignId: string, entryId: string) =>
        request('campaigns.chat.unsend', campaignContracts.campaignChatEntryDtoSchema, () =>
          client.campaigns.chat.unsend.mutate({ campaignId, entryId })
        )
    },
    notebook: {
      list: (campaignId: string) =>
        request(
          'campaigns.notebook.list',
          campaignContracts.campaignNotebookSectionsDtoSchema,
          () => client.campaigns.notebook.list.query({ campaignId })
        ),
      create: (
        input: SchemaInput<typeof campaignContracts.createCampaignNotebookSectionInputSchema>
      ) =>
        request(
          'campaigns.notebook.create',
          campaignContracts.campaignNotebookSectionDtoSchema,
          () => client.campaigns.notebook.create.mutate(input)
        ),
      update: (
        input: SchemaInput<typeof campaignContracts.updateCampaignNotebookSectionInputSchema>
      ) =>
        request(
          'campaigns.notebook.update',
          campaignContracts.campaignNotebookSectionDtoSchema,
          () => client.campaigns.notebook.update.mutate(input)
        ),
      delete: async (campaignId: string, sectionId: string) => {
        await request('campaigns.notebook.delete', okResponseSchema, () =>
          client.campaigns.notebook.delete.mutate({ campaignId, sectionId })
        )
      }
    },
    sessions: {
      list: (campaignId: string) =>
        request('campaigns.sessions.list', campaignContracts.campaignSessionsDtoSchema, () =>
          client.campaigns.sessions.list.query({ campaignId })
        ),
      create: (input: SchemaInput<typeof campaignContracts.createCampaignSessionInputSchema>) =>
        request('campaigns.sessions.create', campaignContracts.campaignSessionDtoSchema, () =>
          client.campaigns.sessions.create.mutate(input)
        ),
      update: (input: SchemaInput<typeof campaignContracts.updateCampaignSessionInputSchema>) =>
        request('campaigns.sessions.update', campaignContracts.campaignSessionDtoSchema, () =>
          client.campaigns.sessions.update.mutate(input)
        ),
      delete: async (campaignId: string, sessionId: string) => {
        await request('campaigns.sessions.delete', okResponseSchema, () =>
          client.campaigns.sessions.delete.mutate({ campaignId, sessionId })
        )
      },
      finish: (input: SchemaInput<typeof campaignContracts.finishCampaignSessionInputSchema>) =>
        request('campaigns.sessions.finish', campaignContracts.campaignSessionDtoSchema, () =>
          client.campaigns.sessions.finish.mutate(input)
        ),
      reopen: (input: SchemaInput<typeof campaignContracts.reopenCampaignSessionInputSchema>) =>
        request('campaigns.sessions.reopen', campaignContracts.campaignSessionDtoSchema, () =>
          client.campaigns.sessions.reopen.mutate(input)
        ),
      get: (input: SchemaInput<typeof campaignContracts.getCampaignSessionInputSchema>) =>
        request('campaigns.sessions.get', campaignContracts.campaignSessionDtoSchema, () =>
          client.campaigns.sessions.get.query(input)
        ),
      attendance: {
        list: (
          input: SchemaInput<typeof campaignContracts.listCampaignSessionAttendanceInputSchema>
        ) =>
          request(
            'campaigns.sessions.attendance.list',
            campaignContracts.campaignSessionAttendanceDtoListSchema,
            () => client.campaigns.sessions.attendance.list.query(input)
          ),
        set: (
          input: SchemaInput<typeof campaignContracts.setCampaignSessionAttendanceInputSchema>
        ) =>
          request(
            'campaigns.sessions.attendance.set',
            campaignContracts.campaignSessionAttendanceDtoSchema,
            () => client.campaigns.sessions.attendance.set.mutate(input)
          )
      },
      rsvps: {
        list: (campaignId: string, sessionId: string) =>
          request(
            'campaigns.sessions.rsvps.list',
            campaignContracts.campaignSessionRsvpDtoListSchema,
            () => client.campaigns.sessions.rsvps.list.query({ campaignId, sessionId })
          ),
        set: (input: SchemaInput<typeof campaignContracts.setCampaignSessionRsvpInputSchema>) =>
          request(
            'campaigns.sessions.rsvps.set',
            campaignContracts.campaignSessionRsvpDtoSchema,
            () => client.campaigns.sessions.rsvps.set.mutate(input)
          )
      },
      references: {
        list: (campaignId: string, sessionId: string) =>
          request(
            'campaigns.sessions.references.list',
            campaignContracts.campaignSessionReferencePinsDtoSchema,
            () => client.campaigns.sessions.references.list.query({ campaignId, sessionId })
          ),
        create: (
          input: SchemaInput<typeof campaignContracts.createCampaignSessionReferencePinInputSchema>
        ) =>
          request(
            'campaigns.sessions.references.create',
            campaignContracts.campaignSessionReferencePinDtoSchema,
            () => client.campaigns.sessions.references.create.mutate(input)
          ),
        delete: async (campaignId: string, sessionId: string, pinId: string) => {
          await request('campaigns.sessions.references.delete', okResponseSchema, () =>
            client.campaigns.sessions.references.delete.mutate({ campaignId, sessionId, pinId })
          )
        }
      },
      notes: {
        list: (campaignId: string, sessionId: string) =>
          request(
            'campaigns.sessions.notes.list',
            campaignContracts.campaignSessionNoteSectionsDtoSchema,
            () => client.campaigns.sessions.notes.list.query({ campaignId, sessionId })
          ),
        create: (
          input: SchemaInput<typeof campaignContracts.createCampaignSessionNoteSectionInputSchema>
        ) =>
          request(
            'campaigns.sessions.notes.create',
            campaignContracts.campaignSessionNoteSectionDtoSchema,
            () => client.campaigns.sessions.notes.create.mutate(input)
          ),
        update: (
          input: SchemaInput<typeof campaignContracts.updateCampaignSessionNoteSectionInputSchema>
        ) =>
          request(
            'campaigns.sessions.notes.update',
            campaignContracts.campaignSessionNoteSectionDtoSchema,
            () => client.campaigns.sessions.notes.update.mutate(input)
          ),
        delete: async (campaignId: string, sessionId: string, sectionId: string) => {
          await request('campaigns.sessions.notes.delete', okResponseSchema, () =>
            client.campaigns.sessions.notes.delete.mutate({ campaignId, sessionId, sectionId })
          )
        }
      }
    },
    clock: {
      get: (campaignId: string) =>
        request('campaigns.clock.get', campaignContracts.campaignClockDtoSchema.nullable(), () =>
          client.campaigns.clock.get.query({ campaignId })
        ),
      initialize: (input: campaignContracts.InitializeCampaignClockInput) =>
        request('campaigns.clock.initialize', campaignContracts.campaignClockDtoSchema, () =>
          client.campaigns.clock.initialize.mutate(input)
        ),
      configure: (input: campaignContracts.ConfigureCampaignClockInput) =>
        request('campaigns.clock.configure', campaignContracts.campaignClockDtoSchema, () =>
          client.campaigns.clock.configure.mutate(input)
        ),
      start: (input: campaignContracts.StartCampaignClockInput) =>
        request('campaigns.clock.start', campaignContracts.campaignClockDtoSchema, () =>
          client.campaigns.clock.start.mutate(input)
        ),
      pause: (input: campaignContracts.PauseCampaignClockInput) =>
        request('campaigns.clock.pause', campaignContracts.campaignClockDtoSchema, () =>
          client.campaigns.clock.pause.mutate(input)
        ),
      advance: (input: campaignContracts.AdvanceCampaignClockInput) =>
        request('campaigns.clock.advance', campaignContracts.campaignClockDtoSchema, () =>
          client.campaigns.clock.advance.mutate(input)
        ),
      rewind: (input: campaignContracts.RewindCampaignClockInput) =>
        request('campaigns.clock.rewind', campaignContracts.campaignClockDtoSchema, () =>
          client.campaigns.clock.rewind.mutate(input)
        ),
      reconcile: (input: campaignContracts.ReconcileCampaignClockInput) =>
        request('campaigns.clock.reconcile', campaignContracts.campaignClockDtoSchema, () =>
          client.campaigns.clock.reconcile.mutate(input)
        )
    },
    inventory: {
      currencySystems: (campaignId: string) =>
        request(
          'campaigns.inventory.currencySystems',
          campaignContracts.currencySystemDtoSchema.array(),
          () => client.campaigns.inventory.currencySystems.query({ campaignId })
        ),
      get: (campaignId: string, owner: campaignContracts.InventoryOwnerRefDto) =>
        request('campaigns.inventory.get', campaignContracts.inventoryDtoSchema, () =>
          client.campaigns.inventory.get.query({ campaignId, owner })
        ),
      transfer: (input: campaignContracts.TransferCampaignInventoryInput) =>
        request(
          'campaigns.inventory.transfer',
          campaignContracts.campaignInventoryTransferResultDtoSchema,
          () => client.campaigns.inventory.transfer.mutate(input)
        ),
      mutateParty: (input: campaignContracts.CampaignPartyInventoryMutationInput) =>
        request(
          'campaigns.inventory.mutateParty',
          campaignContracts.campaignPartyInventoryMutationResultDtoSchema,
          () => client.campaigns.inventory.mutateParty.mutate(input)
        ),
      audit: (input: campaignContracts.ListCampaignInventoryAuditInput) =>
        request(
          'campaigns.inventory.audit',
          campaignContracts.campaignInventoryAuditPageDtoSchema,
          () => client.campaigns.inventory.audit.query(input)
        ),
      saveCurrencySystem: (input: campaignContracts.SaveCampaignCurrencySystemInput) =>
        request(
          'campaigns.inventory.saveCurrencySystem',
          campaignContracts.currencySystemDtoSchema,
          () => client.campaigns.inventory.saveCurrencySystem.mutate(input)
        ),
      deleteCurrencySystem: async (
        campaignId: string,
        systemId: string,
        expectedVersion: number
      ) => {
        await request('campaigns.inventory.deleteCurrencySystem', okResponseSchema, () =>
          client.campaigns.inventory.deleteCurrencySystem.mutate({
            campaignId,
            systemId,
            expectedVersion
          })
        )
      }
    },
    content: {
      list: (campaignId: string) =>
        request(
          'campaigns.content.list',
          campaignContracts.campaignContentBindingDtoSchema.array(),
          () => client.campaigns.content.list.query({ campaignId })
        ),
      submit: (input: campaignContracts.SubmitCampaignContentVersionInput) =>
        request('campaigns.content.submit', campaignContracts.campaignContentBindingDtoSchema, () =>
          client.campaigns.content.submit.mutate(input)
        ),
      review: (input: campaignContracts.ReviewCampaignContentVersionInput) =>
        request('campaigns.content.review', campaignContracts.campaignContentBindingDtoSchema, () =>
          client.campaigns.content.review.mutate(input)
        )
    },
    gm: {
      adjustments: {
        list: (campaignId: string, characterId: string) =>
          request(
            'campaigns.gm.adjustments.list',
            campaignContracts.campaignAdjustmentsDtoSchema,
            () => client.campaigns.gm.adjustments.list.query({ campaignId, characterId })
          ),
        delete: async (
          campaignId: string,
          characterId: string,
          adjustmentId: string,
          expectedVersion: number
        ) => {
          await request('campaigns.gm.adjustments.delete', okResponseSchema, () =>
            client.campaigns.gm.adjustments.delete.mutate({
              campaignId,
              characterId,
              adjustmentId,
              expectedVersion
            })
          )
        }
      },
      conditions: {
        list: (campaignId: string, characterId: string) =>
          request(
            'campaigns.gm.conditions.list',
            campaignContracts.campaignConditionsDtoSchema,
            () => client.campaigns.gm.conditions.list.query({ campaignId, characterId })
          ),
        save: (input: campaignContracts.SaveCampaignConditionInput) =>
          request(
            'campaigns.gm.conditions.save',
            campaignContracts.campaignConditionDtoSchema,
            () => client.campaigns.gm.conditions.save.mutate(input)
          ),
        delete: async (input: campaignContracts.DeleteCampaignConditionInput) => {
          await request('campaigns.gm.conditions.delete', okResponseSchema, () =>
            client.campaigns.gm.conditions.delete.mutate(input)
          )
        }
      },
      events: (campaignId: string, characterId: string, cursor?: string, limit = 50) =>
        request('campaigns.gm.events', campaignContracts.campaignEventPageDtoSchema, () =>
          client.campaigns.gm.events.query({ campaignId, characterId, cursor, limit })
        )
    }
  }
}

export type CampaignsApi = ReturnType<typeof buildCampaignsApi>
