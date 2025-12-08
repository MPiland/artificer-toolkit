/*
──────────────────────────────────────────────────────────────────────────────
SAVE DC export interface — CONFIGURABLE SAVE DIFFICULTY FORMULA
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Defines how a saving throw Difficulty Class (DC) is calculated for a spell,
feature, or other effect that forces a target to make an ability saving throw.

Distinction:
------------
• This export interface does **not** represent a character's saving throw bonus or roll.
  It represents the **formula** used to compute the DC that the target must beat.

Structure:
----------
• `saveAbilityId` — The defending ability the target rolls (e.g. DEX for Fireball)
• `baseValue` — The static base DC (usually 8 or 10)
• `scalingAttributes` — Additional additive bonuses such as proficiency or
  custom scaling factors.
• `scalingAbilityId` — The caster's or attacker's ability whose modifier
  contributes to the DC (e.g. CHA for Sorcerer, WIS for Cleric).

Example (D&D 5e):
-----------------
Spell Save DC = 8 + proficiency bonus + spellcasting ability modifier

Would be stored as:
{
  saveAbilityId: "DEX",
  baseValue: 8,
  scalingAttributeIds: ["PROFICIENCY"], <-- this would be replaced with uuid of actual attribute
  scalingAbilityId: "CHA"
}

──────────────────────────────────────────────────────────────────────────────
*/
export interface SaveDc {
  id: string
  saveAbilityId: string
  baseValue: number // int
  scalingAttributeIds: string[] | null
  scalingAbilityId: string | null
}
