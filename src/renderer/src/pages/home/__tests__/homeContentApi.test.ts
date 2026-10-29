import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getHomePushList } from '../homeContentApi'

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }))
vi.mock('@renderer/utils/request', () => ({ default: { get: getMock } }))

beforeEach(() => getMock.mockReset())

describe('getHomePushList', () => {
  it('queries the client push endpoint with the requested pushType', async () => {
    getMock.mockResolvedValue({
      code: 200,
      data: [{ id: '100', pushType: 'avatar_overlay', title: 'Avatar notice', buttonText: 'View' }]
    })

    expect(await getHomePushList('avatar_overlay')).toEqual([
      { id: '100', pushType: 'avatar_overlay', title: 'Avatar notice', buttonText: 'View' }
    ])
    expect(getMock).toHaveBeenCalledWith(
      '/base/clientPushManage/getList',
      { pushType: 'avatar_overlay' },
      { cancel: false, loading: false }
    )
  })
})
