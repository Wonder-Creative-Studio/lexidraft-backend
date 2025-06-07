import winston from 'winston';

const logger = winston.createLogger({
	format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
	transports: [
		new winston.transports.File({ filename: 'logs/webrtc.log' })
		// Add more transports for production (e.g., CloudWatch, ELK Stack)
	]
});

class WebRTCLogger {
	logConnectionState(peerId, state) {
		logger.info(`WebRTC Connection State [Peer: ${peerId}]: ${state}`);
	}

	logICECandidate(peerId, candidate) {
		logger.debug(`ICE Candidate [Peer: ${peerId}]:`, {
			candidate: candidate
				? {
						type: candidate.type,
						protocol: candidate.protocol,
						address: candidate.address,
						port: candidate.port
				  }
				: 'null'
		});
	}

	logSignalingState(peerId, state) {
		logger.info(`Signaling State [Peer: ${peerId}]: ${state}`);
	}

	logICEGatheringState(peerId, state) {
		logger.info(`ICE Gathering State [Peer: ${peerId}]: ${state}`);
	}

	logICEConnectionState(peerId, state) {
		logger.info(`ICE Connection State [Peer: ${peerId}]: ${state}`);
	}

	logError(peerId, error) {
		logger.error(`WebRTC Error [Peer: ${peerId}]:`, error);
	}

	logRoomEvent(roomId, event, data) {
		logger.info(`Room Event [${roomId}] ${event}:`, data);
	}
}

export default new WebRTCLogger();
