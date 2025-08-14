import { QueryClient } from '@tanstack/react-query'
import { accessTokenVerifier, getToken } from './auth.api'

export const queryClient = new QueryClient()

export const getClient = async () => {
  const accessToken = getToken('cognito-access-token')
  if (!accessToken) return { domainClient: null, featureClient: null, master: false }
  try {
    const decodedAccessToken = await accessTokenVerifier.verify(accessToken)
    const groups = decodedAccessToken['cognito:groups'] as string[]
    const master = groups?.includes('Admins') || false

    return {
      domainEndpoint:
        master ?
          import.meta.env.VITE_AWS_ADMIN_DOMAIN_GRAPHQL_ENDPOINT
        : import.meta.env.VITE_AWS_USER_DOMAIN_GRAPHQL_ENDPOINT,
      featureEndpoint:
        master ?
          import.meta.env.VITE_AWS_ADMIN_FEATURE_GRAPHQL_ENDPOINT
        : import.meta.env.VITE_AWS_USER_FEATURE_GRAPHQL_ENDPOINT,
      master,
    }
  } catch {
    return { domainClient: null, featureClient: null, master: false }
  }
}
