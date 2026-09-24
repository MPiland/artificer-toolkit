import { convexQuery } from '@convex-dev/react-query'
import { api } from '@artificer-toolkit/apis/convex/api'

export function getAccountEntitlementsQuery() {
  return convexQuery(api.accountEntitlements.get, {})
}
