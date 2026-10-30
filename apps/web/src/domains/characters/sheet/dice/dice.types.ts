import type {
  CampaignChatEntryDto,
  CampaignRollDestinationDto,
  RevealCampaignRollInput
} from '@artificer-toolkit/schema/api/campaignCommunication'
import type { ExecuteRollInputDto, RollRecordDto } from '@artificer-toolkit/schema/api/rolls'

export type CharacterSheetRollRequest = Omit<ExecuteRollInputDto, 'characterId'>

export type CharacterSheetRollTarget = CharacterSheetRollRequest & {
  text: string
}

/** Chat destinations plus the roller's retained history: PRIVATE. */
export type CharacterSheetRollDestination = CampaignRollDestinationDto | 'PRIVATE'

export type CharacterSheetRollDestinationOption = {
  label: string
  value: CharacterSheetRollDestination
}

/** Rolling dice from the sheet: what roll controls and the manual roller read. */
export type CharacterSheetRolls = {
  clearManualRoll: () => void
  executeRoll: (request: CharacterSheetRollRequest) => Promise<RollRecordDto | undefined>
  hasManualRoll: boolean
  pending: boolean
  pendingRequest?: CharacterSheetRollRequest
}

/** Where rolls go, and the choices the roller offers. */
export type CharacterSheetRollDestinations = {
  destination: CharacterSheetRollDestination
  destinationOptions: readonly CharacterSheetRollDestinationOption[]
  setDestination: (destination: CharacterSheetRollDestination) => void
  /** Rolls that change Character state (hit dice) always stay visible to the GM. */
  stateRollDestination: CharacterSheetRollDestination
  stateRollDestinationOptions: readonly CharacterSheetRollDestinationOption[]
}

/** The presented roll card: its owner renders it, and a rest waits on it or cancels it. */
export type CharacterSheetRollPresentation = {
  dismissRoll: (discard?: boolean) => void
  presentationPending: boolean
  presentedRoll?: RollRecordDto
  presentedRollPrivate: boolean
  revealRoll: (rollId: string) => void
  /** Posts a GM-retained private roll to the table: its card (FULL) or only that the GM rolled. */
  revealPrivateRoll: (input: RevealCampaignRollInput) => Promise<CampaignChatEntryDto>
}

export type CharacterSheetRollController = {
  destinations: CharacterSheetRollDestinations
  presentation: CharacterSheetRollPresentation
  rolls: CharacterSheetRolls
}

export type ManualDieRow = {
  id: string
  count: number
  die: 4 | 6 | 8 | 10 | 12 | 20 | 100
  modifier: number
}
