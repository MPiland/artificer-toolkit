/** The 5e proficiency bonus at a total level (a level below 1 counts as 1). */
export function proficiencyBonus(totalLevel: number): number {
  return Math.floor((Math.max(totalLevel, 1) - 1) / 4) + 2
}
