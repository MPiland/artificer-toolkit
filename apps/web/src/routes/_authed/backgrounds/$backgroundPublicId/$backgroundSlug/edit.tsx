import { createFileRoute } from '@tanstack/react-router'
import { BackgroundEditPage } from '#domains/backgrounds'

export const Route = createFileRoute('/_authed/backgrounds/$backgroundPublicId/$backgroundSlug/edit')({
  component: () => <BackgroundEditPage />
})
