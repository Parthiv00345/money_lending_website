// Ensure Firebase is initialized before using it
// The Firebase SDKs are loaded in index.html with type="module"
// and expose necessary objects globally as `window.firebase`

class MoneyLendingManager {
    constructor() {
        this.records = []; // Stores all lending records
        this.unsubscribe = null; // To store the Firestore unsubscribe function for real-time updates
        this.searchTimeout = null; // For debouncing the search input
        this.currentFilter = 'all'; // Default filter for records ('all', 'yes' (paid), 'no' (pending))

        // Appearance settings
        this.currentTheme = localStorage.getItem('theme') || 'dark';
        this.currentFontSize = localStorage.getItem('fontSize') || 'medium';
        // Accent color removed as per user request. Default remains set in CSS directly.

        // App Info for "About" section
        this.appVersion = '1.0.0';
        this.appDescription = 'Money Lending Manager helps you easily track and manage your lending records. This application provides a simple and intuitive interface to log money you have lent out, track payments received, and manage the status of each loan. All your data is securely stored in the cloud.';
        this.termsOfServiceContent = `
            <h3>Terms of Service</h3>
            <p>Welcome to Money Lending Manager! By using this application, you agree to the following terms and conditions. Please read them carefully.</p>
            <p><strong>1. Acceptance of Terms:</strong> By accessing or using our application, you agree to be bound by these Terms of Service and all terms incorporated by reference.</p>
            <p><strong>2. Use of Service:</strong> This application is intended for personal financial tracking of lending activities. You agree not to use the service for any unlawful or prohibited purposes.</p>
            <p><strong>3. Data Accuracy:</strong> You are responsible for the accuracy of the data you enter into the application. We are not liable for any discrepancies or losses arising from inaccurate data.</p>
            <p><strong>4. Account Security:</strong> You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>
            <p><strong>5. Limitation of Liability:</strong> The application is provided "as is" without any warranties. We shall not be liable for any direct, indirect, incidental, special, or consequential damages resulting from the use or inability to use the service.</p>
            <p><strong>6. Changes to Terms:</strong> We reserve the right to modify or replace these terms at any time. Your continued use of the service after any such changes constitutes your acceptance of the new Terms of Service.</p>
            <p><strong>7. Governing Law:</strong> These terms shall be governed by the laws of your jurisdiction, without regard to its conflict of law provisions.</p>
            <p>For any questions regarding these terms, please contact us.</p>
        `;
        this.privacyPolicyContent = `
            <h3>Privacy Policy</h3>
            <p>Your privacy is important to us. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Money Lending Manager application.</p>
            <p><strong>1. Information Collection:</strong> We collect personal information that you voluntarily provide to us when you register for the app, such as your email address, and financial data related to your lending records (names, amounts, status).</p>
            <p><strong>2. How We Use Your Information:</strong> We use the information collected to:</p>
            <ul>
                <li>Provide, operate, and maintain our application.</li>
                <li>Improve, personalize, and expand our application.</li>
                <li>Understand and analyze how you use our application.</li>
                <li>Track and manage your lending records.</li>
                <li>Communicate with you, including for customer service.</li>
            </ul>
            <p><strong>3. Data Storage and Security:</strong> Your data is stored securely using Firebase Firestore. We implement appropriate technical and organizational security measures designed to protect the security of any personal information we process.</p>
            <p><strong>4. Data Sharing and Disclosure:</strong> We do not share or sell your personal information to third parties for their marketing purposes. Your data is primarily for your use within the app.</p>
            <p><strong>5. Your Data Rights:</strong> You have the right to access, update, or delete your personal data. You can manage your records directly within the application.</p>
            <p><strong>6. Changes to This Privacy Policy:</strong> We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.</p>
            <p>If you have any questions about this Privacy Policy, please contact us.</p>
        `;


        this.init();
    }

    // Initializes the application by binding event listeners
    init() {
        this.bindEvents();
        this.applyAppearanceSettings(); // Apply all appearance settings
        this.populateAboutModalContent(); // Populate the About modal's static content
        // The loadRecords() function is called by the onAuthStateChanged listener in index.html
        // once Firebase authentication is ready.
    }

    // Binds event listeners to various UI elements
    bindEvents() {
        const uploadBtn = document.getElementById('uploadBtn');
        const fileInput = document.getElementById('fileInput');
        const searchInput = document.getElementById('searchInput');
        const clearAllDataBtn = document.getElementById('clearAllDataBtn');
        const downloadCsvBtn = document.getElementById('downloadCsvBtn');

        // Email/Password elements
        const emailInput = document.getElementById('emailInput');
        const passwordInput = document.getElementById('passwordInput');
        const signInEmailBtn = document.getElementById('signInEmailBtn');
        const signUpEmailBtn = document.getElementById('signUpEmailBtn');
        const forgotPasswordLink = document.getElementById('forgotPasswordLink');
        const authStatusMessage = document.getElementById('authStatusMessage');

        // Side Drawer elements (NEW)
        const menuBtn = document.getElementById('menuBtn');
        const sideDrawer = document.getElementById('sideDrawer');
        const closeDrawerBtn = document.getElementById('closeDrawerBtn');
        const drawerOverlay = document.getElementById('drawerOverlay');
        const signOutBtn = document.getElementById('signOutBtn'); // Moved to drawer
        const aboutAppButton = document.getElementById('aboutAppButton'); // NEW: Clickable About section in drawer

        // Theme selection
        const darkThemeBtn = document.getElementById('darkThemeBtn');
        const lightThemeBtn = document.getElementById('lightThemeBtn');

        // Font size buttons
        const fontSizeSmallBtn = document.getElementById('fontSizeSmall');
        const fontSizeMediumBtn = document.getElementById('fontSizeMedium');
        const fontSizeLargeBtn = document.getElementById('fontSizeLarge');

        // Filter buttons
        const filterAllBtn = document.getElementById('filterAllBtn');
        const filterPaidBtn = document.getElementById('filterPaidBtn');
        const filterPendingBtn = document.getElementById('filterPendingBtn');

        // Edit Modal elements
        const editModal = document.getElementById('editModal');
        const closeEditModalBtn = document.getElementById('closeEditModalBtn');
        const saveEditBtn = document.getElementById('saveEditBtn');
        const cancelEditBtn = document.getElementById('cancelEditBtn');
        const deleteRecordBtn = document.getElementById('deleteRecordBtn');
        const editPaidAmountInput = document.getElementById('editPaidAmount');
        const editPaidStatusSelect = document.getElementById('editPaidStatus');

        // Add Record elements
        const addRecordBtn = document.getElementById('addRecordBtn');
        const addNameInput = document.getElementById('addName');
        const addAmountInput = document.getElementById('addAmount');
        const addStatusSelect = document.getElementById('addStatus');

        // About Modal elements (NEW)
        const closeAboutModalBtn = document.getElementById('closeAboutModalBtn');
        const aboutOkBtn = document.getElementById('aboutOkBtn');


        // Event listener for the upload button
        uploadBtn.addEventListener('click', () => this.uploadFile());

        // Event listener for the search input with debouncing
        searchInput.addEventListener('input', (e) => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.searchRecords(e.target.value);
            }, 300);
        });

        // Event listener for the clear all data button
        clearAllDataBtn.addEventListener('click', () => this.confirmClearAllData());

        // Event listener for Download CSV button (calls Android interface for APK)
        downloadCsvBtn.addEventListener('click', () => this.downloadCSV());

        // Email/Password authentication event listeners
        signInEmailBtn.addEventListener('click', () => this.handleEmailSignIn(emailInput.value, passwordInput.value));
        signUpEmailBtn.addEventListener('click', () => this.handleEmailSignUp(emailInput.value, passwordInput.value));
        forgotPasswordLink.addEventListener('click', () => this.handleForgotPassword(emailInput.value));

        // Hide search results when clicking outside the search container
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                document.getElementById('searchResults').style.display = 'none';
            }
        });

        // Event delegation for clicking search results to edit
        document.body.addEventListener('click', (event) => {
            const target = event.target;

            // Handle clicking on a search result item to edit it
            const searchResultItem = target.closest('.search-result-item[data-editable="true"]');
            if (searchResultItem) {
                const recordId = searchResultItem.dataset.id;
                this.openEditModal(recordId);
                document.getElementById('searchResults').style.display = 'none';
            }
        });


        // Event listeners for the custom modal (alert/confirm dialog)
        document.querySelector('#customModal .close-button').addEventListener('click', () => this.hideModal('customModal'));
        document.getElementById('modalOkBtn').addEventListener('click', () => this.hideModal('customModal'));

        // Side Drawer Event Listeners (NEW)
        // Conditional behavior for menuBtn based on screen size
        menuBtn.addEventListener('click', () => {
            const sideDrawer = document.getElementById('sideDrawer');
            // Check for mobile-first media query state
            const isMobile = window.matchMedia('(max-width: 767px)').matches;

            if (isMobile) {
                // On mobile, if drawer is open, hamburger click does NOT close it.
                // Only the 'X' button inside the drawer should close it.
                if (!sideDrawer.classList.contains('open')) {
                    this.toggleDrawer(true); // Open if closed
                    console.log("Mobile: Drawer closed, hamburger click opens.");
                } else {
                    console.log("Mobile: Drawer is open, hamburger click does nothing (only 'X' closes).");
                }
            } else {
                // On PC, hamburger click toggles the drawer state.
                this.toggleDrawer(!sideDrawer.classList.contains('open'));
                console.log("PC: Hamburger click toggles drawer.");
            }
        });
        closeDrawerBtn.addEventListener('click', () => this.toggleDrawer(false));
        drawerOverlay.addEventListener('click', () => this.toggleDrawer(false));
        signOutBtn.addEventListener('click', () => this.handleSignOut()); // Sign Out button now in drawer
        aboutAppButton.addEventListener('click', () => { // NEW: Listener for About App section
            this.showAboutModal();
        });


        // Theme selection
        darkThemeBtn.addEventListener('click', () => this.setTheme('dark'));
        lightThemeBtn.addEventListener('click', () => this.setTheme('light'));

        // Font size selection
        fontSizeSmallBtn.addEventListener('click', () => this.setFontSize('small'));
        fontSizeMediumBtn.addEventListener('click', () => this.setFontSize('medium'));
        fontSizeLargeBtn.addEventListener('click', () => this.setFontSize('large'));

        // Filter button event listeners
        filterAllBtn.addEventListener('click', () => this.filterRecords('all'));
        filterPaidBtn.addEventListener('click', () => this.filterRecords('yes'));
        filterPendingBtn.addEventListener('click', () => this.filterRecords('no'));

        // Edit Modal event listeners
        closeEditModalBtn.addEventListener('click', () => this.hideModal('editModal'));
        cancelEditBtn.addEventListener('click', () => this.hideModal('editModal'));
        saveEditBtn.addEventListener('click', () => this.saveEditedRecord());
        deleteRecordBtn.addEventListener('click', () => {
            const recordIdToDelete = document.getElementById('editRecordId').value;
            this.confirmDeleteRecord(recordIdToDelete);
        });

        // Enforce status consistency when editPaidAmount changes
        editPaidAmountInput.addEventListener('input', () => this.updateStatusBasedOnPaidAmount());

        // Add Record button event listener
        addRecordBtn.addEventListener('click', () => this.addNewRecord(addNameInput.value, addAmountInput.value, addStatusSelect.value));

        // About Modal event listeners (NEW)
        closeAboutModalBtn.addEventListener('click', () => this.hideModal('aboutModal'));
        aboutOkBtn.addEventListener('click', () => this.hideModal('aboutModal'));
    }

    /**
     * Toggles the visibility of the side drawer.
     * @param {boolean} open - True to open, false to close.
     */
    toggleDrawer(open) {
        const sideDrawer = document.getElementById('sideDrawer');
        const drawerOverlay = document.getElementById('drawerOverlay');
        const menuBtn = document.getElementById('menuBtn'); // Get menu button reference
        const isMobile = window.matchMedia('(max-width: 767px)').matches; // Check for mobile

        if (open) {
            sideDrawer.classList.add('open');
            drawerOverlay.classList.add('visible');
            if (isMobile && menuBtn) { // Hide hamburger on mobile when drawer opens
                menuBtn.style.display = 'none';
            }
            // Update user info in drawer when opening
            document.getElementById('drawerUserIdDisplay').textContent = `User: ${window.currentUserEmail}`;
            // Optional: Set focus to the close button for accessibility
            document.getElementById('closeDrawerBtn').focus();
        } else {
            sideDrawer.classList.remove('open');
            drawerOverlay.classList.remove('visible');
            if (isMobile && menuBtn) { // Show hamburger on mobile when drawer closes
                menuBtn.style.display = 'flex'; // Use 'flex' because it's a flex container for lines
            }
            // Optional: Return focus to the menu button for accessibility
            document.getElementById('menuBtn').focus();
        }
    }

    /**
     * Populates the "About This App" modal with content.
     * This is called on init, as the content is static.
     */
    populateAboutModalContent() {
        // Add checks before setting innerHTML
        const aboutAppDescription = document.getElementById('aboutAppDescription');
        if (aboutAppDescription) {
            aboutAppDescription.innerHTML = this.appDescription;
        } else {
            console.error("Element #aboutAppDescription not found.");
        }

        const aboutAppVersion = document.getElementById('aboutAppVersion');
        if (aboutAppVersion) {
            aboutAppVersion.textContent = this.appVersion;
        } else {
            console.error("Element #aboutAppVersion not found.");
        }

        const termsOfServiceContent = document.getElementById('termsOfServiceContent');
        if (termsOfServiceContent) {
            termsOfServiceContent.innerHTML = this.termsOfServiceContent;
        } else {
            console.error("Element #termsOfServiceContent not found.");
        }

        const privacyPolicyContent = document.getElementById('privacyPolicyContent');
        if (privacyPolicyContent) {
            privacyPolicyContent.innerHTML = this.privacyPolicyContent;
        } else {
            console.error("Element #privacyPolicyContent not found.");
        }
    }

    /**
     * Shows the "About This App" modal.
     */
    showAboutModal() {
        this.hideModal('customModal'); // Ensure other modals are hidden
        this.hideModal('editModal');
        this.toggleDrawer(false); // Close the drawer when opening the About modal
        this.showModal('', 'alert', 'aboutModal'); // Reuse showModal for new modal
    }

    /**
     * Applies all saved appearance settings (theme, font size) from localStorage.
     * This method is called once on init and whenever a setting changes.
     */
    applyAppearanceSettings() {
        const root = document.documentElement;

        // Apply Theme
        const body = document.body;
        if (this.currentTheme === 'light') {
            body.classList.add('light-theme');
        } else {
            body.classList.remove('light-theme');
        }
        document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('active'));
        // Safely access theme buttons
        const currentThemeBtn = document.getElementById(`${this.currentTheme}ThemeBtn`);
        if (currentThemeBtn) {
            currentThemeBtn.classList.add('active');
        }


        // Apply Font Size
        let scaleFactor = 1.0;
        document.querySelectorAll('.font-size-btn').forEach(btn => btn.classList.remove('active'));
        switch (this.currentFontSize) {
            case 'small':
                scaleFactor = 0.85;
                const fontSizeSmallBtn = document.getElementById('fontSizeSmall');
                if (fontSizeSmallBtn) fontSizeSmallBtn.classList.add('active');
                break;
            case 'large':
                scaleFactor = 1.15;
                const fontSizeLargeBtn = document.getElementById('fontSizeLarge');
                if (fontSizeLargeBtn) fontSizeLargeBtn.classList.add('active');
                break;
            case 'medium':
            default:
                scaleFactor = 1.0;
                const fontSizeMediumBtn = document.getElementById('fontSizeMedium');
                if (fontSizeMediumBtn) fontSizeMediumBtn.classList.add('active');
                break;
        }
        root.style.setProperty('--font-scale-factor', scaleFactor);

        // Accent Color is now fixed to default as per user request.
        // No need to set data-accent-color attribute dynamically anymore as there are no options to change it.
        // The CSS will always use the default accent color definition from :root.
    }

    /**
     * Sets the theme preference and applies it.
     * @param {string} themeName - 'dark' or 'light'.
     */
    setTheme(themeName) {
        this.currentTheme = themeName;
        localStorage.setItem('theme', themeName);
        this.applyAppearanceSettings();
    }

    /**
     * Sets the font size preference and applies it.
     * @param {string} size - 'small', 'medium', or 'large'.
     */
    setFontSize(size) {
        this.currentFontSize = size;
        localStorage.setItem('fontSize', size);
        this.applyAppearanceSettings();
    }

    /**
     * Toggles the visibility of UI elements based on authentication status.
     * @param {firebase.User} user - The authenticated Firebase user object, or null if logged out.
     */
    toggleUIForAuth(user) {
        const authenticatedContent = document.getElementById('authenticatedContent');
        const authSection = document.getElementById('authSection');
        const authStatusMessage = document.getElementById('authStatusMessage');
        const uploadSection = document.getElementById('uploadSection');
        const addRecordSection = document.getElementById('addRecordSection');
        const drawerUserIdDisplay = document.getElementById('drawerUserIdDisplay'); // Get reference here

        console.log('toggleUIForAuth called:');
        console.log('  User object:', user);
        console.log('  authSection display BEFORE:', authSection ? authSection.style.display : 'N/A');
        console.log('  authenticatedContent display BEFORE:', authenticatedContent ? authenticatedContent.style.display : 'N/A');

        if (user && user.uid) {
            if (authSection) authSection.style.display = 'none';
            if (authenticatedContent) authenticatedContent.style.display = 'block';
            if (authStatusMessage) authStatusMessage.textContent = '';
            console.log("UI updated: Logged in state.");
            this.toggleUploadSectionVisibility();
            if (addRecordSection) addRecordSection.style.display = 'block';
            // Update drawer user display immediately on auth state change
            if (drawerUserIdDisplay) {
                drawerUserIdDisplay.textContent = `User: ${user.email || 'Guest User'}`;
            } else {
                console.warn("drawerUserIdDisplay element not found.");
            }
        } else {
            if (authSection) authSection.style.display = 'block';
            if (authenticatedContent) authenticatedContent.style.display = 'none';
            if (authStatusMessage) authStatusMessage.textContent = ''; // Clear existing status
            this.records = [];
            this.updateStatistics();
            this.displayAllRecords();
            if (uploadSection) uploadSection.style.display = 'none';
            if (addRecordSection) addRecordSection.style.display = 'none';
            if (this.unsubscribe) {
                this.unsubscribe();
                this.unsubscribe = null;
                console.log("UI updated: Logged out state. Firestore listener unsubscribed.");
            }
            // Update drawer user display immediately on auth state change
            if (drawerUserIdDisplay) {
                drawerUserIdDisplay.textContent = 'User: Not Signed In';
            } else {
                console.warn("drawerUserIdDisplay element not found.");
            }
        }

        console.log('  authSection display AFTER:', authSection ? authSection.style.display : 'N/A');
        console.log('  authenticatedContent display AFTER:', authenticatedContent ? authenticatedContent.style.display : 'N/A');
    }

    /**
     * Toggles the visibility of the upload section based on whether records exist.
     */
    toggleUploadSectionVisibility() {
        const uploadSection = document.getElementById('uploadSection');
        if (uploadSection) { // Ensure element exists before manipulating
            if (this.records.length === 0) {
                uploadSection.style.display = 'block';
            } else {
                uploadSection.style.display = 'none';
            }
        } else {
            console.warn("uploadSection element not found.");
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
            this.toggleDrawer(false); // Close drawer after sign out
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
        if (!authStatusMessage) {
            console.error("authStatusMessage element not found.");
            return;
        }
        authStatusMessage.className = 'status-message';
        authStatusMessage.textContent = '';

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
        if (!authStatusMessage) {
            console.error("authStatusMessage element not found.");
            return;
        }
        authStatusMessage.className = 'status-message';
        authStatusMessage.textContent = '';

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
     * Handles sending a password reset email.
     * @param {string} email - The email address to send the reset link to.
     */
    async handleForgotPassword(email) {
        const authStatusMessage = document.getElementById('authStatusMessage');
        if (!authStatusMessage) {
            console.error("authStatusMessage element not found.");
            return;
        }
        authStatusMessage.className = 'status-message';
        authStatusMessage.textContent = '';

        if (!window.firebase.auth) {
            authStatusMessage.textContent = 'Firebase Auth not initialized.';
            authStatusMessage.classList.add('error');
            return;
        }
        if (!email) {
            authStatusMessage.textContent = 'Please enter your email in the Email field above to reset your password.';
            authStatusMessage.classList.add('info');
            return;
        }

        try {
            authStatusMessage.textContent = `Sending password reset link to ${email}...`;
            authStatusMessage.classList.add('loading');
            await window.firebase.sendPasswordResetEmail(window.firebase.auth, email);
            authStatusMessage.textContent = 'Password reset email sent! Check your inbox.';
            authStatusMessage.classList.add('success');
        } catch (error) {
            console.error("Error sending password reset email:", error);
            let errorMessage = "An unknown error occurred.";
            switch (error.code) {
                case 'auth/invalid-email':
                    errorMessage = 'The email address is not valid.';
                    break;
                case 'auth/user-not-found':
                    errorMessage = 'No user found with this email. Please check the email.';
                    break;
                case 'auth/network-request-failed':
                    errorMessage = 'Network error. Check your internet connection.';
                    break;
                default:
                    errorMessage = error.message;
            }
            authStatusMessage.textContent = `Password reset failed: ${errorMessage}`;
            authStatusMessage.classList.add('error');
        }
    }

    /**
     * Displays a custom modal message, replacing browser's alert/confirm.
     * @param {string} message - The message to display in the modal.
     * @param {string} type - 'alert' for OK button, 'confirm' for Confirm/Cancel buttons.
     * @param {string} modalId - The ID of the modal to show (e.g., 'customModal', 'settingsModal', 'editModal', 'aboutModal').
     * @returns {Promise<boolean>} Resolves to true for confirm, false for cancel, or always true for alert.
     */
    showModal(message, type = 'alert', modalId = 'customModal') {
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.error(`Modal element with ID '${modalId}' not found.`);
            return Promise.resolve(false); // Or throw an error, depending on desired behavior
        }

        const modalMessage = modal.querySelector('#modalMessage'); // Only for customModal
        const modalConfirmBtn = modal.querySelector('#modalConfirmBtn');
        const modalCancelBtn = modal.querySelector('#modalCancelBtn');
        const modalOkBtn = modal.querySelector('#modalOkBtn');

        if (modalId === 'customModal' && modalMessage) {
            modalMessage.textContent = message;
        }

        // Only hide/show buttons for 'customModal'
        if (modalId === 'customModal') {
            if (modalConfirmBtn) modalConfirmBtn.style.display = 'none';
            if (modalCancelBtn) modalCancelBtn.style.display = 'none';
            if (modalOkBtn) modalOkBtn.style.display = 'none';
        }


        return new Promise(resolve => {
            if (modalId === 'customModal') {
                if (type === 'confirm') {
                    if (modalConfirmBtn) modalConfirmBtn.style.display = 'inline-block';
                    if (modalCancelBtn) modalCancelBtn.style.display = 'inline-block';
                    modalConfirmBtn.onclick = () => {
                        this.hideModal(modalId);
                        resolve(true);
                    };
                    modalCancelBtn.onclick = () => {
                        this.hideModal(modalId);
                        resolve(false);
                    };
                } else { // type is 'alert'
                    if (modalOkBtn) modalOkBtn.style.display = 'inline-block';
                    modalOkBtn.onclick = () => {
                        this.hideModal(modalId);
                        resolve(true);
                    };
                }
            }
            modal.style.display = 'flex';
        });
    }

    // Hides a specific custom modal
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        } else {
            console.warn(`Attempted to hide non-existent modal: ${modalId}`);
        }
    }

    // Handles the Excel file upload process
    async uploadFile() {
        if (!window.isAuthReady || !window.db || !window.userId) {
            this.showStatus('Please sign in to upload records.', 'error');
            return;
        }

        const fileInput = document.getElementById('fileInput');
        if (!fileInput) {
            this.showStatus('File input element not found.', 'error');
            return;
        }
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
            const BATCH_SIZE = 499;
            let uploadedCount = 0;

            for (let i = 0; i < data.length; i += BATCH_SIZE) {
                const chunk = data.slice(i, i + BATCH_SIZE);
                const batch = window.firebase.writeBatch(window.firebase.db);

                for (const row of chunk) {
                    const originalAmount = parseFloat(row.Amount || row.amount || 0);
                    const amountPaidBack = parseFloat(row['Amount Paid Back'] || row.amountPaidBack || 0);
                    const record = {
                        name: String(row.Name || row.name || '').trim(),
                        amount: originalAmount,
                        amountPaidBack: amountPaidBack,
                        paid: (originalAmount > 0 && amountPaidBack >= originalAmount) ? 'yes' : 'no',
                        timestamp: new Date(),
                    };
                    const newDocRef = window.firebase.doc(recordsCollectionRef);
                    batch.set(newDocRef, record);
                    uploadedCount++;
                }
                await batch.commit();
                this.showStatus(`Uploading... processed ${uploadedCount} of ${data.length} records.`, 'loading');
            }

            this.showStatus(`Successfully uploaded ${uploadedCount} records!`, 'success');
            fileInput.value = '';
            this.toggleUploadSectionVisibility();
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
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet);
                    resolve(json);
                } catch (error) {
                    reject(new Error('Failed to read Excel file. Please ensure it is a valid .xlsx or .xls file. ' + error.message));
                }
            };
            reader.onerror = (error) => reject(new Error('File reading error: ' + error.message));
            reader.readAsArrayBuffer(file);
        });
    }

    // Handles adding a single new record manually.
    async addNewRecord(name, amount, status) {
        if (!window.isAuthReady || !window.db || !window.userId) {
            this.showStatus('Please sign in to add new records.', 'error');
            return;
        }

        const parsedAmount = parseFloat(amount);

        if (!name.trim()) {
            this.showStatus('Name cannot be empty.', 'error');
            return;
        }
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            this.showStatus('Amount must be a positive number.', 'error');
            return;
        }
        if (status === 'yes') {
            this.showStatus('New records always start as "Pending". Update via edit option after payment.', 'info');
            status = 'no';
        }

        this.showStatus('Adding new record...', 'loading');

        try {
            const recordsCollectionRef = window.firebase.collection(window.firebase.db, `artifacts/${window.firebase.appId}/users/${window.userId}/records`);
            await window.firebase.addDoc(recordsCollectionRef, {
                name: name.trim(),
                amount: parsedAmount,
                amountPaidBack: 0,
                paid: 'no',
                timestamp: new Date(),
            });

            this.showStatus(`Record for ${name} added successfully!`, 'success');
            // Clear input fields
            const addNameInput = document.getElementById('addName');
            if (addNameInput) addNameInput.value = '';
            const addAmountInput = document.getElementById('addAmount');
            if (addAmountInput) addAmountInput.value = '';
            const addStatusSelect = document.getElementById('addStatus');
            if (addStatusSelect) addStatusSelect.value = 'no';
        } catch (error) {
            console.error('Error adding new record:', error);
            this.showStatus('Error adding record: ' + error.message, 'error');
        }
    }


    // Loads records from Firestore and sets up a real-time listener
    loadRecords() {
        if (!window.isAuthReady || !window.db || !window.userId) {
            console.log("loadRecords: Firebase not ready or no user logged in. Clearing local records and UI.");
            this.records = [];
            this.displayAllRecords();
            this.updateStatistics();
            this.toggleUploadSectionVisibility();
            return;
        }

        if (this.unsubscribe) {
            this.unsubscribe();
            console.log("loadRecords: Unsubscribed from previous Firestore listener.");
        }

        const recordsCollectionRef = window.firebase.collection(window.firebase.db, `artifacts/${window.firebase.appId}/users/${window.userId}/records`);
        const q = window.firebase.query(recordsCollectionRef);

        console.log("loadRecords: Setting up new Firestore listener for user:", window.userId);
        this.unsubscribe = window.firebase.onSnapshot(q, (snapshot) => {
            this.records = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.amountPaidBack === undefined || data.amountPaidBack === null) {
                    data.amountPaidBack = 0;
                }
                this.records.push({ id: doc.id, ...data });
            });
            console.log("Firestore snapshot received. Records loaded:", this.records.length);
            this.displayAllRecords();
            this.updateStatistics();
            this.toggleUploadSectionVisibility();
        }, (error) => {
            console.error("Error fetching records from Firestore:", error);
            this.showStatus('Error loading records: ' + error.message, 'error');
        });
    }

    // Updates the statistics displayed on the dashboard
    updateStatistics() {
        const totalAmount = this.records.reduce((sum, record) => sum + parseFloat(record.amount), 0);
        const paidRecords = this.records.filter(record => record.paid === 'yes');
        const paidAmount = paidRecords.reduce((sum, record) => sum + parseFloat(record.amount), 0);
        const remainingAmount = totalAmount - paidAmount;

        const totalAmountEl = document.getElementById('totalAmount');
        if (totalAmountEl) totalAmountEl.textContent = `₹${totalAmount.toFixed(2)}`;

        const paidAmountEl = document.getElementById('paidAmount');
        if (paidAmountEl) paidAmountEl.textContent = `₹${paidAmount.toFixed(2)}`;

        const remainingAmountEl = document.getElementById('remainingAmount');
        if (remainingAmountEl) remainingAmountEl.textContent = `₹${remainingAmount.toFixed(2)}`;

        const paidCountEl = document.getElementById('paidCount');
        if (paidCountEl) paidCountEl.textContent = paidRecords.length;

        const pendingCountEl = document.getElementById('pendingCount');
        if (pendingCountEl) pendingCountEl.textContent = this.records.length - paidRecords.length;

        const recordsCountEl = document.getElementById('recordsCount');
        if (recordsCountEl) recordsCountEl.textContent = `${this.records.length} records`;
    }

    // Filters and displays records based on a search query
    searchRecords(queryText) {
        const searchResults = document.getElementById('searchResults');
        if (!searchResults) {
            console.error("searchResults element not found.");
            return;
        }

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

    /**
     * Filters records based on the provided status and updates the UI.
     * @param {string} status - 'all', 'yes' (paid), or 'no' (pending).
     */
    filterRecords(status) {
        this.currentFilter = status;
        this.displayAllRecords();
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const filterBtn = document.getElementById(`filter${status.charAt(0).toUpperCase() + status.slice(1)}Btn`);
        if (filterBtn) filterBtn.classList.add('active');
    }

    // Displays all records in the main records list based on the current filter
    displayAllRecords() {
        const recordsList = document.getElementById('recordsList');
        if (!recordsList) {
            console.error("recordsList element not found.");
            return;
        }
        let recordsToDisplay = [...this.records];

        if (this.currentFilter === 'yes') {
            recordsToDisplay = recordsToDisplay.filter(record => record.paid === 'yes');
        } else if (this.currentFilter === 'no') {
            recordsToDisplay = recordsToDisplay.filter(record => record.paid === 'no');
        }

        if (recordsToDisplay.length === 0) {
            let message = 'No records found.';
            if (this.currentFilter === 'yes') message = 'No paid records found.';
            if (this.currentFilter === 'no') message = 'No pending records found.';
            recordsList.innerHTML = `<p>${message}</p>`;
            return;
        }

        const sortedRecords = recordsToDisplay.sort((a, b) => {
            return a.name.localeCompare(b.name);
        });

        recordsList.innerHTML = sortedRecords.map(record =>
            this.createRecordHTML(record, false)
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

        const actionButtonHTML = '';

        const editableAttribute = isSearchResult ? `data-editable="true"` : '';

        const paidBackDisplay = record.amountPaidBack > 0 ? `(Paid: ₹${parseFloat(record.amountPaidBack).toFixed(2)})` : '';

        return `
            <div class="${containerClass}" data-id="${record.id}" ${editableAttribute}>
                <div class="record-info">
                    <div class="record-name">${this.escapeHTML(record.name)}</div>
                    <div class="record-amount">₹${parseFloat(record.amount).toFixed(2)} ${paidBackDisplay}</div>
                </div>
                <div class="record-actions">
                    <span class="record-status ${statusClass}">${statusText}</span>
                </div>
            </div>
        `;
    }

    /**
     * Opens the edit modal and populates it with the selected record's data.
     * @param {string} recordId - The ID of the record to edit.
     */
    openEditModal(recordId) {
        const recordToEdit = this.records.find(r => r.id === recordId);

        if (!recordToEdit) {
            this.showStatus('Record not found for editing.', 'error');
            return;
        }

        const editRecordId = document.getElementById('editRecordId');
        const editName = document.getElementById('editName');
        const editAmount = document.getElementById('editAmount');
        const editPaidAmount = document.getElementById('editPaidAmount');
        const editPaidStatus = document.getElementById('editPaidStatus');

        if (!editRecordId || !editName || !editAmount || !editPaidAmount || !editPaidStatus) {
            console.error("One or more edit modal elements not found.");
            this.showStatus('Error: Edit form elements missing.', 'error');
            return;
        }

        editRecordId.value = recordToEdit.id;
        editName.value = recordToEdit.name;
        editAmount.value = parseFloat(recordToEdit.amount).toFixed(2);
        editPaidAmount.value = parseFloat(recordToEdit.amountPaidBack || 0).toFixed(2);

        editPaidStatus.value = recordToEdit.paid;
        this.updateStatusBasedOnPaidAmount();

        this.showModal('', 'alert', 'editModal');
    }

    /**
     * Updates the status dropdown in the edit modal based on `editPaidAmount` and `editAmount`.
     * If `Amount Paid Back` is less than `Original Loan Amount`, Status MUST be 'Pending'.
     */
    updateStatusBasedOnPaidAmount() {
        const editAmount = document.getElementById('editAmount');
        const editPaidAmount = document.getElementById('editPaidAmount');
        const editPaidStatus = document.getElementById('editPaidStatus');

        if (!editAmount || !editPaidAmount || !editPaidStatus) {
            console.error("One or more elements for updateStatusBasedOnPaidAmount not found.");
            return;
        }

        const originalAmount = parseFloat(editAmount.value);
        const amountPaidBack = parseFloat(editPaidAmount.value);

        if (isNaN(amountPaidBack) || amountPaidBack < 0) {
            editPaidStatus.value = 'no';
            editPaidStatus.disabled = true;
            return;
        }

        if (amountPaidBack < originalAmount) {
            editPaidStatus.value = 'no';
            editPaidStatus.disabled = true;
        } else {
            editPaidStatus.disabled = false;
        }
    }


    /**
     * Saves the edited record data to Firestore.
     */
    async saveEditedRecord() {
        if (!window.db || !window.userId) {
            this.showStatus('Please sign in to save changes.', 'error');
            this.hideModal('editModal');
            return;
        }

        const recordId = document.getElementById('editRecordId')?.value;
        const newName = document.getElementById('editName')?.value.trim();
        const originalAmount = parseFloat(document.getElementById('editAmount')?.value || '0');
        const newAmountPaidBack = parseFloat(document.getElementById('editPaidAmount')?.value || '0');
        let newPaidStatus = document.getElementById('editPaidStatus')?.value;

        if (!recordId || !newName || isNaN(originalAmount) || isNaN(newAmountPaidBack) || !newPaidStatus) {
            this.showStatus('Error: Missing or invalid data for saving record.', 'error');
            return;
        }

        if (!newName) {
            this.showStatus('Name cannot be empty.', 'error');
            return;
        }
        if (originalAmount <= 0) {
            this.showStatus('Original loan amount is invalid. Please correct.', 'error');
            return;
        }
        if (newAmountPaidBack < 0) {
            this.showStatus('Amount Paid Back must be a non-negative number.', 'error');
            return;
        }

        if (newAmountPaidBack < originalAmount) {
            if (newPaidStatus === 'yes') {
                this.showStatus('Status forced to Pending: Amount paid back is less than original loan.', 'info');
            }
            newPaidStatus = 'no';
        } else {
            // User's selected status is respected if newAmountPaidBack >= originalAmount.
        }

        const recordRef = window.firebase.doc(window.firebase.db, `artifacts/${window.firebase.appId}/users/${window.userId}/records`, recordId);

        try {
            await window.firebase.updateDoc(recordRef, {
                name: newName,
                amountPaidBack: newAmountPaidBack,
                paid: newPaidStatus
            });
            this.showStatus(`Record for ${newName} updated successfully!`, 'success');
            this.hideModal('editModal');
            const searchInput = document.getElementById('searchInput');
            const searchResults = document.getElementById('searchResults');
            if (searchInput && searchInput.value.trim() !== '' && searchResults && searchResults.style.display === 'block') {
                this.searchRecords(searchInput.value);
            }
        } catch (error) {
            console.error('Error saving edited record:', error);
            this.showStatus('Error saving record: ' + error.message, 'error');
        }
    }

    /**
     * Prompts the user for confirmation before deleting a single record.
     * @param {string} recordId - The ID of the record to delete.
     */
    async confirmDeleteRecord(recordId) {
        this.hideModal('editModal');

        const recordToDelete = this.records.find(r => r.id === recordId);
        const recordName = recordToDelete ? this.escapeHTML(recordToDelete.name) : "this record";

        const confirmed = await this.showModal(
            `Are you sure you want to delete the record for "${recordName}"? This action cannot be undone.`,
            'confirm'
        );

        if (confirmed) {
            this.deleteRecord(recordId);
        } else {
            this.showStatus('Record deletion cancelled.', 'info');
        }
    }

    /**
     * Deletes a specific record from Firestore.
     * @param {string} recordId - The ID of the record to delete.
     */
    async deleteRecord(recordId) {
        if (!window.db || !window.userId) {
            this.showStatus('Please sign in to delete records.', 'error');
            return;
        }

        const recordRef = window.firebase.doc(window.firebase.db, `artifacts/${window.firebase.appId}/users/${window.userId}/records`, recordId);

        this.showStatus('Deleting record...', 'loading');

        try {
            await window.firebase.deleteDoc(recordRef);
            this.showStatus('Record deleted successfully!', 'success');
            const searchInput = document.getElementById('searchInput');
            const searchResults = document.getElementById('searchResults');
            if (searchInput) searchInput.value = ''; // Clear search input
            if (searchResults) searchResults.style.display = 'none'; // Hide search results
        } catch (error) {
            console.error('Error deleting record:', error);
            this.showStatus('Error deleting record: ' + error.message, 'error');
        }
    }


    /**
     * Downloads all current records as a CSV file.
     * This now calls the native Android interface for APK builds.
     */
    downloadCSV() {
        if (this.records.length === 0) {
            this.showStatus('No records to download.', 'info');
            return;
        }

        const headers = ['Name', 'Original Amount', 'Amount Paid Back', 'Paid Status', 'Timestamp'];
        const csvRows = [];

        csvRows.push(headers.map(header => this.csvEscape(header)).join(','));

        this.records.forEach(record => {
            const timestamp = record.timestamp ? new Date(record.timestamp.seconds * 1000).toLocaleString() : '';
            const row = [
                record.name,
                parseFloat(record.amount).toFixed(2),
                parseFloat(record.amountPaidBack || 0).toFixed(2),
                record.paid,
                timestamp
            ];
            csvRows.push(row.map(field => this.csvEscape(field)).join(','));
        });

        const csvString = csvRows.join('\n');
        const filename = `MoneyLendingRecords_${new Date().toISOString().split('T')[0]}.csv`;

        console.log("CSV Download: Attempting download...");
        console.log("CSV Download: typeof AndroidInterface =", typeof AndroidInterface);
        console.log("CSV Download: typeof AndroidInterface.downloadFile =", typeof AndroidInterface !== 'undefined' ? typeof AndroidInterface.downloadFile : 'N/A');


        // Check if Android interface exists (means it's running in the APK WebView)
        if (typeof AndroidInterface !== 'undefined' && AndroidInterface.downloadFile) {
            try {
                console.log("CSV Download: Calling AndroidInterface.downloadFile...");
                AndroidInterface.downloadFile(filename, csvString);
                this.showStatus('CSV download initiated (via Android)!', 'success');
            } catch (error) {
                console.error("CSV Download: Error calling Android download interface:", error);
                this.showStatus('Error initiating download on Android. Check console.', 'error');
            }
        } else {
            console.log("CSV Download: AndroidInterface.downloadFile not found. Falling back to browser download.");
            this.showStatus('Android download interface not found. Falling back to browser download...', 'info');

            // Fallback for web browser (PC/non-APK mobile browser)
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showStatus('CSV download initiated (browser fallback)!', 'success');
        }
    }

    /**
     * Helper function to escape strings for CSV format.
     * Encloses string in double quotes if it contains comma, double quote, or newline.
     * Doubles any existing double quotes.
     * @param {any} field - The field value to escape.
     * @returns {string} The CSV-escaped string.
     */
    csvEscape(field) {
        if (field === null || field === undefined) {
            return '';
        }
        let value = String(field);
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            value = value.replace(/"/g, '""');
            return `"${value}"`;
        }
        return value;
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
            const querySnapshot = await window.firebase.getDocs(q);

            if (querySnapshot.empty) {
                this.showStatus('No records to clear.', 'info');
                return;
            }

            const batch = window.firebase.writeBatch(window.firebase.db);
            let deletedCount = 0;
            querySnapshot.forEach((doc) => {
                batch.delete(doc.ref);
                deletedCount++;
            });

            await batch.commit();

            this.showStatus(`Successfully cleared ${deletedCount} records.`, 'success');
            this.toggleUploadSectionVisibility();
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
        if (statusDiv) { // Ensure statusDiv exists
            statusDiv.textContent = message;
            statusDiv.className = type;
            statusDiv.style.display = 'block';

            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 5000);
        } else {
            console.warn("uploadStatus element not found, cannot display status.");
        }
    }
}

// Initialize the MoneyLendingManager application ONLY when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    const moneyManager = new MoneyLendingManager();
    window.moneyManager = moneyManager;
});