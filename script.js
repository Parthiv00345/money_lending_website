// Ensure Firebase is initialized before using it
// The Firebase SDKs are loaded in index.html with type="module"
// and expose necessary objects globally as `window.firebase`

class MoneyLendingManager {
    constructor() {
        this.records = []; // Stores all lending records
        this.unsubscribe = null; // To store the Firestore unsubscribe function for real-time updates
        this.searchTimeout = null; // For debouncing the search input
        this.init();
    }

    // Initializes the application by binding event listeners
    init() {
        this.bindEvents();
        // The loadRecords() function is called by the onAuthStateChanged listener in index.html
        // once Firebase authentication is ready.
    }

    // Binds event listeners to various UI elements
    bindEvents() {
        const uploadBtn = document.getElementById('uploadBtn');
        const fileInput = document.getElementById('fileInput');
        const searchInput = document.getElementById('searchInput');
        const clearAllDataBtn = document.getElementById('clearAllDataBtn');
        const signInGoogleBtn = document.getElementById('signInGoogleBtn');
        const signOutBtn = document.getElementById('signOutBtn');
        // const recordsList = document.getElementById('recordsList'); // No longer directly used for delegation

        // Email/Password elements
        const emailInput = document.getElementById('emailInput');
        const passwordInput = document.getElementById('passwordInput');
        const signInEmailBtn = document.getElementById('signInEmailBtn');
        const signUpEmailBtn = document.getElementById('signUpEmailBtn'); // Explicit sign-up button
        const authStatusMessage = document.getElementById('authStatusMessage');


        // Event listener for the upload button
        uploadBtn.addEventListener('click', () => this.uploadFile());

        // Event listener for the search input with debouncing
        searchInput.addEventListener('input', (e) => {
            clearTimeout(this.searchTimeout); // Clear previous timeout
            this.searchTimeout = setTimeout(() => {
                this.searchRecords(e.target.value); // Execute search after a delay
            }, 300); // 300ms debounce time
        });

        // Event listener for the clear all data button
        clearAllDataBtn.addEventListener('click', () => this.confirmClearAllData());

        // Event listeners for authentication buttons
        signInGoogleBtn.addEventListener('click', () => this.handleGoogleSignIn());
        signOutBtn.addEventListener('click', () => this.handleSignOut());

        // Email/Password authentication event listeners
        signInEmailBtn.addEventListener('click', () => this.handleEmailSignIn(emailInput.value, passwordInput.value));
        signUpEmailBtn.addEventListener('click', () => this.handleEmailSignUp(emailInput.value, passwordInput.value));


        // Hide search results when clicking outside the search container
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                document.getElementById('searchResults').style.display = 'none';
            }
        });

        // Event delegation for "Mark as Paid" and "Mark as Pending" buttons
        // Attach listener to document.body to catch clicks on dynamically added elements
        document.body.addEventListener('click', (event) => {
            const target = event.target;
            // Check if the clicked element (or its closest ancestor) is a mark-paid-btn or mark-pending-btn
            if (target.classList.contains('mark-paid-btn')) {
                const recordId = target.dataset.id; // Get ID from data-id attribute
                this.markAsPaid(recordId);
            } else if (target.classList.contains('mark-pending-btn')) {
                const recordId = target.dataset.id; // Get ID from data-id attribute
                this.markAsPending(recordId);
            }
        });


        // Event listeners for the custom modal (alert/confirm dialog)
        document.querySelector('.close-button').addEventListener('click', () => this.hideModal());
        document.getElementById('modalOkBtn').addEventListener('click', () => this.hideModal());
    }

    /**
     * Toggles the visibility of UI elements based on authentication status.
     * @param {firebase.User} user - The authenticated Firebase user object, or null if logged out.
     */
    toggleUIForAuth(user) {
        const authenticatedContent = document.getElementById('authenticatedContent');
        const authSection = document.getElementById('authSection'); // The new combined auth section
        const signOutBtn = document.getElementById('signOutBtn');
        const userIdDisplay = document.getElementById('userIdDisplay');
        const authStatusMessage = document.getElementById('authStatusMessage');
        const uploadSection = document.getElementById('uploadSection'); // Get reference to upload section

        if (user && user.uid) { // User is logged in
            authSection.style.display = 'none';
            authenticatedContent.style.display = 'block';
            signOutBtn.style.display = 'inline-block';
            userIdDisplay.textContent = `User: ${user.email || 'Guest User'}`; // Display email if available, else "Guest User"
            authStatusMessage.textContent = ''; // Clear auth status message
            console.log("UI updated: Logged in state.");
            this.toggleUploadSectionVisibility(); // Call this after user is logged in
        } else { // User is logged out
            authSection.style.display = 'block';
            authenticatedContent.style.display = 'none';
            signOutBtn.style.display = 'none';
            userIdDisplay.textContent = 'User: Not Signed In';
            this.records = []; // Clear records when logged out
            this.updateStatistics(); // Update stats to show zeros
            this.displayAllRecords(); // Clear displayed records
            uploadSection.style.display = 'none'; // Ensure upload section is hidden when logged out
            if (this.unsubscribe) {
                this.unsubscribe(); // Stop listening for data
                this.unsubscribe = null;
                console.log("UI updated: Logged out state. Firestore listener unsubscribed.");
            } else {
                console.log("UI updated: Logged out state.");
            }
        }
    }

    /**
     * Toggles the visibility of the upload section based on whether records exist.
     */
    toggleUploadSectionVisibility() {
        const uploadSection = document.getElementById('uploadSection');
        if (this.records.length === 0) {
            uploadSection.style.display = 'block'; // Show if no records
        } else {
            uploadSection.style.display = 'none'; // Hide if records exist
        }
    }

    /**
     * Handles Google Sign-In using Firebase.
     */
    async handleGoogleSignIn() {
        const authStatusMessage = document.getElementById('authStatusMessage');
        authStatusMessage.className = 'status-message'; // Reset class
        authStatusMessage.textContent = ''; // Clear previous message

        if (!window.firebase.auth) {
            authStatusMessage.textContent = 'Firebase Auth not initialized. Please check your Firebase config.';
            authStatusMessage.classList.add('error');
            console.error("handleGoogleSignIn: window.firebase.auth is null.");
            return;
        }
        try {
            console.log("Attempting Google Sign-In popup...");
            authStatusMessage.textContent = 'Signing in with Google...';
            authStatusMessage.classList.add('loading');
            const provider = new window.firebase.GoogleAuthProvider();
            const result = await window.firebase.signInWithPopup(window.firebase.auth, provider);
            console.log("Google Sign-In successful!", result.user);
            authStatusMessage.textContent = 'Signed in with Google successfully!';
            authStatusMessage.classList.add('success');
            // onAuthStateChanged listener will handle UI update and data loading
        } catch (error) {
            console.error("Error during Google Sign-In:", error);
            let errorMessage = "An unknown error occurred.";
            if (error.code) {
                errorMessage = `Error Code: ${error.code}. `;
                switch (error.code) {
                    case 'auth/popup-closed-by-user':
                        errorMessage = 'Sign-in popup was closed.';
                        break;
                    case 'auth/cancelled-popup-request':
                        errorMessage = 'Multiple sign-in attempts too quickly, or popup already open.';
                        break;
                    case 'auth/popup-blocked':
                        errorMessage += 'Browser blocked the sign-in popup. Please allow pop-ups for this site.';
                        break;
                    case 'auth/network-request-failed':
                        errorMessage += 'Network error. Check your internet connection.';
                        break;
                    case 'auth/operation-not-allowed':
                        errorMessage = 'Google Sign-In is not enabled in your Firebase project. Please enable it in Firebase Console -> Authentication -> Sign-in method.';
                        break;
                    case 'auth/account-exists-with-different-credential':
                        // This is the crucial part for account linking guidance
                        errorMessage = `An account with this email (${error.customData.email}) already exists using Email/Password. Please sign in with your email and password instead.`;
                        break;
                    default:
                        errorMessage = error.message;
                }
            } else {
                errorMessage = error.message;
            }
            authStatusMessage.textContent = `Sign-In failed: ${errorMessage}`;
            authStatusMessage.classList.add('error');
        }
    }

    /**
     * Handles user sign-out from Firebase.
     */
    async handleSignOut() {
        if (!window.firebase.auth) {
            this.showStatus('Firebase Auth not initialized.', 'error');
            console.error("handleSignOut: window.firebase.auth is null.");
            return;
        }
        try {
            console.log("Attempting to sign out...");
            await window.firebase.signOut(window.firebase.auth);
            console.log("Sign out successful.");
            this.showStatus('Signed out successfully!', 'success');
            // onAuthStateChanged listener will handle UI update and data clearing
        } catch (error) {
            console.error("Error during sign-out:", error);
            this.showStatus(`Sign out failed: ${error.message}`, 'error');
        }
    }

    /**
     * Handles Email/Password Sign-Up using Firebase.
     * @param {string} email - User's email.
     * @param {string} password - User's password.
     */
    async handleEmailSignUp(email, password) {
        const authStatusMessage = document.getElementById('authStatusMessage');
        authStatusMessage.className = 'status-message'; // Reset class
        authStatusMessage.textContent = ''; // Clear previous message

        if (!window.firebase.auth) {
            authStatusMessage.textContent = 'Firebase Auth not initialized.';
            authStatusMessage.classList.add('error');
            return;
        }
        if (!email || !password) {
            authStatusMessage.textContent = 'Please enter both email and password.';
            authStatusMessage.classList.add('error');
            return;
        }
        if (password.length < 6) {
            authStatusMessage.textContent = 'Password should be at least 6 characters.';
            authStatusMessage.classList.add('error');
            return;
        }

        try {
            authStatusMessage.textContent = 'Signing up...';
            authStatusMessage.classList.add('loading');
            const userCredential = await window.firebase.createUserWithEmailAndPassword(window.firebase.auth, email, password);
            console.log("Email Sign-Up successful!", userCredential.user);
            authStatusMessage.textContent = `Signed up as ${userCredential.user.email}!`;
            authStatusMessage.classList.add('success');
            // onAuthStateChanged listener will handle UI update and data loading
        } catch (error) {
            console.error("Error during Email Sign-Up:", error);
            let errorMessage = "An unknown error occurred.";
            switch (error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = 'This email is already in use. Try signing in.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Invalid email address.';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'Password is too weak. Please choose a stronger one.';
                    break;
                case 'auth/network-request-failed':
                    errorMessage = 'Network error. Check your internet connection.';
                    break;
                case 'auth/operation-not-allowed':
                    errorMessage = 'Email/Password sign-in is not enabled in your Firebase project. Please enable it in Firebase Console -> Authentication -> Sign-in method.';
                    break;
                default:
                    errorMessage = error.message;
            }
            authStatusMessage.textContent = `Sign-up failed: ${errorMessage}`;
            authStatusMessage.classList.add('error');
        }
    }

    /**
     * Handles Email/Password Sign-In using Firebase.
     * @param {string} email - User's email.
     * @param {string} password - User's password.
     */
    async handleEmailSignIn(email, password) {
        const authStatusMessage = document.getElementById('authStatusMessage');
        authStatusMessage.className = 'status-message'; // Reset class
        authStatusMessage.textContent = ''; // Clear previous message

        if (!window.firebase.auth) {
            authStatusMessage.textContent = 'Firebase Auth not initialized.';
            authStatusMessage.classList.add('error');
            return;
        }
        if (!email || !password) {
            authStatusMessage.textContent = 'Please enter both email and password.';
            authStatusMessage.classList.add('error');
            return;
        }

        try {
            authStatusMessage.textContent = 'Signing in...';
            authStatusMessage.classList.add('loading');
            const userCredential = await window.firebase.signInWithEmailAndPassword(window.firebase.auth, email, password);
            console.log("Email Sign-In successful!", userCredential.user);
            authStatusMessage.textContent = `Signed in as ${userCredential.user.email}!`;
            authStatusMessage.classList.add('success');
            // onAuthStateChanged listener will handle UI update and data loading
        } catch (error) {
            console.error("Error during Email Sign-In:", error);
            let errorMessage = "An unknown error occurred.";
            switch (error.code) {
                case 'auth/invalid-email':
                case 'auth/user-not-found':
                    errorMessage = 'No user found with this email. Please sign up first.';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Incorrect password.';
                    break;
                case 'auth/user-disabled':
                    errorMessage = 'This account has been disabled.';
                    break;
                case 'auth/network-request-failed':
                    errorMessage = 'Network error. Check your internet connection.';
                    break;
                default:
                    errorMessage = error.message;
            }
            authStatusMessage.textContent = `Sign-in failed: ${errorMessage}`;
            authStatusMessage.classList.add('error');
        }
    }


    /**
     * Displays a custom modal message, replacing browser's alert/confirm.
     * @param {string} message - The message to display in the modal.
     * @param {string} type - 'alert' for OK button, 'confirm' for Confirm/Cancel buttons.
     * @returns {Promise<boolean>} Resolves to true for confirm, false for cancel, or always true for alert.
     */
    showModal(message, type = 'alert') {
        const modal = document.getElementById('customModal');
        const modalMessage = document.getElementById('modalMessage');
        const modalConfirmBtn = document.getElementById('modalConfirmBtn');
        const modalCancelBtn = document.getElementById('modalCancelBtn');
        const modalOkBtn = document.getElementById('modalOkBtn');

        modalMessage.textContent = message; // Set the message text

        // Hide all buttons initially
        modalConfirmBtn.style.display = 'none';
        modalCancelBtn.style.display = 'none';
        modalOkBtn.style.display = 'none';

        return new Promise(resolve => {
            if (type === 'confirm') {
                // Show Confirm and Cancel buttons for confirmation dialogs
                modalConfirmBtn.style.display = 'inline-block';
                modalCancelBtn.style.display = 'inline-block';
                modalConfirmBtn.onclick = () => {
                    this.hideModal();
                    resolve(true); // Resolve with true if confirmed
                };
                modalCancelBtn.onclick = () => {
                    this.hideModal();
                    resolve(false); // Resolve with false if cancelled
                };
            } else { // Default to 'alert' type
                // Show only the OK button for alert messages
                modalOkBtn.style.display = 'inline-block';
                modalOkBtn.onclick = () => {
                    this.hideModal();
                    resolve(true); // Always resolve with true for alerts
                };
            }
            modal.style.display = 'flex'; // Display the modal (using flex for centering)
        });
    }

    // Hides the custom modal
    hideModal() {
        document.getElementById('customModal').style.display = 'none';
    }

    // Handles the Excel file upload process
    async uploadFile() {
        // Check if Firebase is ready and user is authenticated
        if (!window.isAuthReady || !window.db || !window.userId) {
            this.showStatus('Please sign in to upload records.', 'error');
            return;
        }

        const fileInput = document.getElementById('fileInput');
        const file = fileInput.files[0];

        if (!file) {
            this.showStatus('Please select an Excel file first.', 'error');
            return;
        }

        this.showStatus('Processing file...', 'loading'); // Show loading status

        try {
            const data = await this.readExcelFile(file); // Read and parse Excel data
            if (data.length === 0) {
                this.showStatus('No data found in the Excel file.', 'error');
                return;
            }

            const recordsCollectionRef = window.firebase.collection(window.firebase.db, `artifacts/${window.firebase.appId}/users/${window.userId}/records`);
            const BATCH_SIZE = 499; // Max 500 operations per batch, leave one for safety
            let uploadedCount = 0;

            // Process data in chunks
            for (let i = 0; i < data.length; i += BATCH_SIZE) {
                const chunk = data.slice(i, i + BATCH_SIZE);
                const batch = window.firebase.writeBatch(window.firebase.db); // New batch for each chunk

                for (const row of chunk) {
                    const record = {
                        name: String(row.Name || row.name || '').trim(),
                        amount: parseFloat(row.Amount || row.amount || 0),
                        paid: (String(row.Paid || row.paid || row['Paid Back'] || '')).toLowerCase() === 'yes' ? 'yes' : 'no',
                        timestamp: new Date(),
                    };
                    const newDocRef = window.firebase.doc(recordsCollectionRef);
                    batch.set(newDocRef, record);
                    uploadedCount++;
                }
                await batch.commit(); // Commit each batch
                this.showStatus(`Uploading... processed ${uploadedCount} of ${data.length} records.`, 'loading');
            }

            this.showStatus(`Successfully uploaded ${uploadedCount} records!`, 'success');
            fileInput.value = ''; // Clear the file input field
            // The onSnapshot listener will automatically trigger loadRecords() after batch commit
            this.toggleUploadSectionVisibility(); // Hide upload section after successful upload
        } catch (error) {
            this.showStatus('Error uploading file: ' + error.message, 'error');
            console.error('Upload error:', error);
        }
    }

    // Reads and parses an Excel file using SheetJS library
    readExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0]; // Get the first sheet
                    const worksheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet); // Convert sheet to JSON array
                    resolve(json);
                } catch (error) {
                    reject(new Error('Failed to read Excel file. Please ensure it is a valid .xlsx or .xls file. ' + error.message));
                }
            };
            reader.onerror = (error) => reject(new Error('File reading error: ' + error.message));
            reader.readAsArrayBuffer(file); // Read file as ArrayBuffer
        });
    }

    // Loads records from Firestore and sets up a real-time listener
    loadRecords() {
        // Only load records if Firebase is ready and a user is logged in
        if (!window.isAuthReady || !window.db || !window.userId) {
            console.log("loadRecords: Firebase not ready or no user logged in. Clearing local records and UI.");
            this.records = []; // Ensure records are cleared if not logged in
            this.displayAllRecords();
            this.updateStatistics();
            this.toggleUploadSectionVisibility(); // Ensure hidden when logged out
            return;
        }

        // Unsubscribe from any previous real-time listener to prevent multiple listeners
        if (this.unsubscribe) {
            this.unsubscribe();
            console.log("loadRecords: Unsubscribed from previous Firestore listener.");
        }

        // Get a reference to the user's records collection
        const recordsCollectionRef = window.firebase.collection(window.firebase.db, `artifacts/${window.firebase.appId}/users/${window.userId}/records`);
        // We are NOT adding orderBy here to prevent reordering on status change
        const q = window.firebase.query(recordsCollectionRef);

        // Set up a real-time listener using onSnapshot
        console.log("loadRecords: Setting up new Firestore listener for user:", window.userId);
        this.unsubscribe = window.firebase.onSnapshot(q, (snapshot) => {
            this.records = []; // Clear current records
            snapshot.forEach((doc) => {
                // Add each document's data and its ID to the records array
                this.records.push({ id: doc.id, ...doc.data() });
            });
            console.log("Firestore snapshot received. Records loaded:", this.records.length);
            this.displayAllRecords(); // Update the displayed list
            this.updateStatistics(); // Update summary statistics
            this.toggleUploadSectionVisibility(); // Update visibility based on loaded records
        }, (error) => {
            console.error("Error fetching records from Firestore:", error);
            this.showStatus('Error loading records: ' + error.message, 'error');
        });
    }

    // Updates the statistics displayed on the dashboard
    updateStatistics() {
        // Calculate total, paid, and remaining amounts
        const totalAmount = this.records.reduce((sum, record) => sum + parseFloat(record.amount), 0);
        const paidRecords = this.records.filter(record => record.paid === 'yes');
        const paidAmount = paidRecords.reduce((sum, record) => sum + parseFloat(record.amount), 0);
        const remainingAmount = totalAmount - paidAmount;

        // Update UI elements with calculated statistics
        document.getElementById('totalAmount').textContent = `₹${totalAmount.toFixed(2)}`;
        document.getElementById('paidAmount').textContent = `₹${paidAmount.toFixed(2)}`;
        document.getElementById('remainingAmount').textContent = `₹${remainingAmount.toFixed(2)}`;
        document.getElementById('paidCount').textContent = paidRecords.length;
        document.getElementById('pendingCount').textContent = this.records.length - paidRecords.length;
        document.getElementById('recordsCount').textContent = `${this.records.length} records`;
    }

    // Filters and displays records based on a search query
    searchRecords(queryText) {
        const searchResults = document.getElementById('searchResults');

        if (!queryText.trim()) {
            searchResults.style.display = 'none'; // Hide results if query is empty
            return;
        }

        // Filter records where the name includes the query text (case-insensitive)
        const filteredRecords = this.records.filter(record =>
            record.name.toLowerCase().includes(queryText.toLowerCase())
        );

        if (filteredRecords.length === 0) {
            searchResults.innerHTML = '<div class="search-result-item">No results found</div>';
        } else {
            // Generate HTML for filtered records and display them
            searchResults.innerHTML = filteredRecords.map(record =>
                this.createRecordHTML(record, true) // Pass true for search result styling
            ).join('');
        }

        searchResults.style.display = 'block'; // Show the search results container
    }

    // Displays all records in the main records list
    displayAllRecords() {
        const recordsList = document.getElementById('recordsList');

        if (this.records.length === 0) {
            recordsList.innerHTML = '<p>No records found. Please upload an Excel file first.</p>';
            return;
        }

        // *** UPDATED: Sort records alphabetically by name ***
        const sortedRecords = [...this.records].sort((a, b) => {
            return a.name.localeCompare(b.name);
        });

        // Generate HTML for all sorted records and display them
        recordsList.innerHTML = sortedRecords.map(record =>
            this.createRecordHTML(record, false) // Pass false for general record list styling
        ).join('');
    }

    /**
     * Helper function to escape HTML entities to prevent XSS.
     * @param {string} str - The string to escape.
     * @returns {string} The escaped string.
     */
    escapeHTML(str) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    /**
     * Creates the HTML string for a single record item.
     * @param {object} record - The record object from Firestore.
     * @param {boolean} isSearchResult - True if rendering for search results, false for main list.
     * @returns {string} The HTML string for the record.
     */
    createRecordHTML(record, isSearchResult) {
        const containerClass = isSearchResult ? 'search-result-item' : 'record-item';
        const statusClass = record.paid === 'yes' ? 'status-paid' : 'status-pending';
        const statusText = record.paid === 'yes' ? 'Paid' : 'Pending';

        let actionButtonHTML = '';
        if (record.paid !== 'yes') {
            // If status is pending, show "Mark as Paid" button
            actionButtonHTML = `
                <button class="mark-paid-btn" data-id="${record.id}">
                    Mark as Paid
                </button>
            `;
        } else {
            // If status is paid, show "Mark as Pending" button
            actionButtonHTML = `
                <button class="mark-pending-btn" data-id="${record.id}">
                    Mark as Pending
                </button>
            `;
        }

        return `
            <div class="${containerClass}">
                <div class="record-info">
                    <div class="record-name">${this.escapeHTML(record.name)}</div>
                    <div class="record-amount">₹${parseFloat(record.amount).toFixed(2)}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="record-status ${statusClass}">${statusText}</span>
                    ${actionButtonHTML}
                </div>
            </div>
        `;
    }

    // Marks a specific record as paid in Firestore
    async markAsPaid(recordId) {
        // Ensure Firebase is ready and user is logged in
        if (!window.db || !window.userId) {
            this.showStatus('Please sign in to update records.', 'error');
            return;
        }

        // Get a reference to the specific document to update
        const recordRef = window.firebase.doc(window.firebase.db, `artifacts/${window.firebase.appId}/users/${window.userId}/records`, recordId);

        try {
            console.log("Attempting to mark record as paid:", recordId);
            // Update the 'paid' field to 'yes'
            await window.firebase.updateDoc(recordRef, {
                paid: 'yes'
            });
            console.log("Record marked as paid successfully:", recordId);
            this.showStatus(`Record marked as paid!`, 'success');

            // Refresh search results if visible
            const searchInput = document.getElementById('searchInput');
            const searchResults = document.getElementById('searchResults');
            if (searchInput.value.trim() !== '' && searchResults.style.display === 'block') {
                this.searchRecords(searchInput.value);
            }
            // The onSnapshot listener will automatically re-load and update the main UI
        } catch (error) {
            console.error('Error updating record to paid:', error);
            this.showStatus('Error updating record: ' + error.message, 'error');
        }
    }

    // Marks a specific record as pending in Firestore (new function)
    async markAsPending(recordId) {
        // Ensure Firebase is ready and user is logged in
        if (!window.db || !window.userId) {
            this.showStatus('Please sign in to update records.', 'error');
            return;
        }

        // Get a reference to the specific document to update
        const recordRef = window.firebase.doc(window.firebase.db, `artifacts/${window.firebase.appId}/users/${window.userId}/records`, recordId);

        try {
            console.log("Attempting to mark record as pending:", recordId);
            // Update the 'paid' field to 'no'
            await window.firebase.updateDoc(recordRef, {
                paid: 'no'
            });
            console.log("Record marked as pending successfully:", recordId);
            this.showStatus(`Record marked as pending!`, 'info'); // Use 'info' for a neutral status

            // Refresh search results if visible
            const searchInput = document.getElementById('searchInput');
            const searchResults = document.getElementById('searchResults');
            if (searchInput.value.trim() !== '' && searchResults.style.display === 'block') {
                this.searchRecords(searchInput.value);
            }
            // The onSnapshot listener will automatically re-load and update the main UI
        } catch (error) {
            console.error('Error updating record to pending:', error);
            this.showStatus('Error updating record: ' + error.message, 'error');
        }
    }

    // Prompts the user for confirmation before clearing all data
    async confirmClearAllData() {
        if (!window.userId) {
            this.showStatus('Please sign in to clear data.', 'error');
            return;
        }
        const confirmed = await this.showModal(
            'Are you sure you want to delete ALL your lending records? This action cannot be undone.',
            'confirm'
        );

        if (confirmed) {
            this.clearAllData();
        } else {
            this.showStatus('Data clearing cancelled.', 'info');
        }
    }

    // Deletes all records for the current user from Firestore
    async clearAllData() {
        if (!window.isAuthReady || !window.db || !window.userId) {
            this.showStatus('Firebase not ready or no user logged in. Cannot clear data.', 'error');
            return;
        }

        this.showStatus('Clearing all records...', 'loading');

        try {
            const recordsCollectionRef = window.firebase.collection(window.firebase.db, `artifacts/${window.firebase.appId}/users/${window.userId}/records`);
            const q = window.firebase.query(recordsCollectionRef);
            const querySnapshot = await window.firebase.getDocs(q); // Get all documents in the collection

            if (querySnapshot.empty) {
                this.showStatus('No records to clear.', 'info');
                return;
            }

            const batch = window.firebase.writeBatch(window.firebase.db); // Use a batch for efficient deletion
            let deletedCount = 0;
            querySnapshot.forEach((doc) => {
                batch.delete(doc.ref); // Add each document to the batch for deletion
                deletedCount++;
            });

            await batch.commit(); // Commit the batch delete operation

            this.showStatus(`Successfully cleared ${deletedCount} records.`, 'success');
            // The onSnapshot listener will automatically update the UI to show an empty list
            this.toggleUploadSectionVisibility(); // Show upload section after clearing data
        } catch (error) {
            this.showStatus('Error clearing data: ' + error.message, 'error');
            console.error('Clear data error:', error);
        }
    }

    /**
     * Displays a temporary status message to the user.
     * @param {string} message - The message to display.
     * @param {string} type - 'success', 'error', 'loading', or 'info' for styling.
     */
    showStatus(message, type) {
        const statusDiv = document.getElementById('uploadStatus');
        statusDiv.textContent = message;
        statusDiv.className = type; // Apply CSS class for styling
        statusDiv.style.display = 'block'; // Make sure it's visible

        // Hide the status message after 5 seconds
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }
}

// Initialize the MoneyLendingManager application
const moneyManager = new MoneyLendingManager();
window.moneyManager = moneyManager; // Expose globally to allow onclick handlers to call its methods