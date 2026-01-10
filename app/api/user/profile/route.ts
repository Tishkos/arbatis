import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const name = formData.get('name') as string
    const avatarFile = formData.get('avatar') as File | null

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    // Get current user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    let avatarUrl = user.image || null

    // Handle avatar upload
    if (avatarFile) {
      // Validate file type (only PNG and JPG)
      const fileExtension = avatarFile.name.split('.').pop()?.toLowerCase() || ''
      const allowedExtensions = ['png', 'jpg', 'jpeg']
      if (!allowedExtensions.includes(fileExtension)) {
        return NextResponse.json(
          { error: 'Only PNG and JPG images are allowed' },
          { status: 400 }
        )
      }

      // Validate file size (max 5MB)
      if (avatarFile.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'Image size must be less than 5MB' },
          { status: 400 }
        )
      }

      const bytes = await avatarFile.arrayBuffer()
      const buffer = Buffer.from(bytes)

      // Create profiles directory if it doesn't exist
      const profilesDir = join(process.cwd(), 'public', 'profiles')
      if (!existsSync(profilesDir)) {
        await mkdir(profilesDir, { recursive: true })
      }

      // Generate filename based on user's name (sanitized)
      // Remove special characters and spaces, convert to lowercase
      const sanitizedName = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
      
      // Use png or jpg extension
      const ext = fileExtension === 'png' ? 'png' : 'jpg'
      const fileName = `${sanitizedName}.${ext}`
      const filePath = join(profilesDir, fileName)

      // Save file (overwrite if exists)
      await writeFile(filePath, buffer)

      // Generate URL
      avatarUrl = `/profiles/${fileName}`
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: name.trim(),
        image: avatarUrl,
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    })

    return NextResponse.json({
      success: true,
      user: {
        name: updatedUser.name,
        email: updatedUser.email,
        avatar: updatedUser.image || null,
      },
    })
  } catch (error) {
    console.error('Error updating profile:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to update profile'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

