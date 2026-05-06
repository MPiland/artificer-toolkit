import { Badge, Button, Group, Text, Title } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { AuthoredDetailProse } from '#app/components/AuthoredDetail'
import * as styles from './characterSheet.css'
import type { CharacterSheet } from './CharacterSheet.types'

export function CharacterSheetHero({
  hasDraft,
  sheet
}: {
  hasDraft: boolean
  sheet: CharacterSheet
}) {
  const navigate = useNavigate()
  const characterId = sheet.meta.characterId

  return (
    <header className={styles.hero}>
      <div>
        <Text className={styles.eyebrow}>Character Sheet</Text>
        <Title className={styles.heroTitle}>{sheet.identity.label}</Title>
        <Text className={styles.heroMeta}>
          {sheet.identity.classSummary}
          {sheet.identity.raceLabel ? `, ${sheet.identity.raceLabel}` : ''}
          {sheet.identity.backgroundLabel ? `, ${sheet.identity.backgroundLabel}` : ''}
        </Text>
        {sheet.identity.description ? <AuthoredDetailProse html={sheet.identity.description} fallback='' /> : null}
        <Group mt='md' gap='xs'>
          <Badge variant='light'>
            Level
            {' '}
            {sheet.identity.totalLevel}
          </Badge>
          {hasDraft ? <Badge color='yellow' variant='light'>Builder draft pending</Badge> : null}
        </Group>
      </div>
      <div className={styles.heroActions}>
        <Button onClick={() => navigate({ to: '/characters/$characterId/edit', params: { characterId } })}>
          {hasDraft ? 'Resume Builder' : 'Edit Builder'}
        </Button>
        <Button variant='default' onClick={() => navigate({ to: '/characters' })}>Back to Characters</Button>
      </div>
    </header>
  )
}
