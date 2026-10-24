import { Text } from '@mantine/core'
import type { OpenSheetPanel } from '../core/CharacterSheet.types'
import * as extrasStyles from './extras.css'
import { getExtraTarget, type PanelExtra } from './CharacterSheetExtraList.model'

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
      className={hideOnMobile ? extrasStyles.extraMetricMobileHidden : extrasStyles.extraMetric}
      data-extra-metric={label}
    >
      <small className={extrasStyles.extraMetricLabel}>{label}</small>
      <strong>{value}</strong>
    </span>
  )
}

function getExtraDisplayName(extra: PanelExtra) {
  return extra.customName ? `${extra.displayName} (${extra.authoredName})` : extra.displayName
}

function ExtraRow({ extra, openPanel }: { extra: PanelExtra; openPanel?: OpenSheetPanel }) {
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
      className={extrasStyles.extraDataRow}
      disabled={!openPanel}
      type='button'
      onClick={() => openPanel?.(getExtraTarget(extra))}
    >
      <span className={extrasStyles.extraIdentity}>
        <strong>{getExtraDisplayName(extra)}</strong>
      </span>
      <span className={extrasStyles.extraStatBlock}>
        {creatureMetrics.map(({ hideOnMobile, label, value }) => (
          <ExtraMetric hideOnMobile={hideOnMobile} key={label} label={label} value={value} />
        ))}
      </span>
    </button>
  )
}

export function CharacterSheetExtraList({
  extras,
  label,
  openPanel
}: {
  extras: PanelExtra[]
  label: string
  openPanel?: OpenSheetPanel
}) {
  if (!extras.length) return null

  return (
    <section className={extrasStyles.extraGroup} aria-label={label}>
      <Text className={extrasStyles.extraGroupTitle} component='h3'>
        {label}
      </Text>
      <div className={extrasStyles.extraGroupRows}>
        {extras.map((extra) => (
          <ExtraRow extra={extra} key={extra.id} openPanel={openPanel} />
        ))}
      </div>
    </section>
  )
}
