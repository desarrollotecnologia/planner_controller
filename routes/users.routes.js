import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { authenticate, DIRECTOR_EMAIL, publicUser, requireDirector, standardPassword } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

function readUserBody(body) {
    const email = String(body.email || '').trim().toLowerCase();
    const fullName = String(body.fullName || '').trim();
    const profileKey = String(body.profileKey || '').trim().toLowerCase();
    const role = body.role === 'admin' ? 'admin' : 'member';
    const active = body.active === undefined ? true : Boolean(body.active);

    if (!email.includes('@') || email.length > 190) return { error: 'Correo no válido' };
    if (fullName.length < 3 || fullName.length > 120) return { error: 'El nombre es obligatorio' };
    if (!/^[a-z][a-z0-9_]{1,31}$/.test(profileKey)) {
        return { error: 'El perfil debe empezar por letra y usar solo minúsculas, números o _' };
    }
    return { data: { email, fullName, profileKey, role, active } };
}

router.get('/profiles', async (_req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT profile_key, full_name, role FROM users WHERE active = 1 ORDER BY full_name'
        );
        return res.json(rows.map((row) => ({
            profileKey: row.profile_key,
            fullName: row.full_name,
            role: row.role,
        })));
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'No se pudieron leer los perfiles' });
    }
});

router.get('/', requireDirector, async (_req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, email, full_name, profile_key, role, active, must_change_password FROM users ORDER BY full_name'
        );
        return res.json({
            standardPassword: standardPassword(),
            users: rows.map(publicUser),
        });
    } catch (err) {
        console.error(err);
        return res.status(err.status || 500).json({ error: err.status ? err.message : 'No se pudieron leer los usuarios' });
    }
});

router.post('/', requireDirector, async (req, res) => {
    const parsed = readUserBody(req.body || {});
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const user = parsed.data;
    try {
        const passwordHash = await bcrypt.hash(standardPassword(), 10);
        const [result] = await pool.query(
            `INSERT INTO users (email, password_hash, full_name, profile_key, role, active, must_change_password)
             VALUES (?, ?, ?, ?, ?, ?, 1)`,
            [user.email, passwordHash, user.fullName, user.profileKey, user.role, user.active ? 1 : 0]
        );
        return res.status(201).json({ id: result.insertId, standardPassword: standardPassword() });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Ese correo o ese perfil ya existe' });
        }
        console.error(err);
        return res.status(err.status || 500).json({ error: err.status ? err.message : 'No se pudo crear el usuario' });
    }
});

router.put('/:id', requireDirector, async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Usuario no válido' });
    const parsed = readUserBody(req.body || {});
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const user = parsed.data;

    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
        const existing = rows[0];
        if (!existing) return res.status(404).json({ error: 'El usuario no existe' });

        const isDirectorAccount = existing.email.toLowerCase() === DIRECTOR_EMAIL;
        if (isDirectorAccount && (user.role !== 'admin' || !user.active || user.email !== DIRECTOR_EMAIL)) {
            return res.status(400).json({ error: 'La cuenta del director controller no se puede desactivar ni cambiar de correo' });
        }

        await pool.query(
            `UPDATE users SET email = ?, full_name = ?, profile_key = ?, role = ?, active = ? WHERE id = ?`,
            [user.email, user.fullName, user.profileKey, user.role, user.active ? 1 : 0, id]
        );
        return res.json({ ok: true });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Ese correo o ese perfil ya existe' });
        }
        console.error(err);
        return res.status(500).json({ error: 'No se pudo editar el usuario' });
    }
});

router.delete('/:id', requireDirector, async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Usuario no válido' });
    try {
        const [rows] = await pool.query('SELECT email FROM users WHERE id = ?', [id]);
        if (!rows[0]) return res.status(404).json({ error: 'El usuario no existe' });
        if (rows[0].email.toLowerCase() === DIRECTOR_EMAIL) {
            return res.status(400).json({ error: 'No se puede eliminar la cuenta del director controller' });
        }
        await pool.query('DELETE FROM users WHERE id = ?', [id]);
        return res.json({ ok: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'No se pudo eliminar el usuario' });
    }
});

router.post('/:id/reset-password', requireDirector, async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Usuario no válido' });
    try {
        const password = standardPassword();
        const passwordHash = await bcrypt.hash(password, 10);
        const [result] = await pool.query(
            'UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?',
            [passwordHash, id]
        );
        if (!result.affectedRows) return res.status(404).json({ error: 'El usuario no existe' });
        return res.json({ ok: true, standardPassword: password });
    } catch (err) {
        console.error(err);
        return res.status(err.status || 500).json({ error: err.status ? err.message : 'No se pudo restablecer la clave' });
    }
});

export default router;
