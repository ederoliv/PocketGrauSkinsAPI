import { Router } from 'express';
import skinController from '../controllers/skinController';

const router = Router();

// GET /skins  — lista todas (suporte a ?tipo=PERSONAGEM ou ?tipo=MOTO)
router.get('/', (req, res) => skinController.index(req, res));

// GET /skins/:id  — skin por ID
router.get('/:id', (req, res) => skinController.show(req, res));

export default router;