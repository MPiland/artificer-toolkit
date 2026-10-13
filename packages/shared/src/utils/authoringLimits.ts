export const AUTHORED_LIMITS = {
  shortTextCharacters: 120,
  plainTextCharacters: 2_000,
  richTextVisibleCharacters: 20_000,
  richTextSerializedCharacters: 100_000,
  nestedCollectionItems: 100,
  referenceCollectionItems: 500,
  facetNestingDepth: 20,
  jsonNestingDepth: 25,
  mutationPayloadBytes: 1_048_576
} as const

/** Largest authored length amount; every length unit converts it to a finite number of feet. */
export const AUTHORED_LENGTH_AMOUNT_MAX = 1_000_000

export type AuthoringInputConstraints = {
  maximum?: number
  maximumLength?: number
  minimum?: number
}
