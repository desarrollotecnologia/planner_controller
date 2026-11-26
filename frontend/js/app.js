import { api, getToken, setToken } from './api.js';

// ==========================================
// 1. CONSTANTS & CONFIGURATION (COLBEEF BRAND)
// ==========================================
const TEAM = {
    arley: { id: 'arley', name: 'Arley Quesada', area: 'Dirección Controller', short: 'Arley (Controller)', color: '#1F962B', bg: 'bg-[#EAF7EC]', text: 'text-[#1F962B]', border: 'border-[#1F962B]/30', avatar: 'AQ' },
    laura: { id: 'laura', name: 'Laura Higuera', area: 'Control Interno', short: 'Laura (C. Interno)', color: '#DA2925', bg: 'bg-[#FDECEC]', text: 'text-[#DA2925]', border: 'border-[#DA2925]/30', avatar: 'LH' },
    diego: { id: 'diego', name: 'Diego Rojas', area: 'PMO', short: 'Diego (PMO)', color: '#2563EB', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', avatar: 'DR' },
    data:  { id: 'data',  name: 'Pdte. contratación', area: 'DATA', short: 'DATA (Vacante)', color: '#0F172A', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', avatar: 'DT' }
};

const DIRECTOR_EMAIL = 'director.controller@colbeef.com';
const TIC_EMAIL = 'tic@colbeef.com';
const EXTRA_PROFILES = {};

function memberOf(key) {
    const known = TEAM[key];
    const extra = EXTRA_PROFILES[key];
    if (known) {
        return extra ? { ...known, name: extra.fullName } : known;
    }
    const name = extra?.fullName || key;
    return {
        id: key,
        name,
        area: name,
        short: name,
        color: '#0F172A',
        bg: 'bg-slate-100',
        text: 'text-slate-700',
        border: 'border-slate-300',
        avatar: String(name).slice(0, 2).toUpperCase(),
    };
}

function profileKeys() {
    return [...new Set([...Object.keys(TEAM), ...Object.keys(EXTRA_PROFILES)])];
}

function isDirector() {
    return activeUserEmail === DIRECTOR_EMAIL;
}

function isSuperAdmin() {
    return currentUserRole === 'superadmin';
}

function seesAll() {
    return isAdmin() || isSuperAdmin();
}

const STATUS_CONFIG = {
    'En planeación': { color: '#64748B', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', bar: 'bg-[#64748B]/75', barFill: 'bg-[#64748B]' },
    'En progreso':   { color: '#2563EB', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', bar: 'bg-[#2563EB]/75', barFill: 'bg-[#2563EB]' },
    'En revisión':   { color: '#D97706', bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  bar: 'bg-[#D97706]/75',  barFill: 'bg-[#D97706]' },
    'Finalizado':    { color: '#1F962B', bg: 'bg-[#EAF7EC]',text: 'text-[#1F962B]',border: 'border-[#1F962B]/30',bar: 'bg-[#1F962B]/75',barFill: 'bg-[#1F962B]' }
};

const PRIORITY_CONFIG = {
    'Alta':  { bg: 'bg-[#FDECEC]', text: 'text-[#DA2925]', border: 'border-[#DA2925]/30', icon: 'fa-angles-up' },
    'Media': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: 'fa-equals' },
    'Baja':  { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', icon: 'fa-angles-down' }
};

// ==========================================
// 2. APPLICATION STATE
// ==========================================
let activeUserEmail = '';
let currentUserRole = 'member';
let mustChangePassword = false;
let pollTimer = null;
let lastSnapshot = '';

let allTasks = [];
let currentView = 'dashboard';
let loggedInProfile = 'arley';
let activeProfile = 'arley';
let tempModalLogs = [];

function isAdmin() {
    return currentUserRole === 'admin';
}

// Filters
let filters = {
    search: '',
    assignee: 'all',
    status: 'all',
    priority: 'all',
    onlyMine: false
};

// Gantt & Calendar Dates
let ganttStartDate = getMonday(new Date());
ganttStartDate.setDate(ganttStartDate.getDate() - 3);
let calendarDate = new Date();

// Chart Instances
let charts = {
    status: null,
    workload: null,
    progress: null,
    deadlines: null
};

// ==========================================
// 3. DATE & UTILITY HELPERS
// ==========================================
function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function formatDateISO(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getTodayISO() {
    return formatDateISO(new Date());
}

function getDaysDiff(isoA, isoB) {
    if (!isoA || !isoB) return 0;
    const a = new Date(isoA + 'T00:00:00');
    const b = new Date(isoB + 'T00:00:00');
    return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function formatDisplayDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

function getDeadlineStatus(task) {
    if (task.status === 'Finalizado') return 'done';
    const diff = getDaysDiff(getTodayISO(), task.dueDate);
    if (diff < 0) return 'overdue';
    if (diff <= 2) return 'soon';
    return 'ok';
}

// ==========================================
// 4. SESIÓN, MYSQL Y GUARDADO
// ==========================================
function setAuthenticatedUI(user) {
    activeUserEmail = (user.email || '').toLowerCase().trim();
    loggedInProfile = user.profileKey || loggedInProfile;
    currentUserRole = user.role || 'member';
    activeProfile = loggedInProfile;
    const profileSelect = document.getElementById('activeProfileSelect');
    if (profileSelect && TEAM[loggedInProfile]) profileSelect.value = loggedInProfile;
    applyRolePermissions();
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('loginError').classList.add('hidden');
    document.getElementById('loginSuccess').classList.add('hidden');
}

function applyRolePermissions() {
    const viewer = seesAll();
    const profileSelect = document.getElementById('activeProfileSelect');
    const filterAssignee = document.getElementById('filterAssignee');
    const btnMyTasks = document.getElementById('btnMyTasks');
    const btnNewTask = document.getElementById('btnNewTask');
    const roleBadge = document.getElementById('roleBadge');
    const tabUsers = document.getElementById('tabUsers');
    const tabUsage = document.getElementById('tabUsage');

    if (tabUsers) tabUsers.classList.toggle('hidden', !isDirector());
    if (tabUsage) tabUsage.classList.toggle('hidden', !isSuperAdmin());
    if (btnNewTask) btnNewTask.classList.toggle('hidden', isSuperAdmin());

    if (viewer) {
        profileSelect.disabled = false;
        profileSelect.classList.remove('opacity-75', 'cursor-not-allowed');
        filterAssignee.classList.remove('hidden');
        filterAssignee.value = 'all';
        filters.assignee = 'all';
        btnMyTasks.classList.remove('hidden');
        if (roleBadge) {
            roleBadge.textContent = isSuperAdmin() ? 'Super admin' : 'Admin';
            roleBadge.className = isSuperAdmin()
                ? 'ml-1.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-slate-800 text-white'
                : 'ml-1.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-[#EAF7EC] text-[#1F962B] border border-[#1F962B]/30';
        }
    } else {
        activeProfile = loggedInProfile;
        profileSelect.value = loggedInProfile;
        profileSelect.disabled = true;
        profileSelect.classList.add('opacity-75', 'cursor-not-allowed');
        filterAssignee.classList.add('hidden');
        filterAssignee.value = loggedInProfile;
        filters.assignee = loggedInProfile;
        filters.onlyMine = false;
        btnMyTasks.classList.add('hidden');
        if (roleBadge) {
            roleBadge.textContent = 'Mis tareas';
            roleBadge.className = 'ml-1.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-700';
        }
    }
}

function showLoginError(msg) {
    document.getElementById('loginSuccess').classList.add('hidden');
    const box = document.getElementById('loginError');
    document.getElementById('loginErrorText').textContent = msg;
    box.classList.remove('hidden');
}

function showLoginSuccess(msg) {
    document.getElementById('loginError').classList.add('hidden');
    const box = document.getElementById('loginSuccess');
    document.getElementById('loginSuccessText').textContent = msg;
    box.classList.remove('hidden');
}

function updateSyncUI(mode, uid = '') {
    const badge = document.getElementById('syncBadge');
    const dot = document.getElementById('syncDot');
    const text = document.getElementById('syncText');
    const uidEl = document.getElementById('userIdBadge');

    if (mode === 'online') {
        badge.className = 'inline-flex items-center gap-1.5 text-xs font-medium text-[#1F962B] bg-[#EAF7EC] border border-[#1F962B]/25 px-2.5 py-0.5 rounded-full';
        dot.className = 'w-2 h-2 rounded-full bg-[#1F962B] live-dot';
        text.textContent = 'Conectado al servidor';
    } else {
        badge.className = 'inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full';
        dot.className = 'w-2 h-2 rounded-full bg-amber-500';
        text.textContent = 'Sin conexión al servidor';
    }

    if (uid) {
        uidEl.textContent = uid;
        uidEl.title = `Sesión activa: ${uid}`;
    }
}

function stopPolling() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
}

function startPolling() {
    stopPolling();
    pollTimer = setInterval(() => {
        refreshTasks(true);
    }, 8000);
}

async function refreshTasks(silent = false) {
    try {
        const tasks = await api.listTasks();
        const snap = JSON.stringify(tasks);
        if (snap !== lastSnapshot) {
            lastSnapshot = snap;
            allTasks = tasks;
            finishLoading();
        } else if (!silent) {
            finishLoading();
        }
        updateSyncUI('online', activeUserEmail);
    } catch (err) {
        console.error(err);
        if (err.status === 401) {
            forceLogout(false);
            showLoginError('La sesión expiró. Vuelve a ingresar.');
            return;
        }
        updateSyncUI('offline');
        if (!silent) showToast(err.message || 'No se pudo leer la base del servidor', 'error');
        finishLoading();
    }
}

function updatePasswordBanner() {
    document.getElementById('mustChangeBanner').classList.toggle('hidden', !mustChangePassword);
}

async function loadProfiles() {
    try {
        const profiles = await api.profiles();
        Object.keys(EXTRA_PROFILES).forEach((key) => delete EXTRA_PROFILES[key]);
        profiles.forEach((profile) => {
            EXTRA_PROFILES[profile.profileKey] = profile;
        });
        syncAssigneeOptions();
    } catch (err) {
        console.error(err);
    }
}

function syncAssigneeOptions() {
    const keys = profileKeys();
    const options = keys.map((key) => `<option value="${key}">${escapeHtml(memberOf(key).short)}</option>`).join('');
    const filterAssignee = document.getElementById('filterAssignee');
    const activeProfile = document.getElementById('activeProfileSelect');
    const taskAssignee = document.getElementById('taskAssignee');
    const keep = (select, html, fallback) => {
        const current = select.value;
        select.innerHTML = html;
        select.value = [...select.options].some((option) => option.value === current) ? current : fallback;
    };
    keep(filterAssignee, `<option value="all">Todos los responsables</option>${options}`, 'all');
    keep(activeProfile, options, loggedInProfile);
    keep(taskAssignee, options, loggedInProfile);
}

async function enterSession(user, greet = false) {
    mustChangePassword = Boolean(user.mustChangePassword);
    setAuthenticatedUI(user);
    updatePasswordBanner();
    updateSyncUI('online', user.email);
    lastSnapshot = '';
    await loadProfiles();
    await refreshTasks();
    startPolling();
    if (mustChangePassword) openPasswordModal();
    if (greet) showToast(`Bienvenido(a), ${memberOf(loggedInProfile).name || user.fullName}`, 'success');
}

function forceLogout(showNotice = true) {
    stopPolling();
    setToken(null);
    allTasks = [];
    lastSnapshot = '';
    activeUserEmail = '';
    mustChangePassword = false;
    updatePasswordBanner();
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginScreen').classList.remove('hidden');
    if (showNotice) showToast('Sesión cerrada', 'info');
}

async function initApp() {
    document.getElementById('loginScreen').classList.remove('hidden');
    if (!getToken()) return;
    try {
        const user = await api.me();
        await enterSession(user);
    } catch (err) {
        setToken(null);
        if (err.status !== 401) showLoginError('No hay conexión con el servidor.');
    }
}

function finishLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
    switchView(currentView);
}

async function saveTaskToDB(taskData, id = null) {
    try {
        if (id) await api.saveTask(id, taskData);
        else await api.createTask(taskData);
        lastSnapshot = '';
        await refreshTasks(true);
        showToast(id ? 'Tarea actualizada' : 'Nueva tarea creada', 'success');
    } catch (err) {
        console.error(err);
        showToast(err.message || 'Error al guardar la tarea', 'error');
    }
}

async function quickUpdateTask(id, updates) {
    if (isSuperAdmin()) {
        showToast('Esta cuenta solo visualiza la información', 'error');
        return;
    }
    try {
        await api.patchTask(id, updates);
        lastSnapshot = '';
        await refreshTasks(true);
    } catch (err) {
        console.error(err);
        showToast(err.message || 'Error al actualizar', 'error');
    }
}

async function deleteTaskFromDB(id) {
    if (isSuperAdmin()) return;
    try {
        await api.deleteTask(id);
        lastSnapshot = '';
        await refreshTasks(true);
        showToast('Tarea eliminada', 'info');
    } catch (err) {
        console.error(err);
        showToast(err.message || 'Error al eliminar tarea', 'error');
    }
}

function openPasswordModal() {
    document.getElementById('passwordForm').reset();
    document.getElementById('passwordModal').classList.remove('hidden');
}

function closePasswordModal() {
    document.getElementById('passwordModal').classList.add('hidden');
}


// ==========================================
// 6. FILTERING, EXPORT & VIEW ROUTING
// ==========================================
function getFilteredTasks() {
    return allTasks.filter(t => {
        // Restricción estricta: usuarios no administradores solo ven sus propias tareas
        if (!seesAll() && t.assignee !== loggedInProfile) return false;
        if (filters.onlyMine && t.assignee !== activeProfile) return false;
        if (filters.assignee !== 'all' && t.assignee !== filters.assignee) return false;
        if (filters.status !== 'all' && t.status !== filters.status) return false;
        if (filters.priority !== 'all' && t.priority !== filters.priority) return false;
        if (filters.search.trim() !== '') {
            const q = filters.search.toLowerCase();
            const inTitle = (t.title || '').toLowerCase().includes(q);
            const inDesc = (t.description || '').toLowerCase().includes(q);
            if (!inTitle && !inDesc) return false;
        }
        return true;
    });
}

function exportToCSV() {
    const tasks = getFilteredTasks();
    if (tasks.length === 0) {
        showToast('No hay tareas para exportar', 'info');
        return;
    }
    const headers = ['Título', 'Descripción', 'Responsable', 'Área', 'Estado', 'Avance (%)', 'Prioridad', 'Fecha Inicio', 'Fecha Límite', 'Horas Estimadas'];
    const rows = tasks.map(t => {
        const m = memberOf(t.assignee);
        return [
            `"${(t.title || '').replace(/"/g, '""')}"`,
            `"${(t.description || '').replace(/"/g, '""')}"`,
            `"${m.name}"`,
            `"${m.area}"`,
            `"${t.status}"`,
            t.progress || 0,
            `"${t.priority}"`,
            t.startDate || '',
            t.dueDate || '',
            t.estimatedHours || 0
        ].join(',');
    });
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Plan_Trabajo_Colbeef_${getTodayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Archivo CSV de Colbeef exportado', 'success');
}

function switchView(viewName) {
    if (viewName === 'users' && !isDirector()) viewName = 'dashboard';
    if (viewName === 'usage' && !isSuperAdmin()) viewName = 'dashboard';
    currentView = viewName;
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(`view-${viewName}`);
    if (target) target.classList.remove('hidden');

    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.dataset.view === viewName) {
            btn.className = 'tab-btn whitespace-nowrap px-4 py-2.5 text-sm font-semibold border-b-2 border-[#1F962B] text-[#1F962B] transition flex items-center gap-2';
        } else {
            btn.className = 'tab-btn whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300 transition flex items-center gap-2';
        }
        if (btn.id === 'tabUsers' && !isDirector()) btn.classList.add('hidden');
        if (btn.id === 'tabUsage' && !isSuperAdmin()) btn.classList.add('hidden');
    });

    if (activeUserEmail) api.trackView(viewName).catch(() => {});
    renderCurrentView();
}

function renderCurrentView() {
    const filtered = getFilteredTasks();
    if (currentView === 'dashboard') renderDashboard(filtered);
    else if (currentView === 'gantt') renderGantt(filtered);
    else if (currentView === 'list') renderList(filtered);
    else if (currentView === 'calendar') renderCalendar(filtered);
    else if (currentView === 'deadlines') renderDeadlines(filtered);
    else if (currentView === 'users') renderUsers();
    else if (currentView === 'usage') renderUsage();
}

// ==========================================
// 7. VIEW 1: DASHBOARD EJECUTIVO
// ==========================================
function renderDashboard(tasks) {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'Finalizado').length;
    const avgProgress = total > 0 ? Math.round(tasks.reduce((sum, t) => sum + (Number(t.progress) || 0), 0) / total) : 0;
    const atRisk = tasks.filter(t => {
        const st = getDeadlineStatus(t);
        return st === 'overdue' || st === 'soon';
    }).length;

    const plannedHours = tasks.reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), 0);
    const completedHours = Math.round(tasks.reduce((sum, t) => sum + ((Number(t.estimatedHours) || 0) * ((Number(t.progress) || 0) / 100)), 0));

    document.getElementById('kpiTotal').textContent = total;
    document.getElementById('kpiTotalSub').textContent = `${completed} finalizadas`;
    document.getElementById('kpiAvgProgress').textContent = `${avgProgress}%`;
    document.getElementById('kpiAvgBar').style.width = `${avgProgress}%`;
    document.getElementById('kpiAtRisk').textContent = atRisk;
    document.getElementById('kpiHours').textContent = `${completedHours}h`;
    document.getElementById('kpiHoursSub').textContent = `de ${plannedHours}h planeadas`;

    // Chart 1: Status Doughnut
    const statuses = ['En planeación', 'En progreso', 'En revisión', 'Finalizado'];
    const statusCounts = statuses.map(s => tasks.filter(t => t.status === s).length);
    const statusColors = statuses.map(s => STATUS_CONFIG[s].color);

    if (charts.status) charts.status.destroy();
    charts.status = new Chart(document.getElementById('chartStatus'), {
        type: 'doughnut',
        data: {
            labels: statuses,
            datasets: [{
                data: statusCounts,
                backgroundColor: statusColors,
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            plugins: {
                legend: { position: 'right', labels: { usePointStyle: true, padding: 14, font: { family: 'Inter', size: 12 } } }
            }
        }
    });

    // Chart 2: Stacked Bar Workload by Member & Status
    const memberKeys = seesAll() ? profileKeys() : [loggedInProfile];
    const memberLabels = memberKeys.map(k => memberOf(k).short);
    const datasetsWorkload = statuses.map(status => ({
        label: status,
        data: memberKeys.map(m => tasks.filter(t => t.assignee === m && t.status === status).length),
        backgroundColor: STATUS_CONFIG[status].color,
        borderRadius: 4
    }));

    if (charts.workload) charts.workload.destroy();
    charts.workload = new Chart(document.getElementById('chartWorkload'), {
        type: 'bar',
        data: { labels: memberLabels, datasets: datasetsWorkload },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true, grid: { display: false } },
                y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } }
            },
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true, font: { family: 'Inter', size: 11 } } }
            }
        }
    });

    // Chart 3: Horizontal Bar Avg Progress by Area
    const avgByMember = memberKeys.map(m => {
        const mTasks = tasks.filter(t => t.assignee === m);
        if (mTasks.length === 0) return 0;
        return Math.round(mTasks.reduce((s, t) => s + (Number(t.progress) || 0), 0) / mTasks.length);
    });

    if (charts.progress) charts.progress.destroy();
    charts.progress = new Chart(document.getElementById('chartProgress'), {
        type: 'bar',
        data: {
            labels: memberKeys.map(k => memberOf(k).area),
            datasets: [{
                label: '% Avance Promedio',
                data: avgByMember,
                backgroundColor: memberKeys.map(k => memberOf(k).color),
                borderRadius: 6,
                barThickness: 24
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { min: 0, max: 100, ticks: { callback: v => v + '%' } },
                y: { grid: { display: false } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });

    // Chart 4: Deadlines Semaphore
    let cOverdue = 0, cThisWeek = 0, cOnTrack = 0, cDone = 0;
    const todayISO = getTodayISO();
    tasks.forEach(t => {
        if (t.status === 'Finalizado') { cDone++; return; }
        const diff = getDaysDiff(todayISO, t.dueDate);
        if (diff < 0) cOverdue++;
        else if (diff <= 7) cThisWeek++;
        else cOnTrack++;
    });

    if (charts.deadlines) charts.deadlines.destroy();
    charts.deadlines = new Chart(document.getElementById('chartDeadlines'), {
        type: 'bar',
        data: {
            labels: ['Vencidas', 'Vencen esta semana', 'A tiempo', 'Finalizadas'],
            datasets: [{
                label: 'Tareas',
                data: [cOverdue, cThisWeek, cOnTrack, cDone],
                backgroundColor: ['#DA2925', '#D97706', '#2563EB', '#1F962B'],
                borderRadius: 6,
                barThickness: 36
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// ==========================================
// 8. VIEW 2: DIAGRAMA DE GANTT
// ==========================================
function renderGantt(tasks) {
    const container = document.getElementById('ganttContainer');
    const totalDays = 21;
    const days = [];
    for (let i = 0; i < totalDays; i++) {
        days.push(addDays(ganttStartDate, i));
    }

    const startISO = formatDateISO(days[0]);
    const todayISO = getTodayISO();

    document.getElementById('ganttRangeLabel').textContent = 
        `${days[0].toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} – ${days[totalDays - 1].toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}`;

    let html = `
        <div class="grid border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600" style="grid-template-columns: 240px repeat(${totalDays}, minmax(34px, 1fr));">
            <div class="p-3 border-r border-slate-200 flex items-center">Responsable / Tarea</div>
    `;

    days.forEach(d => {
        const iso = formatDateISO(d);
        const isToday = iso === todayISO;
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        const dayName = d.toLocaleDateString('es-CO', { weekday: 'narrow' }).toUpperCase();
        html += `
            <div class="py-2 text-center border-r border-slate-200/70 ${isToday ? 'bg-[#1F962B] text-white' : isWeekend ? 'bg-slate-100/80 text-slate-400' : ''}">
                <div class="text-[10px] opacity-80">${dayName}</div>
                <div>${d.getDate()}</div>
            </div>
        `;
    });
    html += `</div>`;

    const memberKeys = profileKeys();
    let anyTaskRendered = false;

    memberKeys.forEach(mKey => {
        const member = memberOf(mKey);
        const memberTasks = tasks.filter(t => t.assignee === mKey);
        if (memberTasks.length === 0) return;
        anyTaskRendered = true;

        html += `
            <div class="bg-slate-50/90 border-b border-slate-200 px-3 py-2 flex items-center gap-2">
                <span class="w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center ${member.bg} ${member.text} border ${member.border}">${member.avatar}</span>
                <span class="text-xs font-bold text-slate-800">${member.area}</span>
                <span class="text-xs text-slate-500">– ${member.name}</span>
                <span class="ml-auto text-[11px] font-medium text-slate-400">${memberTasks.length} tareas</span>
            </div>
        `;

        memberTasks.forEach(t => {
            const stCfg = STATUS_CONFIG[t.status] || STATUS_CONFIG['En planeación'];
            const offsetStart = getDaysDiff(startISO, t.startDate);
            const offsetEnd = getDaysDiff(startISO, t.dueDate);

            const visibleStart = Math.max(0, offsetStart);
            const visibleEnd = Math.min(totalDays - 1, offsetEnd);
            const isVisible = offsetEnd >= 0 && offsetStart <= totalDays - 1;

            const leftPct = (visibleStart / totalDays) * 100;
            const widthPct = Math.max(((visibleEnd - visibleStart + 1) / totalDays) * 100, (100 / totalDays));

            html += `
                <div class="grid border-b border-slate-100 hover:bg-slate-50/80 transition items-center" style="grid-template-columns: 240px 1fr;">
                    <div class="px-3 py-2.5 border-r border-slate-200 truncate cursor-pointer" onclick="window.openTaskModal('${t.id}')" title="${escapeHtml(t.title)}">
                        <div class="text-xs font-semibold text-slate-800 truncate">${escapeHtml(t.title)}</div>
                        <div class="text-[10px] text-slate-400 mt-0.5">${formatDisplayDate(t.startDate)} → ${formatDisplayDate(t.dueDate)}</div>
                    </div>
                    <div class="relative h-11 flex items-center">
                        <div class="absolute inset-0 grid pointer-events-none" style="grid-template-columns: repeat(${totalDays}, 1fr);">
                            ${days.map(d => {
                                const iso = formatDateISO(d);
                                const isToday = iso === todayISO;
                                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                return `<div class="border-r border-slate-100 h-full ${isToday ? 'bg-[#EAF7EC]/70 border-r-[#1F962B]/40' : isWeekend ? 'bg-slate-50/70' : ''}"></div>`;
                            }).join('')}
                        </div>
                        ${isVisible ? `
                            <div onclick="window.openTaskModal('${t.id}')"
                                 class="relative z-10 h-7 rounded-lg shadow-xs cursor-pointer overflow-hidden flex items-center px-2 text-white text-[11px] font-semibold transition hover:brightness-95 ${stCfg.bar}"
                                 style="margin-left: ${leftPct}%; width: ${widthPct}%;"
                                 title="${escapeHtml(t.title)} (${t.progress}% - ${t.status})">
                                <div class="absolute inset-y-0 left-0 ${stCfg.barFill} opacity-75 transition-all" style="width: ${t.progress}%;"></div>
                                <span class="relative z-10 truncate drop-shadow-xs">${t.progress}% · ${escapeHtml(t.title)}</span>
                            </div>
                        ` : `
                            <span class="relative z-10 text-[10px] text-slate-400 italic px-3">Fuera del rango visible (${formatDisplayDate(t.startDate)} - ${formatDisplayDate(t.dueDate)})</span>
                        `}
                    </div>
                </div>
            `;
        });
    });

    if (!anyTaskRendered) {
        html += `<div class="p-10 text-center text-sm text-slate-400">No hay tareas que coincidan con los filtros actuales.</div>`;
    }

    container.innerHTML = html;
}

// ==========================================
// 9. VIEW 3: LISTA / TABLA
// ==========================================
function renderList(tasks) {
    const container = document.getElementById('listContainer');
    const groupBy = document.getElementById('listGroupBy').value;
    document.getElementById('listCountBadge').textContent = `${tasks.length} tareas`;

    if (tasks.length === 0) {
        container.innerHTML = `
            <div class="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
                <i class="fa-regular fa-folder-open text-3xl mb-2"></i>
                <p class="text-sm">No se encontraron tareas con los filtros seleccionados.</p>
            </div>`;
        return;
    }

    let groups = [];
    if (groupBy === 'assignee') {
        groups = profileKeys().map(k => ({
            title: `${memberOf(k).area} – ${memberOf(k).name}`,
                    badge: memberOf(k).avatar,
                    badgeClass: `${memberOf(k).bg} ${memberOf(k).text} border ${memberOf(k).border}`,
            items: tasks.filter(t => t.assignee === k)
        })).filter(g => g.items.length > 0);
    } else if (groupBy === 'status') {
        groups = Object.keys(STATUS_CONFIG).map(st => ({
            title: st,
            badge: '',
            badgeClass: `${STATUS_CONFIG[st].bg} ${STATUS_CONFIG[st].text}`,
            items: tasks.filter(t => t.status === st)
        })).filter(g => g.items.length > 0);
    } else {
        groups = [{ title: 'Todas las tareas', badge: '', badgeClass: '', items: tasks }];
    }

    container.innerHTML = groups.map(g => `
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div class="flex items-center gap-2.5">
                    ${g.badge ? `<span class="w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center ${g.badgeClass}">${g.badge}</span>` : ''}
                    <h3 class="text-sm font-bold text-slate-800">${g.title}</h3>
                </div>
                <span class="text-xs font-semibold text-slate-500">${g.items.length} tareas</span>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-white">
                            <th class="py-2.5 px-4">Tarea</th>
                            <th class="py-2.5 px-3">Responsable</th>
                            <th class="py-2.5 px-3">Estado (Edición rápida)</th>
                            <th class="py-2.5 px-3 w-44">Avance</th>
                            <th class="py-2.5 px-3">Fecha Límite</th>
                            <th class="py-2.5 px-3">Prioridad</th>
                            <th class="py-2.5 px-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 text-sm">
                        ${g.items.map(t => renderTableRow(t)).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `).join('');
}

function renderTableRow(t) {
    const member = memberOf(t.assignee);
    const stCfg = STATUS_CONFIG[t.status] || STATUS_CONFIG['En planeación'];
    const prCfg = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG['Media'];
    const dlStatus = getDeadlineStatus(t);

    let alertBadge = '';
    if (dlStatus === 'overdue') {
        alertBadge = `<span class="inline-flex items-center gap-1 text-[10px] font-bold bg-[#FDECEC] text-[#DA2925] px-1.5 py-0.5 rounded-md ml-1.5"><i class="fa-solid fa-circle-exclamation"></i> Vencida</span>`;
    } else if (dlStatus === 'soon') {
        alertBadge = `<span class="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md ml-1.5"><i class="fa-regular fa-clock"></i> &lt;48h</span>`;
    }

    const readOnly = isSuperAdmin();
    const statusCell = readOnly
        ? `<span class="text-xs font-semibold px-2.5 py-1.5 rounded-xl border ${stCfg.bg} ${stCfg.text} ${stCfg.border}">${t.status}</span>`
        : `<select onchange="window.inlineStatusChange('${t.id}', this.value)"
                        class="text-xs font-semibold px-2.5 py-1.5 rounded-xl border cursor-pointer focus:outline-none ${stCfg.bg} ${stCfg.text} ${stCfg.border}">
                    ${Object.keys(STATUS_CONFIG).map(st => `<option value="${st}" ${t.status === st ? 'selected' : ''}>${st}</option>`).join('')}
                </select>`;
    const progressCell = readOnly
        ? `<span class="text-xs font-bold text-slate-700">${t.progress}%</span>`
        : `<div class="flex items-center gap-2">
                    <input type="range" min="0" max="100" step="5" value="${t.progress}"
                           onchange="window.inlineProgressChange('${t.id}', this.value)"
                           oninput="this.nextElementSibling.textContent = this.value + '%'"
                           class="w-24 cursor-pointer">
                    <span class="text-xs font-bold text-slate-700 w-9 text-right">${t.progress}%</span>
                </div>`;

    return `
        <tr class="hover:bg-slate-50/70 transition">
            <td class="py-3 px-4 max-w-xs">
                <div class="font-semibold text-slate-800 cursor-pointer hover:text-[#1F962B] truncate" onclick="window.openTaskModal('${t.id}')">${escapeHtml(t.title)}</div>
                <div class="text-xs text-slate-400 truncate mt-0.5">${escapeHtml(t.description || 'Sin descripción')}</div>
            </td>
            <td class="py-3 px-3 whitespace-nowrap">
                <span class="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${member.bg} ${member.text} ${member.border}">
                    <span class="font-bold">${member.avatar}</span> ${member.short}
                </span>
            </td>
            <td class="py-3 px-3 whitespace-nowrap">
                ${statusCell}
            </td>
            <td class="py-3 px-3">
                ${progressCell}
            </td>
            <td class="py-3 px-3 whitespace-nowrap">
                <div class="flex items-center text-xs font-medium text-slate-700">
                    ${formatDisplayDate(t.dueDate)}
                    ${alertBadge}
                </div>
            </td>
            <td class="py-3 px-3 whitespace-nowrap">
                <span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg border ${prCfg.bg} ${prCfg.text} ${prCfg.border}">
                    <i class="fa-solid ${prCfg.icon} text-[10px]"></i> ${t.priority}
                </span>
            </td>
            <td class="py-3 px-4 whitespace-nowrap text-right">
                <button onclick="window.openTaskModal('${t.id}')" title="Ver detalle y bitácora" class="p-1.5 text-slate-500 hover:text-[#1F962B] hover:bg-[#EAF7EC] rounded-lg transition">
                    <i class="fa-regular ${readOnly ? 'fa-eye' : 'fa-pen-to-square'}"></i>
                </button>
                ${readOnly ? '' : `<button onclick="window.requestDeleteTask('${t.id}')" title="Eliminar tarea" class="p-1.5 text-slate-400 hover:text-[#DA2925] hover:bg-[#FDECEC] rounded-lg transition ml-1">
                    <i class="fa-regular fa-trash-can"></i>
                </button>`}
            </td>
        </tr>
    `;
}

// ==========================================
// 10. VIEW 4: CALENDARIO
// ==========================================
function renderCalendar(tasks) {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const todayISO = getTodayISO();

    document.getElementById('calMonthLabel').textContent = 
        calendarDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    let startWeekday = firstDayOfMonth.getDay() - 1;
    if (startWeekday < 0) startWeekday = 6;

    const daysInMonth = lastDayOfMonth.getDate();
    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

    let html = '';
    for (let i = 0; i < totalCells; i++) {
        const cellDate = new Date(year, month, 1 - startWeekday + i);
        const iso = formatDateISO(cellDate);
        const isCurrentMonth = cellDate.getMonth() === month;
        const isToday = iso === todayISO;
        const dayTasks = tasks.filter(t => t.dueDate === iso);

        html += `
            <div class="min-h-[110px] p-2 ${isCurrentMonth ? 'bg-white' : 'bg-slate-50/70 text-slate-400'}">
                <div class="flex items-center justify-between mb-1.5">
                    <span class="text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-[#1F962B] text-white' : ''}">
                        ${cellDate.getDate()}
                    </span>
                    ${dayTasks.length > 0 ? `<span class="text-[10px] font-semibold text-slate-400">${dayTasks.length}</span>` : ''}
                </div>
                <div class="space-y-1">
                    ${dayTasks.map(t => {
                        const stCfg = STATUS_CONFIG[t.status] || STATUS_CONFIG['En planeación'];
                        const member = memberOf(t.assignee);
                        return `
                            <div onclick="window.openTaskModal('${t.id}')"
                                 class="text-[11px] px-2 py-1 rounded-lg border cursor-pointer truncate font-medium transition hover:shadow-xs ${stCfg.bg} ${stCfg.text} ${stCfg.border}"
                                 title="${escapeHtml(t.title)} - ${member.name} (${t.progress}%)">
                                <span class="font-bold mr-1">${member.avatar}</span>${escapeHtml(t.title)}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    document.getElementById('calendarGrid').innerHTML = html;
}

// ==========================================
// 11. VIEW 5: POR FECHA LÍMITE
// ==========================================
function renderDeadlines(tasks) {
    const todayISO = getTodayISO();
    const buckets = {
        overdue:   { title: 'Vencidas', icon: 'fa-circle-exclamation', color: 'text-[#DA2925]', bg: 'bg-[#FDECEC]', border: 'border-[#DA2925]/25', items: [] },
        today:     { title: 'Para Hoy', icon: 'fa-bolt', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', items: [] },
        thisWeek:  { title: 'Esta Semana', icon: 'fa-calendar-week', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', items: [] },
        nextWeek:  { title: 'Próxima Semana', icon: 'fa-calendar-day', color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200', items: [] },
        later:     { title: 'Más Adelante', icon: 'fa-hourglass-half', color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200', items: [] },
        completed: { title: 'Finalizadas', icon: 'fa-circle-check', color: 'text-[#1F962B]', bg: 'bg-[#EAF7EC]', border: 'border-[#1F962B]/25', items: [] }
    };

    tasks.forEach(t => {
        if (t.status === 'Finalizado') {
            buckets.completed.items.push(t);
            return;
        }
        const diff = getDaysDiff(todayISO, t.dueDate);
        if (diff < 0) buckets.overdue.items.push(t);
        else if (diff === 0) buckets.today.items.push(t);
        else if (diff <= 7) buckets.thisWeek.items.push(t);
        else if (diff <= 14) buckets.nextWeek.items.push(t);
        else buckets.later.items.push(t);
    });

    const container = document.getElementById('deadlinesContainer');
    container.innerHTML = Object.values(buckets).map(b => `
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <div class="px-4 py-3 border-b ${b.border} ${b.bg} flex items-center justify-between">
                <div class="flex items-center gap-2 font-bold text-sm ${b.color}">
                    <i class="fa-solid ${b.icon}"></i>
                    <span>${b.title}</span>
                </div>
                <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-white/80 ${b.color}">${b.items.length}</span>
            </div>
            <div class="p-3 space-y-2.5 flex-1 max-h-[420px] overflow-y-auto">
                ${b.items.length === 0 ? `<p class="text-xs text-slate-400 text-center py-6">Sin tareas en este bloque</p>` : 
                    b.items.map(t => {
                        const member = memberOf(t.assignee);
                        const stCfg = STATUS_CONFIG[t.status] || STATUS_CONFIG['En planeación'];
                        return `
                            <div onclick="window.openTaskModal('${t.id}')" class="p-3 rounded-xl border border-slate-200 hover:border-[#1F962B]/50 hover:shadow-xs transition cursor-pointer bg-white">
                                <div class="flex items-start justify-between gap-2">
                                    <h4 class="text-xs font-bold text-slate-800 leading-snug">${escapeHtml(t.title)}</h4>
                                    <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${stCfg.bg} ${stCfg.text}">${t.status}</span>
                                </div>
                                <div class="flex items-center justify-between mt-2.5 text-[11px] text-slate-500">
                                    <span class="font-medium ${member.text}">${member.short}</span>
                                    <span class="font-semibold"><i class="fa-regular fa-calendar mr-1"></i>${formatDisplayDate(t.dueDate)}</span>
                                </div>
                                <div class="mt-2 flex items-center gap-2">
                                    <div class="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div class="h-full ${stCfg.barFill} rounded-full" style="width: ${t.progress}%"></div>
                                    </div>
                                    <span class="text-[10px] font-bold text-slate-600">${t.progress}%</span>
                                </div>
                            </div>
                        `;
                    }).join('')
                }
            </div>
        </div>
    `).join('');
}

// ==========================================
// 12. MODAL & BITÁCORA LOGIC
// ==========================================
function openTaskModal(id = null) {
    if (isSuperAdmin() && !id) return;
    const modal = document.getElementById('taskModal');
    const deleteBtn = document.getElementById('btnDeleteInModal');
    const assigneeSelect = document.getElementById('taskAssignee');
    document.getElementById('newLogInput').value = '';

    if (id) {
        const task = allTasks.find(t => t.id === id);
        if (!task) return;
        if (!seesAll() && task.assignee !== loggedInProfile) {
            showToast('No tienes permiso para ver esta tarea', 'error');
            return;
        }
        document.getElementById('modalTitle').textContent = 'Detalle y Edición de Tarea';
        document.getElementById('taskId').value = task.id;
        document.getElementById('taskTitle').value = task.title || '';
        document.getElementById('taskDesc').value = task.description || '';
        assigneeSelect.value = task.assignee || loggedInProfile;
        document.getElementById('taskPriority').value = task.priority || 'Media';
        document.getElementById('taskStartDate').value = task.startDate || getTodayISO();
        document.getElementById('taskDueDate').value = task.dueDate || getTodayISO();
        document.getElementById('taskHours').value = task.estimatedHours || 8;
        document.getElementById('taskStatus').value = task.status || 'En planeación';
        document.getElementById('taskProgress').value = task.progress || 0;
        document.getElementById('taskProgressVal').textContent = `${task.progress || 0}%`;

        tempModalLogs = Array.isArray(task.logs) ? [...task.logs] : [];
        deleteBtn.classList.remove('hidden');
    } else {
        document.getElementById('modalTitle').textContent = 'Nueva Tarea';
        document.getElementById('taskId').value = '';
        document.getElementById('taskTitle').value = '';
        document.getElementById('taskDesc').value = '';
        assigneeSelect.value = isAdmin() ? activeProfile : loggedInProfile;
        document.getElementById('taskPriority').value = 'Media';
        document.getElementById('taskStartDate').value = getTodayISO();
        document.getElementById('taskDueDate').value = formatDateISO(addDays(new Date(), 4));
        document.getElementById('taskHours').value = 8;
        document.getElementById('taskStatus').value = 'En planeación';
        document.getElementById('taskProgress').value = 0;
        document.getElementById('taskProgressVal').textContent = '0%';

        tempModalLogs = [];
        deleteBtn.classList.add('hidden');
    }

    const readOnly = isSuperAdmin();
    if (!isAdmin()) {
        assigneeSelect.value = id ? assigneeSelect.value : loggedInProfile;
        assigneeSelect.disabled = true;
    } else {
        assigneeSelect.disabled = false;
    }
    ['taskTitle', 'taskDesc', 'taskPriority', 'taskStartDate', 'taskDueDate', 'taskHours', 'taskStatus', 'taskProgress', 'newLogInput'].forEach((fieldId) => {
        const field = document.getElementById(fieldId);
        if (field) field.disabled = readOnly;
    });
    if (readOnly) assigneeSelect.disabled = true;
    document.getElementById('btnSaveTask').classList.toggle('hidden', readOnly);
    document.getElementById('btnAddLog').classList.toggle('hidden', readOnly);
    document.getElementById('newLogInput').classList.toggle('hidden', readOnly);
    if (readOnly) {
        deleteBtn.classList.add('hidden');
        document.getElementById('modalTitle').textContent = 'Detalle de la tarea';
    }

    renderModalLogs();
    modal.classList.remove('hidden');
}

function closeTaskModal() {
    document.getElementById('taskModal').classList.add('hidden');
}

function renderModalLogs() {
    const list = document.getElementById('logsList');
    if (tempModalLogs.length === 0) {
        list.innerHTML = `<p class="text-xs text-slate-400 italic py-2">Aún no hay notas de avance registradas.</p>`;
        return;
    }
    list.innerHTML = [...tempModalLogs].reverse().map(log => `
        <div class="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-xs">
            <div class="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                <span class="font-bold text-slate-700">${escapeHtml(log.author)}</span>
                <span>${escapeHtml(log.timestamp)}</span>
            </div>
            <p class="text-slate-700">${escapeHtml(log.text)}</p>
        </div>
    `).join('');
}

async function addLogNote() {
    if (isSuperAdmin()) return;
    const input = document.getElementById('newLogInput');
    const text = input.value.trim();
    if (!text) return;

    const authorName = memberOf(activeProfile).name || 'Equipo';
    const timestamp = new Date().toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
    const newLog = { text, author: authorName, timestamp };

    tempModalLogs.push(newLog);
    input.value = '';
    renderModalLogs();

    const existingId = document.getElementById('taskId').value;
    if (existingId) {
        await quickUpdateTask(existingId, { logs: tempModalLogs });
        showToast('Nota agregada a la bitácora', 'success');
    }
}

async function handleSaveTask() {
    if (isSuperAdmin()) return;
    const form = document.getElementById('taskForm');
    if (!form.reportValidity()) return;

    const id = document.getElementById('taskId').value || null;
    const taskData = {
        title: document.getElementById('taskTitle').value.trim(),
        description: document.getElementById('taskDesc').value.trim(),
        assignee: isAdmin() ? document.getElementById('taskAssignee').value : loggedInProfile,
        priority: document.getElementById('taskPriority').value,
        startDate: document.getElementById('taskStartDate').value,
        dueDate: document.getElementById('taskDueDate').value,
        estimatedHours: Number(document.getElementById('taskHours').value) || 1,
        status: document.getElementById('taskStatus').value,
        progress: Number(document.getElementById('taskProgress').value) || 0,
        logs: tempModalLogs
    };

    closeTaskModal();
    await saveTaskToDB(taskData, id);
}

// ==========================================
// 13. CUSTOM CONFIRM & TOAST HELPERS
// ==========================================
let confirmCallback = null;

function openConfirmModal(title, message, onConfirm) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    confirmCallback = onConfirm;
    document.getElementById('confirmModal').classList.remove('hidden');
}

function closeConfirmModal() {
    document.getElementById('confirmModal').classList.add('hidden');
    confirmCallback = null;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const colors = {
        success: 'bg-[#1F962B] text-white',
        error: 'bg-[#DA2925] text-white',
        info: 'bg-slate-800 text-white'
    };
    const el = document.createElement('div');
    el.className = `px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 transition-all duration-300 ${colors[type] || colors.info}`;
    el.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info'}"></i><span>${escapeHtml(message)}</span>`;
    container.appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 300);
    }, 3500);
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ==========================================
// 14. GLOBAL WINDOW HANDLERS & EVENT LISTENERS
// ==========================================
window.openTaskModal = openTaskModal;

window.inlineStatusChange = async (id, newStatus) => {
    const updates = { status: newStatus };
    if (newStatus === 'Finalizado') updates.progress = 100;
    await quickUpdateTask(id, updates);
    showToast(`Estado actualizado a "${newStatus}"`, 'success');
};

window.inlineProgressChange = async (id, newProgress) => {
    const prog = Number(newProgress);
    const updates = { progress: prog };
    if (prog === 100) updates.status = 'Finalizado';
    await quickUpdateTask(id, updates);
    showToast(`Avance actualizado al ${prog}%`, 'success');
};

window.requestDeleteTask = (id) => {
    const task = allTasks.find(t => t.id === id);
    openConfirmModal(
        'Eliminar tarea',
        `¿Deseas eliminar definitivamente "${task?.title || 'esta tarea'}"? Esta acción sincronizará el cambio para todo el equipo.`,
        async () => {
            closeTaskModal();
            await deleteTaskFromDB(id);
        }
    );
};

// Navigation Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// Login Form Submit
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;
    const submitBtn = document.getElementById('btnLoginSubmit');

    document.getElementById('loginError').classList.add('hidden');
    document.getElementById('loginSuccess').classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i><span>Verificando acceso...</span>`;

    try {
        const session = await api.login(email, password);
        setToken(session.token);
        await enterSession(session.user, true);
    } catch (err) {
        console.error(err);
        showLoginError(err.message || 'Correo o contraseña incorrectos.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i><span>Ingresar al Planificador</span>`;
    }
});

document.getElementById('btnChangePassword').addEventListener('click', openPasswordModal);
document.getElementById('btnClosePassword').addEventListener('click', closePasswordModal);
document.getElementById('btnCancelPassword').addEventListener('click', closePasswordModal);

document.getElementById('passwordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    if (newPassword !== confirmPassword) {
        showToast('La confirmación no coincide', 'error');
        return;
    }
    try {
        await api.changePassword(currentPassword, newPassword);
        mustChangePassword = false;
        updatePasswordBanner();
        closePasswordModal();
        showToast('Contraseña actualizada', 'success');
    } catch (err) {
        showToast(err.message || 'No se pudo cambiar la contraseña', 'error');
    }
});

document.getElementById('btnBannerChangePassword').addEventListener('click', openPasswordModal);

let directoryUsers = [];

function roleLabel(role) {
    if (role === 'superadmin') return 'Super admin';
    if (role === 'admin') return 'Administrador';
    return 'Integrante';
}

const VIEW_LABELS = {
    dashboard: 'Dashboard',
    gantt: 'Gantt',
    list: 'Lista',
    calendar: 'Calendario',
    deadlines: 'Fechas límite',
    users: 'Usuarios',
    usage: 'Usabilidad',
};

const ACTION_LABELS = {
    login: 'Ingresó',
    view: 'Abrió una vista',
    task_create: 'Creó una tarea',
    task_update: 'Actualizó una tarea',
    task_delete: 'Eliminó una tarea',
    user_create: 'Creó un usuario',
    user_update: 'Editó un usuario',
    user_delete: 'Eliminó un usuario',
    user_reset: 'Restableció una clave',
};

async function renderUsage() {
    if (!isSuperAdmin()) {
        switchView('dashboard');
        return;
    }
    const summary = document.getElementById('usageSummary');
    const views = document.getElementById('usageViews');
    const people = document.getElementById('usageUsers');
    const recent = document.getElementById('usageRecent');
    try {
        const data = await api.usage();
        const cards = [
            ['Usuarios activos', data.users],
            ['Tareas en el plan', data.tasks],
            ['Ingresos registrados', data.logins],
        ];
        summary.innerHTML = cards.map(([label, value]) => `
            <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">${label}</p>
                <p class="mt-2 text-3xl font-bold text-slate-900">${value}</p>
            </div>`).join('');
        views.innerHTML = usageTable('Vistas usadas', ['Vista', 'Veces'], (data.byView || []).map((row) => [
            VIEW_LABELS[row.viewName] || row.viewName,
            row.total,
        ]));
        people.innerHTML = usageTable('Por persona', ['Correo', 'Ingresos', 'Vistas', 'Última actividad'], (data.byUser || []).map((row) => [
            row.email,
            row.logins,
            row.views,
            formatActivityDate(row.lastSeen),
        ]));
        recent.innerHTML = usageTable('Actividad reciente', ['Cuándo', 'Quién', 'Qué hizo', 'Detalle'], (data.recent || []).map((row) => [
            formatActivityDate(row.createdAt),
            row.email,
            ACTION_LABELS[row.action] || row.action,
            row.action === 'view' ? (VIEW_LABELS[row.detail] || row.detail) : row.detail,
        ]));
    } catch (err) {
        summary.innerHTML = '';
        views.innerHTML = '';
        people.innerHTML = '';
        recent.innerHTML = `<p class="p-6 text-sm text-[#DA2925]">${escapeHtml(err.message)}</p>`;
    }
}

function usageTable(title, headers, rows) {
    const body = rows.length
        ? rows.map((row) => `<tr>${row.map((cell) => `<td class="px-3 py-2.5 text-slate-600">${escapeHtml(String(cell ?? ''))}</td>`).join('')}</tr>`).join('')
        : `<tr><td class="px-4 py-6 text-sm text-slate-400" colspan="${headers.length}">Todavía no hay registros.</td></tr>`;
    return `
        <div class="px-4 py-3 border-b border-slate-100">
            <h3 class="text-sm font-bold text-slate-800">${title}</h3>
        </div>
        <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
                <thead class="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400">
                    <tr>${headers.map((header) => `<th class="px-3 py-3">${header}</th>`).join('')}</tr>
                </thead>
                <tbody class="divide-y divide-slate-100">${body}</tbody>
            </table>
        </div>`;
}

function formatActivityDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

function resetUserForm() {
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = '';
    document.getElementById('userEmail').disabled = false;
    document.getElementById('btnSaveUser').textContent = 'Crear';
}

async function renderUsers() {
    if (!isDirector()) {
        switchView('dashboard');
        return;
    }
    const container = document.getElementById('usersContainer');
    try {
        const data = await api.listUsers();
        directoryUsers = data.users;
        document.getElementById('standardPasswordHint').textContent =
            `La clave estándar es ${data.standardPassword}. La persona entra con esa clave y luego la cambia.`;
        container.innerHTML = `
            <div class="overflow-x-auto">
                <table class="w-full text-left text-sm">
                    <thead class="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400">
                        <tr>
                            <th class="px-4 py-3">Nombre</th>
                            <th class="px-3 py-3">Correo</th>
                            <th class="px-3 py-3">Perfil</th>
                            <th class="px-3 py-3">Rol</th>
                            <th class="px-4 py-3 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        ${data.users.map((user) => `
                            <tr>
                                <td class="px-4 py-3 font-semibold text-slate-800">${escapeHtml(user.fullName)}</td>
                                <td class="px-3 py-3 text-slate-600">${escapeHtml(user.email)}</td>
                                <td class="px-3 py-3 text-slate-600">${escapeHtml(user.profileKey)}</td>
                                <td class="px-3 py-3 text-slate-600">${roleLabel(user.role)}</td>
                                <td class="px-4 py-3 text-right whitespace-nowrap">
                                    <button type="button" data-user-action="edit" data-user-id="${user.id}" class="px-2 py-1 text-xs font-semibold text-[#1F962B] hover:bg-[#EAF7EC] rounded-lg">Editar</button>
                                    <button type="button" data-user-action="reset" data-user-id="${user.id}" class="px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Restablecer clave</button>
                                    ${user.email === DIRECTOR_EMAIL ? '' : `<button type="button" data-user-action="delete" data-user-id="${user.id}" class="px-2 py-1 text-xs font-semibold text-[#DA2925] hover:bg-[#FDECEC] rounded-lg">Eliminar</button>`}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;
    } catch (err) {
        container.innerHTML = `<p class="p-6 text-sm text-[#DA2925]">${escapeHtml(err.message)}</p>`;
    }
}

document.getElementById('btnCancelUser').addEventListener('click', resetUserForm);

document.getElementById('userForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('userId').value;
    const payload = {
        fullName: document.getElementById('userName').value.trim(),
        email: document.getElementById('userEmail').value.trim().toLowerCase(),
        profileKey: document.getElementById('userProfile').value.trim().toLowerCase(),
        role: document.getElementById('userRole').value,
        active: true,
    };
    try {
        if (id) {
            await api.updateUser(id, payload);
            showToast('Usuario actualizado', 'success');
        } else {
            const created = await api.createUser(payload);
            showToast(`Usuario creado. Clave estándar: ${created.standardPassword}`, 'success');
        }
        resetUserForm();
        await loadProfiles();
        await renderUsers();
    } catch (err) {
        showToast(err.message || 'No se pudo guardar el usuario', 'error');
    }
});

document.getElementById('usersContainer').addEventListener('click', (e) => {
    const button = e.target.closest('button[data-user-action]');
    if (!button) return;
    const user = directoryUsers.find((item) => String(item.id) === button.dataset.userId);
    if (!user) return;

    if (button.dataset.userAction === 'edit') {
        document.getElementById('userId').value = user.id;
        document.getElementById('userName').value = user.fullName;
        document.getElementById('userEmail').value = user.email;
        document.getElementById('userEmail').disabled = user.email === DIRECTOR_EMAIL;
        document.getElementById('userProfile').value = user.profileKey;
        document.getElementById('userRole').value = user.role;
        document.getElementById('btnSaveUser').textContent = 'Guardar';
        return;
    }

    if (button.dataset.userAction === 'reset') {
        openConfirmModal(
            'Restablecer clave',
            `La clave de ${user.fullName} volverá a ser la estándar. Al entrar podrá cambiarla.`,
            async () => {
                const result = await api.resetUserPassword(user.id);
                showToast(`Clave restablecida a ${result.standardPassword}`, 'success');
            }
        );
        return;
    }

    if (button.dataset.userAction === 'delete') {
        openConfirmModal(
            'Eliminar usuario',
            `¿Eliminar el acceso de ${user.fullName}? Las tareas asignadas a su perfil se conservan.`,
            async () => {
                await api.deleteUser(user.id);
                resetUserForm();
                await loadProfiles();
                await renderUsers();
                showToast('Usuario eliminado', 'info');
            }
        );
    }
});

document.getElementById('passwordModal').addEventListener('click', (e) => {
    if (e.target.id === 'passwordModal') closePasswordModal();
});

document.getElementById('btnLogout').addEventListener('click', () => {
    forceLogout(true);
});

// Header Controls
document.getElementById('activeProfileSelect').addEventListener('change', (e) => {
    if (!seesAll()) {
        e.target.value = loggedInProfile;
        return;
    }
    activeProfile = e.target.value;
    showToast(`Perfil activo: ${memberOf(activeProfile).name}`, 'info');
    if (filters.onlyMine) renderCurrentView();
});

document.getElementById('btnNewTask').addEventListener('click', () => openTaskModal(null));

// Global Filters
document.getElementById('filterSearch').addEventListener('input', (e) => {
    filters.search = e.target.value;
    renderCurrentView();
});

document.getElementById('btnMyTasks').addEventListener('click', (e) => {
    filters.onlyMine = !filters.onlyMine;
    const btn = e.currentTarget;
    if (filters.onlyMine) {
        btn.className = 'py-1.5 px-3 text-xs sm:text-sm font-semibold bg-[#1F962B] border border-[#1F962B] text-white rounded-xl transition flex items-center gap-1.5 shadow-xs';
    } else {
        btn.className = 'py-1.5 px-3 text-xs sm:text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-[#EAF7EC] hover:text-[#1F962B] hover:border-[#1F962B]/40 rounded-xl transition flex items-center gap-1.5';
    }
    renderCurrentView();
});

document.getElementById('filterAssignee').addEventListener('change', (e) => {
    filters.assignee = e.target.value;
    renderCurrentView();
});

document.getElementById('filterStatus').addEventListener('change', (e) => {
    filters.status = e.target.value;
    renderCurrentView();
});

document.getElementById('filterPriority').addEventListener('change', (e) => {
    filters.priority = e.target.value;
    renderCurrentView();
});

document.getElementById('btnClearFilters').addEventListener('click', () => {
    filters = { search: '', assignee: seesAll() ? 'all' : loggedInProfile, status: 'all', priority: 'all', onlyMine: false };
    document.getElementById('filterSearch').value = '';
    document.getElementById('filterAssignee').value = seesAll() ? 'all' : loggedInProfile;
    document.getElementById('filterStatus').value = 'all';
    document.getElementById('filterPriority').value = 'all';
    document.getElementById('btnMyTasks').className = 'py-1.5 px-3 text-xs sm:text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-[#EAF7EC] hover:text-[#1F962B] hover:border-[#1F962B]/40 rounded-xl transition flex items-center gap-1.5';
    renderCurrentView();
});

document.getElementById('btnExportCSV').addEventListener('click', exportToCSV);

// Gantt Controls
document.getElementById('ganttPrev').addEventListener('click', () => {
    ganttStartDate = addDays(ganttStartDate, -7);
    renderCurrentView();
});
document.getElementById('ganttToday').addEventListener('click', () => {
    ganttStartDate = addDays(getMonday(new Date()), -3);
    renderCurrentView();
});
document.getElementById('ganttNext').addEventListener('click', () => {
    ganttStartDate = addDays(ganttStartDate, 7);
    renderCurrentView();
});

// List Grouping
document.getElementById('listGroupBy').addEventListener('change', () => renderCurrentView());

// Calendar Controls
document.getElementById('calPrev').addEventListener('click', () => {
    calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
    renderCurrentView();
});
document.getElementById('calToday').addEventListener('click', () => {
    calendarDate = new Date();
    renderCurrentView();
});
document.getElementById('calNext').addEventListener('click', () => {
    calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
    renderCurrentView();
});

// Task Modal Controls
document.getElementById('btnCloseModal').addEventListener('click', closeTaskModal);
document.getElementById('btnCancelModal').addEventListener('click', closeTaskModal);
document.getElementById('btnSaveTask').addEventListener('click', handleSaveTask);
document.getElementById('btnDeleteInModal').addEventListener('click', () => {
    const id = document.getElementById('taskId').value;
    if (id) window.requestDeleteTask(id);
});

document.getElementById('taskProgress').addEventListener('input', (e) => {
    document.getElementById('taskProgressVal').textContent = `${e.target.value}%`;
});

document.getElementById('taskStatus').addEventListener('change', (e) => {
    if (e.target.value === 'Finalizado') {
        document.getElementById('taskProgress').value = 100;
        document.getElementById('taskProgressVal').textContent = '100%';
    }
});

document.getElementById('btnAddLog').addEventListener('click', addLogNote);
document.getElementById('newLogInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        addLogNote();
    }
});

// Confirm Modal Controls
document.getElementById('btnConfirmCancel').addEventListener('click', closeConfirmModal);
document.getElementById('btnConfirmOk').addEventListener('click', async () => {
    const cb = confirmCallback;
    closeConfirmModal();
    if (cb) await cb();
});

// Close modals on backdrop click
document.getElementById('taskModal').addEventListener('click', (e) => {
    if (e.target.id === 'taskModal') closeTaskModal();
});
document.getElementById('confirmModal').addEventListener('click', (e) => {
    if (e.target.id === 'confirmModal') closeConfirmModal();
});

// Boot Application
initApp();
