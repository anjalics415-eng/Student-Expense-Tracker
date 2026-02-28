const express = require("express");
const Category = require("../models/Category");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.use(protect);

// @route   GET /api/categories
// @desc    Get all categories
// @access  Private
router.get("/", async (req, res) => {
  try {
    const categories = await Category.find({ user: req.user._id }).sort({
      name: 1,
    });
    res.json({ categories });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   POST /api/categories
// @desc    Create a new category
// @access  Private
router.post("/", async (req, res) => {
  try {
    const { name, icon, color } = req.body;

    const category = await Category.create({
      name,
      icon,
      color,
      user: req.user._id,
    });

    res.status(201).json({ category });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/categories/:id
// @desc    Update a category
// @access  Private
router.put("/:id", async (req, res) => {
  try {
    const category = await Category.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json({ category });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   DELETE /api/categories/:id
// @desc    Delete a category
// @access  Private
router.delete("/:id", async (req, res) => {
  try {
    const category = await Category.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;