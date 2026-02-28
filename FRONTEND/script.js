// ---------- API CONFIG ----------
const API_BASE_URL = 'https://student-expense-tracker-bnia.onrender.com'; // Change this if port differs

// ---------- HELPER FUNCTION: SHOW TOAST ----------
function showToast(text, type = 'success', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = text;
    
    container.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Remove after duration
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ---------- HELPER FUNCTION: SHOW MESSAGE ----------
function showMessage(text, type = 'success', duration = 3000) {
    showToast(text, type, duration);
}

// ---------- HELPER FUNCTION: SHOW ALERT ----------
function showAlert(text, type = 'error') {
    if (text) {
        showToast(text, type, 4000);
    }
}

// ---------- REGISTER ----------
async function registerUser() {
    const nameValue = document.getElementById('name').value.trim();
    const emailValue = document.getElementById('email').value.trim();
    const passwordValue = document.getElementById('password').value.trim();

    // Client-side validation
    if (!nameValue || !emailValue || !passwordValue) {
        showMessage('Please fill out all fields.', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: nameValue,
                email: emailValue,
                password: passwordValue
            })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('userId', data.user.id);
            showMessage("Registration successful!", "success", 2000);
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } else {
            showMessage(data.error || "Registration failed", "error");
        }
    } catch (err) {
        console.error("Registration Error:", err);
        showMessage("Connection error. Please try again.", "error");
    }
}

// ---------- LOGIN ----------
async function loginUser() {
    const emailValue = document.getElementById('loginEmail').value.trim();
    const passwordValue = document.getElementById('loginPassword').value.trim();

    // Client-side validation
    if (!emailValue || !passwordValue) {
        showMessage('Please fill out all fields.', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email: emailValue, 
                password: passwordValue 
            })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('userId', data.user.id);
            showMessage("Login successful!", "success", 2000);
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2000);
        } else {
            showMessage(data.error || "Login failed", "error");
        }
    } catch (err) {
        console.error("Login Error:", err);
        showMessage("Connection error. Please try again.", "error");
    }
}

// ---------- ADD EXPENSE ----------
async function addExpense() {
    const expenseName = document.getElementById('expenseName').value.trim();
    const expenseAmount = document.getElementById('expenseAmount').value.trim();
    const token = localStorage.getItem('token');

    if (!token) {
        showMessage("Please login first!", "error");
        return;
    }

    if (!expenseName || !expenseAmount) {
        showMessage("Please fill out all fields.", "error");
        return;
    }

    const amount = parseFloat(expenseAmount);
    if (isNaN(amount) || amount <= 0) {
        showMessage("Amount must be a positive number.", "error");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/expenses`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title: expenseName,
                amount: amount,
                date: new Date().toISOString()
            })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage(data.message || "Expense added successfully!", "success");
            document.getElementById('expenseName').value = '';
            document.getElementById('expenseAmount').value = '';
            updateDashboard();
        } else {
            showMessage(data.error || "Failed to add expense", "error");
        }
    } catch (err) {
        console.error("Error adding expense:", err);
        showMessage("Connection error. Please try again.", "error");
    }
}

// ---------- SET BUDGET ----------
async function setBudget() {
    const budgetAmount = document.getElementById('budget').value.trim();
    const token = localStorage.getItem('token');

    if (!token) {
        showMessage("Please login first!", "error");
        return;
    }

    if (!budgetAmount) {
        showMessage("Please enter a budget amount.", "error");
        return;
    }

    const amount = parseFloat(budgetAmount);
    if (isNaN(amount) || amount < 0) {
        showMessage("Budget must be a non-negative number.", "error");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/budgets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                limit: amount
            })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage(data.message || "Budget set successfully!", "success");
            document.getElementById('budget').value = '';
            updateDashboard();
        } else {
            showMessage(data.error || "Failed to set budget", "error");
        }
    } catch (err) {
        console.error("Error setting budget:", err);
        showMessage("Connection error. Please try again.", "error");
    }
}

// ---------- UPDATE DASHBOARD ----------
async function updateDashboard() {
    const token = localStorage.getItem('token');

    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/user`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('userId');
                window.location.href = 'login.html';
            }
            return;
        }

        const user = await response.json();

        // Ensure values are numbers
        const budget = Number(user.budget) || 0;
        const totalExpense = Number(user.totalExpense) || 0;
        const remaining = Number(user.remaining) || budget - totalExpense;

        // Update sidebar elements
        document.getElementById('sidebarBudget').innerText = budget > 0 ? budget.toFixed(2) : '0.00';
        document.getElementById('sidebarExpense').innerText = totalExpense > 0 ? totalExpense.toFixed(2) : '0.00';
        document.getElementById('sidebarBalance').innerText = remaining >= 0 ? remaining.toFixed(2) : '0.00';
        
        // Update sidebar balance color based on remaining amount
        const sidebarRemaining = document.getElementById('sidebarRemaining');
        const exceedMessage = document.getElementById('exceedMessage');
        
        if (remaining < 0) {
            sidebarRemaining.classList.add('negative');
            const exceedAmount = Math.abs(remaining);
            exceedMessage.innerText = `⚠️ Exceeded by ₹${exceedAmount.toFixed(2)}`;
            exceedMessage.style.display = 'block';
        } else {
            sidebarRemaining.classList.remove('negative');
            exceedMessage.style.display = 'none';
        }
        
        // Populate expenses list
        const expensesList = document.getElementById('expensesList');
        expensesList.innerHTML = '';
        
        if (user.expenses && user.expenses.length > 0) {
            user.expenses.forEach(expense => {
                const expenseItem = document.createElement('div');
                expenseItem.className = 'expense-item';
                const expenseAmount = Number(expense.amount) || 0;
                const expenseDate = new Date(expense.date).toLocaleDateString('en-IN');
                expenseItem.innerHTML = `
                    <div class="expense-name">${expense.title}</div>
                    <div class="expense-details">
                        <span class="expense-amount">₹${expenseAmount.toFixed(2)}</span>
                        <span class="expense-date">${expenseDate}</span>
                    </div>
                `;
                expensesList.appendChild(expenseItem);
            });
        } else {
            expensesList.innerHTML = '<div class="no-expenses">No expenses yet</div>';
        }

        // Display status alerts ONLY if budget is set AND something is spent
        if (budget === 0) {
            // No budget set yet
            showAlert('', '');
        } else if (totalExpense === 0) {
            // Budget set but no expenses
            showAlert('', '');
        } else if (remaining < 0) {
            // Budget exceeded - display with amount
            const exceedAmount = Math.abs(remaining);
            showAlert(`⚠️ Budget Exceeded by ₹${exceedAmount.toFixed(2)}!`, 'error');
        } else if (remaining === 0) {
            // Budget fully consumed
            showAlert('⚠️ Budget Reached', 'warning');
        } else {
            // Normal state
            showAlert('', '');
        }

    } catch (err) {
        console.error("Dashboard Error:", err);
        showAlert("Failed to load dashboard data", "error");
    }
}

// ---------- LOGOUT ----------
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    window.location.href = 'login.html';
}

// ---------- CLEAR ALL DATA ----------
async function clearAllData() {
    if (!confirm('Are you sure you want to clear ALL data (budget and expenses)? This cannot be undone!')) {
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
        showMessage("Please login first!", "error");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/user/reset`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (response.ok) {
            showMessage("All data cleared successfully!", "success");
            setTimeout(() => {
                updateDashboard();
            }, 1500);
        } else {
            showMessage(data.error || "Failed to clear data", "error");
        }
    } catch (err) {
        console.error("Error clearing data:", err);
        showMessage("Connection error. Please try again.", "error");
    }
}

// ---------- AUTO RUN ON DASHBOARD LOAD ----------
// Only call updateDashboard if on dashboard page and logged in
window.addEventListener('load', () => {
    if (window.location.pathname.includes('dashboard') && localStorage.getItem('token')) {
        updateDashboard();
    }
});