import contractService from '~/services/contractService';
import catchAsync from '~/utils/catchAsync';
import httpStatus from 'http-status';
import { OpenAI } from 'openai';
// import Contract from '~/models/contract';
import config from '~/config/config';
import SharedContract from '~/models/sharedContract';
import emailService from '~/services/emailService';
import logger from '~/config/logger';
import contractAnalysisService from '~/services/contractAnalysisService';
import ContractComment from '~/models/contractComment';

// Initialize OpenAI client
const openai = new OpenAI({
	apiKey: config.openai.apiKey
});

class ContractController {
	async createContract(req, res) {
		try {
			const contract = await contractService.createContract(req.body, req.user.id);
			res.status(201).json(contract);
		} catch (error) {
			res.status(400).json({ error: error.message });
		}
	}

	async getContract(req, res) {
		try {
			const contract = await contractService.getContract(req.params.contractId);
			res.json(contract);
		} catch (error) {
			res.status(404).json({ error: error.message });
		}
	}

	async getUserContracts(req, res) {
		try {
			const result = await contractService.getUserContracts(req.user.id, req.query);
			res.json(result);
		} catch (error) {
			res.status(400).json({ error: error.message });
		}
	}

	async updateContract(req, res) {
		try {
			const contract = await contractService.updateContract(req.params.contractId, req.body, req.user.id);
			res.json(contract);
		} catch (error) {
			res.status(400).json({ error: error.message });
		}
	}

	async deleteContract(req, res) {
		try {
			const result = await contractService.deleteContract(req.params.contractId, req.user.id);
			res.json(result);
		} catch (error) {
			res.status(400).json({ error: error.message });
		}
	}

	async generateContractSections(req, res) {
		try {
			const { contractType, parties } = req.body;
			const sections = await contractService.generateContractSections(contractType, parties);
			res.json({ sections });
		} catch (error) {
			res.status(400).json({ error: error.message });
		}
	}

	async rewriteSection(req, res) {
		try {
			const { sectionContent, style } = req.body;
			const rewrittenContent = await contractService.rewriteSection(sectionContent, style);
			res.json({ content: rewrittenContent });
		} catch (error) {
			res.status(400).json({ error: error.message });
		}
	}

	async suggestClause(req, res) {
		try {
			const { context, type } = req.body;
			const clause = await contractService.suggestClause(context, type);
			res.json({ clause });
		} catch (error) {
			res.status(400).json({ error: error.message });
		}
	}

	generateAIContract = catchAsync(async (req, res) => {
		const { title, type, description, parties, jurisdiction, startDate, endDate, content, aiPreferences } = req.body;

		// Parse the JSON stringified parties and content
		const parsedParties = JSON.parse(parties);
		const parsedContent = JSON.parse(content);

		// Generate contract content using AI
		const contractContent = await this.generateContractContent({
			title,
			type,
			description,
			parties: parsedParties,
			jurisdiction,
			startDate,
			endDate,
			content: parsedContent,
			aiPreferences
		});

		// Create the contract with AI-generated content
		const contract = await contractService.createContract(
			{
				title,
				type,
				description,
				parties: parsedParties,
				jurisdiction,
				startDate,
				endDate,
				content: JSON.stringify(contractContent)
			},
			req.user.id
		);

		res.status(httpStatus.CREATED).send(contract);
	});

	// Helper function to generate contract content using AI
	async generateContractContent({ title, type, description, parties, jurisdiction, startDate, endDate, content, aiPreferences }) {
		// Prepare the prompt for the AI
		const prompt = `Generate a legal contract with the following details:
Title: ${title}
Type: ${type}
Description: ${description}
Parties: ${JSON.stringify(parties)}
Jurisdiction: ${jurisdiction}
Start Date: ${startDate}
End Date: ${endDate}
Tone: ${aiPreferences.tone}
Language: ${aiPreferences.language}

Preferred Content Structure:
${JSON.stringify(content, null, 2)}

Required sections:
${aiPreferences.includeDefinitions ? '- Definitions: Clearly define all key terms used in the contract\n' : ''}
${aiPreferences.includeJurisdiction ? '- Jurisdiction: Specify the governing law and jurisdiction for disputes\n' : ''}
${aiPreferences.includeDisputeResolution ? '- Dispute Resolution: Include arbitration or mediation clauses as appropriate\n' : ''}
- Parties: Detailed information about all parties involved
- Term: Contract duration and renewal terms
- Obligations: Specific duties and responsibilities of each party
- Payment Terms: If applicable, include payment schedules and methods
- Confidentiality: If applicable, include confidentiality clauses
- Termination: Conditions and procedures for contract termination
- Miscellaneous: Include standard boilerplate clauses

Please generate a complete, legally sound contract that follows this structure and includes all necessary clauses and sections.`;

		// Call OpenAI API to generate the contract content
		const response = await openai.chat.completions.create({
			model: 'gpt-4',
			messages: [
				{
					role: 'system',
					content:
						'Please generate a complete, legally sound contract in well-written paragraphs, not bullet points or numbered lists. Use formal legal language and ensure each section is clearly separated with headings in bold and uppercase  followed by well-structured paragraphs.Maintain proper spacing between sections (one blank line) and indent the first line of each paragraph slightly (or simulate indentation with line breaks). The tone should be professional and legally accurate.Ensure the agreement reads like a real legal contract and can be directly used in professional settings without further formatting.Structure the contract similar to real-world legal agreement templates used in India. Use consistent terminology and format like a formal legal document'
				},
				{
					role: 'user',
					content: prompt
				}
			],
			temperature: 0.7,
			max_tokens: 4000
		});

		// Parse the AI response and structure it
		const aiResponse = response.choices[0].message.content;
		const clauses = this.parseContractClauses(aiResponse);

		return {
			clauses,
			appearance: content.appearance || {
				font: 'Arial',
				spacing: 1.5,
				margins: {
					top: 72,
					bottom: 72,
					left: 72,
					right: 72
				}
			},
			aiResponses: [
				{
					query: prompt,
					response: aiResponse,
					timestamp: new Date().toISOString()
				}
			],
			conversationSummary: content.conversationSummary || `Contract generated for ${title} with ${parties.length} parties`
		};
	}

	// Helper function to parse contract clauses from AI response
	parseContractClauses(aiResponse) {
		// Split the response into sections based on headers
		const sections = aiResponse.split(/\n(?=[A-Z][A-Za-z\s]+:)/);

		return sections.map((section, index) => {
			const [title, ...contentParts] = section.split('\n');
			return {
				title: title.replace(':', '').trim(),
				content: contentParts.join('\n').trim(),
				order: index + 1 // Automatically assign order based on array index
			};
		});
	}

	updateGeneratedContract = catchAsync(async (req, res) => {
		const { contractId } = req.params;
		const { title, type, description, parties, jurisdiction, startDate, endDate, content, aiPreferences } = req.body;

		// Parse the JSON stringified parties and content
		const parsedParties = parties ? JSON.parse(parties) : undefined;
		const parsedContent = content ? JSON.parse(content) : undefined;

		// Get the existing contract
		const existingContract = await contractService.getContract(contractId);
		if (!existingContract) {
			throw new Error('Contract not found');
		}

		// Generate new contract content using AI if content is provided
		let contractContent = existingContract.content;
		if (content || aiPreferences) {
			contractContent = await this.generateContractContent({
				title: title || existingContract.title,
				type: type || existingContract.type,
				description: description || existingContract.description,
				parties: parsedParties || existingContract.parties,
				jurisdiction: jurisdiction || existingContract.jurisdiction,
				startDate: startDate || existingContract.startDate,
				endDate: endDate || existingContract.endDate,
				content: parsedContent || JSON.parse(existingContract.content),
				aiPreferences: aiPreferences || {}
			});
		}

		// Update the contract
		const updatedContract = await contractService.updateContract(
			contractId,
			{
				...(title && { title }),
				...(type && { type }),
				...(description && { description }),
				...(parsedParties && { parties: parsedParties }),
				...(jurisdiction && { jurisdiction }),
				...(startDate && { startDate }),
				...(endDate && { endDate }),
				...(contractContent && { content: JSON.stringify(contractContent) })
			},
			req.user.id
		);

		res.status(httpStatus.OK).send({
			success: true,
			message: 'Contract updated successfully',
			data: updatedContract
		});
	});

	generateShareableLink = catchAsync(async (req, res) => {
		const { contractId } = req.params;
		const { expiresIn, accessType, shareType, allowedEmails, regenerate } = req.body;

		// Verify contract exists and user has access
		const contract = await contractService.getContract(contractId);
		if (!contract) {
			throw new Error('Contract not found');
		}

		// Calculate expiration date
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + expiresIn);

		// Check if user already has a shareable link for this contract
		let sharedContract = await SharedContract.findOne({
			contractId,
			createdBy: req.user.id,
			isActive: true
		});

		if (sharedContract && !regenerate) {
			// Update existing shareable link
			sharedContract.accessType = accessType;
			sharedContract.shareType = shareType;
			sharedContract.expiresAt = expiresAt;
			sharedContract.allowedEmails = shareType === 'restricted' ? allowedEmails : [];
			await sharedContract.save();

			// Send notifications to newly added emails for restricted sharing
			if (shareType === 'restricted' && allowedEmails && allowedEmails.length > 0) {
				const newEmails = allowedEmails.filter((email) => !sharedContract.allowedEmails.includes(email));
				if (newEmails.length > 0) {
					await Promise.all(newEmails.map((email) => emailService.sendContractShareNotification(sharedContract, email)));
				}
			}
		} else {
			// If there's an existing link and regenerate is true, deactivate it
			if (sharedContract) {
				sharedContract.isActive = false;
				await sharedContract.save();
			}

			// Generate new share token
			const shareToken = SharedContract.generateToken();

			// Create new shared contract record
			sharedContract = new SharedContract({
				contractId,
				shareToken,
				createdBy: req.user.id,
				accessType,
				shareType,
				expiresAt,
				allowedEmails: shareType === 'restricted' ? allowedEmails : []
			});

			await sharedContract.save();

			// Send notifications to allowed emails for restricted sharing
			if (shareType === 'restricted' && allowedEmails && allowedEmails.length > 0) {
				await Promise.all(allowedEmails.map((email) => emailService.sendContractShareNotification(sharedContract, email)));
			}
		}

		// Generate shareable URL
		const shareableUrl = `${config.clientUrl}/contracts/shared/${sharedContract.shareToken}`;

		res.status(httpStatus.OK).send({
			success: true,
			data: {
				shareableUrl,
				expiresAt: sharedContract.expiresAt,
				accessType: sharedContract.accessType,
				shareType: sharedContract.shareType,
				allowedEmails: sharedContract.allowedEmails,
				isNew: !sharedContract.createdAt || new Date().getTime() - new Date(sharedContract.createdAt).getTime() < 1000, // Check if created within last second
				isRegenerated: regenerate
			}
		});
	});

	accessSharedContract = catchAsync(async (req, res) => {
		const { shareToken } = req.params;
		const userEmail = req.user.email; // Get email from authenticated user

		// Find shared contract
		const sharedContract = await SharedContract.findOne({ shareToken });
		if (!sharedContract) {
			throw new Error('Invalid or expired share link');
		}

		// Check if link is still valid
		if (!sharedContract.isValid()) {
			throw new Error('Share link has expired');
		}

		// Check email access
		if (!sharedContract.isEmailAllowed(userEmail)) {
			throw new Error('Access denied. Your email is not authorized to view this contract.');
		}

		// Get contract details
		const contract = await contractService.getContract(sharedContract.contractId);
		if (!contract) {
			throw new Error('Contract not found');
		}

		// Record access
		await sharedContract.recordAccess();

		// Send access notification
		try {
			await emailService.sendContractAccessNotification(sharedContract, userEmail);
		} catch (error) {
			logger.error('Failed to send access notification:', error);
		}

		// Return contract with access type
		res.status(httpStatus.OK).send({
			success: true,
			data: {
				contract,
				accessType: sharedContract.accessType,
				expiresAt: sharedContract.expiresAt
			}
		});
	});

	requestContractAccess = catchAsync(async (req, res) => {
		const { shareToken } = req.params;
		const { email, reason } = req.body;

		// Find shared contract
		const sharedContract = await SharedContract.findOne({ shareToken });
		if (!sharedContract) {
			throw new Error('Invalid or expired share link');
		}

		// Check if link is still valid
		if (!sharedContract.isValid()) {
			throw new Error('Share link has expired');
		}

		// Check if email is already allowed
		if (sharedContract.isEmailAllowed(email)) {
			throw new Error('You already have access to this contract');
		}

		// Add access request
		await sharedContract.addAccessRequest(email);

		// Get contract details for notification
		const contract = await contractService.getContract(sharedContract.contractId);
		const creator = await contract.populate({
			path: 'userId',
			model: 'User' // Explicitly specify the model name
		});

		// Send notification to contract creator
		try {
			await emailService.sendAccessRequestNotification(creator.userId.email, {
				contractTitle: contract.title,
				requestedBy: email,
				reason,
				shareToken
			});
		} catch (error) {
			logger.error('Failed to send access request notification:', error);
		}

		res.status(httpStatus.OK).send({
			success: true,
			message: 'Access request submitted successfully',
			data: {
				status: 'pending',
				requestedAt: new Date()
			}
		});
	});

	updateAccessRequest = catchAsync(async (req, res) => {
		const { shareToken, email } = req.params;
		const { status, responseNote } = req.body;

		// Find shared contract
		const sharedContract = await SharedContract.findOne({ shareToken });
		if (!sharedContract) {
			throw new Error('Invalid or expired share link');
		}

		// Update access request
		await sharedContract.updateAccessRequest(email, status, responseNote);

		// Send notification to requester
		try {
			await emailService.sendAccessRequestResponseNotification(email, {
				status,
				responseNote,
				shareToken
			});
		} catch (error) {
			logger.error('Failed to send access request response notification:', error);
		}

		res.status(httpStatus.OK).send({
			success: true,
			message: `Access request ${status} successfully`,
			data: {
				status,
				respondedAt: new Date()
			}
		});
	});

	analyzeContract = catchAsync(async (req, res) => {
		const { contractId } = req.params;
		const { analysisType, jurisdiction, industry, additionalContext } = req.body;

		// Get contract details
		const contract = await contractService.getContract(contractId);
		if (!contract) {
			throw new Error('Contract not found');
		}

		// Perform AI analysis
		const analysis = await contractAnalysisService.analyzeContract(contract, {
			analysisType,
			jurisdiction,
			industry,
			additionalContext
		});

		res.status(httpStatus.OK).send({
			success: true,
			data: {
				contractId,
				analysis
			}
		});
	});

	saveAsTemplate = catchAsync(async (req, res) => {
		const { contractId } = req.params;
		const { templateName, description, category, isPublic } = req.body;

		// Get the original contract
		const contract = await contractService.getContract(contractId);
		if (!contract) {
			throw new Error('Contract not found');
		}

		// Create a new contract template
		const template = await contractService.createContract(
			{
				title: templateName,
				type: category,
				description: description || `Template based on ${contract.title}`,
				parties: contract.parties,
				jurisdiction: contract.jurisdiction,
				content: contract.content,
				isTemplate: true,
				isPublic,
				templateSource: contractId
			},
			req.user.id
		);

		res.status(httpStatus.CREATED).send({
			success: true,
			message: 'Contract saved as template successfully',
			data: template
		});
	});

	addContractComment = catchAsync(async (req, res) => {
		const { contractId } = req.params;
		const { content, context, parentCommentId } = req.body;

		// Verify contract exists and user has access
		const contract = await contractService.getContract(contractId);
		if (!contract) {
			throw new Error('Contract not found');
		}

		// If this is a reply, verify parent comment exists
		if (parentCommentId) {
			const parentComment = await ContractComment.findOne({
				_id: parentCommentId,
				contractId
			});
			if (!parentComment) {
				throw new Error('Parent comment not found');
			}
		}

		// Create the comment
		const comment = await ContractComment.create({
			contractId,
			userId: req.user.id,
			content,
			context,
			parentCommentId
		});

		// Populate user details
		await comment.populate('userId', 'name email');

		res.status(httpStatus.CREATED).send({
			success: true,
			data: comment
		});
	});

	getContractComments = catchAsync(async (req, res) => {
		const { contractId } = req.params;
		const { section, resolved, page = 1, limit = 20 } = req.query;

		// Verify contract exists and user has access
		const contract = await contractService.getContract(contractId);
		if (!contract) {
			throw new Error('Contract not found');
		}

		// Build query
		const query = { contractId };
		if (section) query['context.section'] = section;
		if (resolved !== undefined) query.isResolved = resolved === 'true';

		// Get comments with pagination
		const comments = await ContractComment.find(query)
			.populate('userId', 'name email')
			.populate('resolvedBy', 'name email')
			.sort({ createdAt: -1 })
			.skip((page - 1) * limit)
			.limit(parseInt(limit, 10));

		// Get total count for pagination
		const total = await ContractComment.countDocuments(query);

		res.status(httpStatus.OK).send({
			success: true,
			data: {
				comments,
				pagination: {
					total,
					page: parseInt(page, 10),
					limit: parseInt(limit, 10),
					pages: Math.ceil(total / limit)
				}
			}
		});
	});

	resolveContractComment = catchAsync(async (req, res) => {
		const { contractId, commentId } = req.params;

		// Verify contract exists and user has access
		const contract = await contractService.getContract(contractId);
		if (!contract) {
			throw new Error('Contract not found');
		}

		// Find and update the comment
		const comment = await ContractComment.findOneAndUpdate(
			{
				_id: commentId,
				contractId,
				isResolved: false
			},
			{
				isResolved: true,
				resolvedAt: new Date(),
				resolvedBy: req.user.id
			},
			{ new: true }
		);

		if (!comment) {
			throw new Error('Comment not found or already resolved');
		}

		// Populate user details
		await comment.populate('userId', 'name email');
		await comment.populate('resolvedBy', 'name email');

		res.status(httpStatus.OK).send({
			success: true,
			data: comment
		});
	});
}

export default new ContractController();
