import {
  RealtimeKitProvider,
  useRealtimeKitClient,
} from '@cloudflare/realtimekit-react'
import { RtkMeeting } from '@cloudflare/realtimekit-react-ui'
import * as React from 'react'

type RealtimeKitMeetingProps = {
  authToken: string
}

export default function RealtimeKitMeeting({ authToken }: RealtimeKitMeetingProps) {
  const [meeting, initMeeting] = useRealtimeKitClient()

  React.useEffect(() => {
    void initMeeting({
      authToken,
      defaults: {
        audio: true,
        video: true,
      },
    })
  }, [authToken, initMeeting])

  if (!meeting) {
    return <div className="meeting-placeholder">Preparing media...</div>
  }

  return (
    <RealtimeKitProvider value={meeting}>
      <RtkMeeting
        meeting={meeting}
        mode="fill"
        showSetupScreen={true}
        leaveOnUnmount={true}
      />
    </RealtimeKitProvider>
  )
}
