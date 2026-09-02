import { randomBytes } from 'node:crypto'

export interface PreviewTokenPayload<T> {
  accountId: string
  expectedRevision: string
  expiresAt: number
  value: T
}

export class PreviewTokenStore<T> {
  private readonly values = new Map<string, PreviewTokenPayload<T>>()

  constructor(
    private readonly ttlMs = 5 * 60 * 1000,
    private readonly now: () => number = Date.now
  ) {}

  create(accountId: string, expectedRevision: string, value: T): { token: string; expiresAt: string } {
    const token = `arp_${randomBytes(24).toString('base64url')}`
    const expiresAt = this.now() + this.ttlMs
    this.values.set(token, { accountId, expectedRevision, expiresAt, value })
    return { token, expiresAt: new Date(expiresAt).toISOString() }
  }

  take(token: string, accountId: string, expectedRevision: string): T {
    const payload = this.values.get(token)
    if (!payload || payload.expiresAt <= this.now()) {
      this.values.delete(token)
      throw Object.assign(new Error('Preview token is missing or expired'), { code: 'PREVIEW_EXPIRED' })
    }
    if (payload.accountId !== accountId || payload.expectedRevision !== expectedRevision) {
      throw Object.assign(new Error('Preview token does not match this request'), { code: 'INVALID_REQUEST' })
    }
    this.values.delete(token)
    return payload.value
  }
}
