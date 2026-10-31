const HomeVisit = require("../models/homeVisitModel");
const Employee = require("../models/employeeModel");

// Format time string to 12-hour AM/PM if needed
const formatTime12 = (t) => {
  if (!t) return "";
  if (/am|pm/i.test(t)) return t.toUpperCase();
  const parts = t.split(":");
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1].padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return `${hours}:${minutes} ${ampm}`;
  }
  return t;
};

// Calculate Duration between two times
const calculateDuration = (startTime, endTime) => {
  if (!startTime || !endTime) return "";
  try {
    const parseMins = (t) => {
      let clean = t.trim();
      let isPM = /pm/i.test(clean);
      let isAM = /am/i.test(clean);
      clean = clean.replace(/am|pm/gi, "").trim();
      let [h, m] = clean.split(":").map(Number);
      if (isNaN(h)) return 0;
      if (isPM && h < 12) h += 12;
      if (isAM && h === 12) h = 0;
      return h * 60 + (m || 0);
    };
    const s = parseMins(startTime);
    const e = parseMins(endTime);
    let diff = e - s;
    if (diff < 0) diff += 24 * 60; // next day
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
    if (hrs > 0) return `${hrs}h`;
    return `${mins}m`;
  } catch (err) {
    return "";
  }
};

const SAMPLE_HOME_VISITS = [
  {
    employeeId: "EPC0042023",
    employeeName: "Abhijith Srinivas",
    patientName: "Abhijith Srinivas",
    date: new Date("2026-10-08T00:00:00.000+05:30"),
    day: "Sunday",
    startTime: "09:30 AM",
    endTime: "10:30 AM",
    duration: "1h 00m",
    pain: 8,
    diagnosis: "L4-L5 disc protrusion",
    prescription: "Ibuprofen 400mg, Paracetamol",
    modalities: "TENS, heat therapy, soft tissue mobilization",
    comments: "Patient has limited mobility. Recheck in 3 days.",
    place: "Anna Nagar, Chennai",
    address: "Plot 42, 2nd Avenue, Anna Nagar West, Chennai - 600040",
    latitude: 13.085,
    longitude: 80.21,
  },
  {
    employeeId: "EPC0192026",
    employeeName: "Sumesh D",
    patientName: "Sumesh D",
    date: new Date("2026-10-09T00:00:00.000+05:30"),
    day: "Monday",
    startTime: "11:00 AM",
    endTime: "12:15 PM",
    duration: "1h 15m",
    pain: 9,
    diagnosis: "Meniscus tear, partial",
    prescription: "Naproxen 250mg, compression bandage",
    modalities: "Ice pack, range of motion exercises",
    comments: "Progressing well with daily exercises.",
    place: "T Nagar, Chennai",
    address: "15, South Usman Rd, T. Nagar, Chennai - 600017",
    latitude: 13.0418,
    longitude: 80.2341,
  },
  {
    employeeId: "EPC0062023",
    employeeName: "Yoghendra G",
    patientName: "Yoghendra G",
    date: new Date("2026-10-11T00:00:00.000+05:30"),
    day: "Wednesday",
    startTime: "04:00 PM",
    endTime: "05:00 PM",
    duration: "1h 00m",
    pain: 6,
    diagnosis: "Frozen shoulder",
    prescription: "Diclofenac gel, anti-inflammatory meds",
    modalities: "Gentle stretching, ultrasound therapy",
    comments: "Increased mobility reported. Continuing exercises.",
    place: "Adyar, Chennai",
    address: "28, 1st Cross St, Gandhi Nagar, Adyar, Chennai - 600020",
    latitude: 13.0012,
    longitude: 80.2565,
  },
  {
    employeeId: "EPC2026",
    employeeName: "Kabilan A",
    patientName: "Kabilan A",
    date: new Date("2026-10-12T00:00:00.000+05:30"),
    day: "Thursday",
    startTime: "10:00 AM",
    endTime: "11:00 AM",
    duration: "1h 00m",
    pain: 7,
    diagnosis: "Grade 2 wrist sprain",
    prescription: "Wrist splint, ice pack application",
    modalities: "Hot/cold packs, manual therapy",
    comments: "Pain reduced, swelling decreasing.",
    place: "Velachery, Chennai",
    address: "8, 100 Feet Bypass Rd, Velachery, Chennai - 600042",
    latitude: 12.9815,
    longitude: 80.218,
  },
  {
    employeeId: "EPC0172026",
    employeeName: "Shahira Farveen S",
    patientName: "Shahira Farveen S",
    date: new Date("2026-10-14T00:00:00.000+05:30"),
    day: "Saturday",
    startTime: "02:30 PM",
    endTime: "03:45 PM",
    duration: "1h 15m",
    pain: 9,
    diagnosis: "ACL reconstruction, post-op",
    prescription: "Painkillers as prescribed by surgeon",
    modalities: "Knee brace, limited weight-bearing exercises",
    comments: "High pain level, following up with surgeon.",
    place: "Mylapore, Chennai",
    address: "14, Kutchery Rd, Mylapore, Chennai - 600004",
    latitude: 13.0339,
    longitude: 80.2676,
  },
  {
    employeeId: "EPC0192026",
    employeeName: "Sumesh D",
    patientName: "Sumesh D",
    date: new Date("2026-10-15T00:00:00.000+05:30"),
    day: "Monday",
    startTime: "09:00 AM",
    endTime: "10:00 AM",
    duration: "1h 00m",
    pain: 6,
    diagnosis: "ACL reconstruction, partial",
    prescription: "Naproxen 250mg, compression bandage",
    modalities: "TENS, heat therapy, ultrasound therapy",
    comments: "Progressing well with daily exercises.",
    place: "Nungambakkam, Chennai",
    address: "21, College Rd, Nungambakkam, Chennai - 600006",
    latitude: 13.0626,
    longitude: 80.2425,
  },
  {
    employeeId: "EPC0062023",
    employeeName: "Yoghendra G",
    patientName: "Yoghendra G",
    date: new Date("2026-10-16T00:00:00.000+05:30"),
    day: "Thursday",
    startTime: "10:15 AM",
    endTime: "11:15 AM",
    duration: "1h 00m",
    pain: 8,
    diagnosis: "Frozen shoulder",
    prescription: "Naproxen 250mg, compression bandage",
    modalities: "Ice pack, range of motion exercises",
    comments: "Patient has limited mobility. Recheck in 3 days.",
    place: "Kilpauk, Chennai",
    address: "33, Ormes Rd, Kilpauk, Chennai - 600010",
    latitude: 13.0818,
    longitude: 80.2412,
  },
  {
    employeeId: "EPC2026",
    employeeName: "Kabilan A",
    patientName: "Kabilan A",
    date: new Date("2026-10-22T00:00:00.000+05:30"),
    day: "Saturday",
    startTime: "11:30 AM",
    endTime: "12:30 PM",
    duration: "1h 00m",
    pain: 7,
    diagnosis: "Meniscus tear, partial",
    prescription: "Painkillers as prescribed by surgeon",
    modalities: "Knee brace, limited weight-bearing exercises",
    comments: "Patient has limited mobility. Recheck in 3 days.",
    place: "Guindy, Chennai",
    address: "5, Race Course Rd, Guindy, Chennai - 600032",
    latitude: 13.0067,
    longitude: 80.2025,
  },
  {
    employeeId: "EPC0042023",
    employeeName: "Abhijith Srinivas",
    patientName: "Abhijith Srinivas",
    date: new Date("2026-10-24T00:00:00.000+05:30"),
    day: "Monday",
    startTime: "05:00 PM",
    endTime: "06:00 PM",
    duration: "1h 00m",
    pain: 7,
    diagnosis: "L4-L5 protrusion",
    prescription: "Ibuprofen 400mg, Paracetamol",
    modalities: "TENS, heat therapy, soft tissue mobilization",
    comments: "Patient has limited mobility. Recheck in 3 days.",
    place: "Anna Nagar, Chennai",
    address: "Plot 42, 2nd Avenue, Anna Nagar West, Chennai - 600040",
    latitude: 13.085,
    longitude: 80.21,
  },
];

// Seed initial data or update initial samples with start/end time if missing
const ensureSeedData = async () => {
  try {
    const count = await HomeVisit.countDocuments();
    if (count === 0) {
      await HomeVisit.insertMany(SAMPLE_HOME_VISITS);
    } else {
      // Update any record missing startTime or place
      const missingTime = await HomeVisit.find({
        $or: [{ startTime: { $exists: false } }, { startTime: "" }],
      });
      for (const item of missingTime) {
        item.startTime = "10:00 AM";
        item.endTime = "11:00 AM";
        item.duration = "1h 00m";
        if (!item.place) item.place = "Home Visit";
        await item.save();
      }
    }
  } catch (err) {
    console.warn("Could not check/seed HomeVisits:", err.message);
  }
};

// 1. Create a Home Visit (Employee or Admin entry)
const createHomeVisit = async (req, res) => {
  try {
    const {
      employeeId,
      employeeName,
      date,
      day,
      startTime,
      endTime,
      duration,
      patientName,
      pain,
      diagnosis,
      prescription,
      modalities,
      comments,
      place,
      address,
      latitude,
      longitude,
      gpsAccuracy,
    } = req.body;

    if (!patientName) {
      return res.status(400).json({
        success: false,
        message: "Patient Name is required",
      });
    }

    const visitDate = date ? new Date(date) : new Date();
    const calculatedDay =
      day ||
      visitDate.toLocaleDateString("en-US", {
        weekday: "long",
        timeZone: "Asia/Kolkata",
      });

    let resolvedEmpName = employeeName || "";
    let resolvedEmpId = employeeId || "";

    if (!resolvedEmpName && resolvedEmpId) {
      const emp = await Employee.findOne({
        $or: [{ employeeId: resolvedEmpId }, { _id: resolvedEmpId }],
      }).lean();
      if (emp) {
        resolvedEmpName =
          emp.name ||
          `${emp.firstName || ""} ${emp.lastName || ""}`.trim() ||
          resolvedEmpId;
      }
    }

    const formattedStart = formatTime12(startTime);
    const formattedEnd = formatTime12(endTime);
    const calculatedDuration =
      duration || calculateDuration(formattedStart, formattedEnd) || "1h";

    const newVisit = new HomeVisit({
      employeeId: resolvedEmpId || "EMP-DEFAULT",
      employeeName: resolvedEmpName || patientName,
      date: visitDate,
      day: calculatedDay,
      startTime: formattedStart,
      endTime: formattedEnd,
      duration: calculatedDuration,
      patientName: patientName.trim(),
      pain: Number(pain) || 0,
      diagnosis: diagnosis || "",
      prescription: prescription || "",
      modalities: modalities || "",
      comments: comments || "",
      place: place || (address ? address.split(",")[0] : "Home Visit"),
      address: address || "",
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      gpsAccuracy: gpsAccuracy ? Number(gpsAccuracy) : null,
      status: "Completed",
    });

    const saved = await newVisit.save();

    return res.status(201).json({
      success: true,
      message: "Home visit logged successfully",
      data: saved,
    });
  } catch (error) {
    console.error("Error creating home visit:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create home visit",
      error: error.message,
    });
  }
};

// 2. Get All Home Visits (with date, month, and employee filters)
const getAllHomeVisits = async (req, res) => {
  try {
    await ensureSeedData();

    const { date, month, employeeId, search } = req.query;
    const query = {};

    // Specific Date filter (Daily Log View)
    if (date && /^\d{4}-\d{2}-\d{2}/.test(date.trim())) {
      const dateStr = date.trim().split("T")[0];
      const startUTC = new Date(`${dateStr}T00:00:00.000Z`);
      const endUTC = new Date(`${dateStr}T23:59:59.999Z`);
      const startIST = new Date(`${dateStr}T00:00:00.000+05:30`);
      const endIST = new Date(`${dateStr}T23:59:59.999+05:30`);

      const start = startIST < startUTC ? startIST : startUTC;
      const end = endIST > endUTC ? endIST : endUTC;

      query.date = { $gte: start, $lte: end };
    }
    // Month filter (Monthly Summary View)
    else if (month && /^\d{4}-\d{2}/.test(month.trim())) {
      const [yearStr, monthStr] = month.trim().split("-");
      const year = parseInt(yearStr, 10);
      const m = parseInt(monthStr, 10);
      const daysInMonth = new Date(year, m, 0).getDate();

      const startUTC = new Date(`${yearStr}-${monthStr}-01T00:00:00.000Z`);
      const endUTC = new Date(
        `${yearStr}-${monthStr}-${String(daysInMonth).padStart(2, "0")}T23:59:59.999Z`
      );
      const startIST = new Date(`${yearStr}-${monthStr}-01T00:00:00.000+05:30`);
      const endIST = new Date(
        `${yearStr}-${monthStr}-${String(daysInMonth).padStart(2, "0")}T23:59:59.999+05:30`
      );

      const start = startIST < startUTC ? startIST : startUTC;
      const end = endIST > endUTC ? endIST : endUTC;

      query.date = { $gte: start, $lte: end };
    }

    if (employeeId) {
      query.$or = [
        { employeeId: employeeId.trim() },
        { employeeName: new RegExp(employeeId.trim(), "i") },
      ];
    }

    if (search) {
      const s = search.trim();
      const searchOr = [
        { patientName: new RegExp(s, "i") },
        { diagnosis: new RegExp(s, "i") },
        { prescription: new RegExp(s, "i") },
        { modalities: new RegExp(s, "i") },
        { comments: new RegExp(s, "i") },
        { employeeName: new RegExp(s, "i") },
        { place: new RegExp(s, "i") },
        { address: new RegExp(s, "i") },
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchOr }];
        delete query.$or;
      } else {
        query.$or = searchOr;
      }
    }

    const visits = await HomeVisit.find(query).sort({ date: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: visits.length,
      data: visits,
    });
  } catch (error) {
    console.error("Error fetching home visits:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch home visits",
      error: error.message,
    });
  }
};

// 3. Get Home Visits for a specific employee (supports daily & monthly)
const getHomeVisitsByEmployee = async (req, res) => {
  try {
    await ensureSeedData();

    const employeeId = req.params.employeeId || req.query.employeeId;
    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }

    const { date, month, search } = req.query;
    const query = {
      $or: [
        { employeeId: employeeId.trim() },
        { employeeName: new RegExp(employeeId.trim(), "i") },
      ],
    };

    if (date && /^\d{4}-\d{2}-\d{2}/.test(date.trim())) {
      const dateStr = date.trim().split("T")[0];
      const startUTC = new Date(`${dateStr}T00:00:00.000Z`);
      const endUTC = new Date(`${dateStr}T23:59:59.999Z`);
      const startIST = new Date(`${dateStr}T00:00:00.000+05:30`);
      const endIST = new Date(`${dateStr}T23:59:59.999+05:30`);
      const start = startIST < startUTC ? startIST : startUTC;
      const end = endIST > endUTC ? endIST : endUTC;
      query.date = { $gte: start, $lte: end };
    } else if (month && /^\d{4}-\d{2}/.test(month.trim())) {
      const [yearStr, monthStr] = month.trim().split("-");
      const year = parseInt(yearStr, 10);
      const m = parseInt(monthStr, 10);
      const daysInMonth = new Date(year, m, 0).getDate();

      const start = new Date(`${yearStr}-${monthStr}-01T00:00:00.000Z`);
      const end = new Date(
        `${yearStr}-${monthStr}-${String(daysInMonth).padStart(2, "0")}T23:59:59.999Z`
      );
      query.date = { $gte: start, $lte: end };
    }

    if (search) {
      const s = search.trim();
      const searchOr = [
        { patientName: new RegExp(s, "i") },
        { diagnosis: new RegExp(s, "i") },
        { prescription: new RegExp(s, "i") },
        { modalities: new RegExp(s, "i") },
        { comments: new RegExp(s, "i") },
        { place: new RegExp(s, "i") },
        { address: new RegExp(s, "i") },
      ];
      query.$and = [{ $or: query.$or }, { $or: searchOr }];
      delete query.$or;
    }

    const visits = await HomeVisit.find(query).sort({ date: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: visits.length,
      data: visits,
    });
  } catch (error) {
    console.error("Error fetching employee home visits:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch employee home visits",
      error: error.message,
    });
  }
};

// 4. Monthly Summary Aggregation Endpoint
const getHomeVisitMonthlySummary = async (req, res) => {
  try {
    await ensureSeedData();

    const rawMonth = req.query.month || new Date().toISOString().slice(0, 7);
    const [yearStr, monthStr] = rawMonth.split("-");
    const year = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, m, 0).getDate();

    const startUTC = new Date(`${yearStr}-${monthStr}-01T00:00:00.000Z`);
    const endUTC = new Date(
      `${yearStr}-${monthStr}-${String(daysInMonth).padStart(2, "0")}T23:59:59.999Z`
    );
    const startIST = new Date(`${yearStr}-${monthStr}-01T00:00:00.000+05:30`);
    const endIST = new Date(
      `${yearStr}-${monthStr}-${String(daysInMonth).padStart(2, "0")}T23:59:59.999+05:30`
    );
    const start = startIST < startUTC ? startIST : startUTC;
    const end = endIST > endUTC ? endIST : endUTC;

    const [employees, allVisits] = await Promise.all([
      Employee.find().lean(),
      HomeVisit.find({ date: { $gte: start, $lte: end } }).sort({ date: -1 }).lean(),
    ]);

    // Group visits by employee
    const summaryList = employees.map((emp) => {
      const matchIds = [
        emp.employeeId,
        emp._id ? emp._id.toString() : null,
        emp.id ? emp.id.toString() : null,
      ].filter(Boolean);

      const empName = [emp.firstName, emp.lastName].filter(Boolean).join(" ") || emp.name || emp.employeeId;
      const lowerEmpName = empName.toLowerCase().trim();

      const empVisits = allVisits.filter((v) => {
        const vEmpId = String(v.employeeId || "").trim();
        const vEmpName = String(v.employeeName || "").trim().toLowerCase();
        return matchIds.includes(vEmpId) || (vEmpName && vEmpName === lowerEmpName);
      });

      const uniquePatients = new Set(empVisits.map((v) => v.patientName?.trim()).filter(Boolean)).size;
      const avgPain =
        empVisits.length > 0
          ? (
              empVisits.reduce((acc, curr) => acc + (Number(curr.pain) || 0), 0) /
              empVisits.length
            ).toFixed(1)
          : 0;

      return {
        _id: emp._id,
        employeeId: emp.employeeId,
        name: empName,
        designation: emp.designation || "Physiotherapist",
        department: emp.department || "Clinical",
        profilePhoto: emp.profilePhoto || null,
        totalVisits: empVisits.length,
        uniquePatients,
        avgPain: Number(avgPain),
        lastVisitDate: empVisits[0]?.date || null,
        visits: empVisits,
      };
    });

    return res.status(200).json({
      success: true,
      month: rawMonth,
      monthName: new Date(year, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      totalVisits: allVisits.length,
      summaries: summaryList,
      allVisits,
    });
  } catch (error) {
    console.error("Error in getHomeVisitMonthlySummary:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate home visit monthly summary",
      error: error.message,
    });
  }
};

// 5. Delete Home Visit
const deleteHomeVisit = async (req, res) => {
  try {
    const { id } = req.params;
    await HomeVisit.findByIdAndDelete(id);
    return res.status(200).json({
      success: true,
      message: "Home visit deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete home visit",
      error: error.message,
    });
  }
};

module.exports = {
  createHomeVisit,
  getAllHomeVisits,
  getHomeVisitsByEmployee,
  getHomeVisitMonthlySummary,
  deleteHomeVisit,
};
