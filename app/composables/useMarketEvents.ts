import type { MarketEvent } from '~~/server/utils/market-events'

export function useMarketEvents(onEvent: (event: MarketEvent) => void) {
  if (import.meta.server) return

  let socket: WebSocket | null = null

  onMounted(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    socket = new WebSocket(`${protocol}//${window.location.host}/ws/market`)
    socket.addEventListener('message', (event) => {
      try {
        onEvent(JSON.parse(event.data) as MarketEvent)
      } catch {
        // ignore malformed frames
      }
    })
  })

  onBeforeUnmount(() => {
    socket?.close()
  })
}
