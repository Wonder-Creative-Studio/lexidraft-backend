import Joi from 'joi';
import { mongoId } from './customValidation';

const createLawyer = {
	body: Joi.object().keys({
		specialization: Joi.array().items(Joi.string().required()).required(),
		experience: Joi.array()
			.items(
				Joi.object().keys({
					position: Joi.string().required(),
					organization: Joi.string().required(),
					from: Joi.date().required(),
					to: Joi.date().greater(Joi.ref('from')).optional(), // Ensures "to" is after "from"
					current: Joi.boolean().optional(),
					description: Joi.string().optional() // Added description field
				})
			)
			.required(),
		barCouncilNumber: Joi.string().required(),
		consultationFee: Joi.number().required(),
		availability: Joi.array()
			.items(
				Joi.object().keys({
					day: Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday').required(),
					slots: Joi.array()
						.items(
							Joi.object().keys({
								startTime: Joi.string()
									.pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/) // Matches HH:mm format
									.required(),
								endTime: Joi.string()
									.pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/) // Matches HH:mm format
									.required(),
								isAvailable: Joi.boolean().optional()
							})
						)
						.required()
				})
			)
			.required(),
		documents: Joi.array()
			.items(
				Joi.object().keys({
					documentType: Joi.string().required(), // Changed from type to documentType
					url: Joi.string().uri().required(),
					verified: Joi.boolean().optional()
				})
			)
			.optional(),
		rating: Joi.number().min(0).max(5).optional(),
		earnings: Joi.object()
			.keys({
				total: Joi.number().min(0).required(),
				pending: Joi.number().min(0).required(),
				settled: Joi.number().min(0).required()
			})
			.optional(),
		status: Joi.string().valid('active', 'inactive', 'suspended').optional(),
		practiceAreas: Joi.array().items(Joi.string().required()).min(1).required(), // At least one practice area is required
		bio: Joi.string().required(), // Ensure bio is provided
		consultationModes: Joi.array()
			.items(
				Joi.object().keys({
					mode: Joi.string()
						.valid('video', 'chat', 'document_review', 'document_drafting') // Allowed modes
						.required(),
					price: Joi.number().min(0).required() // Ensure price is non-negative
				})
			)
			.required() // At least one consultation mode is required
	})
};

const updateLawyer = {
	params: Joi.object().keys({
		lawyerId: Joi.string().custom(mongoId).required() // Ensure lawyerId is provided in the URL params
	}),
	body: Joi.object().keys({
		specialization: Joi.array().items(Joi.string().required()).optional(),
		experience: Joi.array()
			.items(
				Joi.object().keys({
					position: Joi.string().optional(),
					organization: Joi.string().optional(),
					from: Joi.date().optional(),
					to: Joi.date().greater(Joi.ref('from')).optional(), // Ensures "to" is after "from"
					current: Joi.boolean().optional(),
					description: Joi.string().optional() // Added description field
				})
			)
			.optional(),
		barCouncilNumber: Joi.string().optional(),
		consultationFee: Joi.number().optional(),
		availability: Joi.array()
			.items(
				Joi.object().keys({
					day: Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday').optional(),
					slots: Joi.array()
						.items(
							Joi.object().keys({
								startTime: Joi.string()
									.pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/) // Matches HH:mm format
									.optional(),
								endTime: Joi.string()
									.pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/) // Matches HH:mm format
									.optional(),
								isAvailable: Joi.boolean().optional()
							})
						)
						.optional()
				})
			)
			.optional(),
		documents: Joi.array()
			.items(
				Joi.object().keys({
					documentType: Joi.string().optional(),
					url: Joi.string().uri().optional(),
					verified: Joi.boolean().optional()
				})
			)
			.optional(),
		rating: Joi.number().min(0).max(5).optional(),
		earnings: Joi.object()
			.keys({
				total: Joi.number().min(0).optional(),
				pending: Joi.number().min(0).optional(),
				settled: Joi.number().min(0).optional()
			})
			.optional(),
		status: Joi.string().valid('active', 'inactive', 'suspended').optional(),
		practiceAreas: Joi.array().items(Joi.string().required()).optional(),
		bio: Joi.string().optional(),
		consultationModes: Joi.array()
			.items(
				Joi.object().keys({
					mode: Joi.string()
						.valid('video', 'chat', 'document_review', 'document_drafting') // Allowed modes
						.optional(),
					price: Joi.number().min(0).optional() // Ensure price is non-negative
				})
			)
			.optional()
	})
};

const searchLawyers = {
	query: Joi.object().keys({
		specialization: Joi.array().items(Joi.string()), // Changed from expertise to specialization
		stateOfPractice: Joi.string(),
		minRating: Joi.number().min(0).max(5),
		isVerified: Joi.boolean()
	})
};

const createConsultation = {
	params: Joi.object().keys({
		lawyerId: Joi.string().custom(mongoId)
	}),
	body: Joi.object().keys({
		type: Joi.string().valid('video', 'chat', 'document_review', 'document_drafting').required(),
		scheduledAt: Joi.date().min('now').required(),
		duration: Joi.number().integer().min(15).max(180).required(),
		document: Joi.string().custom(mongoId),
		notes: Joi.string()
	})
};

const updateConsultationStatus = {
	params: Joi.object().keys({
		consultationId: Joi.string().custom(mongoId)
	}),
	body: Joi.object().keys({
		status: Joi.string().valid('pending', 'confirmed', 'completed', 'cancelled').required()
	})
};

const addFeedback = {
	params: Joi.object().keys({
		consultationId: Joi.string().custom(mongoId)
	}),
	body: Joi.object().keys({
		rating: Joi.number().min(1).max(5).required(),
		comment: Joi.string()
	})
};

const updateAvailability = {
	body: Joi.object().keys({
		availability: Joi.array()
			.items(
				Joi.object().keys({
					day: Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday').required(),
					slots: Joi.array()
						.items(
							Joi.object().keys({
								startTime: Joi.string().required(),
								endTime: Joi.string().required(),
								isAvailable: Joi.boolean().default(true)
							})
						)
						.required()
				})
			)
			.required()
	})
};

const getSharedContracts = {
	query: Joi.object().keys({
		page: Joi.number().integer().min(1),
		limit: Joi.number().integer().min(1).max(100),
		status: Joi.string().valid('draft', 'review', 'final')
	})
};

const getEarningsReport = {
	query: Joi.object().keys({
		startDate: Joi.date().iso().required(),
		endDate: Joi.date().iso().min(Joi.ref('startDate')).required()
	})
};

const updateProfile = {
	body: Joi.object().keys({
		specialization: Joi.array().items(Joi.string()),
		experience: Joi.number().min(0),
		consultationFee: Joi.number().min(0),
		status: Joi.string().valid('active', 'inactive', 'suspended')
	})
};

const getAvailableSlots = {
	params: Joi.object().keys({
		lawyerId: Joi.string().custom(mongoId).required() // Validate lawyerId as a valid MongoDB ObjectId
	}),
	query: Joi.object().keys({
		date: Joi.date().required() // Validate that the date query parameter is provided
	})
};

export default {
	createLawyer,
	updateLawyer,
	searchLawyers,
	createConsultation,
	updateConsultationStatus,
	addFeedback,
	updateAvailability,
	getSharedContracts,
	getEarningsReport,
	updateProfile,
	getAvailableSlots
};
