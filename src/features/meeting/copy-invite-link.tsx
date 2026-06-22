import { Check, Copy } from 'lucide-react'
import * as React from 'react'

type CopyInviteLinkProps = {
  meetingId: string
  inviteUrl?: string
}

export function CopyInviteLink({ meetingId, inviteUrl }: CopyInviteLinkProps) {
  const [copied, setCopied] = React.useState(false)
  const fallbackUrl = useBrowserInviteUrl(meetingId)
  const value = inviteUrl ?? fallbackUrl

  async function copyInvite() {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="invite-box">
      <p className="field-label">Invite link</p>
      <div className="copy-row">
        <input value={value} readOnly aria-label="Invite link" />
        <button
          className="icon-button"
          type="button"
          onClick={copyInvite}
          disabled={!value}
          title="Copy invite link"
          aria-label="Copy invite link"
        >
          {copied ? (
            <Check size={18} aria-hidden="true" />
          ) : (
            <Copy size={18} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  )
}

function useBrowserInviteUrl(meetingId: string) {
  const [url, setUrl] = React.useState('')

  React.useEffect(() => {
    const nextUrl = new URL(window.location.href)
    nextUrl.searchParams.set('meetingId', meetingId)
    setUrl(nextUrl.toString())
  }, [meetingId])

  return url
}
