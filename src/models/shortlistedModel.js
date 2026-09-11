const mongoose = require("mongoose");
const { getModel } = require("../config/db");

const ShortlistedCandidateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    positionApplied: {
      type: String,
      required: true,
      trim: true,
    },
    mobileNumber: {
      type: String,
      required: true,
      trim: true,
    },
    interviewDate: {
      type: Date,
      required: true,
    },
    proposedDateOfJoining: {
      type: Date,
      required: true,
    },
    remarks: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["Active", "Converted", "Declined"],
      default: "Active",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = getModel("ShortlistedCandidate", ShortlistedCandidateSchema);
