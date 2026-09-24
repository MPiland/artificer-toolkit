export type ReferenceOption = {
  value: string
  label: string
}

export type AuthoredContentReferenceData = {
  systemId: string
  challengeRatings: ReferenceOption[]
  conditionTypes: ReferenceOption[]
  creatureTypes: ReferenceOption[]
  currencies: ReferenceOption[]
  damageTypes: ReferenceOption[]
  heritages: ReferenceOption[]
  languages: ReferenceOption[]
  magicSchools: ReferenceOption[]
  rarities: ReferenceOption[]
  skills: ReferenceOption[]
  speeds: ReferenceOption[]
  classes: ReferenceOption[]
  creatures: ReferenceOption[]
  equipment: ReferenceOption[]
  races: ReferenceOption[]
}
