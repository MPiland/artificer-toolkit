import { ActionIcon, Badge, Text, Title, Tooltip } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { Settings } from 'lucide-react'
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
        <div className={styles.heroIdentityCopy}>
          <Text className={styles.eyebrow}>Character Sheet</Text>
          <Title className={styles.heroTitle}>{sheet.identity.label}</Title>
          <div className={styles.heroClassLine}>
            <Text className={styles.heroMeta}>{sheet.identity.classSummary}</Text>
            {hasDraft ? (
              <Badge color='yellow' variant='light'>
                Builder draft pending
              </Badge>
            ) : null}
          </div>
          <Text className={styles.heroSubMeta}>
            {[sheet.identity.raceLabel, sheet.identity.backgroundLabel].filter(Boolean).join(' / ')}
          </Text>
        </div>
      </div>
      <Tooltip label={hasDraft ? 'Resume builder draft' : 'Edit character'}>
        <ActionIcon
          aria-label={hasDraft ? 'Resume builder draft' : 'Edit character'}
          className={styles.heroIconAction}
          size='lg'
          variant='default'
          onClick={() =>
            navigate({
              to: '/characters/$characterPublicId/$characterSlug/edit',
              params: characterParams
            })
          }
        >
          <Settings aria-hidden='true' size={18} />
        </ActionIcon>
      </Tooltip>
    </header>
  )
}
