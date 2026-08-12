export const marketingPricingEnabled = false

const pricingNavigation = marketingPricingEnabled
  ? ([{ label: 'Pricing', href: '#pricing' }] as const)
  : []

export const marketingNavigation = [
  { label: 'Features', href: '#features' },
  ...pricingNavigation,
  { label: 'Sign in', href: '/sign-in' }
] as const

export function getMarketingNavigation(publicSignUpEnabled: boolean) {
  return publicSignUpEnabled
    ? marketingNavigation
    : marketingNavigation.filter((item) => item.href !== '#pricing')
}

export type MarketingSectionHash = '#features' | '#pricing'

export function isMarketingSectionEnabled(hash: MarketingSectionHash) {
  return marketingNavigation.some((item) => item.href === hash)
}

export const marketingHeroHighlights = [
  {
    label: 'Homebrew',
    copy: 'Create spells, classes, equipment, creatures, and more one section at a time'
  },
  {
    label: 'Characters',
    copy: 'Use SRD content and your homebrew in Character Builder'
  },
  {
    label: 'At the table',
    copy: 'Keep actions, spells, resources, and inventory ready during a session'
  }
] as const

export const marketingFeatures = [
  {
    audience: 'For players',
    title: 'Build a character, then play from the sheet',
    copy: 'Use guided steps to build your character, then open actions, spells, resources, and inventory on the Character Sheet.',
    bullets: [
      'Review your choices before finishing the build',
      'Track the character during a session'
    ],
    icon: 'character'
  },
  {
    audience: 'For homebrewers',
    title: 'Author homebrew one section at a time',
    copy: 'Create spells, equipment, races, classes, creatures, and vehicles without digging through one long form.',
    bullets: ['Save your work as a draft', 'Review each section before activation'],
    icon: 'scroll'
  },
  {
    audience: 'For reference',
    title: 'Keep SRD rules and your work in one Library',
    copy: 'Browse SRD content for reference, or copy a read-only entry when you want your own editable version.',
    bullets: [
      'Find spells, creatures, equipment, and rules',
      'Keep SRD content separate from your own version'
    ],
    icon: 'book'
  },
  {
    audience: 'For creators',
    title: 'Edit drafts without changing active content',
    copy: 'Save and review changes as a draft, then activate the content when it is ready for play.',
    bullets: [
      'Keep the current version available while you edit',
      'Choose when the draft replaces it'
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
