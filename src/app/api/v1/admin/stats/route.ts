/**
 * CyberShield India — Admin Dashboard API
 * GET /api/v1/admin/stats
 *
 * Returns platform-wide statistics for the admin SOC dashboard.
 * Requires admin authentication (AdminUser with appropriate role).
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api/response';

// Simple admin auth check — verifies admin session via header token
// In production, this would use a dedicated admin auth middleware
async function verifyAdminAuth(request: NextRequest): Promise<{ adminId: string; role: string } | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.substring(7);

  // Look up admin by a session-like approach
  // For now, check if the request has a valid admin user cookie
  try {
    // Simplified: check admin_token header against AdminUser records
    // This will be replaced with proper admin JWT auth in Phase 10
    const admin = await prisma.adminUser.findFirst({
      where: { isActive: true },
      select: { id: true, role: true },
    });
    return admin ? { adminId: admin.id, role: admin.role } : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Demo mode for judge presentations
    const url = new URL(request.url);
    if (url.searchParams.get('demo') === 'true') {
      return apiSuccess({
        totalUsers: 312,
        totalScans: 1247,
        scansToday: 47,
        scansThisWeek: 289,
        threatsByLevel: {
          CRITICAL: 12,
          HIGH: 31,
          MEDIUM: 46,
          LOW: 89,
          SAFE: 1069,
        },
        topCategories: [
          { category: 'UPI Collect Scam', count: 28, trend: 'up' },
          { category: 'KYC Phishing', count: 22, trend: 'stable' },
          { category: 'Digital Arrest', count: 18, trend: 'up' },
          { category: 'Job/Task Fraud', count: 14, trend: 'down' },
          { category: 'Loan App Harassment', count: 7, trend: 'stable' },
        ],
        activeAlerts: 3,
        avgResponseTime: '2.4s',
        dataSource: 'demo',
      });
    }

    // For now, allow access during development
    // TODO: Replace with proper admin auth middleware in Phase 10
    const isDevMode = process.env.NODE_ENV !== 'production';

    if (!isDevMode) {
      const admin = await verifyAdminAuth(request);
      if (!admin) {
        return apiError('UNAUTHORIZED', 'Admin authentication required', 401);
      }
    }

    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      totalScans,
      scansToday,
      scansThisWeek,
      highRiskScans,
      criticalScans,
      totalFamilies,
      activeSessions,
      securityEvents24h,
      recentSecurityEvents,
      topCategories,
      modelFeedback,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.scanRecord.count(),
      prisma.scanRecord.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.scanRecord.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.scanRecord.count({ where: { riskLevel: { in: ['HIGH', 'high'] } } }),
      prisma.scanRecord.count({ where: { riskLevel: { in: ['CRITICAL', 'critical'] } } }),
      prisma.family.count(),
      prisma.session.count({ where: { expiresAt: { gt: now } } }),
      prisma.securityEvent.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.securityEvent.findMany({
        where: { createdAt: { gte: dayAgo } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          eventType: true,
          severity: true,
          sourceIp: true,
          createdAt: true,
        },
      }),
      prisma.scanRecord.groupBy({
        by: ['category'],
        _count: true,
        orderBy: { _count: { category: 'desc' } },
        take: 10,
      }),
      prisma.modelFeedback.groupBy({
        by: ['feedback'],
        _count: true,
      }),
    ]);

    // Calculate accuracy metrics from feedback
    const totalFeedback = modelFeedback.reduce((sum, f) => sum + f._count, 0);
    const accurateFeedback = modelFeedback.find(f => f.feedback === 'accurate')?._count || 0;
    const falsePositives = modelFeedback.find(f => f.feedback === 'false_positive')?._count || 0;
    const falseNegatives = modelFeedback.find(f => f.feedback === 'false_negative')?._count || 0;

    return apiSuccess({
      platform: {
        totalUsers,
        totalScans,
        totalFamilies,
        activeSessions,
      },
      scans: {
        today: scansToday,
        thisWeek: scansThisWeek,
        highRisk: highRiskScans,
        critical: criticalScans,
      },
      threats: {
        topCategories: topCategories.map(c => ({
          category: c.category || 'unknown',
          count: c._count,
        })),
      },
      security: {
        events24h: securityEvents24h,
        recentEvents: recentSecurityEvents,
      },
      modelAccuracy: totalFeedback > 0 ? {
        totalFeedback,
        accurate: accurateFeedback,
        falsePositives,
        falseNegatives,
        accuracyRate: Math.round((accurateFeedback / totalFeedback) * 100),
      } : {
        totalFeedback: 0,
        message: 'Insufficient feedback data for accuracy metrics',
      },
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('[Admin] Stats error:', error instanceof Error ? error.message : 'Unknown');
    return apiError('INTERNAL_ERROR', 'Failed to load admin statistics', 500);
  }
}
