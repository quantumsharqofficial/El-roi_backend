   const axios = require("axios");

async function testApprove() {
  const baseUrl = "http://localhost:5205/api";
  
  // 1. Get current leaves
  const leavesRes = await axios.get(`${baseUrl}/leaves`);
  const pending = leavesRes.data.find(l => l.status === "Pending HR");
  console.log("Pending leave found:", pending ? `${pending._id} (${pending.type})` : "none");

  if (pending) {
    // 2. Approve leave
    console.log("Approving leave...");
    const approveRes = await axios.put(`${baseUrl}/leaves/${pending._id}`, { status: "Approved" });
    console.log("Leave updated status:", approveRes.data.status);

    // 3. Fetch employee to verify balance deducted
    const empRes = await axios.get(`${baseUrl}/employees/${pending.employeeId || pending.employeeEID}`);
    console.log("Employee leave balances after approval:", JSON.stringify(empRes.data.leaveBalances, null, 2));

    // 4. Revert back to Pending HR to keep state clean
    await axios.put(`${baseUrl}/leaves/${pending._id}`, { status: "Pending HR" });
    console.log("Reverted leave back to Pending HR.");

    const empResAfterRevert = await axios.get(`${baseUrl}/employees/${pending.employeeId || pending.employeeEID}`);
    console.log("Employee leave balances after revert:", JSON.stringify(empResAfterRevert.data.leaveBalances, null, 2));
  }
}

testApprove().catch(console.error);
