import { createContext, useContext } from 'react'

export type NotificationAvailability = 'loading' | 'ready' | 'error'

export const NotificationAvailabilityContext = createContext<NotificationAvailability>('loading')
export const NotificationUnseenCountContext = createContext(0)

export function useNotificationAvailability() {
  return useContext(NotificationAvailabilityContext)
}

export function useNotificationUnseenCount() {
  return useContext(NotificationUnseenCountContext)
}
