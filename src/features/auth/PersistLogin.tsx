import { Outlet } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import usePersist from '../../hooks/usePersist'
import Spinner from '../../components/Spinner/Spinner'
import useAuth from '../../hooks/useAuth'
import { useRefresh } from './authApi'

const PersistLogin = () => {
  const [persist] = usePersist()
  const [token] = useAuth()
  const effectRan = useRef(false)

  const [trueSuccess, setTrueSuccess] = useState(false)

  const { isPending, isError, isSuccess, error, mutateAsync: refresh } = useRefresh()

  useEffect(() => {
    if ((effectRan.current === true || process.env.NODE_ENV !== 'development') && persist !== false) {
      const verifyRefreshToken = async () => {
        console.log('verifying refresh token')
        //const response =
        await refresh()
        //const { accessToken } = response.data
        setTrueSuccess(true)
      }

      if (!token && persist) {
        verifyRefreshToken()
      }
    }

    return () => {
      effectRan.current = true
    }
  }, [persist, refresh, token])

  let content

  if (!persist) {
    // persist: no
    content = <Outlet />
  } else if (isPending) {
    //persist: yes, token: no
    console.log('loading')
    content = <Spinner />
  } else if (isError) {
    //persist: yes, token: no
    if (error && 'data' in error) {
      console.log(`Error - ${(error?.data as any)?.message}`)
    }
    content = <Outlet />
  } else if (isSuccess && trueSuccess) {
    //persist: yes, token: yes
    console.log('success')
    content = <Outlet />
  } else if (token) {
    //persist: yes, token: yes
    console.log('token and uninit')
    content = <Outlet />
  }

  return content
}
export default PersistLogin
