import os from 'os'
import { execFile } from 'child_process'

export type SystemInfo = {
  os: string
  osVersion: string
  arch: string
  hostname: string
  cpu: {
    model: string | null
    manufacturer: string | null
    cores: number
    logicalProcessors: number
    baseClockSpeed: number | null
    maxClockSpeed: number | null
    currentClockSpeed: number | null
    l2Cache: number | null
    l3Cache: number | null
    architecture: string | null
  }
  gpu: Array<{
    name: string | null
    manufacturer: string | null
    driverVersion: string | null
    memory: number | null
    memoryType: string | null
    coreClock: number | null
    memoryClock: number | null
  }>
  motherboard: {
    manufacturer: string | null
    product: string | null
    serialNumber: string | null
    version: string | null
  }
  ram: {
    totalGb: number
    speed: number | null
    slots: number
    sticks: Array<{
      capacity: number
      speed: number
      manufacturer: string | null
      partNumber: string | null
      serialNumber: string | null
      configuredClockSpeed: number | null
    }>
  }
  storage: Array<{
    model: string | null
    sizeGb: number
    type: string | null
    serialNumber: string | null
    firmware: string | null
    interfaceType: string | null
    sectors: number | null
  }>
  lastError: string | null
}

function runPowerShell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script]
    execFile('powershell.exe', args, { windowsHide: true, maxBuffer: 5 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(String(stderr || err.message || err)))
      resolve(String(stdout || ''))
    })
  })
}

export class SystemInfoService {
  async getInfo(): Promise<SystemInfo> {
    try {
      const cpus = os.cpus() || []
      const cpuModel = cpus[0]?.model ? String(cpus[0].model) : null
      const cpuCores = cpus.length || 0
      const logicalProcessors = os.cpus().length || 0
      const totalMemoryGb = Math.round((os.totalmem() / (1024 ** 3)) * 10) / 10

      // Get detailed CPU info
      let cpuManufacturer: string | null = null
      let maxClockSpeed: number | null = null
      let baseClockSpeed: number | null = null
      let currentClockSpeed: number | null = null
      let l2Cache: number | null = null
      let l3Cache: number | null = null
      let cpuArchitecture: string | null = null
      try {
        const cpuOut = await runPowerShell(
          "Get-CimInstance Win32_Processor | Select-Object Manufacturer, MaxClockSpeed, CurrentClockSpeed, L2CacheSize, L3CacheSize, Architecture | ConvertTo-Json"
        )
        const cpuParsed = JSON.parse(cpuOut)
        if (Array.isArray(cpuParsed) && cpuParsed.length > 0) {
          cpuManufacturer = cpuParsed[0].Manufacturer || null
          maxClockSpeed = cpuParsed[0].MaxClockSpeed ? Math.round(cpuParsed[0].MaxClockSpeed / 1000000) : null
          currentClockSpeed = cpuParsed[0].CurrentClockSpeed ? Math.round(cpuParsed[0].CurrentClockSpeed / 1000000) : null
          baseClockSpeed = cpuParsed[0].MaxClockSpeed ? Math.round(cpuParsed[0].MaxClockSpeed / 1000000 * 0.8) : null
          l2Cache = cpuParsed[0].L2CacheSize ? cpuParsed[0].L2CacheSize / 1024 : null
          l3Cache = cpuParsed[0].L3CacheSize ? cpuParsed[0].L3CacheSize / 1024 : null
          cpuArchitecture = cpuParsed[0].Architecture || null
        }
      } catch {
        // Ignore errors
      }

      // Get GPU info
      const gpus: Array<{ name: string | null; manufacturer: string | null; driverVersion: string | null; memory: number | null; memoryType: string | null; coreClock: number | null; memoryClock: number | null }> = []
      try {
        const gpuOut = await runPowerShell(
          "Get-CimInstance Win32_VideoController | Select-Object Name, DriverVersion, AdapterRAM, DriverVersion, VideoProcessor, AdapterDACType | ConvertTo-Json"
        )
        const gpuParsed = JSON.parse(gpuOut)
        if (Array.isArray(gpuParsed)) {
          for (const gpu of gpuParsed) {
            gpus.push({
              name: gpu.Name || null,
              manufacturer: gpu.VideoProcessor || null,
              driverVersion: gpu.DriverVersion || null,
              memory: gpu.AdapterRAM ? Math.round(gpu.AdapterRAM / (1024 ** 3)) : null,
              memoryType: gpu.AdapterDACType || null,
              coreClock: null,
              memoryClock: null,
            })
          }
        }
      } catch {
        // Ignore errors
      }

      // Get motherboard info
      let motherboardManufacturer: string | null = null
      let motherboardProduct: string | null = null
      let motherboardSerial: string | null = null
      let motherboardVersion: string | null = null
      try {
        const moboOut = await runPowerShell(
          "Get-CimInstance Win32_BaseBoard | Select-Object Manufacturer, Product, SerialNumber, Version | ConvertTo-Json"
        )
        const moboParsed = JSON.parse(moboOut)
        if (Array.isArray(moboParsed) && moboParsed.length > 0) {
          motherboardManufacturer = moboParsed[0].Manufacturer || null
          motherboardProduct = moboParsed[0].Product || null
          motherboardSerial = moboParsed[0].SerialNumber || null
          motherboardVersion = moboParsed[0].Version || null
        }
      } catch {
        // Ignore errors
      }

      // Get RAM info
      let ramSpeed: number | null = null
      const ramSticks: Array<{ capacity: number; speed: number; manufacturer: string | null; partNumber: string | null; serialNumber: string | null; configuredClockSpeed: number | null }> = []
      try {
        const ramOut = await runPowerShell(
          "Get-CimInstance Win32_PhysicalMemory | Select-Object Capacity, Speed, Manufacturer, PartNumber, SerialNumber, ConfiguredClockSpeed | ConvertTo-Json"
        )
        const ramParsed = JSON.parse(ramOut)
        if (Array.isArray(ramParsed)) {
          for (const stick of ramParsed) {
            ramSticks.push({
              capacity: stick.Capacity ? Math.round(stick.Capacity / (1024 ** 3)) : 0,
              speed: stick.Speed || 0,
              manufacturer: stick.Manufacturer || null,
              partNumber: stick.PartNumber || null,
              serialNumber: stick.SerialNumber || null,
              configuredClockSpeed: stick.ConfiguredClockSpeed || null,
            })
          }
          if (ramSticks.length > 0) {
            ramSpeed = ramSticks[0].speed
          }
        }
      } catch {
        // Ignore errors
      }

      // Get storage info
      const storage: Array<{ model: string | null; sizeGb: number; type: string | null; serialNumber: string | null; firmware: string | null; interfaceType: string | null; sectors: number | null }> = []
      try {
        const storageOut = await runPowerShell(
          "Get-CimInstance Win32_DiskDrive | Select-Object Model, Size, InterfaceType, SerialNumber, FirmwareRevision, Sectors | ConvertTo-Json"
        )
        const storageParsed = JSON.parse(storageOut)
        if (Array.isArray(storageParsed)) {
          for (const disk of storageParsed) {
            storage.push({
              model: disk.Model || null,
              sizeGb: disk.Size ? Math.round(disk.Size / (1024 ** 3)) : 0,
              type: disk.InterfaceType || null,
              serialNumber: disk.SerialNumber || null,
              firmware: disk.FirmwareRevision || null,
              interfaceType: disk.InterfaceType || null,
              sectors: disk.Sectors || null,
            })
          }
        }
      } catch {
        // Ignore errors
      }

      const osLabel = `${os.type()} ${os.release()}`
      const osVersion = os.release()

      return {
        os: osLabel,
        osVersion,
        arch: os.arch(),
        hostname: os.hostname(),
        cpu: {
          model: cpuModel,
          manufacturer: cpuManufacturer,
          cores: cpuCores,
          logicalProcessors,
          baseClockSpeed,
          maxClockSpeed,
          currentClockSpeed,
          l2Cache,
          l3Cache,
          architecture: cpuArchitecture,
        },
        gpu: gpus,
        motherboard: {
          manufacturer: motherboardManufacturer,
          product: motherboardProduct,
          serialNumber: motherboardSerial,
          version: motherboardVersion,
        },
        ram: {
          totalGb: totalMemoryGb,
          speed: ramSpeed,
          slots: ramSticks.length,
          sticks: ramSticks,
        },
        storage,
        lastError: null,
      }
    } catch (e: any) {
      return {
        os: 'unknown',
        osVersion: 'unknown',
        arch: 'unknown',
        hostname: 'unknown',
        cpu: {
          model: null,
          manufacturer: null,
          cores: 0,
          logicalProcessors: 0,
          baseClockSpeed: null,
          maxClockSpeed: null,
          currentClockSpeed: null,
          l2Cache: null,
          l3Cache: null,
          architecture: null,
        },
        gpu: [],
        motherboard: {
          manufacturer: null,
          product: null,
          serialNumber: null,
          version: null,
        },
        ram: {
          totalGb: 0,
          speed: null,
          slots: 0,
          sticks: [],
        },
        storage: [],
        lastError: String(e?.message || e),
      }
    }
  }
}
