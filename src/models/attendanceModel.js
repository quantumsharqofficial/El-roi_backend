const mongoose = require("mongoose");
const { getModel } = require("../config/db");

// Define the schema for Attendance
const AttendanceSchema = new mongoose.Schema(
  {
    employee_ID: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      required: true, // Date is mandatory for attendance
    },
    checkInTime: {
      type: String,
      required: false,
    },
    checkOutTime: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      required: true,
      enum: ["Present", "Absent", "On Leave", "Checked In", "Half Day", "Late"],
      default: "Checked In",
    },
    place: { type: String, required: false },
    address: { type: String, required: false },
  },
  {
    timestamps: true, // Automatically add `createdAt` and `updatedAt`
  },
);

// Create the model from the schema using the database provider helper
const Attendance = getModel("Attendance", AttendanceSchema);

module.exports = Attendance;
