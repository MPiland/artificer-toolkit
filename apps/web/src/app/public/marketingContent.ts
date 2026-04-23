export const publicNavigation = [
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Sign in', href: '/login' }
] as const

export const marketingFeatures = [
  {
    title: 'Character Builder',
    copy: 'Create and manage characters with full class, race, background, and equipment support.'
  },
  {
    title: 'Full SRD Reference',
    copy: 'Browse every spell, creature, item, and rule from the System Reference Document.'
  },
  {
    title: 'Homebrew Content',
    copy: 'Build custom classes, races, backgrounds, spells, and items. Free tier gets a head start.'
  },
  {
    title: 'Campaign Management',
    copy: 'Create campaigns, add players, and keep your world organized. Dungeon Master tier.'
  },
  {
    title: 'Encounter Builder',
    copy: 'Plan and run combat encounters with initiative tracking and creature management.'
  },
  {
    title: 'Content Sharing',
    copy: 'Share homebrew content directly with players in your campaign. DM tier feature.'
  }
] as const

export const pricingPlans = [
  {
    name: 'Free',
    price: '$0',
    cadence: 'forever',
    description: 'Everything you need to start building and playing.',
    cta: 'Get started for free',
    href: '/signup',
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
    href: '/signup',
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
    cadence: '/month',
    description: 'Campaign tools for the storyteller at the table.',
    cta: 'Choose DM',
    href: '/signup',
    featured: false,
    features: [
      'Everything in Player',
      'Unlimited campaigns',
      'Encounter builder',
      'Share content with players'
    ]
  }
] as const

export const authHeroBullets = [
  'Full SRD content library built in',
  'Custom homebrew races, classes and spells',
  'Character sheet with auto-calculated stats'
] as const
