const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

let isConnected = false;
let useMock = false;

const dataDir = path.join(__dirname, "../data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Simple JSON database Mock Model implementation
class MockModel {
  constructor(name) {
    this.name = name;
    this.filePath = path.join(dataDir, `${name}.json`);
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify([], null, 2));
    }
  }

  read() {
    try {
      const content = fs.readFileSync(this.filePath, "utf8");
      return JSON.parse(content);
    } catch (e) {
      return [];
    }
  }

  write(data) {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
  }

  async find(query = {}) {
    let data = this.read();
    return data.filter((item) => {
      for (let key in query) {
        if (query[key] !== undefined) {
          // Handle nested object queries or regex
          if (query[key] instanceof RegExp) {
            if (!query[key].test(item[key])) return false;
          } else if (typeof query[key] === "object" && query[key] !== null) {
            // Support simple MongoDB operators like $gte, $lte
            const val = item[key];
            const q = query[key];
            if (q.$gte !== undefined && val < q.$gte) return false;
            if (q.$lte !== undefined && val > q.$lte) return false;
            if (q.$gt !== undefined && val <= q.$gt) return false;
            if (q.$lt !== undefined && val >= q.$lt) return false;
            if (q.$ne !== undefined && val === q.$ne) return false;
            if (
              q.$in !== undefined &&
              (!Array.isArray(q.$in) || !q.$in.includes(val))
            )
              return false;
          } else if (item[key] !== query[key]) {
            return false;
          }
        }
      }
      return true;
    });
  }

  async findOne(query = {}) {
    const items = await this.find(query);
    return items[0] || null;
  }

  async findById(id) {
    const items = this.read();
    return items.find((item) => item._id === id || item.id === id) || null;
  }

  async create(doc) {
    const items = this.read();
    const newDoc = {
      _id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...doc,
    };
    items.push(newDoc);
    this.write(items);
    return newDoc;
  }

  async findByIdAndUpdate(id, update, options = {}) {
    const items = this.read();
    const index = items.findIndex((item) => item._id === id || item.id === id);
    if (index === -1) return null;

    const fieldsToUpdate = update.$set ? { ...update.$set } : { ...update };

    // Clean operators
    for (let key in fieldsToUpdate) {
      if (key.startsWith("$")) delete fieldsToUpdate[key];
    }

    items[index] = {
      ...items[index],
      ...fieldsToUpdate,
      updatedAt: new Date().toISOString(),
    };
    this.write(items);
    return items[index];
  }

  async findByIdAndDelete(id) {
    const items = this.read();
    const index = items.findIndex((item) => item._id === id || item.id === id);
    if (index === -1) return null;
    const deleted = items[index];
    items.splice(index, 1);
    this.write(items);
    return deleted;
  }

  async countDocuments(query = {}) {
    const items = await this.find(query);
    return items.length;
  }
}

const dropStaleAttendanceIndex = async () => {
  const db = mongoose.connection.db;
  if (!db) return;

  try {
    const collection = db.collection("attendances");
    const indexes = await collection.indexes();
    if (indexes.some((index) => index.name === "attendance_ID_1")) {
      await collection.dropIndex("attendance_ID_1");
      console.log(
        "Dropped stale attendance_ID unique index from attendances collection.",
      );
    }
  } catch (err) {
    if (err.codeName && err.codeName === "IndexNotFound") {
      return;
    }
    console.error(
      "Error removing stale attendance_ID index:",
      err.message || err,
    );
  }
};

const connectDB = async () => {
  const mongoUri =
    process.env.MONGODB_URI ||
    "mongodb+srv://quantumsharqresource_db_user:hNMVM6lk65ickZlx@cluster0.ndm7dph.mongodb.net/ELroi-HRMS";

  try {
    // Attempt Mongoose connection with a 3-second timeout
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 3000,
    });
    isConnected = true;
    useMock = false;
    console.log("MongoDB connected successfully.");
    await dropStaleAttendanceIndex();
  } catch (err) {
    console.error(
      "MongoDB connection failed. Falling back to local JSON database storage.",
    );
    useMock = true;
    isConnected = false;
  }
};

const getModel = (name, schemaDefinition) => {
  if (useMock) {
    return new MockModel(name);
  }
  // Mongoose model fallback
  if (schemaDefinition instanceof mongoose.Schema) {
    return mongoose.models[name] || mongoose.model(name, schemaDefinition);
  }
  const schema = new mongoose.Schema(schemaDefinition, { timestamps: true });
  return mongoose.models[name] || mongoose.model(name, schema);
};

const port = "https://elroi.qsisphysio.com/api";

module.exports = {
  connectDB,
  getModel,
  isMock: () => useMock,
  port,
};
