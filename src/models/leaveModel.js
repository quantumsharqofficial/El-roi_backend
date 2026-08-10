const mongoose = require("mongoose");
const { getModel } = require("../config/db");

const LeaveSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true,
    },
    employeeName: {
      type: String,
      required: true,
    },
    employeeEID: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["Paid Annual Leave", "Sick Leave", "Casual Leave", "Unpaid Sick Leave"],
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    reason: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["Pending HR", "Approved", "Rejected"],
      default: "Pending HR",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = getModel("Leave", LeaveSchema);
