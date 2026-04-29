import { Button } from '@mantine/core'
import { sectionNav } from './runtimeStyles.css.ts'

type SectionNavigationItem = {
  id: string
  label: string
  order?: number
  nodes?: unknown
}

export function SectionNavigator({
  sections,
  activeSectionId,
  onSectionChange
}: {
  sections: SectionNavigationItem[]
  activeSectionId: string
  onSectionChange: (sectionId: string) => void
}) {
  return (
    <nav className={sectionNav} aria-label='Form sections'>
      {sections.map((section) => (
        <Button
          key={section.id}
          variant={section.id === activeSectionId ? 'filled' : 'subtle'}
          onClick={() => onSectionChange(section.id)}
        >
          {section.label}
        </Button>
      ))}
    </nav>
  )
}
