import { Text } from '@mantine/core'
import { SlidersHorizontal, TrendingUp } from 'lucide-react'
import { ContextCard } from '../ContextCard/ContextCard'
import * as contextStyles from '../ContextCard/ContextCard.css'
import { EditorHeader } from '../EditorHeader/EditorHeader'
import { EditorSection } from '../EditorSection/EditorSection'
import { Table } from '../Table/Table'
import { ScalingModelFields } from '../ScalingModelFields/ScalingModelFields'
import type { EditorCanvasProps } from './EditorCanvas.types'
import * as styles from './EditorCanvas.css'

export function EditorCanvas({ path, table, title }: EditorCanvasProps) {
  return (
    <main className={styles.canvas}>
      <EditorHeader path={path} title={title} />
      <div className={styles.content}>
        <div className={styles.contentStack}>
          <EditorSection
            headingId='forge-scaling-model-heading'
            icon={<SlidersHorizontal aria-hidden='true' size={14} />}
            title='Scaling Model'
          >
            <ScalingModelFields />
          </EditorSection>

          <EditorSection
            headingId='forge--heading'
            icon={<TrendingUp aria-hidden='true' size={14} />}
            title='Scaling '
          >
            <Table {...table} />
          </EditorSection>
        </div>

        <aside className={styles.contentStack} aria-label='Context preview'>
          <ContextCard
            title='Outcome context'
            titleId='forge-outcome-heading'
            header={{ divider: true }}
          >
            <ul className={contextStyles.ruleList}>
              <li className={contextStyles.ruleItem}>
                <span>Outcome</span>
                <strong>Damage</strong>
              </li>
              <li className={contextStyles.ruleItem}>
                <span>Damage type</span>
                <strong className={contextStyles.damageValue}>Fire</strong>
              </li>
              <li className={contextStyles.ruleItem}>
                <span>Save result</span>
                <strong>Failure</strong>
              </li>
            </ul>
          </ContextCard>

          <ContextCard
            title='Spell Preview'
            titleId='forge-description-heading'
            header={{ emphasized: true }}
          >
            <Text component='p' className={contextStyles.previewText}>
              A lance of ember erupts in a line from a point you choose. Each creature in the line
              makes a Dexterity saving throw. A creature takes{' '}
              <span className={contextStyles.damageValue}>3d6 fire</span> damage on a failed save,
              or half as much on a successful one.
            </Text>
            <Text component='p' className={contextStyles.previewSubheading}>
              <em>At higher levels</em>
            </Text>
            <Text component='p' className={contextStyles.previewText}>
              The damage increases to <span className={contextStyles.damageValue}>4d6</span> at cast
              level 2 and <span className={contextStyles.damageValue}>5d6</span> at cast level 3.
            </Text>
          </ContextCard>
        </aside>
      </div>
    </main>
  )
}
