import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { logActivity, pool } from '../db.js';
import { authenticate, publicUser, signToken } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) {
        return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
    }

    try {
        const [rows] = await pool.query(
            'SELECT * FROM users WHERE email = ? AND active = 1 LIMIT 1',
            [email]
        );
        const user = rows[0];
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
        }
        await logActivity(user.email, 'login', 'ingreso');
        return res.json({ token: signToken(user), user: publicUser(user) });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'No se pudo validar el acceso' });
    }
});

router.get('/me', authenticate, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, email, full_name, profile_key, role, active, must_change_password FROM users WHERE id = ? AND active = 1 LIMIT 1',
            [req.user.userId]
        );
        if (!rows[0]) return res.status(401).json({ error: 'Usuario no disponible' });
        return res.json(publicUser(rows[0]));
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'No se pudo leer la sesión' });
    }
});

router.post('/password', authenticate, async (req, res) => {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    if (newPassword.length < 8) {
        return res.status(400).json({ error: 'La clave nueva debe tener al menos 8 caracteres' });
    }

    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE id = ? AND active = 1', [req.user.userId]);
        const user = rows[0];
        if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
            return res.status(401).json({ error: 'La contraseña actual no coincide' });
        }
        const passwordHash = await bcrypt.hash(newPassword, 10);
        await pool.query(
            'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?',
            [passwordHash, user.id]
        );
        return res.json({ ok: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'No se pudo cambiar la contraseña' });
    }
});

export default router;
