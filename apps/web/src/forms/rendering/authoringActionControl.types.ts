import type { MouseEventHandler, ReactNode } from 'react'
import type {
  NodeRuntimeCollectionActionDto,
  NodeRuntimeObjectActionDto
} from '@artificer-toolkit/schema/api/nodeRuntime'

type AuthoringAction = NodeRuntimeCollectionActionDto | NodeRuntimeObjectActionDto

export type AuthoringActionControlProps = {
  action: AuthoringAction
  className?: string
  icon: ReactNode
  onClick: MouseEventHandler<HTMLButtonElement>
}
