import { fetchAuthSession } from 'aws-amplify/auth'
import { generateClient } from 'aws-amplify/data'

export const adminDomainClient = generateClient({
  endpoint: import.meta.env.VITE_AWS_ADMIN_DOMAIN_GRAPHQL_ENDPOINT,
  region: import.meta.env.VITE_AWS_DEFAULT_REGION,
  authMode: 'userPool',
})

export const adminFeatureClient = generateClient({
  endpoint: import.meta.env.VITE_AWS_ADMIN_FEATURE_GRAPHQL_ENDPOINT,
  region: import.meta.env.VITE_AWS_DEFAULT_REGION,
  authMode: 'userPool',
})

export const userDomainClient = generateClient({
  endpoint: import.meta.env.VITE_AWS_USER_DOMAIN_GRAPHQL_ENDPOINT,
  region: import.meta.env.VITE_AWS_DEFAULT_REGION,
  authMode: 'userPool',
})

export const userFeatureClient = generateClient({
  endpoint: import.meta.env.VITE_AWS_USER_FEATURE_GRAPHQL_ENDPOINT,
  region: import.meta.env.VITE_AWS_DEFAULT_REGION,
  authMode: 'userPool',
})

export const getClient = async () => {
  const { tokens } = await fetchAuthSession()
  const groups = tokens?.accessToken?.payload?.['cognito:groups'] as string[]
  const master = groups?.includes('Admins') || false

  return {
    domainClient: master ? adminDomainClient : userDomainClient,
    master,
    featureClient: master ? adminFeatureClient : userFeatureClient,
  }
}
