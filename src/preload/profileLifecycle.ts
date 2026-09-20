export interface ProfileRendererReadyResult {
  started: boolean
}

export function createProfileRendererReadyNotifier(
  isTrustedAppRenderer: boolean,
  invoke: () => Promise<ProfileRendererReadyResult>
): () => Promise<ProfileRendererReadyResult> {
  if (!isTrustedAppRenderer) {
    return async () => ({ started: false })
  }
  return invoke
}
