import type { ReactNode } from 'react'

export type AuthoredDetailNoticeTone = 'draft' | 'warning' | 'info'

export type AuthoredDetailActionTone = 'primary' | 'secondary' | 'quiet'

export interface AuthoredDetailAction {
  label: string
  tone?: AuthoredDetailActionTone
  disabled?: boolean
  onClick: () => void
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
