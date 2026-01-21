export default function CalendarSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="space-y-2">
                <div className="h-7 w-40 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-4 w-64 rounded bg-gray-200 dark:bg-gray-800" />
            </div>

            <div className="h-64 w-full rounded-2xl bg-gray-100 dark:bg-gray-900" />

            <div className="grid grid-cols-3 items-center gap-3">
                <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-4 w-20 justify-self-center rounded bg-gray-200 dark:bg-gray-800" />
                <div className="h-8 w-24 justify-self-end rounded-xl bg-gray-200 dark:bg-gray-800" />
            </div>

            <div className="h-10 w-full rounded-2xl bg-gray-200 dark:bg-gray-800" />

            <div className="space-y-2">
                <div className="h-20 w-full rounded-2xl bg-gray-100 dark:bg-gray-900" />
                <div className="h-20 w-full rounded-2xl bg-gray-100 dark:bg-gray-900" />
                <div className="h-20 w-full rounded-2xl bg-gray-100 dark:bg-gray-900" />
            </div>
        </div>
    );
}
