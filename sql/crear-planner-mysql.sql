-- ============================================================
-- Planificador Controller — ejecutar en MySQL Workbench
-- Usar una conexión con permisos de administrador (root)
-- En el servidor 205, MySQL y Node van en la misma máquina.
-- ============================================================

-- 1. Base de datos
CREATE DATABASE IF NOT EXISTS colbeef_planner
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 2. Usuario propio de esta aplicación
--    CAMBIE 'Planner2026!' por la contraseña que usará el .env (DB_PASSWORD)
CREATE USER IF NOT EXISTS 'planner'@'localhost' IDENTIFIED BY 'Planner2026!';

-- 3. Permisos solo sobre esta base
GRANT ALL PRIVILEGES ON colbeef_planner.* TO 'planner'@'localhost';
FLUSH PRIVILEGES;

USE colbeef_planner;

-- 4. Usuarios de la aplicación (las claves las crea el servidor la primera vez)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  profile_key VARCHAR(32) NOT NULL,
  role ENUM('admin', 'member', 'superadmin') NOT NULL DEFAULT 'member',
  active TINYINT(1) NOT NULL DEFAULT 1,
  must_change_password TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_profile (profile_key)
) ENGINE=InnoDB;

-- 5. Tareas del plan
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
) ENGINE=InnoDB;

-- 6. Bitácora
CREATE TABLE IF NOT EXISTS task_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  body TEXT NOT NULL,
  author VARCHAR(120) NOT NULL,
  logged_at VARCHAR(80) NOT NULL,
  CONSTRAINT fk_task_logs_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7. Usabilidad (ingresos y vistas). La cuenta TIC la crea el servidor.
CREATE TABLE IF NOT EXISTS activity_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_email VARCHAR(190) NOT NULL,
  action VARCHAR(40) NOT NULL,
  detail VARCHAR(255) NOT NULL DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_activity_created (created_at),
  INDEX idx_activity_email (user_email)
) ENGINE=InnoDB;

SHOW DATABASES LIKE 'colbeef_planner';
SELECT user, host FROM mysql.user WHERE user = 'planner';
