import type { CharacterSheetExtrasSliceDto } from '@artificer-toolkit/schema/api/characterSheetSlices'
import { Alert, Button, Drawer, Select, Text } from '@mantine/core'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { IconPlus } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { getCharacterSheetExtraOptions } from '#app/data/characters/queries'
import type { OpenSheetPanel, SubmitSheetCommand } from '../core/CharacterSheet.types'
import { CharacterSheetDetailPanel } from '../shared/CharacterSheetDetailPanel'
import { CharacterSheetExtraList } from './CharacterSheetExtraList'
import { CharacterSheetSpellSummons } from './CharacterSheetSpellSummons'
import { getExtraTarget } from './CharacterSheetExtraList.model'
import * as extrasStyles from './extras.css'
import * as panelStyles from '../shared/panel.css'

type ExtraKind = CharacterSheetExtrasSliceDto['extras']['kindOptions'][number]['code']
type OriginKind = CharacterSheetExtrasSliceDto['extras']['originOptions'][number]['code']

const CREATURE_KINDS = new Set<ExtraKind>(['COMPANION', 'MOUNT', 'OWNED'])

export function CharacterSheetExtras({
  hideTitle,
  openPanel,
  pending,
  sheet,
  submitCommand
}: {
  hideTitle?: boolean
  openPanel?: OpenSheetPanel
  pending: boolean
  sheet: CharacterSheetExtrasSliceDto
  submitCommand: SubmitSheetCommand
}) {
  const isMobile = useMediaQuery('(max-width: 760px)', false)
  const [opened, controls] = useDisclosure(false)
  const [kind, setKind] = useState<ExtraKind | null>(null)
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [sourceQuery, setSourceQuery] = useState('')
  const [originKind, setOriginKind] = useState<OriginKind | null>(null)
  const [shouldOpenAdded, setShouldOpenAdded] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const priorExtraIds = useRef<Set<string> | undefined>(undefined)
  const isCreature = kind !== null && CREATURE_KINDS.has(kind)
  const sourceKind = isCreature ? 'CREATURE' : 'VEHICLE'
  const extraOptions = useQuery(
    getCharacterSheetExtraOptions(opened && kind !== null ? sheet.meta.characterId : undefined, {
      kind: sourceKind,
      limit: 25,
      ...(sourceQuery ? { query: sourceQuery } : {})
    })
  )
  const sourceOptions = extraOptions.data?.items ?? []

  useEffect(() => {
    if (!shouldOpenAdded || !openPanel) return
    const addedExtra = sheet.extras.items.find(
      (extra) => extra.kind !== 'SPELL_SUMMON' && !priorExtraIds.current?.has(extra.id)
    )
    if (!addedExtra || addedExtra.kind === 'SPELL_SUMMON') return
    setShouldOpenAdded(false)
    openPanel(getExtraTarget(addedExtra))
  }, [openPanel, shouldOpenAdded, sheet.extras.items])

  function closeDrawer() {
    setKind(null)
    setSourceId(null)
    setSourceQuery('')
    setOriginKind(null)
    setSubmitError(null)
    controls.close()
  }

  async function addExtra() {
    if (!kind || !sourceId) return
    const extra =
      kind === 'VEHICLE'
        ? { kind, vehicleId: sourceId }
        : originKind
          ? { kind, creatureId: sourceId, originKind }
          : null
    if (!extra) return
    priorExtraIds.current = new Set(sheet.extras.items.map((existing) => existing.id))
    const added = await submitCommand({
      type: 'ADD_SHEET_EXTRA',
      expectedVersion: sheet.meta.streamVersion,
      extra
    })
    if (added) {
      setShouldOpenAdded(true)
      closeDrawer()
    } else {
      setSubmitError('The extra could not be added. Review the selection and try again.')
    }
  }

  const creatureExtras = sheet.extras.items.filter(
    (extra) => extra.kind === 'COMPANION' || extra.kind === 'MOUNT' || extra.kind === 'OWNED'
  )
  const vehicles = sheet.extras.items.filter((extra) => extra.kind === 'VEHICLE')
  const summons = sheet.extras.items.filter((extra) => extra.kind === 'SPELL_SUMMON')

  return (
    <CharacterSheetDetailPanel
      ariaId='character-sheet-extras'
      hideTitle={hideTitle}
      title='Extras'
      description='Companions, mounts, owned creatures, and vehicles.'
      headerActions={
        <Button leftSection={<IconPlus size={16} />} size='xs' onClick={controls.open}>
          Add Extra
        </Button>
      }
    >
      <div className={extrasStyles.extrasList}>
        {sheet.extras.items.length ? (
          <>
            <CharacterSheetExtraList
              extras={creatureExtras}
              label='Creatures'
              openPanel={openPanel}
            />
            <CharacterSheetExtraList extras={vehicles} label='Vehicles' openPanel={openPanel} />
            <CharacterSheetSpellSummons
              expectedVersion={sheet.meta.streamVersion}
              pending={pending}
              submitCommand={submitCommand}
              summons={summons}
            />
          </>
        ) : (
          <Text className={panelStyles.muted}>No extras have been added to this character.</Text>
        )}
      </div>
      <Drawer
        opened={opened}
        position={isMobile ? 'bottom' : 'right'}
        size={isMobile ? '92%' : '30rem'}
        title='Add Extra'
        onClose={closeDrawer}
      >
        <div className={extrasStyles.extraDrawerBody}>
          {submitError ? (
            <Alert color='red' role='alert' title='Could not add extra'>
              {submitError}
            </Alert>
          ) : null}
          <Select
            data={sheet.extras.kindOptions.map((option) => ({
              value: option.code,
              label: option.label
            }))}
            disabled={pending}
            label='Kind'
            placeholder='Choose an extra kind'
            value={kind}
            onChange={(value) => {
              setKind(
                sheet.extras.kindOptions.find((option) => option.code === value)?.code ?? null
              )
              setSourceId(null)
              setSourceQuery('')
              setOriginKind(null)
              setSubmitError(null)
            }}
          />
          {kind ? (
            <Select
              data={sourceOptions.map((option) => ({ value: option.id, label: option.label }))}
              disabled={pending || extraOptions.isPending}
              label={isCreature ? 'Creature' : 'Vehicle'}
              nothingFoundMessage={
                extraOptions.isPending
                  ? 'Loading options…'
                  : 'No matching options. Try another search.'
              }
              placeholder={isCreature ? 'Search creatures' : 'Search vehicles'}
              searchable
              searchValue={sourceQuery}
              value={sourceId}
              onChange={(value) => {
                setSourceId(value)
                setSubmitError(null)
              }}
              onSearchChange={setSourceQuery}
            />
          ) : null}
          {isCreature && sourceId ? (
            <Select
              data={sheet.extras.originOptions.map((option) => ({
                value: option.code,
                label: option.label
              }))}
              disabled={pending}
              label='Origin'
              placeholder='Choose an origin'
              value={originKind}
              onChange={(value) => {
                setOriginKind(
                  sheet.extras.originOptions.find((option) => option.code === value)?.code ?? null
                )
                setSubmitError(null)
              }}
            />
          ) : null}
          <div className={extrasStyles.extraDrawerActions}>
            <Button disabled={pending} variant='default' onClick={closeDrawer}>
              Cancel
            </Button>
            <Button
              disabled={pending || !kind || !sourceId || (isCreature && !originKind)}
              loading={pending}
              onClick={() => void addExtra()}
            >
              Add Extra
            </Button>
          </div>
        </div>
      </Drawer>
    </CharacterSheetDetailPanel>
  )
}
