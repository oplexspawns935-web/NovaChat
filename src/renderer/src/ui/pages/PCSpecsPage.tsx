import React from 'react'
import { Card } from '../components/Card'

export function PCSpecsPage() {
  const [specs, setSpecs] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function loadSpecs() {
      try {
        const info = await window.netflux.getSystemInfo()
        setSpecs(info)
      } catch (e: any) {
        console.error('Failed to load specs:', e)
      } finally {
        setLoading(false)
      }
    }
    loadSpecs()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-white/50">Loading system specifications...</div>
      </div>
    )
  }

  if (!specs) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-neonPink">Failed to load system specifications</div>
      </div>
    )
  }

  return (
    <div className="grid gap-6 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">System Specifications</h1>
        <p className="text-white/50">Detailed hardware information</p>
      </div>

      <Card title="System Overview" className="relative overflow-hidden">
        <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-neonBlue/10 to-transparent blur-3xl" />
        <div className="relative grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
            <div className="text-[10px] uppercase tracking-wide text-white/40">Operating System</div>
            <div className="mt-2 text-sm font-semibold text-white">{specs.os}</div>
            <div className="text-xs text-white/50">{specs.osVersion}</div>
          </div>
          <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
            <div className="text-[10px] uppercase tracking-wide text-white/40">Hostname</div>
            <div className="mt-2 text-sm font-semibold text-white">{specs.hostname}</div>
            <div className="text-xs text-white/50">{specs.arch}</div>
          </div>
          <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
            <div className="text-[10px] uppercase tracking-wide text-white/40">Total Memory</div>
            <div className="mt-2 text-sm font-semibold text-neonBlue">{specs.ram.totalGb} GB</div>
            <div className="text-xs text-white/50">{specs.ram.slots} slot(s)</div>
          </div>
          <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
            <div className="text-[10px] uppercase tracking-wide text-white/40">Storage</div>
            <div className="mt-2 text-sm font-semibold text-white">{specs.storage.length} drive(s)</div>
            <div className="text-xs text-white/50">
              {specs.storage.reduce((sum: number, s: any) => sum + s.sizeGb, 0).toFixed(0)} GB total
            </div>
          </div>
        </div>
      </Card>

      <Card title="Processor (CPU)" className="relative overflow-hidden">
        <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-neonPurple/10 to-transparent blur-3xl" />
        <div className="relative grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
            <div className="text-[10px] uppercase tracking-wide text-white/40">Model</div>
            <div className="mt-2 text-sm font-semibold text-white">{specs.cpu.model || 'Unknown'}</div>
            <div className="text-xs text-white/50">{specs.cpu.manufacturer || 'Unknown'}</div>
          </div>
          <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
            <div className="text-[10px] uppercase tracking-wide text-white/40">Cores / Threads</div>
            <div className="mt-2 text-sm font-semibold text-neonPurple">
              {specs.cpu.cores} Cores / {specs.cpu.logicalProcessors} Threads
            </div>
            <div className="text-xs text-white/50">Physical / Logical</div>
          </div>
          <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
            <div className="text-[10px] uppercase tracking-wide text-white/40">Base Clock</div>
            <div className="mt-2 text-sm font-semibold text-white">
              {specs.cpu.baseClockSpeed ? `${specs.cpu.baseClockSpeed} GHz` : 'Unknown'}
            </div>
            <div className="text-xs text-white/50">Base frequency</div>
          </div>
          <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
            <div className="text-[10px] uppercase tracking-wide text-white/40">Max Clock</div>
            <div className="mt-2 text-sm font-semibold text-white">
              {specs.cpu.maxClockSpeed ? `${specs.cpu.maxClockSpeed} GHz` : 'Unknown'}
            </div>
            <div className="text-xs text-white/50">Turbo / Boost</div>
          </div>
          <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
            <div className="text-[10px] uppercase tracking-wide text-white/40">Current Clock</div>
            <div className="mt-2 text-sm font-semibold text-white">
              {specs.cpu.currentClockSpeed ? `${specs.cpu.currentClockSpeed} GHz` : 'Unknown'}
            </div>
            <div className="text-xs text-white/50">Real-time</div>
          </div>
          <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
            <div className="text-[10px] uppercase tracking-wide text-white/40">Architecture</div>
            <div className="mt-2 text-sm font-semibold text-white">{specs.cpu.architecture || specs.arch || 'Unknown'}</div>
            <div className="text-xs text-white/50">Instruction set</div>
          </div>
          <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
            <div className="text-[10px] uppercase tracking-wide text-white/40">L2 Cache</div>
            <div className="mt-2 text-sm font-semibold text-white">
              {specs.cpu.l2Cache ? `${specs.cpu.l2Cache} MB` : 'Unknown'}
            </div>
          </div>
          <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
            <div className="text-[10px] uppercase tracking-wide text-white/40">L3 Cache</div>
            <div className="mt-2 text-sm font-semibold text-white">
              {specs.cpu.l3Cache ? `${specs.cpu.l3Cache} MB` : 'Unknown'}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Graphics Processing Unit (GPU)" className="relative overflow-hidden">
        <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-neonPink/10 to-transparent blur-3xl" />
        <div className="relative">
          {specs.gpu.length === 0 ? (
            <div className="text-sm text-white/50">No GPU detected</div>
          ) : (
            <div className="grid gap-4">
              {specs.gpu.map((gpu: any, index: number) => (
                <div key={index} className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">{gpu.name || 'Unknown GPU'}</div>
                      <div className="text-xs text-white/50 mt-1">
                        {gpu.manufacturer || 'Unknown Manufacturer'}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-white/40">VRAM</div>
                          <div className="text-xs font-semibold text-white">{gpu.memory ? `${gpu.memory} GB` : 'Unknown'}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-white/40">Memory Type</div>
                          <div className="text-xs font-semibold text-white">{gpu.memoryType || 'Unknown'}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-white/40">Core Clock</div>
                          <div className="text-xs font-semibold text-white">{gpu.coreClock ? `${gpu.coreClock} MHz` : 'Unknown'}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-white/40">Memory Clock</div>
                          <div className="text-xs font-semibold text-white">{gpu.memoryClock ? `${gpu.memoryClock} MHz` : 'Unknown'}</div>
                        </div>
                      </div>
                      <div className="text-xs text-white/40 mt-2">Driver: {gpu.driverVersion || 'Unknown'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-white/40">GPU #{index + 1}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card title="Motherboard" className="relative overflow-hidden">
        <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-neonBlue/10 to-transparent blur-3xl" />
        <div className="relative grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
            <div className="text-[10px] uppercase tracking-wide text-white/40">Manufacturer</div>
            <div className="mt-2 text-sm font-semibold text-white">{specs.motherboard.manufacturer || 'Unknown'}</div>
          </div>
          <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
            <div className="text-[10px] uppercase tracking-wide text-white/40">Product</div>
            <div className="mt-2 text-sm font-semibold text-white">{specs.motherboard.product || 'Unknown'}</div>
          </div>
          <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
            <div className="text-[10px] uppercase tracking-wide text-white/40">Version</div>
            <div className="mt-2 text-sm font-semibold text-white">{specs.motherboard.version || 'Unknown'}</div>
          </div>
          <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
            <div className="text-[10px] uppercase tracking-wide text-white/40">Serial Number</div>
            <div className="mt-2 text-sm font-semibold text-white/70">{specs.motherboard.serialNumber || 'Unknown'}</div>
          </div>
        </div>
      </Card>

      <Card title="Memory (RAM)" className="relative overflow-hidden">
        <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-neonPurple/10 to-transparent blur-3xl" />
        <div className="relative">
          <div className="mb-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
              <div className="text-[10px] uppercase tracking-wide text-white/40">Total Capacity</div>
              <div className="mt-2 text-sm font-semibold text-neonBlue">{specs.ram.totalGb} GB</div>
            </div>
            <div className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
              <div className="text-[10px] uppercase tracking-wide text-white/40">Speed</div>
              <div className="mt-2 text-sm font-semibold text-white">
                {specs.ram.speed ? `${specs.ram.speed} MHz` : 'Unknown'}
              </div>
            </div>
          </div>
          {specs.ram.sticks.length > 0 && (
            <div className="grid gap-3">
              <div className="text-xs uppercase tracking-wide text-white/40 font-semibold">Memory Sticks</div>
              {specs.ram.sticks.map((stick: any, index: number) => (
                <div key={index} className="rounded-xl bg-black/25 px-4 py-3 ring-1 ring-white/10">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <div className="text-xs text-white/40">Slot {index + 1}</div>
                        <div className="text-sm font-semibold text-white">{stick.capacity} GB</div>
                        <div className="text-xs text-white/50">{stick.speed} MHz</div>
                        <div className="text-xs text-white/40">{stick.manufacturer || 'Unknown'}</div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-white/30">
                        <span>Serial: {stick.serialNumber || 'Unknown'}</span>
                        <span>•</span>
                        <span>Configured: {stick.configuredClockSpeed ? `${stick.configuredClockSpeed} MHz` : 'Unknown'}</span>
                      </div>
                    </div>
                    <div className="text-xs text-white/30">{stick.partNumber || 'N/A'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card title="Storage" className="relative overflow-hidden">
        <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-neonPink/10 to-transparent blur-3xl" />
        <div className="relative">
          {specs.storage.length === 0 ? (
            <div className="text-sm text-white/50">No storage devices detected</div>
          ) : (
            <div className="grid gap-3">
              {specs.storage.map((disk: any, index: number) => (
                <div key={index} className="rounded-2xl bg-black/25 p-4 ring-1 ring-white/10">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">{disk.model || 'Unknown Drive'}</div>
                      <div className="text-xs text-white/50 mt-1">
                        {disk.sizeGb} GB • {disk.interfaceType || 'Unknown Interface'}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-white/40">Type</div>
                          <div className="text-xs font-semibold text-white">{disk.type || 'Unknown'}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-white/40">Firmware</div>
                          <div className="text-xs font-semibold text-white">{disk.firmware || 'Unknown'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-white/30 mt-2">
                        <span>Serial: {disk.serialNumber || 'Unknown'}</span>
                        {disk.sectors && <span>•</span>}
                        {disk.sectors && <span>Sectors: {disk.sectors.toLocaleString()}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-white/40">Drive #{index + 1}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
