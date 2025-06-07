import webRTCService from '../services/webRTCService';
import catchAsync from '../utils/catchAsync';
import httpStatus from 'http-status';

export const startConsultation = catchAsync(async (req, res) => {
	const { lawyerId } = req.params;
	const clientId = req.user.id;

	const consultation = await webRTCService.createConsultation(lawyerId, clientId);
	res.status(httpStatus.CREATED).json(consultation);
});

export const joinConsultation = catchAsync(async (req, res) => {
	const { roomId } = req.params;
	const userId = req.user.id;

	const consultation = await webRTCService.joinConsultation(roomId, userId);
	res.json(consultation);
});

export const endConsultation = catchAsync(async (req, res) => {
	const { roomId } = req.params;
	const consultation = await webRTCService.endConsultation(roomId);
	res.json(consultation);
});
