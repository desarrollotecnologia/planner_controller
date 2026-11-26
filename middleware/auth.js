import jwt from 'jsonwebtoken';

export function signToken(user) {
    return jwt.sign(
        {
            userId: user.id,
            email: user.email,
            profileKey: user.profile_key,
            role: user.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );
}

export function authenticate(req, res, next) {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token no proporcionado' });
    }
    try {
        req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }
}

export const DIRECTOR_EMAIL = 'director.controller@colbeef.com';
export const SUPERADMIN_EMAIL = 'tic@colbeef.com';

export function seesAll(user) {
    return user?.role === 'admin' || user?.role === 'superadmin';
}

export function isSuperAdminAccount(row) {
    if (!row) return false;
    return row.role === 'superadmin' || String(row.email || '').toLowerCase() === SUPERADMIN_EMAIL;
}

export function requireAdmin(req, res, next) {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'No tiene permisos para esta acción' });
    }
    next();
}

export function requireDirector(req, res, next) {
    if ((req.user?.email || '').toLowerCase() !== DIRECTOR_EMAIL) {
        return res.status(403).json({ error: 'Solo el director controller puede gestionar usuarios' });
    }
    next();
}

export function requireSuperAdmin(req, res, next) {
    if (req.user?.role !== 'superadmin') {
        return res.status(403).json({ error: 'Solo el super admin puede ver la usabilidad' });
    }
    next();
}

export function standardPassword() {
    const value = process.env.STANDARD_PASSWORD || process.env.INITIAL_PASSWORD || '';
    if (value.length < 8) {
        const error = new Error('Define STANDARD_PASSWORD en .env con al menos 8 caracteres');
        error.status = 500;
        throw error;
    }
    return value;
}

export function publicUser(row) {
    return {
        id: row.id,
        email: row.email,
        fullName: row.full_name,
        profileKey: row.profile_key,
        role: row.role,
        active: row.active === undefined ? true : Boolean(row.active),
        mustChangePassword: Boolean(row.must_change_password),
    };
}
