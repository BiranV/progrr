export type HebrewGreetingKey =
    | "dashboard.greeting.morning"
    | "dashboard.greeting.noon"
    | "dashboard.greeting.afternoon"
    | "dashboard.greeting.evening"
    | "dashboard.greeting.night";

export function getHebrewGreetingKeyByTime(date: Date): HebrewGreetingKey {
    const hour = date.getHours();

    if (hour >= 6 && hour <= 11) return "dashboard.greeting.morning";
    if (hour >= 12 && hour <= 15) return "dashboard.greeting.noon";
    if (hour >= 16 && hour <= 17) return "dashboard.greeting.afternoon";
    if (hour >= 18 && hour <= 21) return "dashboard.greeting.evening";
    return "dashboard.greeting.night";
}
