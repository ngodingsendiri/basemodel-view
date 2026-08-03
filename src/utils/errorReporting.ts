/**
 * Central error reporting hook. Currently logs to the console but exists as a
 * single integration point for external error tracking (Sentry, LogRocket, ...).
 */
export function reportError(error: unknown, context?: string): void {
  console.error(`[BaseModel] ${context ?? 'Application error'}:`, error);
}
