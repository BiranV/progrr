export type BusinessType = {
  key: string;
  titleKey: string;
  descriptionKey: string;
};

export type ServicePreset = {
  nameKey: string;
  durationMinutes?: number;
};

export const BUSINESS_TYPES: BusinessType[] = [
  {
    key: "hair_salon",
    titleKey: "onboarding.businessTypes.hair_salon.title",
    descriptionKey: "onboarding.businessTypes.hair_salon.description",
  },
  {
    key: "beauty_clinic",
    titleKey: "onboarding.businessTypes.beauty_clinic.title",
    descriptionKey: "onboarding.businessTypes.beauty_clinic.description",
  },
  {
    key: "nails",
    titleKey: "onboarding.businessTypes.nails.title",
    descriptionKey: "onboarding.businessTypes.nails.description",
  },
  {
    key: "tattoo_piercing",
    titleKey: "onboarding.businessTypes.tattoo_piercing.title",
    descriptionKey: "onboarding.businessTypes.tattoo_piercing.description",
  },
  {
    key: "spa_massage",
    titleKey: "onboarding.businessTypes.spa_massage.title",
    descriptionKey: "onboarding.businessTypes.spa_massage.description",
  },
  {
    key: "fitness_coach",
    titleKey: "onboarding.businessTypes.fitness_coach.title",
    descriptionKey: "onboarding.businessTypes.fitness_coach.description",
  },
  {
    key: "nutrition_clinic",
    titleKey: "onboarding.businessTypes.nutrition_clinic.title",
    descriptionKey: "onboarding.businessTypes.nutrition_clinic.description",
  },
  {
    key: "private_lessons",
    titleKey: "onboarding.businessTypes.private_lessons.title",
    descriptionKey: "onboarding.businessTypes.private_lessons.description",
  },
  {
    key: "other",
    titleKey: "onboarding.businessTypes.other.title",
    descriptionKey: "onboarding.businessTypes.other.description",
  },
];

export const SERVICE_PRESETS: Record<string, ServicePreset[]> = {
  hair_salon: [
    {
      nameKey: "onboarding.servicePresets.hair_salon.womensHaircut",
      durationMinutes: 45,
    },
    {
      nameKey: "onboarding.servicePresets.hair_salon.mensHaircut",
      durationMinutes: 30,
    },
    {
      nameKey: "onboarding.servicePresets.hair_salon.blowDryStyling",
      durationMinutes: 45,
    },
    {
      nameKey: "onboarding.servicePresets.hair_salon.hairColor",
      durationMinutes: 90,
    },
    {
      nameKey: "onboarding.servicePresets.hair_salon.highlights",
      durationMinutes: 120,
    },
    {
      nameKey: "onboarding.servicePresets.hair_salon.rootTouchUp",
      durationMinutes: 75,
    },
    {
      nameKey: "onboarding.servicePresets.hair_salon.hairTreatment",
      durationMinutes: 45,
    },
  ],

  beauty_clinic: [
    {
      nameKey: "onboarding.servicePresets.beauty_clinic.skinConsultation",
      durationMinutes: 20,
    },
    {
      nameKey: "onboarding.servicePresets.beauty_clinic.classicFacial",
      durationMinutes: 60,
    },
    {
      nameKey: "onboarding.servicePresets.beauty_clinic.deepCleansingFacial",
      durationMinutes: 75,
    },
    {
      nameKey: "onboarding.servicePresets.beauty_clinic.chemicalPeel",
      durationMinutes: 45,
    },
    {
      nameKey: "onboarding.servicePresets.beauty_clinic.microneedling",
      durationMinutes: 60,
    },
    {
      nameKey: "onboarding.servicePresets.beauty_clinic.ledLightTherapy",
      durationMinutes: 30,
    },
  ],

  nails: [
    {
      nameKey: "onboarding.servicePresets.nails.manicure",
      durationMinutes: 30,
    },
    {
      nameKey: "onboarding.servicePresets.nails.gelManicure",
      durationMinutes: 45,
    },
    {
      nameKey: "onboarding.servicePresets.nails.pedicure",
      durationMinutes: 45,
    },
    {
      nameKey: "onboarding.servicePresets.nails.gelPedicure",
      durationMinutes: 60,
    },
    {
      nameKey: "onboarding.servicePresets.nails.removal",
      durationMinutes: 15,
    },
    {
      nameKey: "onboarding.servicePresets.nails.nailArtAddOn",
      durationMinutes: 15,
    },
  ],

  tattoo_piercing: [
    {
      nameKey: "onboarding.servicePresets.tattoo_piercing.consultation",
      durationMinutes: 20,
    },
    {
      nameKey: "onboarding.servicePresets.tattoo_piercing.smallTattooSession",
      durationMinutes: 60,
    },
    {
      nameKey: "onboarding.servicePresets.tattoo_piercing.mediumTattooSession",
      durationMinutes: 120,
    },
    {
      nameKey: "onboarding.servicePresets.tattoo_piercing.largeTattooSession",
      durationMinutes: 180,
    },
    {
      nameKey: "onboarding.servicePresets.tattoo_piercing.piercing",
      durationMinutes: 30,
    },
    {
      nameKey: "onboarding.servicePresets.tattoo_piercing.jewelryChange",
      durationMinutes: 15,
    },
  ],

  spa_massage: [
    {
      nameKey: "onboarding.servicePresets.spa_massage.relaxationMassage",
      durationMinutes: 60,
    },
    {
      nameKey: "onboarding.servicePresets.spa_massage.deepTissueMassage",
      durationMinutes: 60,
    },
    {
      nameKey: "onboarding.servicePresets.spa_massage.backNeckMassage",
      durationMinutes: 30,
    },
    {
      nameKey: "onboarding.servicePresets.spa_massage.sportsMassage",
      durationMinutes: 60,
    },
    {
      nameKey: "onboarding.servicePresets.spa_massage.bodyScrub",
      durationMinutes: 45,
    },
    {
      nameKey: "onboarding.servicePresets.spa_massage.aromatherapyMassage",
      durationMinutes: 60,
    },
  ],

  fitness_coach: [
    {
      nameKey: "onboarding.servicePresets.fitness_coach.introSession",
      durationMinutes: 30,
    },
    {
      nameKey: "onboarding.servicePresets.fitness_coach.personalTraining",
      durationMinutes: 60,
    },
    {
      nameKey: "onboarding.servicePresets.fitness_coach.strengthTraining",
      durationMinutes: 60,
    },
    {
      nameKey: "onboarding.servicePresets.fitness_coach.progressReview",
      durationMinutes: 30,
    },
  ],
  nutrition_clinic: [
    {
      nameKey: "onboarding.servicePresets.nutrition_clinic.initialConsultation",
      durationMinutes: 45,
    },
    {
      nameKey: "onboarding.servicePresets.nutrition_clinic.personalPlan",
      durationMinutes: 60,
    },
    {
      nameKey: "onboarding.servicePresets.nutrition_clinic.followUp",
      durationMinutes: 30,
    },
    {
      nameKey: "onboarding.servicePresets.nutrition_clinic.planAdjustment",
      durationMinutes: 30,
    },
  ],
  private_lessons: [
    {
      nameKey: "onboarding.servicePresets.private_lessons.mathLesson",
      durationMinutes: 60,
    },
    {
      nameKey: "onboarding.servicePresets.private_lessons.physicsLesson",
      durationMinutes: 60,
    },
    {
      nameKey: "onboarding.servicePresets.private_lessons.artLesson",
      durationMinutes: 60,
    },
    {
      nameKey: "onboarding.servicePresets.private_lessons.languageLesson",
      durationMinutes: 60,
    },
    {
      nameKey: "onboarding.servicePresets.private_lessons.examPrep",
      durationMinutes: 90,
    },
  ],
};
