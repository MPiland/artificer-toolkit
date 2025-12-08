/*
──────────────────────────────────────────────────────────────────────────────
ACTION PROPERTY — HOW AN ENTITY USES AN ACTION
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Describes *how* a feature, item, or other entity uses an action from the
system's action registry and, if relevant, how many uses that costs.

Structure:
----------
• `actionId` — References a `SystemAction` recposition
  (e.g. Action, Bonus Action, Reaction, Minute, Hour, Special)
• `amount` — Optional count of actions or attacks consumed

Examples:
---------
• A fighter's Extra Attack: { actionId: "Action", amount: 2 }
• A rogue's Cunning Action: { actionId: "Bonus Action" }
• The Shield spell: { actionId: "Reaction" }
• A ritual spell: { actionId: "Minute", amount: 10 }

──────────────────────────────────────────────────────────────────────────────
*/
export interface ActionProperty {
  id: string
  actionId: string // References SystemAction
  amount: number | null // int
}

/*
──────────────────────────────────────────────────────────────────────────────
ACTION GROUP — MULTI-ACTION CAPABILITIES
──────────────────────────────────────────────────────────────────────────────

Purpose:
--------
Groups multiple action slots together for a single feature or item. This
structure is primarily used by Features, Equipment, and Feats that can
consume or grant more than one kind of action export interface in a turn.

Structure:
----------
• `primary`   — The main action slot (e.g., Action or Reaction)
• `secondary` — Optional secondary trigger (e.g., multiattack, alt mode)
• `bonus`     — Bonus Action usage (e.g., Two-Weapon Fighting)

Usage:
------
• Spells generally use a *single* `CastingTime` instead of ActionGroup.
• Features and equipment use this full structure to define turn usage.

──────────────────────────────────────────────────────────────────────────────
*/
export interface Actions {
  id: string
  casting: ActionProperty | null
  primary: ActionProperty | null
  secondary: ActionProperty | null
  bonus: ActionProperty | null
}
