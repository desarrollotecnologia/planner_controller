import { Router } from 'express';
import { insertSeedTasks, pool } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

const STATUSES = ['En planeación', 'En progreso', 'En revisión', 'Finalizado'];
const PRIORITIES = ['Alta', 'Media', 'Baja'];
const BASE_ASSIGNEES = ['arley', 'laura', 'diego', 'data'];

router.use(authenticate);

function mapTask(row, logs) {
    return {
        id: String(row.id),
        title: row.title,
        description: row.description || '',
        assignee: row.assignee,
        priority: row.priority,
        startDate: row.start_date,
        dueDate: row.due_date,
        estimatedHours: Number(row.estimated_hours) || 0,
        status: row.status,
        progress: Number(row.progress) || 0,
        logs,
        createdAt: Number(row.created_at) || 0,
        updatedAt: Number(row.updated_at) || 0,
    };
}

async function logsByTask(ids) {
    const grouped = new Map();
    if (!ids.length) return grouped;
    const [rows] = await pool.query(
        'SELECT task_id, body, author, logged_at FROM task_logs WHERE task_id IN (?) ORDER BY id ASC',
        [ids]
    );
    for (const row of rows) {
        const list = grouped.get(row.task_id) || [];
        list.push({ text: row.body, author: row.author, timestamp: row.logged_at });
        grouped.set(row.task_id, list);
    }
    return grouped;
}

function canTouch(user, task) {
    return user.role === 'admin' || task.assignee === user.profileKey;
}

async function assigneeAllowed(key) {
    if (BASE_ASSIGNEES.includes(key)) return true;
    const [rows] = await pool.query('SELECT id FROM users WHERE profile_key = ? LIMIT 1', [key]);
    return rows.length > 0;
}

function cleanLogs(logs) {
    if (!Array.isArray(logs)) return [];
    return logs
        .filter((log) => log && String(log.text || '').trim())
        .map((log) => ({
            text: String(log.text).trim().slice(0, 2000),
            author: String(log.author || 'Equipo').slice(0, 120),
            timestamp: String(log.timestamp || '').slice(0, 80),
        }));
}

function readTaskBody(user, body, { partial, existing }) {
    const next = {
        title: body.title !== undefined ? String(body.title).trim() : existing?.title,
        description: body.description !== undefined ? String(body.description).trim() : (existing?.description || ''),
        assignee: body.assignee !== undefined ? body.assignee : existing?.assignee,
        priority: body.priority !== undefined ? body.priority : existing?.priority,
        startDate: body.startDate !== undefined ? body.startDate : existing?.start_date,
        dueDate: body.dueDate !== undefined ? body.dueDate : existing?.due_date,
        estimatedHours: body.estimatedHours !== undefined ? Number(body.estimatedHours) : Number(existing?.estimated_hours),
        status: body.status !== undefined ? body.status : existing?.status,
        progress: body.progress !== undefined ? Number(body.progress) : Number(existing?.progress),
        logs: body.logs !== undefined ? cleanLogs(body.logs) : null,
    };

    if (user.role !== 'admin') {
        next.assignee = user.profileKey;
    }
    if (!partial || body.title !== undefined) {
        if (!next.title) return { error: 'El título es obligatorio' };
    }
    if (!/^[a-z][a-z0-9_]{1,31}$/.test(next.assignee || '')) return { error: 'Responsable no válido' };
    if (!PRIORITIES.includes(next.priority)) return { error: 'Prioridad no válida' };
    if (!STATUSES.includes(next.status)) return { error: 'Estado no válido' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next.startDate || '') || !/^\d{4}-\d{2}-\d{2}$/.test(next.dueDate || '')) {
        return { error: 'Las fechas deben tener formato AAAA-MM-DD' };
    }
    if (!Number.isFinite(next.estimatedHours) || next.estimatedHours < 0) next.estimatedHours = 0;
    if (!Number.isFinite(next.progress)) next.progress = 0;
    next.progress = Math.max(0, Math.min(100, Math.round(next.progress)));
    next.title = String(next.title).slice(0, 255);
    return { data: next };
}

async function replaceLogs(conn, taskId, logs) {
    await conn.query('DELETE FROM task_logs WHERE task_id = ?', [taskId]);
    for (const log of logs) {
        await conn.query(
            'INSERT INTO task_logs (task_id, body, author, logged_at) VALUES (?, ?, ?, ?)',
            [taskId, log.text, log.author, log.timestamp]
        );
    }
}

router.get('/', async (req, res) => {
    try {
        const params = [];
        let where = '';
        if (req.user.role !== 'admin') {
            where = 'WHERE assignee = ?';
            params.push(req.user.profileKey);
        }
        const [tasks] = await pool.query(
            `SELECT * FROM tasks ${where} ORDER BY created_at DESC, id DESC`,
            params
        );
        const grouped = await logsByTask(tasks.map((task) => task.id));
        return res.json(tasks.map((task) => mapTask(task, grouped.get(task.id) || [])));
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'No se pudieron leer las tareas' });
    }
});

router.post('/', async (req, res) => {
    const parsed = readTaskBody(req.user, req.body || {}, { partial: false, existing: null });
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    if (!(await assigneeAllowed(parsed.data.assignee))) {
        return res.status(400).json({ error: 'Responsable no válido' });
    }
    const task = parsed.data;
    const now = Date.now();
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [result] = await conn.query(
            `INSERT INTO tasks
                (title, description, assignee, priority, start_date, due_date, estimated_hours, status, progress, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [task.title, task.description, task.assignee, task.priority, task.startDate, task.dueDate, task.estimatedHours, task.status, task.progress, now, now]
        );
        await replaceLogs(conn, result.insertId, task.logs || []);
        await conn.commit();
        return res.status(201).json({ id: String(result.insertId) });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        return res.status(500).json({ error: 'No se pudo crear la tarea' });
    } finally {
        conn.release();
    }
});

router.put('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Tarea no válida' });
    const conn = await pool.getConnection();
    try {
        const [rows] = await conn.query('SELECT * FROM tasks WHERE id = ?', [id]);
        const existing = rows[0];
        if (!existing) return res.status(404).json({ error: 'La tarea no existe' });
        if (!canTouch(req.user, existing)) return res.status(403).json({ error: 'No puedes modificar esta tarea' });

        const parsed = readTaskBody(req.user, req.body || {}, { partial: false, existing });
        if (parsed.error) return res.status(400).json({ error: parsed.error });
    if (!(await assigneeAllowed(parsed.data.assignee))) {
        return res.status(400).json({ error: 'Responsable no válido' });
    }
        const task = parsed.data;

        await conn.beginTransaction();
        await conn.query(
            `UPDATE tasks SET title = ?, description = ?, assignee = ?, priority = ?, start_date = ?, due_date = ?,
                estimated_hours = ?, status = ?, progress = ?, updated_at = ? WHERE id = ?`,
            [task.title, task.description, task.assignee, task.priority, task.startDate, task.dueDate, task.estimatedHours, task.status, task.progress, Date.now(), id]
        );
        await replaceLogs(conn, id, task.logs || []);
        await conn.commit();
        return res.json({ id: String(id) });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        return res.status(500).json({ error: 'No se pudo guardar la tarea' });
    } finally {
        conn.release();
    }
});

router.patch('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Tarea no válida' });
    const conn = await pool.getConnection();
    try {
        const [rows] = await conn.query('SELECT * FROM tasks WHERE id = ?', [id]);
        const existing = rows[0];
        if (!existing) return res.status(404).json({ error: 'La tarea no existe' });
        if (!canTouch(req.user, existing)) return res.status(403).json({ error: 'No puedes modificar esta tarea' });

        const parsed = readTaskBody(req.user, req.body || {}, { partial: true, existing });
        if (parsed.error) return res.status(400).json({ error: parsed.error });
    if (!(await assigneeAllowed(parsed.data.assignee))) {
        return res.status(400).json({ error: 'Responsable no válido' });
    }
        const task = parsed.data;

        await conn.beginTransaction();
        await conn.query(
            `UPDATE tasks SET title = ?, description = ?, assignee = ?, priority = ?, start_date = ?, due_date = ?,
                estimated_hours = ?, status = ?, progress = ?, updated_at = ? WHERE id = ?`,
            [task.title, task.description, task.assignee, task.priority, task.startDate, task.dueDate, task.estimatedHours, task.status, task.progress, Date.now(), id]
        );
        if (task.logs) await replaceLogs(conn, id, task.logs);
        await conn.commit();
        return res.json({ id: String(id) });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        return res.status(500).json({ error: 'No se pudo actualizar la tarea' });
    } finally {
        conn.release();
    }
});

router.delete('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Tarea no válida' });
    try {
        const [rows] = await pool.query('SELECT * FROM tasks WHERE id = ?', [id]);
        const existing = rows[0];
        if (!existing) return res.status(404).json({ error: 'La tarea no existe' });
        if (!canTouch(req.user, existing)) return res.status(403).json({ error: 'No puedes eliminar esta tarea' });
        await pool.query('DELETE FROM tasks WHERE id = ?', [id]);
        return res.json({ ok: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'No se pudo eliminar la tarea' });
    }
});

router.post('/restore', requireAdmin, async (_req, res) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query('DELETE FROM tasks');
        await insertSeedTasks(conn);
        await conn.commit();
        return res.json({ ok: true });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        return res.status(500).json({ error: 'No se pudieron restaurar las tareas de ejemplo' });
    } finally {
        conn.release();
    }
});

export default router;
