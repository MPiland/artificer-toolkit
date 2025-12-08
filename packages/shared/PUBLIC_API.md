# 📘 Public API Contract

### `@artificer/shared` — Artificer Toolkit Monorepo

This document defines the **official public API surface** of the `@artificer/shared` package.  
It ensures that all consumers of this package (DB, Functions, Web) interact with a **stable, predictable domain model**, and that internal implementation details remain properly encapsulated.

---

# 1. Purpose

`@artificer/shared` is the **single source of truth** for:

- Domain model types (Background, Feature, Spell, Equipment, Race, etc.)
- Shared subtypes used by the entire domain layer (DamageFields, StartingEquipment, Speeds, Prerequisites, etc.)
- Optional Zod schemas that mirror domain definitions
- Cross-cutting structural types for DB, Functions, and Web compatibility

It contains **no runtime logic**—only TypeScript types and optional validation schemas.

This package defines the **domain layer** of the Artificer Toolkit.

---

# 2. Public API Entry Point

The **only supported import path** for consumers of this package is:

```ts
import { ... } from "@artificer/shared"
```

# 3. Importing from @artificer/shared

Allowed

```ts
import type { Background, Character, Feature } from '@artificer/shared'
```

Not allowed

```ts
import type { Background } from '@artificer/shared/types'
import type { Feature } from '@artificer/shared/shared'
import type { Something } from '@artificer/shared/dist/types'
```

# 4. Internal vs Public Types

### ✔ Public Types

A type is considered public if it is exported (directly or transitively) from:

```
src/index.ts
```

```
src/index.ts
   → src/types/index.ts
        → src/types/*.ts
```
All publicly exported types must follow this pattern.

## ❌ Internal Types

Any file or type not exported through src/index.ts is considered internal.

Internal types:
 - MUST NOT be imported from other packages
 - MAY change without notice
 - SHOULD exist only as implementation details
 - Are exempt from backward compatibility guarantees

 # 5. Versioning & Stability Guarantees

`@artificer/shared` follows a **strict stability contract** within the monorepo:

### ✔ Additive changes are always safe
- Adding new types
- Adding new fields (if optional)
- Adding new Zod schemas
- Adding new submodules under `src/types/*`

### ✔ Breaking changes require coordinated updates
Any of the following are considered **breaking** and require updates across all
consumers (`db`, `functions`, `web`):

- Renaming a type
- Removing a field
- Changing the shape of a type
- Moving files without updating re-exports
- Changing public enums
- Changing discriminants of tagged unions
- Removing exports from `src/index.ts`

### ✔ The public API surface MUST remain stable
Only values exported through:
 - src/index.ts

are considered part of the official API.

Everything else is **internal** and may be refactored freely.

# 6. File Structure Rules

The internal layout of `@artificer/shared` follows a strict structure designed
to enforce clarity, maintainability, and predictable exports.

```
src/
index.ts → Public export surface
types/
index.ts → Aggregates all domain types
backgrounds.ts
characters.ts
classes.ts
equipment.ts
feats.ts
features.ts
races.ts
spells.ts
systems.ts
...
types/shared/
actions.ts
damages.ts
saveDc.ts
prerequisites.ts
ranges.ts
shapes.ts
speeds.ts
durations.ts
startingEquipment.ts
...
zod/
index.ts → Zod schemas mirroring domain types
backgrounds.schema.ts
features.schema.ts
...
```

### ✔ Rules

1. **All public types must appear in one and only one place:**
```
src/types
```

2. **Shared subtypes must live in:**
```
src/types/shared
```

3. **Zod schemas must never depend on application logic**  
They may reference domain types but not vice-versa.

4. **Every file under `src/types` must be exported from:**
```
src/types/index.ts
```

5. **Never import between siblings by relative path from outside folder context**  
Example (allowed only inside the same folder group):
```ts
import { DamageFields } from "./damages"
```
