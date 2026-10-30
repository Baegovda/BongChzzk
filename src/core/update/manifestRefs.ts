// 빌드된 manifest.json이 가리키는 파일. 글롭은 zip 안에 맞는 파일이 하나라도 있어야 한다.

const addString = (value: unknown, files: Set<string>, globs: Set<string>) => {
    if (typeof value !== "string" || !value) return;
    const path = value.replace(/^\//, "");
    if (path.includes("*")) globs.add(path);
    else files.add(path);
};

const addIcons = (icons: unknown, files: Set<string>, globs: Set<string>) => {
    if (!icons) return;
    if (typeof icons === "string") {
        addString(icons, files, globs);
        return;
    }
    if (typeof icons === "object") {
        Object.values(icons as Record<string, unknown>).forEach((value) => addString(value, files, globs));
    }
};

const globToRegExp = (pattern: string): RegExp => {
    const body = pattern.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*");
    return new RegExp(`^${body}$`);
};

export const manifestReferencedFiles = (
    manifest: Record<string, unknown>,
    zipPaths: string[] = []
): string[] => {
    const files = new Set<string>();
    const globs = new Set<string>();
    const background = manifest.background as { service_worker?: unknown; scripts?: unknown } | undefined;
    addString(background?.service_worker, files, globs);
    if (Array.isArray(background?.scripts)) background.scripts.forEach((value) => addString(value, files, globs));

    const scripts = manifest.content_scripts;
    if (Array.isArray(scripts)) {
        for (const script of scripts) {
            const entry = script as { js?: unknown; css?: unknown };
            if (Array.isArray(entry.js)) entry.js.forEach((value) => addString(value, files, globs));
            if (Array.isArray(entry.css)) entry.css.forEach((value) => addString(value, files, globs));
        }
    }

    const action = (manifest.action ?? manifest.browser_action) as { default_popup?: unknown; default_icon?: unknown } | undefined;
    addString(action?.default_popup, files, globs);
    addIcons(action?.default_icon, files, globs);
    addIcons(manifest.icons, files, globs);

    const optionsUi = manifest.options_ui as { page?: unknown } | undefined;
    addString(optionsUi?.page, files, globs);
    addString(manifest.options_page, files, globs);
    addString(manifest.devtools_page, files, globs);

    const sidePanel = manifest.side_panel as { default_path?: unknown } | undefined;
    addString(sidePanel?.default_path, files, globs);

    const overrides = manifest.chrome_url_overrides;
    if (overrides && typeof overrides === "object") {
        Object.values(overrides as Record<string, unknown>).forEach((value) => addString(value, files, globs));
    }

    const sandbox = manifest.sandbox as { pages?: unknown } | undefined;
    if (Array.isArray(sandbox?.pages)) sandbox.pages.forEach((value) => addString(value, files, globs));

    const resources = manifest.web_accessible_resources;
    if (Array.isArray(resources)) {
        for (const entry of resources) {
            if (typeof entry === "string") {
                addString(entry, files, globs);
                continue;
            }
            const list = (entry as { resources?: unknown }).resources;
            if (Array.isArray(list)) list.forEach((value) => addString(value, files, globs));
        }
    }

    const rules = (manifest.declarative_net_request as { rule_resources?: unknown } | undefined)?.rule_resources;
    if (Array.isArray(rules)) {
        for (const rule of rules) addString((rule as { path?: unknown }).path, files, globs);
    }

    for (const pattern of globs) {
        const matched = zipPaths.some((path) => globToRegExp(pattern).test(path));
        if (!matched) files.add(pattern);
    }

    return [...files];
};
