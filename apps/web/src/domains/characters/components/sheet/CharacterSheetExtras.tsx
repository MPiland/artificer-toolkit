import { Alert, Button, Drawer, Select, Text } from '@mantine/core'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { IconPlus } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import { CharacterSheetDetailPanel } from './CharacterSheetDetailPanel'
import * as styles from './characterSheet.css'
import type { CharacterSheet, CharacterSheetSectionProps } from './CharacterSheet.types'

type Extra = CharacterSheet['extras']['items'][number]
type ExtraKind = CharacterSheet['extras']['kindOptions'][number]['code']
type OriginKind = CharacterSheet['extras']['originOptions'][number]['code']

const CREATURE_KINDS = new Set<ExtraKind>(['COMPANION', 'MOUNT', 'OWNED'])

function getExtraTarget(extra: Extra) {
  return extra.kind === 'VEHICLE'
    ? { kind: 'VEHICLE' as const, vehicleInstanceId: extra.id }
    : { kind: 'COMPANION' as const, companionInstanceId: extra.id }
}

function ExtraMetric({
  hideOnMobile,
  label,
  value
}: {
  hideOnMobile?: boolean
  label: string
  value: string
}) {
  return (
    <span
      className={hideOnMobile ? styles.extraMetricMobileHidden : styles.extraMetric}
      data-extra-metric={label}
    >
      <small className={styles.extraMetricLabel}>{label}</small>
      <strong>{value}</strong>
    </span>
  )
}

function getExtraDisplayName(extra: Extra) {
  return extra.customName ? `${extra.displayName} (${extra.authoredName})` : extra.displayName
}

function ExtraRow({
  extra,
  openPanel
}: {
  extra: Extra
  openPanel: CharacterSheetSectionProps['openPanel']
}) {
  const isVehicle = extra.kind === 'VEHICLE'
  const hp = `${extra.hitPoints.current} / ${extra.hitPoints.maximum}`
  const creatureMetrics = isVehicle
    ? [
        { label: 'Category', value: extra.categoryLabel },
        { label: 'Speed', value: extra.speedLabel ?? '-' },
        { label: 'Crew', value: extra.crewLabel ?? '-' },
        { label: 'HP', value: hp }
      ]
    : extra.kind === 'MOUNT'
      ? [
          { hideOnMobile: true, label: 'Origin', value: extra.originLabel },
          { label: 'Speed', value: extra.speedLabel ?? '-' },
          {
            label: 'Riders',
            value: extra.riderCapacity !== undefined ? String(extra.riderCapacity) : '-'
          },
          { label: 'HP', value: hp }
        ]
      : [
          { hideOnMobile: true, label: 'Origin', value: extra.originLabel },
          { label: 'AC', value: `${extra.armorClass}` },
          { label: 'Speed', value: extra.speedLabel ?? '-' },
          { label: 'HP', value: hp }
        ]
  return (
    <button
      aria-label={`Open ${getExtraDisplayName(extra)} details`}
      className={styles.extraDataRow}
      disabled={!openPanel}
      type='button'
      onClick={() => openPanel?.(getExtraTarget(extra))}
    >
      <span className={styles.extraIdentity}>
        <strong>{getExtraDisplayName(extra)}</strong>
      </span>
      <span className={styles.extraStatBlock}>
        {creatureMetrics.map(({ hideOnMobile, label, value }) => (
          <ExtraMetric hideOnMobile={hideOnMobile} key={label} label={label} value={value} />
        ))}
      </span>
    </button>
  )
}

function ExtraGroup({
  extras,
  label,
  openPanel
}: {
  extras: Extra[]
  label: string
  openPanel: CharacterSheetSectionProps['openPanel']
}) {
  if (!extras.length) return null
  return (
    <section className={styles.extraGroup} aria-label={label}>
      <Text className={styles.extraGroupTitle} component='h3'>
        {label}
      </Text>
      <div className={styles.extraGroupRows}>
        {extras.map((extra) => (
          <ExtraRow extra={extra} key={extra.id} openPanel={openPanel} />
        ))}
      </div>
    </section>
  )
}

export function CharacterSheetExtras({
  hideTitle,
  openPanel,
  pending,
  sheet,
  submitCommand
}: CharacterSheetSectionProps & { hideTitle?: boolean }) {
  const isMobile = useMediaQuery('(max-width: 760px)', false)
  const [opened, controls] = useDisclosure(false)
  const [kind, setKind] = useState<ExtraKind | null>(null)
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [originKind, setOriginKind] = useState<OriginKind | null>(null)
  const [shouldOpenAdded, setShouldOpenAdded] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const priorExtraIds = useRef<Set<string> | undefined>(undefined)
  const isCreature = kind !== null && CREATURE_KINDS.has(kind)
  const sourceOptions = isCreature ? sheet.extras.creatureOptions : sheet.extras.vehicleOptions

  useEffect(() => {
    if (!shouldOpenAdded || !openPanel) return
    const addedExtra = sheet.extras.items.find((extra) => !priorExtraIds.current?.has(extra.id))
    if (!addedExtra) return
    setShouldOpenAdded(false)
    openPanel(getExtraTarget(addedExtra))
  }, [openPanel, shouldOpenAdded, sheet.extras.items])

  function closeDrawer() {
    setKind(null)
    setSourceId(null)
    setOriginKind(null)
    setSubmitError(null)
    controls.close()
  }

  async function addExtra() {
    if (!kind || !sourceId || (isCreature && !originKind)) return
    priorExtraIds.current = new Set(sheet.extras.items.map((extra) => extra.id))
    const added = await submitCommand(
      kind === 'COMPANION' || kind === 'MOUNT' || kind === 'OWNED'
        ? {
            type: 'ADD_SHEET_EXTRA',
            expectedVersion: sheet.meta.streamVersion,
            extra: { kind, creatureId: sourceId, originKind: originKind ?? 'WORLD' }
          }
        : {
            type: 'ADD_SHEET_EXTRA',
            expectedVersion: sheet.meta.streamVersion,
            extra: { kind: 'VEHICLE', vehicleId: sourceId }
          }
    )
    if (added) {
      setShouldOpenAdded(true)
      closeDrawer()
    } else {
      setSubmitError('The extra could not be added. Review the selection and try again.')
    }
  }

  const creatureExtras = sheet.extras.items.filter((extra) => extra.kind !== 'VEHICLE')
  const vehicles = sheet.extras.items.filter((extra) => extra.kind === 'VEHICLE')

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
      <div className={styles.extrasList}>
        {sheet.extras.items.length ? (
          <>
            <ExtraGroup extras={creatureExtras} label='Creatures' openPanel={openPanel} />
            <ExtraGroup extras={vehicles} label='Vehicles' openPanel={openPanel} />
          </>
        ) : (
          <Text className={styles.muted}>No extras have been added to this character.</Text>
        )}
      </div>
      <Drawer
        opened={opened}
        position={isMobile ? 'bottom' : 'right'}
        size={isMobile ? '92%' : '30rem'}
        title='Add Extra'
        onClose={closeDrawer}
      >
        <div className={styles.extraDrawerBody}>
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
              setKind(value as ExtraKind | null)
              setSourceId(null)
              setOriginKind(null)
              setSubmitError(null)
            }}
          />
          {kind ? (
            <Select
              data={sourceOptions.map((option) => ({ value: option.id, label: option.label }))}
              disabled={pending}
              label={isCreature ? 'Creature' : 'Vehicle'}
              placeholder={isCreature ? 'Choose a creature' : 'Choose a vehicle'}
              searchable
              value={sourceId}
              onChange={(value) => {
                setSourceId(value)
                setSubmitError(null)
              }}
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
                setOriginKind(value as OriginKind | null)
                setSubmitError(null)
              }}
            />
          ) : null}
          <div className={styles.extraDrawerActions}>
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
