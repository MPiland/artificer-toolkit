import { ReactNode } from 'react'
import type { NavigateOptions, ToOptions } from '@tanstack/react-router'
import { link_icon } from './Navbar/Navbar.css'
import CharactersIcon from '@assets/Icons/IChar'
import ClassesIcon from '@assets/Icons/IClass'
import RacesIcon from '@assets/Icons/IRaces'
import ScrollIcon from '@assets/Icons/IScroll'
import SackIcon from '@assets/Icons/ISack'
import FeatsIcon from '@assets/Icons/IFeat'
import BackstoryIcon from '@assets/Icons/IBackstory'
import type { FormType } from '@types'

export const noAuthLinks: { to: ToOptions['to']; params?: NavigateOptions['params']; title: string }[] = [
  {
    to: '/',
    title: 'Media',
  },
  {
    to: '/',
    title: 'Pricing',
  },
  {
    to: '/',
    title: 'About',
  },
]

export const authLinks: { icon?: ReactNode; to: ToOptions['to']; title: FormType }[] = [
  { icon: <CharactersIcon className={link_icon} />, to: '/characters', title: 'characters' },
  {
    icon: <ClassesIcon className={link_icon} />,
    to: '/classes',
    title: 'classes',
  },
  {
    icon: <RacesIcon className={link_icon} />,
    to: '/races',
    title: 'races',
  },
  {
    icon: <ScrollIcon className={link_icon} />,
    to: '/spells',
    title: 'spells',
  },
  {
    icon: <SackIcon className={link_icon} />,
    to: '/equipment',
    title: 'equipment',
  },
  {
    icon: <BackstoryIcon className={link_icon} />,
    to: '/backgrounds',
    title: 'backgrounds',
  },
  {
    icon: <FeatsIcon className={link_icon} />,
    to: '/feats',
    title: 'feats',
  },
]
