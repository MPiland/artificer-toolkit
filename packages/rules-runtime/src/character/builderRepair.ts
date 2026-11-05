/**
 * The stored Character is not Builder-ready over its current sources: a reconciled source loss, or a
 * replaced publication that adds a required choice the owner has not made yet. The Sheet blocks until
 * the Builder repairs it. Kept free of imports so read-only Sheet paths can throw it without loading
 * the Builder.
 */
export class CharacterRequiresBuilderRepairError extends Error {
  constructor() {
    super('Character requires Builder repair before the Sheet can be read.')
    this.name = 'CharacterRequiresBuilderRepairError'
  }
}
