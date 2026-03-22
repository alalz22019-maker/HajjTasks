/**
 * Filters `incoming` tasks to only those whose title doesn't already exist in `existing`.
 * Comparison is case-insensitive and trims whitespace.
 */
export function deduplicateTasks(incoming, existing) {
  const titles = new Set(existing.map(t => t.title.trim().toLowerCase()))
  return incoming.filter(t => !titles.has(t.title.trim().toLowerCase()))
}

/**
 * Returns true if a task with the same title exists in the list.
 */
export function isDuplicateTask(title, existing) {
  const norm = title.trim().toLowerCase()
  return existing.some(t => t.title.trim().toLowerCase() === norm)
}
