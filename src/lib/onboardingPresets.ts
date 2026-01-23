export type BusinessType = {
  key: string;
  title: string;
  description: string;
};

export type ServicePreset = {
  name: string;
  durationMinutes?: number;
};

export const BUSINESS_TYPES: BusinessType[] = [
  {
    key: "barbershop",
    title: "Barbershop",
    description: "Men’s haircuts & grooming",
  },
  {
    key: "hair_salon",
    title: "Hair salon",
    description: "Cuts, color & styling",
  },
  {
    key: "beauty_clinic",
    title: "Beauty clinic",
    description: "Skincare & aesthetic treatments",
  },
  {
    key: "nails",
    title: "Nails studio",
    description: "Manicure, pedicure & gel",
  },
  {
    key: "tattoo_piercing",
    title: "Tattoo & piercing",
    description: "Ink sessions & piercings",
  },
  {
    key: "spa_massage",
    title: "Spa & massage",
    description: "Massage & body treatments",
  },
  {
    key: "fitness_coaching",
    title: "Fitness & coaching",
    description: "Training, coaching sessions",
  },
  {
    key: "other",
    title: "Other",
    description: "Custom business",
  },
];

export const SERVICE_PRESETS: Record<string, ServicePreset[]> = {
  barbershop: [
    { name: "Men’s haircut", durationMinutes: 30 },
    { name: "Beard trim", durationMinutes: 15 },
    { name: "Haircut + beard", durationMinutes: 45 },
    { name: "Kids haircut", durationMinutes: 20 },
    { name: "Line-up / shape-up", durationMinutes: 15 },
    { name: "Hot towel shave", durationMinutes: 30 },
  ],

  hair_salon: [
    { name: "Women’s haircut", durationMinutes: 45 },
    { name: "Men’s haircut", durationMinutes: 30 },
    { name: "Blow-dry & styling", durationMinutes: 45 },
    { name: "Hair color", durationMinutes: 90 },
    { name: "Highlights", durationMinutes: 120 },
    { name: "Root touch-up", durationMinutes: 75 },
    { name: "Hair treatment", durationMinutes: 45 },
  ],

  beauty_clinic: [
    { name: "Skin consultation", durationMinutes: 20 },
    { name: "Classic facial", durationMinutes: 60 },
    { name: "Deep cleansing facial", durationMinutes: 75 },
    { name: "Chemical peel", durationMinutes: 45 },
    { name: "Microneedling", durationMinutes: 60 },
    { name: "LED light therapy", durationMinutes: 30 },
  ],

  nails: [
    { name: "Manicure", durationMinutes: 30 },
    { name: "Gel manicure", durationMinutes: 45 },
    { name: "Pedicure", durationMinutes: 45 },
    { name: "Gel pedicure", durationMinutes: 60 },
    { name: "Removal", durationMinutes: 15 },
    { name: "Nail art add-on", durationMinutes: 15 },
  ],

  tattoo_piercing: [
    { name: "Consultation", durationMinutes: 20 },
    { name: "Small tattoo session", durationMinutes: 60 },
    { name: "Medium tattoo session", durationMinutes: 120 },
    { name: "Large tattoo session", durationMinutes: 180 },
    { name: "Piercing", durationMinutes: 30 },
    { name: "Jewelry change", durationMinutes: 15 },
  ],

  spa_massage: [
    { name: "Relaxation massage", durationMinutes: 60 },
    { name: "Deep tissue massage", durationMinutes: 60 },
    { name: "Back & neck massage", durationMinutes: 30 },
    { name: "Sports massage", durationMinutes: 60 },
    { name: "Body scrub", durationMinutes: 45 },
    { name: "Aromatherapy massage", durationMinutes: 60 },
  ],

  fitness_coaching: [
    { name: "Intro session", durationMinutes: 30 },
    { name: "Personal training", durationMinutes: 60 },
    { name: "Strength training", durationMinutes: 60 },
    { name: "Mobility session", durationMinutes: 45 },
    { name: "Nutrition check-in", durationMinutes: 30 },
    { name: "Progress review", durationMinutes: 30 },
  ],
};
