/**
 * Replaces placeholders in text with provided dictionary values.
 * Does not replace placeholders if no match is found in the dictionary.
 * Does not contain any hardcoded placeholders.
 */
export function simulatePlaceholders(text: string, placeholders?: Record<string, string>): string {
  if (!text || !text.includes('%') || !placeholders || Object.keys(placeholders).length === 0) {
    return text
  }
  return text.replace(/%[a-zA-Z0-9_]+%/g, (match) => {
    return placeholders[match] ?? match
  })
}
/** Formats a component parameter placeholder, e.g. `${id}` */
export function paramPlaceholder(name: string): string {
  return '${' + name + '}'
}
