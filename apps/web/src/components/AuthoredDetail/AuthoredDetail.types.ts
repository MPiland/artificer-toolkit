import type { ReactNode } from 'react'

type AuthoredDetailNoticeTone = 'draft' | 'warning' | 'info'

type AuthoredDetailActionTone = 'primary' | 'secondary' | 'quiet' | 'danger'

export interface AuthoredDetailAction {
  label: string
  tone?: AuthoredDetailActionTone
  disabled?: boolean
  loading?: boolean
  onClick: () => void
}

export interface AuthoredDetailPendingOperation {
  title: string
  body: string
}

export interface AuthoredDetailFact {
  label: string
  value: ReactNode
}

export interface AuthoredDetailNotice {
  tone: AuthoredDetailNoticeTone
  title: string
  body: string
  action?: AuthoredDetailAction
}

export interface AuthoredDetailSectionModel {
  id: string
  title: string
  eyebrow?: string
  content: ReactNode
}
