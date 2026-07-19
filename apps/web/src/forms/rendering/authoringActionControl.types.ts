import type { MouseEventHandler, ReactNode } from 'react'
import type {
  NodeRuntimeCollectionActionDto,
  NodeRuntimeObjectActionDto
} from '@artificer-toolkit/schema/api/nodeRuntime'

export type AuthoringAction = NodeRuntimeCollectionActionDto | NodeRuntimeObjectActionDto

export type AuthoringActionControlProps = {
  action: AuthoringAction
  className?: string
  icon: ReactNode
  onClick: MouseEventHandler<HTMLButtonElement>
}
