import http from '@renderer/utils/request'

import { type HomePushItem, normalizePushList, type PushType } from './homeContent'

export async function getHomePushList(pushType: PushType): Promise<HomePushItem[]> {
  const response: unknown = await http.get(
    '/base/clientPushManage/getList',
    { pushType },
    { cancel: false, loading: false }
  )
  return normalizePushList(response, pushType)
}
