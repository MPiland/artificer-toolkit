import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Drawer,
  Group,
  Select,
  Text,
  Tooltip
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { ListOrdered } from 'lucide-react'
import type {
  EncounterCommandInputDto,
  EncounterGmProjectionDto,
  EncounterPlayerProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import * as styles from './CampaignTabletopEncounterDrawer.css'

export function CampaignTabletopEncounterDrawer({
  connected,
  encounter,
  pending,
  role,
  onCommand
}: {
  connected: boolean
  encounter: EncounterGmProjectionDto | EncounterPlayerProjectionDto
  pending: boolean
  role: 'OWNER' | 'PLAYER'
  onCommand: (command: EncounterCommandInputDto) => void
}) {
  const [opened, { close, open }] = useDisclosure(false)
  const controlsDisabled = !connected || pending

  function command(
    input:
      | { type: 'ADVANCE_TURN' }
      | { type: 'PREVIOUS_TURN' }
      | { actorId: string | null; type: 'SET_CURRENT_ACTOR' }
  ): void {
    onCommand({
      ...input,
      commandId: crypto.randomUUID(),
      encounterId: encounter.id,
      expectedVersion: encounter.version
    })
  }

  return (
    <>
      <Tooltip label='Turn order'>
        <ActionIcon aria-label='Open turn order' size='lg' variant='default' onClick={open}>
          <ListOrdered aria-hidden size={18} />
        </ActionIcon>
      </Tooltip>
      <Drawer
        closeButtonProps={{ 'aria-label': 'Close turn order' }}
        opened={opened}
        position='right'
        size='min(28rem, 100vw)'
        title='Turn order'
        zIndex={400}
        onClose={close}
      >
        <div aria-busy={pending || undefined}>
          <div className={styles.summary}>
            <Group gap='xs' justify='space-between' wrap='nowrap'>
              <Text fw={650}>{encounter.name}</Text>
              <Badge variant='light'>Round {encounter.round}</Badge>
            </Group>
            <Text c='dimmed' size='sm'>
              {encounter.actors.length} {encounter.actors.length === 1 ? 'combatant' : 'combatants'}
            </Text>
          </div>

          {!connected ? (
            <Alert color='yellow' mb='md'>
              Turn controls will return when live play reconnects.
            </Alert>
          ) : null}

          <div className={styles.actorList} aria-label='Encounter turn order'>
            {encounter.actors.map((actor) => {
              const current = encounter.currentActorId === actor.id
              return (
                <div
                  aria-current={current ? 'true' : undefined}
                  className={styles.actor}
                  data-current={current || undefined}
                  key={actor.id}
                >
                  <span className={styles.initiative} title='Initiative'>
                    {actor.initiative ?? '—'}
                  </span>
                  <div>
                    <Text fw={current ? 700 : 600} lineClamp={1}>
                      {actor.label}
                    </Text>
                    <Text c='dimmed' size='xs'>
                      {current ? 'Current turn' : actor.kind.toLowerCase()}
                    </Text>
                  </div>
                  <Badge
                    color={
                      actor.healthBand === 'DEFEATED'
                        ? 'red'
                        : actor.healthBand === 'CRITICAL'
                          ? 'orange'
                          : 'gray'
                    }
                    size='xs'
                    variant='light'
                  >
                    {actor.healthBand.toLowerCase()}
                  </Badge>
                </div>
              )
            })}
          </div>

          {role === 'OWNER' ? (
            <div className={styles.controls}>
              <Select
                data={encounter.actors.map((actor) => ({ label: actor.label, value: actor.id }))}
                disabled={controlsDisabled}
                label='Current turn'
                value={encounter.currentActorId}
                onChange={(actorId) => command({ actorId, type: 'SET_CURRENT_ACTOR' })}
              />
              <div className={styles.controlButtons}>
                <Button
                  disabled={controlsDisabled}
                  variant='default'
                  onClick={() => command({ type: 'PREVIOUS_TURN' })}
                >
                  Previous turn
                </Button>
                <Button
                  disabled={controlsDisabled}
                  onClick={() => command({ type: 'ADVANCE_TURN' })}
                >
                  Next turn
                </Button>
              </div>
              {pending ? (
                <Text aria-live='polite' c='dimmed' size='xs'>
                  Applying the turn update…
                </Text>
              ) : null}
            </div>
          ) : null}
        </div>
      </Drawer>
    </>
  )
}
