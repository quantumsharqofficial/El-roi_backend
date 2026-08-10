const Leave = require("../models/leaveModel");
const Employee = require("../models/employeeModel");

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
      endDate,
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
    const leaves = await Leave.find({});
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getLeavesByEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const leaves = await Leave.find({ employeeId });
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

    const leave = await Leave.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!leave) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    res.json(leave);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const leave = await Leave.findByIdAndDelete(id);
    if (!leave) {
      return res.status(404).json({ message: "Leave request not found" });
    }
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
