"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = authenticateToken;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const prisma = new client_1.PrismaClient();
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || 'cybershield-jwt-secret-key-9988';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'cybershield-jwt-refresh-secret-key-2211';
// Helper to hash passwords consistently using Node's native crypto module
function hashPassword(password) {
    return crypto_1.default.pbkdf2Sync(password, 'cybershield-salt', 1000, 64, 'sha512').toString('hex');
}
// Zod validation schemas
const signupSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    phone: zod_1.z.string().optional()
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6)
});
// Authentication Middleware
async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        // Fetch active family membership details for the user
        const membership = await prisma.familyMember.findFirst({
            where: { userId: decoded.id }
        });
        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: membership?.role,
            familyId: membership?.familyId,
            memberId: membership?.id
        };
        next();
    }
    catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
}
// ── Signup Endpoint ──
router.post('/signup', async (req, res) => {
    try {
        const body = signupSchema.parse(req.body);
        const existing = await prisma.user.findUnique({
            where: { email: body.email }
        });
        if (existing) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        const passwordHash = hashPassword(body.password);
        // Run within a transaction to maintain integrity
        const user = await prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
                data: {
                    email: body.email,
                    passwordHash,
                    profile: {
                        create: {
                            name: body.name,
                            phone: body.phone,
                            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${body.name}`
                        }
                    }
                }
            });
            // Create a default family for this new guardian
            const newFamily = await tx.family.create({
                data: {
                    name: `${body.name}'s Family`,
                    ownerId: newUser.id
                }
            });
            // Add user as the guardian/owner of their family
            await tx.familyMember.create({
                data: {
                    userId: newUser.id,
                    familyId: newFamily.id,
                    role: client_1.Role.guardian,
                    relation: 'Self'
                }
            });
            return newUser;
        });
        return res.status(201).json({ message: 'User registered successfully', userId: user.id });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: err.errors });
        }
        console.error('Signup error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// ── Login Endpoint ──
router.post('/login', async (req, res) => {
    try {
        const { email, password } = loginSchema.parse(req.body);
        const user = await prisma.user.findUnique({
            where: { email },
            include: { profile: true }
        });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const hash = hashPassword(password);
        if (user.passwordHash !== hash) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const membership = await prisma.familyMember.findFirst({
            where: { userId: user.id }
        });
        // Generate JWT access & refresh tokens
        const accessToken = jsonwebtoken_1.default.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
        const refreshToken = jsonwebtoken_1.default.sign({ id: user.id, email: user.email }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
        // Log the successful login audit event
        await prisma.auditLog.create({
            data: {
                userId: user.id,
                action: 'user_login',
                details: 'User authenticated successfully',
                ipAddress: req.ip
            }
        });
        return res.status(200).json({
            user: {
                id: user.id,
                name: user.profile?.name,
                email: user.email,
                phone: user.profile?.phone,
                avatar: user.profile?.avatar,
                role: membership?.role,
                familyId: membership?.familyId,
                memberId: membership?.id,
                safetyScore: user.profile?.safetyScore
            },
            accessToken,
            refreshToken
        });
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: err.errors });
        }
        console.error('Login error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// ── Refresh Token Endpoint ──
router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token required' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(refreshToken, JWT_REFRESH_SECRET);
        const user = await prisma.user.findUnique({
            where: { id: decoded.id }
        });
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }
        const accessToken = jsonwebtoken_1.default.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
        return res.status(200).json({ accessToken });
    }
    catch (err) {
        return res.status(403).json({ error: 'Invalid or expired refresh token' });
    }
});
exports.default = router;
