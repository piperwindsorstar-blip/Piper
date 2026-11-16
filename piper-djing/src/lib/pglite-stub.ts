export class PGlite {
  async exec(): Promise<void> {
    throw new Error('The local book is not used on Cloudflare.')
  }

  async query(): Promise<{ rows: never[] }> {
    throw new Error('The local book is not used on Cloudflare.')
  }
}
