import type { EncounterCommandInputDto } from '@artificer-toolkit/schema/api/encounters'
import { Select, Switch, Tooltip } from '@mantine/core'

/**
 * A player's own tabletop header controls: the main Character among several they control, and,
 * during an ACTIVE Encounter, marking themselves away so their reaction offers decline at once (D207).
 */
export function CampaignTabletopPlayerHeaderControls({
  characters,
  mainCharacterId,
  onMainCharacterChange,
  encounter,
  awayDisabled,
  userId,
  onCommand
}: {
  characters: readonly { id: string; label: string }[]
  mainCharacterId: string | null
  onMainCharacterChange: (characterId: string | null) => void
  /** The viewer's projection of the active Encounter; only a player's carries `viewerAfk`. */
  encounter: { id: string; version: number; status: string; viewerAfk?: boolean } | null | undefined
  awayDisabled: boolean
  userId: string
  onCommand: (command: EncounterCommandInputDto) => void
}) {
  const awayEncounter =
    encounter?.status === 'ACTIVE' && encounter.viewerAfk !== undefined
      ? { ...encounter, viewerAfk: encounter.viewerAfk }
      : null
  return (
    <>
      {characters.length > 1 ? (
        <Select
          aria-label='Main Character'
          allowDeselect={false}
          data={characters.map((character) => ({ label: character.label, value: character.id }))}
          size='xs'
          value={mainCharacterId}
          onChange={onMainCharacterChange}
        />
      ) : null}
      {awayEncounter ? (
        <Tooltip label='While you are away, your reaction offers decline at once.'>
          <Switch
            checked={awayEncounter.viewerAfk}
            disabled={awayDisabled}
            label='Away'
            size='sm'
            onChange={(event) =>
              onCommand({
                type: 'SET_AFK',
                encounterId: awayEncounter.id,
                commandId: crypto.randomUUID(),
                expectedVersion: awayEncounter.version,
                userId,
                afk: event.currentTarget.checked
              })
            }
          />
        </Tooltip>
      ) : null}
    </>
  )
}
