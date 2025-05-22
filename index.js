require("dotenv").config();
const express = require("express");
// const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const { connect } = require("http2");
const app = express();
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const taskRoutes = require("./routes/taskRoutes");
const reportRoutes = require("./routes/reportRoutes");// app.use(express.urlencoded({ extended: true }));

// cors setup
app.use(cors(
    {
        origin: process.env.CLIENT_URL || "*",
        methods: ["GET",  "PUT", "POST", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);
// middleware
app.use(express.json());

connectDB();

// routes
app.use("/uploads",express.static(path.join(__dirname,"uploads")))
app.use("/api/auth", authRoutes);
app.use("/api/users",userRoutes);
app.use("/api/tasks",taskRoutes);
app.use("api/reports",reportRoutes);




// start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


app.get("/", (req, res) => {
    res.send("API is running...");
});