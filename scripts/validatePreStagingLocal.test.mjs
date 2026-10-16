import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { localChildEnvironment } from './validatePreStagingLocal.mjs'

const loopback = 'http://127.0.0.1:3210'

describe('localChildEnvironment', () => {
  const hostEnvironment = process.env

  // The lifecycle strips remote-only names from process.env before any child starts, so the test starts from
  // an environment that holds only the local target and the Convex cloud selectors.
  beforeEach(() => {
    process.env = {
      CONVEX_SITE_URL: 'http://127.0.0.1:3211',
      CONVEX_URL: loopback,
      CONVEX_SELF_HOSTED_URL: loopback,
      VITE_CONVEX_URL: loopback,
      CONVEX_SELF_HOSTED_ADMIN_KEY: 'instance|secret',
      CONVEX_DEPLOYMENT: 'local:phase82-local-linux',
      CONVEX_DEPLOY_KEY: 'prod:cloud-key'
    }
  })

  afterEach(() => {
    process.env = hostEnvironment
  })

  it('keeps the Convex deployment selector and deploy key away from every child', () => {
    const environment = localChildEnvironment({ EXTRA: 'kept' })

    expect(environment).not.toHaveProperty('CONVEX_DEPLOYMENT')
    expect(environment).not.toHaveProperty('CONVEX_DEPLOY_KEY')
    expect(environment).toMatchObject({
      CONVEX_SELF_HOSTED_URL: loopback,
      EXTRA: 'kept',
      GOMAXPROCS: '2',
      YARN_ENABLE_NETWORK: '0'
    })
  })
})
