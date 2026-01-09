export type RapidApiExercise = {
    id: string;
    name: string;
    bodyPart?: string;
    target?: string;
    equipment?: string;
    gifUrl?: string;
    [key: string]: any;
};

export type ExerciseCatalogRow = {
    externalId: string;
    name: string;
    bodyPart?: string;
    targetMuscle?: string;
    equipment?: string;
    gifUrl?: string;
    rawSource?: any;
};

type CacheEntry<T> = {
    expiresAt: number;
    value: T;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, CacheEntry<any>>();

function getCache<T>(key: string): T | undefined {
    const hit = cache.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expiresAt) {
        cache.delete(key);
        return undefined;
    }
    return hit.value as T;
}

function setCache<T>(key: string, value: T) {
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

function normalizeBaseUrl(raw: string) {
    const trimmed = String(raw ?? "").trim().replace(/\/+$/, "");
    if (!trimmed) return "https://exercisedb.p.rapidapi.com";
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

async function rapidApiGetJson<T>(args: {
    baseUrl: string;
    apiKey: string;
    host: string;
    path: string;
    query?: Record<string, string | number | undefined>;
}): Promise<T> {
    const baseUrl = normalizeBaseUrl(args.baseUrl);
    const url = new URL(`${baseUrl}${args.path.startsWith("/") ? "" : "/"}${args.path}`);
    for (const [k, v] of Object.entries(args.query ?? {})) {
        if (v === undefined) continue;
        url.searchParams.set(k, String(v));
    }

    const cacheKey = `GET:${url.toString()}`;
    const cached = getCache<T>(cacheKey);
    if (cached) return cached;

    const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
            "X-RapidAPI-Key": args.apiKey,
            "X-RapidAPI-Host": args.host,
        },
        cache: "no-store",
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
            `ExerciseDB request failed (${res.status})${text ? `: ${text}` : ""}`
        );
    }

    const json = (await res.json()) as T;
    setCache(cacheKey, json);
    return json;
}

export function mapRapidApiExerciseToCatalogRow(ex: RapidApiExercise): ExerciseCatalogRow {
    const externalId = String(ex?.id ?? "").trim();
    return {
        externalId,
        name: String(ex?.name ?? "").trim(),
        bodyPart: String(ex?.bodyPart ?? "").trim() || undefined,
        targetMuscle: String(ex?.target ?? "").trim() || undefined,
        equipment: String(ex?.equipment ?? "").trim() || undefined,
        gifUrl: String(ex?.gifUrl ?? "").trim() || undefined,
        rawSource: ex,
    };
}

export async function searchExercises(query: string, args: {
    apiKey: string;
    host: string;
    baseUrl?: string;
}): Promise<ExerciseCatalogRow[]> {
    const q = String(query ?? "").trim();
    if (!q) return [];

    const json = await rapidApiGetJson<any>({
        baseUrl: args.baseUrl ?? "https://exercisedb.p.rapidapi.com",
        apiKey: args.apiKey,
        host: args.host,
        path: `/exercises/name/${encodeURIComponent(q)}`,
    });

    const list = Array.isArray(json) ? json : [];
    return list
        .map((x: any) => mapRapidApiExerciseToCatalogRow(x as RapidApiExercise))
        .filter((r) => r.externalId && r.name);
}

export async function getExercisesByMuscle(muscle: string, args: {
    apiKey: string;
    host: string;
    baseUrl?: string;
}): Promise<ExerciseCatalogRow[]> {
    const m = String(muscle ?? "").trim();
    if (!m) return [];

    const json = await rapidApiGetJson<any>({
        baseUrl: args.baseUrl ?? "https://exercisedb.p.rapidapi.com",
        apiKey: args.apiKey,
        host: args.host,
        path: `/exercises/target/${encodeURIComponent(m)}`,
    });

    const list = Array.isArray(json) ? json : [];
    return list
        .map((x: any) => mapRapidApiExerciseToCatalogRow(x as RapidApiExercise))
        .filter((r) => r.externalId && r.name);
}

export async function getAllExercises(args: {
    apiKey: string;
    host: string;
    baseUrl?: string;
    limit?: number;
    offset?: number;
}): Promise<ExerciseCatalogRow[]> {
    const json = await rapidApiGetJson<any>({
        baseUrl: args.baseUrl ?? "https://exercisedb.p.rapidapi.com",
        apiKey: args.apiKey,
        host: args.host,
        path: "/exercises",
        query: {
            limit: args.limit ?? 50,
            offset: args.offset ?? 0,
        },
    });

    const list = Array.isArray(json) ? json : [];
    return list
        .map((x: any) => mapRapidApiExerciseToCatalogRow(x as RapidApiExercise))
        .filter((r) => r.externalId && r.name);
}

function uniqSortedStrings(values: any[]): string[] {
    const set = new Set<string>();
    for (const v of values) {
        const s = String(v ?? "").trim();
        if (s) set.add(s);
    }
    return Array.from(set).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base", numeric: true })
    );
}

export async function getBodyPartList(args: {
    apiKey: string;
    host: string;
    baseUrl?: string;
}): Promise<string[]> {
    const json = await rapidApiGetJson<any>({
        baseUrl: args.baseUrl ?? "https://exercisedb.p.rapidapi.com",
        apiKey: args.apiKey,
        host: args.host,
        path: "/exercises/bodyPartList",
    });
    return uniqSortedStrings(Array.isArray(json) ? json : []);
}

export async function getTargetList(args: {
    apiKey: string;
    host: string;
    baseUrl?: string;
}): Promise<string[]> {
    const json = await rapidApiGetJson<any>({
        baseUrl: args.baseUrl ?? "https://exercisedb.p.rapidapi.com",
        apiKey: args.apiKey,
        host: args.host,
        path: "/exercises/targetList",
    });
    return uniqSortedStrings(Array.isArray(json) ? json : []);
}

export async function getEquipmentList(args: {
    apiKey: string;
    host: string;
    baseUrl?: string;
}): Promise<string[]> {
    const json = await rapidApiGetJson<any>({
        baseUrl: args.baseUrl ?? "https://exercisedb.p.rapidapi.com",
        apiKey: args.apiKey,
        host: args.host,
        path: "/exercises/equipmentList",
    });
    return uniqSortedStrings(Array.isArray(json) ? json : []);
}
