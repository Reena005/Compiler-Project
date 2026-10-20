/**
 * MiniLang-X — Parser Lab Foundation (Phase 2: Top-Down Parsing)
 * Client-side Controller for Grammar Editing, FIRST/FOLLOW Sets,
 * LL(1) Predictive Parsing Table & Trace, Parse Tree Visualizer,
 * and Recursive Descent Parser with Left Recursion Guard.
 */

(function () {
    // DOM Elements - Workspaces
    const navPipelineTab = document.getElementById("nav-pipeline-tab");
    const navParserLabTab = document.getElementById("nav-parser-lab-tab");
    const pipelineWorkspace = document.getElementById("pipeline-workspace");
    const parserLabWorkspace = document.getElementById("parser-lab-workspace");

    // DOM Elements - Parser Lab Controls
    const grammarEditor = document.getElementById("grammar-editor");
    const grammarLineNumbers = document.getElementById("grammar-line-numbers");
    const grammarPresetSelect = document.getElementById("grammar-preset-select");
    const grammarStartSymbol = document.getElementById("grammar-start-symbol");
    const parserInputString = document.getElementById("parser-input-string");
    const parserEngineSelect = document.getElementById("parser-engine-select");

    // Buttons
    const btnValidateGrammar = document.getElementById("btn-validate-grammar");
    const btnComputeFirstFollow = document.getElementById("btn-compute-first-follow");
    const btnGenerateLL1Table = document.getElementById("btn-generate-ll1-table");
    const btnParseInput = document.getElementById("btn-parse-input");

    // Views & Status
    const grammarStatusPill = document.getElementById("grammar-status-pill");
    const grammarStatusText = document.getElementById("grammar-status-text");
    const parserLabViewTitle = document.getElementById("parser-lab-view-title");
    const parserLabContent = document.getElementById("parser-lab-content");
    const tabNav = document.querySelector(".parser-lab-tab-nav");

    // Built-in Grammar Presets
    const grammarPresets = {
        ll1_expr: {
            start: "E",
            grammar: "E -> T EPrime\nEPrime -> + T EPrime | ε\nT -> id",
            input: "id + id",
            engine: "ll1"
        },
        left_rec: {
            start: "E",
            grammar: "E -> E + T | T\nT -> id",
            input: "id + id",
            engine: "ll1"
        },
        expr: {
            start: "E",
            grammar: "E -> T EPrime\nEPrime -> + T EPrime | ε\nT -> F TPrime\nTPrime -> * F TPrime | ε\nF -> ( E ) | id",
            input: "id + id * id",
            engine: "ll1"
        },
        nullable: {
            start: "S",
            grammar: "S -> A B C\nA -> a | eps\nB -> b | eps\nC -> c | eps",
            input: "a b c",
            engine: "ll1"
        },
        simple: {
            start: "S",
            grammar: "S -> a A\nA -> b | eps",
            input: "a b",
            engine: "ll1"
        },
        invalid: {
            start: "S",
            grammar: "S -> a B\nMalformedLineWithoutArrow\nC -> c eps d",
            input: "a",
            engine: "ll1"
        }
    };

    // State Store
    const state = {
        activeTab: "grammar",
        lastValidation: null,
        lastFirstFollow: null,
        lastLL1Table: null,
        lastLL1Parse: null,
        lastRDParse: null,
        lastParseTree: null
    };

    function escapeHTML(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Workspace Switching
    if (navPipelineTab && navParserLabTab) {
        navPipelineTab.addEventListener("click", function () {
            navPipelineTab.classList.add("active");
            navPipelineTab.setAttribute("aria-selected", "true");
            navParserLabTab.classList.remove("active");
            navParserLabTab.setAttribute("aria-selected", "false");

            if (pipelineWorkspace) pipelineWorkspace.style.display = "block";
            if (parserLabWorkspace) parserLabWorkspace.style.display = "none";
        });

        navParserLabTab.addEventListener("click", function () {
            navParserLabTab.classList.add("active");
            navParserLabTab.setAttribute("aria-selected", "true");
            navPipelineTab.classList.remove("active");
            navPipelineTab.setAttribute("aria-selected", "false");

            if (pipelineWorkspace) pipelineWorkspace.style.display = "none";
            if (parserLabWorkspace) parserLabWorkspace.style.display = "block";
        });
    }

    // Line Number Synchronization
    function updateGrammarLineNumbers() {
        if (!grammarEditor || !grammarLineNumbers) return;
        const lines = grammarEditor.value.split("\n").length;
        grammarLineNumbers.textContent = Array.from(
            { length: lines },
            (_, index) => index + 1
        ).join("\n");
    }

    if (grammarEditor) {
        grammarEditor.addEventListener("input", function () {
            updateGrammarLineNumbers();
            if (grammarPresetSelect) {
                grammarPresetSelect.value = "custom";
            }
        });

        grammarEditor.addEventListener("scroll", function () {
            if (grammarLineNumbers) {
                grammarLineNumbers.scrollTop = grammarEditor.scrollTop;
            }
        });
    }

    // Preset Selection
    if (grammarPresetSelect) {
        grammarPresetSelect.addEventListener("change", function () {
            const presetKey = grammarPresetSelect.value;
            if (presetKey in grammarPresets) {
                const preset = grammarPresets[presetKey];
                grammarEditor.value = preset.grammar;
                if (grammarStartSymbol) {
                    grammarStartSymbol.value = preset.start;
                }
                if (parserInputString && preset.input) {
                    parserInputString.value = preset.input;
                }
                if (parserEngineSelect && preset.engine) {
                    parserEngineSelect.value = preset.engine;
                }
                updateGrammarLineNumbers();
                setGrammarStatus(null, "Preset Loaded");
            }
        });
    }

    // Status Helper
    function setGrammarStatus(status, text) {
        if (!grammarStatusPill || !grammarStatusText) return;
        grammarStatusPill.classList.remove("is-running", "is-success", "is-error");
        if (status) {
            grammarStatusPill.classList.add(`is-${status}`);
        }
        grammarStatusText.textContent = text;
    }

    // Tab Switching
    function setActiveTab(tabKey) {
        state.activeTab = tabKey;
        const tabBtns = document.querySelectorAll(".lab-tab-btn");
        tabBtns.forEach(btn => {
            if (btn.getAttribute("data-view") === tabKey) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });

        const titles = {
            "grammar": "Grammar Specification & Validation",
            "first-follow": "FIRST and FOLLOW Sets",
            "ll1-table": "LL(1) Predictive Parsing Table",
            "trace": "Parsing Execution Trace",
            "parse-tree": "Parse Tree Derivation",
            "recursive-descent": "Recursive Descent Analysis"
        };

        if (parserLabViewTitle) {
            parserLabViewTitle.textContent = titles[tabKey] || "Top-Down Parsing";
        }

        renderActiveTab();
    }

    if (tabNav) {
        tabNav.addEventListener("click", function (e) {
            const btn = e.target.closest(".lab-tab-btn");
            if (btn) {
                const tabKey = btn.getAttribute("data-view");
                if (tabKey) {
                    setActiveTab(tabKey);
                }
            }
        });
    }

    // API Call Helper
    async function callParserLabAPI(endpoint, payload) {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        let data;
        try {
            data = await response.json();
        } catch (e) {
            throw new Error("Invalid response received from parser lab service.");
        }

        if (!response.ok && data.error) {
            throw new Error(data.error);
        }

        return data;
    }

    // ==========================================
    // Rendering Helpers
    // ==========================================

    function renderDiagnostics(diagnostics) {
        if (!diagnostics || diagnostics.length === 0) {
            return `
                <div class="semantic-status success">
                    ✓ Grammar syntax and symbol definitions validated successfully with zero errors.
                </div>
            `;
        }

        const hasErrors = diagnostics.some(d => d.severity === "error");
        const statusClass = hasErrors ? "error" : "success";
        const statusMsg = hasErrors ? "✕ Grammar Validation Failed" : "✓ Grammar Valid (with warnings)";

        const items = diagnostics.map(d => {
            const isErr = d.severity === "error";
            const badgeClass = isErr ? "diag-pill-error" : "diag-pill-warning";
            const locText = d.line ? `Line ${d.line}` : "Grammar-level";
            return `
                <div class="grammar-diagnostic-item ${d.severity}">
                    <div class="diag-header">
                        <span class="diag-badge ${badgeClass}">${escapeHTML(d.severity.toUpperCase())}</span>
                        <span class="diag-loc">${escapeHTML(locText)}</span>
                        ${d.symbol ? `<span class="diag-sym">Symbol: <code>${escapeHTML(d.symbol)}</code></span>` : ""}
                    </div>
                    <div class="diag-msg">${escapeHTML(d.message)}</div>
                </div>
            `;
        }).join("");

        return `
            <div class="semantic-status ${statusClass}">${statusMsg}</div>
            <div class="grammar-diagnostics-container">${items}</div>
        `;
    }

    function renderSummaryCards(data) {
        const nonterminals = data.nonterminals || [];
        const terminals = data.terminals || [];
        const productions = data.productions || [];
        const startSymbol = data.start_symbol || "—";
        const nullableMap = data.nullable || {};
        const nullableCount = Object.values(nullableMap).filter(Boolean).length;

        return `
            <div class="parser-lab-metrics-grid">
                <div class="metric-card">
                    <span class="metric-label">Start Symbol</span>
                    <span class="metric-val"><code>${escapeHTML(startSymbol)}</code></span>
                </div>
                <div class="metric-card">
                    <span class="metric-label">Productions</span>
                    <span class="metric-val">${productions.length}</span>
                </div>
                <div class="metric-card">
                    <span class="metric-label">Nonterminals</span>
                    <span class="metric-val">${nonterminals.length}</span>
                </div>
                <div class="metric-card">
                    <span class="metric-label">Terminals</span>
                    <span class="metric-val">${terminals.length}</span>
                </div>
                <div class="metric-card">
                    <span class="metric-label">Nullable Nonterminals</span>
                    <span class="metric-val">${nullableCount}</span>
                </div>
            </div>
        `;
    }

    function renderProductions(productions) {
        if (!productions || productions.length === 0) return "";

        const rows = productions.map((prod, idx) => {
            const rhsFormatted = (prod.rhs || []).map(sym => {
                if (sym === "ε") {
                    return `<span class="symbol-pill symbol-pill-epsilon">ε</span>`;
                }
                return `<code class="grammar-sym">${escapeHTML(sym)}</code>`;
            }).join(" ");

            return `
                <tr>
                    <td style="width: 50px;">${idx + 1}</td>
                    <td style="width: 140px;"><strong><code>${escapeHTML(prod.lhs)}</code></strong></td>
                    <td style="width: 30px; text-align: center; color: var(--text-subtle);">➔</td>
                    <td>${rhsFormatted}</td>
                </tr>
            `;
        }).join("");

        return `
            <div class="tac-table-wrapper" style="margin-top: 18px;">
                <div class="tac-title">Normalized Production Rules (${productions.length})</div>
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>LHS</th>
                            <th></th>
                            <th>RHS Derivation</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    }

    function renderVocabulary(data) {
        const nonterminals = data.nonterminals || [];
        const terminals = data.terminals || [];

        const ntPills = nonterminals.map(nt =>
            `<span class="symbol-pill symbol-pill-nonterminal">${escapeHTML(nt)}</span>`
        ).join(" ") || "None";

        const termPills = terminals.map(t =>
            `<span class="symbol-pill symbol-pill-terminal">${escapeHTML(t)}</span>`
        ).join(" ") || "None";

        return `
            <div class="grammar-vocab-panel" style="margin-top: 18px;">
                <div class="vocab-row">
                    <strong>Nonterminals (V_N):</strong>
                    <div class="vocab-pills">${ntPills}</div>
                </div>
                <div class="vocab-row" style="margin-top: 10px;">
                    <strong>Terminals (V_T):</strong>
                    <div class="vocab-pills">${termPills}</div>
                </div>
            </div>
        `;
    }

    function renderFirstFollowTable(data) {
        const nonterminals = data.nonterminals || [];
        const firstMap = data.first || {};
        const followMap = data.follow || {};
        const nullableMap = data.nullable || {};

        if (!data.first || Object.keys(firstMap).length === 0) {
            return `
                <div class="parser-lab-empty-state">
                    <h3>No FIRST / FOLLOW Sets Available</h3>
                    <p>Click <strong>FIRST / FOLLOW</strong> on the left to compute iterative fixed-point sets.</p>
                </div>
            `;
        }

        const rows = nonterminals.map(nt => {
            const firstSet = firstMap[nt] || [];
            const followSet = followMap[nt] || [];
            const isNullable = Boolean(nullableMap[nt]);

            const firstPills = firstSet.length
                ? firstSet.map(sym => {
                    const cls = sym === "ε" ? "symbol-pill-epsilon" : "symbol-pill-terminal";
                    return `<span class="symbol-pill ${cls}">${escapeHTML(sym)}</span>`;
                }).join(" ")
                : `<span class="text-muted">∅</span>`;

            const followPills = followSet.length
                ? followSet.map(sym => {
                    const cls = sym === "$" ? "symbol-pill-end" : "symbol-pill-terminal";
                    return `<span class="symbol-pill ${cls}">${escapeHTML(sym)}</span>`;
                }).join(" ")
                : `<span class="text-muted">∅</span>`;

            const nullableBadge = isNullable
                ? `<span class="nullable-tag nullable-yes">✓ True (ε ∈ FIRST)</span>`
                : `<span class="nullable-tag nullable-no">False</span>`;

            return `
                <tr>
                    <td><strong><code>${escapeHTML(nt)}</code></strong></td>
                    <td>${nullableBadge}</td>
                    <td><div class="set-symbols-wrap">${firstPills}</div></td>
                    <td><div class="set-symbols-wrap">${followPills}</div></td>
                </tr>
            `;
        }).join("");

        return `
            <div class="tac-table-wrapper" style="margin-top: 10px;">
                <div class="tac-title">FIRST and FOLLOW Sets</div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 140px;">Nonterminal</th>
                            <th style="width: 170px;">Nullable?</th>
                            <th>FIRST(X)</th>
                            <th>FOLLOW(X)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    }

    function renderLL1TableView(data) {
        if (!data) {
            return `
                <div class="parser-lab-empty-state">
                    <h3>No LL(1) Table Generated Yet</h3>
                    <p>Click <strong>Generate Table</strong> on the left to compute the predictive parsing table M[A, a] and detect cell conflicts.</p>
                </div>
            `;
        }

        const isLL1 = data.is_ll1;
        const conflicts = data.conflicts || [];
        const nonterminals = data.nonterminals || [];
        const terminals = data.terminals || [];
        const table = data.table || {};

        let statusHtml = isLL1
            ? `<div class="semantic-status success">✓ Valid LL(1) Grammar — Zero conflicts detected in parsing table M[A, a].</div>`
            : `<div class="semantic-status error">✕ Grammar is NOT LL(1) — ${conflicts.length} conflict(s) detected in parsing table.</div>`;

        // Conflict Explanations
        let conflictHtml = "";
        if (conflicts.length > 0) {
            const cards = conflicts.map(c => {
                const prodPills = (c.productions || []).map(p =>
                    `<span class="prod-cell-pill conflict-pill">${escapeHTML(p.lhs)} ➔ ${escapeHTML((p.rhs || []).join(" "))}</span>`
                ).join(" ");

                return `
                    <div class="ll1-conflict-card">
                        <div class="ll1-conflict-card-header">
                            <span class="conflict-badge">${escapeHTML(c.conflict_type)} CONFLICT</span>
                            <span>Cell M[<strong>${escapeHTML(c.nonterminal)}</strong>, <code>${escapeHTML(c.terminal)}</code>]</span>
                        </div>
                        <div class="diag-msg">${escapeHTML(c.message)}</div>
                        <div class="ll1-conflict-prods">
                            <strong>Competing rules:</strong> ${prodPills}
                        </div>
                    </div>
                `;
            }).join("");

            conflictHtml = `
                <div class="ll1-conflicts-container">
                    <h3 style="margin: 0; font-size: 13px; font-weight: 700; color: var(--error-text);">
                        Table Conflicts (${conflicts.length})
                    </h3>
                    ${cards}
                </div>
            `;
        }

        // 2D Table Generation
        const thCols = terminals.map(t =>
            `<th><code>${escapeHTML(t)}</code></th>`
        ).join("");

        const bodyRows = nonterminals.map(nt => {
            const rowData = table[nt] || {};
            const cellTds = terminals.map(t => {
                const prods = rowData[t] || [];
                if (prods.length === 0) {
                    return `<td class="cell-empty">—</td>`;
                }
                const hasConflict = prods.length > 1;
                const cellClass = hasConflict ? "cell-conflict" : "cell-rule";

                const prodsHtml = prods.map(p => {
                    const rhs = (p.rhs || []).map(s => s === "ε" ? "ε" : s).join(" ");
                    const pillClass = hasConflict ? "prod-cell-pill conflict-pill" : "prod-cell-pill";
                    return `<div class="${pillClass}"><strong>${escapeHTML(p.lhs)}</strong> ➔ ${escapeHTML(rhs)}</div>`;
                }).join("");

                return `
                    <td class="${cellClass}">
                        ${hasConflict ? `<span class="conflict-badge">CONFLICT (${prods.length})</span><br>` : ""}
                        ${prodsHtml}
                    </td>
                `;
            }).join("");

            return `
                <tr>
                    <td class="nt-row-header"><strong><code>${escapeHTML(nt)}</code></strong></td>
                    ${cellTds}
                </tr>
            `;
        }).join("");

        return `
            ${statusHtml}
            ${conflictHtml}
            <div class="ll1-table-wrapper">
                <table class="ll1-table">
                    <thead>
                        <tr>
                            <th class="nt-col-header">Nonterminal</th>
                            ${thCols}
                        </tr>
                    </thead>
                    <tbody>
                        ${bodyRows}
                    </tbody>
                </table>
            </div>
        `;
    }

    function renderTraceView(parseData, parseType = "ll1") {
        if (!parseData) {
            return `
                <div class="parser-lab-empty-state">
                    <h3>No Parsing Execution Trace Available</h3>
                    <p>Enter an input string on the left (e.g. <code>id + id</code>) and click <strong>Parse Input</strong>.</p>
                </div>
            `;
        }

        const accepted = parseData.accepted;
        const tokens = parseData.tokens || [];
        const trace = parseData.trace || [];
        const error = parseData.error;

        const tokenPills = tokens.map(t =>
            `<span class="symbol-pill symbol-pill-terminal">${escapeHTML(t)}</span>`
        ).join(" ") + ` <span class="symbol-pill symbol-pill-end">$</span>`;

        let statusBanner = accepted
            ? `<div class="semantic-status success">✓ Input Tokens Accepted — Derivation completed successfully!</div>`
            : `<div class="semantic-status error">✕ Parsing Rejected — ${escapeHTML(error || "Syntax error during parsing.")}</div>`;

        if (parseType === "rd" && parseData.has_left_recursion) {
            const lr = parseData.left_recursion || {};
            statusBanner = `
                <div class="left-recursion-box">
                    <div class="left-recursion-header">
                        <span>⚠️ Left Recursion Detected</span>
                    </div>
                    <div class="left-recursion-body">
                        ${escapeHTML(lr.explanation || "Conventional predictive top-down recursive descent cannot directly parse left-recursive grammars.")}
                    </div>
                </div>
                ${statusBanner}
            `;
        }

        let traceRows = "";
        if (parseType === "ll1") {
            traceRows = trace.map(s => {
                const stackStr = (s.stack || []).map(x => escapeHTML(x)).join(" ");
                const remStr = (s.remaining_input || []).map(x => escapeHTML(x)).join(" ");
                const actionBadgeClass = `trace-action-${s.status || "expand"}`;
                const rowClass = `trace-step-${s.status || "expand"}`;

                return `
                    <tr class="${rowClass}">
                        <td style="width: 50px;">${s.step}</td>
                        <td style="font-weight: 600;"><code>${stackStr}</code></td>
                        <td><code>${remStr}</code></td>
                        <td>
                            <span class="trace-action-badge ${actionBadgeClass}">${escapeHTML(s.action)}</span>
                            ${s.production ? `<span style="margin-left: 6px; font-weight: 600;">(${escapeHTML(s.production)})</span>` : ""}
                        </td>
                    </tr>
                `;
            }).join("");

            return `
                ${statusBanner}
                <div style="margin: 12px 0; font-size: 12px;">
                    <strong>Tokenized Input Stream:</strong> ${tokenPills}
                </div>
                <div class="trace-table-wrapper">
                    <table class="trace-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Stack (Top ➔ Bottom)</th>
                                <th>Remaining Input</th>
                                <th>Action &amp; Rule Applied</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${traceRows}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            // Recursive Descent Trace
            traceRows = trace.map(s => {
                const actionBadgeClass = `trace-action-${s.status || "expand"}`;
                const rowClass = `trace-step-${s.status || "expand"}`;
                const indent = "&nbsp;&nbsp;".repeat(Math.max(0, (s.depth || 1) - 1));

                return `
                    <tr class="${rowClass}">
                        <td style="width: 50px;">${s.step}</td>
                        <td style="width: 60px;">${s.depth}</td>
                        <td>${indent}<span class="trace-action-badge ${actionBadgeClass}">${escapeHTML(s.action)}</span></td>
                        <td><code>${escapeHTML(s.lookahead || "—")}</code></td>
                        <td><strong>${escapeHTML(s.status || "")}</strong></td>
                    </tr>
                `;
            }).join("");

            return `
                ${statusBanner}
                <div style="margin: 12px 0; font-size: 12px;">
                    <strong>Tokenized Input Stream:</strong> ${tokenPills}
                </div>
                <div class="trace-table-wrapper">
                    <table class="trace-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Depth</th>
                                <th>Procedure / Action</th>
                                <th>Lookahead</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${traceRows}
                        </tbody>
                    </table>
                </div>
            `;
        }
    }

    function renderParseTreeNode(node, prefix = "", isLast = true) {
        if (!node) return "";

        const connector = isLast ? "└── " : "├── ";
        const childPrefix = prefix + (isLast ? "    " : "│   ");

        let badgeClass = "tree-node-nonterminal";
        if (node.is_terminal) {
            badgeClass = node.label === "ε" ? "tree-node-epsilon" : "tree-node-terminal";
        }

        let html = `
            <div class="tree-row">
                <span class="tree-indent-guide">${prefix}${connector}</span>
                <span class="tree-node-chip ${badgeClass}">
                    ${node.is_terminal ? "Leaf: " : "Node: "}
                    <strong>${escapeHTML(node.label)}</strong>
                </span>
            </div>
        `;

        const children = node.children || [];
        for (let i = 0; i < children.length; i++) {
            const isChildLast = i === children.length - 1;
            html += renderParseTreeNode(children[i], childPrefix, isChildLast);
        }

        return html;
    }

    function renderParseTreeView(parseTree) {
        if (!parseTree) {
            return `
                <div class="parser-lab-empty-state">
                    <h3>No Parse Tree Generated</h3>
                    <p>Parse trees are constructed when an input sequence is successfully parsed by the LL(1) or Recursive Descent parser.</p>
                </div>
            `;
        }

        return `
            <div class="parse-tree-container">
                <div class="parse-tree-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                        <polygon points="12 2 2 22 22 22"></polygon>
                    </svg>
                    <span>Concrete Syntax Derivation Tree</span>
                </div>
                <div class="tree-view">
                    ${renderParseTreeNode(parseTree, "", true)}
                </div>
            </div>
        `;
    }

    function renderRecursiveDescentView(rdData) {
        if (!rdData) {
            return `
                <div class="parser-lab-empty-state">
                    <h3>Recursive Descent Parser Not Run Yet</h3>
                    <p>Select <strong>Recursive Descent Parser</strong> as the engine and click <strong>Parse Input</strong> on the left.</p>
                </div>
            `;
        }

        return renderTraceView(rdData, "rd");
    }

    function renderActiveTab() {
        if (!parserLabContent) return;

        switch (state.activeTab) {
            case "grammar":
                if (state.lastValidation) {
                    parserLabContent.innerHTML = `
                        ${renderDiagnostics(state.lastValidation.diagnostics)}
                        ${state.lastValidation.valid ? renderSummaryCards(state.lastValidation) : ""}
                        ${state.lastValidation.valid ? renderVocabulary(state.lastValidation) : ""}
                        ${state.lastValidation.valid ? renderProductions(state.lastValidation.productions) : ""}
                    `;
                } else {
                    parserLabContent.innerHTML = `
                        <div class="parser-lab-empty-state">
                            <h3>Ready for Grammar Analysis</h3>
                            <p>Click <strong>Validate</strong> or <strong>FIRST / FOLLOW</strong> on the left to analyze grammar rules.</p>
                        </div>
                    `;
                }
                break;

            case "first-follow":
                if (state.lastFirstFollow) {
                    parserLabContent.innerHTML = `
                        ${renderDiagnostics(state.lastFirstFollow.diagnostics)}
                        ${state.lastFirstFollow.valid ? renderSummaryCards(state.lastFirstFollow) : ""}
                        ${state.lastFirstFollow.valid ? renderFirstFollowTable(state.lastFirstFollow) : ""}
                    `;
                } else {
                    parserLabContent.innerHTML = `
                        <div class="parser-lab-empty-state">
                            <h3>No FIRST / FOLLOW Sets Computed</h3>
                            <p>Click <strong>FIRST / FOLLOW</strong> on the left to compute iterative fixed-point sets.</p>
                        </div>
                    `;
                }
                break;

            case "ll1-table":
                parserLabContent.innerHTML = renderLL1TableView(state.lastLL1Table);
                break;

            case "trace":
                parserLabContent.innerHTML = renderTraceView(state.lastLL1Parse, "ll1");
                break;

            case "parse-tree":
                parserLabContent.innerHTML = renderParseTreeView(state.lastParseTree);
                break;

            case "recursive-descent":
                parserLabContent.innerHTML = renderRecursiveDescentView(state.lastRDParse);
                break;

            default:
                break;
        }
    }

    // ==========================================
    // Action Handlers
    // ==========================================

    async function handleValidateGrammar() {
        if (!grammarEditor || !parserLabContent) return;
        const grammarText = grammarEditor.value;
        const startSymbol = grammarStartSymbol ? grammarStartSymbol.value.trim() : null;

        setGrammarStatus("running", "Validating...");
        parserLabContent.innerHTML = `
            <div class="parser-lab-loading">
                <span class="status-dot" aria-hidden="true"></span>
                <span>Validating grammar structure and symbol conventions...</span>
            </div>
        `;

        try {
            const data = await callParserLabAPI("/api/parser-lab/validate", {
                grammar: grammarText,
                start_symbol: startSymbol || null
            });

            state.lastValidation = data;

            if (data.valid) {
                setGrammarStatus("success", "Grammar Valid");
            } else {
                setGrammarStatus("error", "Validation Errors");
            }

            setActiveTab("grammar");
        } catch (error) {
            setGrammarStatus("error", "Failed");
            parserLabContent.innerHTML = `
                <div class="semantic-status error">✕ Validation Request Failed</div>
                <div class="semantic-error">
                    <strong>Error:</strong>
                    <p>${escapeHTML(error.message)}</p>
                </div>
            `;
        }
    }

    async function handleComputeFirstFollow() {
        if (!grammarEditor || !parserLabContent) return;
        const grammarText = grammarEditor.value;
        const startSymbol = grammarStartSymbol ? grammarStartSymbol.value.trim() : null;

        setGrammarStatus("running", "Computing Sets...");
        parserLabContent.innerHTML = `
            <div class="parser-lab-loading">
                <span class="status-dot" aria-hidden="true"></span>
                <span>Validating grammar and computing iterative fixed-point FIRST &amp; FOLLOW sets...</span>
            </div>
        `;

        try {
            const data = await callParserLabAPI("/api/parser-lab/first-follow", {
                grammar: grammarText,
                start_symbol: startSymbol || null
            });

            state.lastFirstFollow = data;
            state.lastValidation = data;

            if (data.valid) {
                setGrammarStatus("success", "Sets Computed");
            } else {
                setGrammarStatus("error", "Validation Errors");
            }

            setActiveTab("first-follow");
        } catch (error) {
            setGrammarStatus("error", "Failed");
            parserLabContent.innerHTML = `
                <div class="semantic-status error">✕ Computation Request Failed</div>
                <div class="semantic-error">
                    <strong>Error:</strong>
                    <p>${escapeHTML(error.message)}</p>
                </div>
            `;
        }
    }

    async function handleGenerateLL1Table() {
        if (!grammarEditor || !parserLabContent) return;
        const grammarText = grammarEditor.value;
        const startSymbol = grammarStartSymbol ? grammarStartSymbol.value.trim() : null;

        setGrammarStatus("running", "Generating LL(1) Table...");
        parserLabContent.innerHTML = `
            <div class="parser-lab-loading">
                <span class="status-dot" aria-hidden="true"></span>
                <span>Computing FIRST/FOLLOW and populating predictive table M[A, a]...</span>
            </div>
        `;

        try {
            const data = await callParserLabAPI("/api/parser-lab/ll1/table", {
                grammar: grammarText,
                start_symbol: startSymbol || null
            });

            state.lastLL1Table = data;

            if (data.is_ll1) {
                setGrammarStatus("success", "LL(1) Table Ready");
            } else {
                setGrammarStatus("error", "Non-LL(1) Conflicts");
            }

            setActiveTab("ll1-table");
        } catch (error) {
            setGrammarStatus("error", "Failed");
            parserLabContent.innerHTML = `
                <div class="semantic-status error">✕ LL(1) Table Generation Failed</div>
                <div class="semantic-error">
                    <strong>Error:</strong>
                    <p>${escapeHTML(error.message)}</p>
                </div>
            `;
        }
    }

    async function handleParseInput() {
        if (!grammarEditor || !parserLabContent) return;
        const grammarText = grammarEditor.value;
        const startSymbol = grammarStartSymbol ? grammarStartSymbol.value.trim() : null;
        const inputText = parserInputString ? parserInputString.value.trim() : "";
        const engine = parserEngineSelect ? parserEngineSelect.value : "ll1";

        setGrammarStatus("running", "Parsing input tokens...");
        parserLabContent.innerHTML = `
            <div class="parser-lab-loading">
                <span class="status-dot" aria-hidden="true"></span>
                <span>Executing ${engine === "ll1" ? "LL(1) predictive" : "recursive descent"} parse on input tokens...</span>
            </div>
        `;

        try {
            if (engine === "ll1") {
                const data = await callParserLabAPI("/api/parser-lab/ll1/parse", {
                    grammar: grammarText,
                    start_symbol: startSymbol || null,
                    input: inputText
                });

                state.lastLL1Parse = data;
                if (data.parse_tree) {
                    state.lastParseTree = data.parse_tree;
                }

                if (data.accepted) {
                    setGrammarStatus("success", "Accepted");
                } else {
                    setGrammarStatus("error", "Rejected");
                }

                setActiveTab("trace");
            } else {
                // Recursive descent
                const data = await callParserLabAPI("/api/parser-lab/recursive-descent/parse", {
                    grammar: grammarText,
                    start_symbol: startSymbol || null,
                    input: inputText
                });

                state.lastRDParse = data;
                if (data.parse_tree) {
                    state.lastParseTree = data.parse_tree;
                }

                if (data.accepted) {
                    setGrammarStatus("success", "Accepted");
                } else {
                    setGrammarStatus("error", "Rejected");
                }

                setActiveTab("recursive-descent");
            }
        } catch (error) {
            setGrammarStatus("error", "Failed");
            parserLabContent.innerHTML = `
                <div class="semantic-status error">✕ Parse Request Failed</div>
                <div class="semantic-error">
                    <strong>Error:</strong>
                    <p>${escapeHTML(error.message)}</p>
                </div>
            `;
        }
    }

    // Attach Listeners
    if (btnValidateGrammar) {
        btnValidateGrammar.addEventListener("click", handleValidateGrammar);
    }

    if (btnComputeFirstFollow) {
        btnComputeFirstFollow.addEventListener("click", handleComputeFirstFollow);
    }

    if (btnGenerateLL1Table) {
        btnGenerateLL1Table.addEventListener("click", handleGenerateLL1Table);
    }

    if (btnParseInput) {
        btnParseInput.addEventListener("click", handleParseInput);
    }

    // Initialize line numbers on load
    updateGrammarLineNumbers();
})();
