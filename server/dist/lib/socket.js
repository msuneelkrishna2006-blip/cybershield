"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocket = initSocket;
exports.broadcastAlert = broadcastAlert;
const socket_io_1 = require("socket.io");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
let io = null;
function initSocket(server) {
    io = new socket_io_1.Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });
    io.on('connection', (socket) => {
        console.log(`Socket client connected: ${socket.id}`);
        // Join family channel for real-time alerts
        socket.on('join-family', (familyId) => {
            socket.join(`family_${familyId}`);
            console.log(`Client ${socket.id} joined room family_${familyId}`);
        });
        // Listen for live location updates from family members
        socket.on('location-update', async (data) => {
            const { memberId, lat, lng, familyId } = data;
            try {
                // Broadcast location update to other family members
                socket.to(`family_${familyId}`).emit('family-location-changed', {
                    memberId,
                    lat,
                    lng,
                    updatedAt: new Date()
                });
            }
            catch (err) {
                console.error('Error broadcasting location update:', err);
            }
        });
        socket.on('disconnect', () => {
            console.log(`Socket client disconnected: ${socket.id}`);
        });
    });
    return io;
}
function broadcastAlert(familyId, alert) {
    if (io) {
        io.to(`family_${familyId}`).emit('new-alert', alert);
        console.log(`Broadcasted new alert to room family_${familyId}: ${alert.title}`);
    }
}
