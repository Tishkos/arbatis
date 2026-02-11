/**
 * For uploads (products, attachments, profiles, uploads), use the dynamic serve API
 * so that new images show without restarting the app (e.g. on VPS/Docker).
 */
const SERVED_PREFIXES = ['/products/', '/attachments/', '/profiles/', '/uploads/']

export function getServeUrl(path: string | null | undefined): string | undefined {
  if (!path || typeof path !== 'string') return undefined
  const normalized = path.startsWith('/') ? path : `/${path}`
  const useServe =
    SERVED_PREFIXES.some((p) => normalized.startsWith(p)) ||
    (normalized.startsWith('/') && (normalized.includes('products/') || normalized.includes('attachments/') || normalized.includes('profiles/') || normalized.includes('uploads/')))
  return useServe ? `/api/serve${normalized}` : normalized
}
