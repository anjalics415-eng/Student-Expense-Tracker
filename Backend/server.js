const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Load environment variables
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/expenseApp';

// ---------- DATABASE CONNECTION ----------
let mongooseConnected = false;

mongoose.connect(MONGODB_URI)
    .then(() => {
        mongooseConnected = true;
        console.log('MongoDB connected');
    })
    .catch(err => {
        console.error('MongoDB connection error:', err.message);
        mongooseConnected = false;
    });

mongoose.connection.on('disconnected', () => {
    mongooseConnected = false;
    console.warn('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
    console.error('MongoDB error:', err.message);
});

// ---------- USER SCHEMA ----------
const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    budget: { type: Number, default: 0, min: 0 },
    expenses: [
        {
            title: { type: String, required: true, trim: true },
            amount: { type: Number, required: true, min: 0 },
            date: { type: Date, default: Date.now }
        }
    ]
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// ---------- UTILITY: VERIFY TOKEN ----------
function verifyToken(token) {
    try {
        if (!token || typeof token !== 'string') {
            throw { status: 401, message: 'No token provided' };
        }
        
        const trimmedToken = token.trim();
        if (!trimmedToken) {
            throw { status: 401, message: 'No token provided' };
        }
        
        return jwt.verify(trimmedToken, JWT_SECRET);
    } catch (err) {
        // If it's already our custom error, rethrow it
        if (err.status) {
            throw err;
        }
        
        let message = 'Invalid token';
        if (err.name === 'TokenExpiredError') {
            message = 'Token expired';
        } else if (err.name === 'JsonWebTokenError') {
            message = 'Malformed token';
        }
        throw { status: 401, message };
    }
}

// ---------- UTILITY: EXTRACT AND VALIDATE TOKEN ----------
function extractToken(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return null;
    }
    
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return null;
    }
    
    return parts[1].trim();
}

// ---------- UTILITY: VALIDATE EMAIL ----------
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// ---------- REGISTER ----------
app.post('/api/auth/register', async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({ error: "All fields are required" });
        }

        const trimmedName = name.toString().trim();
        const trimmedEmail = email.toString().trim().toLowerCase();
        const trimmedPassword = password.toString();

        if (trimmedName.length < 2) {
            return res.status(400).json({ error: "Name must be at least 2 characters" });
        }

        if (trimmedPassword.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters" });
        }

        if (!isValidEmail(trimmedEmail)) {
            return res.status(400).json({ error: "Invalid email format" });
        }

        const existing = await User.findOne({ email: trimmedEmail });
        if (existing) return res.status(400).json({ error: "User already exists" });

        const hashed = await bcrypt.hash(trimmedPassword, 10);

        const user = new User({
            name: trimmedName,
            email: trimmedEmail,
            password: hashed,
            budget: 0,
            expenses: []
        });

        await user.save();

        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            token,
            user: { id: user._id, name: user.name, email: user.email }
        });
    } catch (err) {
        next(err);
    }
});

// ---------- LOGIN ----------
app.post('/api/auth/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        const trimmedEmail = email.toString().trim().toLowerCase();

        const user = await User.findOne({ email: trimmedEmail });
        if (!user) return res.status(401).json({ error: "Invalid credentials" });

        const valid = await bcrypt.compare(password.toString(), user.password);
        if (!valid) return res.status(401).json({ error: "Invalid credentials" });

        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            token,
            user: { id: user._id, name: user.name, email: user.email }
        });
    } catch (err) {
        next(err);
    }
});

// ---------- ADD EXPENSE ----------
app.post('/api/expenses', async (req, res, next) => {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: "No token provided" });

    try {
        const { title, amount } = req.body;

        // Validation
        if (!title || amount === undefined || amount === null) {
            return res.status(400).json({ error: "Title and amount are required" });
        }

        const trimmedTitle = title.toString().trim();
        if (trimmedTitle.length === 0) {
            return res.status(400).json({ error: "Title cannot be empty" });
        }

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            return res.status(400).json({ error: "Amount must be a positive number" });
        }

        const data = verifyToken(token);
        const user = await User.findById(data.id);

        if (!user) return res.status(404).json({ error: "User not found" });

        user.expenses.push({
            title: trimmedTitle,
            amount: numAmount,
            date: new Date()
        });

        await user.save();

        let totalExpense = user.expenses.reduce((sum, exp) => sum + exp.amount, 0);
        let remaining = user.budget - totalExpense;
        let message = '';
        let exceedAmount = 0;

        if (remaining < 0) {
            exceedAmount = Math.abs(remaining);
            message = `Budget Exceeded by ₹${exceedAmount.toFixed(2)}! ⚠️`;
        } else if (remaining === 0) {
            message = 'Budget Reached';
        } else {
            message = 'Expense added successfully';
        }

        res.json({ success: true, message, remaining, totalExpense, exceedAmount });
    } catch (err) {
        next(err);
    }
});

// ---------- SET BUDGET ----------
app.post('/api/budgets', async (req, res, next) => {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: "No token provided" });

    try {
        const { limit } = req.body;

        // Validation
        if (limit === undefined || limit === null) {
            return res.status(400).json({ error: "Budget limit is required" });
        }

        const numLimit = parseFloat(limit);
        if (isNaN(numLimit) || numLimit < 0) {
            return res.status(400).json({ error: "Budget must be a non-negative number" });
        }

        const data = verifyToken(token);
        const user = await User.findById(data.id);

        if (!user) return res.status(404).json({ error: "User not found" });

        user.budget = numLimit;
        await user.save();

        res.json({ success: true, message: 'Budget set successfully!', budget: user.budget });
    } catch (err) {
        next(err);
    }
});

// ---------- GET USER DATA (FOR DASHBOARD) ----------
app.get('/api/user', async (req, res, next) => {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: "No token provided" });

    try {
        const data = verifyToken(token);
        const user = await User.findById(data.id);

        if (!user) return res.status(404).json({ error: "User not found" });

        let totalExpense = user.expenses.reduce((sum, exp) => sum + exp.amount, 0);
        let remaining = user.budget - totalExpense;
        let statusMessage = '';
        let exceedAmount = 0;

        if (remaining < 0) {
            exceedAmount = Math.abs(remaining);
            statusMessage = `Budget Exceeded by ₹${exceedAmount.toFixed(2)}! ⚠️`;
        } else if (remaining === 0) {
            statusMessage = 'Budget Reached';
        }

        res.json({
            ...user.toObject(),
            totalExpense,
            remaining,
            exceedAmount,
            statusMessage
        });
    } catch (err) {
        next(err);
    }
});

// ---------- RESET USER DATA ----------
app.delete('/api/user/reset', async (req, res, next) => {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: "No token provided" });

    try {
        const data = verifyToken(token);
        const user = await User.findById(data.id);

        if (!user) return res.status(404).json({ error: "User not found" });

        // Reset budget and clear expenses
        user.budget = 0;
        user.expenses = [];
        await user.save();

        res.json({ 
            success: true, 
            message: 'All data cleared successfully!',
            budget: user.budget,
            expenses: [],
            totalExpense: 0,
            remaining: 0
        });
    } catch (err) {
        next(err);
    }
});

// ---------- 404 HANDLER ----------
app.use((req, res) => {
    res.status(404).json({ error: "Route not found" });
});

// ---------- GLOBAL ERROR HANDLER ----------
app.use((err, req, res, next) => {
    console.error('Error:', err);

    // Default error
    let status = 500;
    let message = 'Internal server error';

    // Custom error object
    if (err.status && err.message) {
        status = err.status;
        message = err.message;
    }
    // Mongoose validation error
    else if (err.name === 'ValidationError') {
        status = 400;
        message = Object.values(err.errors).map(e => e.message).join(', ');
    }
    // Mongoose duplicate key error
    else if (err.code === 11000) {
        status = 400;
        const field = Object.keys(err.keyPattern)[0];
        message = `${field} already exists`;
    }
    // JWT errors
    else if (err.name === 'TokenExpiredError') {
        status = 401;
        message = 'Token expired';
    } else if (err.name === 'JsonWebTokenError') {
        status = 401;
        message = 'Invalid token';
    }

    res.status(status).json({ error: message });
});

// ---------- START SERVER ----------
const startPort = parseInt(process.env.PORT) || 5000;
let PORT = startPort;

function startServer(port) {
    const server = app.listen(port, () => {
        console.log(`✅ Server running on port ${port}`);
        if (mongooseConnected) {
            console.log('✅ Database: Connected');
        } else {
            console.log('⏳ Database: Waiting for connection...');
        }
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.warn(`⚠️  Port ${port} is already in use. Trying port ${port + 1}...`);
            PORT = port + 1;
            startServer(port + 1);
        } else {
            console.error('Server error:', err);
            process.exit(1);
        }
    });

    return server;
}

const server = startServer(PORT);

process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        mongoose.connection.close(false, () => {
            console.log('MongoDB connection closed');
            process.exit(0);
        });
    });
});