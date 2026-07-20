import { createFileRoute, redirect } from '@tanstack/react-router'
import { MarketingPage } from '#app/marketing/pages'
import { shouldRedirectRootToHome } from './-guestRouteGuards'

export const Route = createFileRoute('/_guest/')({
  beforeLoad: ({ context }) => {
    if (shouldRedirectRootToHome(context.user)) {
      throw redirect({ to: '/home' })
    }
  },
  component: MarketingRoute
})

function MarketingRoute() {
  const { featureFlags } = Route.useRouteContext()

  return <MarketingPage publicSignUpEnabled={featureFlags?.publicSignUpEnabled} />
}
