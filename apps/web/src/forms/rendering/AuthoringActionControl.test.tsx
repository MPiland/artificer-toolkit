import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { NodeRuntimeCollectionActionDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import { TestRouterProvider } from '#test/TestRouterProvider'
import { AuthoringActionControl } from './AuthoringActionControl'

const cases = [
  {
    action: {
      type: 'collection.remove',
      label: 'Remove option',
      presentation: {
        default: {
          display: 'icon',
          emphasis: 'quiet',
          width: 'content',
          density: 'compact'
        }
      }
    },
    expectedText: '',
    expectedVariant: 'subtle',
    hasIcon: true
  },
  {
    action: {
      type: 'collection.edit',
      label: 'Edit option',
      presentation: {
        default: {
          display: 'text',
          emphasis: 'quiet',
          width: 'content',
          density: 'compact'
        }
      }
    },
    expectedText: 'Edit option',
    expectedVariant: 'subtle',
    hasIcon: true
  },
  {
    action: {
      type: 'collection.remove',
      label: 'Remove condition',
      presentation: {
        default: {
          display: 'text',
          emphasis: 'quiet',
          width: 'content',
          density: 'compact'
        }
      }
    },
    expectedText: 'Remove condition',
    expectedVariant: 'subtle',
    hasIcon: false
  },
  {
    action: {
      type: 'collection.add',
      label: 'Add option',
      presentation: {
        default: {
          display: 'button',
          emphasis: 'secondary',
          width: 'full',
          density: 'comfortable'
        }
      }
    },
    expectedText: 'Add option',
    expectedVariant: 'default',
    hasIcon: true
  }
] as const satisfies readonly {
  action: NodeRuntimeCollectionActionDto
  expectedText: string
  expectedVariant: string
  hasIcon?: boolean
}[]

describe('AuthoringActionControl', () => {
  it.each(cases)(
    'renders $action.presentation.default.display actions',
    ({ action, expectedText, expectedVariant, hasIcon }) => {
      const onClick = vi.fn()

      render(
        <TestRouterProvider>
          <AuthoringActionControl
            action={action}
            icon={<span aria-hidden='true' data-testid='action-icon' />}
            onClick={onClick}
          />
        </TestRouterProvider>
      )

      const control = screen.getByRole('button', { name: action.label })
      expect(control).toHaveAttribute('data-variant', expectedVariant)
      expect(control).toHaveTextContent(expectedText)
      if (action.type === 'collection.remove') {
        expect(control).toHaveAttribute('data-destructive', 'true')
      } else {
        expect(control).not.toHaveAttribute('data-destructive')
      }
      expect(screen.queryByTestId('action-icon') !== null).toBe(hasIcon)

      fireEvent.click(control)
      expect(onClick).toHaveBeenCalledTimes(1)
    }
  )
})
