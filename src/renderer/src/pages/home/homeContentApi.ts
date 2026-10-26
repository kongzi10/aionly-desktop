import type { HomeContent } from './homeContent'

/** Replace this adapter when the management service exposes published desktop home content. */
export async function getPublishedHomeContent(): Promise<HomeContent> {
  return { ticker: [], announcements: [], avatarPromotion: null }
}
