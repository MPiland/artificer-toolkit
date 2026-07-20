import type { Meta, StoryObj } from '@storybook/tanstack-react'
import {
  MarketingFeatureSection,
  MarketingFooter,
  MarketingHeader,
  MarketingHero,
  MarketingPricingSection
} from '../components'
import { MarketingPage } from '../pages'

const meta = {
  title: 'Guest/Marketing',
  parameters: {
    layout: 'fullscreen'
  }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const Page: Story = {
  render: () => <MarketingPage publicSignUpEnabled />
}

export const Header: Story = {
  render: () => <MarketingHeader publicSignUpEnabled />
}

export const Hero: Story = {
  render: () => <MarketingHero publicSignUpEnabled />
}

export const Features: Story = {
  render: () => <MarketingFeatureSection />
}

export const Pricing: Story = {
  render: () => <MarketingPricingSection publicSignUpEnabled />
}

export const Footer: Story = {
  render: () => <MarketingFooter />
}
