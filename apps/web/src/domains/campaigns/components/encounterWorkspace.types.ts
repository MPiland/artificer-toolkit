import type { EncounterCommandInputDto } from '@artificer-toolkit/schema/api/encounters'

export type EncounterCommandPayload = EncounterCommandInputDto extends infer Command
  ? Command extends EncounterCommandInputDto
    ? Omit<Command, 'encounterId' | 'commandId' | 'expectedVersion'>
    : never
  : never
