import { Request, Response } from 'express';
import skinService from '../services/skinService';

class SkinController {
    // Lista todas as skins (com filtro opcional por tipo)
    public index(req: Request, res: Response): Response {
        try {
            const { tipo } = req.query;
            const skins = skinService.getAllSkins(tipo as string);
            return res.json(skins);
        } catch (error: any) {
            return res.status(500).json({ error: error.message });
        }
    }

    // Busca uma skin única pelo ID
    public show(req: Request, res: Response): Response {
        try {
            const { id } = req.params;
            const skin = skinService.getSkinById(id);
            return res.json(skin);
        } catch (error: any) {
            // Se o Service lançar o erro "Skin não encontrada", retornamos 404
            return res.status(404).json({ error: error.message });
        }
    }
}

export default new SkinController();