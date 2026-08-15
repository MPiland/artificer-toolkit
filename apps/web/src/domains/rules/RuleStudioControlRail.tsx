import type { ReactNode } from 'react'
import { Accordion, Paper } from '@mantine/core'
import * as styles from './RuleStudioControlRail.css'

export function RuleStudioControlRail({
  rulePack,
  model,
  fixtures
}: {
  rulePack: ReactNode
  model: ReactNode
  fixtures: ReactNode
}) {
  return (
    <Paper
      className={styles.root}
      component='aside'
      aria-label='Rule Studio controls'
      radius='md'
      withBorder
    >
      <Accordion
        classNames={{ control: styles.control, item: styles.item, panel: styles.panel }}
        defaultValue='rule-pack'
        variant='contained'
      >
        <Accordion.Item value='rule-pack'>
          <Accordion.Control>Rule pack</Accordion.Control>
          <Accordion.Panel>{rulePack}</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value='model'>
          <Accordion.Control>Model</Accordion.Control>
          <Accordion.Panel>{model}</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value='fixtures'>
          <Accordion.Control>Fixtures</Accordion.Control>
          <Accordion.Panel>{fixtures}</Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Paper>
  )
}
