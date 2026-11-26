/**
 * 切换身份 · 历史登录账号（accounts/credentials）单元测试。
 * 沿用 UserProfileService.test.ts 的真实临时目录模式；encode/decodeBootstrap 走默认 base64 回退。
 */
import fs from 'node:fs/promises'
import path from 'node:path'

import { MAX_HISTORY_ACCOUNTS } from '@shared/profile'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.unmock('node:fs')
vi.unmock('node:path')

import { UserProfileService } from '../UserProfileService'

const registryPath = (root: string): string => path.join(root, 'Global', 'profile-registry.json')

const readRegistryFile = async (root: string): Promise<any> => JSON.parse(await fs.readFile(registryPath(root), 'utf8'))

const makeUpsert = (index: number) => ({
  userId: `user-${index}`,
  account: index % 2 === 0 ? `1521234710${index}` : `user${index}@example.com`,
  accountType: (index % 3 === 0 ? 'sub' : 'main') as 'main' | 'sub',
  nickName: `用户${index}`,
  avatarUrl: index % 2 === 0 ? `https://cdn.example.com/avatar/${index}.png` : '',
  accountId: `100${index}`,
  bootstrap: { token: `token-${index}`, userInfo: `{"userId":"user-${index}"}`, localUserSecret: `secret-${index}` }
})

describe('UserProfileService accounts (切换身份)', () => {
  let root: string

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(process.env.TEMP || process.cwd(), 'aionly-accounts-'))
  })

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  it('upsertAccount 写入掩码元数据与长期凭据并激活 Profile', async () => {
    const service = new UserProfileService(root)
    const result = await service.upsertAccount(makeUpsert(1))
    const profileId = service.getProfile('user-1').id
    expect(result.profileId).toBe(profileId)
    expect(service.getActiveProfile()?.id).toBe(profileId)

    const registry = await readRegistryFile(root)
    expect(registry.version).toBe(2)
    expect(registry.accounts[profileId]).toMatchObject({
      userId: 'user-1',
      account: 'user1@example.com',
      accountMasked: 'use****@example.com',
      accountType: 'main',
      nickName: '用户1',
      accountId: '1001'
    })
    // 长期凭据独立于一次性 bootstraps
    expect(typeof registry.credentials[profileId]).toBe('string')
    expect(registry.bootstraps[profileId]).toBeTruthy()
  })

  it('listAccounts 剥离 account 原文与 userId，当前登录置顶', async () => {
    const service = new UserProfileService(root)
    await service.upsertAccount(makeUpsert(1))
    await service.upsertAccount(makeUpsert(2))
    const firstId = service.getProfile('user-1').id
    const secondId = service.getProfile('user-2').id

    const { activeProfileId, accounts } = service.listAccounts()
    expect(activeProfileId).toBe(secondId)
    expect(accounts).toHaveLength(2)
    // 当前登录置顶
    expect(accounts[0].profileId).toBe(secondId)
    expect(accounts[1].profileId).toBe(firstId)
    for (const account of accounts) {
      expect(account).not.toHaveProperty('account')
      expect(account).not.toHaveProperty('userId')
      expect(account.accountMasked).not.toBe('')
      expect(account.lastLoginAt).toBeTruthy()
    }
    // 手机号掩码规则
    expect(accounts[0].accountMasked).toBe('152****7102')
  })

  it('prepareSwitch 一次性返回解密凭据；凭据缺失抛 CREDENTIAL_MISSING', async () => {
    const service = new UserProfileService(root)
    await service.upsertAccount(makeUpsert(1))
    await service.upsertAccount(makeUpsert(2))
    const firstId = service.getProfile('user-1').id

    const prepared = service.prepareSwitch(firstId)
    expect(prepared).toMatchObject({ userId: 'user-1', profileId: firstId, account: 'user1@example.com' })
    expect(prepared.bootstrap).toMatchObject({ token: 'token-1', localUserSecret: 'secret-1' })

    // 模拟凭据缺失（safeStorage 不可用时降级不写 credentials 的场景）
    ;(service as any).registry.credentials[firstId] = undefined as unknown as string
    delete (service as any).registry.credentials[firstId]
    expect(() => service.prepareSwitch(firstId)).toThrow(/CREDENTIAL_MISSING/)
    expect(() => service.prepareSwitch('not-exist-profile')).toThrow(/ACCOUNT_NOT_FOUND/)
  })

  it('removeAccount 删除列表项与凭据、拒绝删除当前登录、保留数据目录', async () => {
    const service = new UserProfileService(root)
    await service.upsertAccount(makeUpsert(1))
    const second = await service.upsertAccount(makeUpsert(2))
    const firstId = service.getProfile('user-1').id
    const firstDataRoot = service.getProfile('user-1').dataRoot

    await service.removeAccount(firstId)
    const { accounts } = service.listAccounts()
    expect(accounts.map((a) => a.profileId)).not.toContain(firstId)
    const registry = await readRegistryFile(root)
    expect(registry.accounts[firstId]).toBeUndefined()
    expect(registry.credentials[firstId]).toBeUndefined()
    // 数据目录保留（下次重新登录复用）
    await expect(fs.stat(firstDataRoot)).resolves.toBeTruthy()

    // 当前登录受保护
    await expect(service.removeAccount(second.profileId)).rejects.toThrow(/ACTIVE_PROFILE_PROTECTED/)
  })

  it('LRU：超过上限按 lastLoginAt 淘汰最旧的非活跃账号并同步清理凭据', async () => {
    const service = new UserProfileService(root)
    const ids: string[] = []
    for (let i = 1; i <= MAX_HISTORY_ACCOUNTS; i++) {
      const { profileId } = await service.upsertAccount(makeUpsert(i))
      ids.push(profileId)
    }
    // 构造确定性的 lastLoginAt 顺序：ids[0] 最旧 → ids[4] 最新
    ids.forEach((id, index) => {
      ;(service as any).registry.accounts[id].lastLoginAt = new Date(Date.UTC(2026, 0, index + 1)).toISOString()
    })

    const { profileId: sixthId } = await service.upsertAccount(makeUpsert(6))
    const { accounts, activeProfileId } = service.listAccounts()
    expect(activeProfileId).toBe(sixthId)
    expect(accounts).toHaveLength(MAX_HISTORY_ACCOUNTS)
    // 最旧的非活跃账号（ids[0]）被淘汰，其凭据同步清理
    expect(accounts.map((a) => a.profileId)).not.toContain(ids[0])
    const registry = await readRegistryFile(root)
    expect(registry.credentials[ids[0]]).toBeUndefined()
  })

  it('LRU 保护：活跃账号即使 lastLoginAt 全局最旧也不被淘汰', async () => {
    const service = new UserProfileService(root)
    const ids: string[] = []
    for (let i = 1; i <= MAX_HISTORY_ACCOUNTS; i++) {
      const { profileId } = await service.upsertAccount(makeUpsert(i))
      ids.push(profileId)
    }
    const registryRef = (service as any).registry
    // 人为超限：注入第 6 条非活跃账号（时间最新）
    registryRef.accounts['extra-profile'] = {
      userId: 'user-extra',
      profileId: 'extra-profile',
      accountId: '999',
      account: '15900000000',
      accountMasked: '159****0000',
      accountType: 'main',
      nickName: 'extra',
      avatarUrl: '',
      lastLoginAt: new Date(Date.UTC(2026, 5, 1)).toISOString()
    }
    // 活跃账号（ids[4]）设为全局最旧，其余非活跃递增
    ids.forEach((id, index) => {
      registryRef.accounts[id].lastLoginAt = new Date(Date.UTC(2026, 0, index + 1)).toISOString()
    })
    registryRef.accounts[ids[4]].lastLoginAt = new Date(Date.UTC(2025, 11, 1)).toISOString()

    ;(service as any).evictHistoryAccounts()

    const { accounts, activeProfileId } = service.listAccounts()
    expect(activeProfileId).toBe(ids[4])
    expect(accounts).toHaveLength(MAX_HISTORY_ACCOUNTS)
    // 最旧的非活跃账号被淘汰；全局最旧的活跃账号受保护
    expect(accounts.map((a) => a.profileId)).not.toContain(ids[0])
    expect(accounts.map((a) => a.profileId)).toContain(ids[4])
  })

  it('v1 registry 读兼容：缺失字段兜底，upsert 后升级为 v2', async () => {
    const v1Registry = {
      version: 1,
      activeProfileId: null,
      legacyOwnerProfileId: null,
      profiles: {},
      bootstraps: {},
      migrations: {}
    }
    await fs.mkdir(path.join(root, 'Global'), { recursive: true })
    await fs.writeFile(registryPath(root), JSON.stringify(v1Registry), 'utf8')

    const service = new UserProfileService(root)
    expect(service.listAccounts()).toEqual({ activeProfileId: null, accounts: [] })

    const { profileId } = await service.upsertAccount(makeUpsert(1))
    expect(profileId).toBe(service.getProfile('user-1').id)
    const registry = await readRegistryFile(root)
    expect(registry.version).toBe(2)
    expect(Object.keys(registry.accounts)).toHaveLength(1)
    expect(Object.keys(registry.credentials)).toHaveLength(1)
  })

  it('registry 损坏：备份 .corrupt-<ts> 后按空注册表启动', async () => {
    await fs.mkdir(path.join(root, 'Global'), { recursive: true })
    await fs.writeFile(registryPath(root), '{ not-valid-json !!!', 'utf8')

    const service = new UserProfileService(root)
    expect(service.listAccounts()).toEqual({ activeProfileId: null, accounts: [] })

    const files = await fs.readdir(path.join(root, 'Global'))
    expect(files.some((name) => /^profile-registry\.json\.corrupt-\d+$/.test(name))).toBe(true)
    // 损坏后仍可正常写入
    await service.upsertAccount(makeUpsert(1))
    expect(service.listAccounts().accounts).toHaveLength(1)
  })

  it('safeStorage 不可用（编码抛错）：upsertAccount 与改造前 activate 行为一致整体失败，不产生半状态', async () => {
    const service = new UserProfileService(root, {
      encodeBootstrap: () => {
        throw new Error('Secure profile storage is unavailable')
      }
    })
    // activate 路径编码失败 → 登录整体失败（与改造前 Profile_Activate 行为一致），accounts 不残留
    await expect(service.upsertAccount(makeUpsert(1))).rejects.toThrow(/Secure profile storage is unavailable/)
    expect(service.listAccounts().accounts).toHaveLength(0)
  })
})
