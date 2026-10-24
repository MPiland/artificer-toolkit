import { Alert, Button, Drawer, Group, Modal, Select, Stack, Text } from '@mantine/core'
import { Pencil, RotateCcw, Save, Trash2 } from 'lucide-react'
import { useMemo, useState, type RefObject } from 'react'
import type {
  CampaignSceneStateDto,
  SceneCommandInputDto,
  SceneDefinitionDto
} from '@artificer-toolkit/schema/api/vttScenes'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import { CampaignSceneObjectInspector } from './CampaignSceneObjectInspector'
import {
  createLiveSceneObjectDraft,
  createLiveSceneCreationCommand,
  createLiveSceneObjectRemoveCommand,
  createLiveSceneObjectUpsertCommand,
  listLiveSceneObjectOptions,
  type LiveSceneObjectSelection
} from './CampaignLiveSceneObjectEditor.model'
import { SceneObjectCreator } from './SceneObjectCreator'
import type { VttSceneRenderer } from './vttSceneRenderer'

export function CampaignLiveSceneObjectEditor({
  connected,
  memberships,
  onCommand,
  renderer,
  scene
}: {
  connected: boolean
  memberships: CampaignDetailDto['memberships']
  onCommand: (command: SceneCommandInputDto) => boolean
  renderer: RefObject<VttSceneRenderer | null>
  scene: CampaignSceneStateDto
}) {
  const options = useMemo(() => listLiveSceneObjectOptions(scene), [scene])
  const [opened, setOpened] = useState(false)
  const [selection, setSelection] = useState<LiveSceneObjectSelection | null>(null)
  const [editedDraft, setEditedDraft] = useState<SceneDefinitionDto | null>(null)
  const [editBaseVersion, setEditBaseVersion] = useState(scene.version)
  const [dirty, setDirty] = useState(false)
  const [confirmation, setConfirmation] = useState<'CLOSE' | 'DELETE' | null>(null)
  const [trackedSceneId, setTrackedSceneId] = useState(scene.id)

  // A clean editor follows the live scene; a dirty one keeps the draft and the version it began from.
  const sourceDraft = useMemo(
    () => (selection ? createLiveSceneObjectDraft(scene, selection) : null),
    [scene, selection]
  )
  const draft = dirty ? editedDraft : sourceDraft
  const expectedSceneVersion = dirty ? editBaseVersion : scene.version
  const isOpen = opened && (dirty || !selection || sourceDraft !== null)

  function closeEditor(): void {
    setOpened(false)
    setSelection(null)
    setEditedDraft(null)
    setDirty(false)
    setConfirmation(null)
  }

  if (trackedSceneId !== scene.id) {
    setTrackedSceneId(scene.id)
    closeEditor()
  }

  function beginEditing(nextSelection: LiveSceneObjectSelection): void {
    if (!createLiveSceneObjectDraft(scene, nextSelection)) return
    setSelection(nextSelection)
    setEditedDraft(null)
    setDirty(false)
  }

  function saveDraft(): void {
    if (!connected || !draft || !selection) return
    const command = createLiveSceneObjectUpsertCommand({
      draft,
      expectedSceneVersion,
      scene,
      selection
    })
    if (command && onCommand(command)) closeEditor()
  }

  function removeObject(): void {
    if (!connected || !selection) return
    const command = createLiveSceneObjectRemoveCommand({
      expectedSceneVersion,
      scene,
      selection
    })
    if (onCommand(command)) closeEditor()
  }

  const creationDraft: SceneDefinitionDto = {
    annotations: scene.annotations,
    ambientIllumination: scene.ambientIllumination,
    barriers: scene.barriers,
    campaignId: scene.campaignId,
    daylight: scene.daylight,
    darknessZones: scene.darknessZones,
    fogMode: scene.fogMode,
    grid: scene.grid,
    id: scene.definitionId,
    lights: scene.lights,
    map: scene.map,
    name: scene.name,
    tokens: scene.tokens,
    version: scene.definitionVersion,
    visionRevealMode: scene.visionRevealMode
  }

  return (
    <>
      <Button
        leftSection={<Pencil aria-hidden size={16} />}
        size='xs'
        variant='default'
        onClick={() => {
          const initial = options[0]
          if (initial) beginEditing(initial.selection)
          else {
            setSelection(null)
            setEditedDraft(null)
            setDirty(false)
          }
          setOpened(true)
        }}
      >
        Edit objects
      </Button>
      <Drawer
        closeButtonProps={{ 'aria-label': 'Close live scene editor' }}
        closeOnClickOutside={!dirty}
        closeOnEscape={!dirty}
        opened={isOpen}
        position='right'
        size='md'
        title='Edit live scene object'
        onClose={() => (dirty ? setConfirmation('CLOSE') : closeEditor())}
      >
        <Stack gap='md'>
          <Text c='dimmed' size='sm'>
            Changes stay local until Save. Each save sends one authoritative scene update.
          </Text>
          {!connected ? (
            <Alert color='yellow'>
              Live play is reconnecting. You can keep editing, but Save is paused.
            </Alert>
          ) : null}
          <SceneObjectCreator
            disabled={!connected}
            scene={creationDraft}
            onCreate={(next) => {
              const command = createLiveSceneCreationCommand({
                before: creationDraft,
                expectedSceneVersion: scene.version,
                next,
                scene
              })
              if (command) onCommand(command)
            }}
          />
          <Select
            data={options.map((option) => ({ label: option.label, value: option.value }))}
            label='Scene object'
            searchable
            value={selection ? `${selection.section}:${selection.id}` : null}
            onChange={(value) => {
              if (!value || dirty) return
              const option = options.find((candidate) => candidate.value === value)
              if (option) beginEditing(option.selection)
            }}
          />
          {dirty ? (
            <Text c='dimmed' size='xs'>
              Save or reset before choosing another object.
            </Text>
          ) : null}
          {draft && selection ? (
            <CampaignSceneObjectInspector
              allowRemove={false}
              disabled={false}
              editDoorInitialState={false}
              memberships={memberships}
              scene={draft}
              section={selection.section}
              showObjectPicker={false}
              showSummary={false}
              onChange={(nextDraft) => {
                if (!dirty) setEditBaseVersion(scene.version)
                setEditedDraft(nextDraft)
                setDirty(true)
              }}
              onFocus={(point) => renderer.current?.focusPoint(point)}
            />
          ) : null}
          <Group justify='space-between'>
            <Button
              color='red'
              disabled={!connected || !selection}
              leftSection={<Trash2 aria-hidden size={16} />}
              variant='subtle'
              onClick={() => setConfirmation('DELETE')}
            >
              Delete object
            </Button>
            <Group gap='xs'>
              <Button
                disabled={!dirty || !selection}
                leftSection={<RotateCcw aria-hidden size={16} />}
                variant='default'
                onClick={() => {
                  if (selection) beginEditing(selection)
                }}
              >
                Reset
              </Button>
              <Button
                disabled={!connected || !dirty}
                leftSection={<Save aria-hidden size={16} />}
                onClick={saveDraft}
              >
                Save
              </Button>
            </Group>
          </Group>
        </Stack>
      </Drawer>
      <Modal
        centered
        closeOnClickOutside={false}
        opened={confirmation !== null}
        title={confirmation === 'DELETE' ? 'Delete scene object?' : 'Discard live edit?'}
        onClose={() => setConfirmation(null)}
      >
        <Stack gap='md'>
          <Text size='sm'>
            {confirmation === 'DELETE'
              ? 'This removes the object from the live Encounter scene for everyone.'
              : 'Your unsaved object changes will be discarded.'}
          </Text>
          <Group justify='flex-end'>
            <Button variant='default' onClick={() => setConfirmation(null)}>
              Cancel
            </Button>
            <Button
              color='red'
              onClick={() => {
                if (confirmation === 'DELETE') removeObject()
                else closeEditor()
              }}
            >
              {confirmation === 'DELETE' ? 'Delete object' : 'Discard changes'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
