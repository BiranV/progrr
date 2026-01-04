export interface Group {
  id: string;
  title: string;
  color: string;
  board_id: string;
  order_index?: number;
  items?: Item[];
}

export interface Board {
  id: string;
  title: string;
  description?: string;
  color?: string;
  icon?: string;
  isPrivate?: boolean;
  visibility?: "private" | "public" | "workspace";
  created_date?: string;
  updated_date?: string;
  columns?: Column[];
  groups?: Group[];
  [key: string]: any;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "client";
  status?: "ACTIVE" | "PENDING";
  [key: string]: any;
}

export interface Item {
  id: string;
  board_id: string;
  group_id: string;
  name: string;
  status?: string;
  priority?: string;
  owner?: string;
  due_date?: string;
  order_index?: number;
  [key: string]: any;
}

export interface Column {
  id: string;
  title: string;
  type: string;
  width?: number;
  options?: any;
  [key: string]: any;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarDataUrl?: string | null;
  birthDate: string;
  gender: string;
  height: string;
  weight: string;
  goal: string;
  activityLevel: string;
  subscription?: string;
  status: string;
  notes?: string;
  // Backward-compatible single assignments
  assignedPlanId?: string;
  assignedMealPlanId?: string;
  // New: multiple assignments
  assignedPlanIds?: string[];
  assignedMealPlanIds?: string[];
  [key: string]: any;
}

export interface Food {
  id: string;
  mealId: string;
  name: string;
  amount?: string;
  protein?: string;
  carbs?: string;
  fat?: string;
  calories?: string;
  order?: number;
  [key: string]: any;
}

// New: reusable food library (admin-managed)
export interface FoodLibrary {
  id: string;
  name: string;
  protein?: string;
  carbs?: string;
  fat?: string;
  calories?: string;
  created_date?: string;
  [key: string]: any;
}

// New: meal-specific assignment of a library food
export interface PlanFood {
  id: string;
  mealId: string;
  foodLibraryId: string;
  amount?: string;
  order?: number;
  created_date?: string;
  [key: string]: any;
}

export interface Meal {
  id: string;
  mealPlanId: string;
  type: string;
  name: string;
  order?: number;
  foods?: Food[];
  [key: string]: any;
}

export interface MealPlan {
  id: string;
  name: string;
  goal?: string;
  dailyCalories?: string;
  dailyProtein?: string;
  dailyCarbs?: string;
  dailyFat?: string;
  notes?: string;
  created_date?: string;
  [key: string]: any;
}

export interface Meeting {
  id: string;
  title: string;
  type: string;
  status: string;
  scheduledAt: string;
  durationMinutes?: number;
  location?: string;
  locationKind?: "link" | "location" | "phone";
  clientId?: string;
  notes?: string;
  [key: string]: any;
}

export interface Message {
  id: string;
  clientId: string;
  text: string;
  senderRole: "admin" | "client";
  readByAdmin?: boolean;
  readByClient?: boolean;
  created_date?: string;
  [key: string]: any;
}

export interface Exercise {
  id: string;
  workoutPlanId: string;
  name: string;
  sets?: string;
  reps?: string;
  order?: number;
  // Legacy fields (kept for backward compatibility)
  videoKind?: "upload" | "youtube" | null;
  videoUrl?: string | null;
  [key: string]: any;
}

// New: reusable exercise library (admin-managed)
export interface ExerciseLibrary {
  id: string;
  name: string;
  guidelines?: string;
  videoKind?: "upload" | "youtube" | null;
  videoUrl?: string | null;
  created_date?: string;
  [key: string]: any;
}

// New: plan-specific assignment of a library exercise
export interface PlanExercise {
  id: string;
  workoutPlanId: string;
  exerciseLibraryId: string;
  sets?: string;
  reps?: string;
  restSeconds?: number;
  order?: number;
  created_date?: string;
  [key: string]: any;
}

export interface WorkoutPlan {
  id: string;
  name: string;
  difficulty?: string;
  duration?: string;
  goal?: string;
  notes?: string;
  created_date?: string;
  [key: string]: any;
}

export interface AppSettings {
  id: string;
  businessName?: string;
  businessDescription?: string;
  webAddress?: string;
  logoUrl?: string;
  clientLabel?: string;
  planLabel?: string;
  mealTypes?: string[];
  weekStartDay?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  [key: string]: any;
}
