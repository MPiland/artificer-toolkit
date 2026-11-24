import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { UpdatePasswordPage } from './pages/UpdatePasswordPage'

// Real page, form and Better Auth client; only the network and the document load are faked.
const invite = { email: 'player@example.com', token: 'a'.repeat(64) }
const chosen = { username: 'player_one', password: 'invited-password-123' }

function authServer(responses: Record<string, { status: number; body: object }>) {
  const requests: { path: string; body: unknown }[] = []
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    const path = new URL(request.url).pathname.replace(/^\/api\/auth/, '')
    requests.push({ path, body: await request.json().catch(() => null) })
    const response = responses[path] ?? { status: 404, body: {} }
    return Response.json(response.body, { status: response.status })
  })
  vi.stubGlobal('fetch', fetch)
  return requests
}

async function completeInvitation() {
  renderWithAppProviders(<UpdatePasswordPage invitation />, {
    initialPath: '/update-password?flow=invite'
  })
  fireEvent.change(await screen.findByRole('textbox', { name: /^username/i }), {
    target: { value: chosen.username }
  })
  fireEvent.change(screen.getByLabelText(/new password/i, { selector: 'input' }), {
    target: { value: chosen.password }
  })
  fireEvent.change(screen.getByLabelText(/confirm password/i, { selector: 'input' }), {
    target: { value: chosen.password }
  })
  const submit = screen.getByRole('button', { name: 'Complete registration' })
  await waitFor(() => expect(submit).toBeEnabled())
  fireEvent.click(submit)
}

describe('completing an invitation', () => {
  const assign = vi.fn()

  beforeEach(() => {
    assign.mockReset()
    window.history.replaceState(
      {},
      '',
      `/update-password?flow=invite#email=${encodeURIComponent(invite.email)}&token=${invite.token}`
    )
    vi.stubGlobal('location', { ...window.location, assign })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('signs the new account in with the credentials just set and opens the signed-in home', async () => {
    const requests = authServer({
      '/invitation/redeem': { status: 200, body: { success: true } },
      '/sign-in/email': {
        status: 200,
        body: { redirect: false, token: 'session-token', user: { email: invite.email } }
      }
    })

    await completeInvitation()

    await waitFor(() => expect(assign).toHaveBeenCalledExactlyOnceWith('/home'))
    expect(requests).toEqual([
      { path: '/invitation/redeem', body: { ...invite, ...chosen } },
      { path: '/sign-in/email', body: { email: invite.email, password: chosen.password } }
    ])
  })

  it('keeps a failed redemption on the invitation page with the error and signs nobody in', async () => {
    const requests = authServer({
      '/invitation/redeem': {
        status: 400,
        body: { message: 'Invitation is invalid or expired, or the username is unavailable.' }
      },
      '/sign-in/email': { status: 200, body: { token: 'session-token' } }
    })

    await completeInvitation()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not complete registration.')
    expect(screen.getByRole('heading', { name: 'Complete your account' })).toBeInTheDocument()
    expect(requests.map(({ path }) => path)).toEqual(['/invitation/redeem'])
    expect(assign).not.toHaveBeenCalled()
  })
})
