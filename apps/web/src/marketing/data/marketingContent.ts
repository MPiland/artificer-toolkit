export const marketingPricingEnabled = false

const pricingNavigation = marketingPricingEnabled
  ? ([{ label: 'Pricing', href: '#pricing' }] as const)
  : []

export const marketingNavigation = [
  { label: 'Features', href: '#features' },
  ...pricingNavigation,
  { label: 'Sign in', href: '/sign-in' }
] as const

export type MarketingSectionHash = '#features' | '#pricing'

export function isMarketingSectionEnabled(hash: MarketingSectionHash) {
  return marketingNavigation.some((item) => item.href === hash)
}

export const marketingHeroHighlights = [
  {
    label: 'Create',
    copy: 'Build homebrew that follows real game structure without fighting the form'
  },
  {
    label: 'Connect',
    copy: 'Move from builder to sheet without losing the content you just authored'
  },
  {
    label: 'Play',
    copy: 'Keep rules, characters, and in-session actions ready when play starts'
  }
] as const

export const marketingFeatures = [
  {
    audience: 'For players',
    title: 'Characters stay playable, not just editable',
    copy: 'Build characters with guided structure, then switch to a dedicated sheet built for actions, spells, resources, and inventory at the table.',
    bullets: [
      'Structural builder flow with review steps',
      'Separate play-state sheet for real session use'
    ],
    icon: 'character'
  },
  {
    audience: 'For homebrewers',
    title: 'Homebrew creation keeps complex rules readable',
    copy: 'Author spells, equipment, races, classes, creatures, and vehicles in organized flows that surface the right structure at the right time.',
    bullets: [
      'Sectioned authoring instead of endless forms',
      'Shared patterns across every major content domain'
    ],
    icon: 'scroll'
  },
  {
    audience: 'For reference',
    title: 'Rules and content stay close to the work',
    copy: 'Keep SRD material, owned drafts, and copied master data in one place so creators and players can move without losing context.',
    bullets: [
      'Fast reference for spells, creatures, items, and rules',
      'Master content can be copied into owned drafts safely'
    ],
    icon: 'book'
  },
  {
    audience: 'For creators',
    title: 'Drafts stay separate from playable content',
    copy: 'Save work in progress, review it in context, and activate it when it is ready without directly editing locked master records.',
    bullets: [
      'Clear draft and active states',
      'Copy master content into an owned draft before editing'
    ],
    icon: 'status'
  }
] as const

export const pricingPlans = [
  {
    name: 'Free',
    price: '$0',
    cadence: 'forever',
    description: 'Everything you need to start building and playing.',
    cta: 'Get started for free',
    href: '/sign-up',
    featured: false,
    features: [
      'Full SRD reference',
      'Up to 2 characters',
      'Up to 2 homebrew classes',
      'Up to 2 races and backgrounds'
    ]
  },
  {
    name: 'Player',
    price: '$3.99',
    cadence: '/month',
    description: 'Unlimited creations for dedicated adventurers.',
    cta: 'Choose Player',
    href: '/sign-up',
    featured: true,
    features: [
      'Everything in Free',
      'Unlimited characters',
      'Unlimited homebrew content',
      'Priority support'
    ]
  },
  {
    name: 'Dungeon Master',
    price: '$7.99',
    cadence: '/month when available',
    description: 'Planned campaign tools for the storyteller at the table.',
    cta: 'Start free for now',
    href: '/sign-up',
    featured: false,
    features: [
      'Everything in Player',
      'Campaign workspace - planned',
      'Encounter builder - planned',
      'Player sharing - planned'
    ]
  }
] as const
