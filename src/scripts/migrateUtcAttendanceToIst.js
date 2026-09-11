const mongoose = require("mongoose");
require("dotenv").config();

const uri = process.env.MONGODB_URI || "mongodb+srv://quantumsharqresource_db_user:hNMVM6lk65ickZlx@cluster0.ndm7dph.mongodb.net/ELroi-HRMS";

const getISTTimeString = (date) => {
  return new Date(date).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const getISTDateString = (date) => {
  return new Date(date).toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });
};

const shiftUtcTimeToIst = (utcTimeStr) => {
  if (!utcTimeStr || typeof utcTimeStr !== "string") return utcTimeStr;
  const match = utcTimeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return utcTimeStr;

  let hrs = parseInt(match[1], 10);
  let mins = parseInt(match[2], 10);

  // Add 5 hours and 30 minutes
  mins += 30;
  hrs += 5;
  if (mins >= 60) {
    mins -= 60;
    hrs += 1;
  }
  hrs = hrs % 24;

  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
};

async function migrate() {
  console.log("Connecting to database...");
  await mongoose.connect(uri);
  console.log("Connected to MongoDB.");

  const collection = mongoose.connection.collection("attendances");
  const records = await collection.find({}).toArray();
  console.log(`Total attendance records found: ${records.length}`);

  let updatedCount = 0;

  for (const doc of records) {
    const updates = {};

    if (doc.createdAt) {
      const createdDate = new Date(doc.createdAt);
      const istCheckIn = getISTTimeString(createdDate);

      // Check UTC time of createdAt
      const utcHrs = createdDate.getUTCHours().toString().padStart(2, "0");
      const utcMins = createdDate.getUTCMinutes().toString().padStart(2, "0");
      const utcTimeString = `${utcHrs}:${utcMins}`;

      // If checkInTime equals the UTC time of createdAt, it was clearly recorded in UTC
      if (doc.checkInTime && doc.checkInTime.trim() === utcTimeString) {
        updates.checkInTime = istCheckIn;
      }
    }

    // Check checkOutTime
    if (doc.checkOutTime && typeof doc.checkOutTime === "string" && /^\d{1,2}:\d{2}$/.test(doc.checkOutTime.trim())) {
      // If doc.updatedAt exists and matches UTC of checkOutTime
      if (doc.updatedAt) {
        const updatedDate = new Date(doc.updatedAt);
        const utcHrs = updatedDate.getUTCHours().toString().padStart(2, "0");
        const utcMins = updatedDate.getUTCMinutes().toString().padStart(2, "0");
        const utcTimeString = `${utcHrs}:${utcMins}`;

        if (doc.checkOutTime.trim() === utcTimeString) {
          updates.checkOutTime = getISTTimeString(updatedDate);
        }
      }

      // If checkOutTime wasn't updated yet, check if checkIn was updated to IST and checkOut is less than checkIn or early UTC
      if (!updates.checkOutTime && updates.checkInTime) {
        // e.g., checkIn was 04:30 (now 10:00), checkOut was 05:15 (should be 10:45)
        const oldCheckInParts = doc.checkInTime.split(":").map(Number);
        const checkOutParts = doc.checkOutTime.split(":").map(Number);
        const oldCheckInMins = oldCheckInParts[0] * 60 + oldCheckInParts[1];
        const checkOutMins = checkOutParts[0] * 60 + checkOutParts[1];

        // If checkOut is within a normal shift after old UTC checkIn, it was recorded in UTC too
        if (checkOutMins >= oldCheckInMins && checkOutMins - oldCheckInMins < 16 * 60) {
          updates.checkOutTime = shiftUtcTimeToIst(doc.checkOutTime);
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      await collection.updateOne({ _id: doc._id }, { $set: updates });
      updatedCount++;
    }
  }

  console.log(`Migration complete. Successfully updated ${updatedCount} records to IST.`);
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
