import { Suspense } from "react";

import CalendarClient from "./CalendarClient";
import CalendarSkeleton from "./CalendarSkeleton";

export const dynamic = "force-dynamic";

export default function CalendarPage() {
  return (
    <Suspense fallback={<CalendarSkeleton />}>
      <CalendarClient />
    </Suspense>
  );
}
