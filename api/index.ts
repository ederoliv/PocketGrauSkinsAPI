import express from 'express';
import cors from 'cors';
import skinRoutes from '../src/routes/skinRoutes';

const app = express();

app.use(cors());
app.use(express.json());

// Todas as rotas dentro de skinRoutes serão prefixadas com /api/skins
app.use('/api/skins', skinRoutes);

// Rota de fallback/saúde da API
app.get('/', (req, res) => {
    res.json({ message: "API de Skins Unibits está online! 🚀" });
});

if (process.env.NODE_ENV !== 'production') {
    const PORT = 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    });
}

export default app;