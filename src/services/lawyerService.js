import Lawyer from '~/models/Lawyer';
import Consultation from '~/models/Consultation';
import APIError from '~/utils/apiError';
import httpStatus from 'http-status';
import meetingService from '~/services/meetingService';
import Contract from '~/models/contract';
import Booking from '~/models/booking';
import Invoice from '~/models/invoice';

class LawyerService {
	async createLawyerProfile(userId, lawyerData) {
		const lawyer = new Lawyer({
			...lawyerData,
			userId
		});
		return await lawyer.save();
	}

	async getLawyerProfile(lawyerId) {
		const lawyer = await Lawyer.findById(lawyerId);

		if (!lawyer) {
			throw new APIError(httpStatus.NOT_FOUND, 'Lawyer not found');
		}
		return lawyer;
	}

	async updateLawyerProfile(lawyerId, updateData) {
		const lawyer = await Lawyer.findByIdAndUpdate(lawyerId, { $set: updateData }, { new: true, runValidators: true });

		if (!lawyer) {
			throw new APIError(httpStatus.NOT_FOUND, 'Lawyer not found');
		}
		return lawyer;
	}

	async searchLawyers(filters = {}) {
		const query = {};

		if (filters.specialization) {
			// Changed from expertise to specialization
			query.specialization = { $in: filters.specialization };
		}

		if (filters.stateOfPractice) {
			query.stateOfPractice = filters.stateOfPractice;
		}

		if (filters.minRating) {
			query['rating.average'] = { $gte: filters.minRating };
		}

		if (filters.isVerified) {
			query.isVerified = true;
		}

		return await Lawyer.find(query).sort({ 'rating.average': -1 });
	}

	async getAvailableSlots(lawyerId, date) {
		if (!date) {
			throw new APIError('Date query parameter is required', httpStatus.BAD_REQUEST);
		}

		const lawyer = await Lawyer.findById(lawyerId);
		if (!lawyer) {
			throw new APIError('Lawyer not found', httpStatus.NOT_FOUND);
		}

		// Get the day of the week for the given date
		const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
		const dayAvailability = lawyer.availability.find((a) => a.day === dayOfWeek);

		if (!dayAvailability) {
			throw new APIError('No availability found for the given date', httpStatus.NOT_FOUND);
		}

		// Define the start and end of the day
		const startOfDay = new Date(date);
		startOfDay.setHours(0, 0, 0, 0);

		const endOfDay = new Date(date);
		endOfDay.setHours(23, 59, 59, 999);

		// Get existing consultations for the given date
		const existingConsultations = await Consultation.find({
			lawyer: lawyerId,
			scheduledAt: { $gte: startOfDay, $lt: endOfDay },
			status: { $in: ['pending', 'confirmed'] }
		});

		// Filter out booked slots
		const bookedSlots = existingConsultations.map((c) => c.slot);
		const availableSlots = dayAvailability.slots.filter(
			(slot) => !bookedSlots.some((booked) => booked.startTime === slot.startTime && booked.endTime === slot.endTime)
		);

		return availableSlots;
	}

	async createConsultation(userId, lawyerId, consultationData) {
		const lawyer = await Lawyer.findById(lawyerId);
		if (!lawyer) {
			throw new APIError('Lawyer not found', httpStatus.NOT_FOUND);
		}

		// Verify slot availability
		const availableSlots = await this.getAvailableSlots(lawyerId, consultationData.scheduledAt);

		// Convert consultation time to IST and extract "HH:mm"
		const scheduledAtIST = new Date(consultationData.scheduledAt).toLocaleString('en-US', {
			timeZone: 'Asia/Kolkata'
		});
		const scheduledTimeStr = new Date(scheduledAtIST).toTimeString().slice(0, 5); // "HH:mm"
		console.log('Scheduled Time (IST HH:mm):', scheduledTimeStr);

		const isSlotAvailable = availableSlots.some((slot) => {
			return slot.startTime <= scheduledTimeStr && scheduledTimeStr < slot.endTime;
		});

		if (!isSlotAvailable) {
			throw new APIError('Selected time slot is not available', httpStatus.BAD_REQUEST);
		}

		const modeDetails = lawyer.consultationModes.find((m) => m.mode === consultationData.type);

		console.log('Mode Details:', modeDetails);
		// Calculate price based on consultation type
		const price = modeDetails.price * (consultationData.duration / 60);

		console.log('Consultation Price:', price);
		// Create consultation
		const consultation = new Consultation({
			lawyer: lawyerId,
			...consultationData,
			price,
			userId
		});

		// Create meeting if it's a video or chat consultation
		if (consultationData.type === 'video' || consultationData.type === 'chat') {
			const meeting = await meetingService.createMeeting(consultation);
			consultation.meetingLink = meeting.meetingLink;
			consultation.meetingId = meeting.meetingId;
		}

		return await consultation.save();
	}

	async joinConsultation(consultationId, userIdId) {
		const consultation = await Consultation.findById(consultationId).populate('lawyer', 'userId').populate('userId', 'name');

		if (!consultation) {
			throw new APIError(httpStatus.NOT_FOUND, 'Consultation not found');
		}

		// Verify userId is either the lawyer or the client
		if (consultation.userId._id.toString() !== userIdId && consultation.lawyer.userId.toString() !== userIdId) {
			throw new APIError(httpStatus.FORBIDDEN, 'Not authorized to join this consultation');
		}

		// Verify consultation is active
		if (consultation.status !== 'confirmed') {
			throw new APIError(httpStatus.BAD_REQUEST, 'Consultation is not active');
		}

		// Verify consultation time
		const now = new Date();
		const consultationTime = new Date(consultation.scheduledAt);
		const timeDiff = Math.abs(now - consultationTime) / 60000; // difference in minutes

		if (timeDiff > 15) {
			// Allow joining 15 minutes before/after scheduled time
			throw new APIError(httpStatus.BAD_REQUEST, 'Consultation is not active at this time');
		}

		// Get userId's name
		const userIdName =
			consultation.userId._id.toString() === userIdId ? consultation.userId.name : consultation.lawyer.userId.name;

		// Get meeting details
		const meetingDetails = await meetingService.joinMeeting(consultation.meetingId, userIdId, userIdName);

		return {
			consultation,
			meetingDetails
		};
	}

	async endConsultation(consultationId, userIdId) {
		const consultation = await Consultation.findById(consultationId).populate('lawyer', 'userId');

		if (!consultation) {
			throw new APIError(httpStatus.NOT_FOUND, 'Consultation not found');
		}

		// Verify userId is the lawyer
		if (consultation.lawyer.userId.toString() !== userIdId) {
			throw new APIError(httpStatus.FORBIDDEN, 'Only the lawyer can end the consultation');
		}

		// End the meeting
		await meetingService.endMeeting(consultation.meetingId);

		// Update consultation status
		consultation.status = 'completed';
		consultation.completedAt = new Date();

		return await consultation.save();
	}

	async updateConsultationStatus(consultationId, status) {
		const consultation = await Consultation.findByIdAndUpdate(consultationId, { $set: { status } }, { new: true });

		if (!consultation) {
			throw new APIError(httpStatus.NOT_FOUND, 'Consultation not found');
		}
		return consultation;
	}

	async addFeedback(consultationId, userIdId, feedbackData) {
		const consultation = await Consultation.findById(consultationId);
		if (!consultation) {
			throw new APIError(httpStatus.NOT_FOUND, 'Consultation not found');
		}

		if (consultation.userId.toString() !== userIdId) {
			throw new APIError(httpStatus.FORBIDDEN, 'Not authorized to add feedback');
		}

		consultation.feedback = {
			...feedbackData,
			createdAt: new Date()
		};

		// Update lawyer's rating
		const lawyer = await Lawyer.findById(consultation.lawyer);
		const newRatingCount = lawyer.rating.count + 1;
		const newRatingAverage = (lawyer.rating.average * lawyer.rating.count + feedbackData.rating) / newRatingCount;

		lawyer.rating = {
			average: newRatingAverage,
			count: newRatingCount
		};

		await lawyer.save();
		return await consultation.save();
	}

	async getConsultationHistory(userIdId, filters = {}) {
		return await Consultation.find({ userId: userIdId, ...filters })
			.populate('lawyer', 'userId expertise')
			.populate('lawyer.userId', 'name email')
			.sort({ scheduledAt: -1 });
	}

	async getDashboardStats(lawyerId) {
		const lawyer = await Lawyer.findOne({ userIdId: lawyerId });
		if (!lawyer) {
			throw new Error('Lawyer not found');
		}

		// Get active bookings
		const activeBookings = await Booking.find({
			lawyerId: lawyer._id,
			status: { $in: ['scheduled', 'in-progress'] }
		}).populate('clientId', 'name email');

		// Get pending contracts
		const pendingContracts = await Contract.find({
			lawyerId: lawyer._id,
			status: 'review'
		}).populate('userIdId', 'name email');

		// Get recent earnings
		const recentEarnings = await Invoice.find({
			lawyerId: lawyer._id,
			status: 'settled',
			createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
		}).sort({ createdAt: -1 });

		return {
			earnings: lawyer.earnings,
			activeBookings,
			pendingContracts,
			recentEarnings,
			rating: lawyer.rating,
			totalReviews: lawyer.totalReviews
		};
	}

	async updateAvailability(lawyerId, availability) {
		const lawyer = await Lawyer.findOne({ userIdId: lawyerId });
		if (!lawyer) {
			throw new Error('Lawyer not found');
		}

		lawyer.availability = availability;
		await lawyer.save();
		return lawyer;
	}

	async getSharedContracts(lawyerId, query) {
		const { page = 1, limit = 10, status } = query;
		const skip = (page - 1) * limit;

		const filter = { lawyerId };
		if (status) {
			filter.status = status;
		}

		const contracts = await Contract.find(filter)
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit)
			.populate('userIdId', 'name email');

		const total = await Contract.countDocuments(filter);

		return {
			contracts,
			pagination: {
				total,
				page: Number(page),
				limit: Number(limit),
				pages: Math.ceil(total / limit)
			}
		};
	}

	async getEarningsReport(lawyerId, startDate, endDate) {
		const lawyer = await Lawyer.findOne({ userIdId: lawyerId });
		if (!lawyer) {
			throw new Error('Lawyer not found');
		}

		const invoices = await Invoice.find({
			lawyerId: lawyer._id,
			createdAt: {
				$gte: new Date(startDate),
				$lte: new Date(endDate)
			}
		}).sort({ createdAt: -1 });

		const totalEarnings = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
		const pendingAmount = invoices
			.filter((invoice) => invoice.status === 'pending')
			.reduce((sum, invoice) => sum + invoice.amount, 0);
		const settledAmount = invoices
			.filter((invoice) => invoice.status === 'settled')
			.reduce((sum, invoice) => sum + invoice.amount, 0);

		return {
			totalEarnings,
			pendingAmount,
			settledAmount,
			invoices
		};
	}

	async updateProfile(lawyerId, updateData) {
		const lawyer = await Lawyer.findOne({ userIdId: lawyerId });
		if (!lawyer) {
			throw new Error('Lawyer not found');
		}

		Object.assign(lawyer, updateData);
		await lawyer.save();
		return lawyer;
	}
}

export default new LawyerService();
