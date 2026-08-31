import {
  ActionIcon,
  Alert,
  Button,
  Drawer,
  Group,
  Select,
  Stack,
  Text,
  Tooltip
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Swords } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characterSheetData'
import type {
  EncounterGmProjectionDto,
  EncounterPlayerProjectionDto,
  ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import type { LiveSessionCommittedMessage } from './liveSessionClient'

export function CampaignTabletopActionDrawer({
  actions,
  actorIdByTokenId,
  connected,
  encounter,
  pending,
  scene,
  onResolve
}: {
  actions: CharacterSheetResponseDto['actions']['items']
  actorIdByTokenId: ReadonlyMap<string, string>
  connected: boolean
  encounter: EncounterGmProjectionDto | EncounterPlayerProjectionDto
  pending: boolean
  scene: CampaignSceneStateDto
  onResolve: (command: ResolveEncounterActionInputDto) => Promise<LiveSessionCommittedMessage>
}) {
  const [opened, { close, open }] = useDisclosure(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [targetActorId, setTargetActorId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const currentActor =
    encounter.actors.find((actor) => actor.id === encounter.currentActorId) ?? null
  const availableActions = useMemo(
    () =>
      actions.filter(
        (action) =>
          action.availability.status === 'AVAILABLE' && action.rollable === true && action.mechanic
      ),
    [actions]
  )
  const selectedAction = availableActions.find((action) => action.id === actionId) ?? null
  const controlsDisabled = !connected || pending || submitting

  useEffect(() => {
    setActionId(null)
    setTargetActorId(null)
    setFeedback(null)
    setError(null)
  }, [encounter.currentActorId])

  async function resolveAction(): Promise<void> {
    if (!currentActor || !selectedAction || !targetActorId || controlsDisabled) return
    const sourceToken = scene.tokens.find(
      (token) => actorIdByTokenId.get(token.id) === currentActor.id
    )
    const targetToken = scene.tokens.find(
      (token) => actorIdByTokenId.get(token.id) === targetActorId
    )
    setSubmitting(true)
    setError(null)
    setFeedback(null)
    try {
      const committed = await onResolve({
        type: 'RESOLVE_ACTION',
        encounterId: encounter.id,
        commandId: crypto.randomUUID(),
        expectedVersion: encounter.version,
        actorId: currentActor.id,
        actionId: selectedAction.id,
        targetActorId,
        sceneContext:
          sourceToken && targetToken
            ? {
                sceneId: scene.id,
                expectedSceneVersion: scene.version,
                sourceTokenId: sourceToken.id,
                targetTokenId: targetToken.id
              }
            : null
      })
      if (committed.aggregateKind !== 'ENCOUNTER') {
        throw new Error('The live session returned an unexpected action result.')
      }
      const response = committed.response
      if (!response) throw new Error('The live session returned no action result.')
      if (!('projection' in response)) {
        throw new Error('The live session returned an unexpected action result.')
      }
      if (response.occurrence?.status === 'PENDING') {
        setFeedback('Action paused for a required decision.')
      } else if (response.resolution) {
        const applied = response.resolution.appliedOutcomes.filter(
          (outcome) => outcome.status === 'APPLIED'
        ).length
        setFeedback(
          applied === 0
            ? 'Action resolved with no applied outcomes.'
            : `Action resolved · ${applied} ${applied === 1 ? 'outcome' : 'outcomes'} applied.`
        )
      } else if (response.roll) {
        setFeedback(`Action resolved · rolled ${response.roll.evidence.total}.`)
      } else {
        setFeedback('Action resolved.')
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'The action could not be resolved.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Tooltip label='Actions'>
        <ActionIcon aria-label='Open actions' size='lg' variant='default' onClick={open}>
          <Swords aria-hidden size={18} />
        </ActionIcon>
      </Tooltip>
      <Drawer
        closeButtonProps={{ 'aria-label': 'Close actions' }}
        opened={opened}
        position='right'
        size='min(28rem, 100vw)'
        title='Actions'
        zIndex={400}
        onClose={close}
      >
        <Stack gap='md' aria-busy={submitting || undefined}>
          <div>
            <Text fw={650}>{currentActor?.label ?? 'No active combatant'}</Text>
            <Text c='dimmed' size='sm'>
              Choose an available action and its target. The server validates range and eligibility.
            </Text>
          </div>
          {!connected ? (
            <Alert color='yellow'>Actions will return when live play reconnects.</Alert>
          ) : null}
          {availableActions.length ? (
            <>
              <Select
                data={availableActions.map((action) => ({
                  label: action.sourceLabel
                    ? `${action.label} · ${action.sourceLabel}`
                    : action.label,
                  value: action.id
                }))}
                disabled={controlsDisabled}
                label='Action'
                searchable
                value={actionId}
                onChange={setActionId}
              />
              <Select
                data={encounter.actors.map((actor) => ({ label: actor.label, value: actor.id }))}
                disabled={controlsDisabled}
                label='Target'
                searchable
                value={targetActorId}
                onChange={setTargetActorId}
              />
              {selectedAction?.mechanic ? (
                <Text c='dimmed' size='sm'>
                  {selectedAction.mechanic.rangeLabel ?? 'System-defined range'}
                  {selectedAction.mechanic.attackBonus === undefined
                    ? ''
                    : ` · ${selectedAction.mechanic.attackBonus >= 0 ? '+' : ''}${selectedAction.mechanic.attackBonus} to hit`}
                </Text>
              ) : null}
              <Group>
                <Button
                  disabled={controlsDisabled || !selectedAction || !targetActorId}
                  loading={submitting}
                  onClick={() => void resolveAction()}
                >
                  Resolve action
                </Button>
              </Group>
            </>
          ) : (
            <Text c='dimmed'>No structured actions are available for the active combatant.</Text>
          )}
          {feedback ? (
            <Alert aria-live='polite' color='green'>
              {feedback}
            </Alert>
          ) : null}
          {error ? (
            <Alert aria-live='assertive' color='red'>
              {error}
            </Alert>
          ) : null}
        </Stack>
      </Drawer>
    </>
  )
}
