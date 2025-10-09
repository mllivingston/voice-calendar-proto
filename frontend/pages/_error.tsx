import React from 'react'

function ErrorPage({ statusCode }: { statusCode?: number }) {
  return (
    <div style={{padding: 32, fontFamily: 'system-ui'}}>
      <h1>Something went wrong</h1>
      <p>Status: {statusCode ?? 'Unknown'}</p>
    </div>
  )
}

ErrorPage.getInitialProps = ({ res, err }: any) => {
  const statusCode = res?.statusCode || err?.statusCode || 500
  return { statusCode }
}

export default ErrorPage
