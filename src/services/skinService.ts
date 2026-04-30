import { Skin, SkinType } from '../models/Skin';
import skinRepository from '../repositories/skinRepository';

class SkinService {
  public async getAllSkins(tipo?: string): Promise<Skin[]> {
    const tipoFiltro = tipo ? (tipo.toUpperCase() as SkinType) : undefined;
    return skinRepository.findAll(tipoFiltro);
  }

  public async getSkinById(id: string): Promise<Skin> {
    const skin = await skinRepository.findById(Number(id));
    if (!skin) throw new Error('Skin não encontrada');
    return skin;
  }

  public async createSkin(data: {
    nome: string;
    descricao: string;
    tipo: SkinType;
    banners: string[];
    arquivoSkin: string;
  }): Promise<Skin> {
    return skinRepository.create(data);
  }

  public async updateSkin(id: string, data: {
    nome: string; descricao: string; tipo: SkinType;
    banners: string[]; arquivoSkin: string;
  }): Promise<Skin> {
    const skin = await skinRepository.updateById(Number(id), data);
    if (!skin) throw new Error('Skin não encontrada');
    return skin;
  }

  public async deleteSkin(id: string): Promise<Skin> {
    const skin = await skinRepository.deleteById(Number(id));
    if (!skin) throw new Error('Skin não encontrada');
    return skin;
  }
}

export default new SkinService();