/*
──────────────────────────────────────────────────────────────────────────────
DAMAGE export interface — UNIFIED DAMAGE CONFIGURATION
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Represents how a single portion of damage is calculated.

• When `export interface = DIE`, the field defines dice or static damage.
• When `export interface = POOL`, the field draws damage points from a finite pool.

──────────────────────────────────────────────────────────────────────────────
*/
export enum DamageFieldKind {
  DIE = 'DIE',
  POOL = 'POOL',
}

export enum DamageFieldSlot {
  PRIMARY = 'PRIMARY',
  SECONDARY = 'SECONDARY',
  BONUS = 'BONUS',
}

export interface DamageFields {
  id: string
  dieConfig: string | null // e.g., "2d8"
  attributeId: string | null
  damageTypeId: string | null
  abilityId: string | null
  setAmount: number | null //int
  multiplier: number | null //int
  minAmount: number | null //int
  maxAmount: number | null //int
  poolOptionId: string | null // FK → resource pool option
  kind: keyof typeof DamageFieldKind
  slot: keyof typeof DamageFieldSlot
}

export interface ScalePerLevel extends DamageFields {
  level: number //int
}

export interface Damage {
  id: string
  attributeIds: string[] | null
  damageSaveIds: string[] | null
  scalePerLevel: ScalePerLevel[] | null
  fields: DamageFields[]
}
