# @artificer-toolkit/emails

Branded React Email templates for Artificer Toolkit authentication messages.

`yarn workspace @artificer-toolkit/emails dev` starts the local React Email preview. The workspace also owns the signed Supabase Auth hook behavior used by the root Netlify Function; clients never import this package.

Templates deliberately use only portable design-system primitives, inline email-safe styles, text-first branding, and plain-text fallbacks. Do not add web CSS, Mantine components, private assets, or user-controlled content.
