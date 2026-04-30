import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import skinRoutes from '../src/routes/skinRoutes';
import adminRoutes from '../src/routes/adminRoutes';

const app = express();

app.use(cors());
app.use(express.json());

// Serve os arquivos estáticos do painel admin (public/admin/*.html, etc.)
app.use(express.static(path.join(process.cwd(), 'public')));

// Rotas públicas — app mobile consome estas
app.use('/skins', skinRoutes);
// Mantém compatibilidade com prefixo /api/skins legado (sem quebrar o app mobile atual)
app.use('/api/skins', skinRoutes);

// Rotas do painel de administração
app.use('/admin', adminRoutes);

// Rota de saúde da API
app.get('/', (_req, res) => {
  res.json({ message: 'API de Skins Pocket Grau está online! 🚀' });
});

// Railway (e qualquer servidor não-serverless) precisa escutar sempre.
// O process.env.PORT é injetado automaticamente pelo Railway.
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

export default app;