import { Link } from 'react-router-dom'

const ErrorPage = ({ message }) => {
  return (
    <>
      <div>{message}</div>
      <div>
        <Link to='/'>Please login again</Link>
      </div>
    </>
  )
}
export default ErrorPage
