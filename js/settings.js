/**
 * Company Settings Manager — Gastos Generales / Utilidad, editable solo por admin.
 * IVA queda fijo en 0% y no es editable.
 */
class CompanySettingsManager {
    constructor() {
        this.settings = {
            gastosGenerales: window.SEED_DATA?.defaultSettings?.gastosGenerales ?? 0.14,
            utilidad: window.SEED_DATA?.defaultSettings?.utilidad ?? 0.30,
            iva: 0
        };
        this.isAdmin = false;
        this.bindEvents();
    }

    bindEvents() {
        const form = document.getElementById('settings-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveFromForm();
            });
        }
    }

    /** Loads settings/company from Firestore. Call after the user is authenticated. */
    async load() {
        try {
            const doc = await window.dbManager.db.collection('settings').doc('company').get();
            if (doc.exists) {
                this.settings = { ...this.settings, ...doc.data(), iva: 0 };
            }
        } catch (e) {
            console.error('Error cargando ajustes de la empresa:', e);
        }
        if (window.calculator) window.calculator.settings = this.settings;
        this.renderForm();
    }

    /** Shows/hides admin-only UI (nav item, form fields) based on the current user's role. */
    applyAdminState() {
        this.isAdmin = !!(window.authManager && window.authManager.currentUser && window.authManager.currentUser.role === 'admin');

        const navItem = document.getElementById('nav-settings');
        if (navItem) navItem.style.display = this.isAdmin ? '' : 'none';

        const noAccess = document.getElementById('settings-no-access');
        if (noAccess) noAccess.style.display = this.isAdmin ? 'none' : 'block';

        const form = document.getElementById('settings-form');
        if (form) {
            form.querySelectorAll('input:not(#set-iva), button[type="submit"]').forEach(el => {
                el.disabled = !this.isAdmin;
            });
        }
    }

    renderForm() {
        const gastosInput = document.getElementById('set-gastos');
        const utilidadInput = document.getElementById('set-utilidad');
        if (gastosInput) gastosInput.value = (this.settings.gastosGenerales * 100).toFixed(2);
        if (utilidadInput) utilidadInput.value = (this.settings.utilidad * 100).toFixed(2);
    }

    async saveFromForm() {
        if (!this.isAdmin) return;
        const msgEl = document.getElementById('settings-msg');
        const gastos = parseFloat(document.getElementById('set-gastos').value) / 100;
        const utilidad = parseFloat(document.getElementById('set-utilidad').value) / 100;

        if (isNaN(gastos) || gastos < 0 || isNaN(utilidad) || utilidad < 0) {
            if (msgEl) {
                msgEl.textContent = 'Los porcentajes deben ser números válidos mayores o iguales a 0.';
                msgEl.style.color = 'var(--danger)';
                msgEl.style.display = 'block';
            }
            return;
        }

        try {
            this.settings = { ...this.settings, gastosGenerales: gastos, utilidad: utilidad, iva: 0 };
            await window.dbManager.db.collection('settings').doc('company').set(this.settings, { merge: true });
            if (window.calculator) window.calculator.settings = this.settings;
            if (msgEl) {
                msgEl.textContent = 'Ajustes guardados correctamente.';
                msgEl.style.color = 'var(--success)';
                msgEl.style.display = 'block';
            }
        } catch (e) {
            console.error('Error guardando ajustes de la empresa:', e);
            if (msgEl) {
                msgEl.textContent = 'Error al guardar los ajustes.';
                msgEl.style.color = 'var(--danger)';
                msgEl.style.display = 'block';
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.settingsManager = new CompanySettingsManager();
});
