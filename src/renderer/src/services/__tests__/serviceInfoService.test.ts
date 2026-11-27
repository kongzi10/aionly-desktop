import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getServiceApi = vi.hoisted(() => vi.fn())
const getState = vi.hoisted(() => vi.fn())
const dispatch = vi.hoisted(() => vi.fn())
const setServiceInfo = vi.hoisted(() => vi.fn((payload: unknown) => ({ type: 'user/setServiceInfo', payload })))

vi.mock('@renderer/api/seat', () => ({ getServiceApi }))
vi.mock('@renderer/store', () => ({ store: { getState, dispatch } }))
vi.mock('@renderer/store/user', () => ({ setServiceInfo }))
vi.mock('@shared/config/constant', () => ({ WEB_UI_HOST: 'https://web.example.com:9825' }))

import { refreshServiceInfo, resolveServiceDomainName } from '../serviceInfoService'

const loginState = { user: { token: 'valid-token' } }
const loggedOutState = { user: { token: '' } }

describe('resolveServiceDomainName', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uses window.location.hostname when it is not empty (dev/web)', () => {
    vi.stubGlobal('location', { hostname: 'localhost' })
    expect(resolveServiceDomainName()).toBe('localhost')
  })

  it('falls back to the WEB_UI_HOST hostname when location.hostname is empty (packaged file://)', () => {
    vi.stubGlobal('location', { hostname: '' })
    expect(resolveServiceDomainName()).toBe('web.example.com')
  })
})

describe('refreshServiceInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('location', { hostname: 'localhost' })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('does not request when logged out', async () => {
    getState.mockReturnValue(loggedOutState)

    await refreshServiceInfo()

    expect(getServiceApi).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('fetches with the resolved domain and dispatches setServiceInfo on success', async () => {
    getState.mockReturnValue(loginState)
    getServiceApi.mockResolvedValue({ data: { planStatus: 1, logoUrl: 'logo.png' } })

    await refreshServiceInfo()

    expect(getServiceApi).toHaveBeenCalledWith('localhost')
    expect(setServiceInfo).toHaveBeenCalledWith({ planStatus: 1, logoUrl: 'logo.png' })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'user/setServiceInfo',
      payload: { planStatus: 1, logoUrl: 'logo.png' }
    })
  })

  it('keeps the cached serviceInfo when the response carries no data', async () => {
    getState.mockReturnValue(loginState)
    getServiceApi.mockResolvedValue({ data: undefined })

    await refreshServiceInfo()

    expect(dispatch).not.toHaveBeenCalled()
  })

  it('keeps the cached serviceInfo when the request fails', async () => {
    getState.mockReturnValue(loginState)
    getServiceApi.mockRejectedValue(new Error('network down'))

    await expect(refreshServiceInfo()).resolves.toBeUndefined()

    expect(dispatch).not.toHaveBeenCalled()
  })
})
