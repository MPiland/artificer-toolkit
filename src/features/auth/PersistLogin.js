import { Outlet, Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useRefreshMutation } from './authApiSlice'
import usePersist from '../../hooks/usePersist'
import { useSelector } from 'react-redux'
import { selectCurrentToken } from './authSlice'

const PersistLogin = () => {
  const [persist, setPersist] = usePersist()
  const token = useSelector(selectCurrentToken)
  const effectRan = useRef(false)

  const [trueSuccess, setTrueSuccess] = useState(false)

  const [refresh, { isUninitialized, isLoading, isSuccess, isError, error }] =
    useRefreshMutation()

  useEffect(() => {
    if (effectRan.current === true || process.env.NODE_ENV !== 'development') {
      // React 18 Strict Mode

      const verifyRefreshToken = async () => {
        console.log('verifying refresh token')
        //const response =
        await refresh()
        //const { accessToken } = response.data
        setTrueSuccess(true)
      }

      if (!token && persist) verifyRefreshToken()
    }

    return () => (effectRan.current = true)

    // eslint-disable-next-line
  }, [])

  let content
  if (!persist) {
    // persist: no
    content = <Outlet />
  } else if (isLoading) {
    //persist: yes, token: no
    console.log('no token')
    content = <p>Is Loading..</p>
  } else if (isError) {
    //persist: yes, token: no
    console.log('no token')
    setPersist(false)
    content = (
      <p className='errmsg'>
        {`${error?.data?.message} - `}
        <Link to='/'>Please login again</Link>.
      </p>
    )
  } else if (isSuccess && trueSuccess) {
    //persist: yes, token: yes
    content = <Outlet />
  } else if (token && isUninitialized) {
    //persist: yes, token: yes
    content = <Outlet />
  }

  return content
}
export default PersistLogin
