import { Link } from 'react-router-dom'

const ErrorPage = ({ message }: { message: string }) => {
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
