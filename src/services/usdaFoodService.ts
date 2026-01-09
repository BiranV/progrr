export type UsdaFoodSearchResult = {
    fdcId: number;
    description?: string;
    brandName?: string;
    brandOwner?: string;
    dataType?: string;
    servingSize?: number;
    servingSizeUnit?: string;
    foodNutrients?: Array<{
        nutrientId?: number;
        nutrientName?: string;
        unitName?: string;
        value?: number;
    }>;
};

export type ProgrrFoodLibraryPayload = {
    name: string;

    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;

    fiber?: number;
    sugars?: number;
    saturatedFat?: number;
    transFat?: number;
    cholesterol?: number;
    sodium?: number;
    potassium?: number;
    calcium?: number;
    iron?: number;
    vitaminA?: number;
    vitaminC?: number;
    vitaminD?: number;
    vitaminB12?: number;

    servingSize?: number;
    servingUnit?: string;

    source?: "USDA";
    externalId?: number;

    rawSource?: any;
};

const USDA_SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";

type CacheEntry<T> = { expiresAt: number; value: T };

const getCache = () => {
    const g = globalThis as any;
    if (!g.__progrr_usda_cache) {
        g.__progrr_usda_cache = {
            search: new Map<string, CacheEntry<any>>(),
        };
    }
    return g.__progrr_usda_cache as {
        search: Map<string, CacheEntry<any>>;
    };
};

const TTL_24H = 24 * 60 * 60 * 1000;
const now = () => Date.now();

const norm = (s: unknown) =>
    String(s ?? "")
        .trim()
        .toLowerCase();

const readNutrientValue = (
    nutrients: UsdaFoodSearchResult["foodNutrients"],
    match: (name: string) => boolean
): number | undefined => {
    if (!Array.isArray(nutrients)) return undefined;

    const hit = nutrients.find((n) => {
        const name = norm(n?.nutrientName);
        return name && match(name);
    });

    const v = hit?.value;
    if (typeof v !== "number") return undefined;
    if (!Number.isFinite(v)) return undefined;
    return v;
};

export function mapUsdaFoodToFoodModel(
    usdaFood: UsdaFoodSearchResult,
    rawSource?: any
): ProgrrFoodLibraryPayload {
    const name = String(usdaFood?.description ?? "").trim();

    const nutrients = usdaFood?.foodNutrients;

    const calories = readNutrientValue(nutrients, (n) =>
        n === "energy" || n.includes("energy")
    );
    const protein = readNutrientValue(nutrients, (n) => n === "protein");
    const carbs = readNutrientValue(nutrients, (n) =>
        n.includes("carbohydrate")
    );
    const fat = readNutrientValue(nutrients, (n) => n.includes("total lipid"));

    const fiber = readNutrientValue(nutrients, (n) => n.includes("fiber"));
    const sugars = readNutrientValue(nutrients, (n) => n.startsWith("sugars"));
    const saturatedFat = readNutrientValue(nutrients, (n) =>
        n.includes("saturated")
    );
    const transFat = readNutrientValue(nutrients, (n) => n.includes("trans"));
    const cholesterol = readNutrientValue(nutrients, (n) =>
        n.includes("cholesterol")
    );

    const sodium = readNutrientValue(nutrients, (n) => n.startsWith("sodium"));
    const potassium = readNutrientValue(nutrients, (n) =>
        n.startsWith("potassium")
    );
    const calcium = readNutrientValue(nutrients, (n) => n.startsWith("calcium"));
    const iron = readNutrientValue(nutrients, (n) => n.startsWith("iron"));

    const vitaminA = readNutrientValue(nutrients, (n) => n.includes("vitamin a"));
    const vitaminC = readNutrientValue(nutrients, (n) => n.includes("vitamin c"));
    const vitaminD = readNutrientValue(nutrients, (n) => n.includes("vitamin d"));
    const vitaminB12 = readNutrientValue(nutrients, (n) => n.includes("vitamin b-12"));

    const servingSize =
        typeof usdaFood?.servingSize === "number" &&
            Number.isFinite(usdaFood.servingSize)
            ? usdaFood.servingSize
            : undefined;
    const servingUnit = String(usdaFood?.servingSizeUnit ?? "").trim() || undefined;

    return {
        name,

        calories,
        protein,
        carbs,
        fat,

        fiber,
        sugars,
        saturatedFat,
        transFat,
        cholesterol,
        sodium,
        potassium,
        calcium,
        iron,
        vitaminA,
        vitaminC,
        vitaminD,
        vitaminB12,

        servingSize,
        servingUnit,

        source: "USDA",
        externalId:
            typeof usdaFood?.fdcId === "number" && Number.isFinite(usdaFood.fdcId)
                ? usdaFood.fdcId
                : undefined,

        rawSource,
    };
}

export async function searchFoods(args: {
    query: string;
    apiKey: string;
    pageSize?: number;
}): Promise<{ totalHits: number; foods: UsdaFoodSearchResult[]; raw: any }> {
    const query = String(args.query ?? "").trim();
    if (!query) return { totalHits: 0, foods: [], raw: null };

    const cacheKey = `${norm(query)}::${args.pageSize ?? 25}`;
    const cache = getCache();
    const existing = cache.search.get(cacheKey);
    if (existing && existing.expiresAt > now()) {
        return existing.value;
    }

    const url = new URL(USDA_SEARCH_URL);
    url.searchParams.set("api_key", args.apiKey);

    const res = await fetch(url.toString(), {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            query,
            pageSize: Math.min(50, Math.max(1, Number(args.pageSize ?? 25))),
            // Keep broad results; admins can refine by search.
        }),
        cache: "no-store",
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg =
            payload?.message || payload?.error || `USDA request failed (${res.status})`;
        const err: any = new Error(msg);
        err.status = 502;
        throw err;
    }

    const foods = Array.isArray(payload?.foods) ? payload.foods : [];
    const totalHits = Number.isFinite(payload?.totalHits)
        ? payload.totalHits
        : foods.length;

    const value = {
        totalHits,
        foods: foods as UsdaFoodSearchResult[],
        raw: payload,
    };

    cache.search.set(cacheKey, { expiresAt: now() + TTL_24H, value });
    return value;
}
