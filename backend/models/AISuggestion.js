
const mongoose = require("mongoose");

const aiSuggestionSchema = new mongoose.Schema(
  {
    client_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: [true, "Client ID is required"]
    },

    file_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StoredFile",
      required: [true, "File ID is required"]
    },

    checklist_item_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChecklistItem",
      required: [true, "Checklist item ID is required"]
    },

    checklist_item_name: {
      type: String,
      required: [true, "Checklist item name is required"],
      trim: true,
      maxlength: 500
    },

    score: {
      type: Number,
      required: [true, "Confidence score is required"],
      min: 0,
      max: 100
    },

    reason: {
      type: String,
      required: [true, "Suggestion reason is required"],
      trim: true
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      required: true
    },

    request_id: {
      type: String,
      trim: true,
      default: null
    },

    suggested_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Person",
      required: [true, "Suggested by person ID is required"]
    },

    reviewed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Person",
      default: null
    },

    reviewed_at: {
      type: Date,
      default: null
    }
  },
  {
    collection: "ai_suggestions",
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at"
    },
    versionKey: false
  }
);

// Indexes for fast lookup
aiSuggestionSchema.index({ file_id: 1, created_at: -1 });
aiSuggestionSchema.index({ client_id: 1, status: 1 });
aiSuggestionSchema.index({ checklist_item_id: 1 });
aiSuggestionSchema.index({ status: 1 });

const AISuggestion = mongoose.model("AISuggestion", aiSuggestionSchema);

module.exports = AISuggestion;
