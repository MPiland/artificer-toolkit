/**
 * A Campaign Character assignment and the members the GM granted control of that Character (SCENE-5,
 * D162). The grant lives only here; Encounter Runs keep their own per-Run controllers (ADR 0034).
 */
export interface CharacterControlAssignment {
  characterId: string
  /** The assigned player, who always keeps control. */
  userId: string
  /** Absent means the GM granted none. */
  controllerUserIds?: readonly string[] | undefined
}

/** Whether `userId` is the Character's assigned player or a member the GM granted control to. */
export function controlsAssignedCharacter(
  assignment: Pick<CharacterControlAssignment, 'userId' | 'controllerUserIds'> | null | undefined,
  userId: string
): boolean {
  return (
    !!assignment &&
    (assignment.userId === userId || (assignment.controllerUserIds?.includes(userId) ?? false))
  )
}

/**
 * The Scene as vision and fog see it: each token linked to an assigned Character also lists that
 * Character's player and grantees as controllers. Derived for projection and exploration planning
 * only; the stored Scene keeps the GM's own list (D162).
 */
export function withCharacterControllers<
  Token extends { characterId?: string | undefined; controlledByUserIds: string[] },
  Scene extends { tokens: Token[] }
>(scene: Scene, assignments: readonly CharacterControlAssignment[]): Scene {
  if (!scene.tokens.some((token) => token.characterId !== undefined)) return scene
  return {
    ...scene,
    tokens: scene.tokens.map((token) => {
      const assignment = assignments.find(({ characterId }) => characterId === token.characterId)
      if (!assignment) return token
      const controllers = new Set([
        ...token.controlledByUserIds,
        assignment.userId,
        ...(assignment.controllerUserIds ?? [])
      ])
      return { ...token, controlledByUserIds: [...controllers] }
    })
  }
}

/**
 * Whether a player moves an unbound Scene token: the GM lists them on the token, or the token
 * represents a Character they control. The GM always can.
 */
export function controlsUnboundSceneToken(
  token: { characterId?: string | undefined; controlledByUserIds: readonly string[] },
  userId: string,
  assignments: readonly CharacterControlAssignment[]
): boolean {
  return (
    token.controlledByUserIds.includes(userId) ||
    (token.characterId !== undefined &&
      controlsAssignedCharacter(
        assignments.find((assignment) => assignment.characterId === token.characterId),
        userId
      ))
  )
}
