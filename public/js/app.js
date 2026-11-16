// Shared App Logic - Job Market Portal

const API_BASE = ''; // Relative path for endpoints

// Get active session user
function getSessionUser() {
    const userJson = localStorage.getItem('job_market_user');
    if (!userJson) return null;
    try {
        return JSON.parse(userJson);
    } catch (e) {
        localStorage.removeItem('job_market_user');
        return null;
    }
}

// Save session user
function setSessionUser(user) {
    localStorage.setItem('job_market_user', JSON.stringify(user));
}

// Remove session user and redirect to homepage
function logoutUser() {
    localStorage.removeItem('job_market_user');
    showNotification('Logged out successfully.', 'info');
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
}

// Global fetch helper incorporating session headers
async function apiRequest(endpoint, options = {}) {
    const user = getSessionUser();
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    if (user && user.id) {
        headers['X-User-Id'] = user.id;
        headers['X-User-Role'] = user.role;
    }

    const config = {
        ...options,
        headers
    };

    try {
        const response = await fetch(endpoint, config);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Something went wrong.');
        }
        return data;
    } catch (err) {
        console.error(`API Error on ${endpoint}:`, err);
        throw err;
    }
}

// Show notifications programmatically (toasts)
function showNotification(message, type = 'success') {
    // Remove existing notifications if any
    const existing = document.querySelector('.toast-notification');
    if (existing) {
        existing.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    
    // Choose icon
    let icon = '🔔';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'info') icon = 'ℹ️';

    toast.innerHTML = `<span class="toast-icon">${icon}</span> <span class="toast-msg">${message}</span>`;
    
    // Append to body
    document.body.appendChild(toast);
    
    // Style the toast dynamically (avoiding extra css file)
    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        padding: '12px 24px',
        borderRadius: '8px',
        backgroundColor: type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#6366f1',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
        zIndex: '9999',
        animation: 'slideUp 0.3s ease-out',
        fontWeight: '500',
        fontSize: '14px'
    });

    // Add keyframe animation on the fly
    if (!document.getElementById('toast-animation-style')) {
        const style = document.createElement('style');
        style.id = 'toast-animation-style';
        style.innerHTML = `
            @keyframes slideUp {
                from { transform: translateY(50px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    // Auto dismiss after 3 seconds
    setTimeout(() => {
        toast.style.transition = 'all 0.5s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// Render dynamic navigation header
function renderNavigation() {
    const header = document.querySelector('header');
    if (!header) return;

    const user = getSessionUser();
    
    let dashboardLink = '';
    if (user) {
        if (user.role === 'Admin') dashboardLink = 'dashboard-admin.html';
        else if (user.role === 'Recruiter') dashboardLink = 'dashboard-recruiter.html';
        else dashboardLink = 'dashboard-user.html';
    }

    // Identify active page
    const path = window.location.pathname;
    const page = path.substring(path.lastIndexOf('/') + 1);

    header.innerHTML = `
        <a href="index.html" class="logo-container">
            <span class="logo-icon">💼</span>
            <span class="logo-text">Job<span>Market</span></span>
        </a>
        <nav>
            <a href="index.html" class="${page === 'index.html' || page === '' ? 'active' : ''}">Home</a>
            <a href="about.html" class="${page === 'about.html' ? 'active' : ''}">About</a>
            <a href="contact.html" class="${page === 'contact.html' ? 'active' : ''}">Contact</a>
            ${user ? `<a href="${dashboardLink}" class="${page.startsWith('dashboard') ? 'active' : ''}">Dashboard</a>` : ''}
        </nav>
        <div class="nav-buttons">
            ${user ? `
                <span style="color: var(--text-muted); font-size: 14px; font-weight: 500;">
                    Hello, <strong style="color: var(--text-main);">${user.name}</strong> (${user.role})
                </span>
                <button onclick="logoutUser()" class="btn btn-secondary btn-sm">Log Out</button>
            ` : `
                <a href="login.html" class="btn btn-secondary">Log In</a>
                <a href="register.html" class="btn btn-primary">Sign Up</a>
            `}
        </div>
    `;
}

// Format Date string
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Initialize on DOM loaded
document.addEventListener('DOMContentLoaded', () => {
    renderNavigation();
});
