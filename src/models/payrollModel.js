const mongoose = require("mongoose");
const { getModel } = require("../config/db");

const PayrollSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true,
    },
    employeeEID: {
      type: String,
      required: true,
    },
    employeeName: {
      type: String,
      required: true,
    },
    month: {
      type: String,
      required: true, // Format YYYY-MM
    },
    basicSalary: {
      type: Number,
      default: 0,
    },
    totalWorkingDays: {
      type: Number,
      default: 0,
    },
    actualWorkingDays: {
      type: Number,
      default: 0,
    },
    actualWorkingHours: {
      type: Number,
      default: 0,
    },
    overtimeHours: {
      type: Number,
      default: 0,
    },
    leaveDeductions: {
      type: Number,
      default: 0,
    },
    lateComingDeductions: {
      type: Number,
      default: 0,
    },
    otherDeductions: {
      type: Number,
      default: 0,
    },
    lateDays: {
      type: Number,
      default: 0,
    },
    incentives: {
      type: Number,
      default: 0,
    },
    homeRehabIncentives: {
      type: Number,
      default: 0,
    },
    performanceBonus: {
      type: Number,
      default: 0,
    },
    otherIncentives: {
      type: Number,
      default: 0,
    },
    specialAllowances: {
      type: Number,
      default: 0,
    },
    sundayPostings: {
      type: Number,
      default: 0,
    },
    travelAllowance: {
      type: Number,
      default: 0,
    },
    fuelAllowance: {
      type: Number,
      default: 0,
    },
    otherAdditionalPayments: {
      type: Number,
      default: 0,
    },
    sundayHomeRehab: {
      type: Number,
      default: 0,
    },
    payableSalary: {
      type: Number,
      default: 0,
    },
    paidLeavesCount: {
      type: Number,
      default: 0,
    },
    unpaidLeavesCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["Draft", "Paid"],
      default: "Draft",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = getModel("Payroll", PayrollSchema);
