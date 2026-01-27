/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const { MongoClient, ObjectId } = require("mongodb");

const DEFAULT_SEED_ID = "demo-2026-01-03";

function parseArgs(argv) {
  const args = { adminEmail: null, seedId: DEFAULT_SEED_ID, wipe: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--adminEmail" || a === "--admin-email") {
      args.adminEmail = String(argv[i + 1] || "").trim() || null;
      i++;
      continue;
    }
    if (a === "--seedId" || a === "--seed-id") {
      args.seedId = String(argv[i + 1] || "").trim() || DEFAULT_SEED_ID;
      i++;
      continue;
    }
    if (a === "--wipe") {
      args.wipe = true;
      continue;
    }
  }
  return args;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    const err = new Error(`Missing env: ${name}`);
    err.code = "ENV_MISSING";
    throw err;
  }
  return v;
}

function loadEnvFileIfPresent(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const lineRaw of raw.split(/\r?\n/)) {
    const line = String(lineRaw || "").trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (!key) continue;

    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Do not override existing env
    if (process.env[key] == null) {
      process.env[key] = value;
    }
  }
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function next() {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeedToInt(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function pickManyUnique(rng, arr, count) {
  const copy = [...arr];
  const out = [];
  while (out.length < count && copy.length) {
    const idx = Math.floor(rng() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

function randInt(rng, min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(rng() * (hi - lo + 1)) + lo;
}

function roundTo(value, decimals) {
  const p = Math.pow(10, decimals);
  return Math.round(value * p) / p;
}

function toIsoDateOnly(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function main() {
  const args = parseArgs(process.argv);
  const seedId = String(process.env.SEED_ID || args.seedId || DEFAULT_SEED_ID)
    .trim()
    .toLowerCase();

  // Load env vars from local files (so running via `node` works the same as Next.js)
  const cwd = process.cwd();
  loadEnvFileIfPresent(path.join(cwd, ".env.local"));
  loadEnvFileIfPresent(path.join(cwd, ".env"));

  const uri = requireEnv("MONGODB_URI");
  const client = new MongoClient(uri);
  await client.connect();

  const dbName = process.env.MONGODB_DB;
  const db = dbName ? client.db(dbName) : client.db();

  const admins = db.collection("admins");
  const authClients = db.collection("clients");
  const entities = db.collection("entities");

  const adminEmail = String(
    process.env.SEED_ADMIN_EMAIL || args.adminEmail || ""
  ).trim();

  let admin;
  if (adminEmail) {
    admin = await admins.findOne({ email: adminEmail });
    if (!admin) {
      throw new Error(
        `Admin not found for email: ${adminEmail}. Set SEED_ADMIN_EMAIL or pass --adminEmail.`
      );
    }
  } else {
    const allAdmins = await admins
      .find({})
      .project({ email: 1 })
      .limit(10)
      .toArray();

    if (allAdmins.length === 1) {
      admin = await admins.findOne({ _id: allAdmins[0]._id });
    } else {
      const emails = allAdmins.map((a) => a.email).filter(Boolean);
      throw new Error(
        `Multiple admins exist. Pass --adminEmail (or SEED_ADMIN_EMAIL). Found: ${emails.join(
          ", "
        )}`
      );
    }
  }

  const adminId = new ObjectId(admin._id);

  const seedTagField = "mockSeedId";

  const wipeConfirmed =
    !args.wipe ||
    String(process.env.SEED_WIPE_CONFIRM || "").toUpperCase() === "YES";

  if (args.wipe && !wipeConfirmed) {
    throw new Error(
      "Refusing to wipe without SEED_WIPE_CONFIRM=YES (safety)."
    );
  }

  const targetEntities = [
    "AppSettings",
    "Client",
    "ExerciseLibrary",
    "WorkoutPlan",
    "PlanExercise",
    "FoodLibrary",
    "MealPlan",
    "Meal",
    "PlanFood",
    "Meeting",
  ];

  if (args.wipe) {
    const del = await entities.deleteMany({
      adminId,
      entity: { $in: targetEntities },
    });
    console.log(`WIPED ${del.deletedCount} entity docs for admin ${admin.email}`);

    // Safety: only wipe previously-seeded auth client identities.
    const delAuth = await authClients.deleteMany({
      adminId,
      mockSeedId: { $exists: true },
    });
    if (delAuth.deletedCount) {
      console.log(`WIPED ${delAuth.deletedCount} auth client docs for admin ${admin.email}`);
    }
  } else {
    const del = await entities.deleteMany({
      adminId,
      entity: { $in: targetEntities },
      [`data.${seedTagField}`]: seedId,
    });
    if (del.deletedCount) {
      console.log(`Removed ${del.deletedCount} previously-seeded docs (${seedId}).`);
    }

    const delAuth = await authClients.deleteMany({ adminId, mockSeedId: seedId });
    if (delAuth.deletedCount) {
      console.log(`Removed ${delAuth.deletedCount} previously-seeded auth client docs (${seedId}).`);
    }
  }

  const rng = mulberry32(hashSeedToInt(seedId));

  const now = new Date();

  async function insertEntity(entityName, data, { createdAt, updatedAt } = {}) {
    const cAt = createdAt || now;
    const uAt = updatedAt || cAt;
    const insert = await entities.insertOne({
      entity: entityName,
      adminId,
      data: { ...data, [seedTagField]: seedId },
      createdAt: cAt,
      updatedAt: uAt,
    });
    return insert.insertedId.toHexString();
  }

  // App settings (optional but useful for meal types)
  const existingSettings = await entities.findOne({ entity: "AppSettings", adminId });
  if (!existingSettings) {
    await insertEntity("AppSettings", {
      businessName: "Progrr Demo Studio",
      mealTypes: [
        "Breakfast",
        "Lunch",
        "Dinner",
        "Snack",
        "Brunch",
        "Pre Workout",
        "Post Workout",
        "Supper",
      ],
    });
  }

  // Food Library (30)
  const foodTemplates = [
    { name: "Chicken Breast (cooked)", calories: 165, protein: 31, carbs: 0, fat: 3.6 },
    { name: "Salmon", calories: 208, protein: 20, carbs: 0, fat: 13 },
    { name: "Tuna (canned, in water)", calories: 116, protein: 26, carbs: 0, fat: 1 },
    { name: "Egg (whole)", calories: 143, protein: 13, carbs: 1.1, fat: 10 },
    { name: "Greek Yogurt (0%)", calories: 59, protein: 10, carbs: 3.6, fat: 0.4 },
    { name: "Cottage Cheese", calories: 98, protein: 11, carbs: 3.4, fat: 4.3 },
    { name: "Oats", calories: 389, protein: 17, carbs: 66, fat: 7 },
    { name: "Rice (cooked)", calories: 130, protein: 2.4, carbs: 28, fat: 0.3 },
    { name: "Pasta (cooked)", calories: 158, protein: 5.8, carbs: 31, fat: 0.9 },
    { name: "Quinoa (cooked)", calories: 120, protein: 4.4, carbs: 21, fat: 1.9 },
    { name: "Potato (boiled)", calories: 87, protein: 1.9, carbs: 20, fat: 0.1 },
    { name: "Sweet Potato (baked)", calories: 90, protein: 2, carbs: 21, fat: 0.2 },
    { name: "Broccoli", calories: 35, protein: 2.8, carbs: 7.2, fat: 0.4 },
    { name: "Spinach", calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
    { name: "Tomato", calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
    { name: "Avocado", calories: 160, protein: 2, carbs: 8.5, fat: 14.7 },
    { name: "Olive Oil", calories: 884, protein: 0, carbs: 0, fat: 100 },
    { name: "Almonds", calories: 579, protein: 21, carbs: 22, fat: 50 },
    { name: "Peanut Butter", calories: 588, protein: 25, carbs: 20, fat: 50 },
    { name: "Banana", calories: 89, protein: 1.1, carbs: 23, fat: 0.3 },
    { name: "Apple", calories: 52, protein: 0.3, carbs: 14, fat: 0.2 },
    { name: "Blueberries", calories: 57, protein: 0.7, carbs: 14.5, fat: 0.3 },
    { name: "Orange", calories: 47, protein: 0.9, carbs: 12, fat: 0.1 },
    { name: "Whey Protein (powder)", calories: 412, protein: 80, carbs: 8, fat: 6 },
    { name: "Tofu", calories: 76, protein: 8, carbs: 1.9, fat: 4.8 },
    { name: "Lentils (cooked)", calories: 116, protein: 9, carbs: 20, fat: 0.4 },
    { name: "Chickpeas (cooked)", calories: 164, protein: 9, carbs: 27, fat: 2.6 },
    { name: "Black Beans (cooked)", calories: 132, protein: 9, carbs: 24, fat: 0.5 },
    { name: "Cheddar Cheese", calories: 403, protein: 25, carbs: 1.3, fat: 33 },
    { name: "Milk (2%)", calories: 50, protein: 3.4, carbs: 4.8, fat: 2 },
    { name: "Hummus", calories: 166, protein: 7.9, carbs: 14.3, fat: 9.6 },
    { name: "Bread (whole wheat)", calories: 247, protein: 13, carbs: 41, fat: 4.2 },
    { name: "Cucumber", calories: 15, protein: 0.7, carbs: 3.6, fat: 0.1 },
  ];

  const foodLibraryRows = pickManyUnique(rng, foodTemplates, 30);
  const foodLibraryIds = [];
  for (const f of foodLibraryRows) {
    const id = await insertEntity("FoodLibrary", {
      name: f.name,
      calories: String(f.calories),
      protein: String(f.protein),
      carbs: String(f.carbs),
      fat: String(f.fat),
    });
    foodLibraryIds.push(id);
  }

  // Exercise Library (30)
  const youtubeLinks = [
    "https://www.youtube.com/watch?v=IODxDxX7oi4", // push up
    "https://www.youtube.com/watch?v=2pLT-olgUJs", // squat
    "https://www.youtube.com/watch?v=5A5qA6f2lnI", // deadlift
    "https://www.youtube.com/watch?v=RjexvOAsVtI", // plank
    "https://www.youtube.com/watch?v=ykJmrZ5v0Oo", // lunges
    "https://www.youtube.com/watch?v=9efgcAjQe7E", // bench press
    "https://www.youtube.com/watch?v=U0bhE67HuDY", // pull up
    "https://www.youtube.com/watch?v=3R14MnZbcpw", // shoulder press
  ];

  const exerciseTemplates = [
    "Push-Up",
    "Incline Push-Up",
    "Dumbbell Bench Press",
    "Barbell Bench Press",
    "Overhead Press",
    "Lateral Raise",
    "Pull-Up",
    "Lat Pulldown",
    "Bent-Over Row",
    "Seated Cable Row",
    "Goblet Squat",
    "Barbell Back Squat",
    "Romanian Deadlift",
    "Conventional Deadlift",
    "Hip Thrust",
    "Walking Lunge",
    "Leg Press",
    "Leg Extension",
    "Leg Curl",
    "Calf Raise",
    "Biceps Curl",
    "Hammer Curl",
    "Triceps Pushdown",
    "Triceps Dip",
    "Plank",
    "Hollow Hold",
    "Russian Twist",
    "Glute Bridge",
    "Mountain Climbers",
    "Burpees",
    "Jump Rope",
    "Treadmill Walk",
    "Bike Intervals",
  ];

  const pickedExercises = pickManyUnique(rng, exerciseTemplates, 30);
  const exerciseLibraryIds = [];
  for (let i = 0; i < pickedExercises.length; i++) {
    const name = pickedExercises[i];
    const hasVideo = rng() < 0.55;
    const hasGuidelines = rng() < 0.75;

    const guidelines = hasGuidelines
      ? pick(rng, [
          "Controlled tempo. Full range of motion.",
          "Keep core braced; don’t arch lower back.",
          "Stop 1-2 reps before failure.",
          "Focus on smooth reps and stable joints.",
          "Exhale on effort; inhale on the way down.",
        ])
      : "";

    const id = await insertEntity("ExerciseLibrary", {
      name,
      guidelines,
      videoKind: hasVideo ? "youtube" : null,
      videoUrl: hasVideo ? pick(rng, youtubeLinks) : null,
    });

    exerciseLibraryIds.push(id);
  }

  // Workout plans (15) + PlanExercise assignments
  const planGoals = [
    "Fat Loss",
    "Muscle Gain",
    "Strength",
    "Maintenance",
    "Athletic Performance",
  ];
  const planDifficulties = ["beginner", "intermediate", "advanced"];

  const workoutPlanIds = [];
  for (let i = 0; i < 15; i++) {
    const durationWeeks = randInt(rng, 4, 16);
    const difficulty = pick(rng, planDifficulties);
    const goal = pick(rng, planGoals);

    const id = await insertEntity("WorkoutPlan", {
      name: `Workout Plan ${i + 1} - ${goal}`,
      duration: String(durationWeeks),
      difficulty,
      goal,
      notes: rng() < 0.5 ? "Progress weekly. Warm up 5-10 min." : "",
    });

    workoutPlanIds.push(id);

    const exerciseCount = randInt(rng, 4, 10);
    const planExerciseIds = pickManyUnique(rng, exerciseLibraryIds, exerciseCount);

    for (let j = 0; j < planExerciseIds.length; j++) {
      const sets = String(randInt(rng, 2, 5));
      const reps = pick(rng, ["6-8", "8-10", "10-12", "12-15", "AMRAP"]);
      const restSeconds = pick(rng, [45, 60, 75, 90, 120]);

      await insertEntity("PlanExercise", {
        workoutPlanId: id,
        exerciseLibraryId: planExerciseIds[j],
        sets,
        reps,
        restSeconds,
        order: j,
      });
    }
  }

  // Meal plans (15) + meals + PlanFood
  const mealPlanIds = [];
  const mealTypePool = [
    "Breakfast",
    "Lunch",
    "Dinner",
    "Snack",
    "Brunch",
    "Pre Workout",
    "Post Workout",
    "Supper",
  ];

  for (let i = 0; i < 15; i++) {
    const goal = pick(rng, planGoals);

    const mealPlanId = await insertEntity("MealPlan", {
      name: `Meal Plan ${i + 1} - ${goal}`,
      goal,
      dailyCalories: "",
      dailyProtein: "",
      dailyCarbs: "",
      dailyFat: "",
      notes: rng() < 0.4 ? "Drink water and track consistency." : "",
    });

    mealPlanIds.push(mealPlanId);

    const mealCount = randInt(rng, 3, 5);
    const chosenMealTypes = pickManyUnique(rng, mealTypePool, mealCount);

    // For totals
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    for (let m = 0; m < chosenMealTypes.length; m++) {
      const type = chosenMealTypes[m];
      const mealId = await insertEntity("Meal", {
        mealPlanId,
        type,
        name: type,
        order: m,
      });

      const foodsInMeal = randInt(rng, 2, 4);
      const chosenFoods = pickManyUnique(rng, foodLibraryRows, foodsInMeal);

      for (let f = 0; f < chosenFoods.length; f++) {
        const foodName = chosenFoods[f].name;
        const libIndex = foodLibraryRows.findIndex((x) => x.name === foodName);
        const foodLibraryId = foodLibraryIds[libIndex];

        const grams = randInt(rng, 60, 280);

        // per 100g
        const factor = grams / 100;
        totalCalories += Number(chosenFoods[f].calories) * factor;
        totalProtein += Number(chosenFoods[f].protein) * factor;
        totalCarbs += Number(chosenFoods[f].carbs) * factor;
        totalFat += Number(chosenFoods[f].fat) * factor;

        await insertEntity("PlanFood", {
          mealId,
          foodLibraryId,
          amount: String(grams),
          order: f,
        });
      }
    }

    // Persist computed totals as strings (UI expects strings)
    await entities.updateOne(
      { _id: new ObjectId(mealPlanId), entity: "MealPlan", adminId },
      {
        $set: {
          "data.dailyCalories": String(Math.round(totalCalories)),
          "data.dailyProtein": String(roundTo(totalProtein, 1)),
          "data.dailyCarbs": String(roundTo(totalCarbs, 1)),
          "data.dailyFat": String(roundTo(totalFat, 1)),
          updatedAt: new Date(),
        },
      }
    );
  }

  // Clients (50), unique by name
  const firstNames = [
    "Alex",
    "Sam",
    "Jordan",
    "Taylor",
    "Morgan",
    "Casey",
    "Riley",
    "Jamie",
    "Drew",
    "Avery",
    "Noa",
    "Liam",
    "Maya",
    "Eden",
    "Leo",
    "Zoe",
    "Nina",
    "Omer",
    "Daniel",
    "Mia",
  ];
  const lastNames = [
    "Cohen",
    "Levy",
    "Mizrahi",
    "Kaplan",
    "Rosen",
    "Friedman",
    "Katz",
    "Gold",
    "Silver",
    "Stone",
    "Green",
    "Weiss",
    "Shapiro",
    "Baron",
    "Nadav",
    "Shalev",
    "Halevi",
    "Peretz",
    "Ben-David",
    "Amir",
  ];

  const genders = ["male", "female", "other"];
  const activityLevels = [
    "sedentary",
    "light",
    "moderate",
    "active",
    "very active",
  ];
  const clientStatuses = ["ACTIVE", "PENDING", "PAUSED"];

  const usedNames = new Set();
  const clientIds = [];

  for (let i = 0; i < 50; i++) {
    let name;
    let attempt = 0;
    do {
      const base = `${pick(rng, firstNames)} ${pick(rng, lastNames)}`;
      name = attempt ? `${base} ${attempt + 1}` : base;
      attempt++;
    } while (usedNames.has(name.toLowerCase()) && attempt < 10);

    if (usedNames.has(name.toLowerCase())) {
      name = `${name} ${i + 1}`;
    }

    usedNames.add(name.toLowerCase());

    const birthYear = randInt(rng, 1975, 2005);
    const birth = new Date(birthYear, randInt(rng, 0, 11), randInt(rng, 1, 28));

    // Assign 0-2 workout plans and 0-2 meal plans; ensure some have multiple
    const assignedPlans = pickManyUnique(rng, workoutPlanIds, randInt(rng, 0, 2));
    const assignedMealPlans = pickManyUnique(rng, mealPlanIds, randInt(rng, 0, 2));

    const phone = `555${String(100000 + i)}`;

    // Create matching auth identity in the `clients` collection (used by OTP login)
    const existingAuth = await authClients.findOne({ phone });
    if (existingAuth && String(existingAuth.adminId) !== String(adminId)) {
      throw new Error(
        `Phone already exists for a different admin: ${phone}. Delete the existing auth client or change the seed phone range.`
      );
    }

    let authClientId;
    if (existingAuth) {
      await authClients.updateOne(
        { _id: existingAuth._id },
        {
          $set: {
            adminId,
            phone,
            name,
            theme: "light",
            role: "client",
            mockSeedId: seedId,
          },
        }
      );
      authClientId = existingAuth._id.toHexString();
    } else {
      const ins = await authClients.insertOne({
        adminId,
        phone,
        name,
        theme: "light",
        role: "client",
        mockSeedId: seedId,
      });
      authClientId = ins.insertedId.toHexString();
    }

    const clientId = await insertEntity("Client", {
      name,
      email: `client${String(i + 1).padStart(3, "0")}@example.com`,
      phone,
      // Link entity client profile to auth client identity
      clientAuthId: authClientId,
      userId: authClientId,
      birthDate: toIsoDateOnly(birth),
      gender: pick(rng, genders),
      height: String(randInt(rng, 150, 200)),
      weight: String(randInt(rng, 50, 110)),
      goal: pick(rng, planGoals),
      activityLevel: pick(rng, activityLevels),
      subscription: pick(rng, ["monthly", "quarterly", "yearly", "-"]),
      status: pick(rng, clientStatuses),
      notes: rng() < 0.25 ? "Prefers morning sessions." : "",
      assignedPlanIds: assignedPlans,
      assignedMealPlanIds: assignedMealPlans,
      // Back-compat single assignment (use first if present)
      assignedPlanId: assignedPlans[0] || "",
      assignedMealPlanId: assignedMealPlans[0] || "",
    });

    clientIds.push(clientId);
  }

  // Meetings (20): some past, some future, include prospect
  const meetingTypes = ["call", "zoom", "in_person"];
  const futureStatuses = ["scheduled"];
  const pastStatuses = ["completed", "cancelled", "no_show", "no-show"];

  const prospectId = "__PROSPECT__";

  for (let i = 0; i < 20; i++) {
    const inPast = i < 8; // ensure some past
    const daysOffset = inPast ? -randInt(rng, 2, 120) : randInt(rng, 1, 45);
    const hour = randInt(rng, 8, 19);
    const minute = pick(rng, [0, 15, 30, 45]);

    const scheduledAt = new Date(now);
    scheduledAt.setDate(scheduledAt.getDate() + daysOffset);
    scheduledAt.setHours(hour, minute, 0, 0);

    const type = pick(rng, meetingTypes);
    const status = inPast ? pick(rng, pastStatuses) : pick(rng, futureStatuses);

    const clientId = rng() < 0.15 ? prospectId : pick(rng, clientIds);

    const location =
      type === "zoom"
        ? "https://zoom.us/j/123456789"
        : type === "call"
        ? "Phone call"
        : "Main Studio - 21 Fitness St";

    await insertEntity(
      "Meeting",
      {
        title: inPast ? `Follow-up ${i + 1}` : `Session ${i + 1}`,
        type,
        status,
        scheduledAt: scheduledAt.toISOString(),
        durationMinutes: pick(rng, [30, 45, 60, 75]),
        location,
        clientId,
        notes:
          rng() < 0.35
            ? inPast
              ? "Reviewed progress and next steps."
              : "Agenda: goals, check-in, next plan."
            : "",
      },
      {
        createdAt: new Date(scheduledAt.getTime() - 1000 * 60 * 60 * 24 * 2),
        updatedAt: new Date(scheduledAt.getTime() - 1000 * 60 * 60),
      }
    );
  }

  // Summary
  const counts = {};
  for (const e of targetEntities) {
    counts[e] = await entities.countDocuments({
      adminId,
      entity: e,
      [`data.${seedTagField}`]: seedId,
    });
  }

  console.log("\nSeed complete:");
  console.table(counts);
  console.log(`Seed ID: ${seedId}`);
  console.log(`Admin: ${admin.email}`);
  console.log(
    "\nTip: re-run with same seedId to replace previous seeded docs. Use --wipe (with SEED_WIPE_CONFIRM=YES) to fully wipe target entity types for this admin."
  );

  await client.close();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exitCode = 1;
});
