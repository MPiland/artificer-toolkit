import { ActionIcon, Alert, Button, Drawer, Group, Stack, Text, Tooltip } from '@mantine/core'
import { useSelector } from '@tanstack/react-form'
import { CircleDashed } from 'lucide-react'
import { useMemo, useState } from 'react'
import type {
  EncounterCommandResultDto,
  PlaceZoneInputDto,
  RevertLastEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type { SceneGrid, ScenePoint } from '@artificer-toolkit/shared/vtt'
import { useAppForm } from '#forms/app-form/AppForm'
import { AuthoringFormProvider } from '#forms/layout/AuthoringFormProvider'
import { FormRenderer } from '#forms/rendering/FormRenderer'
import {
  createPlacedZoneDraft,
  isPlacedZone,
  placedZoneSize,
  placeZoneCommand,
  type ZonePointPick
} from './campaignTabletopZoneTool.model'

// The renderer's values stay plain objects, as on the authoring pages; `isPlacedZone` validates them.
const EMPTY_ZONE_VALUES: object = {}
const ZoneRenderer = FormRenderer({ defaultValues: EMPTY_ZONE_VALUES })

/**
 * The GM's zone tool (MOVE-3.2): authors an environmental zone through the same zone node map as
 * authored content, picks its center on the map and places it. The GM can undo the placement while
 * it is still the Run's last action.
 */
export function CampaignTabletopZoneTool({
  connected,
  encounterId,
  encounterVersion,
  gameSystemId,
  grid,
  picking,
  onPickPoint,
  onSend
}: {
  connected: boolean
  encounterId: string
  encounterVersion: number
  gameSystemId: string
  grid: SceneGrid
  /** The GM is picking the zone's center on the map; the drawer steps aside meanwhile. */
  picking: boolean
  onPickPoint: (pick: ZonePointPick) => void
  onSend: (
    command: PlaceZoneInputDto | RevertLastEncounterActionInputDto
  ) => Promise<EncounterCommandResultDto>
}) {
  const [defaultValues] = useState<object>(createPlacedZoneDraft)
  const form = useAppForm({ defaultValues })
  const values = useSelector(form.store, (state) => state.values)
  const zone = useMemo(() => (isPlacedZone(values) ? values : null), [values])
  const [opened, setOpened] = useState(false)
  const [point, setPoint] = useState<ScenePoint | null>(null)
  // The Run version the placement committed at; undo applies while it is still the last action.
  const [placedVersion, setPlacedVersion] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const size = zone ? placedZoneSize(zone, grid) : null
  const command = useMemo(
    () =>
      zone && point
        ? placeZoneCommand({ zone, point, encounterId, expectedVersion: encounterVersion })
        : null,
    [encounterId, encounterVersion, point, zone]
  )
  const busy = !connected || submitting

  async function send(next: PlaceZoneInputDto | RevertLastEncounterActionInputDto) {
    setFeedback(null)
    setError(null)
    setSubmitting(true)
    try {
      return await onSend(next)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'The zone command failed.')
      return null
    } finally {
      setSubmitting(false)
    }
  }

  async function place(next: PlaceZoneInputDto) {
    const result = await send(next)
    if (!result) return
    setPlacedVersion(result.projection.version)
    setPoint(null)
    setFeedback('Zone placed.')
  }

  async function undo(expectedVersion: number) {
    const result = await send({
      type: 'REVERT_LAST_ACTION',
      encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion
    })
    if (!result) return
    setPlacedVersion(null)
    setFeedback('Zone removed.')
  }

  return (
    <>
      <Tooltip label='Place a zone'>
        <ActionIcon aria-label='Place a zone' variant='default' onClick={() => setOpened(true)}>
          <CircleDashed aria-hidden size={18} />
        </ActionIcon>
      </Tooltip>
      <Drawer
        closeButtonProps={{ 'aria-label': 'Close zone tool' }}
        opened={opened && !picking}
        position='right'
        size='min(36rem, 100vw)'
        title='Place a zone'
        zIndex={400}
        onClose={() => setOpened(false)}
      >
        <Stack gap='md' aria-busy={submitting || undefined}>
          <Text c='dimmed' size='sm'>
            Author the zone as you would in content, then pick its center on the map. Its saves use
            their fixed DC.
          </Text>
          {!connected ? (
            <Alert color='yellow'>Zones can be placed when live play reconnects.</Alert>
          ) : null}
          <AuthoringFormProvider>
            <form.AppForm>
              <ZoneRenderer
                form={form}
                mapId='outcome'
                renderAllSteps
                resolveModel
                systemId={gameSystemId}
                updateAuthoringState={false}
              />
            </form.AppForm>
          </AuthoringFormProvider>
          <Group justify='space-between' wrap='nowrap'>
            <Text size='sm'>
              {point
                ? `Centered at (${Math.round(point.x)}, ${Math.round(point.y)})`
                : size
                  ? 'Pick the zone’s center on the map.'
                  : 'Complete a placed-space zone shaped as a sphere, cylinder, circle or cube of fixed size.'}
            </Text>
            <Button
              disabled={busy || !size}
              size='xs'
              variant='default'
              onClick={() => size && onPickPoint({ size, onPicked: setPoint })}
            >
              Pick on map
            </Button>
          </Group>
          <Group justify='flex-end'>
            {placedVersion !== null && encounterVersion <= placedVersion ? (
              <Button disabled={busy} variant='default' onClick={() => void undo(placedVersion)}>
                Undo placement
              </Button>
            ) : null}
            <Button
              disabled={busy || !command}
              loading={submitting}
              onClick={() => command && void place(command)}
            >
              Place zone
            </Button>
          </Group>
          {feedback ? (
            <Text aria-live='polite' size='sm'>
              {feedback}
            </Text>
          ) : null}
          {error ? (
            <Alert color='red' role='alert'>
              {error}
            </Alert>
          ) : null}
        </Stack>
      </Drawer>
    </>
  )
}
