const Leave = require("../models/leaveModel");
const Employee = require("../models/employeeModel");

// Calculate inclusive leave days
const getLeaveDaysCount = (startDate, endDate) => {
  if (!startDate) return 0;
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : start;
  const d1 = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const d2 = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  const diffDays = Math.round(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diffDays);
};

// Helper: Normalize leave types to schema enum
const normalizeLeaveType = (type) => {
  if (!type) return "Casual Leave";
  const t = type.toLowerCase().trim();
  if (t.includes("casual")) return "Casual Leave";
  if (t.includes("unpaid")) return "Unpaid Sick Leave";
  if (t.includes("sick") || t.includes("medical")) return "Sick Leave";
  if (t.includes("annual") || t.includes("paid")) return "Paid Annual Leave";
  return type;
};

// Adjust employee leave balance by daysDelta (+ for taken, - for refund)
const adjustEmployeeLeaveBalance = async (employeeId, employeeEID, leaveType, daysDelta) => {
  if (!leaveType || !daysDelta) return;

  try {
    const query = [];
    if (employeeId && String(employeeId).match(/^[0-9a-fA-F]{24}$/)) {
      query.push({ _id: employeeId });
    }
    if (employeeEID) {
      query.push({ employeeId: employeeEID });
    }
    if (employeeId) {
      query.push({ employeeId: employeeId });
    }

    const employee = await Employee.findOne({ $or: query });
    if (!employee) return;

    if (!employee.leaveBalances || employee.leaveBalances.length === 0) {
      employee.leaveBalances = [
        { leaveType: "Paid Annual Leave", allowedDays: 12, takenLeaves: 0 },
        { leaveType: "Sick Leave", allowedDays: 12, takenLeaves: 0 },
        { leaveType: "Casual Leave", allowedDays: 12, takenLeaves: 0 },
      ];
    }

    const targetType = normalizeLeaveType(leaveType);
    let balance = employee.leaveBalances.find(
      (b) => normalizeLeaveType(b.leaveType) === targetType
    );

    if (!balance) {
      employee.leaveBalances.push({
        leaveType: targetType,
        allowedDays: 12,
        takenLeaves: Math.max(0, daysDelta),
      });
    } else {
      balance.leaveType = targetType;
      if (!balance.allowedDays || balance.allowedDays <= 0) {
        balance.allowedDays = 12;
      }
      balance.takenLeaves = Math.max(0, (balance.takenLeaves || 0) + daysDelta);
    }

    employee.markModified("leaveBalances");
    await employee.save();
    await Employee.updateOne(
      { _id: employee._id },
      { $set: { leaveBalances: employee.leaveBalances } }
    );
  } catch (err) {
    console.error("Error adjusting employee leave balance:", err);
  }
};

const applyLeave = async (req, res) => {
  try {
    const { employeeId, type, startDate, endDate, reason } = req.body;
    
    // Find employee to get name and employeeId
    const isObjectId = String(employeeId).match(/^[0-9a-fA-F]{24}$/);
    const query = isObjectId ? { _id: employeeId } : { employeeId: employeeId };
    const employee = await Employee.findOne(query);

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const employeeName = `${employee.firstName} ${employee.lastName || ""}`.trim();
    const employeeEID = employee.employeeId;

    const leave = await Leave.create({
      employeeId: employee._id || employeeId,
      employeeName,
      employeeEID,
      type,
      startDate,
      endDate: endDate || startDate,
      reason,
      status: "Pending HR"
    });

    res.status(201).json(leave);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getAllLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find({}).sort({ createdAt: -1 });
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getLeavesByEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const isObjectId = String(employeeId).match(/^[0-9a-fA-F]{24}$/);
    const query = isObjectId
      ? { $or: [{ employeeId }, { employeeEID: employeeId }] }
      : { employeeEID: employeeId };

    const leaves = await Leave.find(query).sort({ createdAt: -1 });
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateLeaveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["Approved", "Rejected", "Pending HR"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const currentLeave = await Leave.findById(id);
    if (!currentLeave) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    const previousStatus = currentLeave.status;
    const leaveDays = getLeaveDaysCount(currentLeave.startDate, currentLeave.endDate);

    // If changing to Approved from non-approved, deduct leave
    if (status === "Approved" && previousStatus !== "Approved") {
      await adjustEmployeeLeaveBalance(
        currentLeave.employeeId,
        currentLeave.employeeEID,
        currentLeave.type,
        leaveDays
      );
    }
    // If changing from Approved to Rejected or Pending HR, refund leave
    else if (previousStatus === "Approved" && status !== "Approved") {
      await adjustEmployeeLeaveBalance(
        currentLeave.employeeId,
        currentLeave.employeeEID,
        currentLeave.type,
        -leaveDays
      );
    }

    currentLeave.status = status;
    await currentLeave.save();

    res.json(currentLeave);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const leave = await Leave.findById(id);
    if (!leave) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    // If leave was approved, refund the taken leaves
    if (leave.status === "Approved") {
      const leaveDays = getLeaveDaysCount(leave.startDate, leave.endDate);
      await adjustEmployeeLeaveBalance(
        leave.employeeId,
        leave.employeeEID,
        leave.type,
        -leaveDays
      );
    }

    await Leave.findByIdAndDelete(id);
    res.json({ message: "Leave request deleted successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  applyLeave,
  getAllLeaves,
  getLeavesByEmployee,
  updateLeaveStatus,
  deleteLeave,
};
