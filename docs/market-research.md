# Market research

> **Status:** Transitional research notes
> **Scope:** Products and capabilities worth evaluating as Artificer Toolkit evolves
> **Update when:** A product is reviewed, a useful capability is identified, or research changes roadmap priorities

These products are references for capability research, not visual authorities or commitments to copy particular features. Any idea adopted by Artificer Toolkit must still fit its connected authoring, Campaign, rules, play, and VTT model.

## Products to research

### Alkemion Studio

*Checked 2026-09-27 via [alkemion.com](https://alkemion.com/), [alkemion.com/faq](https://alkemion.com/faq), and the [Kickstarter page](https://www.kickstarter.com/projects/alkemion/alkemion-studio).*

- Primary research area: Campaign preparation.
- Review its visual planning board and the way places, NPCs, clues, scenes, and notes connect.
- Treat a board as an optional view over Campaign-owned records, not a second Campaign data model.
- Capture promising ideas as specific user problems and outcomes before considering roadmap work.

**Campaign status (Kickstarter, checked 2026-09-27).** The desktop-version campaign is all-or-nothing with a goal of €10,593 (Kickstarter shows this converted as "$10,593"); it had **$76,211 pledged, 653 backers, and 3 days to go**, deadline Thu Oct 1 2026 9:00 AM CDT — already well over 7x funded. Reward tiers are one-time purchases (no subscription) for a perpetual desktop license: Scout €40, Explorer €60, Cartographer €90 (creator-recommended), Chronicler €150, Archivist €250, Loremaster €450; higher tiers add extra licenses, Creative Starter Kits, cosmetic Themes, early/beta access, and lifetime cloud sync. **Unverified:** the page did not state a numeric delivery estimate in the visible copy; only "early delivery wave," "beta branch," and general roadmap language were shown.

**Visual planning board.** Node types are freeform: locations, NPCs, clues, events, plot points, and factions, all placed on one board with no required layout. Selecting a node opens a full rich-text Editor (headings, images, lists, cross-links), either full-screen or as a resizable floating window kept over the board. Edges ("connections") carry their own descriptive text, directional arrows, and visual style, and the same two nodes can hold multiple distinct connections, each with its own meaning — this typed, multi-edge relationship model is the product's stated differentiator versus plain wiki-style tools. Search/organization is via color-coded, reusable tag sets, named "Anchors" (saved shortcuts to board regions), a default opening view, and a table view that lists all module content for sorting/filtering as an alternative to the visual canvas. During play, the GM's main aids are the floating Editor and a per-module scratch space for improvised notes; there is no other in-session tooling. Maps (image-based, with points of interest linked to board content) and Timelines are the first two "interactive tools," with clocks and decision trees planned.

**VTT / live play / rules automation.** None. Alkemion is exclusively a prep and writing tool; the FAQ and site do not mention rules, dice, or a play surface at all.

**Platforms, offline, collaboration, import/export.** The web app is free forever and responsive across desktop/tablet/phone, but requires an internet connection today. The Kickstarter-funded desktop app (Windows/Mac/Linux) adds full offline capability with local-first storage, multiple boards per module, cross-module sync of recurring elements, version history/snapshots, and optional two-way Obsidian vault sync; cloud sync ("Online Synchronization") is optional and never required. Projects are private by default; sharing is via private links to players or a co-GM, who can also clone the shared content into their own copy. Export targets are PDF, Markdown (Obsidian-compatible), HTML, and plain text.

**Specific user problems it solves well.** Several public testimonials single out the same gap: existing journaling/wiki tools (implicitly World Anvil/LegendKeeper-style) handle linked pages well but treat mind-mapping as an afterthought, while Alkemion makes the visual web of connections the primary interface and still allows full prose per node. The floating-editor-over-board pattern directly answers "I want to write and see the map at the same time" without a mode switch.

**Weaknesses.** No live play, VTT, or rules automation of any kind — it never leaves the "prep" stage of a campaign's lifecycle. The web tier gates image uploads and interactive map creation behind Patreon. It is a two-person, part-time team, which is a real continuity/velocity risk against a competitor's roadmap. No self-hosting or open-source option, so a studio shutdown means losing the tool (export mitigates this for content, not for the board experience itself).

**What Artificer Toolkit can do better.** Alkemion's board is disconnected from actual play by design — a location or NPC node can only open a text page, never a live Scene or stat block. Artificer's Campaign node map can make the same kinds of nodes (Location, NPC, Faction, Clue) open the real object: a Location node opens its Scene (map, fog, tokens already loaded), an NPC/Encounter node starts the real rules-driven Encounter instead of static prose, and a Clue node reveals the actual handout object to players in real time. Because Artificer already owns rules and characters in one product-data boundary (`apps/apis`), the node map does not need Alkemion's separate "write it all out by hand" model — it is a graph of references over data that already exists.

### Inkarnate

- Primary research areas: map creation and VTT-related capabilities.
- Review how maps are created, organized, exported, and used during play.
- Separate useful workflow ideas from features that would duplicate the planned Artificer Toolkit VTT without strengthening the connected product lifecycle.

### Myth Meister

*Checked 2026-09-27 via [mythmeister.com](https://www.mythmeister.com/) and its feature/pricing pages ([campaign manager](https://www.mythmeister.com/dnd-campaign-manager), [homebrew manager](https://www.mythmeister.com/dnd-homebrew-manager)).*

- Primary research area: Campaign management.
- Review its structured management of NPCs, cities and other locations, factions, relationships, and notes.
- Look for ways those records can connect directly to sessions, encounters, references, and later map pins.
- Compare promising ideas with the existing Campaign and live-play roadmap before proposing additions.

**Structure of NPCs, cities/locations, factions and relationships.** Marketing copy consistently lists NPCs, factions, places (with nested/layered location maps: world map → city map → building/dungeon map), shops, party sheets, encounters, and handouts as the core record types, and says lore is "searchable and connected" to sessions, maps, NPCs, places, and handouts. **Unverified:** the public pages never show an explicit graph or edge model comparable to Alkemion's typed, multi-labeled connections — the language reads more like categorized records with cross-references than a visual node board. The live demo requires accepting cookies and loading an authenticated-feeling SPA that this pass did not get past; a real relationship model (or lack of one) should be confirmed inside the app before drawing conclusions.

**How players see things.** Every player gets a personal dashboard with their character sheet, notes, inventory, and chat, plus (on Pro AI or higher) the "Barty" AI assistant. Players see only what the DM reveals: player-safe map views, discovered NPCs/places, and approved handouts; DM notes and secrets stay private. Player access is inherited from whichever DM's campaign they're in — players never hold their own subscription, and access follows each campaign's DM independently if a player is in multiple campaigns.

**Pricing (from the site's pricing panel, checked 2026-09-27).** Free forever: 1 DM campaign, 500 MB storage, player invites, maps/notes/encounters/handouts, AI-assisted character/NPC PDF import only. Plus, $7.99/mo or $79/yr: unlimited campaigns, 25 GB storage, all non-AI tools, no other AI or video. Pro AI, $12.99/mo or $129/yr: unlimited campaigns, unlimited text AI generation and AI images/maps/tokens ("reasonable anti-abuse" fair-use limits apply), AI Smart Handouts, the Barty player assistant, no video. Table (Video), $29.99/mo or $299/yr: everything in Pro AI plus 250 video participant-hours/month.

**Specific user problems it solves well.** It targets "too many tabs": prep, maps, encounters, player portal, handouts, session logging, and video in one workspace. Its encounter tooling (grid, token snapping, HP/turn tracking, player-facing combat view) is closer to a lightweight VTT than Alkemion offers, so it already spans from prep into limited live play. The free tier is a genuine on-ramp (a full campaign, not a crippled trial).

**Weaknesses.** No visible node/graph relationship browsing in the public marketing — if relationships are just tags and cross-references rather than a visual web, that is a materially weaker prep experience than Alkemion's board for GMs who think in networks of NPCs/factions. AI generation is pushed as the headline differentiator on every paid tier, which may read as a crutch rather than structured authoring. The top "Table" tier bundles video conferencing at a price premium over dedicated tools GMs likely already use. The marketing site itself is built from many near-duplicate, programmatically-generated landing pages (campaign manager / homebrew manager / session planner / quest generator, etc., all with identical body copy), which is a mild signal of thin per-page differentiation and made deeper feature verification harder from outside the app.

**What Artificer Toolkit can do better.** Myth Meister's encounter tools are manual grid/token/HP bookkeeping, not a rules engine; an Encounter node in Artificer's Campaign map can start the actual rules-driven Encounter (conditions, resources, automated resolution) instead. A Location node can open the real Scene already backed by `apps/apis` (map, fog, tokens) instead of Myth Meister's separately maintained "campaign maps" and "battle maps" that a GM must keep in sync by hand. A handout node can reveal the same handout object used elsewhere in the product, instead of a parallel "handouts" record with its own reveal rules.

## Implications for the Campaign node map

*Research notes for the Q18-adjacent design work referenced in [future-enhancements.md](roadmap/future-enhancements.md#node-based-campaign-management-and-authoring-user-requested-2026-09-27); nothing here is a commitment.*

**Minimum entry kinds and relationship model to design before launch:**

- Both competitors converge on the same core kinds: **Location, NPC, Faction**, plus supporting **Clue/Handout** and **Note** entries. Scene and Encounter should be first-class node kinds too, since they are what makes the board a differentiator rather than a copy of either competitor's prep-only board.
- Favor Alkemion's **typed, directional, multiply-labeled edge model** ("connections that tell stories," several distinct relationships between the same two nodes) over what Myth Meister appears to offer (flat cross-references). A plain wiki-link graph is not enough of a differentiator on its own.
- Each node (Location, NPC, Faction, Clue, Note) should count as one entry against the Q18 **150-entries-per-Campaign** limit on Free/Player (unlimited with a hidden safety cap on GM/Pro GM). Whether an edge/relationship counts as its own entry needs an explicit ruling before implementation — neither competitor charges per relationship, and edges are cheap metadata, so the likely answer is that edges do not count, but this should not be assumed silently.
- A node should hold an **optional reference** to the live-play object it opens (Scene id, Encounter id/blueprint id, handout id) rather than embedding play content itself, keeping `apps/apis` as the only product-data boundary and the node map a graph of references, not a second Campaign data model.

**Features to hold back for later:**

- **Interactive map-pin layer** (both competitors' points-of-interest-on-an-image pattern) overlaps with the planned VTT Scene map; sequence it after the base node map and its Scene linkage, not alongside it.
- **Timelines, clocks, and decision trees** (Alkemion) are useful prep aids but not required for the "node opens Scene/Encounter/handout" differentiator; candidate for the Post-launch backlog.
- **AI-assisted generation** (Myth Meister's NPC/encounter/map/recap generation) is a large new capability and cost surface, unrelated to the connected-board differentiator; keep it out of the pre-launch node map slice.
- **Player-facing node/board view** (a read-only, reveal-gated board for players, as both competitors offer in some form) should follow the GM-side board and its live-play links, since it is additive UI over the same data model rather than a prerequisite.
- **Multi-board/module structure per Campaign** (Alkemion's "multiple boards per module," cross-module sync) adds real complexity; the Q18 150-entry cap on Free/Player makes a single board sufficient at launch.

### How Alkemion built its following (researched 2026-09-28)

- **Timeline:** a free web beta since July 2024. It had "a few hundred users" at first, about 5,000 by May 2026, and 14,000+ by the Kickstarter pre-launch page. Most of that growth came in the roughly 4 months before the campaign (Sept 1 – Oct 1, 2026: €67,435, 725% of goal, 658 backers).
- **Channels found:**
  - the founders' own posts on RPGGeek and therpgsite.com ("my son and I built a free TTRPG app");
  - an email newsletter (Buttondown);
  - a small Patreon;
  - a small Discord (about 500 members), used for support rather than discovery;
  - Bluesky and a small YouTube channel;
  - at least one independent YouTube review.
- **Not found:** paid ads beyond the one the user saw, and no Reddit presence in the major subreddits.
- **Framing:** a free "passion project" by a father and son, told in warm, low-hype language. The pre-launch push was about the first 48 hours.
- **Sources:** alkemion.com (/about, /desktop-crowdfunding); the Buttondown archive; the therpgsite.com and RPGGeek threads. The Kickstarter page itself returned 403, so its figures come from search snippets.

## Research rule

Interesting competitor features belong here until they are understood. Moving an idea into the roadmap requires a concrete user need, its place in the Artificer Toolkit lifecycle, and a deliberately scoped implementation—not feature parity for its own sake.
