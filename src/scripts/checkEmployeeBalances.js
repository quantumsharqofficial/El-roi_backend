const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../../.env") });

const Employee = require("../models/employeeModel");
const Leave = require("../models/leaveModel");

async function check() {
  const uri = process.env.MONGODB_URI || "mongodb+srv://quantumsharqresource_db_user:hNMVM6lk65ickZlx@cluster0.ndm7dph.mongodb.net/ELroi-HRMS";
  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  const employees = await Employee.find({}, { firstName: 1, lastName: 1, employeeId: 1, leaveBalances: 1 });
  console.log("\n--- EMPLOYEES LEAVE BALANCES ---");
  employees.forEach(e => {
    console.log(`ID: ${e._id}, EID: ${e.employeeId}, Name: ${e.firstName} ${e.lastName}`);
    console.log("leaveBalances:", JSON.stringify(e.leaveBalances, null, 2));
  });

  const leaves = await Leave.find({});
  console.log("\n--- LEAVES IN DB ---");
  leaves.forEach(l => {
    console.log(`ID: ${l._id}, Emp: ${l.employeeName} (${l.employeeEID}), Type: "${l.type}", Dates: ${l.startDate} to ${l.endDate}, Status: "${l.status}"`);
  });

  await mongoose.disconnect();
}

check().catch(console.error);
