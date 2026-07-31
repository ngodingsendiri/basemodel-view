/**
 * Central error reporting hook. Currently logs to the console but exists as a
 * single integration point for external error tracking (Sentry, LogRocket, ...).
 */
export function reportError(error: unknown, context?: string): void {
  if (error instanceof Error) {
    console.error(`[BaseModel] ${context ?? 'Application error'}:`, error);
  } else {
    console.error(`[BaseModel] ${context ?? 'Application error'}:`, error);
  }
}
