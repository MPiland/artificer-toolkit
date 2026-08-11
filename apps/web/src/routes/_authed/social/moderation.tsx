import { createFileRoute } from '@tanstack/react-router'
import { SocialModerationPage } from '#domains/social/SocialModerationPage'

export const Route = createFileRoute('/_authed/social/moderation')({
  component: SocialModerationPage
})
