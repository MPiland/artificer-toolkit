import { ActionIcon, Badge, Group, Text, Title, Tooltip } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { Settings } from 'lucide-react'
import { AuthoredDetailProse } from '#app/components/AuthoredDetail'
import IShield from '#assets/icons/IShield'
import { buildCharacterRouteParams } from '#app/routing/authoredRouteParams'
import * as styles from './characterSheet.css'
import type { CharacterSheet } from './CharacterSheet.types'

export function CharacterSheetHero({
  characterPublicId,
  hasDraft,
  sheet
}: {
  characterPublicId: string
  hasDraft: boolean
  sheet: CharacterSheet
}) {
  const navigate = useNavigate()
  const characterParams = buildCharacterRouteParams(characterPublicId, sheet.identity.label)

  return (
    <header className={styles.hero}>
      <div className={styles.heroIdentity}>
        <div className={styles.characterMark} aria-hidden='true'>
          <IShield className={styles.characterMarkIcon} />
        </div>
        <div>
          <Text className={styles.eyebrow}>Character Sheet</Text>
          <Title className={styles.heroTitle}>{sheet.identity.label}</Title>
          <Text className={styles.heroMeta}>
            {sheet.identity.classSummary}
          </Text>
          <Text className={styles.heroSubMeta}>
            {[sheet.identity.raceLabel, sheet.identity.backgroundLabel].filter(Boolean).join(' / ')}
          </Text>
          {sheet.identity.description ? <AuthoredDetailProse html={sheet.identity.description} fallback='' /> : null}
          <Group mt='xs' gap='xs'>
            <Badge variant='light'>
              Level
              {' '}
              {sheet.identity.totalLevel}
            </Badge>
            {hasDraft ? <Badge color='yellow' variant='light'>Builder draft pending</Badge> : null}
          </Group>
        </div>
      </div>
      <Tooltip label={hasDraft ? 'Resume builder draft' : 'Edit character'}>
        <ActionIcon
          aria-label={hasDraft ? 'Resume builder draft' : 'Edit character'}
          className={styles.heroIconAction}
          size='lg'
          variant='default'
          onClick={() => navigate({ to: '/characters/$characterPublicId/$characterSlug/edit', params: characterParams })}
        >
          <Settings aria-hidden='true' size={18} />
        </ActionIcon>
      </Tooltip>
    </header>
  )
}
