import type { Vocabulary } from './vocabulary.js'

export type SystemAuthored = {
  id: string
  label: string
  description?: string | null
  alignments: Vocabulary[]
  conditionTypes: Vocabulary[]
  currencies: Vocabulary[]
  damageTypes: Vocabulary[]
  heritages: Vocabulary[]
  languages: Vocabulary[]
  lifestyles: Vocabulary[]
  magicSchools: Vocabulary[]
  passives: Vocabulary[]
  rarities: Vocabulary[]
  senses: Vocabulary[]
  skills: Vocabulary[]
  speeds: Vocabulary[]
  terrains: Vocabulary[]
  userId: string
}

export type SystemVocabularyKey = {
  [K in keyof SystemAuthored]-?:
  SystemAuthored[K] extends readonly Vocabulary[] ? K : never
}[keyof SystemAuthored]
