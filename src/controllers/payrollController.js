const Payroll = require("../models/payrollModel");
const Employee = require("../models/employeeModel");
const Attendance = require("../models/attendanceModel");
const Leave = require("../models/leaveModel");

// Helper to get number of working days (excluding Sundays only) in a month
const getWorkingDaysInMonth = (year, month) => {
  let count = 0;
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let i = 1; i <= daysInMonth; i++) {
    const day = new Date(year, month - 1, i).getDay();
    if (day !== 0) { // 0 is Sunday - only exclude Sundays
      count++;
    }
  }
  return count;
};

// Calculate minutes between two time strings (HH:MM or H:MM)
const getDurationMinutes = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return 0;
  const parseTime = (timeStr) => {
    const match = timeStr.match(/^(\d+):(\d+)\s*(AM|PM)?$/i);
    if (!match) {
      const parts = timeStr.split(":").map(Number);
      return parts[0] * 60 + (parts[1] || 0);
    }
    let [_, hrs, mins, meridiem] = match;
    hrs = Number(hrs);
    mins = Number(mins);
    if (meridiem) {
      if (meridiem.toUpperCase() === "PM" && hrs !== 12) hrs += 12;
      if (meridiem.toUpperCase() === "AM" && hrs === 12) hrs = 0;
    }
    return hrs * 60 + mins;
  };
  try {
    const start = parseTime(checkIn);
    const end = parseTime(checkOut);
    let diff = end - start;
    if (diff < 0) diff += 24 * 60; // overnight checkin
    return diff;
  } catch (e) {
    return 0;
  }
};

const computeEmployeeMonthlyPayroll = async (employee, year, m) => {
  const startOfMonth = new Date(year, m - 1, 1);
  const endOfMonth = new Date(year, m, 0, 23, 59, 59);

  // Fetch attendance logs for month
  const attendanceLogs = await Attendance.find({
    employee_ID: employee.employeeId,
    date: { $gte: startOfMonth, $lte: endOfMonth },
  });

  // Calculate actual working days and hours
  let actualWorkingDays = 0;
  let totalMinutesWorked = 0;
  let overtimeMinutes = 0;

  attendanceLogs.forEach((log) => {
    if (["Present", "Checked In", "Late", "Half Day"].includes(log.status)) {
      actualWorkingDays++;
      if (log.checkInTime && log.checkOutTime) {
        const duration = getDurationMinutes(log.checkInTime, log.checkOutTime);
        totalMinutesWorked += duration;
        // Calculate daily overtime if duration is over 8 hours (480 minutes)
        if (duration > 480) {
          overtimeMinutes += (duration - 480);
        }
      }
    }
  });

  const actualWorkingHours = parseFloat((totalMinutesWorked / 60).toFixed(2));
  const overtimeHours = parseFloat((overtimeMinutes / 60).toFixed(2));

  // Fetch approved leaves in this month
  const leaves = await Leave.find({
    employeeId: employee._id,
    status: "Approved",
    $or: [
      { startDate: { $gte: startOfMonth, $lte: endOfMonth } },
      { endDate: { $gte: startOfMonth, $lte: endOfMonth } }
    ]
  });

  // Count leave days that fall in the month
  let approvedLeaveDays = 0;
  leaves.forEach((l) => {
    const start = new Date(Math.max(l.startDate.getTime(), startOfMonth.getTime()));
    const end = new Date(Math.min(l.endDate.getTime(), endOfMonth.getTime()));
    const diff = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1;
    approvedLeaveDays += diff;
  });

  const totalWorkingDays = getWorkingDaysInMonth(year, m);
  const basicSalary = employee.salary || 0;
  const dailyRate = basicSalary / (totalWorkingDays || 26);
  const hourlyRate = dailyRate / 8 || 150;
  const overtimePay = Math.round(overtimeHours * hourlyRate);

  return {
    employeeId: employee._id.toString(),
    employeeEID: employee.employeeId,
    employeeName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.name || employee.employeeId,
    month: `${year}-${String(m).padStart(2, '0')}`,
    basicSalary,
    totalWorkingDays,
    actualWorkingDays,
    actualWorkingHours,
    overtimeHours,
    approvedLeaveDays,
    paidLeavesCount: approvedLeaveDays,
    unpaidLeavesCount: 0,
    leaveDeductions: 0,
    lateComingDeductions: 0,
    otherDeductions: 0,
    lateDays: 0,
    incentives: 0,
    homeRehabIncentives: 0,
    performanceBonus: 0,
    otherIncentives: 0,
    specialAllowances: 0,
    sundayPostings: 0,
    travelAllowance: 0,
    fuelAllowance: 0,
    otherAdditionalPayments: 0,
    sundayHomeRehab: 0,
    payableSalary: Math.round(basicSalary + overtimePay),
    status: "Unprocessed",
  };
};

const calculatePayrollDetails = async (req, res) => {
  try {
    const { employeeId, month } = req.query; // employeeId can be _id or employeeId, month is YYYY-MM
    if (!employeeId || !month) {
      return res.status(400).json({ message: "employeeId and month are required." });
    }

    const [yearStr, monthStr] = month.split("-");
    const year = parseInt(yearStr);
    const m = parseInt(monthStr);

    const isObjectId = String(employeeId).match(/^[0-9a-fA-F]{24}$/);
    const query = isObjectId ? { _id: employeeId } : { employeeId: employeeId };
    const employee = await Employee.findOne(query);

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const data = await computeEmployeeMonthlyPayroll(employee, year, m);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const savePayroll = async (req, res) => {
  try {
    const { employeeId, employeeEID, month } = req.body;
    let query = { month };
    if (employeeId && employeeEID) {
      query.$or = [{ employeeId }, { employeeEID }];
    } else if (employeeId) {
      query.employeeId = employeeId;
    } else if (employeeEID) {
      query.employeeEID = employeeEID;
    }

    let payroll = await Payroll.findOne(query);
    if (payroll) {
      payroll = await Payroll.findByIdAndUpdate(payroll._id, req.body, { new: true });
    } else {
      payroll = await Payroll.create(req.body);
    }
    res.status(201).json(payroll);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getPayrollByEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const payslips = await Payroll.find({
      $or: [{ employeeId }, { employeeEID: employeeId }],
    }).sort({ month: -1 });
    res.json(payslips);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPayrollByMonth = async (req, res) => {
  try {
    const { month } = req.params; // Format: YYYY-MM
    if (!month || !month.includes("-")) {
      return res.status(400).json({ message: "Valid month in YYYY-MM format required." });
    }

    const [yearStr, monthStr] = month.split("-");
    const year = parseInt(yearStr);
    const m = parseInt(monthStr);
    const totalWorkingDays = getWorkingDaysInMonth(year, m);

    // 1. Fetch all active employees
    const employees = await Employee.find({ status: { $ne: "Deactivated" } }).sort({ employeeId: 1 });

    // 2. Fetch any saved payslips for this month
    const savedPayslips = await Payroll.find({ month });

    // 3. Merge: Every employee will have all filled data
    const monthlyList = await Promise.all(
      employees.map(async (emp) => {
        const empIdStr = emp._id.toString();
        const saved = savedPayslips.find(
          (p) => String(p.employeeId) === empIdStr || p.employeeEID === emp.employeeId
        );

        if (saved) {
          const doc = saved.toObject();
          // Ensure totalWorkingDays is always excluding Sundays
          if (!doc.totalWorkingDays || doc.totalWorkingDays === 0) {
            doc.totalWorkingDays = totalWorkingDays;
          }
          return {
            ...doc,
            isSaved: true,
            employeeDesignation: emp.designation || "Staff",
            employeeDepartment: emp.department || "Clinical",
            employeeAvatar: emp.profilePhoto || "",
            employeeEmail: emp.email || "",
          };
        }

        // Auto-calculate all data from attendance logs and leaves for this employee
        const computed = await computeEmployeeMonthlyPayroll(emp, year, m);
        return {
          ...computed,
          isSaved: false,
          employeeDesignation: emp.designation || "Staff",
          employeeDepartment: emp.department || "Clinical",
          employeeAvatar: emp.profilePhoto || "",
          employeeEmail: emp.email || "",
        };
      })
    );

    res.json(monthlyList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  calculatePayrollDetails,
  savePayroll,
  getPayrollByEmployee,
  getPayrollByMonth,
  getWorkingDaysInMonth,
};
