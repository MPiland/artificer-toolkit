import * as notificationContracts from '@artificer-toolkit/schema/api/notifications'
import { request, type TrpcClient } from './transport'

export function buildNotificationsApi(client: TrpcClient) {
  return {
    session: () =>
      request('notifications.session', notificationContracts.notificationSessionDtoSchema, () =>
        client.notifications.session.query()
      )
  }
}
