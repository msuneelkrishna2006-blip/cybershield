import { EmailActionForm } from './EmailActionForm'

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  return <EmailActionForm token={token || ''} />
}
