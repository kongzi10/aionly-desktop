import { getIsPayLaterUser } from '@renderer/api/user'
import { useAppSelector } from '@renderer/store'
import { selectToken, selectUserInfo } from '@renderer/store/user'
import { useEffect, useState } from 'react'

// 模块级缓存：同一登录会话内只查询一次，避免其他组件挂载时按钮闪现
let cachedToken: string | null = null
let cachedIsPayLater = false

/**
 * 是否后付用户（后付用户不显示充值入口）
 * 返回 undefined 表示查询中，调用方应等结果确认后再渲染充值按钮，避免闪现后消失
 * 子账户/未登录直接返回 false（本身无充值入口，无需等待）
 */
export function useIsPayLaterUser(): boolean | undefined {
  const token = useAppSelector(selectToken)
  const userInfo: any = useAppSelector(selectUserInfo)
  const [isPayLater, setIsPayLater] = useState<boolean | undefined>(() =>
    token && token === cachedToken ? cachedIsPayLater : undefined
  )

  useEffect(() => {
    if (!token || userInfo?.userSubjectType == '2') {
      setIsPayLater(false)
      return
    }
    // 命中缓存直接使用
    if (token === cachedToken) {
      setIsPayLater(cachedIsPayLater)
      return
    }
    let cancelled = false
    getIsPayLaterUser()
      .then((res: any) => {
        if (cancelled) return
        cachedToken = token
        cachedIsPayLater = !!res?.data
        setIsPayLater(cachedIsPayLater)
      })
      .catch(() => {
        if (cancelled) return
        cachedToken = token
        cachedIsPayLater = false
        setIsPayLater(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, userInfo?.userSubjectType])

  return isPayLater
}
