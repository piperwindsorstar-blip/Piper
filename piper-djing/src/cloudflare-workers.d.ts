declare module 'cloudflare:workers' {
  interface SqlCursor {
    toArray: () => Record<string, unknown>[]
  }
  interface DurableObjectState {
    storage: {
      sql: {
        exec: (query: string, ...bindings: unknown[]) => SqlCursor
      }
    }
  }
  export abstract class DurableObject<E = unknown> {
    ctx: DurableObjectState
    env: E
    constructor(ctx: DurableObjectState, env: E)
  }
}
