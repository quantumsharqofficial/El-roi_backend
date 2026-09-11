const mongoose = require("mongoose");
const Attendance = require("../models/attendanceModel");
const Employee = require("../models/employeeModel");
const Leave = require("../models/leaveModel");

// ─── IST Helpers ─────────────────────────────────────────────────────────────

// Get IST time formatted as HH:mm (24-hour format)
const getISTTime = (date = new Date()) => {
  return date.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

// Get IST Date string formatted as YYYY-MM-DD
const getISTDateString = (date = new Date()) => {
  return date.toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });
};

// Get start and end Date objects covering the full day in IST
const getISTDayRange = (dateInput) => {
  let istDateStr;
  if (!dateInput) {
    istDateStr = getISTDateString();
  } else if (typeof dateInput === "string" && dateInput.includes("T")) {
    istDateStr = getISTDateString(new Date(dateInput));
  } else if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    istDateStr = dateInput.trim();
  } else {
    istDateStr = getISTDateString(new Date(dateInput));
  }

  // 00:00:00.000 IST to 23:59:59.999 IST
  const start = new Date(`${istDateStr}T00:00:00.000+05:30`);
  const end = new Date(`${istDateStr}T23:59:59.999+05:30`);
  return { start, end, istDateStr };
};

// Calculate minutes between two time strings (HH:mm or 12-hour format)
const getDurationMinutes = (checkIn, checkOut) => {
  if (!checkIn || !checkOut || checkIn === "N/A" || checkOut === "N/A" || checkOut === "Present") return 0;
  const parseTime = (timeStr) => {
    if (typeof timeStr !== "string") return 0;
    const match = timeStr.trim().match(/^(\d+):(\d+)\s*(AM|PM)?$/i);
    if (!match) {
      const parts = timeStr.split(":").map(Number);
      return (parts[0] || 0) * 60 + (parts[1] || 0);
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
    if (diff < 0) diff += 24 * 60;
    return diff;
  } catch (e) {
    return 0;
  }
};

// Format duration minutes to "Xh Ym"
const formatDuration = (minutes) => {
  if (!minutes || minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
};

// 1. Mark attendance endpoint (handles both check-in and check-out automatically in IST)
const markAttendance = async (req, res) => {
  try {
    const { employee_ID } = req.body;

    if (!employee_ID) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }

    const { start, end } = getISTDayRange();
    const currentTime = getISTTime();

    let attendance = await Attendance.findOne({
      employee_ID,
      date: { $gte: start, $lte: end },
    }).sort({ createdAt: -1 });

    if (!attendance) {
      attendance = await Attendance.create({
        employee_ID,
        date: start,
        checkInTime: currentTime,
        status: "Checked In",
      });
      return res.status(201).json({
        success: true,
        type: "check-in",
        message: "Check-in successful",
        data: attendance,
      });
    }

    if (attendance.checkOutTime) {
      attendance = await Attendance.create({
        employee_ID,
        date: start,
        checkInTime: currentTime,
        status: "Checked In",
      });

      return res.status(201).json({
        success: true,
        type: "check-in",
        message: "Check-in successful",
        data: attendance,
      });
    }

    attendance.checkOutTime = currentTime;
    attendance.status = "Present";
    await attendance.save();

    return res.status(200).json({
      success: true,
      type: "check-out",
      message: "Check-out successful",
      data: attendance,
    });
  } catch (error) {
    console.error("Error in markAttendance:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// 2. Check-in route (POST /attendance/check-in)
const checkIn = async (req, res) => {
  try {
    const { employee_ID, name, date, checkInTime, place, address } = req.body;

    if (!employee_ID || !date) {
      return res
        .status(400)
        .json({ error: "employee_ID and date are required" });
    }

    const { start, end } = getISTDayRange(date);

    const existingAttendance = await Attendance.findOne({
      employee_ID,
      date: { $gte: start, $lte: end },
    });

    if (existingAttendance) {
      return res
        .status(400)
        .json({ error: "You have already checked in for this date." });
    }

    let displayName = name;
    if (!displayName) {
      const employee = await Employee.findOne({ employeeId: employee_ID });
      if (employee) {
        displayName = [employee.firstName, employee.lastName]
          .filter(Boolean)
          .join(" ");
      } else {
        displayName = "Unknown Employee";
      }
    }

    const attendance = await Attendance.create({
      employee_ID,
      name: displayName,
      date: start,
      checkInTime: checkInTime || getISTTime(),
      status: "Present",
      place: place,
      address: address,
    });

    return res.status(200).json({
      message: "Check-in successful",
      attendance,
    });
  } catch (error) {
    console.error("Error in checkIn:", error);
    return res.status(500).json({ error: error.message });
  }
};

// 3. Check-out route (PATCH /attendance/check-out)
const checkOut = async (req, res) => {
  try {
    const { employee_ID, date, checkOutTime, attendanceId } = req.body;

    if (!employee_ID && !attendanceId) {
      return res
        .status(400)
        .json({ error: "employee_ID or attendanceId is required" });
    }

    let attendance = null;
    if (attendanceId && mongoose.Types.ObjectId.isValid(attendanceId)) {
      attendance = await Attendance.findById(attendanceId);
    }

    if (!attendance) {
      const { start, end } = getISTDayRange(date);
      // Prioritize finding active record without checkOutTime
      attendance = await Attendance.findOne({
        employee_ID,
        date: { $gte: start, $lte: end },
        $or: [
          { checkOutTime: { $exists: false } },
          { checkOutTime: null },
          { checkOutTime: "" },
          { checkOutTime: "--:--" },
        ],
      }).sort({ createdAt: -1 });

      if (!attendance) {
        attendance = await Attendance.findOne({
          employee_ID,
          date: { $gte: start, $lte: end },
        }).sort({ createdAt: -1 });
      }
    }

    if (!attendance) {
      return res
        .status(404)
        .json({ error: "Attendance record not found for this date." });
    }

    if (!attendance.checkInTime) {
      return res
        .status(400)
        .json({ error: "Check-in must be recorded before check-out." });
    }

    const timeToSet = checkOutTime || getISTTime();

    if (typeof attendance.save === "function") {
      attendance.checkOutTime = timeToSet;
      attendance.status = "Present";
      await attendance.save();
    } else {
      await Attendance.findByIdAndUpdate(attendance._id, {
        checkOutTime: timeToSet,
        status: "Present",
      });
      attendance = await Attendance.findById(attendance._id);
    }

    return res.status(200).json({
      message: "Check-out successful",
      attendance,
    });
  } catch (error) {
    console.error("Error in checkOut:", error);
    return res.status(500).json({ error: error.message });
  }
};

// 4. Get employee attendance records (GET /attendance/:employeeID)
const getEmployee = async (req, res) => {
  const { employeeID } = req.params;

  try {
    const records = await Attendance.find({ employee_ID: employeeID }).sort({ date: 1, createdAt: 1 });
    return res.status(200).json(records);
  } catch (error) {
    console.error("Error in getEmployee:", error);
    return res.status(404).json({ error: error.message });
  }
};

// 5. Get attendance records by exact date (GET /attendance/find-date/:date)
const getAttendanceByDate = async (req, res) => {
  const { date } = req.params;

  try {
    const { start, end } = getISTDayRange(date);

    const records = await Attendance.find({
      date: { $gte: start, $lte: end },
    }).sort({ createdAt: 1 });

    return res.status(200).json(records);
  } catch (error) {
    console.error("Error in getAttendanceByDate:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// 6. Get attendance by date and employee ID (POST /attendance/datebyemployeeid)
const getByDateAndEmploueeId = async (req, res) => {
  try {
    const { employee_ID, date } = req.body;

    if (!employee_ID || !date) {
      return res.status(400).json({
        success: false,
        message: "Employee ID and date are required",
      });
    }

    const { start, end } = getISTDayRange(date);

    const record = await Attendance.findOne({
      employee_ID,
      date: { $gte: start, $lte: end },
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "No attendance found for this employee on this date",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Attendance fetched successfully",
      data: record,
    });
  } catch (error) {
    console.error("Error in getByDateAndEmploueeId:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// 7. Get Monthly Attendance Summary (GET /attendance/monthly-summary?month=YYYY-MM&employeeId=...)
const getMonthlyAttendanceSummary = async (req, res) => {
  try {
    const { month, employeeId } = req.query;
    let targetMonth = month;
    if (!targetMonth || !/^\d{4}-\d{2}$/.test(targetMonth)) {
      targetMonth = getISTDateString().slice(0, 7); // Defaults to current IST YYYY-MM
    }

    const [yearStr, monthStr] = targetMonth.split("-");
    const year = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10);

    const daysInMonth = new Date(year, m, 0).getDate();
    const startOfMonth = new Date(`${targetMonth}-01T00:00:00.000+05:30`);
    const endOfMonth = new Date(`${targetMonth}-${daysInMonth.toString().padStart(2, "0")}T23:59:59.999+05:30`);

    // Working days in month excluding Sundays (clinics typically work Mon-Sat)
    let workingDaysCount = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, m - 1, day);
      if (d.getDay() !== 0) { // Exclude Sunday
        workingDaysCount++;
      }
    }

    const empQuery = employeeId
      ? {
        $or: [
          { employeeId: employeeId },
          ...(mongoose.Types.ObjectId.isValid(employeeId) ? [{ _id: employeeId }] : []),
        ],
      }
      : {};
    const employees = await Employee.find(empQuery);

    const empIds = employees.map((e) => e.employeeId);
    if (employeeId && !empIds.includes(employeeId)) {
      empIds.push(employeeId);
    }

    // Comprehensive date range covering IST and UTC borders
    const startOfMonthUTC = new Date(`${targetMonth}-01T00:00:00.000Z`);
    const startRange = startOfMonth < startOfMonthUTC ? startOfMonth : startOfMonthUTC;
    const endOfMonthUTC = new Date(`${targetMonth}-${daysInMonth.toString().padStart(2, "0")}T23:59:59.999Z`);
    const endRange = endOfMonth > endOfMonthUTC ? endOfMonth : endOfMonthUTC;

    // Fetch all attendance logs for this month
    const attendanceLogs = await Attendance.find({
      employee_ID: { $in: empIds },
      $or: [
        { date: { $gte: startRange, $lte: endRange } },
        { createdAt: { $gte: startRange, $lte: endRange } },
      ],
    }).sort({ date: 1, createdAt: 1 });

    // Fetch all approved leaves for this month
    const leaves = await Leave.find({
      status: "Approved",
      $or: [
        { startDate: { $lte: endOfMonth }, endDate: { $gte: startOfMonth } },
      ],
    });

    const SHIFT_MINUTES = 480; // 8 hours standard shift

    const todayIST = getISTDateString();

    const employeeSummaries = employees.map((emp) => {
      const logsForEmp = attendanceLogs.filter(
        (log) => log.employee_ID === emp.employeeId
      );

      // Group logs by date in IST (YYYY-MM-DD)
      const dayMap = {};
      logsForEmp.forEach((log) => {
        const rawDate = log.date || log.createdAt;
        const dateKey = getISTDateString(new Date(rawDate));
        if (!dayMap[dateKey]) {
          dayMap[dateKey] = [];
        }
        dayMap[dateKey].push(log);
      });

      // Fetch leaves for this employee
      const empLeaves = leaves.filter(
        (l) =>
          l.employeeEID === emp.employeeId ||
          String(l.employeeId) === String(emp._id)
      );

      let presentDays = 0;
      let lateDays = 0;
      let halfDays = 0;
      let absentDays = 0;
      let onLeaveDays = 0;
      let totalWorkedMinutes = 0;
      let totalOtMinutes = 0;

      const dailyBreakdown = [];

      // Loop through all days of the month up to daysInMonth
      for (let day = 1; day <= daysInMonth; day++) {
        const dayStr = `${targetMonth}-${day.toString().padStart(2, "0")}`;
        const dayDate = new Date(year, m - 1, day);
        const isSunday = dayDate.getDay() === 0;
        const isPastOrToday = dayStr <= todayIST;

        const dayLogs = dayMap[dayStr] || [];

        // Check if on leave
        const hasLeave = empLeaves.some((l) => {
          const lStart = getISTDateString(new Date(l.startDate));
          const lEnd = getISTDateString(new Date(l.endDate));
          return dayStr >= lStart && dayStr <= lEnd;
        });

        let dayMinutes = 0;
        let dayStatus = isSunday ? "Sunday" : "Absent";
        let firstCheckIn = null;
        let lastCheckOut = null;

        if (dayLogs.length > 0) {
          // Present or active
          const hasLate = dayLogs.some((l) => l.status === "Late");
          const hasHalfDay = dayLogs.some((l) => l.status === "Half Day");
          const isCheckInOnly = dayLogs.some(
            (l) => l.status === "Checked In" || (l.checkInTime && !l.checkOutTime)
          );

          dayStatus = hasHalfDay
            ? "Half Day"
            : hasLate
              ? "Late"
              : isCheckInOnly && isPastOrToday
                ? "Checked In"
                : "Present";
          if (hasHalfDay) halfDays++;
          else if (hasLate) lateDays++;
          else presentDays++;

          firstCheckIn = dayLogs[0].checkInTime;
          lastCheckOut = dayLogs[dayLogs.length - 1].checkOutTime;

          dayLogs.forEach((l) => {
            const dur = getDurationMinutes(l.checkInTime, l.checkOutTime);
            dayMinutes += dur;
          });

          totalWorkedMinutes += dayMinutes;

          // Daily OT calculation: duration > 8 hours (480 minutes)
          const dailyOt = Math.max(0, dayMinutes - SHIFT_MINUTES);
          totalOtMinutes += dailyOt;

          dailyBreakdown.push({
            date: dayStr,
            day: dayDate.toLocaleDateString("en-US", { weekday: "short" }),
            status: dayStatus,
            checkIn: firstCheckIn || "--:--",
            checkOut: lastCheckOut || (isCheckInOnly ? "In Progress..." : "--:--"),
            durationMinutes: dayMinutes,
            durationFormatted: isCheckInOnly && dayMinutes === 0 ? "In Progress" : formatDuration(dayMinutes),
            otMinutes: dailyOt,
            otFormatted: formatDuration(dailyOt),
            isOvertime: dailyOt > 0,
          });
        } else if (hasLeave) {
          onLeaveDays++;
          dayStatus = "On Leave";
          dailyBreakdown.push({
            date: dayStr,
            day: dayDate.toLocaleDateString("en-US", { weekday: "short" }),
            status: "On Leave",
            checkIn: "--:--",
            checkOut: "--:--",
            durationMinutes: 0,
            durationFormatted: "0m",
            otMinutes: 0,
            otFormatted: "0m",
            isOvertime: false,
          });
        } else if (!isSunday && isPastOrToday) {
          absentDays++;
          dailyBreakdown.push({
            date: dayStr,
            day: dayDate.toLocaleDateString("en-US", { weekday: "short" }),
            status: "Absent",
            checkIn: "--:--",
            checkOut: "--:--",
            durationMinutes: 0,
            durationFormatted: "0m",
            otMinutes: 0,
            otFormatted: "0m",
            isOvertime: false,
          });
        } else {
          dailyBreakdown.push({
            date: dayStr,
            day: dayDate.toLocaleDateString("en-US", { weekday: "short" }),
            status: isSunday ? "Sunday" : "Upcoming",
            checkIn: "--:--",
            checkOut: "--:--",
            durationMinutes: 0,
            durationFormatted: "0m",
            otMinutes: 0,
            otFormatted: "0m",
            isOvertime: false,
          });
        }
      }

      const effectivePresent = presentDays + lateDays + halfDays * 0.5;
      const attendanceRate =
        workingDaysCount > 0
          ? Math.min(100, parseFloat(((effectivePresent / workingDaysCount) * 100).toFixed(1)))
          : 0;

      const empName = [emp.firstName, emp.lastName].filter(Boolean).join(" ") || emp.name || emp.employeeId;

      return {
        _id: emp._id,
        employeeId: emp.employeeId,
        name: empName,
        designation: emp.designation || "Physiotherapist",
        department: emp.department || "Clinical",
        profilePhoto: emp.profilePhoto || null,
        workingDays: workingDaysCount,
        presentDays,
        lateDays,
        halfDays,
        absentDays,
        onLeaveDays,
        totalWorkedMinutes,
        totalWorkedHours: parseFloat((totalWorkedMinutes / 60).toFixed(1)),
        totalWorkedFormatted: formatDuration(totalWorkedMinutes),
        totalOtMinutes,
        totalOtHours: parseFloat((totalOtMinutes / 60).toFixed(1)),
        totalOtFormatted: formatDuration(totalOtMinutes),
        attendanceRate,
        dailyBreakdown,
      };
    });

    // Calculate aggregated stats across all employees
    const totalPresentSum = employeeSummaries.reduce((acc, e) => acc + e.presentDays + e.lateDays, 0);
    const totalOtMinutesSum = employeeSummaries.reduce((acc, e) => acc + e.totalOtMinutes, 0);
    const avgAttendanceRate =
      employeeSummaries.length > 0
        ? parseFloat(
          (
            employeeSummaries.reduce((acc, e) => acc + e.attendanceRate, 0) /
            employeeSummaries.length
          ).toFixed(1)
        )
        : 0;

    return res.status(200).json({
      success: true,
      month: targetMonth,
      monthName: new Date(year, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      workingDays: workingDaysCount,
      totalEmployees: employees.length,
      overallPresentCount: totalPresentSum,
      overallOtMinutes: totalOtMinutesSum,
      overallOtHours: parseFloat((totalOtMinutesSum / 60).toFixed(1)),
      overallOtFormatted: formatDuration(totalOtMinutesSum),
      overallAttendanceRate: avgAttendanceRate,
      summaries: employeeSummaries,
      summary: employeeSummaries,
    });
  } catch (error) {
    console.error("Error in getMonthlyAttendanceSummary:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate monthly attendance summary",
      error: error.message,
    });
  }
};

module.exports = {
  markAttendance,
  checkIn,
  checkOut,
  getEmployee,
  getAttendanceByDate,
  getByDateAndEmploueeId,
  getMonthlyAttendanceSummary,
};
