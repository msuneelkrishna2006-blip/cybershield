export async function waitForMinimumResponseTime(startedAt: number, minimumMs = 750): Promise<void> {
  const remaining = minimumMs - (Date.now() - startedAt);
  if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
}
