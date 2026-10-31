const mongoose = require("mongoose");
const { getModel } = require("../config/db");

// Define the schema for Attendance
const newAttendanceSchema = new mongoose.Schema(
    {
        employee_ID: {
            type: String,
            required: true,
        },
        date: {
            type: Date,
            required: true, // Date is mandatory for attendance
        },
        firstinTime: {
            type: Date,
            required: false,
        },
        firstoutTime: {
            type: Date,
            required: false,
        },
        firstworkingHours: {
            type: Number,
            required: false,
        },
        secondinTime: {
            type: Date,
            required: false,
        },
        secondoutTime: {
            type: Date,
            required: false,
        },
        secondworkingHours: {
            type: Number,
            required: false,
        },
        workingHours: {
            type: Number,
            required: false,
        },
        status: {
            type: String,
            required: true,
            enum: ["Present", "Absent", "On Leave", "Checked In", "Late Arrival", "Late", "Early Exit"],
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
const NewAttendance = getModel("New Attendance", newAttendanceSchema);

module.exports = NewAttendance;
