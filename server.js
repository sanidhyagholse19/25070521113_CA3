const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");

const app = express();
const port = process.env.PORT || 5000;
const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const dbName = process.env.DB_NAME || "sitSecB";
const JWT_SECRET = process.env.JWT_SECRET || "MY_SECRET_TOKEN";

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let client = null;
let myDb = null;
let isMongoConnected = false;

// Fallback in-memory storage if MongoDB is temporarily unavailable or starting up
let inMemoryStudents = [
  {
    _id: "671e01a1f0a1234567890001",
    name: "Aarav Sharma",
    age: 21,
    status: "Active",
    email: "aarav.sharma@sit.edu",
    password: "$2b$10$3nEWWEBaiF2OxnKW3/cRmuzqJMvnvlxDt8kQAIILkag1jSpXng0b6", // "password123"
    createdAt: new Date("2026-10-15T10:00:00Z")
  },
  {
    _id: "671e01a1f0a1234567890002",
    name: "Diya Patel",
    age: 20,
    status: "Active",
    email: "diya.patel@sit.edu",
    password: "$2b$10$3nEWWEBaiF2OxnKW3/cRmuzqJMvnvlxDt8kQAIILkag1jSpXng0b6",
    createdAt: new Date("2026-10-16T11:30:00Z")
  },
  {
    _id: "671e01a1f0a1234567890003",
    name: "Rohan Verma",
    age: 22,
    status: "Graduated",
    email: "rohan.verma@sit.edu",
    password: "$2b$10$3nEWWEBaiF2OxnKW3/cRmuzqJMvnvlxDt8kQAIILkag1jSpXng0b6",
    createdAt: new Date("2026-10-17T09:15:00Z")
  },
  {
    _id: "671e01a1f0a1234567890004",
    name: "Ananya Iyer",
    age: 21,
    status: "Inactive",
    email: "ananya.iyer@sit.edu",
    password: "$2b$10$3nEWWEBaiF2OxnKW3/cRmuzqJMvnvlxDt8kQAIILkag1jSpXng0b6",
    createdAt: new Date("2026-10-18T14:45:00Z")
  }
];

// Asynchronous MongoDB Connection Manager
async function connectToMongoDb() {
  try {
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 2500 });
    await client.connect();
    myDb = client.db(dbName);
    isMongoConnected = true;
    console.log(`[MongoDB] Connection successfully established with MongoDB at ${uri} (db: ${dbName})`);

    // Ensure sample documents exist if collection is empty
    try {
      const count = await myDb.collection("student").countDocuments();
      if (count === 0) {
        console.log("[MongoDB] Collection 'student' is empty. Seeding initial student records...");
        await seedDatabase();
      }
    } catch (e) {
      console.log("[MongoDB] Count check warning:", e.message);
    }
  } catch (error) {
    isMongoConnected = false;
    console.log("[MongoDB] Warning: Could not connect to MongoDB server:", error.message);
    console.log("[MongoDB] Defaulting to safe in-memory fallback. Server will remain responsive!");
  }
}

async function seedDatabase() {
  if (!myDb) return;
  const hashedPass = await bcrypt.hash("password123", 10);
  const sampleStudents = [
    {
      name: "Aarav Sharma",
      age: 21,
      status: "Active",
      email: "aarav.sharma@sit.edu",
      password: hashedPass,
      createdAt: new Date()
    },
    {
      name: "Diya Patel",
      age: 20,
      status: "Active",
      email: "diya.patel@sit.edu",
      password: hashedPass,
      createdAt: new Date()
    },
    {
      name: "Rohan Verma",
      age: 22,
      status: "Graduated",
      email: "rohan.verma@sit.edu",
      password: hashedPass,
      createdAt: new Date()
    },
    {
      name: "Ananya Iyer",
      age: 21,
      status: "Inactive",
      email: "ananya.iyer@sit.edu",
      password: hashedPass,
      createdAt: new Date()
    }
  ];
  await myDb.collection("student").insertMany(sampleStudents);
  console.log("[MongoDB] Seeded 4 default students into collection 'student'.");
}

// System Health & Diagnostics endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    mongoConnected: isMongoConnected,
    database: dbName,
    collection: "student",
    uri: uri.replace(/:\/\/.*@/, "://***@"), // Hide credentials if any
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Seed endpoint for testing / demo
app.post("/api/seed", async (req, res) => {
  try {
    if (isMongoConnected && myDb) {
      await seedDatabase();
      const all = await myDb.collection("student").find().toArray();
      return res.json({ msg: "Database seeded successfully", count: all.length, data: all });
    } else {
      return res.json({ msg: "In-memory seeded", count: inMemoryStudents.length, data: inMemoryStudents });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 1. GET ALL STUDENTS
// Exact route from sir: /getall
app.get("/getall", async (req, res) => {
  try {
    if (isMongoConnected && myDb) {
      const data = await myDb.collection("student").find().toArray();
      return res.send(data);
    }
    // In-memory fallback
    res.send(inMemoryStudents);
  } catch (error) {
    console.error("Error in /getall:", error);
    res.status(500).send({ error: "Failed to fetch students", details: error.message });
  }
});

// Also alias /api/students
app.get("/api/students", async (req, res) => {
  if (isMongoConnected && myDb) {
    const data = await myDb.collection("student").find().toArray();
    return res.json(data);
  }
  res.json(inMemoryStudents);
});

// 2. GET SINGLE STUDENT BY ID
// Exact route from sir: /get/:id
app.get("/get/:id", async (req, res) => {
  const id = req.params.id;

  try {
    if (isMongoConnected && myDb) {
      let query = {};
      if (ObjectId.isValid(id)) {
        query = { _id: new ObjectId(id) };
      } else {
        query = { _id: id };
      }
      const student = await myDb.collection("student").findOne(query);
      if (!student) {
        return res.status(404).send({ msg: "Student not found" });
      }
      return res.send(student);
    }

    const student = inMemoryStudents.find((s) => String(s._id) === id);
    if (!student) {
      return res.status(404).send({ msg: "Student not found" });
    }
    res.send(student);
  } catch (error) {
    console.error("Error in /get/:id:", error);
    res.status(500).send({ error: "Failed to get student", details: error.message });
  }
});

// 3. CREATE / REGISTER STUDENT
// Exact route from sir: /create
app.post("/create", async (req, res) => {
  console.log("Create Student request payload:", req.body);
  const { name, age, status, password, email } = req.body;

  if (!name || !email || !password) {
    return res.status(400).send({ msg: "Name, email, and password are required" });
  }

  try {
    const hashedPass = await bcrypt.hash(password, 10);
    const newStudent = {
      name,
      age: Number(age) || 18,
      status: status || "Active",
      password: hashedPass,
      email,
      createdAt: new Date()
    };

    if (isMongoConnected && myDb) {
      // Check for duplicate email
      const existing = await myDb.collection("student").findOne({ email });
      if (existing) {
        return res.status(400).send({ msg: "Email already registered" });
      }

      const response = await myDb.collection("student").insertOne(newStudent);
      return res.send({
        ...response,
        student: { ...newStudent, _id: response.insertedId, password: "[PROTECTED]" }
      });
    }

    // In-memory fallback
    const mockId = new ObjectId().toString();
    const mockStudent = { ...newStudent, _id: mockId };
    inMemoryStudents.push(mockStudent);
    res.send({
      acknowledged: true,
      insertedId: mockId,
      student: { ...mockStudent, password: "[PROTECTED]" }
    });
  } catch (error) {
    console.error("Error in /create:", error);
    res.status(500).send({ error: "Failed to create student", details: error.message });
  }
});

// 4. LOGIN AUTHENTICATION (Supports 1st: Student & 2nd: Administrator)
// Exact route from sir: /login
app.post("/login", async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password) {
    return res.status(400).send({ msg: "Email and password are required" });
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    const isExplicitAdmin = role === "admin" || role === "administrator" || normalizedEmail === "admin@sit.edu" || normalizedEmail === "administrator@sit.edu";

    // 1. Check Administrator Credentials
    if (isExplicitAdmin) {
      // Default institutional administrator credentials
      if ((normalizedEmail === "admin@sit.edu" || normalizedEmail === "administrator@sit.edu") && password === "admin123") {
        const payLoad = {
          subject: "System Administrator",
          role: "Administrator",
          email: normalizedEmail,
          id: "admin-root-001"
        };

        const token = jwt.sign(payLoad, JWT_SECRET, { expiresIn: "7d" });

        return res.send({
          jwtToken: token,
          user: {
            id: "admin-root-001",
            name: "System Administrator",
            email: normalizedEmail,
            role: "Administrator",
            status: "Administrator"
          }
        });
      }

      // Check if admin is stored in MongoDB collection
      if (isMongoConnected && myDb) {
        const adminDoc = await myDb.collection("student").findOne({
          email: normalizedEmail,
          status: { $regex: /admin/i }
        });

        if (adminDoc) {
          const isCorrect = await bcrypt.compare(password, adminDoc.password);
          if (isCorrect) {
            const payLoad = {
              subject: adminDoc.name,
              role: "Administrator",
              email: adminDoc.email,
              id: adminDoc._id
            };
            const token = jwt.sign(payLoad, JWT_SECRET, { expiresIn: "7d" });
            return res.send({
              jwtToken: token,
              user: {
                id: adminDoc._id,
                name: adminDoc.name,
                email: adminDoc.email,
                role: "Administrator",
                status: "Administrator"
              }
            });
          }
        }
      }

      if (role === "admin" || role === "administrator") {
        return res.status(401).send({ msg: "Invalid Administrator credentials. (Demo: admin@sit.edu / admin123)" });
      }
    }

    // 2. Student Authentication
    let student = null;

    if (isMongoConnected && myDb) {
      student = await myDb.collection("student").findOne({ email: normalizedEmail });
    } else {
      student = inMemoryStudents.find((s) => s.email.toLowerCase() === normalizedEmail);
    }

    if (student != null) {
      const isCorrect = await bcrypt.compare(password, student.password);

      if (isCorrect) {
        const isUserAdmin = student.status && student.status.toLowerCase().includes("admin");
        const resolvedRole = isUserAdmin ? "Administrator" : "Student";

        const payLoad = {
          subject: student.name,
          role: resolvedRole,
          email: student.email,
          id: student._id
        };

        const token = jwt.sign(payLoad, JWT_SECRET, { expiresIn: "7d" });

        return res.send({
          jwtToken: token,
          user: {
            id: student._id,
            name: student.name,
            email: student.email,
            age: student.age,
            role: resolvedRole,
            status: student.status
          }
        });
      } else {
        return res.status(401).send({ msg: "Invalid Password" });
      }
    } else {
      // Fixes the sir's bug: res.statusCode(422) crashed because statusCode is a property, not a method
      return res.status(422).send({ msg: "Invalid Email" });
    }
  } catch (error) {
    console.error("Error in /login:", error);
    res.status(500).send({ error: "Internal server error during login" });
  }
});

// 5. UPDATE STUDENT
// Exact route from sir: /update/:id
app.put("/update/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const { status, name, age, email } = req.body;
    const updateFields = {};
    if (status !== undefined) updateFields.status = status;
    if (name !== undefined) updateFields.name = name;
    if (age !== undefined) updateFields.age = Number(age);
    if (email !== undefined) updateFields.email = email;

    if (isMongoConnected && myDb) {
      let query = {};
      if (ObjectId.isValid(id)) {
        query = { _id: new ObjectId(id) };
      } else {
        query = { _id: id };
      }

      const student = await myDb.collection("student").findOne(query);

      if (student != null) {
        const response = await myDb.collection("student").updateOne(query, { $set: updateFields });
        return res.send(response);
      } else {
        return res.status(404).send({ msg: "Student Id Invalid" });
      }
    }

    // In-memory update
    const studentIndex = inMemoryStudents.findIndex((s) => String(s._id) === id);
    if (studentIndex !== -1) {
      inMemoryStudents[studentIndex] = { ...inMemoryStudents[studentIndex], ...updateFields };
      return res.send({ acknowledged: true, modifiedCount: 1 });
    } else {
      return res.status(404).send({ msg: "Student Id Invalid" });
    }
  } catch (error) {
    console.error("Error in /update/:id:", error);
    res.status(500).send({ error: "Failed to update student", details: error.message });
  }
});

// 6. DELETE STUDENT
// Exact route from sir: /delete/:id
app.delete("/delete/:id", async (req, res) => {
  const id = req.params.id;

  try {
    if (isMongoConnected && myDb) {
      let query = {};
      if (ObjectId.isValid(id)) {
        query = { _id: new ObjectId(id) };
      } else {
        query = { _id: id };
      }

      const response = await myDb.collection("student").deleteOne(query);
      return res.send(response);
    }

    // In-memory delete
    const initialLen = inMemoryStudents.length;
    inMemoryStudents = inMemoryStudents.filter((s) => String(s._id) !== id);
    const deleted = inMemoryStudents.length < initialLen;
    return res.send({ acknowledged: true, deletedCount: deleted ? 1 : 0 });
  } catch (error) {
    console.error("Error in /delete/:id:", error);
    res.status(500).send({ error: "Failed to delete student", details: error.message });
  }
});

// Connect to MongoDB and start HTTP Server
async function startServer() {
  await connectToMongoDb();

  app.listen(port, () => {
    console.log(`===============================================`);
    console.log(` SIT Sec-B Student Portal Server`);
    console.log(` Running on: http://localhost:${port}`);
    console.log(` MongoDB Connected: ${isMongoConnected}`);
    console.log(` Database: ${dbName} | Collection: student`);
    console.log(`===============================================`);
  });
}

startServer();

module.exports = app;
