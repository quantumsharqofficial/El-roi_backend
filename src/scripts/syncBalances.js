const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI || "mongodb+srv://quantumsharqresource_db_user:hNMVM6lk65ickZlx@cluster0.ndm7dph.mongodb.net/ELroi-HRMS";

async function run() {
  await mongoose.connect(uri);
  const emp = await mongoose.connection.collection('employees').findOne({ employeeId: '1234s' });
  if (emp) {
    const balances = [
      { leaveType: "Paid Annual Leave", allowedDays: 12, takenLeaves: 4 },
      { leaveType: "Sick Leave", allowedDays: 12, takenLeaves: 0 },
      { leaveType: "Casual Leave", allowedDays: 12, takenLeaves: 3 },
    ];
    await mongoose.connection.collection('employees').updateOne(
      { _id: emp._id },
      { $set: { leaveBalances: balances } }
    );
    console.log("Successfully synced sakthi test leave balances:", balances);
  }
  await mongoose.disconnect();
}

run().catch(console.error);
