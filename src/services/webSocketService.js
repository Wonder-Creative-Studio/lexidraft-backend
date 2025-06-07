import { Server } from 'socket.io';
import http from 'http';
import webRTCLogger from '~/utils/webRTCLogger';

class WebSocketService {
	constructor(server) {
		this.io = new Server(server, {
			cors: {
				origin: process.env.CLIENT_URL,
				methods: ['GET', 'POST']
			}
		});

		this.rooms = new Map();
		this.setupSocketHandlers();
	}

	setupSocketHandlers() {
		this.io.on('connection', (socket) => {
			console.log('New client connected:', socket.id);
			webRTCLogger.logConnectionState(socket.id, 'Connected');

			socket.on('join-room', (roomId, userId) => {
				webRTCLogger.logRoomEvent(roomId, 'User Joined', { userId, socketId: socket.id });
				socket.join(roomId);
				socket.to(roomId).emit('user-connected', userId);

				if (!this.rooms.has(roomId)) {
					this.rooms.set(roomId, new Set());
				}
				this.rooms.get(roomId).add(userId);

				socket.on('disconnect', () => {
					this.rooms.get(roomId)?.delete(userId);
					socket.to(roomId).emit('user-disconnected', userId);
					webRTCLogger.logConnectionState(socket.id, 'Disconnected');
				});
			});

			// Handle WebRTC signaling
			socket.on('offer', (offer, roomId, userId) => {
				webRTCLogger.logRoomEvent(roomId, 'Offer Received', { 
					from: userId,
					type: offer.type
				});
				socket.to(roomId).emit('offer', offer, userId);
			});

			socket.on('answer', (answer, roomId, userId) => {
				webRTCLogger.logRoomEvent(roomId, 'Answer Received', {
					from: userId,
					type: answer.type
				});
				socket.to(roomId).emit('answer', answer, userId);
			});

			socket.on('ice-candidate', (candidate, roomId, userId) => {
				webRTCLogger.logICECandidate(userId, candidate);
				socket.to(roomId).emit('ice-candidate', candidate, userId);
			});

			// Handle chat messages
			socket.on('chat-message', (message, roomId, userId) => {
				socket.to(roomId).emit('chat-message', message, userId);
			});
		});
	}

	getRoomParticipants(roomId) {
		return Array.from(this.rooms.get(roomId) || []);
	}
}

export default WebSocketService;
