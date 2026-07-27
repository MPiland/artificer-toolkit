import { MantineProvider } from '@mantine/core'
import { act } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { vi } from 'vitest'
import { ThemeToggle } from './ThemeToggle'

function setPrefersDark(prefersDark: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes('prefers-color-scheme: dark') ? prefersDark : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    })
  })
}

function renderThemeToggle() {
  return (
    <MantineProvider defaultColorScheme='auto'>
      <ThemeToggle />
    </MantineProvider>
  )
}

describe('ThemeToggle', () => {
  it('hydrates without changing server-rendered color-scheme text', async () => {
    setPrefersDark(true)
    const serverHtml = renderToString(renderThemeToggle())
    const container = document.createElement('div')
    container.innerHTML = serverHtml
    document.body.appendChild(container)

    setPrefersDark(false)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    let root: ReturnType<typeof hydrateRoot> | undefined

    await act(async () => {
      root = hydrateRoot(container, renderThemeToggle())
    })

    expect(
      consoleError.mock.calls.some((call) => String(call[0]).includes('Hydration failed'))
    ).toBe(false)

    root?.unmount()
    consoleError.mockRestore()
    container.remove()
  })
})
