// Ensure Firebase is initialized before using it
// The Firebase SDKs are loaded in index.html with type="module"
// and expose necessary objects globally as `window.firebase`

class MoneyLendingManager {
    constructor() {
        this.records = [];
        this.unsubscribe = null; // To store the Firestore unsubscribe function
        this.init();
    }

    init() {
        this.bindEvents();
        // Load records will be called once Firebase auth is ready
        // (handled by the onAuthStateChanged listener in index.html)
    }

    bindEvents() {
        const uploadBtn = document.getElementById('uploadBtn');
        const fileInput = document.getElementById('fileInput');
        const searchInput = document.getElementById('searchInput');

        uploadBtn.addEventListener('click', () => this.uploadFile());
        searchInput.addEventListener('input', (e) => this.searchRecords(e.target.value));

        // Hide search results when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                document.getElementById('searchResults').style.display = 'none';
            }
        });

        // Modal event listeners
        document.querySelector('.close-button').addEventListener('click', () => this.hideModal());
        document.getElementById('modalOkBtn').addEventListener('click', () => this.hideModal());
    }

    /**
     * Displays a custom modal message.
     * @param {string} message - The message to display.
     * @param {string} type - 'alert' for OK button, 'confirm' for Confirm/Cancel buttons.
     * @returns {Promise<boolean>} Resolves to true for confirm, false for cancel, or always true for alert.
     */
    showModal(message, type = 'alert') {
        const modal = document.getElementById('customModal');
        const modalMessage = document.getElementById('modalMessage');
        const modalConfirmBtn = document.getElementById('modalConfirmBtn');
        const modalCancelBtn = document.getElementById('modalCancelBtn');
        const modalOkBtn = document.getElementById('modalOkBtn');

        modalMessage.textContent = message;

        modalConfirmBtn.style.display = 'none';
        modalCancelBtn.style.display = 'none';
        modalOkBtn.style.display = 'none';

        return new Promise(resolve => {
            if (type === 'confirm') {
                modalConfirmBtn.style.display = 'inline-block';
                modalCancelBtn.style.display = 'inline-block';
                modalConfirmBtn.onclick = () => {
                    this.hideModal();
                    resolve(true);
                };
                modalCancelBtn.onclick = () => {
                    this.hideModal();
                    resolve(false);
                };
            } else { // 'alert'
                modalOkBtn.style.display = 'inline-block';
                modalOkBtn.onclick = () => {
                    this.hideModal();
                    resolve(true);
                };
            }
            modal.style.display = 'block';
        });
    }

    hideModal() {
        document.getElementById('customModal').style.display = 'none';
    }

    async uploadFile() {
        if (!window.isAuthReady || !window.db || !window.userId) {
            this.showStatus('Firebase not ready. Please wait a moment.', 'error');
            return;
        }

        const fileInput = document.getElementById('fileInput');
        const file = fileInput.files[0];

        if (!file) {
            this.showStatus('Please select an Excel file first.', 'error');
            return;
        }

        this.showStatus('Processing file...', 'loading');

        try {
            const data = await this.readExcelFile(file);
            if (data.length === 0) {
                this.showStatus('No data found in the Excel file.', 'error');
                return;
            }

            const recordsCollectionRef = window.firebase.collection(window.firebase.db, `artifacts/${window.firebase.appId}/users/${window.userId}/records`);
            let uploadedCount = 0;

            for (const row of data) {
                const record = {
                    name: row.Name || row.name || '',
                    amount: parseFloat(row.Amount || row.amount || 0),
                    paid: (row.Paid || row.paid || row['Paid Back'] || '').toLowerCase() === 'yes' ? 'yes' : 'no',
                    timestamp: new Date(), // Add timestamp
                };

                // Add record to Firestore
                await window.firebase.addDoc(recordsCollectionRef, record);
                uploadedCount++;
            }

            this.showStatus(`Successfully uploaded ${uploadedCount} records!`, 'success');
            fileInput.value = ''; // Clear the file input
            // loadRecords will be triggered by the onSnapshot listener
        } catch (error) {
            this.showStatus('Error uploading file: ' + error.message, 'error');
            console.error('Upload error:', error);
        }
    }

    readExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet);
                    resolve(json);
                } catch (error) {
                    reject(new Error('Failed to read Excel file. Make sure it is a valid .xlsx or .xls file. ' + error.message));
                }
            };
            reader.onerror = (error) => reject(new Error('File reading error: ' + error.message));
            reader.readAsArrayBuffer(file);
        });
    }

    loadRecords() {
        if (!window.isAuthReady || !window.db || !window.userId) {
            console.log("Firebase not ready for loading records. Waiting for auth...");
            document.getElementById('userIdDisplay').textContent = 'User ID: Loading...';
            return;
        }

        document.getElementById('userIdDisplay').textContent = `User ID: ${window.userId}`;

        // Unsubscribe from previous listener if it exists
        if (this.unsubscribe) {
            this.unsubscribe();
        }

        const recordsCollectionRef = window.firebase.collection(window.firebase.db, `artifacts/${window.firebase.appId}/users/${window.userId}/records`);
        const q = window.firebase.query(recordsCollectionRef);

        this.unsubscribe = window.firebase.onSnapshot(q, (snapshot) => {
            this.records = [];
            snapshot.forEach((doc) => {
                this.records.push({ id: doc.id, ...doc.data() });
            });
            console.log("Records loaded/updated from Firestore:", this.records.length);
            this.displayAllRecords();
            this.updateStatistics();
        }, (error) => {
            console.error("Error fetching records from Firestore:", error);
            this.showStatus('Error loading records: ' + error.message, 'error');
        });
    }

    updateStatistics() {
        const totalAmount = this.records.reduce((sum, record) => sum + parseFloat(record.amount), 0);
        const paidRecords = this.records.filter(record => record.paid === 'yes');
        const paidAmount = paidRecords.reduce((sum, record) => sum + parseFloat(record.amount), 0);
        const remainingAmount = totalAmount - paidAmount;

        document.getElementById('totalAmount').textContent = `₹${totalAmount.toFixed(2)}`;
        document.getElementById('paidAmount').textContent = `₹${paidAmount.toFixed(2)}`;
        document.getElementById('remainingAmount').textContent = `₹${remainingAmount.toFixed(2)}`;
        document.getElementById('paidCount').textContent = paidRecords.length;
        document.getElementById('pendingCount').textContent = this.records.length - paidRecords.length;
        document.getElementById('recordsCount').textContent = `${this.records.length} records`;
    }

    searchRecords(queryText) {
        const searchResults = document.getElementById('searchResults');

        if (!queryText.trim()) {
            searchResults.style.display = 'none';
            return;
        }

        const filteredRecords = this.records.filter(record =>
            record.name.toLowerCase().includes(queryText.toLowerCase())
        );

        if (filteredRecords.length === 0) {
            searchResults.innerHTML = '<div class="search-result-item">No results found</div>';
        } else {
            searchResults.innerHTML = filteredRecords.map(record =>
                this.createRecordHTML(record, true)
            ).join('');
        }

        searchResults.style.display = 'block';
    }

    displayAllRecords() {
        const recordsList = document.getElementById('recordsList');

        if (this.records.length === 0) {
            recordsList.innerHTML = '<p>No records found. Please upload an Excel file first.</p>';
            return;
        }

        // Sort records: pending first, then paid. Within each, sort by name.
        const sortedRecords = [...this.records].sort((a, b) => {
            if (a.paid === 'no' && b.paid === 'yes') return -1;
            if (a.paid === 'yes' && b.paid === 'no') return 1;
            return a.name.localeCompare(b.name);
        });

        recordsList.innerHTML = sortedRecords.map(record =>
            this.createRecordHTML(record, false)
        ).join('');
    }

    createRecordHTML(record, isSearchResult) {
        const containerClass = isSearchResult ? 'search-result-item' : 'record-item';
        const statusClass = record.paid === 'yes' ? 'status-paid' : 'status-pending';
        const statusText = record.paid === 'yes' ? 'Paid' : 'Pending';

        return `
            <div class="${containerClass}">
                <div class="record-info">
                    <div class="record-name">${record.name}</div>
                    <div class="record-amount">₹${parseFloat(record.amount).toFixed(2)}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="record-status ${statusClass}">${statusText}</span>
                    ${record.paid !== 'yes' ? `
                        <button class="mark-paid-btn" onclick="moneyManager.markAsPaid('${record.id}')">
                            Mark as Paid
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    async markAsPaid(recordId) {
        if (!window.db || !window.userId) {
            this.showStatus('Firebase not ready. Cannot update record.', 'error');
            return;
        }

        const recordRef = window.firebase.doc(window.firebase.db, `artifacts/${window.firebase.appId}/users/${window.userId}/records`, recordId);

        try {
            await window.firebase.updateDoc(recordRef, {
                paid: 'yes'
            });
            this.showStatus(`Record marked as paid!`, 'success');
            // loadRecords will be triggered by the onSnapshot listener
        } catch (error) {
            this.showStatus('Error updating record: ' + error.message, 'error');
            console.error('Mark paid error:', error);
        }
    }

    showStatus(message, type) {
        const statusDiv = document.getElementById('uploadStatus');
        statusDiv.textContent = message;
        statusDiv.className = type;
        statusDiv.style.display = 'block';

        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }
}

// Initialize the app
const moneyManager = new MoneyLendingManager();
window.moneyManager = moneyManager; // Expose globally for onclick handlers