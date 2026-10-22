type AuthoredDeleteKind = 'active' | 'draft'

export interface AuthoredDeleteTarget {
  id: string
  kind: AuthoredDeleteKind
  label: string
}
