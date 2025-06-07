import APIError from '~/utils/apiError';
import httpStatus from 'http-status';
import zoomService from './zoomService';

class MeetingService {
	async createMeeting(consultation) {
		try {
			// Create meeting using Zoom service
			const meeting = await zoomService.createMeeting(consultation);
			return meeting;
		} catch (error) {
			throw new APIError('Error creating meeting: ' + error.message, httpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	async joinMeeting(meetingId, userId, userName) {
		try {
			// Join meeting using Zoom service
			const meetingDetails = await zoomService.joinMeeting(meetingId, userId, userName);
			return meetingDetails;
		} catch (error) {
			throw new APIError('Error joining meeting: ' + error.message, httpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	async endMeeting(meetingId) {
		try {
			// End meeting using Zoom service
			const result = await zoomService.endMeeting(meetingId);
			return result;
		} catch (error) {
			throw new APIError('Error ending meeting: ' + error.message, httpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	async getMeetingStatus(meetingId) {
		try {
			// Get meeting status using Zoom service
			const status = await zoomService.getMeetingStatus(meetingId);
			return status;
		} catch (error) {
			throw new APIError('Error getting meeting status: ' + error.message, httpStatus.INTERNAL_SERVER_ERROR);
		}
	}
}

export default new MeetingService();
