import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { prepareDatabase } from './db.js';
import authRoutes from './routes/auth.routes.js';
import taskRoutes from './routes/tasks.routes.js';
import userRoutes from './routes/users.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.join(__dirname, 'frontend');
const PORT = Number(process.env.PORT) || 4173;

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
});

app.use(
    express.static(frontendDir, {
        setHeaders(res, filePath) {
            if (/\.(html|js|css)$/i.test(filePath)) {
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
            }
        },
    })
);

prepareDatabase()
    .then(() => {
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Planificador Colbeef listo (MySQL)`);
            console.log(`Abre http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('No se pudo conectar con MySQL.');
        console.error(err.message);
        console.error('Revisa el .env y ejecuta sql/crear-planner-mysql.sql en el servidor.');
        process.exit(1);
    });
