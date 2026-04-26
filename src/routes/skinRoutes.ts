import { Router } from 'express';
import skinController from '../controllers/skinController';

const router = Router();

// Definimos os caminhos e associamos aos métodos do Controller
router.get('/', (req, res) => skinController.index(req, res));
router.get('/:id', (req, res) => skinController.show(req, res));

export default router;