export function setupHealingHooks(): void {
  // Stub — healing hooks are optional
}

export function wrapStep<T>(fn: () => Promise<T>): () => Promise<T> {
  return fn
}
