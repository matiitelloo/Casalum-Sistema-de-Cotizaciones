const AUTH_EMAIL_DOMAIN = 'casalum.local';
const usernameToEmail = (username) => `${username.trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;

/** Máximo que esperamos a Firebase antes de asumir que no hay sesión y mostrar el login. */
const AUTH_BOOT_TIMEOUT_MS = 8000;

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.authChangeCallbacks = [];
        this.authBootDone = false;
        // Red de seguridad: si el SDK de Firebase no carga o no responde, la pantalla
        // de carga no puede quedarse colgada para siempre.
        this.authBootTimer = setTimeout(() => {
            console.warn('La sesión no se resolvió a tiempo; se muestra el login.');
            this.checkAuth();
        }, AUTH_BOOT_TIMEOUT_MS);
        this.bindEvents();
    }

    /**
     * Oculta la pantalla de carga inicial. Se llama en cuanto se sabe si hay sesión
     * o no, para que el login nunca parpadee sobre una sesión que sigue válida.
     */
    finishAuthBoot() {
        if (this.authBootDone) return;
        this.authBootDone = true;
        clearTimeout(this.authBootTimer);
        const splash = document.getElementById('auth-loading');
        if (splash) splash.style.display = 'none';
    }

    /** Registers a callback invoked every time a user finishes signing in. */
    onAuthReady(callback) {
        this.authChangeCallbacks.push(callback);
    }

    /** Wires up firebase.auth() to this manager. Must run after dbManager.init(). */
    init() {
        return new Promise((resolve) => {
            let firstResolve = false;
            firebase.auth().onAuthStateChanged(async (fbUser) => {
                if (fbUser) {
                    await this.loadCurrentUserProfile(fbUser);
                    this.checkAuth();
                    this.authChangeCallbacks.forEach(cb => cb(this.currentUser));
                } else {
                    this.currentUser = null;
                    this.checkAuth();
                }
                if (!firstResolve) {
                    firstResolve = true;
                    resolve();
                }
            });
        });
    }

    async loadCurrentUserProfile(fbUser) {
        const fallback = { id: fbUser.uid, username: fbUser.email.split('@')[0], name: fbUser.email.split('@')[0], role: 'user' };
        try {
            const doc = await window.dbManager.db.collection('users').doc(fbUser.uid).get();
            if (doc.exists) {
                const profile = doc.data();
                this.currentUser = { uid: fbUser.uid, username: profile.username, name: profile.name, role: profile.role };
                return;
            }
            // Confirmado: el documento realmente no existe (primer login de la cuenta). Se crea uno básico.
            await window.dbManager.save('users', fallback, 'id');
            this.currentUser = { uid: fbUser.uid, username: fallback.username, name: fallback.name, role: fallback.role };
        } catch (error) {
            // Ante un error transitorio (red, reglas propagándose, etc.) NO se sobrescribe Firestore
            // — eso podría pisar un perfil real (ej. degradar un admin a 'user'). Solo se arma una
            // sesión local temporal; el próximo login con Firestore disponible restaura el perfil real.
            console.error('Error cargando perfil de usuario (no se modifica Firestore):', error);
            this.currentUser = { uid: fbUser.uid, username: fallback.username, name: fallback.name, role: fallback.role };
        }
    }

    bindEvents() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = loginForm.querySelector('button[type="submit"]');
                const errorMsg = document.getElementById('login-error');

                btn.disabled = true;
                btn.textContent = 'Verificando...';
                errorMsg.style.display = 'none';

                try {
                    await this.login();
                } catch (error) {
                    console.error("Error durante el login:", error);
                    errorMsg.textContent = 'Error al conectar con la base de datos. Verifica que Firestore esté activado.';
                    errorMsg.style.display = 'block';
                } finally {
                    btn.disabled = false;
                    btn.textContent = 'Ingresar';
                }
            });
        }

        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }

        const togglePassBtn = document.getElementById('btn-toggle-pass');
        if (togglePassBtn) {
            togglePassBtn.addEventListener('click', () => {
                const passInput = document.getElementById('login-pass');
                const icon = togglePassBtn.querySelector('i');
                if (passInput.type === 'password') {
                    passInput.type = 'text';
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                } else {
                    passInput.type = 'password';
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            });
        }

        const profileTrigger = document.getElementById('profile-dropdown-trigger');
        const profileDropdown = document.getElementById('profile-dropdown');
        if (profileTrigger && profileDropdown) {
            profileTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                profileDropdown.style.display = profileDropdown.style.display === 'flex' ? 'none' : 'flex';
            });

            document.addEventListener('click', () => {
                profileDropdown.style.display = 'none';
            });
        }

        const logoutDropdownBtn = document.getElementById('btn-logout-dropdown');
        if (logoutDropdownBtn) {
            logoutDropdownBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }

        const changeProfileBtn = document.getElementById('btn-change-profile');
        if (changeProfileBtn) {
            changeProfileBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }

        const btnProfile = document.getElementById('btn-profile-dropdown');
        if (btnProfile) {
            btnProfile.addEventListener('click', (e) => {
                e.preventDefault();
                document.getElementById('profile-dropdown').style.display = 'none';
                window.app.navigate('profile');
                this.loadProfileData();
            });
        }

        const profileForm = document.getElementById('profile-form');
        if (profileForm) {
            profileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveProfileData();
            });
        }
    }

    checkAuth() {
        // Solo se llama cuando ya se sabe el estado de la sesión, así que acá es
        // seguro sacar la pantalla de carga.
        this.finishAuthBoot();

        const loginView = document.getElementById('login-view');
        const appView = document.getElementById('app-view');

        if (this.currentUser) {
            if (loginView) loginView.style.display = 'none';
            if (appView) appView.style.display = 'flex';
            this.updateWelcomeMessage();
        } else {
            if (loginView) loginView.style.display = 'flex';
            if (appView) appView.style.display = 'none';
        }
    }

    async login() {
        const userInp = document.getElementById('login-user').value.trim();
        const passInp = document.getElementById('login-pass').value.trim();
        const errorMsg = document.getElementById('login-error');

        if (!userInp || !passInp) {
            errorMsg.textContent = 'Ingrese usuario y contraseña.';
            errorMsg.style.display = 'block';
            return;
        }

        const remember = document.getElementById('login-remember').checked;
        await firebase.auth().setPersistence(
            remember ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION
        );

        try {
            await firebase.auth().signInWithEmailAndPassword(usernameToEmail(userInp), passInp);
        } catch (error) {
            errorMsg.textContent = 'Usuario o contraseña incorrectos.';
            errorMsg.style.display = 'block';
            return;
        }

        document.getElementById('login-user').value = '';
        document.getElementById('login-pass').value = '';
        errorMsg.style.display = 'none';
    }

    logout() {
        firebase.auth().signOut();
        window.app.navigate('dashboard'); // go back to default page for next login
    }

    updateWelcomeMessage() {
        const welcomeEl = document.getElementById('current-user-name');
        const headerNameEl = document.getElementById('header-user-name');

        if (this.currentUser) {
            if (welcomeEl) welcomeEl.textContent = this.currentUser.name;
            if (headerNameEl) headerNameEl.textContent = this.currentUser.name;
        }
    }

    loadProfileData() {
        if (!this.currentUser) return;
        document.getElementById('prof-username').value = this.currentUser.username;
        document.getElementById('prof-name').value = this.currentUser.name;
        document.getElementById('prof-pass').value = '';
        const msgEl = document.getElementById('prof-msg');
        if (msgEl) msgEl.style.display = 'none';
    }

    async saveProfileData() {
        if (!this.currentUser) return;
        const newName = document.getElementById('prof-name').value.trim();
        const newPass = document.getElementById('prof-pass').value.trim();
        const msgEl = document.getElementById('prof-msg');

        if (!newName) {
            msgEl.textContent = 'El nombre completo es requerido.';
            msgEl.style.color = 'var(--danger)';
            msgEl.style.display = 'block';
            return;
        }

        try {
            const fbUser = firebase.auth().currentUser;

            if (newPass) {
                await fbUser.updatePassword(newPass);
            }

            this.currentUser.name = newName;
            await window.dbManager.save('users', {
                id: this.currentUser.uid,
                username: this.currentUser.username,
                name: newName,
                role: this.currentUser.role
            }, 'id');

            this.updateWelcomeMessage();

            msgEl.textContent = 'Perfil actualizado correctamente en la nube.';
            msgEl.style.color = 'var(--success)';
            msgEl.style.display = 'block';
            document.getElementById('prof-pass').value = '';
        } catch (error) {
            console.error('Error updating profile:', error);
            if (error.code === 'auth/requires-recent-login') {
                msgEl.textContent = 'Por seguridad, cerrá sesión y volvé a entrar antes de cambiar la contraseña.';
            } else {
                msgEl.textContent = 'Error al actualizar el perfil.';
            }
            msgEl.style.color = 'var(--danger)';
            msgEl.style.display = 'block';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});
