import { Request, Response } from 'express';
import skinService from '../services/skinService';

class SkinController {
  // Lista todas as skins (com filtro opcional por tipo)
  public async index(req: Request, res: Response): Promise<Response> {
    try {
      const { tipo } = req.query;
      const skins = await skinService.getAllSkins(tipo as string);
      return res.json(skins);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  // Busca uma skin única pelo ID
  public async show(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const skin = await skinService.getSkinById(id);
      return res.json(skin);
    } catch (error: any) {
      return res.status(404).json({ error: error.message });
    }
  }
}

export default new SkinController();