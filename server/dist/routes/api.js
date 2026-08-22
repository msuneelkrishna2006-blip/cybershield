"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("./auth");
const socket_1 = require("../lib/socket");
const agents_1 = require("../lib/agents");
const zod_1 = require("zod");
const prisma = new client_1.PrismaClient();
const router = (0, express_1.Router)();
// Apply authentication middleware to all endpoints
router.use(auth_1.authenticateToken);
// ── 1. Security Scans Endpoints ──
router.get('/scans', async (req, res) => {
    try {
        const scans = await prisma.scanRecord.findMany({
            where: { memberId: req.user?.memberId },
            orderBy: { createdAt: 'desc' }
        });
        return res.status(200).json(scans);
    }
    catch (err) {
        console.error('Fetch scans error:', err);
        return res.status(500).json({ error: 'Failed to fetch scans' });
    }
});
router.post('/scans', async (req, res) => {
    try {
        const { type, input } = zod_1.z.object({
            type: zod_1.z.string(), // "sms", "link", "qr", etc.
            input: zod_1.z.string().min(1)
        }).parse(req.body);
        if (!req.user?.memberId) {
            return res.status(400).json({ error: 'User membership not found' });
        }
        // Call Multi-Agent Collaborative Analysis
        const analysis = await (0, agents_1.analyzeThreatCollaborative)(input, type);
        // Save record to DB
        const scan = await prisma.scanRecord.create({
            data: {
                memberId: req.user.memberId,
                type,
                input,
                riskScore: analysis.riskScore,
                riskLevel: analysis.riskLevel,
                category: analysis.category,
                summary: analysis.summary,
                recommendations: analysis.recommendations,
                agentResults: analysis.agentResults
            }
        });
        // If critical alert is generated, save and broadcast to family immediately
        if (analysis.riskLevel === client_1.RiskLevel.critical || analysis.riskLevel === client_1.RiskLevel.high) {
            const alert = await prisma.alert.create({
                data: {
                    familyId: req.user.familyId,
                    memberId: req.user.memberId,
                    type: 'scam',
                    severity: analysis.riskLevel.toLowerCase(),
                    title: `Scam Threat Detected (${req.user.email})`,
                    description: `A critical scan on ${type} flagged a potential scam: ${analysis.summary}`
                }
            });
            (0, socket_1.broadcastAlert)(req.user.familyId, alert);
        }
        return res.status(201).json(scan);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: err.errors });
        }
        console.error('Scan execution error:', err);
        return res.status(500).json({ error: 'Scan processing failed' });
    }
});
// ── 2. Alerts Center Endpoints ──
router.get('/alerts', async (req, res) => {
    try {
        const alerts = await prisma.alert.findMany({
            where: { familyId: req.user?.familyId },
            orderBy: { createdAt: 'desc' }
        });
        return res.status(200).json(alerts);
    }
    catch (err) {
        console.error('Fetch alerts error:', err);
        return res.status(500).json({ error: 'Failed to fetch alerts' });
    }
});
router.put('/alerts/:id/read', async (req, res) => {
    try {
        const alert = await prisma.alert.update({
            where: { id: req.params.id },
            data: { read: true }
        });
        return res.status(200).json(alert);
    }
    catch (err) {
        console.error('Mark alert read error:', err);
        return res.status(500).json({ error: 'Failed to mark alert as read' });
    }
});
router.post('/alerts/sos', async (req, res) => {
    try {
        const { lat, lng } = zod_1.z.object({
            lat: zod_1.z.number(),
            lng: zod_1.z.number()
        }).parse(req.body);
        if (!req.user?.familyId || !req.user?.memberId) {
            return res.status(400).json({ error: 'Invalid user details' });
        }
        // Insert critical emergency SOS event to database
        const alert = await prisma.alert.create({
            data: {
                familyId: req.user.familyId,
                memberId: req.user.memberId,
                type: 'emergency_sos',
                severity: 'critical',
                title: `🚨 CRITICAL SOS Triggered by ${req.user.email}`,
                description: `SOS activated! Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}. Emergency help dispatched.`
            }
        });
        // Create a live LocationShare entry
        await prisma.locationShare.create({
            data: {
                memberId: req.user.memberId,
                lat,
                lng,
                sharedWith: [],
                isActive: true,
                expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000) // 1 Hour active
            }
        });
        // Broadcast instant push-like alert to family via websockets
        (0, socket_1.broadcastAlert)(req.user.familyId, alert);
        return res.status(201).json(alert);
    }
    catch (err) {
        console.error('SOS trigger error:', err);
        return res.status(500).json({ error: 'Failed to trigger SOS' });
    }
});
// ── 3. Family Management Endpoints ──
router.get('/family/members', async (req, res) => {
    try {
        const members = await prisma.familyMember.findMany({
            where: { familyId: req.user?.familyId },
            include: {
                user: {
                    select: {
                        email: true,
                        profile: true
                    }
                }
            }
        });
        return res.status(200).json(members);
    }
    catch (err) {
        console.error('Fetch family members error:', err);
        return res.status(500).json({ error: 'Failed to fetch family members' });
    }
});
router.post('/family/invite', async (req, res) => {
    try {
        const { email, role, relation } = zod_1.z.object({
            email: zod_1.z.string().email(),
            role: zod_1.z.enum(['guardian', 'parent', 'child', 'elderly']),
            relation: zod_1.z.string()
        }).parse(req.body);
        if (!req.user?.familyId) {
            return res.status(400).json({ error: 'Family structure not initialized' });
        }
        // Try to find if user exists
        const userToInvite = await prisma.user.findUnique({
            where: { email }
        });
        if (!userToInvite) {
            return res.status(404).json({ error: 'User email not registered. Invite them to signup first.' });
        }
        const member = await prisma.familyMember.create({
            data: {
                userId: userToInvite.id,
                familyId: req.user.familyId,
                role: role,
                relation
            }
        });
        return res.status(201).json(member);
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: err.errors });
        }
        console.error('Invite family member error:', err);
        return res.status(500).json({ error: 'Failed to invite family member' });
    }
});
// ── 4. Women Safety Journey Sharing ──
router.post('/women-safety/journey', async (req, res) => {
    try {
        const { lat, lng, destination, expectedArrival } = zod_1.z.object({
            lat: zod_1.z.number(),
            lng: zod_1.z.number(),
            destination: zod_1.z.string().optional(),
            expectedArrival: zod_1.z.string().optional()
        }).parse(req.body);
        const location = await prisma.locationShare.create({
            data: {
                memberId: req.user?.memberId,
                lat,
                lng,
                isActive: true,
                journeyDestination: destination,
                expectedArrival,
                expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000) // 4 hours
            }
        });
        return res.status(201).json(location);
    }
    catch (err) {
        console.error('Journey share trigger error:', err);
        return res.status(500).json({ error: 'Failed to trigger journey sharing' });
    }
});
// ── 5. Child Safety Rules Management ──
router.get('/child-safety/profiles', async (req, res) => {
    try {
        const profiles = await prisma.childProfile.findMany({
            where: {
                member: { familyId: req.user?.familyId }
            }
        });
        return res.status(200).json(profiles);
    }
    catch (err) {
        console.error('Fetch child safety profiles error:', err);
        return res.status(500).json({ error: 'Failed to fetch child safety profiles' });
    }
});
router.put('/child-safety/profiles/:id', async (req, res) => {
    try {
        const { dailyLimitMinutes, blockedCategories } = zod_1.z.object({
            dailyLimitMinutes: zod_1.z.number().min(0),
            blockedCategories: zod_1.z.array(zod_1.z.string())
        }).parse(req.body);
        const profile = await prisma.childProfile.update({
            where: { id: req.params.id },
            data: {
                dailyLimitMinutes,
                blockedCategories
            }
        });
        return res.status(200).json(profile);
    }
    catch (err) {
        console.error('Update child rules error:', err);
        return res.status(500).json({ error: 'Failed to update child rules' });
    }
});
exports.default = router;
