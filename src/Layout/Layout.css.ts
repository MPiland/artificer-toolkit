import { style } from '@vanilla-extract/css'
import { app } from '@/css/layers.css'
import { space } from '@/css/size.css'
import { fontSize } from '@/css/typography.css'
import { vars, theme } from '@/css/theme'

export const layout = style({
  '@layer': {
    [app]: {
      'vars': {
        '--app-shell-border-color': vars.colors.gray[5],
        '--icon-width': '1.875rem',
      },
      'selectors': {
        [vars.darkSelector]: {
          vars: {
            '--app-shell-border-color': vars.colors.dark[3],
          },
        },
      },
      '@media': {
        '(min-width: 769px)': {
          vars: {
            '--app-shell-navbar-width': '18rem',
            '--app-shell-navbar-width-collapsed': `calc((var(--mantine-spacing-md) * 2) + var(--icon-width))`,
          },
        },
        '(min-width: 569px) and (max-width: 992px)': {
          vars: {
            '--app-shell-navbar-width-collapsed': '0px',
          },
        },
        '(max-width: 568px)': {
          vars: {
            '--app-shell-navbar-width': '100%',
            '--app-shell-navbar-width-collapsed': '0px',
          },
        },
      },
    },
  },
})

export const main = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
    },
  },
})

export const header = style({
  '@layer': {
    [app]: {
      insetInlineStart: 0,
      padding: `0 ${vars.spacing.md}`,
      backgroundColor: vars.colors.white,

      selectors: {
        [vars.darkSelector]: {
          backgroundColor: vars.colors.dark[6],
        },
      },
    },
  },
})

export const header_groups = style({
  '@layer': {
    [app]: {
      height: '100%',
      width: '100%',
      alignItems: 'center',
    },
  },
})

export const header_logo_icon = style({
  '@layer': {
    [app]: {
      flexShrink: 0,
    },
  },
})

export const header_burger = style({
  '@layer': {
    [app]: {
      order: 0,
      selectors: {
        '&.unAuth': {
          order: 2,
        },
      },
    },
  },
})

export const header_left_group = style({
  '@layer': {
    [app]: {
      justifyContent: 'flex-start',
      alignItems: 'center',
      height: '100%',
    },
  },
})

export const header_right_group = style({
  '@layer': {
    [app]: {
      justifyContent: 'flex-end',
      alignItems: 'center',
      height: '100%',
    },
  },
})

export const header_links = style({
  '@layer': {
    [app]: {
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
    },
  },
})

export const header_link = style({
  '@layer': {
    [app]: {
      fontWeight: '500',
      textDecorationStyle: 'solid',
      height: '100%',
      padding: `0 ${vars.spacing.md}`,
      alignContent: 'center',
    },
  },
})

export const header_title = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      fontSize: fontSize['font-size-1'],
      textDecoration: 'none',
      cursor: 'pointer',
      color: vars.colors.text,
      gap: space['space-2'],
      userSelect: 'none',
      height: '100%',
    },
  },
})

export const navbar = style({
  '@layer': {
    [app]: {
      'width': 'var(--app-shell-navbar-width)',
      'backgroundColor': vars.colors.white,
      'transitionProperty': 'max-width, top, height',
      'transform': 'unset',
      'selectors': {
        '&.collapsed.unAuth': {
          insetInlineStart: 'calc(var(--app-shell-navbar-width) * -1)',
          borderRight: 'none',
        },
        // '&.collapsed': {
        //   width: 'var(--app-shell-navbar-width-collapsed)',
        // },
        [vars.darkSelector]: {
          backgroundColor: vars.colors.dark[6],
        },
      },
      '@media': {
        '(max-width: 768px)': {
          borderRight: 'none',
        },
        '(min-width: 769px)': {
          width: '16rem',
        },
      },
    },
  },
})

export const navbar_header = style({
  '@layer': {
    [app]: {
      padding: `${vars.spacing.md} ${vars.spacing.md}`,
      paddingBottom: vars.spacing.xs,
    },
  },
})

export const navbar_links = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: `${vars.spacing.md} 0`,
    },
  },
})

export const navbar_link = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      gap: vars.spacing.xs,
      overflow: 'hidden',
      color: vars.colors.text,
      padding: `${vars.spacing.xs} ${vars.spacing.md}`,
      vars: {
        '--navbar-link-hover-bg': vars.colors.gray[4],
      },
      selectors: {
        [vars.darkSelector]: {
          vars: {
            '--navbar-link-hover-bg': vars.colors.dark[5],
          },
        },
        '&:hover': {
          backgroundColor: 'var(--navbar-link-hover-bg)',
        },
      },
    },
  },
})

export const navbar_link_icon_wrapper = style({
  '@layer': {
    [app]: {
      width: 'var(--icon-width)',
      height: 'var(--icon-width)',
      flexShrink: 0,
    },
  },
})

export const navbar_link_icon = style({
  '@layer': {
    [app]: {
      height: '1.875rem',
      width: '1.875rem',
      strokeWidth: '1.5px',
      flexShrink: 0,
      color: vars.colors.blue.lightColor,
      backgroundColor: vars.colors.blue.light,
      borderRadius: vars.radiusDefault,
    },
  },
})

export const navbar_link_label = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      userSelect: 'none',
    },
  },
})

export const navbar_link_tooltip = style({
  '@layer': {
    [app]: {
      backgroundColor: vars.colors.body,
      color: vars.colors.text,
      border: `${theme.other?.border.width.thin} ${theme.other?.border.style} var(--app-shell-border-color)`,
    },
  },
})

export const navbar_footer = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      borderTop: '1px solid var(--app-shell-border-color)',
    },
  },
})

export const layout_toggle_scheme_icon = style({
  '@layer': {
    [app]: {
      width: '22px',
      height: '22px',
      strokeWidth: '1.5',

      selectors: {
        '&.hide': {
          display: 'none',
        },
      },
    },
  },
})

export const user_button = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      padding: vars.spacing.md,
      color: vars.colors.text,
      overflow: 'hidden',
      gap: vars.spacing.md,
      width: '100%',
      vars: {
        '--user-button-hover-bg': vars.colors.gray[4],
      },
      selectors: {
        [vars.darkSelector]: {
          vars: {
            '--user-button-hover-bg': vars.colors.dark[5],
          },
        },
        '&:hover': {
          backgroundColor: 'var(--user-button-hover-bg)',
        },
      },
    },
  },
})

export const user_button_avatar = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 'var(--icon-width)',
      width: 'var(--icon-width)',
    },
  },
})

export const user_button_avatar_img = style({
  '@layer': {
    [app]: {
      width: '1.875rem',
      height: '1.875rem',
      borderRadius: vars.radius.xl,
    },
  },
})

export const user_button_label = style({
  '@layer': {
    [app]: {
      flex: 1,
    },
  },
})

export const user_button_title = style({
  '@layer': {
    [app]: {
      fontWeight: 500,
      fontSize: vars.fontSizes.sm,
      userSelect: 'none',
    },
  },
})

export const user_button_email = style({
  '@layer': {
    [app]: {
      fontSize: vars.fontSizes.xs,
      color: vars.colors.dimmed,
      userSelect: 'none',
    },
  },
})

export const user_button_chevron = style({
  '@layer': {
    [app]: {
      width: '14px',
      height: '14px',
      strokeWidth: '1.5px',
    },
  },
})

export const user_menu = style({
  '@layer': {
    [app]: {
      width: 'fit-content',
      borderColor: 'var(--user-menu-border-color)',
      vars: {
        '--user-menu-border-color': vars.colors.gray[5],
      },
      selectors: {
        [vars.darkSelector]: {
          vars: {
            '--user-menu-border-color': vars.colors.dark[3],
          },
        },
        '&.mantine-Menu-dropdown': {
          width: 'fit-content',
        },
      },
    },
  },
})
