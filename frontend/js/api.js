const TOKEN_KEY = 'planner_token';

export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(path, {
        ...options,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.error || 'Error del servidor');
        error.status = response.status;
        throw error;
    }
    return data;
}

export const api = {
    login(email, password) {
        return request('/api/auth/login', { method: 'POST', body: { email, password } });
    },
    me() {
        return request('/api/auth/me');
    },
    changePassword(currentPassword, newPassword) {
        return request('/api/auth/password', { method: 'POST', body: { currentPassword, newPassword } });
    },
    profiles() {
        return request('/api/users/profiles');
    },
    listUsers() {
        return request('/api/users');
    },
    createUser(user) {
        return request('/api/users', { method: 'POST', body: user });
    },
    updateUser(id, user) {
        return request(`/api/users/${id}`, { method: 'PUT', body: user });
    },
    deleteUser(id) {
        return request(`/api/users/${id}`, { method: 'DELETE' });
    },
    resetUserPassword(id) {
        return request(`/api/users/${id}/reset-password`, { method: 'POST', body: {} });
    },
    listTasks() {
        return request('/api/tasks');
    },
    createTask(task) {
        return request('/api/tasks', { method: 'POST', body: task });
    },
    saveTask(id, task) {
        return request(`/api/tasks/${id}`, { method: 'PUT', body: task });
    },
    patchTask(id, updates) {
        return request(`/api/tasks/${id}`, { method: 'PATCH', body: updates });
    },
    deleteTask(id) {
        return request(`/api/tasks/${id}`, { method: 'DELETE' });
    },
    restoreDemo() {
        return request('/api/tasks/restore', { method: 'POST', body: {} });
    },
};
