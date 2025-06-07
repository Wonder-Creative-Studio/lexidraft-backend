import APIError from '~/utils/apiError';
import httpStatus from 'http-status';
import axios from 'axios'; // You'll need to add axios to your dependencies
import jwt from 'jsonwebtoken'; // Use standard JWT library
import { v4 as uuidv4 } from 'uuid';

class ZoomService {
	constructor() {
		this.apiKey = process.env.ZOOM_API_KEY;
		this.apiSecret = process.env.ZOOM_API_SECRET;
		this.baseUrl = 'https://api.zoom.us/v2';
	}

	generateJWT() {
		const payload = {
			iss: this.apiKey,
			exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour expiry
		};
		return jwt.sign(payload, this.apiSecret);
	}

	async createMeeting(consultation) {
		try {
			const token = this.generateJWT();
			const response = await axios.post(
				`${this.baseUrl}/users/me/meetings`,
				{
					topic: `Consultation ${consultation._id || 'New'}`,
					type: 1, // Instant meeting
					duration: consultation.duration,
					start_time: consultation.scheduledAt,
					timezone: 'UTC',
					settings: {
						host_video: true,
						participant_video: true,
						join_before_host: true,
						waiting_room: false
					}
				},
				{
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json'
					}
				}
			);

			return {
				meetingId: response.data.id,
				meetingLink: response.data.join_url,
				password: response.data.password,
				type: consultation.type,
				scheduledAt: consultation.scheduledAt,
				duration: consultation.duration
			};
		} catch (error) {
			throw new APIError(
				'Error creating Zoom meeting: ' + (error.response?.data?.message || error.message, httpStatus.INTERNAL_SERVER_ERROR)
			);
		}
	}

	async joinMeeting(meetingId, userId, userName) {
		try {
			// For joining a meeting, you typically generate a join URL with the meeting ID
			// The actual joining happens on the client side using the Zoom Web SDK
			return {
				meetingId,
				joinUrl: `https://zoom.us/j/${meetingId}`,
				userName
			};
		} catch (error) {
			throw new APIError('Error joining Zoom meeting: ' + error.message, httpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	async endMeeting(meetingId) {
		try {
			const token = this.generateJWT();
			await axios.put(
				`${this.baseUrl}/meetings/${meetingId}/status`,
				{ action: 'end' },
				{
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json'
					}
				}
			);

			return {
				meetingId,
				endedAt: new Date()
			};
		} catch (error) {
			throw new APIError(
				'Error ending Zoom meeting: ' + (error.response?.data?.message || error.message, httpStatus.INTERNAL_SERVER_ERROR)
			);
		}
	}

	async getMeetingStatus(meetingId) {
		try {
			const token = this.generateJWT();
			const response = await axios.get(`${this.baseUrl}/meetings/${meetingId}`, {
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json'
				}
			});

			return {
				meetingId,
				status: response.data.status,
				startTime: response.data.start_time,
				duration: response.data.duration
			};
		} catch (error) {
			throw new APIError(
				'Error getting Zoom meeting status: ' + (error.response?.data?.message || error.message),
				httpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}
}

export default new ZoomService();
