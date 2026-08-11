import { SegmentedControl, useMantineColorScheme } from '@mantine/core'
import { useAuthoringExperience } from '#forms/layout/useAuthoringExperience'
import { DiceSettingsControls } from './DiceSettingsControls'
import { MatureContentPreference } from './MatureContentPreference'
import { useDicePresentationPreferences } from './dicePreferences'
import * as styles from './settings.css'

export function PreferencesSettingsPage() {
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const [dicePreferences, setDicePreferences] = useDicePresentationPreferences()
  const { experience, isUpdating, setExperience } = useAuthoringExperience()

  return (
    <section aria-labelledby='preferences-settings-title'>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle} id='preferences-settings-title'>
          Preferences
        </h1>
        <p className={styles.pageDescription}>Choose how the Forge looks and works for you.</p>
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
      <div className={styles.settingRow}>
        <div className={styles.settingCopy}>
          <h3 className={styles.settingTitle}>Authoring experience</h3>
          <p className={styles.settingDescription}>
            Guided asks a few plain-language questions. Advanced exposes every mechanic.
          </p>
        </div>
        <SegmentedControl
          aria-label='Authoring experience'
          className={styles.appearanceControl}
          data={[
            { label: 'Guided', value: 'guided' },
            { label: 'Advanced', value: 'advanced' }
          ]}
          disabled={isUpdating}
          value={experience}
          onChange={(value) => void setExperience(value === 'advanced' ? 'advanced' : 'guided')}
        />
      </div>
      <MatureContentPreference />
      <DiceSettingsControls value={dicePreferences} onChange={setDicePreferences} />
    </section>
  )
}
