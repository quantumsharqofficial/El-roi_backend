const mongoose = require("mongoose");
const Attendance = require("../models/attendanceModel");
const Employee = require("../models/employeeModel");
const Leave = require("../models/leaveModel");
const NewAttendance = require("../models/newAttendaceModel");
const HomeVisit = require("../models/homeVisitModel");

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
const formatTimeIST = (timeVal) => {
  if (!timeVal || timeVal === "N/A" || timeVal === "Present" || timeVal === "--:--") return timeVal || "--:--";
  if (timeVal instanceof Date || (typeof timeVal === "string" && (timeVal.includes("T") || timeVal.includes("Z")))) {
    const d = new Date(timeVal);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString("en-US", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    }
  }
  if (typeof timeVal === "string") {
    const trimmed = timeVal.trim();
    if (/am|pm/i.test(trimmed)) return trimmed;
    const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (match) {
      let hrs = parseInt(match[1], 10);
      const mins = match[2];
      const period = hrs >= 12 ? "PM" : "AM";
      hrs = hrs % 12;
      if (hrs === 0) hrs = 12;
      return `${hrs.toString().padStart(2, "0")}:${mins} ${period}`;
    }
  }
  return timeVal;
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

    const empIds = [];
    employees.forEach(e => {
      if (e.employeeId) empIds.push(e.employeeId);
      if (e._id) empIds.push(e._id.toString());
      if (e.id) empIds.push(e.id.toString());
    });
    if (employeeId && !empIds.includes(employeeId)) {
      empIds.push(employeeId);
    }
    const uniqueEmpIds = [...new Set(empIds)];

    // Comprehensive date range covering IST and UTC borders
    const startOfMonthUTC = new Date(`${targetMonth}-01T00:00:00.000Z`);
    const startRange = startOfMonth < startOfMonthUTC ? startOfMonth : startOfMonthUTC;
    const endOfMonthUTC = new Date(`${targetMonth}-${daysInMonth.toString().padStart(2, "0")}T23:59:59.999Z`);
    const endRange = endOfMonth > endOfMonthUTC ? endOfMonth : endOfMonthUTC;

    // Fetch new attendance logs, old logs, leaves, and home visits in parallel
    const [newLogs, oldLogs, leaves, homeVisitRecords] = await Promise.all([
      NewAttendance.find({
        employee_ID: { $in: uniqueEmpIds },
        $or: [
          { date: { $gte: startRange, $lte: endRange } },
          { createdAt: { $gte: startRange, $lte: endRange } },
        ],
      }).sort({ date: 1, createdAt: 1 }),
      Attendance.find({
        employee_ID: { $in: uniqueEmpIds },
        $or: [
          { date: { $gte: startRange, $lte: endRange } },
          { createdAt: { $gte: startRange, $lte: endRange } },
        ],
      }).sort({ date: 1, createdAt: 1 }),
      Leave.find({
        status: "Approved",
        $or: [
          { startDate: { $lte: endOfMonth }, endDate: { $gte: startOfMonth } },
        ],
      }),
      HomeVisit.find({
        $or: [
          { date: { $gte: startRange, $lte: endRange } },
          { createdAt: { $gte: startRange, $lte: endRange } },
        ],
      }),
    ]);

    const SHIFT_MINUTES = 480; // 8 hours standard shift
    const todayIST = getISTDateString();

    const employeeSummaries = employees.map((emp) => {
      const matchIds = [
        emp.employeeId,
        emp._id ? emp._id.toString() : null,
        emp.id ? emp.id.toString() : null,
      ].filter(Boolean);

      const empNewLogs = newLogs.filter((log) => matchIds.includes(log.employee_ID));
      const empOldLogs = oldLogs.filter((log) => matchIds.includes(log.employee_ID));

      // Group new attendance logs by date in IST (YYYY-MM-DD)
      const newDayMap = {};
      empNewLogs.forEach((log) => {
        const rawDate = log.date || log.createdAt;
        const dateKey = getISTDateString(new Date(rawDate));
        if (!newDayMap[dateKey]) newDayMap[dateKey] = [];
        newDayMap[dateKey].push(log);
      });

      // Group old attendance logs by date in IST (YYYY-MM-DD)
      const oldDayMap = {};
      empOldLogs.forEach((log) => {
        const rawDate = log.date || log.createdAt;
        const dateKey = getISTDateString(new Date(rawDate));
        if (!oldDayMap[dateKey]) oldDayMap[dateKey] = [];
        oldDayMap[dateKey].push(log);
      });

      // Fetch leaves for this employee
      const empLeaves = leaves.filter(
        (l) =>
          l.employeeEID === emp.employeeId ||
          String(l.employeeId) === String(emp._id)
      );

      let presentDays = 0;
      let morningLateDays = 0;
      let earlyCheckOutDays = 0;
      let absentDays = 0;
      let onLeaveDays = 0;
      let homeVisitCount = 0;
      const homeVisits = [];

      let totalWorkedMinutes = 0;
      let totalOtMinutes = 0;
      let totalFirstWorkHours = 0;
      let totalSecondWorkHours = 0;

      const dailyBreakdown = [];

      // Loop through all days of the month up to daysInMonth
      for (let day = 1; day <= daysInMonth; day++) {
        const dayStr = `${targetMonth}-${day.toString().padStart(2, "0")}`;
        const dayDate = new Date(year, m - 1, day);
        const dayName = dayDate.toLocaleDateString("en-US", { weekday: "short" });
        const isSunday = dayDate.getDay() === 0;
        const isPastOrToday = dayStr <= todayIST;

        const dayNewLogs = newDayMap[dayStr] || [];
        const dayOldLogs = oldDayMap[dayStr] || [];

        // Check if on leave
        const hasLeave = empLeaves.some((l) => {
          const lStart = getISTDateString(new Date(l.startDate));
          const lEnd = getISTDateString(new Date(l.endDate));
          return dayStr >= lStart && dayStr <= lEnd;
        });

        let dayMinutes = 0;
        let dayStatus = isSunday ? "Sunday" : "Absent";
        let firstIn = "--:--";
        let firstOut = "--:--";
        let firstHours = 0;
        let secondIn = "--:--";
        let secondOut = "--:--";
        let secondHours = 0;
        let totalDayHours = 0;
        let isHomeVisit = false;
        let logCheckIn = "--:--";
        let logCheckOut = "--:--";
        let dayPlace = "";
        let dayAddress = "";

        if (dayNewLogs.length > 0) {
          // Priority: New Attendance (Multi-shift)
          const primaryLog = dayNewLogs[0];
          dayPlace = primaryLog.place || "";
          dayAddress = primaryLog.address || "";
          isHomeVisit = Boolean(
            (dayPlace && /home/i.test(dayPlace)) || (dayAddress && /home/i.test(dayAddress))
          );

          firstIn = primaryLog.firstinTime ? formatTimeIST(primaryLog.firstinTime) : "--:--";
          firstOut = primaryLog.firstoutTime ? formatTimeIST(primaryLog.firstoutTime) : "--:--";
          secondIn = primaryLog.secondinTime ? formatTimeIST(primaryLog.secondinTime) : "--:--";
          secondOut = primaryLog.secondoutTime ? formatTimeIST(primaryLog.secondoutTime) : "--:--";

          firstHours = primaryLog.firstworkingHours !== undefined && primaryLog.firstworkingHours !== null ? Number(primaryLog.firstworkingHours) : 0;
          secondHours = primaryLog.secondworkingHours !== undefined && primaryLog.secondworkingHours !== null ? Number(primaryLog.secondworkingHours) : 0;
          totalDayHours = primaryLog.workingHours !== undefined && primaryLog.workingHours !== null
            ? Number(primaryLog.workingHours)
            : (Math.max(0, firstHours) + Math.max(0, secondHours));

          totalFirstWorkHours += Math.max(0, firstHours);
          totalSecondWorkHours += Math.max(0, secondHours);

          const rawStatus = primaryLog.status || "Present";
          const isCheckInOnly = rawStatus === "Checked In" || (primaryLog.firstinTime && !primaryLog.firstoutTime);
          const isLate = rawStatus === "Late" || rawStatus === "Late Arrival";
          const isEarly = rawStatus === "Early Exit";

          if (isLate) {
            morningLateDays++;
            dayStatus = "Morning Late";
          } else if (isEarly) {
            earlyCheckOutDays++;
            dayStatus = "Early Check Out";
          } else if (rawStatus === "On Leave") {
            onLeaveDays++;
            dayStatus = "On Leave";
          } else if (rawStatus === "Absent") {
            absentDays++;
            dayStatus = "Absent";
          } else {
            presentDays++;
            dayStatus = isCheckInOnly && isPastOrToday ? "Checked In" : "Present";
          }

          if (isHomeVisit) {
            homeVisitCount++;
            homeVisits.push({
              date: dayStr,
              day: dayName,
              place: dayPlace || "Home Visit",
              address: dayAddress || "Patient Location",
              checkIn: firstIn,
              checkOut: secondOut !== "--:--" ? secondOut : firstOut,
              hours: totalDayHours,
            });
          }

          dayMinutes = Math.round(totalDayHours * 60);
          if (dayMinutes === 0 && primaryLog.firstinTime && primaryLog.firstoutTime) {
            dayMinutes = getDurationMinutes(firstIn, firstOut);
          }
          totalWorkedMinutes += dayMinutes;

          const dailyOt = Math.max(0, dayMinutes - SHIFT_MINUTES);
          totalOtMinutes += dailyOt;

          dailyBreakdown.push({
            date: dayStr,
            day: dayName,
            status: dayStatus,
            firstIn,
            firstOut,
            firstworkingHours: firstHours,
            secondIn,
            secondOut,
            secondworkingHours: secondHours,
            workingHours: totalDayHours,
            checkIn: firstIn,
            checkOut: secondOut !== "--:--" ? secondOut : (firstOut !== "--:--" ? firstOut : (isCheckInOnly ? "In Progress..." : "--:--")),
            durationMinutes: dayMinutes,
            durationFormatted: isCheckInOnly && dayMinutes === 0 ? "In Progress" : formatDuration(dayMinutes),
            otMinutes: dailyOt,
            otFormatted: formatDuration(dailyOt),
            isOvertime: dailyOt > 0,
            isHomeVisit,
            place: dayPlace,
            address: dayAddress,
          });
        } else if (dayOldLogs.length > 0) {
          // Fallback: Legacy Attendance logs
          const hasLate = dayOldLogs.some((l) => l.status === "Late");
          const hasEarly = dayOldLogs.some((l) => l.status === "Early Exit" || l.status === "Half Day");
          const isCheckInOnly = dayOldLogs.some((l) => l.status === "Checked In" || (l.checkInTime && !l.checkOutTime));

          isHomeVisit = dayOldLogs.some((l) => (l.place && /home/i.test(l.place)) || (l.address && /home/i.test(l.address)));
          const homeLog = dayOldLogs.find((l) => (l.place && /home/i.test(l.place)) || (l.address && /home/i.test(l.address)));
          if (homeLog) {
            dayPlace = homeLog.place || "Home Visit";
            dayAddress = homeLog.address || "";
          }

          if (hasLate) {
            morningLateDays++;
            dayStatus = "Morning Late";
          } else if (hasEarly) {
            earlyCheckOutDays++;
            dayStatus = "Early Check Out";
          } else {
            presentDays++;
            dayStatus = isCheckInOnly && isPastOrToday ? "Checked In" : "Present";
          }

          logCheckIn = formatTimeIST(dayOldLogs[0].checkInTime);
          logCheckOut = formatTimeIST(dayOldLogs[dayOldLogs.length - 1].checkOutTime);

          dayOldLogs.forEach((l) => {
            const dur = getDurationMinutes(l.checkInTime, l.checkOutTime);
            dayMinutes += dur;
          });
          totalWorkedMinutes += dayMinutes;

          totalDayHours = parseFloat((dayMinutes / 60).toFixed(1));
          firstHours = totalDayHours;
          firstIn = logCheckIn;
          firstOut = logCheckOut;

          if (isHomeVisit) {
            homeVisitCount++;
            homeVisits.push({
              date: dayStr,
              day: dayName,
              place: dayPlace || "Home Visit",
              address: dayAddress || "Patient Location",
              checkIn: logCheckIn,
              checkOut: logCheckOut,
              hours: totalDayHours,
            });
          }

          const dailyOt = Math.max(0, dayMinutes - SHIFT_MINUTES);
          totalOtMinutes += dailyOt;

          dailyBreakdown.push({
            date: dayStr,
            day: dayName,
            status: dayStatus,
            firstIn,
            firstOut,
            firstworkingHours: firstHours,
            secondIn: "--:--",
            secondOut: "--:--",
            secondworkingHours: 0,
            workingHours: totalDayHours,
            checkIn: logCheckIn || "--:--",
            checkOut: logCheckOut || (isCheckInOnly ? "In Progress..." : "--:--"),
            durationMinutes: dayMinutes,
            durationFormatted: isCheckInOnly && dayMinutes === 0 ? "In Progress" : formatDuration(dayMinutes),
            otMinutes: dailyOt,
            otFormatted: formatDuration(dailyOt),
            isOvertime: dailyOt > 0,
            isHomeVisit,
            place: dayPlace,
            address: dayAddress,
          });
        } else if (hasLeave) {
          onLeaveDays++;
          dayStatus = "On Leave";
          dailyBreakdown.push({
            date: dayStr,
            day: dayName,
            status: "On Leave",
            firstIn: "--:--",
            firstOut: "--:--",
            firstworkingHours: 0,
            secondIn: "--:--",
            secondOut: "--:--",
            secondworkingHours: 0,
            workingHours: 0,
            checkIn: "--:--",
            checkOut: "--:--",
            durationMinutes: 0,
            durationFormatted: "0m",
            otMinutes: 0,
            otFormatted: "0m",
            isOvertime: false,
            isHomeVisit: false,
            place: "",
            address: "",
          });
        } else if (!isSunday && isPastOrToday) {
          absentDays++;
          dayStatus = "Absent";
          dailyBreakdown.push({
            date: dayStr,
            day: dayName,
            status: "Absent",
            firstIn: "--:--",
            firstOut: "--:--",
            firstworkingHours: 0,
            secondIn: "--:--",
            secondOut: "--:--",
            secondworkingHours: 0,
            workingHours: 0,
            checkIn: "--:--",
            checkOut: "--:--",
            durationMinutes: 0,
            durationFormatted: "0m",
            otMinutes: 0,
            otFormatted: "0m",
            isOvertime: false,
            isHomeVisit: false,
            place: "",
            address: "",
          });
        } else {
          dayStatus = isSunday ? "Sunday" : "Upcoming";
          dailyBreakdown.push({
            date: dayStr,
            day: dayName,
            status: dayStatus,
            firstIn: "--:--",
            firstOut: "--:--",
            firstworkingHours: 0,
            secondIn: "--:--",
            secondOut: "--:--",
            secondworkingHours: 0,
            workingHours: 0,
            checkIn: "--:--",
            checkOut: "--:--",
            durationMinutes: 0,
            durationFormatted: "0m",
            otMinutes: 0,
            otFormatted: "0m",
            isOvertime: false,
            isHomeVisit: false,
            place: "",
            address: "",
          });
        }
      }

      const totalAttended = presentDays + morningLateDays + earlyCheckOutDays;
      const attendanceRate =
        workingDaysCount > 0
          ? Math.min(100, parseFloat(((totalAttended / workingDaysCount) * 100).toFixed(1)))
          : 0;

      const empName = [emp.firstName, emp.lastName].filter(Boolean).join(" ") || emp.name || emp.employeeId;

      // Incorporate HomeVisit model records for this employee
      const empHomeVisitModels = homeVisitRecords.filter((hv) => {
        const hvEmpId = String(hv.employeeId || "").trim();
        const hvEmpName = String(hv.employeeName || "").trim().toLowerCase();
        const hvPatientName = String(hv.patientName || "").trim().toLowerCase();
        const curName = String(empName).trim().toLowerCase();
        return (
          matchIds.includes(hvEmpId) ||
          (curName && hvEmpName === curName) ||
          (curName && hvPatientName === curName)
        );
      });

      empHomeVisitModels.forEach((hv) => {
        const hvDateStr = getISTDateString(new Date(hv.date));
        const alreadyIn = homeVisits.some((h) => h.date === hvDateStr && (h.patientName === hv.patientName || h.diagnosis === hv.diagnosis));
        if (!alreadyIn) {
          homeVisitCount++;
          homeVisits.push({
            date: hvDateStr,
            day: hv.day || new Date(hv.date).toLocaleDateString("en-US", { weekday: "short" }),
            patientName: hv.patientName,
            pain: hv.pain,
            diagnosis: hv.diagnosis,
            prescription: hv.prescription,
            modalities: hv.modalities,
            comments: hv.comments,
            place: hv.place || "Home Visit",
            address: hv.address || hv.diagnosis || "Home Visit",
            checkIn: "--:--",
            checkOut: "--:--",
            hours: 0,
          });
        }
      });

      return {
        _id: emp._id,
        employeeId: emp.employeeId,
        name: empName,
        designation: emp.designation || "Physiotherapist",
        department: emp.department || "Clinical",
        profilePhoto: emp.profilePhoto || null,
        workingDays: workingDaysCount,
        presentDays,
        morningLateDays,
        earlyCheckOutDays,
        lateDays: morningLateDays, // backwards-compatible
        halfDays: earlyCheckOutDays, // backwards-compatible
        absentDays,
        onLeaveDays,
        homeVisitCount,
        homeVisits,
        firstworkingHours: parseFloat(totalFirstWorkHours.toFixed(1)),
        secondworkingHours: parseFloat(totalSecondWorkHours.toFixed(1)),
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
    const totalPresentSum = employeeSummaries.reduce((acc, e) => acc + e.presentDays + e.morningLateDays + e.earlyCheckOutDays, 0);
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
// ===============================
// Late Check-In
// ===============================
const calculateLateCheckIn = (shiftTime, currentTime) => {
  const [shiftHour, shiftMinute] = shiftTime.split(":").map(Number);

  const shiftStart = new Date(currentTime);
  shiftStart.setHours(shiftHour, shiftMinute, 0, 0);

  const minutesLate = Math.floor(
    (currentTime - shiftStart) / (1000 * 60)
  );

  // Within 15 minutes → Normal
  if (minutesLate <= 15) {
    return {
      isLate: false,
      workingHours: 0,
      lateMinutes: 0,
    };
  }

  const deduction = Math.ceil((minutesLate - 15) / 60);

  return {
    isLate: true,
    workingHours: -deduction,
    lateMinutes: minutesLate,
  };
};


// ===============================
// Early Check-Out
// ===============================
const calculateEarlyCheckOut = (shiftTime, currentTime) => {
  const [shiftHour, shiftMinute] = shiftTime.split(":").map(Number);

  const shiftEnd = new Date(currentTime);
  shiftEnd.setHours(shiftHour, shiftMinute, 0, 0);

  const minutesEarly = Math.floor(
    (shiftEnd - currentTime) / (1000 * 60)
  );

  // Within 15 minutes early → Normal
  if (minutesEarly <= 15) {
    return {
      isEarly: false,
      workingHours: 0,
      earlyMinutes: 0,
    };
  }

  const deduction = Math.ceil((minutesEarly - 15) / 60);

  return {
    isEarly: true,
    workingHours: -deduction,
    earlyMinutes: minutesEarly,
  };
};


const newAttendance = async (req, res) => {
  try {
    const { employee_ID, place, address } = req.body;

    // Validate employee ID
    if (!employee_ID) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }

    // Check employee exists
    const employee = await Employee.findOne({
      $or: [
        { employeeId: employee_ID },
        ...(mongoose.Types.ObjectId.isValid(employee_ID) ? [{ _id: employee_ID }] : []),
      ],
    }).lean();

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // ===============================
    // Get Today's Shift
    // ===============================
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

    // ===============================
    // Today's Date & Current Time
    // ===============================
    const today = new Date().toISOString().split("T")[0];
    const currentTime = new Date();

    console.log("current time ", currentTime);

    // Find today's attendance
    const empIdsToMatch = [employee_ID];
    if (employee.employeeId) empIdsToMatch.push(employee.employeeId);
    if (employee._id) empIdsToMatch.push(employee._id.toString());

    let attendance = await NewAttendance.findOne({
      employee_ID: { $in: [...new Set(empIdsToMatch)] },
      date: today,
    });

    // ===============================
    // 1. First Check-In
    // ===============================
    if (!attendance) {
      const lateResult = calculateLateCheckIn(
        shiftData.firstinTime,
        currentTime
      );

      const initialLateDeduction = lateResult.isLate ? (lateResult.workingHours || 0) : 0;

      attendance = await NewAttendance.create({
        employee_ID,
        date: today,
        firstinTime: currentTime,
        status: lateResult.isLate ? "Late" : "Checked In",
        firstworkingHours: initialLateDeduction,
        secondworkingHours: 0,
        workingHours: initialLateDeduction,
        place,
        address,
      });

      return res.status(200).json({
        success: true,
        message: "Check In Successfully",
        data: attendance,
      });
    }

    // ===============================
    // 2. First Check-Out
    // ===============================
    if (attendance.firstinTime && !attendance.firstoutTime) {
      const earlyResult = calculateEarlyCheckOut(
        shiftData.firstoutTime,
        currentTime
      );

      const firstWorkHour = Number(shiftData.firstworkhour) || 0;

      attendance.firstoutTime = currentTime;

      // Base first shift working hours + any prior late deduction
      let firstHours = (attendance.firstworkingHours || 0) + firstWorkHour;

      // Apply early checkout deduction
      if (earlyResult.isEarly) {
        attendance.status = "Early Exit";
        firstHours += (earlyResult.workingHours || 0);
      } else {
        if (attendance.status !== "Late") {
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
        message: "Check Out Successfully",
        data: attendance,
      });
    }

    // ===============================
    // 3. Second Check-In
    // ===============================
    if (
      attendance.firstinTime &&
      attendance.firstoutTime &&
      !attendance.secondinTime
    ) {
      const lateResult = calculateLateCheckIn(
        shiftData.secondinTime,
        currentTime
      );

      attendance.secondinTime = currentTime;

      if (lateResult.isLate) {
        attendance.status = "Late";
      } else {
        attendance.status = "Checked In";
      }

      // Apply second check-in deduction to secondworkingHours
      const secondLateDeduction = lateResult.isLate ? (lateResult.workingHours || 0) : 0;
      attendance.secondworkingHours = (attendance.secondworkingHours || 0) + secondLateDeduction;

      // If firstworkingHours or secondworkingHours < 0, do not add negative to workingHours
      const s1 = (attendance.firstworkingHours && attendance.firstworkingHours > 0) ? attendance.firstworkingHours : 0;
      const s2 = (attendance.secondworkingHours && attendance.secondworkingHours > 0) ? attendance.secondworkingHours : 0;
      attendance.workingHours = s1 + s2;

      await attendance.save();

      return res.status(200).json({
        success: true,
        message: "Check In Successfully",
        data: attendance,
      });
    }

    // ===============================
    // 4. Second Check-Out
    // ===============================
    if (
      attendance.firstinTime &&
      attendance.firstoutTime &&
      attendance.secondinTime &&
      !attendance.secondoutTime
    ) {
      const earlyResult = calculateEarlyCheckOut(
        shiftData.secondoutTime,
        currentTime
      );

      const secondWorkHour = Number(shiftData.secondworkhour) || 0;

      attendance.secondoutTime = currentTime;

      let secondHours = (attendance.secondworkingHours || 0) + secondWorkHour;

      // Apply early checkout deduction
      if (earlyResult.isEarly) {
        attendance.status = "Early Exit";
        secondHours += (earlyResult.workingHours || 0);
      } else {
        if (attendance.status !== "Late") {
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
        message: "Check Out Successfully",
        data: attendance,
      });
    }

    // ===============================
    // 5. Attendance Completed
    // ===============================
    return res.status(200).json({
      success: false,
      message: "Attendance Already Completed",
      data: attendance,
    });

  } catch (error) {
    console.error("Error in newAttendance:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to record attendance",
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
  newAttendance
};
