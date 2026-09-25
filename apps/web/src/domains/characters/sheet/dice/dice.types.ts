import type { CampaignRollDestinationDto } from '@artificer-toolkit/schema/api/campaignCommunication'
import type { ExecuteRollInputDto, RollRecordDto } from '@artificer-toolkit/schema/api/rolls'

export type CharacterSheetRollRequest = Omit<ExecuteRollInputDto, 'characterId'>

export type CharacterSheetRollTarget = CharacterSheetRollRequest & {
  text: string
}

/** Chat destinations plus the roller's retained history: PRIVATE, or BLIND for the GM. */
export type CharacterSheetRollDestination = CampaignRollDestinationDto | 'PRIVATE' | 'BLIND'

export type CharacterSheetRollDestinationOption = {
  label: string
  value: CharacterSheetRollDestination
}

export type CharacterSheetRollController = {
  clearManualRoll: () => void
  destination: CharacterSheetRollDestination
  destinationOptions: readonly CharacterSheetRollDestinationOption[]
  dismissRoll: (discard?: boolean) => void
  executeRoll: (request: CharacterSheetRollRequest) => Promise<RollRecordDto | undefined>
  hasManualRoll: boolean
  pending: boolean
  pendingRequest?: CharacterSheetRollRequest
  presentationPending: boolean
  presentedRoll?: RollRecordDto
  presentedRollPrivate: boolean
  revealRoll: (rollId: string) => void
  setDestination: (destination: CharacterSheetRollDestination) => void
  /** Rolls that change Character state (hit dice) always stay visible to the GM. */
  stateRollDestination: CharacterSheetRollDestination
  stateRollDestinationOptions: readonly CharacterSheetRollDestinationOption[]
}

export type ManualDieRow = {
  id: string
  count: number
  die: 4 | 6 | 8 | 10 | 12 | 20 | 100
  modifier: number
}
