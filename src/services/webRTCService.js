import APIError from '../utils/apiError';
import { v4 as uuidv4 } from 'uuid';
import webRTCLogger from '../utils/webRTCLogger';

class WebRTCService {
	constructor() {
		this.activeConsultations = new Map();
	}

	async createConsultation(lawyerId, clientId) {
		const roomId = uuidv4();
		webRTCLogger.logRoomEvent(roomId, 'Consultation Created', {
			lawyerId,
			clientId,
			timestamp: new Date()
		});
		const consultation = {
			id: roomId,
			lawyerId,
			clientId,
			startTime: new Date(),
			status: 'active',
			participants: [lawyerId, clientId]
		};

		this.activeConsultations.set(roomId, consultation);
		return consultation;
	}

	async joinConsultation(roomId, userId) {
		webRTCLogger.logRoomEvent(roomId, 'Join Attempt', { userId });
		const consultation = this.activeConsultations.get(roomId);

		if (!consultation) {
			throw new APIError('Consultation not found', 404);
		}

		if (!consultation.participants.includes(userId)) {
			throw new APIError('Unauthorized to join this consultation', 403);
		}

		return consultation;
	}

	async endConsultation(roomId) {
		webRTCLogger.logRoomEvent(roomId, 'Consultation Ended', {
			timestamp: new Date()
		});
		const consultation = this.activeConsultations.get(roomId);

		if (!consultation) {
			throw new APIError('Consultation not found', 404);
		}

		consultation.status = 'ended';
		consultation.endTime = new Date();
		this.activeConsultations.delete(roomId);

		return consultation;
	}
}

export default new WebRTCService();
