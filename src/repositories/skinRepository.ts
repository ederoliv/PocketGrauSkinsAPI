import { Skin, SkinType } from '../models/Skin';
import pool from '../lib/db';

class SkinRepository {
  public async findAll(tipo?: SkinType): Promise<Skin[]> {
    let query = `
      SELECT id, nome, descricao, tipo, banners, arquivo_skin AS "arquivoSkin"
      FROM skins
    `;
    const params: string[] = [];

    if (tipo) {
      query += ` WHERE tipo = $1`;
      params.push(tipo);
    }

    query += ` ORDER BY id ASC`;

    const result = await pool.query(query, params);
    return result.rows as Skin[];
  }

  public async findById(id: number): Promise<Skin | undefined> {
    const result = await pool.query(
      `SELECT id, nome, descricao, tipo, banners, arquivo_skin AS "arquivoSkin"
       FROM skins WHERE id = $1`,
      [id]
    );
    return result.rows[0] as Skin | undefined;
  }

  public async create(data: {
    nome: string;
    descricao: string;
    tipo: SkinType;
    banners: string[];
    arquivoSkin: string;
  }): Promise<Skin> {
    const result = await pool.query(
      `INSERT INTO skins (nome, descricao, tipo, banners, arquivo_skin)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nome, descricao, tipo, banners, arquivo_skin AS "arquivoSkin"`,
      [data.nome, data.descricao, data.tipo, data.banners, data.arquivoSkin]
    );
    return result.rows[0] as Skin;
  }

  public async deleteById(id: number): Promise<Skin | undefined> {
    const result = await pool.query(
      `DELETE FROM skins WHERE id = $1
       RETURNING id, nome, descricao, tipo, banners, arquivo_skin AS "arquivoSkin"`,
      [id]
    );
    return result.rows[0] as Skin | undefined;
  }
}

export default new SkinRepository();