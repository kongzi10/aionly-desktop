import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export abstract class JsonFileStore<T> {
  private writeQueue: Promise<void> = Promise.resolve()

  protected constructor(public readonly filePath: string) {}

  protected async read(defaultValue: T): Promise<T> {
    try {
      return JSON.parse(await readFile(this.filePath, 'utf8')) as T
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return defaultValue
      }
      throw error
    }
  }

  protected async write(value: T): Promise<void> {
    const operation = this.writeQueue.then(async () => {
      await mkdir(dirname(this.filePath), { recursive: true })
      const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`
      await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
      await rename(temporaryPath, this.filePath)
    })

    this.writeQueue = operation.catch(() => undefined)
    return operation
  }
}
