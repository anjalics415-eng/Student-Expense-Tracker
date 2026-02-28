const mongoose = require("mongoose");

const budgetSchema = new mongoose.Schema(
  {
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
    },
    limit: {
      type: Number,
      required: [true, "Budget limit is required"],
      min: [1, "Budget limit must be greater than 0"],
    },
    month: {
      type: Number,
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// One budget per category per month per user
budgetSchema.index(
  { user: 1, category: 1, month: 1, year: 1 },
  { unique: true }
);

module.exports = mongoose.model("Budget", budgetSchema);