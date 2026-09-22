import type { Model } from '@renderer/types'

export const ROUNDTABLE_MAX_MODELS_FREE = 2
export const ROUNDTABLE_MAX_MODELS_MEMBER = 4

/** 用户资料中与会员相关的字段（memberFlag/memberStatus 为 '1' 表示已开通且生效，memberDate 为到期时间） */
interface MemberLikeUserInfo {
  memberFlag?: unknown
  memberStatus?: unknown
  memberDate?: unknown
}

export const isRoundtableMember = (userInfo: MemberLikeUserInfo | null | undefined): boolean => {
  if (!userInfo) return false
  if (String(userInfo.memberFlag) !== '1' || String(userInfo.memberStatus) !== '1') return false
  const expireTime = userInfo.memberDate ? new Date(String(userInfo.memberDate)).getTime() : NaN
  return Number.isNaN(expireTime) || expireTime > Date.now()
}

export const getRoundtableMaxModels = (hasMembership: boolean): number =>
  hasMembership ? ROUNDTABLE_MAX_MODELS_MEMBER : ROUNDTABLE_MAX_MODELS_FREE

export const canSendRoundtableMessage = (models: Model[]): boolean => models.length >= 2
