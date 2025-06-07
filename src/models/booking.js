import mongoose from 'mongoose';
import toJSON from './plugins/toJSONPlugin';

const bookingSchema = mongoose.Schema(
	{
		lawyerId: {
			type: mongoose.SchemaTypes.ObjectId,
			ref: 'Lawyer',
			required: true
		},
		clientId: {
			type: mongoose.SchemaTypes.ObjectId,
			ref: 'User',
			required: true
		},
		status: {
			type: String,
			enum: ['scheduled', 'in-progress', 'completed', 'cancelled'],
			default: 'scheduled'
		},
		scheduledTime: {
			type: Date,
			required: true
		},
		duration: {
			type: Number, // in minutes
			required: true
		}
	},
	{
		timestamps: true
	}
);

bookingSchema.plugin(toJSON);

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking;
