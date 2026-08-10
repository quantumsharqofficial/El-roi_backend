const Attendance = require("../models/attendanceModel");
const Employee = require("../models/employeeModel");

// 1. Mark attendance endpoint (handles both check-in and check-out automatically)
const markAttendance = async (req, res) => {
  try {
    const { employee_ID } = req.body;

    if (!employee_ID) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }

    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const currentTime = now.toTimeString().split(" ")[0].slice(0, 5);

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
      await attendance.save();
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
        message:"Check-in successful",
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
    const { employee_ID, name, date, checkInTime } = req.body;

    if (!employee_ID || !date) {
      return res
        .status(400)
        .json({ error: "employee_ID and date are required" });
    }

    const targetDate = new Date(date);
    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(targetDate);
    end.setHours(23, 59, 59, 999);

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
      checkInTime:
        checkInTime || new Date().toTimeString().split(" ")[0].slice(0, 5),
      status: "Present",
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
    const { employee_ID, date, checkOutTime } = req.body;

    if (!employee_ID || !date) {
      return res
        .status(400)
        .json({ error: "employee_ID and date are required" });
    }

    const targetDate = new Date(date);
    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(targetDate);
    end.setHours(23, 59, 59, 999);

    let attendance = await Attendance.findOne({
      employee_ID,
      date: { $gte: start, $lte: end },
    });

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

    if (attendance.checkOutTime) {
      return res
        .status(400)
        .json({ error: "Check-out already recorded for this date." });
    }

    const timeToSet =
      checkOutTime || new Date().toTimeString().split(" ")[0].slice(0, 5);

    if (typeof attendance.save === "function") {
      attendance.checkOutTime = timeToSet;
      await attendance.save();
    } else {
      await Attendance.findByIdAndUpdate(attendance._id, {
        checkOutTime: timeToSet,
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
    const records = await Attendance.find({ employee_ID: employeeID });
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
    const targetDate = new Date(date);
    if (isNaN(targetDate)) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(targetDate);
    end.setHours(23, 59, 59, 999);

    const records = await Attendance.find({
      date: { $gte: start, $lte: end },
    });

    if (records.length === 0) {
      return res
        .status(404)
        .json({ error: "No attendance records found for this date" });
    }

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

    const targetDate = new Date(date);
    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(targetDate);
    end.setHours(23, 59, 59, 999);

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

module.exports = {
  markAttendance,
  checkIn,
  checkOut,
  getEmployee,
  getAttendanceByDate,
  getByDateAndEmploueeId,
};
