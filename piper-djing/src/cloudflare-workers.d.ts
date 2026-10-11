declare module 'cloudflare:sockets' {
  export type Socket = {
    readable: ReadableStream<Uint8Array>
    writable: WritableStream<Uint8Array>
    startTls: () => Socket
  }
  export function connect(
    address: { hostname: string; port: number },
    options?: {
      secureTransport?: 'off' | 'on' | 'starttls'
      allowHalfOpen?: boolean
    },
  ): Socket
}

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
