import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { collections, ensureIndexes } from "@/server/collections";
import { requireAppUser } from "@/server/auth";

export const runtime = "nodejs";

const bodySchema = z
  .object({
    action: z.enum(["seed", "clear"]),
  })
  .strict();

const MOCK_SEED_ID = "settings_demo_v1";

const ENTITIES_WIPED_BY_CLEAR = [
  "Client",
  "WorkoutPlan",
  // Legacy plan exercises
  "Exercise",
  // New model plan exercises
  "PlanExercise",
  // Library exercises
  "ExerciseLibrary",
  "MealPlan",
  "Meal",
  // Legacy meal foods
  "Food",
  // New model plan foods
  "PlanFood",
  // Library foods
  "FoodLibrary",
  "Meeting",
  "Message",
] as const;

function isoDateOnly(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function withMock<T extends Record<string, any>>(data: T): T {
  return {
    ...data,
    mockSeedId: MOCK_SEED_ID,
  };
}

function pickDeterministic<T>(items: readonly T[], seed: number): T {
  // Deterministic, lightweight mixing (not crypto).
  // Keeps stable results while avoiding correlated fields.
  const idx = Math.abs((seed * 1103515245 + 12345) | 0) % items.length;
  return items[idx];
}

async function clearMockData(adminId: ObjectId) {
  const c = await collections();

  // Collect phones first so we can remove OTPs too (optional hygiene).
  const clientPhones = await c.clients
    .find({ adminId }, { projection: { phone: 1 } })
    .toArray();
  const phones = clientPhones
    .map((d) => String((d as any)?.phone ?? "").trim())
    .filter(Boolean);

  const entitiesDelete = await c.entities.deleteMany({
    adminId,
    entity: { $in: [...ENTITIES_WIPED_BY_CLEAR] },
  });

  const clientsDelete = await c.clients.deleteMany({ adminId });

  const otpsDelete = phones.length
    ? await c.otps.deleteMany({ phone: { $in: phones } })
    : { deletedCount: 0 };

  return {
    entitiesDeleted: entitiesDelete.deletedCount ?? 0,
    clientAuthDeleted: clientsDelete.deletedCount ?? 0,
    otpsDeleted: (otpsDelete as any)?.deletedCount ?? 0,
  };
}

async function resetAdminDataForSeed(adminId: ObjectId) {
  const c = await collections();

  // Only reset the collections/entities explicitly requested.
  const entitiesToDelete = [...ENTITIES_WIPED_BY_CLEAR];

  await c.entities.deleteMany({
    adminId,
    entity: { $in: entitiesToDelete },
  });

  // Auth client records are a separate collection.
  await c.clients.deleteMany({ adminId });
}

async function generateUniquePhones(adminId: ObjectId, count: number) {
  const c = await collections();

  const phones: string[] = [];
  const used = new Set<string>();

  // Generate a mix of E.164-looking numbers across multiple countries.
  // Note: real SMS deliverability depends on your provider config; this ensures
  // the app can store, find, and attempt OTP for international numbers.
  const specs: Array<{ key: string; prefix: string; suffixDigits: number }> = [
    // Israel (mobile)
    { key: "IL", prefix: "+97254", suffixDigits: 7 },
    // United States (example range)
    { key: "US", prefix: "+1202555", suffixDigits: 4 },
    // United Kingdom (mobile-like)
    { key: "GB", prefix: "+447400", suffixDigits: 6 },
    // Germany (mobile-like)
    { key: "DE", prefix: "+49151", suffixDigits: 7 },
    // France (mobile-like)
    { key: "FR", prefix: "+336", suffixDigits: 8 },
    // Australia (mobile-like)
    { key: "AU", prefix: "+614", suffixDigits: 8 },
    // India (mobile-like)
    { key: "IN", prefix: "+9198", suffixDigits: 8 },
    // Brazil (SP mobile-like)
    { key: "BR", prefix: "+55119", suffixDigits: 8 },
    // Spain (mobile-like)
    { key: "ES", prefix: "+346", suffixDigits: 8 },
    // Japan (mobile-like)
    { key: "JP", prefix: "+8190", suffixDigits: 8 },
  ];

  const counters = new Map<string, number>();
  for (const s of specs) counters.set(s.key, 0);

  while (phones.length < count) {
    const spec = specs[phones.length % specs.length];
    const next = (counters.get(spec.key) ?? 0) + 1;
    counters.set(spec.key, next);

    const suffix = String(next).padStart(spec.suffixDigits, "0");
    const candidate = `${spec.prefix}${suffix}`;

    if (used.has(candidate)) continue;

    // Phone is unique across ALL admins (unique index), so check globally.
    const exists = await c.clients.findOne({ phone: candidate });
    if (exists) continue;

    used.add(candidate);
    phones.push(candidate);
  }

  return phones;
}

export async function POST(req: Request) {
  try {
    const user = await requireAppUser();
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = bodySchema.parse(await req.json());

    await ensureIndexes();

    const adminId = new ObjectId(user.id);

    if (body.action === "clear") {
      const counts = await clearMockData(adminId);
      return NextResponse.json({ ok: true, action: "clear", counts });
    }

    // action === "seed"
    await resetAdminDataForSeed(adminId);

    const c = await collections();

    // --- Plans ---
    const workoutPlans = Array.from({ length: 5 }, (_, i) => {
      const planId = new ObjectId();
      const createdAt = daysAgo(30 - i * 2);
      return {
        _id: planId,
        entity: "WorkoutPlan",
        adminId,
        data: withMock({
          name: `Program ${i + 1}: ${
            [
              "Lean Strength",
              "Hypertrophy Builder",
              "Athletic Performance",
              "Beginner Foundation",
              "Body Recomposition",
            ][i]
          }`,
          difficulty: ["beginner", "intermediate", "advanced"][i % 3],
          duration: `${4 + (i % 5)} weeks`,
          goal: [
            "Strength",
            "Muscle gain",
            "Performance",
            "Fat loss",
            "Recomposition",
          ][i % 5],
          notes:
            "Warm up 8–10 min (bike/row) + dynamic mobility. Track RPE, progress weekly. Keep 1–2 reps in reserve on working sets.",
          tags: ["progressive overload", "tracking", "RPE"],
          split: ["Full body", "Upper/Lower", "Push/Pull/Legs", "4-day split"][
            i % 4
          ],
          sessionsPerWeek: 3 + (i % 3),
        }),
        createdAt,
        updatedAt: createdAt,
      };
    });

    // --- Exercises (Library + PlanExercise) ---
    const exerciseTemplates: Array<{
      name: string;
      sets: string;
      reps: string;
    }> = [
      { name: "Back Squat", sets: "4", reps: "5" },
      { name: "Romanian Deadlift", sets: "3", reps: "8" },
      { name: "Bench Press", sets: "4", reps: "6" },
      { name: "Lat Pulldown", sets: "3", reps: "10" },
      { name: "Deadlift", sets: "3", reps: "3" },
      { name: "Incline Dumbbell Press", sets: "4", reps: "8" },
      { name: "Seated Row", sets: "4", reps: "10" },
      { name: "Overhead Press", sets: "3", reps: "8" },
      { name: "Goblet Squat", sets: "4", reps: "12" },
      { name: "Push-ups", sets: "4", reps: "AMRAP" },
    ];

    const sampleUploadVideos = [
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    ] as const;

    // Exactly 10 exercises in the library
    const exerciseLibraryDocs = exerciseTemplates.slice(0, 10).map((ex, i) => {
      const createdAt = daysAgo(35 - i);
      return {
        _id: new ObjectId(),
        entity: "ExerciseLibrary",
        adminId,
        data: withMock({
          name: ex.name,
          guidelines:
            "Focus on controlled form, full range of motion, and consistent tempo. Progress weekly when reps/effort are stable.",
          videoKind: "upload",
          videoUrl: sampleUploadVideos[i % sampleUploadVideos.length],
        }),
        createdAt,
        updatedAt: createdAt,
      };
    });

    const exerciseLibraryIdByName = new Map<string, string>();
    exerciseLibraryDocs.forEach((d) => {
      exerciseLibraryIdByName.set(
        String((d.data as any)?.name),
        d._id.toHexString()
      );
    });

    // 2 exercises per plan (5 plans => 10 PlanExercise rows)
    const planExercises = workoutPlans.flatMap((planDoc, planIndex) => {
      const workoutPlanId = planDoc._id.toHexString();
      const createdAt = planDoc.createdAt;

      const pickA =
        exerciseTemplates[(planIndex * 2) % exerciseTemplates.length];
      const pickB =
        exerciseTemplates[(planIndex * 2 + 1) % exerciseTemplates.length];

      const picks = [pickA, pickB];

      return picks.map((ex, idx) => {
        const exerciseLibraryId = exerciseLibraryIdByName.get(ex.name);
        if (!exerciseLibraryId) {
          throw new Error(`Missing ExerciseLibrary for ${ex.name}`);
        }

        return {
          _id: new ObjectId(),
          entity: "PlanExercise",
          adminId,
          data: withMock({
            workoutPlanId,
            exerciseLibraryId,
            sets: ex.sets,
            reps: ex.reps,
            order: idx,
            restSeconds: [60, 90, 120][idx % 3],
          }),
          createdAt,
          updatedAt: createdAt,
        };
      });
    });

    const mealPlans = Array.from({ length: 5 }, (_, i) => {
      const planId = new ObjectId();
      const createdAt = daysAgo(25 - i);
      return {
        _id: planId,
        entity: "MealPlan",
        adminId,
        data: withMock({
          name: `Nutrition Plan ${i + 1}: ${
            [
              "High Protein Cut",
              "Balanced Maintenance",
              "Muscle Gain",
              "Mediterranean Style",
              "Low Carb",
            ][i]
          }`,
          goal: [
            "Fat loss",
            "Maintenance",
            "Muscle gain",
            "Health",
            "Performance",
          ][i % 5],
          dailyCalories: String(1700 + i * 120),
          dailyProtein: String(130 + i * 5),
          dailyCarbs: String(140 + i * 10),
          dailyFat: String(55 + i * 3),
          notes:
            "Prioritize whole foods. Hit protein target daily. Hydrate 2–3L/day. Adjust portions based on weekly trend.",
          mealTiming:
            "3 main meals + optional snack. Keep carbs around training window when possible.",
        }),
        createdAt,
        updatedAt: createdAt,
      };
    });

    // Exactly 5 Meal entities total: 1 meal per plan
    const meals = mealPlans.map((planDoc, i) => {
      const mealId = new ObjectId();
      const mealPlanId = planDoc._id.toHexString();
      const createdAt = planDoc.createdAt;

      return {
        _id: mealId,
        entity: "Meal",
        adminId,
        data: withMock({
          mealPlanId,
          type: ["Breakfast", "Lunch", "Dinner", "Snack"][i % 4],
          name: [
            "Greek yogurt bowl",
            "Chicken + rice bowl",
            "Salmon + potatoes",
            "Protein smoothie",
          ][i % 4],
          order: 0,
          prepTimeMinutes: 10 + (i % 4) * 5,
          notes:
            "Swap ingredients based on availability while keeping macros similar.",
        }),
        createdAt,
        updatedAt: createdAt,
      };
    });

    // --- Foods (FoodLibrary + PlanFood) ---
    const mealsWithBaseFoods = meals.map((mealDoc) => {
      const mealId = mealDoc._id.toHexString();
      const createdAt = mealDoc.createdAt;
      const mealName = String((mealDoc.data ?? {}).name ?? "").toLowerCase();

      const baseFoods: Array<{
        name: string;
        amount: string;
        calories: string;
        protein: string;
        carbs: string;
        fat: string;
      }> = mealName.includes("yogurt")
        ? [
            {
              name: "Greek yogurt (2%)",
              amount: "250g",
              calories: "200",
              protein: "23",
              carbs: "10",
              fat: "4",
            },
            {
              name: "Mixed berries",
              amount: "150g",
              calories: "80",
              protein: "1",
              carbs: "18",
              fat: "0",
            },
            {
              name: "Honey",
              amount: "10g",
              calories: "30",
              protein: "0",
              carbs: "8",
              fat: "0",
            },
            {
              name: "Granola",
              amount: "30g",
              calories: "140",
              protein: "3",
              carbs: "20",
              fat: "5",
            },
          ]
        : mealName.includes("chicken")
        ? [
            {
              name: "Chicken breast",
              amount: "180g cooked",
              calories: "300",
              protein: "55",
              carbs: "0",
              fat: "6",
            },
            {
              name: "Jasmine rice",
              amount: "200g cooked",
              calories: "260",
              protein: "5",
              carbs: "56",
              fat: "1",
            },
            {
              name: "Olive oil",
              amount: "10g",
              calories: "90",
              protein: "0",
              carbs: "0",
              fat: "10",
            },
            {
              name: "Cucumber + tomato salad",
              amount: "250g",
              calories: "60",
              protein: "2",
              carbs: "12",
              fat: "0",
            },
          ]
        : mealName.includes("salmon")
        ? [
            {
              name: "Salmon fillet",
              amount: "170g",
              calories: "340",
              protein: "37",
              carbs: "0",
              fat: "20",
            },
            {
              name: "Potatoes",
              amount: "250g",
              calories: "190",
              protein: "5",
              carbs: "44",
              fat: "0",
            },
            {
              name: "Steamed broccoli",
              amount: "200g",
              calories: "70",
              protein: "5",
              carbs: "14",
              fat: "1",
            },
            {
              name: "Butter",
              amount: "8g",
              calories: "60",
              protein: "0",
              carbs: "0",
              fat: "7",
            },
          ]
        : [
            {
              name: "Whey protein",
              amount: "1 scoop",
              calories: "120",
              protein: "24",
              carbs: "3",
              fat: "2",
            },
            {
              name: "Banana",
              amount: "1 medium",
              calories: "105",
              protein: "1",
              carbs: "27",
              fat: "0",
            },
            {
              name: "Peanut butter",
              amount: "15g",
              calories: "90",
              protein: "4",
              carbs: "3",
              fat: "8",
            },
            {
              name: "Milk (1–2%)",
              amount: "300ml",
              calories: "150",
              protein: "10",
              carbs: "15",
              fat: "5",
            },
          ];

      return { mealId, createdAt, baseFoods };
    });

    // Keep seed lightweight: 2 foods assigned per meal (5 meals => 10 PlanFood rows)
    const planFoodNames = Array.from(
      new Set(
        mealsWithBaseFoods
          .flatMap((m) => m.baseFoods.slice(0, 2).map((f) => f.name))
          .map((n) => String(n).trim())
          .filter(Boolean)
      )
    );

    const additionalFoodNames = Array.from(
      new Set(
        mealsWithBaseFoods
          .flatMap((m) => m.baseFoods.map((f) => f.name))
          .map((n) => String(n).trim())
          .filter(Boolean)
      )
    ).filter((n) => !planFoodNames.includes(n));

    const libraryFoodNames = [...planFoodNames, ...additionalFoodNames].slice(
      0,
      10
    );

    const foodLibraryDocs = libraryFoodNames.map((name, i) => {
      const createdAt = daysAgo(20 - i);

      const sample = mealsWithBaseFoods
        .flatMap((m) => m.baseFoods)
        .find((f) => f.name === name);

      return {
        _id: new ObjectId(),
        entity: "FoodLibrary",
        adminId,
        data: withMock({
          name,
          calories: sample?.calories ?? "",
          protein: sample?.protein ?? "",
          carbs: sample?.carbs ?? "",
          fat: sample?.fat ?? "",
        }),
        createdAt,
        updatedAt: createdAt,
      };
    });

    const foodLibraryIdByName = new Map<string, string>();
    foodLibraryDocs.forEach((d) => {
      foodLibraryIdByName.set(
        String((d.data as any)?.name),
        d._id.toHexString()
      );
    });

    const planFoods = mealsWithBaseFoods.flatMap((m) => {
      return m.baseFoods.slice(0, 2).map((f, idx) => {
        const foodLibraryId = foodLibraryIdByName.get(f.name);
        if (!foodLibraryId) {
          throw new Error(`Missing FoodLibrary for ${f.name}`);
        }

        return {
          _id: new ObjectId(),
          entity: "PlanFood",
          adminId,
          data: withMock({
            mealId: m.mealId,
            foodLibraryId,
            amount: f.amount,
            order: idx,
          }),
          createdAt: m.createdAt,
          updatedAt: m.createdAt,
        };
      });
    });

    // --- Clients (auth + entity) ---
    const FIXED_CLIENT = {
      name: "Biraniv Apps",
      phone: "+972507780228",
      email: "biranivapps@gmail.com",
    } as const;

    const generatedPhones = await generateUniquePhones(adminId, 25);
    const phones = [
      FIXED_CLIENT.phone,
      ...generatedPhones.filter((p) => p !== FIXED_CLIENT.phone).slice(0, 9),
    ];

    const clientAuthDocs = phones.map((phone, i) => {
      const createdAt = i === 0 ? daysAgo(0) : daysAgo(14 - (i % 7));

      const name =
        i === 0
          ? FIXED_CLIENT.name
          : `${
              [
                "Noa",
                "Liam",
                "Maya",
                "Daniel",
                "Yael",
                "Omer",
                "Shira",
                "Eitan",
                "Tamar",
                "Amit",
              ][i % 10]
            } ${
              [
                "Cohen",
                "Levi",
                "Mizrahi",
                "Peretz",
                "Biton",
                "Friedman",
                "Mor",
                "Avraham",
                "Dayan",
                "Shavit",
              ][(i * 3) % 10]
            }`;

      return {
        _id: new ObjectId(),
        adminId,
        phone,
        name,
        email: i === 0 ? FIXED_CLIENT.email : `demo.client${i + 1}@progrr.test`,
        theme: i % 3 === 0 ? "dark" : "light",
        role: "client" as const,
        mockSeedId: MOCK_SEED_ID,
        createdAt,
      };
    });

    await c.clients.insertMany(
      clientAuthDocs.map((d) => {
        // ClientDoc doesn't include createdAt; keep it only for our use.
        const { createdAt, ...rest } = d as any;
        return rest;
      })
    );

    // Map phone->authId
    const authByPhone = new Map<string, ObjectId>();
    clientAuthDocs.forEach((d) => authByPhone.set(d.phone, d._id));

    // Assignments
    const workoutPlanIds = workoutPlans.map((p) => p._id.toHexString());
    const mealPlanIds = mealPlans.map((p) => p._id.toHexString());

    const clientEntityDocs = phones.map((phone, i) => {
      const authId = authByPhone.get(phone)!;
      const authIdStr = authId.toHexString();

      const birth = new Date(
        Date.now() - (22 + (i % 18)) * 365 * 24 * 60 * 60 * 1000
      );
      const birthDate = isoDateOnly(birth);

      const assignedPlanIds =
        i === 0
          ? workoutPlanIds.slice(0, 2)
          : [
              workoutPlanIds[i % workoutPlanIds.length],
              workoutPlanIds[(i + 3) % workoutPlanIds.length],
            ];

      const assignedMealPlanIds =
        i === 0
          ? mealPlanIds.slice(0, 2)
          : [mealPlanIds[i % mealPlanIds.length]];

      const createdAt = i === 0 ? daysAgo(0) : daysAgo(14 - (i % 7));

      return {
        _id: new ObjectId(),
        entity: "Client",
        adminId,
        data: withMock({
          name: clientAuthDocs[i].name,
          email: clientAuthDocs[i].email,
          phone,
          birthDate,
          gender:
            i === 0
              ? "male"
              : pickDeterministic(["male", "female", "other"] as const, i + 17),
          height: `${160 + (i % 25)} cm`,
          weight: `${55 + (i % 40)} kg`,
          goal: [
            "Fat loss",
            "Muscle gain",
            "Strength",
            "Better habits",
            "Recomposition",
          ][i % 5],
          activityLevel: [
            "Sedentary",
            "Light",
            "Moderate",
            "Active",
            "Very Active",
          ][i % 5],
          subscription: ["Starter", "Premium", "VIP"][i % 3],
          status:
            i === 0
              ? "ACTIVE"
              : pickDeterministic(
                  ["ACTIVE", "PENDING", "INACTIVE"] as const,
                  i + 101
                ),
          notes:
            "Initial intake completed. Tracking adherence, sleep, steps, and weekly check-ins. Adjust plan based on recovery and progress.",
          userId: authIdStr,
          clientAuthId: authIdStr,
          assignedPlanIds,
          assignedMealPlanIds,
          assignedPlanId: assignedPlanIds[0],
          assignedMealPlanId: assignedMealPlanIds[0],
          city: ["Tel Aviv", "Jerusalem", "Haifa", "Rishon LeZion"][i % 4],
          timezone: "Asia/Jerusalem",
          emergencyContactName: "Emergency Contact",
          emergencyContactPhone: "+972501234567",
          injuries: i % 4 === 0 ? "Knee discomfort (patellofemoral)" : "",
          medicalConditions: i % 6 === 0 ? "Mild asthma" : "",
          dietaryPreferences: i % 2 === 0 ? "High protein" : "Balanced",
          allergies: i % 7 === 0 ? "Peanuts" : "",
          preferredTrainingDays: ["Sun", "Tue", "Thu"],
          stepGoal: 8000 + (i % 5) * 1000,
          sleepGoalHours: 7.5,
        }),
        createdAt,
        updatedAt: createdAt,
      };
    });

    // --- Meetings ---
    const clientEntityId0 = clientEntityDocs[0]?._id?.toHexString();
    const clientEntityId1 = clientEntityDocs[1]?._id?.toHexString();
    const meetings = [
      {
        title: "Intro call",
        type: "call",
        status: "scheduled",
        scheduledAt: hoursFromNow(26).toISOString(),
        durationMinutes: 30,
        location: "+97250 123 4567",
        clientId: clientEntityId0,
        notes: "Discuss goals, schedule, and onboarding.",
      },
      {
        title: "Check-in",
        type: "zoom",
        status: "scheduled",
        scheduledAt: hoursFromNow(72).toISOString(),
        durationMinutes: 20,
        location: "https://zoom.us/j/1234567890",
        clientId: clientEntityId0,
        notes: "Answer questions about process and payment.",
      },
      {
        title: "Nutrition review",
        type: "zoom",
        status: "scheduled",
        scheduledAt: hoursFromNow(120).toISOString(),
        durationMinutes: 25,
        location: "https://zoom.us/j/5556667777",
        clientId: clientEntityId0,
        notes: "Review last week's adherence and adjust targets.",
      },
      {
        title: "Form review",
        type: "zoom",
        status: "completed",
        scheduledAt: daysAgo(3).toISOString(),
        durationMinutes: 30,
        location: "https://zoom.us/j/9876543210",
        clientId: clientEntityId0,
        notes: "Review squat and hinge cues.",
      },
      {
        title: "Weekly recap",
        type: "call",
        status: "completed",
        scheduledAt: daysAgo(10).toISOString(),
        durationMinutes: 15,
        location: "+97252 987 6543",
        clientId: clientEntityId0,
        notes: "Quick recap and next-week focus.",
      },
    ].map((m, i) => {
      const createdAt = daysAgo(10 - i);
      return {
        _id: new ObjectId(),
        entity: "Meeting",
        adminId,
        data: withMock(m),
        createdAt,
        updatedAt: createdAt,
      };
    });

    // Insert all entity docs
    const entityDocs = [
      ...workoutPlans,
      ...exerciseLibraryDocs,
      ...planExercises,
      ...mealPlans,
      ...meals,
      ...foodLibraryDocs,
      ...planFoods,
      ...clientEntityDocs,
      ...meetings,
    ];

    await c.entities.insertMany(entityDocs);

    return NextResponse.json({
      ok: true,
      action: "seed",
      seedId: MOCK_SEED_ID,
      counts: {
        clients: clientEntityDocs.length,
        workoutPlans: workoutPlans.length,
        exercises: exerciseLibraryDocs.length,
        mealPlans: mealPlans.length,
        meals: meals.length,
        foods: foodLibraryDocs.length,
        meetings: meetings.length,
        messages: 0,
      },
    });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    const message =
      typeof error?.message === "string" && error.message
        ? error.message
        : "Internal Server Error";

    return NextResponse.json(
      { error: status === 401 ? "Unauthorized" : message },
      { status }
    );
  }
}
