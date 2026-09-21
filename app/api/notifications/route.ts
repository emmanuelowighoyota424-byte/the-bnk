import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const unreadOnly = request.nextUrl.searchParams.get('unreadOnly') === 'true'
    const notifications = await prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return NextResponse.json({
      notifications,
      unreadCount: notifications.filter((n) => !n.readAt).length,
      total: notifications.length,
    })
  } catch (error) {
    console.error('[BNK] Notifications fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json()
    if (body.markAllAsRead) {
      await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } })
      return NextResponse.json({ message: 'All notifications marked as read' })
    }
    const notificationId = String(body.notificationId || '')
    if (!notificationId) return NextResponse.json({ error: 'notificationId required' }, { status: 400 })
    const updated = await prisma.notification.updateMany({ where: { id: notificationId, userId }, data: { readAt: new Date() } })
    if (updated.count === 0) return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    return NextResponse.json({ message: 'Notification marked as read' })
  } catch (error) {
    console.error('[BNK] Notification update error:', error)
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const notificationId = request.nextUrl.searchParams.get('notificationId')
    if (!notificationId) return NextResponse.json({ error: 'notificationId required' }, { status: 400 })
    const deleted = await prisma.notification.deleteMany({ where: { id: notificationId, userId } })
    if (deleted.count === 0) return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    return NextResponse.json({ message: 'Notification deleted' })
  } catch (error) {
    console.error('[BNK] Notification delete error:', error)
    return NextResponse.json({ error: 'Failed to delete notification' }, { status: 500 })
  }
}
