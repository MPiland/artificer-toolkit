import { fireEvent, screen } from '@testing-library/react'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { RuleGraphEditor } from './RuleGraphEditor'

const themeMock = vi.hoisted(() => ({ mode: 'dark' as 'dark' | 'light' }))
const jdmMocks = vi.hoisted(() => ({
  decisionGraph: vi.fn(),
  provider: vi.fn()
}))

vi.mock('@mantine/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@mantine/core')>()),
  useComputedColorScheme: () => themeMock.mode
}))

vi.mock('@gorules/jdm-editor', async () => {
  const { createElement } = await import('react')
  const specification = (displayName: string) => ({ displayName, icon: null })

  return {
    DecisionGraph: (props: Record<string, unknown>) => {
      jdmMocks.decisionGraph(props)
      return createElement('div', { 'data-testid': 'decision-graph' })
    },
    JdmConfigProvider: ({
      children,
      theme
    }: {
      children: React.ReactNode
      theme?: { mode?: 'dark' | 'light' }
    }) => {
      jdmMocks.provider(theme)
      return createElement('div', null, children)
    },
    nodeSpecification: {
      inputNode: specification('Request'),
      outputNode: specification('Response'),
      decisionTableNode: specification('Decision table'),
      expressionNode: specification('Expression'),
      functionNode: specification('Function'),
      switchNode: specification('Switch')
    }
  }
})

describe('RuleGraphEditor', () => {
  beforeEach(() => {
    themeMock.mode = 'dark'
    jdmMocks.decisionGraph.mockReset()
    jdmMocks.provider.mockReset()
  })

  it('offers one supported palette and hides JDM built-ins', () => {
    renderWithAppProviders(
      <RuleGraphEditor disabled={false} value={{ nodes: [], edges: [] }} onChange={vi.fn()} />
    )

    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.queryByText('Function')).not.toBeInTheDocument()
    expect(jdmMocks.decisionGraph).toHaveBeenCalledWith(
      expect.objectContaining({ disabled: false, hideLeftToolbar: true })
    )
    expect(jdmMocks.decisionGraph.mock.calls[0]?.[0]).not.toHaveProperty('components')
  })

  it('uses the application color scheme and emits JDM drag data', () => {
    const { rerender } = renderWithAppProviders(
      <RuleGraphEditor disabled={false} value={{ nodes: [], edges: [] }} onChange={vi.fn()} />
    )
    expect(jdmMocks.provider).toHaveBeenLastCalledWith({ mode: 'dark' })

    const setData = vi.fn()
    fireEvent.dragStart(screen.getByText('Request').closest('[role="listitem"]')!, {
      clientX: 0,
      clientY: 0,
      dataTransfer: { effectAllowed: 'none', setData }
    })
    expect(setData).toHaveBeenCalledWith('nodeType', 'inputNode')
    expect(setData).toHaveBeenCalledWith('relativePosition', expect.any(String))

    themeMock.mode = 'light'
    rerender(
      <RuleGraphEditor disabled={false} value={{ nodes: [], edges: [] }} onChange={vi.fn()} />
    )
    expect(jdmMocks.provider).toHaveBeenLastCalledWith({ mode: 'light' })
  })

  it('disables Request after an input node exists', () => {
    renderWithAppProviders(
      <RuleGraphEditor
        disabled={false}
        value={{
          nodes: [{ id: 'input', type: 'inputNode', name: 'Input', position: { x: 0, y: 0 } }],
          edges: []
        }}
        onChange={vi.fn()}
      />
    )

    expect(screen.getByText('Request').closest('[role="listitem"]')).toHaveAttribute(
      'aria-disabled',
      'true'
    )
  })

  it('collapses the floating component palette without removing its nodes', () => {
    renderWithAppProviders(
      <RuleGraphEditor disabled={false} value={{ nodes: [], edges: [] }} onChange={vi.fn()} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Collapse components' }))

    expect(screen.getByRole('complementary', { name: 'Rule components' })).toHaveAttribute(
      'data-collapsed'
    )
    expect(screen.queryByText('Request')).not.toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.getByRole('button', { name: 'Expand components' })).toBeInTheDocument()
  })
})
