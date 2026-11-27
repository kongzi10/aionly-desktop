import { loggerService } from '@logger'
import Dexie from 'dexie'

const logger = loggerService.withContext('ProfileDataMigrationService')

export const PROFILE_RENDERER_MIGRATION_PREFIX = 'aionly:renderer-migration:'
const LEGACY_PROFILE_DATA_MIGRATION_ENABLED = true

export function isLegacyProfileDataMigrationEnabled(): boolean {
  return LEGACY_PROFILE_DATA_MIGRATION_ENABLED
}

const LEGACY_REDUX_KEY = 'persist:aionly'
export const LEGACY_PROFILE_KEYS = [
  'ai302_token',
  'bailian_token',
  'tokenLanyunToken',
  'mcprouter_token',
  'modelscope_token',
  'tokenflux_token',
  'memory_currentUserId',
  'cacheUpdatedModels'
]

interface PersistedAssistant {
  id?: unknown
  workspace?: unknown
  topics?: Array<{ id?: unknown }>
}

function summarizePersistedAssistants(value: unknown) {
  try {
    const assistantsState = typeof value === 'string' ? JSON.parse(value) : value
    if (!assistantsState || typeof assistantsState !== 'object') return { assistantCount: 0, topicCount: 0 }

    const state = assistantsState as {
      defaultAssistant?: PersistedAssistant
      assistants?: PersistedAssistant[]
    }
    const assistants = [state.defaultAssistant, ...(Array.isArray(state.assistants) ? state.assistants : [])].filter(
      (assistant): assistant is PersistedAssistant => Boolean(assistant)
    )
    const topicIds = assistants.flatMap((assistant) =>
      Array.isArray(assistant.topics)
        ? assistant.topics.map((topic) => topic.id).filter((id): id is string => typeof id === 'string')
        : []
    )

    return {
      assistantCount: assistants.length,
      chatAssistantCount: assistants.filter((assistant) => assistant.workspace !== 'roundtable').length,
      roundtableAssistantCount: assistants.filter((assistant) => assistant.workspace === 'roundtable').length,
      topicCount: topicIds.length,
      topicIds: topicIds.slice(0, 50),
      topicIdsTruncated: topicIds.length > 50
    }
  } catch (error) {
    return { assistantCount: 0, topicCount: 0, parseError: String(error) }
  }
}

export function migrateLegacyReduxState(storage: Storage, profileId: string): boolean {
  const targetKey = `persist:aionly:${profileId}`
  let changed = false

  const legacyState = storage.getItem(LEGACY_REDUX_KEY)
  if (storage.getItem(targetKey) === null && legacyState !== null) {
    storage.setItem(targetKey, legacyState)
    changed = true
  }

  for (const key of LEGACY_PROFILE_KEYS) {
    const legacyValue = storage.getItem(key)
    const profileKey = `profile:${profileId}:${key}`
    if (legacyValue !== null && storage.getItem(profileKey) === null) {
      storage.setItem(profileKey, legacyValue)
      changed = true
    }
  }

  return changed
}

export function replaceLegacyReduxState(storage: Storage, profileId: string): boolean {
  const targetKey = `persist:aionly:${profileId}`
  const legacyState = storage.getItem(LEGACY_REDUX_KEY)
  if (legacyState !== null) {
    const restoredState = JSON.parse(legacyState) as Record<string, unknown>
    const currentStateValue = storage.getItem(targetKey)
    const currentState = currentStateValue ? (JSON.parse(currentStateValue) as Record<string, unknown>) : null
    delete restoredState.user
    if (currentState?.user !== undefined) restoredState.user = currentState.user
    storage.setItem(targetKey, JSON.stringify(restoredState))
    logger.info(
      'Legacy Redux state replaced',
      {
        profileId,
        sourceKey: LEGACY_REDUX_KEY,
        targetKey,
        sourceBytes: legacyState.length,
        restoredSlices: Object.keys(restoredState),
        assistants: summarizePersistedAssistants(restoredState.assistants)
      },
      { logToMain: true }
    )
  } else {
    logger.warn('Legacy Redux state was not found during recovery', { profileId, sourceKey: LEGACY_REDUX_KEY })
  }

  const hasLegacyProfileStorage = LEGACY_PROFILE_KEYS.some((key) => storage.getItem(key) !== null)
  if (hasLegacyProfileStorage) {
    for (const key of LEGACY_PROFILE_KEYS) {
      const legacyValue = storage.getItem(key)
      const profileKey = `profile:${profileId}:${key}`
      if (legacyValue === null) storage.removeItem(profileKey)
      else storage.setItem(profileKey, legacyValue)
    }
  }
  return legacyState !== null || hasLegacyProfileStorage
}

export function readLegacyReduxUserId(storage: Storage): string | null {
  const legacyState = storage.getItem(LEGACY_REDUX_KEY)
  if (!legacyState) return null
  try {
    const persisted = JSON.parse(legacyState) as { user?: unknown }
    const user = typeof persisted.user === 'string' ? JSON.parse(persisted.user) : persisted.user
    if (!user || typeof user !== 'object') return null
    const userInfoValue = (user as { userInfo?: unknown }).userInfo
    const userInfo = typeof userInfoValue === 'string' ? JSON.parse(userInfoValue) : userInfoValue
    if (!userInfo || typeof userInfo !== 'object') return null
    const userId = (userInfo as { userId?: unknown }).userId
    return userId === undefined || userId === null || !String(userId).trim() ? null : String(userId)
  } catch {
    return null
  }
}

export function readProfileAuthUserId(storage: Storage, profileId: string): string | null {
  const value = storage.getItem(`profile:${profileId}:userInfo`)
  if (!value) return null
  try {
    const userId = (JSON.parse(value) as { userId?: unknown }).userId
    return userId === undefined || userId === null || !String(userId).trim() ? null : String(userId)
  } catch {
    return null
  }
}

export type LegacyDataOwnerStatus = 'match' | 'mismatch' | 'unknown'

export function classifyLegacyDataOwner(
  legacyUserId: string | null,
  currentUserId: string | null
): LegacyDataOwnerStatus {
  if (!legacyUserId || !currentUserId) return 'unknown'
  return legacyUserId === currentUserId ? 'match' : 'mismatch'
}

interface IndexedDbMigrationOptions {
  legacyName?: string
  targetName?: string
}

interface MigrationDestination<T, K> {
  getMany(keys: K[]): Promise<Array<T | undefined>>
  addMany(records: T[]): Promise<unknown>
}

export async function copyMissingRecords<T, K>(
  records: T[],
  getKey: (record: T) => K,
  destination: MigrationDestination<T, K>
): Promise<void> {
  if (!records.length) return

  const keys = records.map(getKey)
  const existing = await destination.getMany(keys)
  const missing = records.filter((_, index) => existing[index] === undefined)
  if (missing.length) await destination.addMany(missing)

  const migrated = await destination.getMany(keys)
  if (migrated.some((record) => record === undefined)) {
    throw new Error('Failed to validate migrated record')
  }
}

function storesFrom(db: Dexie): Record<string, string> {
  return Object.fromEntries(
    db.tables.map((table) => {
      const primaryKey = table.schema.primKey.src
      const indexes = table.schema.indexes.map((index) => index.src)
      return [table.name, [primaryKey, ...indexes].filter(Boolean).join(',')]
    })
  )
}

export async function migrateLegacyIndexedDb(
  profileId: string,
  options: IndexedDbMigrationOptions = {}
): Promise<void> {
  const legacyName = options.legacyName ?? 'AiOnly'
  const targetName = options.targetName ?? `AiOnly-${profileId}`
  if (!legacyName || !targetName) throw new Error('Database names are required')
  if (!(await Dexie.exists(legacyName))) return

  const legacy = new Dexie(legacyName)
  const target = new Dexie(targetName)

  try {
    await legacy.open()
    if (await Dexie.exists(targetName)) {
      await target.open()
    } else {
      target.version(legacy.verno).stores(storesFrom(legacy))
      await target.open()
    }

    for (const sourceTable of legacy.tables) {
      const destinationTable = target.table(sourceTable.name)
      const records = await sourceTable.toArray()
      const keyPath = sourceTable.schema.primKey.keyPath
      if (!keyPath) throw new Error(`Cannot migrate ${sourceTable.name} without an inbound primary key`)
      await copyMissingRecords(records, (record) => Dexie.getByKeyPath(record, keyPath), {
        getMany: (keys) => destinationTable.bulkGet(keys),
        addMany: (missing) => destinationTable.bulkAdd(missing)
      })
    }
  } finally {
    legacy.close()
    target.close()
  }
}

export async function replaceLegacyIndexedDb(
  profileId: string,
  options: IndexedDbMigrationOptions = {}
): Promise<void> {
  const legacyName = options.legacyName ?? 'AiOnly'
  const targetName = options.targetName ?? `AiOnly-${profileId}`
  if (!(await Dexie.exists(legacyName))) {
    logger.warn('Legacy IndexedDB was not found during recovery', { profileId, legacyName, targetName })
    return
  }

  const legacy = new Dexie(legacyName)
  let target: Dexie | null = null
  let previousVersion = 0
  let previousStores: Record<string, string> | null = null
  let previousSnapshots: Map<string, unknown[]> | null = null
  try {
    await legacy.open()
    const snapshots = new Map<string, unknown[]>()
    for (const table of legacy.tables) snapshots.set(table.name, await table.toArray())

    const sourceCounts = Object.fromEntries([...snapshots].map(([tableName, records]) => [tableName, records.length]))
    const sourceTopicIds = ((snapshots.get('topics') ?? []) as Array<{ id?: unknown }>)
      .map((topic) => topic.id)
      .filter((id): id is string => typeof id === 'string')
    logger.info(
      'Legacy IndexedDB snapshot loaded',
      {
        profileId,
        legacyName,
        targetName,
        legacyVersion: legacy.verno,
        sourceCounts,
        sourceTopicIds: sourceTopicIds.slice(0, 50),
        sourceTopicIdsTruncated: sourceTopicIds.length > 50
      },
      { logToMain: true }
    )

    if (await Dexie.exists(targetName)) {
      const previous = new Dexie(targetName)
      try {
        await previous.open()
        previousVersion = previous.verno
        previousStores = storesFrom(previous)
        previousSnapshots = new Map()
        for (const table of previous.tables) previousSnapshots.set(table.name, await table.toArray())
      } finally {
        previous.close()
      }
    }

    await Dexie.delete(targetName)
    target = new Dexie(targetName)
    target.version(legacy.verno).stores(storesFrom(legacy))
    await target.open()
    for (const [tableName, records] of snapshots) {
      if (records.length) await target.table(tableName).bulkAdd(records)
    }

    const targetCounts = Object.fromEntries(
      await Promise.all(target.tables.map(async (table) => [table.name, await table.count()]))
    )
    const restoredTopicIds = sourceTopicIds.length
      ? await target
          .table('topics')
          .bulkGet(sourceTopicIds)
          .then((topics) =>
            topics
              .map((topic) => (topic as { id?: unknown } | undefined)?.id)
              .filter((id): id is string => typeof id === 'string')
          )
      : []
    logger.info(
      'Legacy IndexedDB replacement completed',
      {
        profileId,
        legacyName,
        targetName,
        sourceCounts,
        targetCounts,
        sourceTopicCount: sourceTopicIds.length,
        restoredTopicCount: restoredTopicIds.length,
        missingTopicIds: sourceTopicIds.filter((id) => !restoredTopicIds.includes(id)).slice(0, 50)
      },
      { logToMain: true }
    )
  } catch (error) {
    target?.close()
    await Dexie.delete(targetName)
    if (previousStores && previousSnapshots) {
      try {
        target = new Dexie(targetName)
        target.version(previousVersion).stores(previousStores)
        await target.open()
        for (const [tableName, records] of previousSnapshots) {
          if (records.length) await target.table(tableName).bulkAdd(records)
        }
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], 'Legacy IndexedDB replacement and rollback failed')
      }
    }
    throw error
  } finally {
    legacy.close()
    target?.close()
  }
}

export async function migrateLegacyProfileData(
  storage: Storage,
  profileId: string,
  migrateIndexedDb: (profileId: string) => Promise<void> = migrateLegacyIndexedDb
): Promise<void> {
  const markerKey = `${PROFILE_RENDERER_MIGRATION_PREFIX}${profileId}`
  if (storage.getItem(markerKey) === 'completed') return

  storage.setItem(markerKey, 'pending')
  migrateLegacyReduxState(storage, profileId)
  await migrateIndexedDb(profileId)
  storage.setItem(markerKey, 'completed')
}

export type AutoMigrationResult =
  | 'disabled'
  | 'none'
  | 'copied'
  | 'replaced'
  | 'skipped-owner-mismatch'
  | 'skipped-owner-unknown'
  | 'skipped-target-in-use'

export interface AutoMigrationDependencies {
  storage?: Storage
  legacyDatabaseExists?: () => Promise<boolean>
  profileDatabaseInUse?: (profileId: string) => Promise<boolean>
  migrate?: (storage: Storage, profileId: string) => Promise<void>
  replaceReduxState?: (storage: Storage, profileId: string) => boolean
  replaceIndexedDb?: (profileId: string) => Promise<void>
}

/**
 * 判断当前 profile 的 IndexedDB 是否已产生过真实对话数据（topics 表非空）。
 * 用于自动迁移时决定是否允许覆盖：已有使用痕迹的 profile 绝不自动替换，只保留手动恢复入口。
 */
export async function hasProfileDatabaseUsage(profileId: string): Promise<boolean> {
  const databaseName = `AiOnly-${profileId}`
  if (!(await Dexie.exists(databaseName))) return false
  const database = new Dexie(databaseName)
  try {
    await database.open()
    const topics = database.tables.find((table) => table.name === 'topics')
    return topics ? (await topics.count()) > 0 : false
  } finally {
    database.close()
  }
}

/**
 * 启动/登录/切换身份时的一次性自动迁移（方案 A）：
 * 把旧版本固定命名空间（`persist:aionly` / IndexedDB `AiOnly`）的数据迁入当前 profile
 * 命名空间（`persist:aionly:<profileId>` / `AiOnly-<profileId>`）。
 *
 * 安全约束：
 * 1. 幂等：`aionly:renderer-migration:<profileId>` marker 为 completed 时直接跳过；
 * 2. 归属校验：仅当旧数据 owner 与当前 profile 的 userId 一致（match）才迁移，
 *    mismatch/unknown 一律跳过，防止子账号登录错误吞并其他账号的数据；
 * 3. 不覆盖已有数据：目标 redux key 不存在 → 只补缺拷贝；已存在且 profile 已被使用
 *    （IndexedDB topics 非空）→ 跳过（保留手动"数据恢复"入口）；已存在但从未使用 →
 *    用旧数据替换（保留当前 user slice）；
 * 4. 只拷不删：旧命名空间数据原样保留，迁移失败可重试或走手动恢复。
 */
export async function autoMigrateLegacyProfileData(
  profileId: string,
  dependencies: AutoMigrationDependencies = {}
): Promise<AutoMigrationResult> {
  if (!isLegacyProfileDataMigrationEnabled()) return 'disabled'

  const storage = dependencies.storage ?? localStorage
  const markerKey = `${PROFILE_RENDERER_MIGRATION_PREFIX}${profileId}`
  if (storage.getItem(markerKey) === 'completed') return 'none'

  const legacyDatabaseExists = dependencies.legacyDatabaseExists ?? (() => Dexie.exists('AiOnly'))
  const hasLegacyRedux = storage.getItem(LEGACY_REDUX_KEY) !== null
  const hasLegacyDatabase = await legacyDatabaseExists()
  if (!hasLegacyRedux && !hasLegacyDatabase) {
    // 从未存在过旧数据（全新安装），标记完成避免每次启动重复探测
    storage.setItem(markerKey, 'completed')
    return 'none'
  }

  const ownerStatus = classifyLegacyDataOwner(readLegacyReduxUserId(storage), readProfileAuthUserId(storage, profileId))
  if (ownerStatus !== 'match') {
    logger.warn(
      'Legacy auto migration skipped by owner classification',
      { profileId, ownerStatus, hasLegacyRedux, hasLegacyDatabase },
      { logToMain: true }
    )
    return ownerStatus === 'mismatch' ? 'skipped-owner-mismatch' : 'skipped-owner-unknown'
  }

  const targetKey = `persist:aionly:${profileId}`
  if (storage.getItem(targetKey) === null) {
    const migrate = dependencies.migrate ?? ((target: Storage, id: string) => migrateLegacyProfileData(target, id))
    await migrate(storage, profileId)
    logger.info('Legacy profile data auto migrated (copy)', { profileId }, { logToMain: true })
    return 'copied'
  }

  // 目标 key 已存在：说明新版本已经运行过（可能只是空默认状态）。
  // 仅当该 profile 尚未产生任何对话数据时才允许替换，避免吞掉用户更新后新建的会话。
  const profileDatabaseInUse = dependencies.profileDatabaseInUse ?? hasProfileDatabaseUsage
  if (await profileDatabaseInUse(profileId)) {
    logger.warn(
      'Legacy auto migration skipped: current profile already in use',
      { profileId, hasLegacyRedux, hasLegacyDatabase },
      { logToMain: true }
    )
    return 'skipped-target-in-use'
  }

  const replaceReduxState = dependencies.replaceReduxState ?? replaceLegacyReduxState
  const replaceIndexedDb = dependencies.replaceIndexedDb ?? ((id: string) => replaceLegacyIndexedDb(id))
  storage.setItem(markerKey, 'recovering')
  try {
    replaceReduxState(storage, profileId)
    await replaceIndexedDb(profileId)
    storage.setItem(markerKey, 'completed')
  } catch (error) {
    storage.setItem(markerKey, 'failed')
    throw error
  }
  logger.info('Legacy profile data auto migrated (replace unused profile)', { profileId }, { logToMain: true })
  return 'replaced'
}
