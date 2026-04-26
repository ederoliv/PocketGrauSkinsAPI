export type SkinType = 'PERSONAGEM' | 'MOTO';

export interface Skin {
    id: number;
    nome: string;
    descricao: string;
    tipo: SkinType;
    banners: string[];
    arquivoSkin: string;
}
    