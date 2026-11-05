import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runnerProofs } from './runnerProofs.mjs'
// A namespace import, so a lifecycle without the stage list fails this test instead of failing to load.
import * as lifecycle from './validatePreStagingLocal.mjs'

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
    const environment = lifecycle.localChildEnvironment({ EXTRA: 'kept' })

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

describe('lifecycle proof stages', () => {
  const runnerSet = runnerProofs(
    readFileSync(resolve(import.meta.dirname, 'runLocalConvexProof.ps1'), 'utf8')
  )
  const proofStages = () => lifecycle.stages.filter(({ proof }) => proof)

  it('runs every proof of the runner -Proof ValidateSet exactly once', () => {
    expect(
      proofStages()
        .map(({ proof }) => proof)
        .sort()
    ).toEqual([...runnerSet].sort())
  })

  it('runs native proofs before browser proofs and the VTT browser proof last', () => {
    const names = proofStages().map(({ name }) => name)
    const firstBrowser = names.findIndex((name) => name.startsWith('r08-browser-'))
    expect(names.slice(firstBrowser).every((name) => name.startsWith('r08-browser-'))).toBe(true)
    expect(names.at(-1)).toBe(`r08-browser-${lifecycle.selfManagedBrowserProof}`)
  })
})

describe('lifecycle package tests', () => {
  // At one worker per logical core the authoring parity files time out from contention alone.
  it('bounds the workers of every package suite on the root Vitest config', () => {
    const testScript = (workspace) => {
      const name = workspace.replace('@artificer-toolkit/', '')
      const manifest = ['packages', 'apps']
        .map((parent) => resolve(import.meta.dirname, '..', parent, name, 'package.json'))
        .find((path) => existsSync(path))
      return JSON.parse(readFileSync(manifest, 'utf8')).scripts.test
    }
    const rootVitestStages = lifecycle.stages.filter(
      ({ args }) =>
        args[0] === 'workspace' &&
        args[2] === 'test' &&
        testScript(args[1]).startsWith('yarn --cwd ../.. vitest')
    )

    expect(rootVitestStages.length).toBeGreaterThan(0)
    for (const { args, name } of rootVitestStages)
      expect(
        args.some((arg) => arg.startsWith('--maxWorkers=')),
        name
      ).toBe(true)
  })
})

describe('lifecycle signing keys', () => {
  it('pins JWKS after the reset and before the push that evaluates the auth config', () => {
    const names = lifecycle.stages.map(({ name }) => name)
    const pin = names.indexOf('convex-signing-keys')
    expect(pin).toBe(names.indexOf('convex-reset') + 1)
    expect(pin).toBe(names.indexOf('convex-codegen') - 1)
  })
})
