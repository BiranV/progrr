import { jsPDF } from "jspdf";
import type { Exercise, Food, Meal, MealPlan, WorkoutPlan } from "@/types";

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
  exercises: Exercise[]
) => {
  const lines: string[] = [];

  lines.push(`Workout Plan: ${String(plan.name ?? "").trim() || "-"}`);

  const difficulty = String((plan as any).difficulty ?? "").trim();
  const duration = String((plan as any).duration ?? "").trim();
  const goal = String((plan as any).goal ?? "").trim();

  if (difficulty) lines.push(`Difficulty: ${toTitleCase(difficulty)}`);
  if (duration) lines.push(`Duration: ${duration}`);
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
      const detail =
        sets || reps
          ? `${sets ? `${sets} sets` : ""}${sets && reps ? " × " : ""}${
              reps ? `${reps} reps` : ""
            }`
          : "";
      lines.push(
        `${idx + 1}. ${toTitleCase(name)}${detail ? ` — ${detail}` : ""}`
      );
    });
  }

  return lines.join("\n");
};

export const formatMealPlanText = (
  plan: MealPlan,
  meals: Array<Meal & { foods?: Food[] }>
) => {
  const lines: string[] = [];

  lines.push(`Meal Plan: ${String(plan.name ?? "").trim() || "-"}`);

  const goal = String((plan as any).goal ?? "").trim();
  if (goal) lines.push(`Goal: ${toTitleCase(goal)}`);

  const dailyCalories = String((plan as any).dailyCalories ?? "").trim();
  const dailyProtein = String((plan as any).dailyProtein ?? "").trim();
  const dailyCarbs = String((plan as any).dailyCarbs ?? "").trim();
  const dailyFat = String((plan as any).dailyFat ?? "").trim();

  if (dailyCalories || dailyProtein || dailyCarbs || dailyFat) {
    lines.push("");
    lines.push("Daily targets:");
    if (dailyCalories) lines.push(`- Calories: ${dailyCalories} kcal`);
    if (dailyProtein) lines.push(`- Protein: ${dailyProtein} g`);
    if (dailyCarbs) lines.push(`- Carbs: ${dailyCarbs} g`);
    if (dailyFat) lines.push(`- Fat: ${dailyFat} g`);
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
          ].filter(Boolean);

          const macroSuffix = macros.length ? ` (${macros.join(" • ")})` : "";
          lines.push(
            `   - ${foodIdx + 1}. ${foodName}${
              amount ? ` — ${amount}` : ""
            }${macroSuffix}`.trimEnd()
          );
        });
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
