import { internalQuery as rawInternalQuery, query as rawQuery } from '../_generated/server'
import { withDomainRejections } from './domainRejectionTransport'

export const query = withDomainRejections(rawQuery)
export const internalQuery = withDomainRejections(rawInternalQuery)
