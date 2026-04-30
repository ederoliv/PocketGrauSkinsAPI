import { Router, Request, Response } from 'express';
import multer from 'multer';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import path from 'path';
import { requireAuth } from '../middleware/auth';
import skinService from '../services/skinService';
import { uploadFile, deleteFile, keyFromUrl } from '../lib/storage';
import { SkinType } from '../models/Skin';

const router = Router();

// Multer em memória — nunca grava em disco
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB por arquivo
});

// ---------------------------------------------------------------------------
// GET /admin/login  — Página de login (sem autenticação)
// ---------------------------------------------------------------------------
router.get('/login', (_req: Request, res: Response) => {
  res.sendFile(path.join(process.cwd(), 'public', 'admin', 'login.html'));
});

// ---------------------------------------------------------------------------
// POST /admin/auth  — Valida senha e retorna JWT
// ---------------------------------------------------------------------------
router.post('/auth', async (req: Request, res: Response): Promise<void> => {
  const { senha } = req.body as { senha?: string };

  if (!senha) {
    res.status(400).json({ error: 'Senha é obrigatória.' });
    return;
  }

  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) {
    res.status(500).json({ error: 'Configuração do servidor incompleta.' });
    return;
  }

  const valida = await bcrypt.compare(senha, hash);
  if (!valida) {
    res.status(401).json({ error: 'Senha incorreta.' });
    return;
  }

  const token = jwt.sign({ admin: true }, process.env.JWT_SECRET!, {
    expiresIn: '8h',
  });

  res.json({ token });
});

// ---------------------------------------------------------------------------
// GET /admin  — Painel principal (protegido, servido como HTML estático)
// ---------------------------------------------------------------------------
router.get('/', requireAuth, (_req: Request, res: Response) => {
  res.sendFile(path.join(process.cwd(), 'public', 'admin', 'index.html'));
});

// ---------------------------------------------------------------------------
// GET /admin/skins  — Lista skins (JSON, para o painel carregar dinamicamente)
// ---------------------------------------------------------------------------
router.get('/skins', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  try {
    const skins = await skinService.getAllSkins();
    res.json(skins);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// POST /admin/skins  — Cadastra nova skin
// Campos de texto: nome, descricao, tipo
// Arquivos:  banners (até 4 imagens) + arquivoSkin (1 PNG)
// ---------------------------------------------------------------------------
router.post(
  '/skins',
  requireAuth,
  upload.fields([
    { name: 'banners', maxCount: 4 },
    { name: 'arquivoSkin', maxCount: 1 },
  ]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { nome, descricao, tipo } = req.body as {
        nome?: string;
        descricao?: string;
        tipo?: string;
      };

      if (!nome || !descricao || !tipo) {
        res.status(400).json({ error: 'Campos nome, descricao e tipo são obrigatórios.' });
        return;
      }

      if (tipo !== 'PERSONAGEM' && tipo !== 'MOTO') {
        res.status(400).json({ error: 'Tipo deve ser PERSONAGEM ou MOTO.' });
        return;
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      if (!files?.arquivoSkin?.[0]) {
        res.status(400).json({ error: 'Arquivo da skin é obrigatório.' });
        return;
      }

      if (!files?.banners?.length) {
        res.status(400).json({ error: 'Pelo menos um banner é obrigatório.' });
        return;
      }

      // Slug temporário para nomear os arquivos (será ajustado após INSERT)
      const timestamp = Date.now();

      // 1. Upload dos banners
      const bannerUrls: string[] = await Promise.all(
        files.banners.map(async (file, i) => {
          const ext = file.originalname.split('.').pop() ?? 'jpg';
          const key = `banners/skin-${timestamp}-banner-${i + 1}.${ext}`;
          return uploadFile(key, file.buffer, file.mimetype);
        })
      );

      // 2. Upload do arquivo da skin
      const skinFile = files.arquivoSkin[0];
      const skinExt = skinFile.originalname.split('.').pop() ?? 'png';
      const skinKey = `skins/skin-${timestamp}.${skinExt}`;
      const arquivoSkinUrl = await uploadFile(skinKey, skinFile.buffer, skinFile.mimetype);

      // 3. Insert no banco
      const novaSkin = await skinService.createSkin({
        nome,
        descricao,
        tipo: tipo as SkinType,
        banners: bannerUrls,
        arquivoSkin: arquivoSkinUrl,
      });

      res.status(201).json(novaSkin);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ---------------------------------------------------------------------------
// PUT /admin/skins/:id  — Edita uma skin existente
// Campos de texto obrigatórios: nome, descricao, tipo
// Arquivos opcionais: banners e/ou arquivoSkin (se não enviados, mantém os atuais)
// ---------------------------------------------------------------------------
router.put(
  '/skins/:id',
  requireAuth,
  upload.fields([
    { name: 'banners', maxCount: 4 },
    { name: 'arquivoSkin', maxCount: 1 },
  ]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { nome, descricao, tipo } = req.body as {
        nome?: string; descricao?: string; tipo?: string;
      };

      if (!nome || !descricao || !tipo) {
        res.status(400).json({ error: 'Campos nome, descricao e tipo são obrigatórios.' });
        return;
      }
      if (tipo !== 'PERSONAGEM' && tipo !== 'MOTO') {
        res.status(400).json({ error: 'Tipo deve ser PERSONAGEM ou MOTO.' });
        return;
      }

      // Busca skin atual para manter arquivos não substituídos
      const atual = await skinService.getSkinById(req.params.id);
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const timestamp = Date.now();

      // Banners: upload novo se enviado, senão mantém atual
      let bannerUrls: string[];
      if (files?.banners?.length) {
        // Remove banners antigos do R2
        await Promise.allSettled(atual.banners.map(u => deleteFile(keyFromUrl(u)).catch(console.error)));
        bannerUrls = await Promise.all(
          files.banners.map(async (file, i) => {
            const ext = file.originalname.split('.').pop() ?? 'jpg';
            return uploadFile(`banners/skin-${timestamp}-banner-${i + 1}.${ext}`, file.buffer, file.mimetype);
          })
        );
      } else {
        bannerUrls = atual.banners;
      }

      // Arquivo da skin: upload novo se enviado, senão mantém atual
      let arquivoSkinUrl: string;
      if (files?.arquivoSkin?.[0]) {
        await deleteFile(keyFromUrl(atual.arquivoSkin)).catch(console.error);
        const skinFile = files.arquivoSkin[0];
        const ext = skinFile.originalname.split('.').pop() ?? 'png';
        arquivoSkinUrl = await uploadFile(`skins/skin-${timestamp}.${ext}`, skinFile.buffer, skinFile.mimetype);
      } else {
        arquivoSkinUrl = atual.arquivoSkin;
      }

      const atualizada = await skinService.updateSkin(req.params.id, {
        nome, descricao, tipo: tipo as SkinType, banners: bannerUrls, arquivoSkin: arquivoSkinUrl,
      });

      res.json(atualizada);
    } catch (error: any) {
      const status = error.message === 'Skin não encontrada' ? 404 : 500;
      res.status(status).json({ error: error.message });
    }
  }
);

// ---------------------------------------------------------------------------
// DELETE /admin/skins/:id  — Remove skin do banco e do R2
// ---------------------------------------------------------------------------
router.delete('/skins/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const skin = await skinService.deleteSkin(req.params.id);

    // Remove arquivos do S3 (falha silenciosa para não bloquear a exclusão do registro)
    const cleanupPromises = [
      ...skin.banners.map((url) => deleteFile(keyFromUrl(url)).catch(console.error)),
      deleteFile(keyFromUrl(skin.arquivoSkin)).catch(console.error),
    ];

    await Promise.allSettled(cleanupPromises);

    res.json({ message: 'Skin removida com sucesso.', skin });
  } catch (error: any) {
    const status = error.message === 'Skin não encontrada' ? 404 : 500;
    res.status(status).json({ error: error.message });
  }
});

export default router;
