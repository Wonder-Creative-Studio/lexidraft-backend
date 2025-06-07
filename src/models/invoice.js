import mongoose from 'mongoose';
import toJSON from './plugins/toJSONPlugin';

const invoiceSchema = mongoose.Schema(
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
		amount: {
			type: Number,
			required: true
		},
		status: {
			type: String,
			enum: ['pending', 'settled'],
			default: 'pending'
		},
		description: {
			type: String
		}
	},
	{
		timestamps: true
	}
);

invoiceSchema.plugin(toJSON);

const Invoice = mongoose.model('Invoice', invoiceSchema);

export default Invoice;
