# Authoring Schemas and the authoring runtime

> Status: canonical (current working-tree baseline)
>
> Scope: Authoring Schema contract, node-map DSL, registry, relationship execution, backend resolution, normalization, and presentation adapters
>
> Update when: node kinds, map IDs, condition/path semantics, runtime DTOs, or renderer behavior changes
>
> Verification: `packages/shared/src/utils/nodeDefinition.ts`, `packages/shared/src/domains/**/maps`, `packages/functions/src/services/nodeRuntime`, `apps/apis/src/trpc/router.ts` (`nodeRuntime`), and `apps/web/src/forms`

An **Authoring Schema** describes the structure of authored content: which fields exist, their paths, labels, sections/steps, visibility/required rules, option sources, nested object/array groups, and narrow author-facing presentation intent. `NodeMap` is the current typed DSL and registry implementation of that contract. Product, API, and frontend architecture should use _Authoring Schema_ for the interface and reserve _node map_ for the low-level shared implementation.

Authoring Schemas are not a general character-rules language and do not contain React components, CSS classes, design tokens, or platform-specific geometry.

An authored mechanic is complete only when the same typed field is covered by the shared authored type and schema, its Authoring Schema node map, persistence/hydration, owned-ID replacement during copying, and compilation. Adding a value to the existing closed `CLOSED_RULE` discriminant does not create a new payload shape: the existing select node, schema enum, generic-outcome persistence, recursive exact-ID replacement, and compiler pass-through already cover it. A new field or outcome shape must update every boundary explicitly.

Line shapes author both length and width. Spell grants may author a casting ability independently from their source class so racial and other source-bound spells retain their SRD ability through compilation and character-level resolution.

Creature Spellcasting and Innate Spellcasting features reuse feature-owned spell grants for exact spell references, cast level, casting ability, at-will use, and limited-use charges. Creature-specific slot schedules and casting lifecycle remain closed rule descriptors until an encounter resolver consumes them; they do not justify a parallel creature-only spell model.

## DSL and registry

`buildNodeMap()` provides typed builders for strict `INPUT` and `GROUP` variants. Scalar inputs are `TEXT`, `NUMBER`, `RICH_TEXT`, or `TOGGLE`; select inputs are `SELECT_SINGLE`, `SELECT_NUMBER`, or `SELECT_MULTI` and require exactly one source. `SELECT_NUMBER` keeps numeric domain values while option codes remain serialized strings. Sources are explicitly discriminated as `INLINE_OPTIONS`, `INLINE_GROUPS`, or `DATA`. Non-select inputs cannot declare a source. Object and array groups require a child map and accept only their own metadata.

The schema package exports the canonical authored limits used by all eight root contracts and their nested authored graphs. Node-runtime inputs carry only the corresponding text-length and numeric-bound metadata so web controls can mirror server validation with native bounds and the shared rich-text character counter. The server contracts remain authoritative for direct API clients.

Conditions are closed serializable trees: `PREDICATE`, `AND`, `OR`, and `NOT`. Database query evaluation additionally owns the internal `CONSTANT` result. IDs and paths are explicit so nested groups can refer to local, parent, or ancestor values. Hidden nodes declare `KEEP` or `CLEAR`; system-owned fields use explicit `authoring.exposure: 'system'` instead of path-name inference.

Every group declares structural presentation explicitly. Object groups support `inline` or `branch`. Array groups support `inline`, `table`, `summary`, `branch`, or `focused`:

- `inline` keeps a simple object or short repeatable value in the owning step.
- `table` presents homogeneous rows compactly for comparison.
- `summary` keeps a terminal collection scan-first and stages row add/edit in an overlay drawer.
- `branch` creates structure-rail hierarchy with independently navigable descendants.
- `focused` exposes a terminal collection through navigation while editing one selected row in the shared overlay.

A focused leaf renders its descendants inside the same editor; drawers never stack. The renderer does not infer these modes from map IDs, paths, or child shape.

### Authoring semantics

Authoring metadata carries product intent, never platform implementation:

- `actions` is an ordered list of closed `collection.add`, `collection.edit`, `collection.duplicate`, and `collection.remove` commands. Object groups accept only add/remove. Duplicate command types in one scope are invalid.
- Every action has a label and complete `default` appearance, with optional complete `compact` and `wide` overrides. Appearance uses typed display, emphasis, density, and width semantics; clients map them to controls.
- `ordering.mode: 'derived'` keeps resolver order and exposes no reorder control. `manual` requires a stable one-segment `identityPath`, optionally renumbers `orderPath`, and enables accessible drag/keyboard ordering.
- Collection semantics own item/empty labels, AND/OR joins, heading visibility, row layout/expansion, and a closed row-summary vocabulary.
- Group `appearance` may select responsive heading typography/tone and container surface recipes. It cannot contain CSS values, classes, Mantine props, raw font weights, colors, breakpoints, or native component names.

`compact`, `regular`, and `wide` describe available layout space, not device brands. Web derives them from the 760/900/992 contract; a future native adapter may derive them differently. Omitting an override always falls back to `default`.

```ts
authoring: {
  actions: [{
    type: 'collection.add',
    label: 'Add condition',
    presentation: {
      default: { display: 'text', emphasis: 'quiet', density: 'compact', width: 'content' },
      compact: { display: 'button', emphasis: 'primary', density: 'comfortable', width: 'full' }
    }
  }],
  appearance: {
    heading: { default: { style: 'heading', tone: 'primary' } },
    surface: { default: { role: 'panel' }, wide: { role: 'raised' } }
  }
}
```

Invalid examples include `presentation: 'focused-drawer'`, manual ordering without `identityPath`, a scalar input with options, a select input without a source, duplicate action types, `tone: '#ff9900'`, and any platform class or token path.

Maps live in `packages/shared/src/domains/{subjects,features,grants,effects,shared}/maps`. The functions `mapRegistry` registers roots and recursively registers child maps by `mapId`. Duplicate IDs with conflicting signatures fail inventory validation; unknown IDs are `NodeRuntimeInputError`. Add-enabled child maps must have an exact web default factory—there is no generic `{ id, order }` fallback.

## Backend resolution

`resolveNodeRuntime(db, request)`:

- loads the map by ID;
- turns map nodes into ordered steps and sections (with a default section when none is declared);
- evaluates visibility and required state against `values`, `parentValues`, and `ancestors`;
- executes relationship plans for data-backed options and inline filters;
- returns the root runtime DTO plus paths that should be cleared when hidden;
- recursively emits flat resolved scopes for every visible, populated nested object or array row, keyed by absolute path.

The root and nested scopes are one authoritative resolution result. Rendering, structure-rail navigation, validation progress, and repair targeting consume those same scopes; production web code must not independently re-run the shared DSL. Step metadata may include an optional authored description, which both backend and static resolution preserve for platform-appropriate canvas guidance. This keeps parent/ancestor conditions and required state identical across every authoring surface while avoiding one request per nested branch.

`normalizeNodeRuntimeValues` resolves the same model, removes select values that are no longer visible/allowed, and clears hidden `CLEAR` paths. This keeps submitted values aligned with the resolved model before an authored save.

For interactive structural controls, the web normalizes prospective root values before committing the control change. If normalization would clear a populated path, the author must confirm the change-and-clear operation; cancellation leaves the aggregate unchanged. Empty hidden branches may be cleared without prompting. This preflight applies equally to nested and focused editors and replaces unconditional post-render clearing.

Multiple conditional controls may legitimately share an authored path when their option sources differ by branch. A hidden `CLEAR` node contributes a clear candidate only when no visible node in the resolved map owns that same path; the runtime deduplicates candidates by path before normalization. This prevents an inactive branch from erasing the active branch's value.

Relationship execution is in `relationshipExecutor.ts`; it evaluates table/column plans, local values, parent/ancestor references, filters, and stream transformations. `nodeRuntimeSourceManifest.ts` owns the exact table-to-column pairs reachable from the 11 active roots. Its parity test derives shipped `DATA` descriptors and fails if a schema adds or removes a source without updating the adapter boundary. Trust is pairwise—a column allowed for one table is not allowed for every table. Add new relationship behavior here rather than embedding ad-hoc queries in a route.

## Frontend contract

The web `useResolvedNodeModel` hook calls `nodeRuntime.resolve`. The forms platform consumes the returned root model and absolute nested scopes, maps node paths to TanStack Form field names, renders controls through real `form.AppField` instances, and keeps object/array groups connected to one TanStack form. Simple inline leaf objects may use TanStack `withFieldGroup`; complex and repeatable groups continue to use their resolved scope and the same root form.

The active step header is the canvas's single title owner. It displays the step label and its optional authored description; it never synthesizes guidance from child field labels. A same-named section or group suppresses its own heading, while genuinely distinct subsection labels remain visible beneath the step. This title-ownership rule is shared by desktop and compact authoring layouts.

Structured server-validation paths use the same navigation model. Each issue maps to the deepest target whose owned field paths contain the issue path, marks that rail target as an error, renders the message at the repairable target, and focuses that target after a failed authored mutation.

`branch` groups retain authored hierarchy in the structure rail so authors can jump directly through deep paths. A branch collection heading owns its overview target and remains a real destination when it has children; the rail does not synthesize a redundant `Overview` child. Its chevron controls expansion independently from navigation. Shared maps use semantic destinations such as Basics, Effects, Grants, and Features rather than a generic Mechanics bucket; charges and restrictions belong to the Basics step of their owning source. `summary` collections are staged terminal lists; `focused` additionally keeps the collection and row targets reachable through navigation. One selected row opens in the shared overlay editor, whose descendants remain inside that same editor rather than opening another drawer. Leaf editors overlay the workspace without resizing the canvas. Wide desktop keeps the structure and useful preview rails inline, while narrower contexts use drawers. Rail indentation is visually capped. Cancel restores the exact staged subtree and returns focus to the opener; explicit save commits it.

In an overlay structure rail, selecting a branch keeps the rail open so the author can traverse its children; selecting a leaf closes the rail and moves focus into the selected editor. When the original leaf control unmounts with the rail, cancellation restores focus to the equivalent canvas control.

Shared authoring navigation uses the inherited optional `?step=` search parameter. Rail entries and Back/Next controls are real links to the current record with only that parameter changed, so they remain navigable before hydration; hydrated navigation updates the URL without changing loader dependencies. `AuthoringFormProvider` resolves the URL against the current backend-produced navigation targets and commits the active target plus visit state together. Invalid or disappeared targets fall back to the normal target and replace the stale parameter. Authoring-step history entries carry internal router state so the root session loader does not revalidate for step-only navigation; normal route entries clear that state and retain the existing authentication refresh behavior. Because authored-domain targets do not exist until the node-runtime response is available, a direct target is retained from the URL and applied as soon as that authoritative model resolves rather than duplicating node-map logic in a route loader.

`FormRenderer.tsx` is the orchestration boundary, not the component library. It owns the active resolved scope, navigation target, validation/progress state, and shared renderer contexts. Input controls, object groups, array groups, collection overviews, leaf field groups, and the staged editor drawer live in focused renderer modules. Domain adapters provide defaults and item/object factories. They must not duplicate resolved-field wrappers, local nested forms, or local draft stores. Only top-level domain containers and isolated harnesses call `useAppForm`.

The renderer must use resolved semantics rather than child-map IDs for collection behavior, system-field visibility, labels, joins, row expansion/layout, action appearance, group typography/surfaces, or summaries. `authoringPresentationAdapter.ts` exhaustively maps portable semantics to Mantine and Vanilla Extract tokens; `collectionPresentation.ts` interprets collection content semantics; `collectionStyleMap.ts` maps row-layout intent to classes. Schemas never import those web modules. Exact domain defaults remain in `authoringNodeDefaultRegistry.ts`, separate from renderer behavior.

## Intent and boundaries

Authoring Schemas are ideal for reusable content authoring (spell details, grants, effects, starting equipment). Character Builder uses explicit domain DTOs and services because its steps are about build intent, provenance, prerequisites, reconciliation, and play-state transitions. A character may contain Authoring Schema-authored content, but the Builder itself is intentionally distinct from Authoring Schema authoring.

Starting-equipment option maps expose optional `eligibility` through the shared character-facet map. Authors can therefore express exact equipment proficiency, category-scoped equipment-property proficiency, and other supported character predicates without adding bespoke option fields. Builder evaluates the authored facet; node runtime only renders and normalizes it.

Facet condition arrays use the discriminated `facetCondition` map. `kind` selects either the property-predicate or related-subject (`EXISTS`) branch; both branches retain the authored flat payload shape, and every branch-only field uses `CLEAR` when hidden so changing the discriminant cannot retain stale payload. Generic facet contexts expose subject plus the corresponding `ALL`/`SELECTED` identity controls, while character-only facets use the narrowed character context map. Conditions inside `EXISTS.where` use the enclosing relation for the target subject and the `where` body for selected target IDs; the dedicated `facetBodyCondition` map preserves those two ancestor scopes through recursive nesting.

## Transitional notes

The web workspace contains a static resolver only for deterministic stories and tests, and it emits the same absolute nested-scope shape. Production rendering, navigation, and progress consume API-resolved Authoring Schema DTOs. Architecture tests prevent production navigation/progress from importing the static resolver. When a schema changes, update backend resolution tests and renderer tests covering visibility, option filtering, hidden clearing, presentation, and nested groups.
