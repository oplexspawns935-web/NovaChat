import React from 'react'
import { Card } from '../components/Card'

export function LogsReportsPage() {
  const [content, setContent] = React.useState<string>('')

  async function load() {
    const res = await window.netflux.exportLogs()
    setContent(res.content || '')
  }

  React.useEffect(() => {
    load()
  }, [])

  return (
    <div className="grid gap-5">
      <Card
        title="Session Logs"
        right={
          <button
            onClick={load}
            className="btn-secondary text-xs"
          >
            Refresh
          </button>
        }
      >
        <div className="rounded-2xl bg-black/30 p-4">
          <pre className="m-0 max-h-[420px] overflow-auto text-xs text-white/70">{content || 'No logs yet.'}</pre>
        </div>
        <div className="mt-3 text-xs text-white/45">
          Exportable reports placeholder: connect to file save dialog later.
        </div>
      </Card>

      <Card title="Historical Graphs">
        <div className="text-sm text-white/70">
          Placeholder: store history to disk and render week/month trend charts.
        </div>
      </Card>
    </div>
  )
}
