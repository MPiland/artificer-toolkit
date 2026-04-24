import { createFileRoute } from '@tanstack/react-router'
import { MarketingPage } from '#app/marketing/pages'

export const Route = createFileRoute('/_guest/')({
  component: MarketingPage
})
