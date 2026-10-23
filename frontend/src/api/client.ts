export type ApiErrorKind = 'not_found' | 'validation' | 'server' | 'network' | 'invalid_response'

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly kind: ApiErrorKind,
    public readonly status: number | null,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

function detailMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = (body as { detail: unknown }).detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      return detail
        .map((item) => item && typeof item === 'object' && 'msg' in item ? String(item.msg) : String(item))
        .join(', ')
    }
  }
  return fallback
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch (cause) {
    throw new ApiError('백엔드 서버에 연결할 수 없습니다.', 'network', null, cause)
  }

  let body: unknown
  try {
    body = await response.json()
  } catch (cause) {
    throw new ApiError('서버 응답을 JSON으로 해석할 수 없습니다.', 'invalid_response', response.status, cause)
  }

  if (!response.ok) {
    const kind: ApiErrorKind = response.status === 404
      ? 'not_found'
      : response.status === 422
        ? 'validation'
        : 'server'
    throw new ApiError(detailMessage(body, `API 요청 실패 (${response.status})`), kind, response.status, body)
  }
  return body as T
}
