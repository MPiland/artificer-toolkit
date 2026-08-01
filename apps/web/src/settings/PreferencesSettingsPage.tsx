import { SegmentedControl, useMantineColorScheme } from '@mantine/core'
import { DiceSettingsControls } from './DiceSettingsControls'
import { useDicePresentationPreferences } from './dicePreferences'
import * as styles from './settings.css'

export function PreferencesSettingsPage() {
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const [dicePreferences, setDicePreferences] = useDicePresentationPreferences()

  return (
    <section aria-labelledby='preferences-settings-title'>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle} id='preferences-settings-title'>
          Preferences
        </h1>
        <p className={styles.pageDescription}>Choose how the Forge looks in this browser.</p>
      </header>
      <div className={styles.settingRow}>
        <div className={styles.settingCopy}>
          <h3 className={styles.settingTitle}>Appearance</h3>
          <p className={styles.settingDescription}>
            System follows the light or dark preference of each device.
          </p>
        </div>
        <SegmentedControl
          aria-label='Appearance'
          className={styles.appearanceControl}
          data={[
            { label: 'System', value: 'auto' },
            { label: 'Light', value: 'light' },
            { label: 'Dark', value: 'dark' }
          ]}
          value={colorScheme}
          onChange={(value) =>
            setColorScheme(value === 'light' || value === 'dark' ? value : 'auto')
          }
        />
      </div>
      <DiceSettingsControls value={dicePreferences} onChange={setDicePreferences} />
    </section>
  )
}
