import {
  internalQuery as rawInternalQuery,
  query as rawQuery,
  type QueryCtx
} from '../_generated/server'
import { translateDomainRejections } from './domainRejectionTransport'
import { withLazyValidators } from './lazyValidators'

export const query = withLazyValidators<'query', QueryCtx, 'public'>(
  rawQuery,
  translateDomainRejections
)
export const internalQuery = withLazyValidators<'query', QueryCtx, 'internal'>(
  rawInternalQuery,
  translateDomainRejections
)
