import assert from 'node:assert/strict'

type Environment = {
  CONVEX_DEPLOYMENT?: string
  CONVEX_URL?: string
  CONVEX_SITE_URL?: string
}

// Test-runner safety, not product authorization: verify the selected deployment
// with the CLI before running. Never infer a cloud target from a URL alone.
export function developmentTarget(env: Environment) {
  const selector = env.CONVEX_DEPLOYMENT?.split('#')[0].trim()
  assert.ok(selector, 'Load the selected development environment.')
  const urls = [env.CONVEX_URL, env.CONVEX_SITE_URL].map((value) => {
    assert.ok(value, 'Both Convex development URLs are required.')
    const url = new URL(value)
    assert.ok(!url.username && !url.password && !url.search && !url.hash)
    assert.equal(url.pathname, '/')
    return url
  })
  const [deploymentUrl, siteUrl] = urls
  if (selector.startsWith('local:') && selector.length > 6) {
    for (const url of urls) {
      assert.equal(url.protocol, 'http:')
      assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Local URLs only.')
    }
    return { mode: 'local' as const, selector, deploymentUrl, siteUrl }
  }

  const match = /^dev:([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(selector)
  assert.ok(match, 'Only explicit local: or dev: deployments are allowed; no prod/preview targets.')
  assert.equal(deploymentUrl.origin, `https://${match[1]}.convex.cloud`)
  assert.equal(siteUrl.origin, `https://${match[1]}.convex.site`)
  return { mode: 'cloud-dev' as const, selector, deploymentUrl, siteUrl }
}
