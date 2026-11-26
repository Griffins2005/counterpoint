import { getAuthToken } from 'deepspace'

export async function callAction<T>(
  name: string,
  params: Record<string, unknown>,
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  const token = await getAuthToken()
  if (!token) return { success: false, error: 'Sign in to run an investigation.' }
  let response: Response
  try {
    response = await fetch(`/api/actions/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    })
  } catch {
    return { success: false, error: 'The request did not reach the server.' }
  }
  if (response.status === 401) return { success: false, error: 'Sign in to run an investigation.' }
  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { success: false, error: 'The server returned a response that could not be read.' }
  }
  if (typeof body !== 'object' || body === null || !('success' in body)) {
    return { success: false, error: 'The investigation could not be completed.' }
  }
  const record = body as { success: boolean; data?: T; error?: string }
  if (record.success) return { success: true, data: record.data as T }
  return { success: false, error: record.error || 'The investigation could not be completed.' }
}
