import { type FSWatcher, watch as watchDirectory } from 'node:fs'
import path from 'node:path'

type WatchDirectory = (
  directory: string,
  listener: (eventType: string, fileName: string | Buffer | null) => void
) => FSWatcher

export class ConfigFileWatcher {
  private watcher: FSWatcher | undefined
  private timer: NodeJS.Timeout | undefined

  constructor(
    private readonly onChange: () => void,
    private readonly debounceMs = 200,
    private readonly createWatcher: WatchDirectory = watchDirectory
  ) {}

  watch(filePath: string): boolean {
    this.close()
    const directory = path.dirname(filePath)
    const fileName = path.basename(filePath)

    try {
      this.watcher = this.createWatcher(directory, (_, changedFileName) => {
        if (changedFileName && changedFileName.toString() !== fileName) return
        if (this.timer) clearTimeout(this.timer)
        this.timer = setTimeout(this.onChange, this.debounceMs)
      })
      this.watcher.once('error', () => this.close())
      return true
    } catch {
      return false
    }
  }

  close(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
    this.watcher?.close()
    this.watcher = undefined
  }
}
