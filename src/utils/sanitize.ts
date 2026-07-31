/**
 * Sanitize HTML entities to prevent XSS.
 * Use for all user-controlled strings rendered as text content.
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, "\"")
    .replace(/'/g, "'");
}

/**
 * Sanitize for use in HTML attributes (href, title, aria-label, etc.)
 */
export function sanitizeAttribute(input: string): string {
  return input
    .replace(/&/g, "&")
    .replace(/"/g, "\"")
    .replace(/'/g, "'")
    .replace(/</g, "<")
    .replace(/>/g, ">");
}

/**
 * Safe model name for display - allows common model naming chars
 * Blocks HTML/script injection
 */
export function sanitizeModelName(input: string): string {
  return sanitizeText(input);
}

/**
 * Safe model ID for display - alphanumeric, slash, dash, dot, underscore
 */
export function sanitizeModelId(input: string): string {
  return sanitizeText(input);
}

/**
 * Safe provider name for display
 */
export function sanitizeProviderName(input: string): string {
  return sanitizeText(input);
}

/**
 * Safe reason text from intelligence alternatives
 */
export function sanitizeReason(input: string): string {
  return sanitizeText(input);
}

/**
 * Safe error message for display
 */
export function sanitizeError(input: string): string {
  return sanitizeText(input);
}
