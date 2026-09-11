const mongoose = require("mongoose");
const path = require("path");

const Employee = require("../models/employeeModel");
const Leave = require("../models/leaveModel");

const normalizeLeaveType = (type) => {
  if (!type) return "Casual Leave";
  const t = type.toLowerCase().trim();
  if (t.includes("casual")) return "Casual Leave";
  if (t.includes("unpaid")) return "Unpaid Sick Leave";
  if (t.includes("sick") || t.includes("medical")) return "Sick Leave";
  if (t.includes("annual") || t.includes("paid")) return "Paid Annual Leave";
  return type;
};

const getLeaveDaysCount = (startDate, endDate) => {
  if (!startDate) return 0;
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : start;
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diffDays);
};

async function syncAll() {
  const uri = process.env.MONGODB_URI || "mongodb+srv://quantumsharqresource_db_user:hNMVM6lk65ickZlx@cluster0.ndm7dph.mongodb.net/ELroi-HRMS";
  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  const employees = await Employee.find({});
  const allApprovedLeaves = await Leave.find({ status: "Approved" });

  console.log(`Found ${employees.length} employees, ${allApprovedLeaves.length} approved leaves.`);

  for (const emp of employees) {
    // Find approved leaves for this employee
    const empApproved = allApprovedLeaves.filter(
      (l) =>
        String(l.employeeId) === String(emp._id) ||
        l.employeeEID === emp.employeeId ||
        (l.employeeName && l.employeeName.toLowerCase().trim() === `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase().trim())
    );

    const takenMap = {
      "Paid Annual Leave": 0,
      "Sick Leave": 0,
      "Casual Leave": 0,
    };

    empApproved.forEach((l) => {
      const targetType = normalizeLeaveType(l.type);
      const days = getLeaveDaysCount(l.startDate, l.endDate);
      if (takenMap[targetType] !== undefined) {
        takenMap[targetType] += days;
      } else {
        takenMap[targetType] = days;
      }
    });

    const standardTypes = ["Paid Annual Leave", "Sick Leave", "Casual Leave"];
    const updatedBalances = standardTypes.map((type) => {
      const existing = (emp.leaveBalances || []).find(
        (b) => normalizeLeaveType(b.leaveType) === type
      );
      const allowedDays = existing && existing.allowedDays > 0 ? existing.allowedDays : 12;
      // Taken is the maximum of any manual entry or calculated from approved leaves
      const takenLeaves = Math.max(existing?.takenLeaves || 0, takenMap[type] || 0);

      return {
        leaveType: type,
        allowedDays,
        takenLeaves,
      };
    });

    emp.leaveBalances = updatedBalances;
    emp.markModified("leaveBalances");
    await emp.save();
    await Employee.updateOne(
      { _id: emp._id },
      { $set: { leaveBalances: updatedBalances } }
    );

    console.log(`Synced ${emp.firstName} ${emp.lastName} (${emp.employeeId}):`, JSON.stringify(updatedBalances));
  }

  console.log("All employee leave balances synchronized successfully!");
  await mongoose.disconnect();
}

syncAll().catch(console.error);
