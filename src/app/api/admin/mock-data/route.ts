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

  await c.entities.deleteMany({
    adminId,
    "data.mockSeedId": MOCK_SEED_ID,
  });

  await c.clients.deleteMany({
    adminId,
    mockSeedId: MOCK_SEED_ID,
  });
}

async function resetAdminDataForSeed(adminId: ObjectId) {
  const c = await collections();

  // Only reset the collections/entities explicitly requested.
  const entitiesToDelete = [
    "Client",
    "WorkoutPlan",
    "Exercise",
    "MealPlan",
    "Meal",
    "Food",
    "Meeting",
    "Message",
  ];

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

  // IL-style mobile: +97254XXXXXXX (7 digits)
  // Try deterministic range first, then fall back to random if needed.
  let cursor = 1000000;

  while (phones.length < count) {
    const candidate = `+97254${String(cursor).padStart(7, "0")}`;
    cursor += 1;

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
      await clearMockData(adminId);
      return NextResponse.json({ ok: true, action: "clear" });
    }

    // action === "seed"
    await resetAdminDataForSeed(adminId);

    const c = await collections();

    // --- Plans ---
    const workoutPlans = Array.from({ length: 10 }, (_, i) => {
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
              "Home Dumbbell",
              "Glutes + Legs Focus",
              "Upper Body Strength",
              "Fat Loss Conditioning",
              "Mobility + Core",
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

    const exercises = workoutPlans.flatMap((planDoc, planIndex) => {
      const planId = planDoc._id.toHexString();
      const createdAt = planDoc.createdAt;

      const template: Array<{ name: string; sets: string; reps: string }> =
        planIndex % 3 === 0
          ? [
              { name: "Back Squat", sets: "4", reps: "5" },
              { name: "Romanian Deadlift", sets: "3", reps: "8" },
              { name: "Bench Press", sets: "4", reps: "6" },
              { name: "Lat Pulldown", sets: "3", reps: "10" },
              { name: "Plank", sets: "3", reps: "45s" },
              { name: "Walking Lunges", sets: "3", reps: "12/leg" },
            ]
          : planIndex % 3 === 1
          ? [
              { name: "Deadlift", sets: "3", reps: "3" },
              { name: "Incline Dumbbell Press", sets: "4", reps: "8" },
              { name: "Seated Row", sets: "4", reps: "10" },
              { name: "Overhead Press", sets: "3", reps: "8" },
              { name: "Hip Thrust", sets: "4", reps: "10" },
              { name: "Hanging Knee Raises", sets: "3", reps: "12" },
            ]
          : [
              { name: "Goblet Squat", sets: "4", reps: "12" },
              { name: "Push-ups", sets: "4", reps: "AMRAP" },
              { name: "One-arm Dumbbell Row", sets: "4", reps: "12/side" },
              { name: "Dumbbell Shoulder Press", sets: "3", reps: "10" },
              { name: "Step-ups", sets: "3", reps: "10/leg" },
              { name: "Dead Bug", sets: "3", reps: "10/side" },
            ];

      return template.map((ex, idx) => {
        const exId = new ObjectId();
        return {
          _id: exId,
          entity: "Exercise",
          adminId,
          data: withMock({
            workoutPlanId: planId,
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            order: idx,
            restSeconds: [60, 90, 120][idx % 3],
            tempo: ["2-0-2", "3-1-1", "2-1-2"][idx % 3],
            coachingNotes:
              "Focus on controlled eccentric, full range of motion, and stable bracing. Stop set if form breaks.",
          }),
          createdAt,
          updatedAt: createdAt,
        };
      });
    });

    const mealPlans = Array.from({ length: 10 }, (_, i) => {
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
              "Plant Forward",
              "Gluten-Free Focus",
              "Busy Schedule",
              "Performance Fuel",
              "Simple Starter",
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

    // Exactly 10 Meal entities total: 1 meal per plan
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

    const foods = meals.flatMap((mealDoc) => {
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
      }> | null = mealName.includes("yogurt")
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

      return baseFoods.map((f, idx) => {
        const foodId = new ObjectId();
        return {
          _id: foodId,
          entity: "Food",
          adminId,
          data: withMock({
            mealId,
            name: f.name,
            amount: f.amount,
            calories: f.calories,
            protein: f.protein,
            carbs: f.carbs,
            fat: f.fat,
            order: idx,
          }),
          createdAt,
          updatedAt: createdAt,
        };
      });
    });

    // --- Clients (auth + entity) ---
    const phones = await generateUniquePhones(adminId, 20);

    const clientAuthDocs = phones.map((phone, i) => {
      const createdAt = daysAgo(14 - (i % 7));
      const first = [
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
      ][i % 10];
      const last = [
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
      ][(i * 3) % 10];
      const name = `${first} ${last}`;

      return {
        _id: new ObjectId(),
        adminId,
        phone,
        name,
        email: `demo.client${i + 1}@progrr.test`,
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

      const assignedPlanIds = [
        workoutPlanIds[i % workoutPlanIds.length],
        workoutPlanIds[(i + 3) % workoutPlanIds.length],
      ];
      const assignedMealPlanIds = [mealPlanIds[i % mealPlanIds.length]];

      const createdAt = daysAgo(14 - (i % 7));

      return {
        _id: new ObjectId(),
        entity: "Client",
        adminId,
        data: withMock({
          name: clientAuthDocs[i].name,
          email: clientAuthDocs[i].email,
          phone,
          birthDate,
          gender: pickDeterministic(
            ["male", "female", "other"] as const,
            i + 17
          ),
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
          status: pickDeterministic(
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
    const clientEntityIds = clientEntityDocs.map((d) => d._id.toHexString());

    const meetings = Array.from({ length: 15 }, (_, i) => {
      const createdAt = daysAgo(3);
      const scheduledAt = hoursFromNow(24 + i * 6); // all future

      return {
        _id: new ObjectId(),
        entity: "Meeting",
        adminId,
        data: withMock({
          title: [
            "Weekly Check-in",
            "Program Review",
            "Technique Review",
            "Nutrition Adjustments",
            "Progress & Next Steps",
          ][i % 5],
          type: ["zoom", "call", "in-person"][i % 3],
          status: ["scheduled", "scheduled", "cancelled", "no-show"][i % 4],
          scheduledAt: scheduledAt.toISOString(),
          durationMinutes: [30, 45, 60][i % 3],
          location:
            i % 3 === 0
              ? "Zoom link will be sent before the call"
              : i % 3 === 1
              ? "Phone"
              : "Office / Gym meeting point",
          clientId: clientEntityIds[i % clientEntityIds.length],
          notes:
            "Agenda: wins, adherence review, weight trend, training performance, and next-week focus. Prepare questions in advance.",
        }),
        createdAt,
        updatedAt: createdAt,
      };
    });

    // --- Messages ---
    const messages = Array.from({ length: 12 }, (_, i) => {
      const createdAt = hoursFromNow(-36 + i * 3);
      const clientId = clientEntityIds[i % Math.min(clientEntityIds.length, 6)];
      const senderRole = i % 3 === 0 ? "client" : "admin";

      return {
        _id: new ObjectId(),
        entity: "Message",
        adminId,
        data: withMock({
          clientId,
          text:
            senderRole === "client"
              ? [
                  "Hey! Quick question — should I increase weight if the last set feels easy?",
                  "I hit my protein target but felt hungry at night. Any tips?",
                  "Knee felt a bit tight on lunges. Should I swap the movement?",
                  "I missed one workout this week — should I add an extra session?",
                ][i % 4]
              : [
                  "Great work. If you can keep 1–2 reps in reserve with good form, add a small load next session.",
                  "Try adding volume via veggies + a higher fiber snack; keep calories consistent.",
                  "Yes — swap to split squats or step-ups and keep pain-free range. We’ll reassess next check-in.",
                  "No need to overcompensate. Just continue with the plan and focus on consistency.",
                ][i % 4],
          senderRole,
          readByAdmin: senderRole === "admin",
          readByClient: senderRole === "client",
        }),
        createdAt,
        updatedAt: createdAt,
      };
    });

    // Insert all entity docs
    const entityDocs = [
      ...workoutPlans,
      ...exercises,
      ...mealPlans,
      ...meals,
      ...foods,
      ...clientEntityDocs,
      ...meetings,
      ...messages,
    ];

    await c.entities.insertMany(entityDocs);

    return NextResponse.json({
      ok: true,
      action: "seed",
      seedId: MOCK_SEED_ID,
      counts: {
        clients: clientEntityDocs.length,
        workoutPlans: workoutPlans.length,
        exercises: exercises.length,
        mealPlans: mealPlans.length,
        meals: meals.length,
        foods: foods.length,
        meetings: meetings.length,
        messages: messages.length,
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
