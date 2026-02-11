import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

const ALLOWED_DIRS = ['products', 'attachments', 'profiles', 'uploads']

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  try {
    const { path: pathSegments } = await params
    if (!pathSegments?.length) {
      return NextResponse.json({ error: 'Path required' }, { status: 400 })
    }

    const first = pathSegments[0]?.toLowerCase()
    if (!first || !ALLOWED_DIRS.includes(first)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Prevent directory traversal: no '..' or absolute paths
    const safePath = pathSegments.filter((p) => p !== '..' && p !== '').join('/')
    if (!safePath || pathSegments.some((p) => p.includes('..'))) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    const fullPath = join(process.cwd(), 'public', safePath)
    if (!fullPath.startsWith(join(process.cwd(), 'public'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!existsSync(fullPath)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const buffer = await readFile(fullPath)
    const ext = safePath.split('.').pop()?.toLowerCase() ?? ''
    const contentType =
      ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'png'
          ? 'image/png'
          : ext === 'gif'
            ? 'image/gif'
            : ext === 'webp'
              ? 'image/webp'
              : ext === 'svg'
                ? 'image/svg+xml'
                : ext === 'pdf'
                  ? 'application/pdf'
                  : 'application/octet-stream'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, max-age=0, must-revalidate',
        'Content-Length': String(buffer.length),
      },
    })
  } catch (err) {
    console.error('Serve file error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
