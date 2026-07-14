const activePromises = new Map<string, Promise<any>>();

/**
 * Coalesces concurrent calls for the same key within the same server process.
 * If a request for the key is already in flight, later calls will share the same promise.
 */
export async function singleFlight<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
  const existing = activePromises.get(key);
  if (existing) {
    console.log(`[Single-Flight Coalesce] Reusing in-flight request for key: ${key}`);
    return existing as Promise<T>;
  }

  const promise = fetchFn().finally(() => {
    activePromises.delete(key);
  });

  activePromises.set(key, promise);
  return promise;
}
