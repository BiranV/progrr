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
    key: "therapy_wellness",
    title: "Therapy & wellness",
    description: "Therapy, wellness sessions",
  },
  {
    key: "medical_clinic",
    title: "Medical clinic",
    description: "General appointments & checkups",
  },
  {
    key: "dental",
    title: "Dental clinic",
    description: "Dental care & treatments",
  },
  {
    key: "pet_grooming",
    title: "Pet grooming",
    description: "Bath, trim & grooming",
  },
  {
    key: "education_tutoring",
    title: "Education & tutoring",
    description: "Lessons, tutoring sessions",
  },
  {
    key: "photography",
    title: "Photography",
    description: "Photoshoots & studio sessions",
  },
  {
    key: "home_services",
    title: "Home services",
    description: "Technician visits & repairs",
  },
  {
    key: "auto_services",
    title: "Automotive",
    description: "Car services & inspections",
  },
  {
    key: "cleaning",
    title: "Cleaning services",
    description: "Home/office cleaning",
  },
  {
    key: "consulting",
    title: "Consulting",
    description: "Advisory sessions",
  },
  {
    key: "events",
    title: "Events",
    description: "Event bookings & coordination",
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

  therapy_wellness: [
    { name: "Initial consultation", durationMinutes: 20 },
    { name: "Therapy session", durationMinutes: 50 },
    { name: "Couples session", durationMinutes: 60 },
    { name: "Wellness coaching", durationMinutes: 45 },
    { name: "Breathwork session", durationMinutes: 45 },
    { name: "Follow-up session", durationMinutes: 50 },
  ],

  medical_clinic: [
    { name: "New patient intake", durationMinutes: 30 },
    { name: "General consultation", durationMinutes: 20 },
    { name: "Follow-up appointment", durationMinutes: 15 },
    { name: "Annual checkup", durationMinutes: 30 },
    { name: "Vaccination", durationMinutes: 15 },
    { name: "Lab results review", durationMinutes: 15 },
  ],

  dental: [
    { name: "Dental consultation", durationMinutes: 20 },
    { name: "Dental cleaning", durationMinutes: 45 },
    { name: "Filling", durationMinutes: 45 },
    { name: "Tooth extraction", durationMinutes: 45 },
    { name: "Whitening", durationMinutes: 60 },
    { name: "Emergency visit", durationMinutes: 30 },
  ],

  pet_grooming: [
    { name: "Bath & brush", durationMinutes: 45 },
    { name: "Full groom", durationMinutes: 90 },
    { name: "Trim (face/paws)", durationMinutes: 30 },
    { name: "Nail clipping", durationMinutes: 15 },
    { name: "De-shedding treatment", durationMinutes: 45 },
    { name: "Puppy introduction", durationMinutes: 30 },
  ],

  education_tutoring: [
    { name: "Intro call", durationMinutes: 20 },
    { name: "Tutoring session (60 min)", durationMinutes: 60 },
    { name: "Tutoring session (90 min)", durationMinutes: 90 },
    { name: "Homework help", durationMinutes: 60 },
    { name: "Exam prep", durationMinutes: 90 },
  ],

  photography: [
    { name: "Consultation", durationMinutes: 20 },
    { name: "Portrait session", durationMinutes: 60 },
    { name: "Family session", durationMinutes: 90 },
    { name: "Branding session", durationMinutes: 90 },
    { name: "Product photography", durationMinutes: 120 },
    { name: "Mini session", durationMinutes: 30 },
  ],

  home_services: [
    { name: "Site visit / assessment", durationMinutes: 30 },
    { name: "Installation", durationMinutes: 90 },
    { name: "Repair visit", durationMinutes: 60 },
    { name: "Maintenance", durationMinutes: 60 },
    { name: "Emergency call-out", durationMinutes: 60 },
  ],

  auto_services: [
    { name: "Vehicle inspection", durationMinutes: 30 },
    { name: "Oil change", durationMinutes: 30 },
    { name: "Tire change", durationMinutes: 45 },
    { name: "Brake check", durationMinutes: 30 },
    { name: "Battery replacement", durationMinutes: 30 },
    { name: "Diagnostics", durationMinutes: 45 },
  ],

  cleaning: [
    { name: "Home cleaning", durationMinutes: 120 },
    { name: "Deep cleaning", durationMinutes: 180 },
    { name: "Move-in / move-out", durationMinutes: 240 },
    { name: "Office cleaning", durationMinutes: 180 },
    { name: "Post-renovation cleaning", durationMinutes: 240 },
  ],

  consulting: [
    { name: "Discovery call", durationMinutes: 20 },
    { name: "Consultation (30 min)", durationMinutes: 30 },
    { name: "Consultation (60 min)", durationMinutes: 60 },
    { name: "Strategy session", durationMinutes: 90 },
    { name: "Follow-up", durationMinutes: 30 },
  ],

  events: [
    { name: "Intro call", durationMinutes: 20 },
    { name: "Event planning meeting", durationMinutes: 60 },
    { name: "Venue walkthrough", durationMinutes: 60 },
    { name: "Vendor coordination call", durationMinutes: 45 },
    { name: "Day-of coordination", durationMinutes: 240 },
  ],
};
