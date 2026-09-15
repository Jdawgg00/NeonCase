import { redis } from '~~/server/utils/redis'
import { MARKET_EVENTS_CHANNEL } from '~~/server/utils/market-events'

/**
 * One Redis subscriber connection per WebSocket peer (ioredis requires a
 * dedicated connection once you call `.subscribe`, since it can no longer
 * run normal commands). Cleaned up on close so connections don't leak.
 */
export default defineWebSocketHandler({
  async open(peer) {
    const subscriber = redis.duplicate()
    // Stash on the peer's context so `close` can find and tear it down.
    ;(peer as unknown as { context: { subscriber: typeof subscriber } }).context.subscriber = subscriber

    await subscriber.subscribe(MARKET_EVENTS_CHANNEL)
    subscriber.on('message', (_channel, message) => {
      peer.send(message)
    })
  },

  close(peer) {
    const subscriber = (peer as unknown as { context?: { subscriber?: { disconnect: () => void } } }).context?.subscriber
    subscriber?.disconnect()
  },
})
