const mongoose = require("mongoose");
const NewAttendance = require("../models/newAttendaceModel");
const Employee = require("../models/employeeModel");
const { getMonthlyAttendanceSummary } = require("./attendanceController");

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Get IST Date string formatted as YYYY-MM-DD
const getISTDateString = (date = new Date()) => {
  return date.toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });
};

// Calculate comprehensive range covering both UTC and IST for a given date
const getComprehensiveDayRange = (dateInput) => {
  let dateStr;
  if (!dateInput) {
    dateStr = getISTDateString();
  } else if (typeof dateInput === "string") {
    dateStr = dateInput.trim().split("T")[0];
  } else if (dateInput instanceof Date) {
    dateStr = getISTDateString(dateInput);
  } else {
    dateStr = getISTDateString();
  }

  const startUTC = new Date(`${dateStr}T00:00:00.000Z`);
  const endUTC = new Date(`${dateStr}T23:59:59.999Z`);
  const startIST = new Date(`${dateStr}T00:00:00.000+05:30`);
  const endIST = new Date(`${dateStr}T23:59:59.999+05:30`);

  const start = startIST < startUTC ? startIST : startUTC;
  const end = endIST > endUTC ? endIST : endUTC;

  return { start, end, dateStr };
};

// Calculate comprehensive range for an entire month (YYYY-MM)
const getComprehensiveMonthRange = (monthInput) => {
  let monthStr = monthInput;
  if (!monthStr || typeof monthStr !== "string" || !/^\d{4}-\d{2}/.test(monthStr.trim())) {
    monthStr = getISTDateString().slice(0, 7); // Defaults to current YYYY-MM
  } else {
    monthStr = monthStr.trim().slice(0, 7);
  }

  const [yearStr, mStr] = monthStr.split("-");
  const year = parseInt(yearStr, 10);
  const m = parseInt(mStr, 10);

  const lastDay = new Date(year, m, 0).getDate();
  const lastDayStr = String(lastDay).padStart(2, "0");

  const startUTC = new Date(`${monthStr}-01T00:00:00.000Z`);
  const endUTC = new Date(`${monthStr}-${lastDayStr}T23:59:59.999Z`);
  const startIST = new Date(`${monthStr}-01T00:00:00.000+05:30`);
  const endIST = new Date(`${monthStr}-${lastDayStr}T23:59:59.999+05:30`);

  const start = startIST < startUTC ? startIST : startUTC;
  const end = endIST > endUTC ? endIST : endUTC;

  return { start, end, monthStr };
};

// Enrich attendance records with employee details (name, designation, department)
const enrichWithEmployeeData = async (records) => {
  if (!records || records.length === 0) return [];

  const empIds = [...new Set(records.map((r) => r.employee_ID).filter(Boolean))];
  const employees = await Employee.find({
    $or: [
      { employeeId: { $in: empIds } },
      { _id: { $in: empIds.filter((id) => mongoose.Types.ObjectId.isValid(id)) } },
    ],
  }).lean();

  const empMap = {};
  employees.forEach((emp) => {
    if (emp.employeeId) empMap[emp.employeeId] = emp;
    if (emp._id) empMap[emp._id.toString()] = emp;
  });

  return records.map((record) => {
    const raw = typeof record.toObject === "function" ? record.toObject() : { ...record };
    const emp = empMap[record.employee_ID];
    const name = emp
      ? [emp.firstName, emp.lastName].filter(Boolean).join(" ")
      : record.name || record.employee_ID;

    return {
      ...raw,
      employeeName: name,
      name: name,
      designation: emp?.designation || "Staff",
      department: emp?.department || "General",
      employeeDetails: emp || null,
    };
  });
};

// Shift calculations for check-in / check-out
const calculateLateCheckIn = (shiftTime, currentTime) => {
  if (!shiftTime) return { isLate: false, workingHours: 0, lateMinutes: 0 };
  const [shiftHour, shiftMinute] = shiftTime.split(":").map(Number);
  const shiftStart = new Date(currentTime);
  shiftStart.setHours(shiftHour, shiftMinute, 0, 0);

  const minutesLate = Math.floor((currentTime - shiftStart) / (1000 * 60));
  if (minutesLate <= 15) {
    return { isLate: false, workingHours: 0, lateMinutes: 0 };
  }
  const deduction = Math.ceil((minutesLate - 15) / 60);
  return {
    isLate: true,
    workingHours: -deduction,
    lateMinutes: minutesLate,
  };
};

const calculateEarlyCheckOut = (shiftTime, currentTime) => {
  if (!shiftTime) return { isEarly: false, workingHours: 0, earlyMinutes: 0 };
  const [shiftHour, shiftMinute] = shiftTime.split(":").map(Number);
  const shiftEnd = new Date(currentTime);
  shiftEnd.setHours(shiftHour, shiftMinute, 0, 0);

  const minutesEarly = Math.floor((shiftEnd - currentTime) / (1000 * 60));
  if (minutesEarly <= 15) {
    return { isEarly: false, workingHours: 0, earlyMinutes: 0 };
  }
  const deduction = Math.ceil((minutesEarly - 15) / 60);
  return {
    isEarly: true,
    workingHours: -deduction,
    earlyMinutes: minutesEarly,
  };
};

// ─── 1. Get All By Month ───────────────────────────────────────────────────────
// GET /new-attendance/getallbymonth or /getallbymonth/:month
const getAllByMonth = async (req, res) => {
  try {
    const rawMonth = req.params.month || req.query.month || req.body?.month;
    const { start, end, monthStr } = getComprehensiveMonthRange(rawMonth);

    const records = await NewAttendance.find({
      date: { $gte: start, $lte: end },
    }).sort({ date: 1, createdAt: 1 });

    const enriched = await enrichWithEmployeeData(records);

    return res.status(200).json({
      success: true,
      message: `Fetched attendance records for month ${monthStr}`,
      month: monthStr,
      count: enriched.length,
      data: enriched,
    });
  } catch (error) {
    console.error("Error in getAllByMonth:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch attendance for month",
      error: error.message,
    });
  }
};

// ─── 2. Find By Date ───────────────────────────────────────────────────────────
// GET /new-attendance/finddate or /finddate/:date
const findDate = async (req, res) => {
  try {
    const rawDate = req.params.date || req.query.date || req.body?.date;
    const { start, end, dateStr } = getComprehensiveDayRange(rawDate);

    const records = await NewAttendance.find({
      date: { $gte: start, $lte: end },
    }).sort({ createdAt: 1 });

    const enriched = await enrichWithEmployeeData(records);

    return res.status(200).json({
      success: true,
      message: `Fetched attendance records for date ${dateStr}`,
      date: dateStr,
      count: enriched.length,
      data: enriched,
    });
  } catch (error) {
    console.error("Error in findDate:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch attendance for date",
      error: error.message,
    });
  }
};

// ─── 3. Find By Employee ID ───────────────────────────────────────────────────
// GET /new-attendance/findbyemployeeid/:employeeID or /findbyemployeeid
const findByEmployeeId = async (req, res) => {
  try {
    const employee_ID =
      req.params.employeeID ||
      req.params.employee_ID ||
      req.query.employee_ID ||
      req.query.employeeId ||
      req.body?.employee_ID ||
      req.body?.employeeId;

    if (!employee_ID) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }

    const emp = await Employee.findOne({
      $or: [
        { employeeId: employee_ID.trim() },
        ...(mongoose.Types.ObjectId.isValid(employee_ID.trim())
          ? [{ _id: employee_ID.trim() }]
          : []),
      ],
    }).lean();

    const idsToMatch = [employee_ID.trim()];
    if (emp) {
      if (emp.employeeId) idsToMatch.push(emp.employeeId);
      if (emp._id) idsToMatch.push(emp._id.toString());
      if (emp.id) idsToMatch.push(emp.id.toString());
    }

    const records = await NewAttendance.find({
      employee_ID: { $in: [...new Set(idsToMatch)] },
    }).sort({ date: -1, createdAt: -1 });

    const enriched = await enrichWithEmployeeData(records);

    return res.status(200).json({
      success: true,
      message: `Fetched attendance records for employee ${employee_ID}`,
      employee_ID,
      count: enriched.length,
      data: enriched,
    });
  } catch (error) {
    console.error("Error in findByEmployeeId:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch attendance by employee ID",
      error: error.message,
    });
  }
};

// ─── 4. Month By Employee ID ──────────────────────────────────────────────────
// GET or POST /new-attendance/monthbyemployeeid/:employeeID/:month or query / body
const getMonthByEmployeeId = async (req, res) => {
  try {
    const employee_ID =
      req.params.employeeID ||
      req.params.employee_ID ||
      req.query.employee_ID ||
      req.query.employeeId ||
      req.body?.employee_ID ||
      req.body?.employeeId;

    if (!employee_ID) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }

    const rawMonth = req.params.month || req.query.month || req.body?.month;
    const { start, end, monthStr } = getComprehensiveMonthRange(rawMonth);

    const emp = await Employee.findOne({
      $or: [
        { employeeId: employee_ID.trim() },
        ...(mongoose.Types.ObjectId.isValid(employee_ID.trim())
          ? [{ _id: employee_ID.trim() }]
          : []),
      ],
    }).lean();

    const idsToMatch = [employee_ID.trim()];
    if (emp) {
      if (emp.employeeId) idsToMatch.push(emp.employeeId);
      if (emp._id) idsToMatch.push(emp._id.toString());
      if (emp.id) idsToMatch.push(emp.id.toString());
    }

    const records = await NewAttendance.find({
      employee_ID: { $in: [...new Set(idsToMatch)] },
      date: { $gte: start, $lte: end },
    }).sort({ date: 1, createdAt: 1 });

    const enriched = await enrichWithEmployeeData(records);

    return res.status(200).json({
      success: true,
      message: `Fetched attendance records for employee ${employee_ID} for month ${monthStr}`,
      employee_ID,
      month: monthStr,
      count: enriched.length,
      data: enriched,
    });
  } catch (error) {
    console.error("Error in getMonthByEmployeeId:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch attendance for employee by month",
      error: error.message,
    });
  }
};

// ─── 5. Date By Employee ID ───────────────────────────────────────────────────
// GET or POST /new-attendance/datebyemployeeid/:employeeID/:date or query / body
const getDateByEmployeeId = async (req, res) => {
  try {
    const employee_ID =
      req.params.employeeID ||
      req.params.employee_ID ||
      req.query.employee_ID ||
      req.query.employeeId ||
      req.body?.employee_ID ||
      req.body?.employeeId;

    if (!employee_ID) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }

    const rawDate = req.params.date || req.query.date || req.body?.date;
    const { start, end, dateStr } = getComprehensiveDayRange(rawDate);

    const records = await NewAttendance.find({
      employee_ID: employee_ID.trim(),
      date: { $gte: start, $lte: end },
    }).sort({ createdAt: 1 });

    const enriched = await enrichWithEmployeeData(records);

    if (enriched.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No attendance found for employee ${employee_ID} on ${dateStr}`,
        employee_ID,
        date: dateStr,
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Fetched attendance record for employee ${employee_ID} on ${dateStr}`,
      employee_ID,
      date: dateStr,
      data: enriched[0],
      records: enriched,
    });
  } catch (error) {
    console.error("Error in getDateByEmployeeId:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch attendance for employee on date",
      error: error.message,
    });
  }
};

// ─── 6. Mark Attendance (Multi-Shift Check-In / Check-Out) ────────────────────
// POST /new-attendance/mark or PATCH /new-attendance/mark
const markNewAttendance = async (req, res) => {
  try {
    const { employee_ID, place, address } = req.body;

    if (!employee_ID) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }

    // Check employee exists
    const employee = await Employee.findOne({
      employeeId: employee_ID,
    }).lean();

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Get today's shift
    const dayOfWeek = new Date().getDay();
    const shifts = [
      employee.sundayShift,
      employee.mondayShift,
      employee.tuesdayShift,
      employee.wednesdayShift,
      employee.thursdayShift,
      employee.fridayShift,
      employee.saturdayShift,
    ];
    const shiftData = shifts[dayOfWeek];

    if (!shiftData) {
      return res.status(400).json({
        success: false,
        message: "No shift assigned for today",
      });
    }

    const today = getISTDateString();
    const { start, end } = getComprehensiveDayRange(today);
    const currentTime = new Date();

    let attendance = await NewAttendance.findOne({
      employee_ID,
      date: { $gte: start, $lte: end },
    });

    // 1. First Check In
    if (!attendance) {
      const lateResult = calculateLateCheckIn(shiftData.firstinTime, currentTime);
      const initialLateDeduction = lateResult.isLate ? (lateResult.workingHours || 0) : 0;

      attendance = await NewAttendance.create({
        employee_ID,
        date: start,
        firstinTime: currentTime,
        status: lateResult.isLate ? "Late Arrival" : "Checked In",
        firstworkingHours: initialLateDeduction,
        secondworkingHours: 0,
        workingHours: initialLateDeduction > 0 ? initialLateDeduction : 0,
        place,
        address,
      });

      return res.status(200).json({
        success: true,
        message: "First Check In Successful",
        data: attendance,
      });
    }

    // 2. First Check Out
    if (attendance.firstinTime && !attendance.firstoutTime) {
      const earlyResult = calculateEarlyCheckOut(shiftData.firstoutTime, currentTime);
      const firstWorkHour = Number(shiftData.firstworkhour) || 0;
      attendance.firstoutTime = currentTime;

      let firstHours = (attendance.firstworkingHours || 0) + firstWorkHour;

      if (earlyResult.isEarly) {
        attendance.status = "Early Exit";
        firstHours += (earlyResult.workingHours || 0);
      } else {
        if (attendance.status !== "Late" && attendance.status !== "Late Arrival") {
          attendance.status = "Present";
        }
      }

      attendance.firstworkingHours = firstHours;

      // If firstworkingHours or secondworkingHours < 0, do not add negative to workingHours
      const s1 = attendance.firstworkingHours > 0 ? attendance.firstworkingHours : 0;
      const s2 = (attendance.secondworkingHours && attendance.secondworkingHours > 0) ? attendance.secondworkingHours : 0;
      attendance.workingHours = s1 + s2;

      await attendance.save();

      return res.status(200).json({
        success: true,
        message: "First Check Out Successful",
        data: attendance,
      });
    }

    // 3. Second Check In
    if (attendance.firstinTime && attendance.firstoutTime && !attendance.secondinTime) {
      const lateResult = calculateLateCheckIn(shiftData.secondinTime, currentTime);
      attendance.secondinTime = currentTime;

      if (lateResult.isLate) {
        attendance.status = "Late Arrival";
      } else {
        attendance.status = "Checked In";
      }

      const secondLateDeduction = lateResult.isLate ? (lateResult.workingHours || 0) : 0;
      attendance.secondworkingHours = (attendance.secondworkingHours || 0) + secondLateDeduction;

      // If firstworkingHours or secondworkingHours < 0, do not add negative to workingHours
      const s1 = (attendance.firstworkingHours && attendance.firstworkingHours > 0) ? attendance.firstworkingHours : 0;
      const s2 = (attendance.secondworkingHours && attendance.secondworkingHours > 0) ? attendance.secondworkingHours : 0;
      attendance.workingHours = s1 + s2;

      await attendance.save();

      return res.status(200).json({
        success: true,
        message: "Second Check In Successful",
        data: attendance,
      });
    }

    // 4. Second Check Out
    if (
      attendance.firstinTime &&
      attendance.firstoutTime &&
      attendance.secondinTime &&
      !attendance.secondoutTime
    ) {
      const earlyResult = calculateEarlyCheckOut(shiftData.secondoutTime, currentTime);
      const secondWorkHour = Number(shiftData.secondworkhour) || 0;
      attendance.secondoutTime = currentTime;

      let secondHours = (attendance.secondworkingHours || 0) + secondWorkHour;

      if (earlyResult.isEarly) {
        attendance.status = "Early Exit";
        secondHours += (earlyResult.workingHours || 0);
      } else {
        if (attendance.status !== "Late" && attendance.status !== "Late Arrival") {
          attendance.status = "Present";
        }
      }

      attendance.secondworkingHours = secondHours;

      // If firstworkingHours or secondworkingHours < 0, do not add negative to workingHours
      const s1 = (attendance.firstworkingHours && attendance.firstworkingHours > 0) ? attendance.firstworkingHours : 0;
      const s2 = attendance.secondworkingHours > 0 ? attendance.secondworkingHours : 0;
      attendance.workingHours = s1 + s2;

      await attendance.save();

      return res.status(200).json({
        success: true,
        message: "Second Check Out Successful",
        data: attendance,
      });
    }

    // 5. Already Completed
    return res.status(200).json({
      success: false,
      message: "Attendance Already Completed for Today",
      data: attendance,
    });
  } catch (error) {
    console.error("Error in markNewAttendance:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to record attendance",
      error: error.message,
    });
  }
};

module.exports = {
  getAllByMonth,
  findDate,
  findByEmployeeId,
  getMonthByEmployeeId,
  getDateByEmployeeId,
  markNewAttendance,
  getMonthlyAttendanceSummary,
};
