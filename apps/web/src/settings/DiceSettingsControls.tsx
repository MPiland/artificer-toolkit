import { SegmentedControl, Switch } from '@mantine/core'
import clsx from 'clsx'
import { findOption } from '../forms/utils/valueGuards'
import { DICE_SHADOW_QUALITIES, type DicePresentationPreferences } from './dicePreferences'
import * as styles from './settings.css'

export function DiceSettingsControls({
  compact = false,
  value,
  onChange
}: {
  compact?: boolean
  value: DicePresentationPreferences
  onChange: (value: DicePresentationPreferences) => void
}) {
  return (
    <div className={styles.diceSettings} data-compact={compact || undefined}>
      <div className={clsx(styles.settingRow, compact && styles.compactDiceSettingRow)}>
        <div className={styles.settingCopy}>
          <h3 className={styles.settingTitle}>3D dice animation</h3>
          <p className={styles.settingDescription}>
            Turn this off to show lightweight 2D dice instead.
          </p>
        </div>
        <Switch
          aria-label='3D dice animation'
          checked={value.animate3d}
          onChange={(event) => onChange({ ...value, animate3d: event.currentTarget.checked })}
        />
      </div>
      <div className={clsx(styles.settingRow, compact && styles.compactDiceSettingRow)}>
        <div className={styles.settingCopy}>
          <h3 className={styles.settingTitle}>Post-processing</h3>
          <p className={styles.settingDescription}>
            Disable this if dice animation is slow on this device.
          </p>
        </div>
        <Switch
          aria-label='Dice post-processing'
          checked={value.postProcessing}
          disabled={!value.animate3d}
          onChange={(event) => onChange({ ...value, postProcessing: event.currentTarget.checked })}
        />
      </div>
      <div className={clsx(styles.settingRow, compact && styles.compactDiceSettingRow)}>
        <div className={styles.settingCopy}>
          <h3 className={styles.settingTitle}>Shadow quality</h3>
          <p className={styles.settingDescription}>
            Lower quality uses less graphics processing power.
          </p>
        </div>
        <SegmentedControl
          aria-label='Dice shadow quality'
          className={styles.appearanceControl}
          data={DICE_SHADOW_QUALITIES.map((quality) => ({
            label: quality.charAt(0) + quality.slice(1).toLowerCase(),
            value: quality
          }))}
          disabled={!value.animate3d}
          value={value.shadowQuality}
          onChange={(shadowQuality) => {
            const nextQuality = findOption(DICE_SHADOW_QUALITIES, shadowQuality)
            if (nextQuality) onChange({ ...value, shadowQuality: nextQuality })
          }}
        />
      </div>
    </div>
  )
}
