/**
 * Firebase Firestore Wrapper for CASALUM
 */
class DBManager {
    constructor() {
        this.db = null;
        this.firebaseConfig = {
            apiKey: "AIzaSyCNd3YEGgP40lE8IzL1wZQjl0PVg9dU2_c",
            authDomain: "casalum-cotizaciones.firebaseapp.com",
            projectId: "casalum-cotizaciones",
            storageBucket: "casalum-cotizaciones.firebasestorage.app",
            messagingSenderId: "678121789472",
            appId: "1:678121789472:web:d517e083b39e03fa408445"
        };
    }

    async init() {
        if (!firebase.apps.length) {
            firebase.initializeApp(this.firebaseConfig);
        }
        this.db = firebase.firestore();
        return this.db;
    }

    async count(storeName) {
        try {
            const snapshot = await this.db.collection(storeName).get();
            return snapshot.size;
        } catch (e) {
            console.error("Error counting collection " + storeName, e);
            return 0;
        }
    }

    // --- Utility Methods to replace IndexedDB transactions ---

    async getAll(collectionName) {
        try {
            const snapshot = await this.db.collection(collectionName).get();
            return snapshot.docs.map(doc => doc.data());
        } catch (e) {
            console.error(`Error getting all from ${collectionName}`, e);
            return [];
        }
    }

    async getById(collectionName, id) {
        try {
            const docRef = await this.db.collection(collectionName).doc(id.toString()).get();
            return docRef.exists ? docRef.data() : null;
        } catch (e) {
            console.error(`Error getting ${id} from ${collectionName}`, e);
            return null;
        }
    }

    async save(collectionName, data, idField = 'id') {
        try {
            let docId = data[idField];
            if (!docId) {
                // Generar un ID automáticamente si no existe (ej: para cotizaciones que usaban autoIncrement)
                const newDocRef = this.db.collection(collectionName).doc();
                docId = newDocRef.id;
                data[idField] = docId;
                await newDocRef.set(data);
            } else {
                await this.db.collection(collectionName).doc(docId.toString()).set(data, { merge: true });
            }
            return data;
        } catch (e) {
            console.error(`Error saving to ${collectionName}`, e);
            throw e;
        }
    }

    /**
     * Reserves a sequential quotation number, scoped per year + creator's initial
     * (e.g. "M001-26" for the 1st quotation created by a user whose initial is "M"
     * in 2026). A Firestore transaction prevents two users from receiving the same
     * number when they save at the same time. Skipped numbers are intentional: a
     * number is never reused. `initial` is optional for backward compatibility with
     * the old global-per-year counter key.
     */
    async nextQuotationNumber(year, initial) {
        const key = initial ? `quotation-${year}-${initial}` : `quotation-${year}`;
        const counterRef = this.db.collection('_counters').doc(key);
        return this.db.runTransaction(async transaction => {
            const counter = await transaction.get(counterRef);
            const next = (counter.exists ? (counter.data().last || 0) : 0) + 1;
            transaction.set(counterRef, { last: next, updatedAt: new Date().toISOString() }, { merge: true });
            return next;
        });
    }

    async delete(collectionName, id) {
        try {
            await this.db.collection(collectionName).doc(id.toString()).delete();
        } catch (e) {
            console.error(`Error deleting ${id} from ${collectionName}`, e);
            throw e;
        }
    }
}

window.dbManager = new DBManager();
