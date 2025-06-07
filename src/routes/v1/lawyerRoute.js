import { Router } from 'express';
import authenticate from '~/middlewares/authenticate';
import validate from '~/middlewares/validate';
import lawyerValidation from '~/validations/lawyerValidation';
import lawyerController from '~/controllers/lawyerController';
import catchAsync from '~/utils/catchAsync';

const router = Router();

// Lawyer profile routes
router.post('/', authenticate(), validate(lawyerValidation.createLawyer), catchAsync(lawyerController.createLawyerProfile));
router.get('/', authenticate(), validate(lawyerValidation.searchLawyers), catchAsync(lawyerController.searchLawyers));

router.get('/:lawyerId', authenticate(), catchAsync(lawyerController.getLawyerProfile));
router.patch(
	'/:lawyerId',
	authenticate(),
	validate(lawyerValidation.updateLawyer),
	catchAsync(lawyerController.updateLawyerProfile)
);

// Availability routes
router.get(
	'/:lawyerId/slots',
	authenticate(),
	validate(lawyerValidation.getAvailableSlots), // Use the updated validation
	catchAsync(lawyerController.getAvailableSlots) // Ensure the controller method is correct
);

// Consultation routes
router.post(
	'/:lawyerId/consultations',
	authenticate(),
	validate(lawyerValidation.createConsultation),
	catchAsync(lawyerController.createConsultation)
);

router.patch(
	'/consultations/:consultationId/status',
	authenticate(),
	validate(lawyerValidation.updateConsultationStatus),
	catchAsync(lawyerController.updateConsultationStatus)
);

router.post('/consultations/:consultationId/join', authenticate(), catchAsync(lawyerController.joinConsultation));

router.post('/consultations/:consultationId/end', authenticate(), catchAsync(lawyerController.endConsultation));

router.post(
	'/consultations/:consultationId/feedback',
	authenticate(),
	validate(lawyerValidation.addFeedback),
	catchAsync(lawyerController.addFeedback)
);

router.get('/consultations', authenticate(), catchAsync(lawyerController.getConsultationHistory));

// Dashboard routes
router.get('/dashboard/stats', authenticate(), catchAsync(lawyerController.getDashboardStats));

router.get(
	'/dashboard/contracts',
	authenticate(),
	validate(lawyerValidation.getSharedContracts),
	catchAsync(lawyerController.getSharedContracts)
);

router.get(
	'/dashboard/earnings',
	authenticate(),
	validate(lawyerValidation.getEarningsReport),
	catchAsync(lawyerController.getEarningsReport)
);

router.patch(
	'/dashboard/availability',
	authenticate(),
	validate(lawyerValidation.updateAvailability),
	catchAsync(lawyerController.updateAvailability)
);

router.patch('/profile', authenticate(), validate(lawyerValidation.updateProfile), catchAsync(lawyerController.updateProfile));

export default router;
