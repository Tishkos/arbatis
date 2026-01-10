import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Full health check endpoint including database connectivity
 * Used for detailed health monitoring
 */
export async function GET() {
  try {
    // Test database connectivity
    await prisma.$queryRaw`SELECT 1`
    
    return NextResponse.json({ 
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'unhealthy',
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    )
  }
}

