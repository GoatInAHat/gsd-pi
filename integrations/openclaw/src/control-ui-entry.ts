/**
 * Loader entry for the GSD embedded Control UI wrapper.
 *
 * The native loader matches the default export's plugin id for
 * open-gsd-openclaw and injects host.request / host.onEvent at activation;
 * this module bridges the deferred host into the pure wrapper factory.
 */

import { defineControlUiPlugin } from "openclaw/plugin-sdk/control-ui"
import { createGsdEmbedPlugin, EMBED_ALLOWED_OPERATIONS, type EmbedHost } from "./control-ui-embed.js"

let hostRef: EmbedHost | undefined

const request = (method: string, params: unknown): Promise<unknown> => {
  if (hostRef?.request) return hostRef.request(method, params)
  return Promise.reject(new Error("Control UI host request unavailable before activation"))
}

const onEvent = (eventName: string, handler: (event: unknown) => void): (() => void) => {
  if (hostRef?.onEvent) return hostRef.onEvent(eventName, handler)
  return () => {}
}

export default createGsdEmbedPlugin({
  frameSrc: "/plugins/open-gsd-openclaw/web/?__gsd_embedded=1",
  request,
  allowedOperations: EMBED_ALLOWED_OPERATIONS,
  onEvent,
  definePlugin: (plugin) =>
    defineControlUiPlugin({
      id: plugin.id,
      activate: (host) => {
        hostRef = host
        plugin.activate(host)
      },
    }) as unknown as ReturnType<typeof createGsdEmbedPlugin>,
})
