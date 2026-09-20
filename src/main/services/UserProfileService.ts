import { createHash } from 'node:crypto'
import fs from 'node:fs'
import fsAsync from 'node:fs/promises'
import path from 'node:path'

import { app, safeStorage } from 'electron'

export interface UserProfile {
  id: string
  root: string
  dataRoot: string
  partition: string
}

export interface ProfileBootstrap {
  token?: string
  userInfo?: string
  serviceInfo?: string
  localUserSecret?: string
}

type MigrationState = 'pending' | 'copying' | 'verified' | 'committed' | 'cleanup_pending' | 'completed' | 'failed'

interface MigrationRecord {
  state: MigrationState
  attempts: number
  lastError?: string
  sourceFileCount?: number
  sourceBytes?: number
  destinationFileCount?: number
  destinationBytes?: number
}

interface ProfileRegistry {
  version: 1
  activeProfileId: string | null
  legacyOwnerProfileId: string | null
  profiles: Record<string, { createdAt: string }>
  bootstraps: Record<string, string>
  migrations: Record<string, MigrationRecord>
}

interface DirectoryFingerprint {
  fileCount: number
  bytes: number
}

interface UserProfileServiceOptions {
  enableLegacyMigration?: boolean
  validateMigration?: (source: DirectoryFingerprint, destination: DirectoryFingerprint) => Promise<void>
  copyDirectory?: (source: string, destination: string) => Promise<void>
  encodeBootstrap?: (bootstrap: ProfileBootstrap) => string
  decodeBootstrap?: (encoded: string) => ProfileBootstrap
}

const AUTH_BOOTSTRAP_KEYS = ['token', 'userInfo', 'serviceInfo', 'localUserSecret'] as const
const PROFILE_HASH_LENGTH = 32

const emptyRegistry = (): ProfileRegistry => ({
  version: 1,
  activeProfileId: null,
  legacyOwnerProfileId: null,
  profiles: {},
  bootstraps: {},
  migrations: {}
})

export class UserProfileService {
  private readonly registryPath: string
  private registry: ProfileRegistry
  private operation: Promise<unknown> = Promise.resolve()

  constructor(
    private readonly userDataRoot: string,
    private readonly options: UserProfileServiceOptions = {}
  ) {
    this.registryPath = path.join(userDataRoot, 'Global', 'profile-registry.json')
    this.registry = this.readRegistry()
  }

  getProfile(userId: string): UserProfile {
    const normalized = userId.trim()
    if (!normalized) {
      throw new Error('A non-empty user id is required')
    }

    const id = createHash('sha256').update(normalized).digest('hex').slice(0, PROFILE_HASH_LENGTH)
    return this.getProfileById(id)
  }

  getActiveProfile(): UserProfile | null {
    return this.registry.activeProfileId ? this.getProfileById(this.registry.activeProfileId) : null
  }

  isLegacyOwner(profileId: string): boolean {
    return this.registry.legacyOwnerProfileId === profileId
  }

  getDataRoot(): string {
    return this.getActiveProfile()?.dataRoot ?? path.join(this.userDataRoot, 'Data')
  }

  async activate(userId: string, bootstrap: Record<string, string | undefined> = {}): Promise<UserProfile> {
    return this.runExclusive(() => this.activateUnlocked(userId, bootstrap))
  }

  private async activateUnlocked(
    userId: string,
    bootstrap: Record<string, string | undefined> = {}
  ): Promise<UserProfile> {
    const previousActiveProfileId = this.registry.activeProfileId
    const profile = this.getProfile(userId)
    const isLegacyOwner = this.registry.legacyOwnerProfileId === null
    const shouldMigrateLegacy = isLegacyOwner && this.options.enableLegacyMigration !== false
    const encodedBootstrap = this.encodeBootstrap(this.filterBootstrap(bootstrap))

    this.registry.profiles[profile.id] ??= { createdAt: new Date().toISOString() }
    this.registry.bootstraps[profile.id] = encodedBootstrap
    this.registry.migrations[profile.id] ??= { state: 'pending', attempts: 0 }
    await this.writeRegistry()

    try {
      if (shouldMigrateLegacy) {
        await this.migrateLegacyData(profile)
        this.registry.legacyOwnerProfileId = profile.id
      } else {
        await fsAsync.mkdir(profile.dataRoot, { recursive: true })
      }

      this.registry.activeProfileId = profile.id
      this.registry.migrations[profile.id] = {
        ...this.registry.migrations[profile.id],
        state: 'cleanup_pending'
      }
      await this.writeRegistry()
      return profile
    } catch (error) {
      this.registry.activeProfileId = previousActiveProfileId
      this.registry.migrations[profile.id] = {
        ...this.registry.migrations[profile.id],
        state: 'failed',
        lastError: error instanceof Error ? error.message : String(error)
      }
      await this.writeRegistry()
      throw error
    }
  }

  async deactivate(): Promise<void> {
    return this.runExclusive(async () => {
      const previousActiveProfileId = this.registry.activeProfileId
      this.registry.activeProfileId = null
      try {
        await this.writeRegistry()
      } catch (error) {
        this.registry.activeProfileId = previousActiveProfileId
        throw error
      }
    })
  }

  async compensateActiveProfile(): Promise<void> {
    if (this.options.enableLegacyMigration === false) return
    const profile = this.getActiveProfile()
    if (!profile || this.registry.legacyOwnerProfileId !== profile.id) return

    await this.copyMissing(path.join(this.userDataRoot, 'Data'), profile.dataRoot)
  }

  consumeBootstrap(profileId: string): ProfileBootstrap | null {
    const encoded = this.registry.bootstraps[profileId]
    if (!encoded) return null

    delete this.registry.bootstraps[profileId]
    this.writeRegistrySync()
    return this.decodeBootstrap(encoded)
  }

  private getProfileById(id: string): UserProfile {
    const root = path.join(this.userDataRoot, 'Profiles', id)
    return {
      id,
      root,
      dataRoot: root,
      partition: `persist:aionly-${id}`
    }
  }

  private filterBootstrap(input: Record<string, string | undefined>): ProfileBootstrap {
    const result: ProfileBootstrap = {}
    for (const key of AUTH_BOOTSTRAP_KEYS) {
      const value = input[key]
      if (typeof value === 'string') result[key] = value
    }
    return result
  }

  private encodeBootstrap(bootstrap: ProfileBootstrap): string {
    return (
      this.options.encodeBootstrap?.(bootstrap) ?? Buffer.from(JSON.stringify(bootstrap), 'utf8').toString('base64')
    )
  }

  private decodeBootstrap(encoded: string): ProfileBootstrap {
    return (
      this.options.decodeBootstrap?.(encoded) ??
      (JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as ProfileBootstrap)
    )
  }

  private async migrateLegacyData(profile: UserProfile): Promise<void> {
    const record = this.registry.migrations[profile.id]
    record.state = 'copying'
    record.attempts += 1
    delete record.lastError
    await this.writeRegistry()

    const nativeSource = path.join(this.userDataRoot, 'Data')
    const nativeTemp = `${profile.dataRoot}.migration`
    const rollbackRoot = `${profile.dataRoot}.migration-rollback`

    if (fs.existsSync(rollbackRoot)) {
      await fsAsync.rm(profile.dataRoot, { recursive: true, force: true })
      await fsAsync.rename(rollbackRoot, profile.dataRoot)
    }
    await fsAsync.rm(nativeTemp, { recursive: true, force: true })
    await fsAsync.rm(rollbackRoot, { recursive: true, force: true })
    await fsAsync.mkdir(path.dirname(nativeTemp), { recursive: true })

    let dataCommitted = false
    try {
      if (fs.existsSync(nativeSource)) {
        if (this.options.copyDirectory) await this.options.copyDirectory(nativeSource, nativeTemp)
        else await fsAsync.cp(nativeSource, nativeTemp, { recursive: true })
      } else await fsAsync.mkdir(nativeTemp, { recursive: true })

      // Profiles may already contain data from builds where legacy migration was disabled.
      // Overlay that data so current profile files win conflicts while missing legacy files are retained.
      if (fs.existsSync(profile.dataRoot)) {
        await fsAsync.cp(profile.dataRoot, nativeTemp, { recursive: true, force: true })
      }

      const sourceManifest = await this.createOverlayManifest([nativeSource, profile.dataRoot])
      const destinationManifest = await this.createOverlayManifest([nativeTemp])
      const sourceFingerprint = this.fingerprintManifest(sourceManifest)
      const destinationFingerprint = await this.fingerprintPaths([nativeTemp])
      record.sourceFileCount = sourceFingerprint.fileCount
      record.sourceBytes = sourceFingerprint.bytes
      record.destinationFileCount = destinationFingerprint.fileCount
      record.destinationBytes = destinationFingerprint.bytes

      if (!this.manifestsEqual(sourceManifest, destinationManifest)) {
        throw new Error('Legacy profile migration validation failed')
      }
      await this.validateMigration(sourceFingerprint, destinationFingerprint)
      record.state = 'verified'
      await this.writeRegistry()

      if (fs.existsSync(profile.dataRoot)) await fsAsync.rename(profile.dataRoot, rollbackRoot)
      try {
        await fsAsync.rename(nativeTemp, profile.dataRoot)
        dataCommitted = true
      } catch (error) {
        if (fs.existsSync(rollbackRoot)) await fsAsync.rename(rollbackRoot, profile.dataRoot)
        throw error
      }
      record.state = 'committed'
      await this.writeRegistry()
      await fsAsync.rm(rollbackRoot, { recursive: true, force: true })
    } catch (error) {
      await fsAsync.rm(nativeTemp, { recursive: true, force: true })
      if (!dataCommitted && fs.existsSync(rollbackRoot)) {
        await fsAsync.rm(profile.dataRoot, { recursive: true, force: true }).catch(() => {})
        await fsAsync.rename(rollbackRoot, profile.dataRoot).catch(() => {})
      }
      throw error
    }
  }

  private runExclusive<T>(action: () => Promise<T>): Promise<T> {
    const result = this.operation.then(action, action)
    this.operation = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  private async validateMigration(source: DirectoryFingerprint, destination: DirectoryFingerprint): Promise<void> {
    if (source.fileCount !== destination.fileCount || source.bytes !== destination.bytes) {
      throw new Error('Legacy profile migration validation failed')
    }
    await this.options.validateMigration?.(source, destination)
  }

  private async fingerprintPaths(paths: string[]): Promise<DirectoryFingerprint> {
    const result = { fileCount: 0, bytes: 0 }
    for (const target of paths) await this.addPathFingerprint(target, result)
    return result
  }

  private async createOverlayManifest(roots: string[]): Promise<Map<string, number>> {
    const manifest = new Map<string, number>()
    for (const root of roots) await this.addPathToManifest(root, root, manifest)
    return manifest
  }

  private async addPathToManifest(root: string, target: string, manifest: Map<string, number>): Promise<void> {
    let stat
    try {
      stat = await fsAsync.stat(target)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }

    if (stat.isFile()) {
      manifest.set(path.relative(root, target), stat.size)
      return
    }

    for (const entry of await fsAsync.readdir(target)) {
      await this.addPathToManifest(root, path.join(target, entry), manifest)
    }
  }

  private fingerprintManifest(manifest: Map<string, number>): DirectoryFingerprint {
    let bytes = 0
    for (const size of manifest.values()) bytes += size
    return { fileCount: manifest.size, bytes }
  }

  private manifestsEqual(source: Map<string, number>, destination: Map<string, number>): boolean {
    if (source.size !== destination.size) return false
    for (const [filePath, size] of source) {
      if (destination.get(filePath) !== size) return false
    }
    return true
  }

  private async addPathFingerprint(target: string, result: DirectoryFingerprint): Promise<void> {
    let stat
    try {
      stat = await fsAsync.stat(target)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }

    if (stat.isFile()) {
      result.fileCount += 1
      result.bytes += stat.size
      return
    }

    const entries = await fsAsync.readdir(target)
    for (const entry of entries) await this.addPathFingerprint(path.join(target, entry), result)
  }

  private async copyMissing(source: string, destination: string): Promise<void> {
    let stat
    try {
      stat = await fsAsync.stat(source)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }

    try {
      await fsAsync.stat(destination)
      if (stat.isFile()) return
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      if (stat.isFile()) {
        await fsAsync.mkdir(path.dirname(destination), { recursive: true })
        await fsAsync.copyFile(source, destination)
        return
      }
      await fsAsync.mkdir(destination, { recursive: true })
    }

    if (!stat.isDirectory()) return
    for (const entry of await fsAsync.readdir(source)) {
      await this.copyMissing(path.join(source, entry), path.join(destination, entry))
    }
  }

  private readRegistry(): ProfileRegistry {
    try {
      if (typeof fs.readFileSync !== 'function') return emptyRegistry()
      const raw = fs.readFileSync(this.registryPath, 'utf8')
      if (typeof raw !== 'string' || !raw.trim()) return emptyRegistry()
      return JSON.parse(raw) as ProfileRegistry
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      return emptyRegistry()
    }
  }

  private async writeRegistry(): Promise<void> {
    await fsAsync.mkdir(path.dirname(this.registryPath), { recursive: true })
    const temporaryPath = `${this.registryPath}.tmp`
    await fsAsync.writeFile(temporaryPath, JSON.stringify(this.registry, null, 2), 'utf8')
    await fsAsync.rename(temporaryPath, this.registryPath)
  }

  private writeRegistrySync(): void {
    fs.mkdirSync(path.dirname(this.registryPath), { recursive: true })
    const temporaryPath = `${this.registryPath}.tmp`
    fs.writeFileSync(temporaryPath, JSON.stringify(this.registry, null, 2), 'utf8')
    fs.renameSync(temporaryPath, this.registryPath)
  }
}

let userProfileService: UserProfileService | null = null

export function getUserProfileService(): UserProfileService {
  userProfileService ??= new UserProfileService(app.getPath('userData'), {
    enableLegacyMigration: false,
    encodeBootstrap: (bootstrap) => {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure profile storage is unavailable')
      return safeStorage.encryptString(JSON.stringify(bootstrap)).toString('base64')
    },
    decodeBootstrap: (encoded) =>
      JSON.parse(safeStorage.decryptString(Buffer.from(encoded, 'base64'))) as ProfileBootstrap
  })
  return userProfileService
}

export function getProfilePartition(namespace: string): string {
  const profileId = getUserProfileService().getActiveProfile()?.id ?? 'login'
  return `persist:${namespace}-${profileId}`
}
