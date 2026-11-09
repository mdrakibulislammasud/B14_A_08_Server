
import dns from "node:dns";

dns.setServers(["8.8.8.8", "8.8.4.4"]);


import "dotenv/config";

import express from "express";
import cors from "cors";
import { ObjectId } from "mongodb";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { toNodeHandler } from "better-auth/node";

import { auth } from "./auth.mjs";
import { connectDB, getCollections } from "./db.mjs";

const app = express();

// ---------------- CONFIGURATION ----------------

const strip = (value = "") =>
  String(value).trim().replace(/\/+$/, "");

const AUTH_URL = strip(
  process.env.BETTER_AUTH_URL || process.env.AUTH_URL
);

const ORIGINS = String(process.env.CLIENT_URL || "")
  .split(",")
  .map(strip)
  .filter(Boolean);

const PORT = Number(process.env.PORT) || 5000;

// ---------------- VALIDATE ENV ----------------

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI is missing in .env");
}

if (!process.env.DB_NAME) {
  throw new Error("DB_NAME is missing in .env");
}

if (!AUTH_URL) {
  throw new Error("BETTER_AUTH_URL is missing in .env");
}

// ---------------- CORS ----------------

app.use(cors({
  origin(origin, callback) {
    // Allow requests without an Origin header (e.g. server-to-server).
    if (!origin) {
      return callback(null, true);
    }

    // Only allow explicitly configured origins.
    if (ORIGINS.includes(strip(origin))) {
      return callback(null, true);
    }

    return callback(new Error("Origin not allowed by CORS"));
  },
  credentials: true
}));

// ---------------- DATABASE ----------------

// Reuse the shared MongoDB connection from db.mjs.

async function db() {
  return getCollections();
}

// ---------------- BETTER AUTH ----------------

// Mount Better Auth before express.json().

const authHandler = toNodeHandler(auth);

app.all("/api/auth/*", async (req, res, next) => {
  try {
    await connectDB();
    return await authHandler(req, res);
  } catch (error) {
    next(error);
  }
});

// ---------------- BODY PARSER ----------------

app.use(express.json({ limit: "1mb" }));

// ---------------- ASYNC WRAPPER ----------------

const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ---------------- JWT VERIFICATION ----------------

let jwks;

function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`${AUTH_URL}/api/auth/jwks`)
    );
  }

  return jwks;
}

async function verifyJWT(req, res, next) {
  const authorization = req.headers.authorization || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      message: "Please log in to continue."
    });
  }

  try {
    const { payload } = await jwtVerify(
      token,
      getJwks(),
      {
        issuer: AUTH_URL,
        audience: AUTH_URL
      }
    );

    if (!payload.email || typeof payload.email !== "string") {
      throw new Error("No valid email in JWT.");
    }

    req.user = {
      email: payload.email,
      name:
        typeof payload.name === "string" && payload.name.trim()
          ? payload.name.trim()
          : "Volunteer",
      image:
        typeof payload.image === "string"
          ? payload.image
          : ""
    };

    return next();

  } catch (error) {
    console.error("JWT verification failed:", error.message);

    return res.status(401).json({
      message: "Your session is invalid or expired. Log in again."
    });
  }
}

// ---------------- HELPERS ----------------

const today = () =>
  new Date().toISOString().slice(0, 10);

const validId = (id) =>
  typeof id === "string" &&
  /^[a-fA-F0-9]{24}$/.test(id);

const TYPES = [
  "Donation",
  "Cleanup",
  "Plantation",
  "Winter Relief",
  "Food Drive",
  "Health Camp",
  "Education",
  "Blood Drive"
];

const escapeRx = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isUrl = (value) => {
  try {
    const url = new URL(value);

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
  } catch {
    return false;
  }
};

// Validate a real YYYY-MM-DD calendar date.

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

// ---------------- EVENT VALIDATION ----------------

function cleanEvent(body = {}) {
  const e = {};

  for (const key of [
    "title",
    "description",
    "type",
    "thumbnail",
    "location",
    "date"
  ]) {
    e[key] = String(body[key] ?? "").trim();
  }

  const err =
    e.title.length < 5
      ? "Title needs at least 5 characters."
      : e.description.length < 20
      ? "Description needs at least 20 characters."
      : !TYPES.includes(e.type)
      ? "Choose a valid event type."
      : !isUrl(e.thumbnail)
      ? "Thumbnail must be a valid image URL."
      : !e.location
      ? "Location is required."
      : !isValidDate(e.date) || e.date <= today()
      ? "Event date must be a valid future date."
      : null;

  return { e, err };
}

// ---------------- HOME ----------------

app.get("/", (_req, res) => {
  res.json({
    message: "Neighbourly API is running."
  });
});

// ---------------- PUBLIC EVENTS ----------------

app.get("/events", wrap(async (req, res) => {
  const { events } = await db();

  const from =
    isValidDate(String(req.query.from || ""))
      ? req.query.from
      : today();

  const filter = {
    date: { $gte: from }
  };

  if (TYPES.includes(req.query.type)) {
    filter.type = req.query.type;
  }

  const search = String(req.query.search || "")
    .trim()
    .slice(0, 60);

  if (search) {
    const rx = new RegExp(escapeRx(search), "i");

    filter.$or = [
      { title: rx },
      { location: rx },
      { description: rx }
    ];
  }

  const parsedLimit = Number.parseInt(req.query.limit, 10);

  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 1), 50)
    : 20;

  const result = await events
    .find(filter)
    .sort({
      date: 1,
      createdAt: -1
    })
    .limit(limit)
    .toArray();

  res.json(result);
}));

// ---------------- SINGLE EVENT ----------------

app.get("/events/:id", wrap(async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({
      message: "Invalid event id."
    });
  }

  const { events, joins } = await db();

  const ev = await events.findOne({
    _id: new ObjectId(req.params.id)
  });

  if (!ev) {
    return res.status(404).json({
      message: "Event not found."
    });
  }

  const joinCount = await joins.countDocuments({
    eventId: req.params.id
  });

  const volunteers = (
    await joins
      .find({ eventId: req.params.id })
      .sort({ joinedAt: -1 })
      .limit(12)
      .toArray()
  ).map((join) => ({
    name: join.userName,
    image: join.userImage || ""
  }));

  res.json({
    ...ev,
    joinCount,
    volunteers
  });
}));

// ---------------- CREATE EVENT ----------------

app.post("/events", verifyJWT, wrap(async (req, res) => {
  const { e, err } = cleanEvent(req.body);

  if (err) {
    return res.status(400).json({
      message: err
    });
  }

  const { events } = await db();

  const result = await events.insertOne({
    ...e,
    creatorEmail: req.user.email,
    creatorName: req.user.name,
    createdAt: new Date()
  });

  res.status(201).json({
    _id: result.insertedId
  });
}));

// ---------------- MY EVENTS ----------------

app.get("/my-events", verifyJWT, wrap(async (req, res) => {
  const { events } = await db();

  const result = await events
    .find({
      creatorEmail: req.user.email
    })
    .sort({ date: 1 })
    .toArray();

  res.json(result);
}));

// ---------------- UPDATE EVENT ----------------

app.put("/events/:id", verifyJWT, wrap(async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({
      message: "Invalid event id."
    });
  }

  const { e, err } = cleanEvent(req.body);

  if (err) {
    return res.status(400).json({
      message: err
    });
  }

  const { events, joins } = await db();

  const result = await events.updateOne(
    {
      _id: new ObjectId(req.params.id),
      creatorEmail: req.user.email
    },
    {
      $set: e
    }
  );

  if (!result.matchedCount) {
    return res.status(403).json({
      message: "You can only update events you created."
    });
  }

  await joins.updateMany(
    {
      eventId: req.params.id
    },
    {
      $set: {
        eventTitle: e.title,
        eventThumbnail: e.thumbnail,
        eventDate: e.date,
        eventLocation: e.location,
        eventType: e.type
      }
    }
  );

  res.json({
    message: "Event updated."
  });
}));

// ---------------- DELETE EVENT ----------------

app.delete("/events/:id", verifyJWT, wrap(async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({
      message: "Invalid event id."
    });
  }

  const { events, joins } = await db();

  const result = await events.deleteOne({
    _id: new ObjectId(req.params.id),
    creatorEmail: req.user.email
  });

  if (!result.deletedCount) {
    return res.status(403).json({
      message: "You can only delete events you created."
    });
  }

  await joins.deleteMany({
    eventId: req.params.id
  });

  res.json({
    message: "Event deleted."
  });
}));

// ---------------- JOIN EVENT ----------------

app.post("/joins", verifyJWT, wrap(async (req, res) => {
  const { eventId } = req.body || {};

  if (!validId(eventId)) {
    return res.status(400).json({
      message: "Invalid event id."
    });
  }

  const { events, joins } = await db();

  const ev = await events.findOne({
    _id: new ObjectId(eventId)
  });

  if (!ev) {
    return res.status(404).json({
      message: "Event not found."
    });
  }

  if (ev.date < today()) {
    return res.status(400).json({
      message: "This event has already passed."
    });
  }

  try {
    await joins.insertOne({
      eventId,
      userEmail: req.user.email,
      userName: req.user.name,
      userImage: req.user.image,
      eventTitle: ev.title,
      eventThumbnail: ev.thumbnail,
      eventDate: ev.date,
      eventLocation: ev.location,
      eventType: ev.type,
      joinedAt: new Date()
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "You already joined this event."
      });
    }

    throw error;
  }

  res.status(201).json({
    message: "Joined."
  });
}));

// ---------------- CHECK JOIN ----------------

app.get("/joins/check/:eventId", verifyJWT, wrap(async (req, res) => {
  if (!validId(req.params.eventId)) {
    return res.status(400).json({
      message: "Invalid event id."
    });
  }

  const { joins } = await db();

  const joined = await joins.findOne({
    eventId: req.params.eventId,
    userEmail: req.user.email
  });

  res.json({
    joined: Boolean(joined)
  });
}));

// ---------------- LEAVE EVENT ----------------

app.delete("/joins/:eventId", verifyJWT, wrap(async (req, res) => {
  if (!validId(req.params.eventId)) {
    return res.status(400).json({
      message: "Invalid event id."
    });
  }

  const { joins } = await db();

  const result = await joins.deleteOne({
    eventId: req.params.eventId,
    userEmail: req.user.email
  });

  if (!result.deletedCount) {
    return res.status(404).json({
      message: "You have not joined this event."
    });
  }

  res.json({
    message: "You left the event."
  });
}));

// ---------------- MY JOINED EVENTS ----------------

app.get("/joins", verifyJWT, wrap(async (req, res) => {
  const { events, joins } = await db();

  const mine = await joins.find({
    userEmail: req.user.email
  }).toArray();

  const validJoins = mine.filter((join) =>
    validId(join.eventId)
  );

  const when = new Map(
    validJoins.map((join) => [
      join.eventId,
      join.joinedAt
    ])
  );

  const list = await events.find({
    _id: {
      $in: validJoins.map((join) =>
        new ObjectId(join.eventId)
      )
    }
  }).sort({
    date: 1
  }).toArray();

  res.json(
    list.map((event) => ({
      ...event,
      joinedAt: when.get(String(event._id))
    }))
  );
}));

// ---------------- 404 ----------------

app.use((_req, res) => {
  res.status(404).json({
    message: "Route not found."
  });
});

// ---------------- ERROR HANDLER ----------------

app.use((err, _req, res, _next) => {
  console.error(err);

  const status =
    err.status && err.status < 500
      ? err.status
      : 500;

  res.status(status).json({
    message: status === 500
      ? "Server error. Please try again."
      : "Invalid request."
  });
});

// ---------------- SERVER START ----------------

async function startServer() {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`API running on port ${PORT}`);
      console.log("Better Auth is ready.");
    });

  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;