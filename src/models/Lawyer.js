import mongoose from 'mongoose';
import toJSON from './plugins/toJSONPlugin';

const availabilitySchema = new mongoose.Schema({
	day: {
		type: String,
		enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
		required: true
	},
	slots: [
		{
			startTime: {
				type: String,
				required: true,
				match: /^([01]\d|2[0-3]):([0-5]\d)$/ // HH:mm format
			},
			endTime: {
				type: String,
				required: true,
				match: /^([01]\d|2[0-3]):([0-5]\d)$/ // HH:mm format
			},
			isAvailable: {
				type: Boolean,
				default: true
			}
		}
	]
});

const lawyerSchema = new mongoose.Schema(
	{
		specialization: [
			{
				type: String,
				required: true
			}
		],
		experience: [
			{
				position: String,
				organization: String,
				from: {
					type: Date,
					required: true
				},
				to: {
					type: Date,
					validate: {
						validator: function (value) {
							return !this.from || value > this.from;
						},
						message: 'The "to" date must be later than the "from" date.'
					}
				},
				current: {
					type: Boolean,
					default: false
				},
				description: {
					type: String, // Added description field
					default: ''
				}
			}
		],
		barCouncilNumber: {
			type: String,
			required: true,
			unique: true
		},
		consultationFee: {
			type: Number,
			required: true
		},
		availability: {
			type: [availabilitySchema],
			default: []
		},
		rating: {
			type: Number,
			default: 0,
			min: 0,
			max: 5
		},
		totalReviews: {
			type: Number,
			default: 0,
			min: 0
		},
		earnings: {
			total: {
				type: Number,
				default: 0
			},
			pending: {
				type: Number,
				default: 0
			},
			settled: {
				type: Number,
				default: 0
			}
		},
		status: {
			type: String,
			enum: ['active', 'inactive', 'suspended'],
			default: 'active'
		},
		documents: [
			{
				documentType: {
					type: String,
					required: true
				},
				url: {
					type: String,
					required: true
				},
				verified: {
					type: Boolean,
					default: false
				}
			}
		],
		practiceAreas: [
			{
				type: String,
				required: true // Ensure at least one practice area is provided
			}
		],
		bio: {
			type: String,
			required: true // Ensure every lawyer has a bio
		},
		consultationModes: [
			{
				mode: {
					type: String,
					enum: ['video', 'chat', 'document_review', 'document_drafting'], // Allowed modes
					required: true
				},
				price: {
					type: Number,
					required: true,
					min: 0 // Ensure price is non-negative
				}
			}
		],
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true
		}
	},
	{
		timestamps: true
	}
);

// Indexes for better query performance
lawyerSchema.index({ userId: 1 });
lawyerSchema.index({ specialization: 1 });
lawyerSchema.index({ status: 1 });
lawyerSchema.index({ barCouncilNumber: 1 });
lawyerSchema.index({ practiceAreas: 1 });

// Add plugins
lawyerSchema.plugin(toJSON);

// Pre-save hook for earnings validation
lawyerSchema.pre('save', function (next) {
	const { total, pending, settled } = this.earnings;
	if (total !== pending + settled) {
		return next(new Error('Earnings total must equal the sum of pending and settled.'));
	}
	next();
});

const Lawyer = mongoose.model('Lawyer', lawyerSchema);

export default Lawyer;
