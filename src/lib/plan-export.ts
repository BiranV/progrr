import { jsPDF } from "jspdf";
import type { Food, Meal, MealPlan, WorkoutPlan } from "@/types";
import { extractYouTubeVideoId } from "@/lib/youtube";

const toTitleCase = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
};

const safeFilenameBase = (base: string) => {
  const cleaned = String(base ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || "export";
};

export const formatWorkoutPlanText = (
  plan: WorkoutPlan,
  exercises: Array<{
    name?: string;
    videoKind?: string | null;
    videoUrl?: string | null;
    sets?: string;
    reps?: string;
    restSeconds?: number;
  }>
) => {
  const lines: string[] = [];

  lines.push(`Workout Plan: ${String(plan.name ?? "").trim() || "-"}`);

  const difficulty = String((plan as any).difficulty ?? "").trim();
  const duration = String((plan as any).duration ?? "").trim();
  const goal = String((plan as any).goal ?? "").trim();

  const durationText = (() => {
    if (!duration) return "";
    if (/^\d+$/.test(duration)) {
      const weeks = Number(duration);
      if (Number.isFinite(weeks))
        return `${weeks} week${weeks === 1 ? "" : "s"}`;
    }
    return duration;
  })();

  if (difficulty) lines.push(`Difficulty: ${toTitleCase(difficulty)}`);
  if (durationText) lines.push(`Duration: ${durationText}`);
  if (goal) lines.push(`Goal: ${toTitleCase(goal)}`);

  const notes = String((plan as any).notes ?? "").trim();
  if (notes) {
    lines.push("");
    lines.push("Notes:");
    lines.push(notes);
  }

  lines.push("");
  lines.push("Exercises:");

  if (!exercises.length) {
    lines.push("- None");
  } else {
    exercises.forEach((e: any, idx: number) => {
      const name = String(e?.name ?? "").trim() || "-";
      const sets = String(e?.sets ?? "").trim();
      const reps = String(e?.reps ?? "").trim();

      const youtubeUrl = (() => {
        if (String(e?.videoKind ?? "") !== "youtube") return "";
        const raw = String(e?.videoUrl ?? "").trim();
        if (!raw) return "";
        const id = extractYouTubeVideoId(raw);
        return id ? `https://www.youtube.com/watch?v=${id}` : "";
      })();

      const restSecondsRaw = Number(e?.restSeconds);
      const restSeconds = Number.isFinite(restSecondsRaw)
        ? Math.max(0, Math.floor(restSecondsRaw))
        : 0;
      const restText = (() => {
        if (!restSeconds) return "";
        const m = Math.floor(restSeconds / 60);
        const s = restSeconds % 60;
        if (m && s) return `${m}m ${s}s`;
        if (m) return `${m}m`;
        return `${s}s`;
      })();

      const detail =
        sets || reps
          ? `${sets ? `${sets} sets` : ""}${sets && reps ? " × " : ""}${reps ? `${reps} reps` : ""
          }`
          : "";
      const suffixParts = [detail, restText ? `Rest ${restText}` : ""].filter(
        Boolean
      );
      if (suffixParts.length) {
        lines.push(
          `${idx + 1}. ${toTitleCase(name)} — ${suffixParts.join(" · ")}`
        );
      } else {
        lines.push(`${idx + 1}. ${toTitleCase(name)}`);
      }

      if (youtubeUrl) {
        lines.push(`   YouTube: ${youtubeUrl}`);
      }

      // Visual spacing between exercises (helps PDF readability)
      if (idx < exercises.length - 1) {
        lines.push("");
      }
    });
  }

  return lines.join("\n");
};

export const formatMealPlanText = (
  plan: MealPlan,
  meals: Array<Meal & { foods?: Food[] }>
) => {
  const lines: string[] = [];

  const addBullet = (label: string, value: unknown, unit?: string) => {
    const raw = String(value ?? "").trim();
    if (!raw) return;
    lines.push(`- ${label}: ${raw}${unit ? ` ${unit}` : ""}`);
  };

  lines.push(`Meal Plan: ${String(plan.name ?? "").trim() || "-"}`);

  const goal = String((plan as any).goal ?? "").trim();
  if (goal) lines.push(`Goal: ${toTitleCase(goal)}`);

  const dailyCalories = String((plan as any).dailyCalories ?? "").trim();
  const dailyProtein = String((plan as any).dailyProtein ?? "").trim();
  const dailyCarbs = String((plan as any).dailyCarbs ?? "").trim();
  const dailyFat = String((plan as any).dailyFat ?? "").trim();

  const dailyFiber = String((plan as any).dailyFiber ?? "").trim();
  const dailySugars = String((plan as any).dailySugars ?? "").trim();
  const dailySaturatedFat = String((plan as any).dailySaturatedFat ?? "").trim();
  const dailyTransFat = String((plan as any).dailyTransFat ?? "").trim();
  const dailyCholesterol = String((plan as any).dailyCholesterol ?? "").trim();
  const dailySodium = String((plan as any).dailySodium ?? "").trim();
  const dailyPotassium = String((plan as any).dailyPotassium ?? "").trim();
  const dailyCalcium = String((plan as any).dailyCalcium ?? "").trim();
  const dailyIron = String((plan as any).dailyIron ?? "").trim();
  const dailyVitaminA = String((plan as any).dailyVitaminA ?? "").trim();
  const dailyVitaminC = String((plan as any).dailyVitaminC ?? "").trim();
  const dailyVitaminD = String((plan as any).dailyVitaminD ?? "").trim();
  const dailyVitaminB12 = String((plan as any).dailyVitaminB12 ?? "").trim();

  if (
    dailyCalories ||
    dailyProtein ||
    dailyCarbs ||
    dailyFat ||
    dailyFiber ||
    dailySugars ||
    dailySaturatedFat ||
    dailyTransFat ||
    dailyCholesterol ||
    dailySodium ||
    dailyPotassium ||
    dailyCalcium ||
    dailyIron ||
    dailyVitaminA ||
    dailyVitaminC ||
    dailyVitaminD ||
    dailyVitaminB12
  ) {
    lines.push("");
    lines.push("Daily targets:");
    addBullet("Calories", dailyCalories, "kcal");
    addBullet("Protein", dailyProtein, "g");
    addBullet("Carbs", dailyCarbs, "g");
    addBullet("Fat", dailyFat, "g");
    addBullet("Fiber", dailyFiber, "g");
    addBullet("Sugars", dailySugars, "g");
    addBullet("Saturated fat", dailySaturatedFat, "g");
    addBullet("Trans fat", dailyTransFat, "g");
    addBullet("Cholesterol", dailyCholesterol, "mg");
    addBullet("Sodium", dailySodium, "mg");
    addBullet("Potassium", dailyPotassium, "mg");
    addBullet("Calcium", dailyCalcium, "mg");
    addBullet("Iron", dailyIron, "mg");
    addBullet("Vitamin A", dailyVitaminA, "µg");
    addBullet("Vitamin C", dailyVitaminC, "mg");
    addBullet("Vitamin D", dailyVitaminD, "µg");
    addBullet("Vitamin B12", dailyVitaminB12, "µg");
  }

  const notes = String((plan as any).notes ?? "").trim();
  if (notes) {
    lines.push("");
    lines.push("Notes:");
    lines.push(notes);
  }

  lines.push("");
  lines.push("Meals:");

  if (!meals.length) {
    lines.push("- None");
  } else {
    meals.forEach((meal: any, mealIdx: number) => {
      const type = toTitleCase(meal?.type || "Meal") || "Meal";
      const name = String(meal?.name ?? "").trim();
      lines.push(
        `${mealIdx + 1}. ${type}${name ? `: ${toTitleCase(name)}` : ""}`
      );

      const foods: any[] = Array.isArray(meal?.foods) ? meal.foods : [];
      if (!foods.length) {
        lines.push("   - No foods");
      } else {
        foods.forEach((food: any, foodIdx: number) => {
          const foodName = toTitleCase(food?.name) || "-";
          const amount = String(food?.amount ?? "").trim();

          const macros = [
            food?.protein ? `Protein ${String(food.protein).trim()}` : "",
            food?.carbs ? `Carbs ${String(food.carbs).trim()}` : "",
            food?.fat ? `Fat ${String(food.fat).trim()}` : "",
            food?.calories ? `Calories ${String(food.calories).trim()}` : "",

            food?.fiber ? `Fiber ${String(food.fiber).trim()}` : "",
            food?.sugars ? `Sugars ${String(food.sugars).trim()}` : "",
            food?.saturatedFat ? `Sat fat ${String(food.saturatedFat).trim()}` : "",
            food?.transFat ? `Trans fat ${String(food.transFat).trim()}` : "",
            food?.cholesterol ? `Cholesterol ${String(food.cholesterol).trim()}` : "",
            food?.sodium ? `Sodium ${String(food.sodium).trim()}` : "",
            food?.potassium ? `Potassium ${String(food.potassium).trim()}` : "",
            food?.calcium ? `Calcium ${String(food.calcium).trim()}` : "",
            food?.iron ? `Iron ${String(food.iron).trim()}` : "",
            food?.vitaminA ? `Vit A ${String(food.vitaminA).trim()}` : "",
            food?.vitaminC ? `Vit C ${String(food.vitaminC).trim()}` : "",
            food?.vitaminD ? `Vit D ${String(food.vitaminD).trim()}` : "",
            food?.vitaminB12 ? `Vit B12 ${String(food.vitaminB12).trim()}` : "",
          ].filter(Boolean);

          const macroSuffix = macros.length ? ` (${macros.join(" • ")})` : "";
          lines.push(
            `   - ${foodIdx + 1}. ${foodName}${amount ? ` — ${amount}` : ""
              }${macroSuffix}`.trimEnd()
          );
        });
      }

      // Visual spacing between meals (helps readability)
      if (mealIdx < meals.length - 1) {
        lines.push("");
      }
    });
  }

  return lines.join("\n");
};

export const downloadTextFile = (filenameBase: string, text: string) => {
  const base = safeFilenameBase(filenameBase);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${base}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
};

export const copyTextToClipboard = async (text: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
};

export const downloadPdfFile = (
  filenameBase: string,
  title: string,
  text: string
) => {
  const base = safeFilenameBase(filenameBase);
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;

  doc.setFont("helvetica", "normal");

  // Title
  doc.setFontSize(16);
  doc.text(String(title ?? "").trim() || base, margin, margin);

  // Body
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(text, maxWidth);

  const lineHeight = 14;
  let y = margin + 28;

  for (const line of lines) {
    if (y + lineHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += lineHeight;
  }

  doc.save(`${base}.pdf`);
};
