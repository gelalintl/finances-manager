export type SearchParams = Record<string, string | string[] | undefined>

export function pick(params: SearchParams, key: string) {
  const value = params[key]
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}
