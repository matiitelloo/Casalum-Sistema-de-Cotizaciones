/**
 * Client Management Logic
 */
class ClientManager {
    constructor() {
        this.currentClient = null;
        this.init();
    }

    init() {
        // Setup Search Listener
        const searchInput = document.getElementById('search-client');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.searchClient(e.target.value));
        }

        const dirSearch = document.getElementById('search-directory-client');
        if (dirSearch) {
            dirSearch.addEventListener('input', (e) => this.loadClientsList(e.target.value));
        }

        // Setup Form
        const clientForm = document.getElementById('client-form');
        if (clientForm) {
            clientForm.addEventListener('input', () => this.autoSaveClient());
        }
        
        // Navigation buttons
        const nextBtn = document.getElementById('btn-next-step-1');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (this.validateClientForm()) {
                    // Cotización rápida: se salta el Paso 2 (Detalles), va directo a Productos.
                    const isQuick = window.quotationManager && window.quotationManager.isQuickQuote;
                    window.app.nextStep(isQuick ? 3 : 2);
                }
            });
        }

        const btnGenericClient = document.getElementById('btn-use-generic-client');
        if (btnGenericClient) {
            btnGenericClient.addEventListener('click', () => this.useGenericClient());
        }
    }

    /** Cliente genérico reutilizable para atención rápida en el local, sin pedir datos. */
    async useGenericClient() {
        const genericId = '9999999999';
        let client = await this.getClientById(genericId);
        if (!client) {
            client = { id: genericId, name: 'Consumidor Final', phone: '000000', address: '000000' };
            await window.dbManager.save('clients', client, 'id');
        }
        this.fillClientForm(client);
    }

    async searchClient(query) {
        if (query.length < 3) return;

        const clients = await window.dbManager.getAll('clients');
        const match = clients.find(c => 
            c.id.includes(query) || 
            c.name.toLowerCase().includes(query.toLowerCase())
        );

        if (match) {
            this.fillClientForm(match);
        }
    }

    async getClientById(id) {
        return await window.dbManager.getById('clients', id);
    }

    fillClientForm(client) {
        document.getElementById('client-id').value = client.id;
        document.getElementById('client-name').value = client.name;
        document.getElementById('client-phone').value = client.phone || '';
        document.getElementById('client-address').value = client.address || '';
        this.currentClient = client;
        // Elegir un cliente es parte de la cotización en curso: se refleja en el borrador.
        if (window.quotationManager) window.quotationManager.saveDraft();
    }

    async autoSaveClient() {
        const id = document.getElementById('client-id').value;
        const name = document.getElementById('client-name').value;
        if (!id || !name) return;

        this.currentClient = {
            id,
            name,
            phone: document.getElementById('client-phone').value,
            address: document.getElementById('client-address').value,
            updatedAt: new Date().toISOString()
        };
        
        await window.dbManager.save('clients', this.currentClient);
        if (window.quotationManager) window.quotationManager.saveDraft();
        window.app.updateDashboardStats();
    }

    validateClientForm() {
        const id = document.getElementById('client-id').value;
        const name = document.getElementById('client-name').value;
        
        if (!id || !name) {
            alert('Por favor ingrese al menos Cédula/RUC y Nombre del cliente.');
            return false;
        }
        this.autoSaveClient();
        return true;
    }

    async loadClientsList(query = '') {
        let clients = await window.dbManager.getAll('clients');
        const container = document.getElementById('clients-list');
        
        if (query) {
            const q = query.toLowerCase();
            clients = clients.filter(c => 
                c.id.toLowerCase().includes(q) || 
                c.name.toLowerCase().includes(q)
            );
        }
        
        if (clients.length === 0) {
            container.innerHTML = '<p class="text-muted">No hay clientes registrados en la base de datos.</p>';
            return;
        }
        
        // Se arma con DOM/textContent (no innerHTML con template strings) para que un
        // nombre/cédula/dirección de cliente con HTML o comillas no pueda inyectar
        // código — ni como HTML ni rompiendo el atributo onclick de los botones.
        container.innerHTML = '';
        const table = document.createElement('table');
        table.className = 'table';
        table.innerHTML = '<thead><tr><th>Cédula/RUC</th><th>Nombre</th><th>Teléfono</th><th>Dirección</th><th>Acciones</th></tr></thead>';
        const tbody = document.createElement('tbody');

        clients.forEach(c => {
            const tr = document.createElement('tr');

            const tdId = document.createElement('td');
            tdId.textContent = c.id;
            const tdName = document.createElement('td');
            tdName.textContent = c.name;
            const tdPhone = document.createElement('td');
            tdPhone.textContent = c.phone || '-';
            const tdAddress = document.createElement('td');
            tdAddress.textContent = c.address || '-';

            const tdActions = document.createElement('td');
            const btnEdit = document.createElement('button');
            btnEdit.className = 'btn btn-sm btn-outline';
            btnEdit.innerHTML = '<i class="fa-solid fa-edit"></i>';
            btnEdit.addEventListener('click', () => this.editClient(c.id));
            const btnDelete = document.createElement('button');
            btnDelete.className = 'btn btn-sm btn-danger';
            btnDelete.innerHTML = '<i class="fa-solid fa-trash"></i>';
            btnDelete.addEventListener('click', () => this.deleteClient(c.id));
            tdActions.appendChild(btnEdit);
            tdActions.appendChild(btnDelete);

            tr.append(tdId, tdName, tdPhone, tdAddress, tdActions);
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        container.appendChild(table);
    }

    async editClient(id) {
        const client = await window.dbManager.getById('clients', id);
        if (client) {
            document.getElementById('edit-client-original-id').value = client.id;
            document.getElementById('edit-client-id').value = client.id;
            document.getElementById('edit-client-name').value = client.name;
            document.getElementById('edit-client-phone').value = client.phone || '';
            document.getElementById('edit-client-address').value = client.address || '';
            document.getElementById('edit-client-msg').style.display = 'none';
            
            const modal = document.getElementById('modal-edit-client');
            modal.style.display = 'flex';
        }
    }

    closeEditModal() {
        document.getElementById('modal-edit-client').style.display = 'none';
    }

    async saveEditClient() {
        const originalId = document.getElementById('edit-client-original-id').value;
        const newId = document.getElementById('edit-client-id').value.trim();
        const newName = document.getElementById('edit-client-name').value.trim();
        const newPhone = document.getElementById('edit-client-phone').value.trim();
        const newAddress = document.getElementById('edit-client-address').value.trim();
        const msgEl = document.getElementById('edit-client-msg');

        if (!newId || !newName) {
            msgEl.textContent = 'Cédula/RUC y nombre son obligatorios.';
            msgEl.style.color = 'var(--danger)';
            msgEl.style.display = 'block';
            return;
        }

        const updatedClient = {
            id: newId,
            name: newName,
            phone: newPhone,
            address: newAddress,
            updatedAt: new Date().toISOString()
        };

        if (originalId !== newId) {
            await window.dbManager.delete('clients', originalId);
        }
        
        await window.dbManager.save('clients', updatedClient);
        this.closeEditModal();
        this.loadClientsList();
        window.app.updateDashboardStats();
    }

    async deleteClient(id) {
        if(confirm('¿Está seguro de eliminar este cliente?')) {
            await window.dbManager.delete('clients', id);
            this.loadClientsList();
            window.app.updateDashboardStats();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Wait for DB to initialize before starting client manager
    setTimeout(() => {
        window.clientManager = new ClientManager();
        
        // Bind edit form
        const editForm = document.getElementById('edit-client-form');
        if (editForm) {
            editForm.addEventListener('submit', (e) => {
                e.preventDefault();
                window.clientManager.saveEditClient();
            });
        }
    }, 500);
});
