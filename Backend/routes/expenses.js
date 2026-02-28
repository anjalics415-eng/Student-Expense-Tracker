const express = require("express");
const Expense = require("../models/Expense");
const Budget = require("../models/Budget");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.use(protect);

// @route   GET /api/expenses
// @desc    Get all expenses
// @access  Private
router.get("/", async (req, res) => {
  try {
    const { month, year, category } = req.query;
    const filter = { user: req.user._id };

    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      filter.date = { $gte: start, $lte: end };
    }

    if (category) filter.category = category;

    const expenses = await Expense.find(filter)
      .populate("category", "name icon color")
      .sort({ date: -1 });

    const total = expenses.reduce((sum, e) => sum + e.amount, 0);

    res.json({ expenses, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/expenses
// @desc    Add a new expense
// @access  Private
router.post("/", async (req, res) => {
  try {
    const { title, amount, date, category, note } = req.body;

    const expense = await Expense.create({
      title,
      amount,
      date,
      category,
      note,
      user: req.user._id,
    });

    await expense.populate("category", "name icon color");

    const expenseDate = new Date(date || Date.now());
    const month = expenseDate.getMonth() + 1;
    const year = expenseDate.getFullYear();

    const budget = await Budget.findOne({
      user: req.user._id,
      category,
      month,
      year,
    });

    let budgetAlert = null;

    if (budget) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);

      const totalSpent = await Expense.aggregate([
        {
          $match: {
            user: req.user._id,
            category: expense.category._id,
            date: { $gte: start, $lte: end },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);

      const spent = totalSpent[0]?.total || 0;
      const percentage = (spent / budget.limit) * 100;

      if (percentage >= 100) {
        budgetAlert = {
          type: "exceeded",
          message: `⚠️ You've exceeded your budget for ${expense.category.name}! Spent ₹${spent} of ₹${budget.limit}`,
        };
      } else if (percentage >= 80) {
        budgetAlert = {
          type: "warning",
          message: `⚠️ You've used ${percentage.toFixed(0)}% of your budget for ${expense.category.name}`,
        };
      }
    }

    res.status(201).json({ expense, budgetAlert });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/expenses/:id
// @desc    Update an expense
// @access  Private
router.put("/:id", async (req, res) => {
  try {
    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    ).populate("category", "name icon color");

    if (!expense) {
      return res.status(404).json({ error: "Expense not found" });
    }

    res.json({ expense });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   DELETE /api/expenses/:id
// @desc    Delete an expense
// @access  Private
router.delete("/:id", async (req, res) => {
  try {
    const expense = await Expense.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!expense) {
      return res.status(404).json({ error: "Expense not found" });
    }

    res.json({ message: "Expense deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/expenses/summary
// @desc    Get monthly summary grouped by category
// @access  Private
router.get("/summary", async (req, res) => {
  try {
    const { month, year } = req.query;
    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();

    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59);

    const summary = await Expense.aggregate([
      {
        $match: {
          user: req.user._id,
          date: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
      { $sort: { total: -1 } },
    ]);

    const grandTotal = summary.reduce((sum, s) => sum + s.total, 0);

    res.json({ summary, grandTotal, month: m, year: y });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;