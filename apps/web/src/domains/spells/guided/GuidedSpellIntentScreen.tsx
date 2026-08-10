import { Button } from '@mantine/core'
import { Flame, HeartPulse, MoveRight, ShieldAlert } from 'lucide-react'
import type { GuidedSpellIntent } from '#forms/guided/guidedSimpleEffect.types'
import * as styles from '#forms/guided/guidedAuthoring.css'

export function GuidedSpellIntentScreen({
  selectedIntent,
  onSelect
}: {
  selectedIntent?: GuidedSpellIntent
  onSelect: (intent: GuidedSpellIntent) => void
}) {
  return (
    <div className={styles.choiceGrid} role='group' aria-label='Spell outcome'>
      <Button
        aria-pressed={selectedIntent === 'DAMAGE'}
        className={styles.choiceButton}
        data-selected={selectedIntent === 'DAMAGE' ? 'true' : undefined}
        justify='flex-start'
        leftSection={<Flame className={styles.choiceIcon} size={24} aria-hidden />}
        variant='default'
        onClick={() => onSelect('DAMAGE')}
      >
        <span className={styles.choiceCopy}>
          <span className={styles.choiceTitle}>Damage</span>
          <span className={styles.choiceDescription}>
            Deal damage, like a bolt of fire or burst of cold.
          </span>
        </span>
      </Button>
      <Button
        aria-pressed={selectedIntent === 'CONDITION'}
        className={styles.choiceButton}
        data-selected={selectedIntent === 'CONDITION' ? 'true' : undefined}
        justify='flex-start'
        leftSection={<ShieldAlert className={styles.choiceIcon} size={24} aria-hidden />}
        variant='default'
        onClick={() => onSelect('CONDITION')}
      >
        <span className={styles.choiceCopy}>
          <span className={styles.choiceTitle}>Condition</span>
          <span className={styles.choiceDescription}>
            Apply a state, like blinded, charmed, or restrained.
          </span>
        </span>
      </Button>
      <Button
        aria-pressed={selectedIntent === 'HEALING'}
        className={styles.choiceButton}
        data-selected={selectedIntent === 'HEALING' ? 'true' : undefined}
        justify='flex-start'
        leftSection={<HeartPulse className={styles.choiceIcon} size={24} aria-hidden />}
        variant='default'
        onClick={() => onSelect('HEALING')}
      >
        <span className={styles.choiceCopy}>
          <span className={styles.choiceTitle}>Healing</span>
          <span className={styles.choiceDescription}>
            Restore hit points or grant temporary hit points.
          </span>
        </span>
      </Button>
      <Button
        aria-pressed={selectedIntent === 'MOVEMENT'}
        className={styles.choiceButton}
        data-selected={selectedIntent === 'MOVEMENT' ? 'true' : undefined}
        justify='flex-start'
        leftSection={<MoveRight className={styles.choiceIcon} size={24} aria-hidden />}
        variant='default'
        onClick={() => onSelect('MOVEMENT')}
      >
        <span className={styles.choiceCopy}>
          <span className={styles.choiceTitle}>Movement</span>
          <span className={styles.choiceDescription}>
            Push or pull a creature across the battlefield.
          </span>
        </span>
      </Button>
    </div>
  )
}
