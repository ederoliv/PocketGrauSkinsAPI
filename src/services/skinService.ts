import skinRepository from '../repositories/skinRepository';
import { Skin, SkinType } from '../models/Skin';

class SkinService {
    public getAllSkins(tipo?: string): Skin[] {
        let skins = skinRepository.findAll();

        if (tipo) {
            skins = skins.filter(s => s.tipo === (tipo.toUpperCase() as SkinType));
        }

        return skins;
    }

    public getSkinById(id: string): Skin {
        const skin = skinRepository.findById(Number(id));
        if (!skin) throw new Error("Skin não encontrada");
        return skin;
    }
}

export default new SkinService();