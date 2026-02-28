const express = require("express");
const Budget = require("../models/Budget");
const Expense = require("../models/Expense");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.use(protect);

// @route   GET /api/budgets
// @desc    Get all budgets with spending info
// @access  Private
router.get("/", async (req, res) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const budgets = await Budget.find({
      user: req.user._id,
      month,
      year,
    }).populate("category", "name icon color");

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const budgetsWithSpending = await Promise.all(
      budgets.map(async (budget) => {
        const result = await Expense.aggregate([
          {
            $match: {
              user: req.user._id,
              category: budget.category._id,
              date: { $gte: start, $lte: end },
            },
          },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]);

        const spent = result[0]?.total || 0;
        const percentage = Math.min((spent / budget.limit) * 100, 100);
        const remaining = budget.limit - spent;
        const status =
          percentage >= 100
            ? "exceeded"
            : percentage >= 80
            ? "warning"
            : "safe";

        return {
          ...budget.toObject(),
          spent,
          remaining,
          percentage: parseFloat(percentage.toFixed(1)),
          status,
        };
      })
    );

    res.json({ budgets: budgetsWithSpending, month, year });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/budgets
// @desc    Set a budget for a category
// @access  Private
router.post("/", async (req, res) => {
  try {
    const { category, limit, month, year } = req.body;

    const budget = await Budget.findOneAndUpdate(
      { user: req.user._id, category, month, year },
      { limit },
      { new: true, upsert: true, runValidators: true }
    ).populate("category", "name icon color");

    res.status(201).json({ budget });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   DELETE /api/budgets/:id
// @desc    Delete a budget
// @access  Private
router.delete("/:id", async (req, res) => {
  try {
    const budget = await Budget.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!budget) {
      return res.status(404).json({ error: "Budget not found" });
    }

    res.json({ message: "Budget deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;