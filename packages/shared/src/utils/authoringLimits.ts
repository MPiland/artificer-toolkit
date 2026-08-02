export const AUTHORED_LIMITS = {
  shortTextCharacters: 120,
  plainTextCharacters: 2_000,
  richTextVisibleCharacters: 20_000,
  richTextSerializedCharacters: 100_000,
  nestedCollectionItems: 100,
  referenceCollectionItems: 500,
  facetNestingDepth: 20,
  mutationPayloadBytes: 1_048_576
} as const

export type AuthoringInputConstraints = {
  maximum?: number
  maximumLength?: number
  minimum?: number
}
