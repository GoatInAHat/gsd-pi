/**
 * Ambient type shim: the installed openclaw package exports the runtime
 * module ./plugin-sdk/control-ui but its exports map lacks the types
 * condition, so tsc cannot find declarations. Shape verified against the
 * installed dist/plugin-sdk/control-ui.d.ts and control-ui.ts:198-269.
 */
declare module "openclaw/plugin-sdk/control-ui" {
  export interface ControlUiPluginHost {
    ui: {
      registerPage(page: {
        id: string
        label: string
        mount: (
          container: unknown,
          context: { signal: AbortSignal },
        ) => { dispose?: () => void } | void
      }): void
      registerNavigation?(item: { id: string; label: string; page: { id: string } }): void
    }
    request?(method: string, params: unknown): Promise<unknown>
    onEvent?(eventName: string, handler: (event: unknown) => void): () => void
  }
  export function defineControlUiPlugin(plugin: {
    id: string
    activate: (host: ControlUiPluginHost) => void
  }): unknown
}
