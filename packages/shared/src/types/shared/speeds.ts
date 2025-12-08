/*
──────────────────────────────────────────────────────────────────────────────
SPEED — MULTIPLE MOVEMENT TYPES
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Defines one or more movement modes for a race.

Structure:
----------
• `speedId` — FK to System Option (Walking, Flying, Swimming, etc.).
• `amount` — The base movement value.
• `unitId` — FK to System Option for unit of measurement (feet, meters, etc.).
*/
export interface Speed {
  id: string
  amount: number // int
  unitId: string
}
