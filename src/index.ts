// backend/user/src/index.ts

import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import { createClient } from "redis";
import userRoutes from "./route/user.js";
import { connectRabbitMQ } from "./config/rabbitmq.js";
import cors from "cors";
import cookieParser from "cookie-parser";

dotenv.config();

const app = express();
app.set("trust proxy", 1);

connectDB();
connectRabbitMQ();

/* -------------------- REDIS SETUP -------------------- */
export const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT || 6379),
    connectTimeout: 10000,
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        return new Error("Max reconnection attempts reached");
      }
      return Math.min(retries * 100, 3000);
    },
  },
  ...(process.env.REDIS_USER && { username: process.env.REDIS_USER }),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
});

redisClient.on("error", (err) => {
  console.error("❌ Redis Client Error:", err);
});

redisClient.on("reconnecting", () => {
  console.log("🔁 Redis reconnecting...");
});

redisClient
  .connect()
  .then(() => {
    console.log("✅ Connected to Redis");
  })
  .catch((err) => {
    console.error("❌ Redis connection error:", err);
  });

/* -------------------- CORS (CRITICAL) -------------------- */
app.use(
  cors({
    origin: [
      "https://dev.merrygit.tech",
      "https://www.merrygit.tech",
      "http://localhost:3000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/* -------------------- MIDDLEWARE -------------------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* -------------------- ROUTES -------------------- */
app.use("/api/v1/user", userRoutes);

app.get("/", (_req, res) => {
  res.status(200).json({ message: "Welcome to MerryGit user service" });
});

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

/* -------------------- SERVER -------------------- */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 User service running on port ${PORT}`);
});
