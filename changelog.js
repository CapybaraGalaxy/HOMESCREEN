(() => {
    const escapeHtml = value => String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    function safeUrl(value) {
        const trimmed = String(value || "").trim();
        if (!trimmed) return null;
        try {
            const url = new URL(trimmed, document.baseURI);
            if (["http:", "https:", "mailto:"].includes(url.protocol)) return url.href;
            if (url.protocol === "file:" && document.baseURI.startsWith("file:")) {
                const appDirectory = new URL(".", document.baseURI).href;
                if (url.href.startsWith(appDirectory)) return url.href;
            }
        } catch (error) {
            return null;
        }
        return null;
    }

    function renderInline(markdown) {
        let text = escapeHtml(markdown);
        text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
        text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");
        text = text.replace(/~~([^~]+)~~/g, "<del>$1</del>");
        text = text.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
        text = text.replace(/(^|[^_])_([^_]+)_/g, "$1<em>$2</em>");
        return text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, rawUrl) => {
            const url = safeUrl(rawUrl);
            return url
                ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`
                : label;
        });
    }

    function renderMarkdown(markdown) {
        const lines = String(markdown ?? "").replace(/\r\n?/g, "\n").split("\n");
        const output = [];
        let paragraph = [];
        let listType = null;
        let codeLines = null;

        const flushParagraph = () => {
            if (!paragraph.length) return;
            output.push(`<p>${paragraph.map(renderInline).join("<br>")}</p>`);
            paragraph = [];
        };
        const closeList = () => {
            if (!listType) return;
            output.push(`</${listType}>`);
            listType = null;
        };

        for (const line of lines) {
            if (line.trim().startsWith("```")) {
                flushParagraph();
                closeList();
                if (codeLines) {
                    output.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
                    codeLines = null;
                } else {
                    codeLines = [];
                }
                continue;
            }
            if (codeLines) {
                codeLines.push(line);
                continue;
            }
            if (!line.trim()) {
                flushParagraph();
                closeList();
                continue;
            }

            const heading = line.match(/^(#{1,4})\s+(.+)$/);
            if (heading) {
                flushParagraph();
                closeList();
                const level = Math.min(heading[1].length + 2, 6);
                output.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
                continue;
            }

            const listItem = line.match(/^\s*([-*+]|\d+\.)\s+(.+)$/);
            if (listItem) {
                flushParagraph();
                const nextListType = /^\d/.test(listItem[1]) ? "ol" : "ul";
                if (listType !== nextListType) {
                    closeList();
                    output.push(`<${nextListType}>`);
                    listType = nextListType;
                }
                output.push(`<li>${renderInline(listItem[2])}</li>`);
                continue;
            }

            const quote = line.match(/^\s*>\s?(.*)$/);
            if (quote) {
                flushParagraph();
                closeList();
                output.push(`<blockquote>${renderInline(quote[1])}</blockquote>`);
                continue;
            }

            closeList();
            paragraph.push(line);
        }

        flushParagraph();
        closeList();
        if (codeLines) output.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        return output.join("");
    }

    function extractVersionPath(release) {
        const value = `${release?.version || ""} ${release?.title || ""}`;
        const match = value.match(/(?:^|[^\w])v?(\d+(?:\.\d+)*)/i);
        if (!match) return [];
        const parts = match[1].replace(/\.$/, "").split(".");
        return parts.map((_, index) => parts.slice(0, index + 1).join("."));
    }

    function versionSearchValue(release) {
        return `${release.version} ${release.title}`.toLocaleLowerCase();
    }

    function filterReleases(releases, query) {
        const normalized = String(query || "").split(">").pop().trim().replace(/^v/i, "").toLocaleLowerCase();
        if (!normalized) return releases;
        return releases.filter(release => {
            const version = release.version.toLocaleLowerCase();
            return versionSearchValue(release).includes(normalized) ||
                (/^[\d.]+$/.test(normalized) && version.replace(/^v/i, "").startsWith(normalized));
        });
    }

    function renderReleaseList(container, releases, selectedVersion, onSelect) {
        container.replaceChildren();
        for (const release of releases) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "changelog-release-link";
            button.classList.toggle("is-selected", release.version === selectedVersion);
            button.setAttribute("aria-pressed", String(release.version === selectedVersion));
            const version = document.createElement("strong");
            version.textContent = release.version;
            const date = document.createElement("span");
            date.textContent = release.date || "Fecha no indicada";
            button.append(version, date);
            button.addEventListener("click", () => onSelect(release));
            container.appendChild(button);
        }
    }

    function renderBreadcrumbs(container, release, onNavigate) {
        container.replaceChildren();
        const path = extractVersionPath(release);
        if (!path.length) {
            container.textContent = release.version;
            return;
        }
        path.forEach((part, index) => {
            if (index) {
                const separator = document.createElement("span");
                separator.className = "changelog-breadcrumb-separator";
                separator.textContent = "›";
                container.appendChild(separator);
            }
            const crumb = document.createElement("button");
            crumb.type = "button";
            crumb.textContent = `v${part}`;
            crumb.setAttribute("aria-label", `Navegar a la versión ${part}`);
            crumb.addEventListener("click", () => onNavigate(part));
            container.appendChild(crumb);
        });
    }

    function appendReleaseHeader(container, release) {
        if (!release.header?.enabled || !release.header.image) return;
        const imageUrl = safeUrl(release.header.image);
        if (!imageUrl) return;
        const figure = document.createElement("figure");
        figure.className = "changelog-hero";
        const image = document.createElement("img");
        image.src = imageUrl;
        image.alt = release.header.alt || `Novedades de ${release.title}`;
        image.loading = "lazy";
        image.addEventListener("error", () => figure.remove(), { once: true });
        figure.appendChild(image);
        container.appendChild(figure);
    }

    function renderReleaseDetail(container, release) {
        container.replaceChildren();
        if (!release) {
            const empty = document.createElement("div");
            empty.className = "changelog-empty-state";
            empty.textContent = "No hay versiones que coincidan con la búsqueda.";
            container.appendChild(empty);
            return;
        }

        appendReleaseHeader(container, release);
        const heading = document.createElement("header");
        heading.className = "changelog-release-heading";
        const title = document.createElement("h2");
        title.textContent = release.title;
        const meta = document.createElement("p");
        meta.textContent = [release.version, release.date].filter(Boolean).join(" · ");
        heading.append(title, meta);
        container.appendChild(heading);

        for (const section of release.sections) {
            const sectionElement = document.createElement("section");
            sectionElement.className = "changelog-section";
            if (section.title) {
                const sectionTitle = document.createElement("h3");
                sectionTitle.textContent = section.title;
                sectionElement.appendChild(sectionTitle);
            }
            const content = document.createElement("div");
            content.className = "changelog-markdown";
            content.innerHTML = renderMarkdown(section.content || "");
            sectionElement.appendChild(content);
            container.appendChild(sectionElement);
        }
    }

    function renderReleaseCard(release, { open = false } = {}) {
        const details = document.createElement("details");
        details.className = "change-release";
        details.open = open;
        const summary = document.createElement("summary");
        summary.textContent = `${release.version}${release.date ? ` · ${release.date}` : ""}`;
        details.appendChild(summary);
        const body = document.createElement("div");
        body.className = "change-release-content changelog-markdown";
        appendReleaseHeader(body, release);
        for (const section of release.sections) {
            const heading = document.createElement("h4");
            heading.textContent = section.title || "Novedades";
            body.appendChild(heading);
            const content = document.createElement("div");
            content.innerHTML = renderMarkdown(section.content || "");
            body.appendChild(content);
        }
        details.appendChild(body);
        return details;
    }

    window.HomescreenChangelog = {
        filterReleases,
        renderMarkdown,
        renderBreadcrumbs,
        renderReleaseCard,
        renderReleaseDetail,
        renderReleaseList
    };
})();
