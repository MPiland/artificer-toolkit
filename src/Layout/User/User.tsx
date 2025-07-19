import { Menu } from '@mantine/core'
import { Avatar } from '@mantine/core'
import { Flex, Group } from '@mantine/core'
import { Text } from '@mantine/core'
import { ChevronRight } from 'lucide-react'
import { signOut } from '@/apis/auth.api'
import { useNavigate } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { base, avatar, avatar_img, chevron, email, label_container, menu, title } from './User.css'
import SchemeToggle from '../SchemeToggle/SchemeToggle'
import { use } from 'react'
import { ModalContext } from '@/components/Modal'

type UserProps = {
  toggleColorScheme: () => void
  lg: boolean
}

const User = ({ toggleColorScheme, lg }: UserProps) => {
  const navigate = useNavigate()
  const { showModal, hideModal } = use(ModalContext)

  const handleSignOut = async () => {
    showModal({
      type: 'loading',
    })
    await signOut()
    hideModal()
    navigate({ to: '/home' })
  }

  return (
    <Menu position={!lg ? 'top-start' : 'right-end'} portalProps={{ target: '#app-shell' }} trigger='click-hover'>
      <Menu.Target>
        <Group className={base}>
          <Avatar
            src='https://raw.githubusercontent.com/mantinedev/mantine/master/.demo/avatars/avatar-8.png'
            classNames={{
              root: avatar,
              image: avatar_img,
            }}
          />
          <Flex direction='column' justify='flex-start' className={label_container}>
            <Text className={title}>Harriette Spoonlicker</Text>
            <Text className={email}>hspoonlicker@outlook.com</Text>
          </Flex>
          <ChevronRight className={chevron} />
        </Group>
      </Menu.Target>

      <Menu.Dropdown className={menu}>
        <Menu.Item
          leftSection={<LogOut />}
          onClick={async () => {
            await handleSignOut()
          }}
        >
          Logout
        </Menu.Item>
        <Menu.Item leftSection={<SchemeToggle />} closeMenuOnClick={false} onClick={toggleColorScheme}>
          Toggle Light/Dark Mode
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}

export default User
