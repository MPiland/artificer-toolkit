import type { ReactNode } from 'react'
import { ActionIcon, Group, NumberInput, Tabs, Tooltip } from '@mantine/core'
import { IconReplace, IconTrash } from '@tabler/icons-react'
import * as styles from './characterClasses.css'

export function CharacterClassCard({
  featureContent,
  label,
  level,
  onChangeClass,
  onLevelChange,
  onRemove,
  readOnly,
  spellContent
}: {
  featureContent: ReactNode
  label: string
  level: number
  onChangeClass: () => void
  onLevelChange: (level: number | string) => void
  onRemove: () => void
  readOnly: boolean
  spellContent?: ReactNode
}) {
  return (
    <section className={styles.classSection}>
      <div className={styles.classHeader}>
        <div className={styles.classIdentity}>
          <h3 className={styles.classTitle}>{label}</h3>
          <NumberInput
            allowDecimal={false}
            className={styles.classLevelField}
            hideControls
            aria-label={`${label} level`}
            size='xs'
            min={1}
            max={20}
            value={level}
            disabled={readOnly}
            onChange={onLevelChange}
          />
        </div>
        {!readOnly ? (
          <Group gap='xs'>
            <Tooltip label='Change class'>
              <ActionIcon
                aria-label={`Change class: ${label}`}
                type='button'
                variant='default'
                onClick={onChangeClass}
              >
                <IconReplace aria-hidden size={17} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label='Remove class'>
              <ActionIcon
                aria-label={`Remove class: ${label}`}
                type='button'
                variant='subtle'
                color='red'
                onClick={onRemove}
              >
                <IconTrash aria-hidden size={17} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ) : null}
      </div>
      {spellContent ? (
        <Tabs defaultValue='features'>
          <Tabs.List>
            <Tabs.Tab value='features'>Features</Tabs.Tab>
            <Tabs.Tab value='spells'>Spells</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value='features' pt='sm'>
            {featureContent}
          </Tabs.Panel>
          <Tabs.Panel value='spells' pt='sm'>
            {spellContent}
          </Tabs.Panel>
        </Tabs>
      ) : (
        featureContent
      )}
    </section>
  )
}
