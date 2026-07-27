import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

export const builderRoot = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '24px'
    }
  }
})

export const builderHeader = style({
  '@layer': {
    [app]: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: '16px',
      alignItems: 'flex-start'
    }
  }
})

export const resolverContent = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '24px'
    }
  }
})

export const stepDescription = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontSize: '1rem',
      lineHeight: 1.45,
      marginTop: '6px',
      maxWidth: '68ch'
    }
  }
})

export const title = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '2rem',
      lineHeight: 1.15,
      margin: 0
    }
  }
})

export const builderShell = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.panel,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.xl,
      boxShadow: foundationVars.shadow.card,
      display: 'grid',
      gap: '24px',
      padding: '24px'
    }
  }
})

export const section = style({
  '@layer': {
    [app]: {
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '18px',
      paddingTop: '22px'
    }
  }
})

export const sectionHeader = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px',
      justifyContent: 'space-between'
    }
  }
})

export const sectionTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1.25rem',
      fontWeight: 750,
      margin: 0
    }
  }
})

export const mutedText = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary
    }
  }
})

export const modalCloseButton = style({
  '@layer': {
    [app]: {
      minWidth: '44px',
      minHeight: '44px'
    }
  }
})

export const modalActionButton = style({
  '@layer': {
    [app]: {
      minHeight: '44px'
    }
  }
})

export const selectionModalContent = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.panel,
      borderRadius: '12px',
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100dvh - 48px)',
      maxHeight: 'calc(100dvh - 48px)',
      maxWidth: '1200px',
      minHeight: 0,
      overflow: 'hidden',
      width: 'calc(100vw - 48px)',
      '@media': {
        '(max-width: 700px)': {
          borderRadius: 0,
          height: '100dvh',
          maxHeight: '100dvh',
          maxWidth: '100vw',
          width: '100vw'
        }
      }
    }
  }
})

export const selectionModalInner = style({
  '@layer': {
    [app]: {
      '@media': {
        '(max-width: 700px)': {
          padding: 0
        }
      }
    }
  }
})

export const selectionModalHeader = style({
  '@layer': {
    [app]: {
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      flex: '0 0 auto',
      minHeight: '56px',
      paddingInline: 'clamp(16px, 3vw, 32px)'
    }
  }
})

export const selectionModalTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1.5rem',
      fontWeight: 750
    }
  }
})

export const selectionModalBody = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flex: '1 1 auto',
      minHeight: 0,
      overflow: 'hidden',
      padding: 0
    }
  }
})

export const selectionModalLayout = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateRows: 'auto minmax(0, 1fr)',
      height: '100%',
      minHeight: 0,
      overflow: 'hidden',
      width: '100%'
    }
  }
})

export const selectionModalIntro = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '14px',
      padding: '16px clamp(16px, 3vw, 32px)',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 360px)',
      alignItems: 'end',
      '@media': {
        '(max-width: 700px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const selectionModalScroller = style({
  '@layer': {
    [app]: {
      minHeight: 0,
      overscrollBehavior: 'contain',
      overflowY: 'auto',
      padding: '4px clamp(16px, 3vw, 32px) 24px',
      scrollbarGutter: 'stable'
    }
  }
})

export const selectionGroup = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '12px',
      paddingTop: '20px',
      selectors: {
        '& + &': {
          borderTop: `1px solid ${foundationVars.color.border.subtle}`,
          marginTop: '24px'
        }
      }
    }
  }
})

export const selectionGroupTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1.1rem',
      fontWeight: 750,
      margin: 0
    }
  }
})

export const selectionCardGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '16px',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      '@media': {
        '(max-width: 900px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const selectionCard = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.panel,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: '12px',
      color: foundationVars.color.text.primary,
      display: 'grid',
      gap: '12px',
      padding: '20px',
      textAlign: 'left',
      transition: 'border-color 160ms ease-out, background-color 160ms ease-out',
      selectors: {
        '&:hover': {
          borderColor: foundationVars.color.border.strong
        }
      },
      '@media': {
        '(prefers-reduced-motion: reduce)': {
          transition: 'none'
        }
      }
    }
  }
})

export const selectionCardSelected = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.accent.soft,
      borderColor: foundationVars.color.accent.border
    }
  }
})

export const selectionCardHeader = style({
  '@layer': {
    [app]: {
      alignItems: 'baseline',
      display: 'flex',
      gap: '12px',
      justifyContent: 'space-between'
    }
  }
})

export const selectionCardTitleGroup = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      flex: 1,
      gap: '10px',
      minWidth: 0
    }
  }
})

export const selectionCardIndicator = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      border: `1px solid ${foundationVars.color.border.strong}`,
      borderRadius: '999px',
      color: foundationVars.color.text.accent,
      display: 'inline-flex',
      flex: '0 0 20px',
      height: '20px',
      justifyContent: 'center',
      width: '20px'
    }
  }
})

export const selectionCardTitle = style({
  '@layer': {
    [app]: {
      cursor: 'pointer',
      flex: 1
    }
  }
})

export const selectionCardTitleText = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1.125rem',
      fontWeight: 750,
      lineHeight: 1.25,
      textWrap: 'balance'
    }
  }
})

export const selectionCardBody = style({
  '@layer': {
    [app]: {
      cursor: 'pointer',
      display: 'grid',
      gap: '12px'
    }
  }
})

export const selectionCardRadio = style({
  '@layer': {
    [app]: {
      height: '1px',
      margin: '-1px',
      opacity: 0,
      overflow: 'hidden',
      position: 'absolute',
      width: '1px'
    }
  }
})

export const selectionCardDescription = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      display: 'block',
      fontSize: '1rem',
      lineHeight: 1.55,
      maxHeight: '4.65em',
      maxWidth: '68ch',
      overflow: 'hidden',
      textWrap: 'pretty'
    }
  }
})

export const selectionCardDetails = style({
  '@layer': {
    [app]: {
      display: 'grid',
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      gap: '8px',
      paddingTop: '12px',
      margin: 0
    }
  }
})

export const selectionCardPrimaryDetails = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '10px',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      margin: 0
    }
  }
})

export const selectionCardPrimaryDetail = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.subtle,
      borderRadius: foundationVars.radius.md,
      display: 'grid',
      gap: '2px',
      padding: '10px 12px'
    }
  }
})

export const selectionCardPrimaryValue = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1.125rem',
      fontWeight: 750,
      lineHeight: 1.35,
      margin: 0
    }
  }
})

export const selectionCardDetail = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '4px',
      gridTemplateColumns: 'minmax(90px, 0.35fr) minmax(0, 1fr)'
    }
  }
})

export const selectionCardDetailLabel = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontSize: '0.75rem',
      fontWeight: 700
    }
  }
})

export const selectionCardDetailValue = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '0.9375rem',
      lineHeight: 1.45,
      margin: 0
    }
  }
})

export const selectionCardDetailUnmet = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.status.danger
    }
  }
})

export const selectionEmptyState = style({
  '@layer': {
    [app]: {
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      display: 'grid',
      gap: '4px',
      padding: '24px'
    }
  }
})

export const fieldGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '16px',
      gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
      '@media': {
        '(max-width: 760px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const stepFieldGroup = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '12px',
      selectors: {
        '& + &': {
          borderTop: `1px solid ${foundationVars.color.border.subtle}`,
          paddingTop: '18px'
        }
      }
    }
  }
})

export const stepFieldGroupTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1rem',
      fontWeight: 750,
      margin: 0
    }
  }
})

export const fieldSpan6 = style({
  '@layer': {
    [app]: {
      gridColumn: 'span 6',
      '@media': {
        '(max-width: 760px)': {
          gridColumn: '1'
        }
      }
    }
  }
})

export const fieldSpan4 = style({
  '@layer': {
    [app]: {
      gridColumn: 'span 4',
      '@media': {
        '(max-width: 760px)': {
          gridColumn: '1'
        }
      }
    }
  }
})

export const fieldSpan12 = style({
  '@layer': {
    [app]: {
      gridColumn: '1 / -1'
    }
  }
})

export const inlinePanel = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.subtle,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      display: 'grid',
      gap: '12px',
      padding: '16px'
    }
  }
})

export const classSection = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '12px',
      paddingBlock: '4px 16px',
      selectors: {
        '& + &': {
          borderTop: `1px solid ${foundationVars.color.border.subtle}`,
          paddingTop: '20px'
        }
      }
    }
  }
})

export const classHeader = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px',
      justifyContent: 'space-between'
    }
  }
})

export const classIdentity = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px'
    }
  }
})

export const classTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1.25rem',
      fontWeight: 750,
      lineHeight: 1.3,
      margin: 0
    }
  }
})

export const classLevelField = style({
  '@layer': {
    [app]: {
      width: '64px'
    }
  }
})

export const classProficiencyCard = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.subtle,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      display: 'grid',
      gap: '10px',
      padding: '16px'
    }
  }
})

export const classProficiencyRow = style({
  '@layer': {
    [app]: {
      alignItems: 'start',
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'minmax(110px, 0.35fr) minmax(0, 1fr)',
      minHeight: '34px',
      '@media': {
        '(max-width: 620px)': {
          alignItems: 'stretch',
          gap: '4px',
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const classProficiencyContent = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '8px',
      minWidth: 0
    }
  }
})

export const grantedFeatureSection = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '16px'
    }
  }
})

export const grantedFeatureItem = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.panel,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      display: 'grid',
      gap: '12px',
      padding: '16px'
    }
  }
})

export const grantedFeatureDetails = style({
  '@layer': {
    [app]: {
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '10px',
      paddingTop: '10px'
    }
  }
})

export const grantedFeatureDetail = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '4px'
    }
  }
})

export const backgroundDescription = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      lineHeight: 1.6,
      maxWidth: '78ch'
    }
  }
})

export const suggestedCharacteristics = style({
  '@layer': {
    [app]: {
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      overflow: 'hidden'
    }
  }
})

export const suggestedCharacteristicsSummary = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      cursor: 'pointer',
      fontWeight: 700,
      padding: '14px 16px'
    }
  }
})

export const suggestedCharacteristicsContent = style({
  '@layer': {
    [app]: {
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '18px',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      padding: '16px',
      '@media': {
        '(max-width: 760px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const suggestedCharacteristicsGroup = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '10px'
    }
  }
})

export const suggestedCharacteristic = style({
  '@layer': {
    [app]: {
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '4px',
      paddingTop: '8px'
    }
  }
})

export const grantedFeatureRow = style({
  '@layer': {
    [app]: {
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '8px',
      paddingBlock: '10px'
    }
  }
})

export const grantedFeatureHeader = style({
  '@layer': {
    [app]: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: '12px'
    }
  }
})

export const grantedFeatureDescription = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '1rem',
      lineHeight: 1.55,
      maxWidth: '72ch',
      textWrap: 'pretty'
    }
  }
})

export const grantedFeatureChoices = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '12px'
    }
  }
})

export const choiceSlotGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))'
    }
  }
})

export const spellChoiceLists = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '18px'
    }
  }
})

export const spellPickerSection = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '10px'
    }
  }
})

export const spellPickerHeader = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      gap: '16px',
      justifyContent: 'space-between'
    }
  }
})

export const spellPickerList = style({
  '@layer': {
    [app]: {
      borderBlock: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      maxHeight: '420px',
      overflowY: 'auto'
    }
  }
})

export const spellPickerRow = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'grid',
      gap: '16px',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      minHeight: '52px',
      padding: '8px 4px',
      selectors: {
        '& + &': {
          borderTop: `1px solid ${foundationVars.color.border.subtle}`
        }
      }
    }
  }
})

export const spellPickerDetails = style({
  '@layer': {
    [app]: {
      minWidth: 0
    }
  }
})

export const abilityAssignmentGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
      '@media': {
        '(max-width: 1100px)': {
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'
        },
        '(max-width: 700px)': {
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
        },
        '(max-width: 420px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const abilityAssignmentSlot = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '8px',
      '@media': {
        '(max-width: 1100px)': {
          background: foundationVars.color.surface.panel,
          border: `1px solid ${foundationVars.color.border.subtle}`,
          borderRadius: foundationVars.radius.md,
          padding: '10px'
        }
      }
    }
  }
})

export const hitpointTable = style({
  '@layer': {
    [app]: {
      borderCollapse: 'collapse',
      tableLayout: 'fixed',
      width: '100%',
      '@media': {
        '(max-width: 900px)': {
          tableLayout: 'auto'
        }
      }
    }
  }
})

export const hitpointPanel = style({
  '@layer': {
    [app]: {
      gap: '10px'
    }
  }
})

export const hitpointClassGroup = style({
  '@layer': { [app]: {} }
})

export const hitpointClassHeader = style({
  '@layer': { [app]: {} }
})

export const hitpointRow = style({
  '@layer': { [app]: {} }
})

export const startingEquipmentPanel = style({
  '@layer': {
    [app]: {
      gap: '10px',
      gridTemplateColumns: 'minmax(0, 1fr)'
    }
  }
})

export const startingEquipmentHeader = style({
  '@layer': {
    [app]: {
      alignItems: 'end',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px',
      justifyContent: 'space-between'
    }
  }
})

export const startingEquipmentMode = style({
  '@layer': {
    [app]: {
      flex: '0 1 280px'
    }
  }
})

export const startingEquipmentGroup = style({
  '@layer': {
    [app]: {
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      display: 'grid',
      gap: '10px',
      minWidth: 0,
      padding: '12px'
    }
  }
})

export const startingEquipmentGroups = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))'
    }
  }
})

export const startingEquipmentControlRow = style({
  '@layer': {
    [app]: {
      alignItems: 'end',
      display: 'grid',
      gap: '10px',
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(190px, 100%), 1fr))'
    }
  }
})

export const startingEquipmentGroupHeader = style({
  '@layer': {
    [app]: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: '12px',
      alignItems: 'flex-start'
    }
  }
})

export const startingEquipmentIncludedList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '4px'
    }
  }
})

export const startingEquipmentItemRow = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary
    }
  }
})

export const startingEquipmentChoiceList = style({
  '@layer': {
    [app]: {
      display: 'contents'
    }
  }
})

export const manualInventoryRow = style({
  '@layer': {
    [app]: {
      alignItems: 'end',
      display: 'grid',
      gap: '10px',
      gridTemplateColumns: 'minmax(220px, 1.25fr) minmax(90px, 0.35fr) minmax(180px, 1fr) auto',
      '@media': {
        '(max-width: 760px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const manualCurrencyRow = style({
  '@layer': {
    [app]: {
      alignItems: 'end',
      display: 'grid',
      gap: '10px',
      gridTemplateColumns: 'minmax(220px, 1fr) minmax(120px, 0.45fr) auto',
      '@media': {
        '(max-width: 760px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const manualPanelHeader = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      justifyContent: 'space-between',
      width: '100%'
    }
  }
})

export const reviewReadinessHeader = style({
  '@layer': {
    [app]: {
      alignItems: 'start',
      display: 'flex',
      gap: '16px',
      justifyContent: 'space-between'
    }
  }
})

export const reviewReadinessTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1.25rem',
      fontWeight: 750,
      margin: '0 0 4px'
    }
  }
})

export const reviewSummary = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.subtle,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      display: 'grid',
      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
      margin: 0,
      '@media': {
        '(max-width: 900px)': {
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
        },
        '(max-width: 520px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const reviewFact = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '4px',
      padding: '14px 16px'
    }
  }
})

export const reviewBlockers = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '10px'
    }
  }
})

export const reviewBlockerGroup = style({
  '@layer': {
    [app]: {
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      padding: '12px 14px'
    }
  }
})

export const reviewBlockerHeader = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      gap: '12px',
      justifyContent: 'space-between'
    }
  }
})

export const reviewMessageList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '6px',
      margin: '8px 0 0',
      paddingLeft: '20px'
    }
  }
})

export const reviewMessageBlocking = style({
  '@layer': { [app]: { color: foundationVars.color.status.danger } }
})

export const reviewMessageWarning = style({
  '@layer': { [app]: { color: foundationVars.color.status.warning } }
})

globalStyle(`${grantedFeatureDescription} p`, {
  margin: 0
})

globalStyle(`${grantedFeatureDescription} p + p`, {
  marginTop: '8px'
})

globalStyle(`${grantedFeatureDescription} ul, ${grantedFeatureDescription} ol`, {
  margin: '8px 0 0',
  paddingLeft: '20px'
})

globalStyle(`${selectionCardDescription} p`, {
  margin: 0
})

globalStyle(`${selectionCardDescription} p + p`, {
  marginTop: '8px'
})

globalStyle(`${selectionCardPrimaryDetail}:only-child`, {
  gridColumn: '1 / -1'
})

globalStyle(`${selectionCardRadio}:focus-visible ~ ${selectionCardHeader}`, {
  outline: `2px solid ${foundationVars.color.input.border.focus}`,
  outlineOffset: '6px'
})

globalStyle(`${selectionCardRadio}:checked ~ ${selectionCardHeader} ${selectionCardIndicator}`, {
  background: foundationVars.color.accent.soft,
  borderColor: foundationVars.color.accent.border
})

globalStyle(`${selectionCardDetailUnmet} dt, ${selectionCardDetailUnmet} dd`, {
  color: foundationVars.color.status.danger
})

globalStyle(`${hitpointTable} th`, {
  color: foundationVars.color.text.secondary,
  fontSize: '0.75rem',
  fontWeight: foundationVars.fontWeight.semibold,
  padding: '8px 10px',
  textAlign: 'left'
})

globalStyle(`${hitpointTable} td`, {
  borderTop: `1px solid ${foundationVars.color.border.subtle}`,
  color: foundationVars.color.text.primary,
  padding: '10px',
  verticalAlign: 'middle'
})

globalStyle(`${hitpointTable} th:nth-child(1), ${hitpointTable} td:nth-child(1)`, { width: '14%' })
globalStyle(`${hitpointTable} th:nth-child(2), ${hitpointTable} td:nth-child(2)`, { width: '24%' })
globalStyle(`${hitpointTable} th:nth-child(3), ${hitpointTable} td:nth-child(3)`, { width: '24%' })
globalStyle(`${hitpointTable} th:nth-child(4), ${hitpointTable} td:nth-child(4)`, { width: '22%' })
globalStyle(`${hitpointTable} th:nth-child(5), ${hitpointTable} td:nth-child(5)`, { width: '16%' })

globalStyle(`${hitpointClassGroup} + ${hitpointClassGroup} tr:first-child th`, {
  borderTop: `1px solid ${foundationVars.color.border.strong}`,
  paddingTop: '14px'
})

globalStyle(`${hitpointClassHeader} th`, {
  color: foundationVars.color.text.primary,
  paddingTop: '12px'
})

globalStyle(`${hitpointClassHeader} th > span`, { display: 'inline-block' })
globalStyle(`${hitpointClassHeader} th > span + span`, {
  color: foundationVars.color.text.secondary,
  float: 'right',
  fontWeight: foundationVars.fontWeight.semibold
})

globalStyle(`${hitpointRow}:hover td`, {
  background: foundationVars.color.surface.subtle
})

globalStyle(`${reviewFact} dt`, {
  color: foundationVars.color.text.secondary,
  fontSize: '0.75rem',
  fontWeight: foundationVars.fontWeight.semibold
})

globalStyle(`${reviewFact} dd`, {
  color: foundationVars.color.text.primary,
  margin: 0
})

globalStyle(`${hitpointTable} thead`, {
  '@media': { '(max-width: 900px)': { display: 'none' } }
})

globalStyle(`${hitpointTable} tbody, ${hitpointTable} tr, ${hitpointTable} td`, {
  '@media': { '(max-width: 900px)': { display: 'block', width: '100%' } }
})

globalStyle(`${hitpointTable} td`, {
  '@media': {
    '(max-width: 900px)': {
      borderTop: 0,
      display: 'grid',
      gap: '8px',
      gridTemplateColumns: 'minmax(120px, 0.45fr) minmax(0, 1fr)',
      padding: '5px 10px'
    }
  }
})

globalStyle(`${hitpointTable} td::before`, {
  '@media': {
    '(max-width: 900px)': {
      color: foundationVars.color.text.secondary,
      content: 'attr(data-label)',
      fontSize: '0.75rem',
      fontWeight: foundationVars.fontWeight.semibold
    }
  }
})

globalStyle(`${selectionCardRadio}:disabled ~ ${selectionCardHeader}`, {
  cursor: 'not-allowed'
})

globalStyle(`${selectionCardRadio}:disabled ~ ${selectionCardBody}`, {
  cursor: 'not-allowed'
})
