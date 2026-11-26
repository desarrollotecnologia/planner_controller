import { Router } from 'express';
import { logActivity, pool } from '../db.js';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';

const router = Router();
const VIEWS = ['dashboard', 'gantt', 'list', 'calendar', 'deadlines', 'users', 'usage'];

router.use(authenticate);

router.post('/', async (req, res) => {
    const view = String(req.body?.view || '').slice(0, 40);
    if (!VIEWS.includes(view)) return res.status(400).json({ error: 'Vista no válida' });
    await logActivity(req.user.email, 'view', view);
    return res.json({ ok: true });
});

router.get('/', requireSuperAdmin, async (_req, res) => {
    try {
        const [byView] = await pool.query(
            `SELECT detail AS viewName, COUNT(*) AS total
             FROM activity_log WHERE action = 'view'
             GROUP BY detail ORDER BY total DESC`
        );
        const [byUser] = await pool.query(
            `SELECT user_email AS email,
                    SUM(action = 'login') AS logins,
                    SUM(action = 'view') AS views,
                    MAX(created_at) AS lastSeen
             FROM activity_log
             GROUP BY user_email
             ORDER BY lastSeen DESC`
        );
        const [recent] = await pool.query(
            `SELECT user_email AS email, action, detail, created_at AS createdAt
             FROM activity_log ORDER BY id DESC LIMIT 40`
        );
        const [[userCount]] = await pool.query('SELECT COUNT(*) AS total FROM users WHERE active = 1');
        const [[taskCount]] = await pool.query('SELECT COUNT(*) AS total FROM tasks');
        const [[loginCount]] = await pool.query("SELECT COUNT(*) AS total FROM activity_log WHERE action = 'login'");
        return res.json({
            users: Number(userCount.total) || 0,
            tasks: Number(taskCount.total) || 0,
            logins: Number(loginCount.total) || 0,
            byView,
            byUser,
            recent,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'No se pudo leer la usabilidad' });
    }
});

export default router;
