import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { buildSeedTasks } from './data/seed.js';

dotenv.config();

export const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true,
    charset: 'utf8mb4',
});

const STARTER_USERS = [
    { email: 'director.controller@colbeef.com', fullName: 'Arley Quesada', profileKey: 'arley', role: 'admin' },
    { email: 'control.interno@colbeef.com', fullName: 'Laura Higuera', profileKey: 'laura', role: 'member' },
    { email: 'lider.proyectos@colbeef.com', fullName: 'Diego Rojas', profileKey: 'diego', role: 'member' },
];

async function ensureTables() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(190) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(120) NOT NULL,
            profile_key VARCHAR(32) NOT NULL,
            role ENUM('admin', 'member') NOT NULL DEFAULT 'member',
            active TINYINT(1) NOT NULL DEFAULT 1,
            must_change_password TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_users_profile (profile_key)
        ) ENGINE=InnoDB
    `);
    try {
        await pool.query('ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0');
    } catch (err) {
        if (err.code !== 'ER_DUP_FIELDNAME') throw err;
    }
    try {
        await pool.query('ALTER TABLE users ADD UNIQUE KEY uq_users_profile (profile_key)');
    } catch (err) {
        if (err.code !== 'ER_DUP_KEYNAME') throw err;
    }
    await pool.query(`
        CREATE TABLE IF NOT EXISTS tasks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            assignee VARCHAR(32) NOT NULL,
            priority VARCHAR(20) NOT NULL,
            start_date DATE NOT NULL,
            due_date DATE NOT NULL,
            estimated_hours INT NOT NULL DEFAULT 8,
            status VARCHAR(40) NOT NULL,
            progress INT NOT NULL DEFAULT 0,
            created_at BIGINT NOT NULL,
            updated_at BIGINT NOT NULL,
            INDEX idx_tasks_assignee (assignee),
            INDEX idx_tasks_due (due_date)
        ) ENGINE=InnoDB
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS task_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            task_id INT NOT NULL,
            body TEXT NOT NULL,
            author VARCHAR(120) NOT NULL,
            logged_at VARCHAR(80) NOT NULL,
            CONSTRAINT fk_task_logs_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        ) ENGINE=InnoDB
    `);
}

export async function insertSeedTasks(conn = pool) {
    const now = Date.now();
    for (const task of buildSeedTasks()) {
        const [result] = await conn.query(
            `INSERT INTO tasks
                (title, description, assignee, priority, start_date, due_date, estimated_hours, status, progress, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                task.title,
                task.description,
                task.assignee,
                task.priority,
                task.startDate,
                task.dueDate,
                task.estimatedHours,
                task.status,
                task.progress,
                now,
                now,
            ]
        );
        for (const log of task.logs) {
            await conn.query(
                'INSERT INTO task_logs (task_id, body, author, logged_at) VALUES (?, ?, ?, ?)',
                [result.insertId, log.text, log.author, log.timestamp]
            );
        }
    }
}

export async function prepareDatabase() {
    if (!process.env.DB_USER || !process.env.DB_NAME) {
        throw new Error('Faltan DB_USER y DB_NAME en el archivo .env');
    }
    if (!process.env.JWT_SECRET) {
        throw new Error('Falta JWT_SECRET en el archivo .env');
    }

    await pool.query('SELECT 1');
    await ensureTables();

    const [userCountRows] = await pool.query('SELECT COUNT(*) AS total FROM users');
    if (Number(userCountRows[0].total) === 0) {
        const initialPassword = process.env.INITIAL_PASSWORD;
        if (!initialPassword || initialPassword.length < 8) {
            throw new Error('La tabla de usuarios está vacía. Define INITIAL_PASSWORD en .env (mínimo 8 caracteres) y reinicia.');
        }
        const passwordHash = await bcrypt.hash(initialPassword, 10);
        for (const user of STARTER_USERS) {
            await pool.query(
                `INSERT INTO users (email, password_hash, full_name, profile_key, role) VALUES (?, ?, ?, ?, ?)`,
                [user.email, passwordHash, user.fullName, user.profileKey, user.role]
            );
        }
        console.log('Usuarios iniciales creados. Cada persona debe cambiar su clave al entrar.');
    }

    const [taskCountRows] = await pool.query('SELECT COUNT(*) AS total FROM tasks');
    if (Number(taskCountRows[0].total) === 0) {
        await insertSeedTasks();
        console.log('Se cargaron las 12 tareas de ejemplo del equipo Controller.');
    }
}
