const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const srcRoot = path.join(root, "src");
const exts = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const ignoreDirs = new Set(["node_modules", ".next", ".git", ".venv", "dist", "build", "out"]);
const specialNames = new Set([
    "page.tsx",
    "page.ts",
    "layout.tsx",
    "layout.ts",
    "route.ts",
    "route.tsx",
    "loading.tsx",
    "loading.ts",
    "error.tsx",
    "error.ts",
    "not-found.tsx",
    "not-found.ts",
    "middleware.ts",
    "template.tsx",
    "template.ts",
    "default.tsx",
    "default.ts",
]);

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (ignoreDirs.has(entry.name)) continue;
            walk(full, out);
        } else if (exts.has(path.extname(entry.name))) {
            out.push(full);
        }
    }
    return out;
}

function resolveImport(importer, spec) {
    if (spec.startsWith("@/") || spec.startsWith("~/")) {
        return path.join(srcRoot, spec.slice(2));
    }
    if (spec.startsWith("./") || spec.startsWith("../")) {
        return path.join(path.dirname(importer), spec);
    }
    return null;
}

function expandCandidates(base) {
    if (path.extname(base)) return [base];
    return [
        base + ".ts",
        base + ".tsx",
        base + ".js",
        base + ".jsx",
        base + ".mjs",
        base + ".cjs",
        path.join(base, "index.ts"),
        path.join(base, "index.tsx"),
        path.join(base, "index.js"),
        path.join(base, "index.jsx"),
    ];
}

const files = walk(srcRoot);
const importRegex = /(?:^|\n)\s*(?:import|export)\s+(?:[^'\"]+\s+from\s+)?['\"]([^'\"]+)['\"]|require\(\s*['\"]([^'\"]+)['\"]\s*\)|import\(\s*['\"]([^'\"]+)['\"]\s*\)/g;

const imports = new Map();
for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const specs = [];
    let m;
    while ((m = importRegex.exec(content))) {
        const spec = m[1] || m[2] || m[3];
        if (spec) specs.push(spec);
    }
    const resolved = [];
    for (const spec of specs) {
        const base = resolveImport(file, spec);
        if (!base) continue;
        for (const cand of expandCandidates(base)) {
            if (fs.existsSync(cand)) {
                resolved.push(path.normalize(cand));
                break;
            }
        }
    }
    imports.set(path.normalize(file), Array.from(new Set(resolved)));
}

const referenced = new Set();
for (const list of imports.values()) {
    for (const r of list) referenced.add(r);
}

const entries = files.map((f) => {
    const rel = f.slice(root.length + 1).replace(/\\/g, "/");
    return {
        fullPath: path.normalize(f),
        relPath: rel,
        isSpecial: specialNames.has(path.basename(f)),
        isReferenced: referenced.has(path.normalize(f)),
    };
});

fs.writeFileSync(path.join(root, "_tmp_unused.json"), JSON.stringify(entries, null, 2));
const unused = entries.filter((e) => !e.isSpecial && !e.isReferenced);
fs.writeFileSync(
    path.join(root, "_tmp_unused_src.json"),
    JSON.stringify(unused, null, 2)
);
console.log("Wrote _tmp_unused.json and _tmp_unused_src.json");
