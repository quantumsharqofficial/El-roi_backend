const Employee = require("../models/employeeModel");
const Leave = require("../models/leaveModel");
const Attendance = require("../models/attendanceModel");

// Helper to count working days (excludes Saturdays, Sundays, and national holidays)
const getWorkingDaysCount = (startDate, endDate) => {
  let count = 0;
  let cur = new Date(startDate);
  const end = new Date(endDate);
  
  const holidays = [
    "01-01", // New Year
    "01-26", // Republic Day
    "05-01", // May Day
    "08-15", // Independence Day
    "10-02", // Gandhi Jayanti
    "12-25", // Christmas
  ];

  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) {
      const monthStr = String(cur.getMonth() + 1).padStart(2, "0");
      const dateStr = String(cur.getDate()).padStart(2, "0");
      const mmdd = `${monthStr}-${dateStr}`;
      if (!holidays.includes(mmdd)) {
        count++;
      }
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

const getSystemAlerts = async (req, res) => {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    const employees = await Employee.find({ isDeleted: { $ne: true }, status: "Active" });

    const probationAlerts = [];
    const noticeAlerts = [];
    const birthdayAlerts = [];
    const missingAttendance = [];

    // Check attendance for today
    const todaysAttendance = await Attendance.find({
      date: { $gte: startOfToday, $lte: endOfToday }
    });
    const checkedInEmpIds = todaysAttendance.map(a => a.employee_ID);

    employees.forEach((emp) => {
      // 1. Probation Alerts
      if (emp.employeeType === "Probation Period" && emp.dateOfJoining) {
        const completed = getWorkingDaysCount(emp.dateOfJoining, today);
        const remaining = 45 - completed;
        if (remaining <= 5 && remaining > 0) {
          probationAlerts.push({
            employeeId: emp.employeeId,
            name: `${emp.firstName} ${emp.lastName || ""}`.trim(),
            completed,
            remaining,
          });
        }
      }

      // 2. Notice Period Alerts
      if (emp.employeeType === "Notice Period" && emp.noticeStartDate) {
        const diffTime = Math.abs(today - new Date(emp.noticeStartDate));
        const completed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const remaining = 30 - completed;
        if (remaining <= 5 && remaining > 0) {
          noticeAlerts.push({
            employeeId: emp.employeeId,
            name: `${emp.firstName} ${emp.lastName || ""}`.trim(),
            completed,
            remaining,
          });
        }
      }

      // 3. Birthday Alerts (Next 5 Days)
      if (emp.dob) {
        const dob = new Date(emp.dob);
        const nextBirthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
        if (nextBirthday < today) {
          nextBirthday.setFullYear(today.getFullYear() + 1);
        }
        const diffDays = Math.ceil((nextBirthday - today) / (1000 * 60 * 60 * 24));
        if (diffDays <= 5 || (dob.getMonth() === today.getMonth() && dob.getDate() === today.getDate())) {
          birthdayAlerts.push({
            employeeId: emp.employeeId,
            name: `${emp.firstName} ${emp.lastName || ""}`.trim(),
            dob: emp.dob,
            daysRemaining: diffDays === 365 ? 0 : diffDays,
          });
        }
      }

      // 5. Missing Attendance Records
      if (!checkedInEmpIds.includes(emp.employeeId)) {
        missingAttendance.push({
          employeeId: emp.employeeId,
          name: `${emp.firstName} ${emp.lastName || ""}`.trim(),
        });
      }
    });

    // 4. Pending Leave Approvals
    const pendingLeaves = await Leave.find({ status: "Pending HR" });

    res.json({
      probationAlerts,
      noticeAlerts,
      birthdayAlerts,
      pendingLeaves,
      missingAttendance,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getSystemAlerts,
  getWorkingDaysCount, // exported for automatic transitions usage
};
