import { handleRequest } from '@artificer/functions'
import { getBackgroundListQuery, getBackgroundQuery } from '@artificer/functions'

export const getBackgroundList = handleRequest(getBackgroundListQuery)
export const getBackground = handleRequest(getBackgroundQuery)
