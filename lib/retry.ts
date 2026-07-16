type SupabaseResult<T> = PromiseLike<{ data?: T; error: { message: string } | null }>

/**
 * Retry a Supabase query/RPC that returns { error }.
 * Pass a thunk: () => supabase.from(...).insert(...) etc.
 * Automatically retries up to `attempts` times with exponential backoff.
 * Throws an Error with the Supabase message if all attempts fail.
 */
export async function retrySupabase<T>(
  fn: () => SupabaseResult<T>,
  attempts = 3,
  baseDelayMs = 300,
): Promise<T | undefined> {
  let lastMessage = 'Unknown error'
  for (let i = 0; i < attempts; i++) {
    const { data, error } = await fn()
    if (!error) return data
    lastMessage = error.message
    if (i < attempts - 1) {
      await new Promise(r => setTimeout(r, baseDelayMs * 2 ** i))
    }
  }
  throw new Error(lastMessage)
}
