import { Router } from 'express';
import authenticate from '~/middlewares/authenticate';
import { startConsultation, joinConsultation, endConsultation } from '../../controllers/consultationController';

const router = Router();

router.post('/start/:lawyerId', authenticate(), startConsultation);
router.post('/join/:roomId', authenticate(), joinConsultation);
router.post('/end/:roomId', authenticate(), endConsultation);

export default router;
