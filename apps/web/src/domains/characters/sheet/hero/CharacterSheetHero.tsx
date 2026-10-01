import type { CharacterSheetCommonDto } from '@artificer-toolkit/schema/api/characterSheetSlices'
import { ActionIcon, Badge, Text, Title, Tooltip } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { MessageCircle, Settings } from 'lucide-react'
import type { ReactNode } from 'react'
import { MediaImageControl } from '#app/components/MediaImage'
import { buildCharacterRouteParams } from '#app/routing/authoredRouteParams'
import * as heroStyles from './hero.css'

export function CharacterSheetHero({
  campaignActions,
  characterPublicId,
  editable,
  hasDraft,
  onOpenRollHistory,
  sheet
}: {
  campaignActions?: ReactNode
  characterPublicId: string
  editable: boolean
  hasDraft: boolean
  onOpenRollHistory?: () => void
  sheet: Omit<CharacterSheetCommonDto, 'hasSpellcasting'>
}) {
  const navigate = useNavigate()
  const characterParams = buildCharacterRouteParams(characterPublicId, sheet.identity.label)

  return (
    <section aria-label='Character identity' className={heroStyles.hero}>
      <div className={heroStyles.heroIdentity}>
        <div className={heroStyles.characterMark}>
          <MediaImageControl
            disabled={!editable}
            label='Change portrait'
            mode='square'
            profile='CHARACTER_PORTRAIT'
            target={{
              lookup: { type: 'CHARACTER_PORTRAIT', characterId: sheet.meta.characterId },
              attach: { type: 'CHARACTER_PORTRAIT', characterId: sheet.meta.characterId }
            }}
            variant='portrait'
          />
        </div>
        <div className={heroStyles.heroIdentityCopy}>
          <Text className={heroStyles.eyebrow}>Character Sheet</Text>
          <Title className={heroStyles.heroTitle}>{sheet.identity.label}</Title>
          <div className={heroStyles.heroClassLine}>
            <Text className={heroStyles.heroMeta}>{sheet.identity.classSummary}</Text>
            {hasDraft ? (
              <Badge color='yellow' variant='light'>
                Builder draft pending
              </Badge>
            ) : null}
          </div>
          <Text className={heroStyles.heroSubMeta}>
            {[sheet.identity.raceLabel, sheet.identity.backgroundLabel].filter(Boolean).join(' / ')}
          </Text>
        </div>
      </div>
      <div
        className={`${heroStyles.heroActions} ${
          campaignActions ? heroStyles.heroActionsMobileRow : ''
        }`}
      >
        {campaignActions}
        <Tooltip label='Roll history'>
          <ActionIcon
            aria-label='Open roll history'
            className={heroStyles.heroIconAction}
            disabled={!onOpenRollHistory}
            size='lg'
            variant='default'
            onClick={onOpenRollHistory}
          >
            <MessageCircle aria-hidden='true' size={18} />
          </ActionIcon>
        </Tooltip>
        {editable ? (
          <Tooltip label={hasDraft ? 'Resume builder draft' : 'Edit character'}>
            <ActionIcon
              aria-label={hasDraft ? 'Resume builder draft' : 'Edit character'}
              className={heroStyles.heroIconAction}
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
        ) : null}
      </div>
    </section>
  )
}
