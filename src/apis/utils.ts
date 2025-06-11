import { fetchAuthSession } from 'aws-amplify/auth'
import { adminClient, userClient } from 'src/main'

export const getClient = async () => {
  const { tokens } = await fetchAuthSession()
  const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
  const master = groups?.includes('Admins') || false

  return { client: master ? adminClient : userClient, master }
}
