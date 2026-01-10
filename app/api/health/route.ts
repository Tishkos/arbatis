import { NextResponse } from 'next/server'

/**
 * Health check endpoint
 * Used by Docker healthcheck
 * Simple endpoint that doesn't require database connection (for faster checks)
 */
export async function GET() {
  try {
    // Simple health check - just return OK
    // For full health check including DB, use /api/health/db
    return NextResponse.json({ 
      status: 'healthy',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    )
  }
}

