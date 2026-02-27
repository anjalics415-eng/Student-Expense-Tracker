//REGISTER FUNCTION
async function registerUser() {
    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    const response = await fetch("http://localhost:5000/api/register", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ name, email, password })
    });

    const data = await response.json();
    alert(data.message);

    window.location.href = "login.html";
}
//LOGIN FUNCTION
async function loginUser() {
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    const response = await fetch("http://localhost:5000/api/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (data.user) {
        localStorage.setItem("userId", data.user._id);
        window.location.href = "dashboard.html";
    } else {
        alert("Login Failed");
    }
}
//ADD EXPENSE
async function addExpense() {
    const userId = localStorage.getItem("userId");

    const name = document.getElementById("expenseName").value;
    const amount = document.getElementById("expenseAmount").value;

    await fetch("http://localhost:5000/api/addExpense", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ userId, name, amount })
    });

    loadExpenses();
}
//LOAD EXPENSE
async function loadExpenses() {
    const userId = localStorage.getItem("userId");

    const response = await fetch(
        `http://localhost:5000/api/getExpenses/${userId}`
    );

    const expenses = await response.json();

    let output = "";
    expenses.forEach(exp => {
        output += exp.name + " - " + exp.amount + "<br>";
    });

    document.getElementById("expenseList").innerHTML = output;
}
if (window.location.pathname.includes("dashboard.html")) {
    loadExpenses();
}
//LOGOUT
function logout() {
    localStorage.removeItem("userId");
    window.location.href = "login.html";
}