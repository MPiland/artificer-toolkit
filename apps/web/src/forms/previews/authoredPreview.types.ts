import type { ReactNode } from 'react'
import type { AuthoredFormPreviewContext } from '../factories/authoredFormFactories.types'

export type AuthoredPreviewFactory = (context: AuthoredFormPreviewContext) => ReactNode | undefined

export type PreviewFact = {
  label: string
  value: ReactNode
}

export type PreviewListItem = {
  description?: string | null
  id: string
  meta?: string
  title: string
}

export type DamagePreviewItem = {
  amount: string
  label: string
  tone: DamagePreviewTone
}

export type DamagePreviewTone =
  | 'acid'
  | 'bludgeoning'
  | 'cold'
  | 'fire'
  | 'force'
  | 'lightning'
  | 'necrotic'
  | 'neutral'
  | 'piercing'
  | 'poison'
  | 'psychic'
  | 'radiant'
  | 'slashing'
  | 'thunder'

export type PreviewSection =
  | {
      facts: PreviewFact[]
      id: string
      title: string
      type: 'facts'
    }
  | {
      fallback?: string
      html?: string | null
      id: string
      quote?: string | null
      title: string
      type: 'prose'
    }
  | {
      empty: string
      id: string
      items: PreviewListItem[]
      title: string
      type: 'list'
    }
  | {
      id: string
      items: string[]
      title: string
      type: 'chips'
    }
  | {
      id: string
      items: DamagePreviewItem[]
      title: string
      type: 'damage'
    }

export type AuthoredPreviewModel = {
  sections: PreviewSection[]
}
