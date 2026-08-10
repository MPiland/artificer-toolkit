import type { DBLike } from '#types'
import { createCampaignConversationRepository } from './campaignConversations.js'
import { createCampaignNotebookRepository } from './campaignNotebook.js'
import { createCampaignSessionRepository } from './campaignSessions.js'

export type {
  CampaignConversation,
  CampaignConversationKind,
  CampaignRoom,
  CampaignRoomEntry,
  CampaignChatMode,
  InsertCampaignRoomEntryInput
} from './campaignConversations.js'
export type {
  CampaignNoteCategory,
  CampaignNoteSection,
  CampaignNoteVisibility,
  InsertCampaignNoteSectionInput,
  UpdateCampaignNoteSectionInput
} from './campaignNotebook.js'
export type {
  CampaignSession,
  CampaignSessionAttendance,
  CampaignSessionNoteKind,
  CampaignSessionNoteSection,
  CampaignSessionNoteVisibility,
  CampaignSessionReferencePin,
  CampaignSessionReferencePinTarget,
  CampaignSessionRsvp,
  CampaignSessionRsvpResponse,
  CampaignSessionStatus,
  InsertCampaignSessionInput,
  InsertCampaignSessionNoteSectionInput,
  UpdateCampaignSessionInput,
  UpdateCampaignSessionNoteSectionInput
} from './campaignSessions.js'

export function createCampaignCollaborationRepository(db: DBLike) {
  return {
    ...createCampaignConversationRepository(db),
    ...createCampaignNotebookRepository(db),
    ...createCampaignSessionRepository(db)
  }
}
