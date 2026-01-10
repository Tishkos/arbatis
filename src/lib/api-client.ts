/**
 * API Client with automatic token expiration handling
 * Automatically logs out users when token expires (401/403 errors)
 */

import { signOut } from 'next-auth/react'

/**
 * Enhanced fetch wrapper that handles authentication errors
 * Automatically logs out user on 401/403 responses
 */
export async function apiFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const response = await fetch(url, options)

  // Handle authentication errors
  if (response.status === 401 || response.status === 403) {
    // Token expired or unauthorized - logout user
    console.warn('Authentication failed, logging out user...')
    await signOut({ 
      callbackUrl: '/login',
      redirect: true 
    })
    // Return a rejected promise to stop further execution
    throw new Error('Session expired. Please log in again.')
  }

  return response
}

/**
 * Enhanced fetch with JSON parsing and error handling
 */
export async function apiFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await apiFetch(url, options)
  return response.json()
}

