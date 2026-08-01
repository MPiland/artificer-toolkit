import type { ExecuteRollInputDto, RollRecordDto } from '@artificer-toolkit/schema/api/rolls'

export type CharacterSheetRollRequest = Omit<ExecuteRollInputDto, 'characterId'>

export type CharacterSheetRollTarget = CharacterSheetRollRequest & {
  text: string
}

export type CharacterSheetRollController = {
  clearManualRoll: () => void
  dismissRoll: (discard?: boolean) => void
  executeRoll: (request: CharacterSheetRollRequest) => Promise<RollRecordDto | undefined>
  hasManualRoll: boolean
  pending: boolean
  pendingRequest?: CharacterSheetRollRequest
  presentedRoll?: RollRecordDto
}

export type ManualDieRow = {
  id: string
  count: number
  die: 4 | 6 | 8 | 10 | 12 | 20 | 100
  modifier: number
}
