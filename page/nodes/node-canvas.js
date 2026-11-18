/* Редактор нод: вопросы на канвасе, связи «если fieldN» и настройки блока. */
(function () {
    if (window.__nodeCanvasInit) {
        return;
    }
    window.__nodeCanvasInit = true;

    var PALETTE = [
        { id: "blue", header: "#1d7afc", swatch: "#4e96fd", tint: "#deebff" },
        { id: "purple", header: "#6554c0", swatch: "#8777d9", tint: "#eae6ff" },
        { id: "orange", header: "#ff8b00", swatch: "#ffb359", tint: "#fff0d6" },
        { id: "teal", header: "#00b8d9", swatch: "#4dd4ec", tint: "#e6fcff" },
        { id: "green", header: "#00875a", swatch: "#59b194", tint: "#e3fcef" }
    ];

    var TYPES = [
        { id: "flags", label: "Флажки" },
        { id: "list", label: "Список" },
        { id: "radio", label: "Переключатели" },
        { id: "text", label: "Текст" },
        { id: "number", label: "Число" }
    ];

    var HELP = "Нажмите вопрос, чтобы открыть настройки в окне на канвасе. Нажмите пустое место, чтобы закрыть окно. Правый клик по канвасу добавляет поле. Нажмите точку или перетащите её на вопрос, чтобы привязать. Нажмите линию, чтобы отвязать. Перетащите вопрос, чтобы переместить.";
    var STORAGE_KEY = "cb-automation-node-schema-v1";
    var EMPTY_TITLE = "Без текста вопроса";

    var state = null;
    var drag = null;
    var armed = null;
    var saveTimer = null;
    var dirty = false;
    var serverTried = false;
    var statusText = "";

    function palette(id) {
        for (var i = 0; i < PALETTE.length; i++) {
            if (PALETTE[i].id === id) {
                return PALETTE[i];
            }
        }
        return PALETTE[0];
    }

    function typeLabel(id) {
        for (var i = 0; i < TYPES.length; i++) {
            if (TYPES[i].id === id) {
                return TYPES[i].label;
            }
        }
        return TYPES[0].label;
    }

    function isChoice(type) {
        return type === "flags" || type === "list" || type === "radio";
    }

    function uid(prefix) {
        return prefix + "-" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
    }

    function closest(el, sel) {
        while (el && el.nodeType === 1) {
            if (el.matches ? el.matches(sel) : (el.msMatchesSelector && el.msMatchesSelector(sel))) {
                return el;
            }
            el = el.parentElement;
        }
        return null;
    }

    function fieldById(id) {
        for (var i = 0; i < state.fields.length; i++) {
            if (state.fields[i].id === id) {
                return state.fields[i];
            }
        }
        return null;
    }

    function nextIndex() {
        var max = 0;
        state.fields.forEach(function (f) {
            if (f.index > max) {
                max = f.index;
            }
        });
        return max + 1;
    }

    function displayTitle(field) {
        var title = (field.title || "").trim();
        return title || EMPTY_TITLE;
    }

    function seed() {
        return {
            name: "Тест",
            blockTitle: "",
            clearWhenHidden: true,
            selectedId: null,
            fields: [
                {
                    id: "f-blue", index: 1, title: "", type: "flags", color: "blue", headerSlot: "index",
                    x: 36, y: 36, required: false, hint: "",
                    options: [{ id: "o-med", label: "Медицинский сотрудник" }]
                },
                {
                    id: "f-purple", index: 2, title: "", type: "flags", color: "purple", headerSlot: "index",
                    x: 56, y: 220, required: false, hint: "",
                    options: [
                        { id: "o-main", label: "Основная специальность" },
                        { id: "o-extra", label: "Дополнительная специальность" }
                    ]
                },
                {
                    id: "f-orange", index: 4, title: "Основная специальность", type: "flags", color: "orange", headerSlot: "swatch",
                    x: 400, y: 40, required: false, hint: "",
                    options: [
                        { id: "o-doc", label: "Врач" },
                        { id: "o-nurse", label: "Медицинская сестра" }
                    ]
                },
                {
                    id: "f-teal", index: 3, title: "Тест", type: "list", color: "teal", headerSlot: "index",
                    x: 690, y: 86, required: false, hint: "",
                    options: [
                        { id: "o-1", label: "1" },
                        { id: "o-2", label: "2" },
                        { id: "o-3", label: "3" },
                        { id: "o-4", label: "4" }
                    ]
                },
                {
                    id: "f-green", index: 5, title: "Дополнительная специальность", type: "flags", color: "green", headerSlot: "swatch",
                    x: 530, y: 310, required: false, hint: "",
                    options: [
                        { id: "o-zam", label: "Зам по КЭР" },
                        { id: "o-head", label: "Заведующий отделением" }
                    ]
                }
            ],
            links: [
                { id: "l1", fromFieldId: "f-blue", fromOptionId: "o-med", toFieldId: "f-purple" },
                { id: "l2", fromFieldId: "f-purple", fromOptionId: "o-main", toFieldId: "f-orange" },
                { id: "l3", fromFieldId: "f-purple", fromOptionId: "o-extra", toFieldId: "f-green" },
                { id: "l4", fromFieldId: "f-orange", fromOptionId: "o-doc", toFieldId: "f-teal" }
            ]
        };
    }

    function normalize(raw) {
        if (!raw || !raw.fields || !raw.fields.length) {
            return null;
        }
        raw.links = raw.links || [];
        raw.name = raw.name || "Тест";
        raw.blockTitle = raw.blockTitle || "";
        raw.clearWhenHidden = raw.clearWhenHidden !== false;
        raw.selectedId = null;
        raw.fields.forEach(function (f) {
            f.options = f.options || [];
            if (!f.options.length) {
                f.options.push({ id: uid("o"), label: "" });
            }
            if (!f.color) {
                f.color = "blue";
            }
            if (!f.headerSlot) {
                f.headerSlot = "index";
            }
            if (!f.type) {
                f.type = "flags";
            }
        });
        return raw;
    }

    function loadLocal() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return null;
            }
            return normalize(JSON.parse(raw));
        } catch (e) {
            return null;
        }
    }

    function snapshot() {
        return {
            name: state.name,
            blockTitle: state.blockTitle,
            clearWhenHidden: state.clearWhenHidden,
            fields: state.fields,
            links: state.links
        };
    }

    function scheduleSave() {
        dirty = true;
        statusText = "Сохранение…";
        var status = document.querySelector(".nc-status");
        if (status) {
            status.textContent = statusText;
        }
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveNow, 350);
    }

    function saveNow() {
        var json = JSON.stringify(snapshot());
        try {
            localStorage.setItem(STORAGE_KEY, json);
        } catch (e) {
            /* ignore quota */
        }
        var url = restUrl();
        if (!url) {
            statusText = "Сохранено в браузере";
            paintStatus();
            return;
        }
        var xhr = new XMLHttpRequest();
        xhr.open("PUT", url, true);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.setRequestHeader("X-Atlassian-Token", "no-check");
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) {
                return;
            }
            statusText = xhr.status >= 200 && xhr.status < 300 ? "Сохранено" : "Сохранено в браузере";
            paintStatus();
        };
        xhr.send(json);
    }

    function paintStatus() {
        var status = document.querySelector(".nc-status");
        if (status) {
            status.textContent = statusText;
        }
    }

    function restUrl() {
        var root = document.getElementById("node-canvas-root");
        if (!root) {
            return "";
        }
        return root.getAttribute("data-rest") || "";
    }

    function fetchServer() {
        var url = restUrl();
        if (!url || serverTried) {
            return;
        }
        serverTried = true;
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.setRequestHeader("X-Atlassian-Token", "no-check");
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4 || dirty) {
                return;
            }
            if (xhr.status < 200 || xhr.status >= 300) {
                return;
            }
            try {
                var parsed = normalize(JSON.parse(xhr.responseText));
                if (parsed) {
                    state = parsed;
                    render();
                    statusText = "Загружено из Jira";
                    paintStatus();
                }
            } catch (e) {
                /* оставляем локальную схему */
            }
        };
        xhr.send();
    }

    function rootEl() {
        var root = document.getElementById("node-canvas-root");
        if (!root) {
            root = document.createElement("div");
            root.id = "node-canvas-root";
            document.body.insertBefore(root, document.body.firstChild);
        }
        return root;
    }

    function ensureShell() {
        var root = rootEl();
        if (root.querySelector(".nc-app")) {
            return;
        }
        root.innerHTML = "";
        var app = el("div", "nc-app");

        var top = el("div", "nc-top");
        var name = el("input", "nc-name");
        name.type = "text";
        name.setAttribute("aria-label", "Название схемы");
        name.id = "nc-name";
        var actions = el("div", "nc-top-actions");
        var classic = el("button", "nc-btn", "Классический редактор");
        classic.type = "button";
        classic.id = "nc-classic";
        var add = el("button", "nc-btn", "Добавить поле");
        add.type = "button";
        add.id = "nc-add";
        actions.appendChild(classic);
        actions.appendChild(add);
        top.appendChild(name);
        top.appendChild(actions);

        var sub = el("div", "nc-sub");
        var blockLabel = el("label", null, "Заголовок блока");
        blockLabel.setAttribute("for", "nc-block-title");
        var block = el("input", "nc-block-title");
        block.type = "text";
        block.id = "nc-block-title";
        var checkLabel = el("label", "nc-check");
        var check = document.createElement("input");
        check.type = "checkbox";
        check.id = "nc-clear";
        checkLabel.appendChild(check);
        checkLabel.appendChild(document.createTextNode("Очищать ответ, когда поле скрывается"));
        var status = el("div", "nc-status");
        sub.appendChild(blockLabel);
        sub.appendChild(block);
        sub.appendChild(checkLabel);
        sub.appendChild(status);

        var help = el("p", "nc-help", HELP);
        var note = el("p", "nc-note", "Бесплатный плагин ставится рядом с Automation for Jira и не изменяет его правила.");
        var scroll = el("div", "nc-scroll");
        var canvas = el("div", "nc-canvas");
        canvas.id = "nc-canvas";
        var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("class", "nc-wires");
        svg.id = "nc-wires";
        var nodes = el("div", "nc-nodes");
        nodes.id = "nc-nodes";
        var settings = el("div", "nc-settings-host");
        settings.id = "nc-settings-host";
        canvas.appendChild(svg);
        canvas.appendChild(nodes);
        canvas.appendChild(settings);
        scroll.appendChild(canvas);

        app.appendChild(top);
        app.appendChild(sub);
        app.appendChild(help);
        app.appendChild(note);
        app.appendChild(scroll);
        root.appendChild(app);

        var classicHref = root.getAttribute("data-classic") || "";
        if (classicHref) {
            classic.textContent = "Automation for Jira";
        } else if (!document.getElementById("automation-admin-container")) {
            classic.style.display = "none";
        }
        if (!document.getElementById("nc-back")) {
            var back = el("button", "nc-back", "Редактор нод");
            back.type = "button";
            back.id = "nc-back";
            back.addEventListener("click", function () {
                document.body.classList.add("nc-nodes");
                document.body.classList.remove("nc-classic");
            });
            document.body.appendChild(back);
        }

        name.addEventListener("input", function () {
            state.name = name.value;
            scheduleSave();
        });
        block.addEventListener("input", function () {
            state.blockTitle = block.value;
            scheduleSave();
        });
        check.addEventListener("change", function () {
            state.clearWhenHidden = check.checked;
            scheduleSave();
        });
        add.addEventListener("click", function () {
            addField(80 + (state.fields.length % 5) * 28, 48 + (state.fields.length % 6) * 36);
        });
        classic.addEventListener("click", function () {
            if (classicHref) {
                (window.top || window).location.href = classicHref;
                return;
            }
            document.body.classList.remove("nc-nodes");
            document.body.classList.add("nc-classic");
            var container = document.getElementById("automation-admin-container");
            if (container) {
                container.style.display = "";
            }
            window.dispatchEvent(new Event("resize"));
        });
    }

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) {
            node.className = className;
        }
        if (text) {
            node.textContent = text;
        }
        return node;
    }

    function conditionText(field) {
        var parts = [];
        state.links.forEach(function (link) {
            if (link.toFieldId !== field.id) {
                return;
            }
            var src = fieldById(link.fromFieldId);
            if (!src) {
                return;
            }
            var optLabel = "";
            src.options.forEach(function (opt) {
                if (opt.id === link.fromOptionId) {
                    optLabel = (opt.label || "").trim();
                }
            });
            parts.push("если field" + src.index + (optLabel ? ": " + optLabel : ""));
        });
        return parts.join(", ");
    }

    function resizeCanvas() {
        var canvas = document.getElementById("nc-canvas");
        if (!canvas) {
            return;
        }
        var maxX = 1400;
        var maxY = 860;
        state.fields.forEach(function (f) {
            maxX = Math.max(maxX, f.x + 560);
            maxY = Math.max(maxY, f.y + 420);
        });
        canvas.style.minWidth = maxX + "px";
        canvas.style.minHeight = maxY + "px";
    }

    function render() {
        ensureShell();
        if (!document.body.classList.contains("nc-classic")) {
            document.body.classList.add("nc-nodes");
        }
        var name = document.getElementById("nc-name");
        var block = document.getElementById("nc-block-title");
        var check = document.getElementById("nc-clear");
        if (document.activeElement !== name) {
            name.value = state.name;
        }
        if (document.activeElement !== block) {
            block.value = state.blockTitle;
        }
        check.checked = !!state.clearWhenHidden;
        paintStatus();
        resizeCanvas();
        renderNodes();
        renderSettings();
        drawWires();
    }

    function renderNodes() {
        var host = document.getElementById("nc-nodes");
        host.innerHTML = "";
        if (!state.fields.length) {
            host.appendChild(el("div", "nc-empty", "Правый клик или кнопка «Добавить поле», чтобы создать первое поле."));
        }
        state.fields.forEach(function (field) {
            host.appendChild(renderNode(field));
        });
    }

    function renderNode(field) {
        var color = palette(field.color);
        var node = el("div", "nc-node" + (state.selectedId === field.id ? " is-selected" : ""));
        node.dataset.id = field.id;
        node.style.left = field.x + "px";
        node.style.top = field.y + "px";

        var head = el("div", "nc-head");
        head.style.background = color.header;
        var text = el("div", "nc-head-text");
        var title = el("div", "nc-head-title");
        title.textContent = displayTitle(field) + (field.required ? " *" : "");
        var kind = el("div", "nc-head-type", typeLabel(field.type));
        text.appendChild(title);
        text.appendChild(kind);
        head.appendChild(text);

        if (field.headerSlot === "swatch") {
            var swatch = el("button", "nc-swatch");
            swatch.type = "button";
            swatch.style.background = color.swatch;
            swatch.title = "Цвет вопроса";
            swatch.dataset.action = "swatch";
            head.appendChild(swatch);
        } else {
            head.appendChild(el("div", "nc-badge", String(field.index)));
        }
        var close = el("button", "nc-x", "×");
        close.type = "button";
        close.title = "Удалить поле";
        close.dataset.action = "delete";
        head.appendChild(close);

        var portIn = el("button", "nc-port nc-port-in");
        portIn.type = "button";
        portIn.style.background = color.header;
        portIn.style.color = color.header;
        portIn.dataset.role = "in";
        portIn.title = "Вход: поле показывается по входящей связи";
        portIn.setAttribute("aria-label", "Вход поля");

        var body = el("div", "nc-body");
        var cond = el("div", "nc-cond");
        cond.dataset.role = "cond";
        cond.textContent = conditionText(field);
        body.appendChild(cond);
        if ((field.hint || "").trim()) {
            body.appendChild(el("div", "nc-hint", field.hint));
        }

        if (isChoice(field.type)) {
            field.options.forEach(function (opt) {
                body.appendChild(renderOption(field, opt, color));
            });
        } else {
            var row = el("div", "nc-value-port");
            row.appendChild(el("span", null, field.type === "number" ? "Числовой ответ" : "Текстовый ответ"));
            var port = el("button", "nc-port nc-port-out");
            port.type = "button";
            port.style.background = color.header;
            port.style.color = color.header;
            port.dataset.role = "out";
            port.dataset.optionId = field.options[0].id;
            port.title = "Перетащите на вопрос, чтобы привязать";
            if (armed && armed.fromFieldId === field.id && armed.fromOptionId === field.options[0].id) {
                port.classList.add("is-armed");
            }
            row.appendChild(port);
            body.appendChild(row);
            linksFrom(field.id, field.options[0].id).forEach(function (link) {
                body.appendChild(renderChip(field, link, color));
            });
        }

        node.appendChild(portIn);
        node.appendChild(head);
        node.appendChild(body);
        return node;
    }

    function renderOption(field, opt, color) {
        var wrap = document.createDocumentFragment();
        var row = el("div", "nc-opt");
        var input = document.createElement("input");
        input.type = "text";
        input.value = opt.label;
        input.placeholder = "Вариант ответа";
        input.dataset.optionId = opt.id;
        input.setAttribute("aria-label", "Вариант ответа");
        var plus = el("button", "nc-plus", "+");
        plus.type = "button";
        plus.title = "Добавить вариант";
        plus.dataset.action = "add-option";
        plus.dataset.optionId = opt.id;
        var port = el("button", "nc-port nc-port-out");
        port.type = "button";
        port.style.background = color.header;
        port.style.color = color.header;
        port.dataset.role = "out";
        port.dataset.optionId = opt.id;
        port.title = "Перетащите на вопрос, чтобы привязать";
        if (armed && armed.fromFieldId === field.id && armed.fromOptionId === opt.id) {
            port.classList.add("is-armed");
        }
        row.appendChild(input);
        row.appendChild(plus);
        row.appendChild(port);
        wrap.appendChild(row);
        linksFrom(field.id, opt.id).forEach(function (link) {
            wrap.appendChild(renderChip(field, link, color));
        });
        return wrap;
    }

    function linksFrom(fieldId, optionId) {
        return state.links.filter(function (link) {
            return link.fromFieldId === fieldId && link.fromOptionId === optionId;
        });
    }

    function renderChip(field, link, color) {
        var target = fieldById(link.toFieldId);
        var chip = el("div", "nc-chip");
        chip.style.background = color.tint;
        chip.dataset.linkId = link.id;
        var sq = el("span", "nc-chip-sq");
        sq.style.background = color.header;
        var label = el("span", "nc-chip-label");
        label.textContent = "Поле: " + (target ? displayTitle(target) : "удалено");
        var x = el("button", "nc-chip-x", "×");
        x.type = "button";
        x.title = "Отвязать";
        x.dataset.action = "unlink";
        x.dataset.linkId = link.id;
        chip.appendChild(sq);
        chip.appendChild(label);
        chip.appendChild(x);
        return chip;
    }

    function renderSettings() {
        var host = document.getElementById("nc-settings-host");
        host.innerHTML = "";
        var field = state.selectedId ? fieldById(state.selectedId) : null;
        if (!field) {
            return;
        }
        var color = palette(field.color);
        var panel = el("div", "nc-settings");
        panel.id = "nc-settings";
        var left = field.x + 248;
        if (left + 280 > (parseInt(document.getElementById("nc-canvas").style.minWidth, 10) || 1400) - 20) {
            left = Math.max(8, field.x - 292);
        }
        panel.style.left = left + "px";
        panel.style.top = Math.max(8, field.y) + "px";
        panel.appendChild(el("h3", null, "Настройки вопроса"));

        panel.appendChild(settingField("Текст вопроса", function () {
            var input = document.createElement("input");
            input.type = "text";
            input.value = field.title;
            input.placeholder = EMPTY_TITLE;
            input.addEventListener("input", function () {
                field.title = input.value;
                var node = document.querySelector('.nc-node[data-id="' + field.id + '"] .nc-head-title');
                if (node) {
                    node.textContent = displayTitle(field) + (field.required ? " *" : "");
                }
                refreshChipLabels();
                scheduleSave();
            });
            return input;
        }));

        panel.appendChild(settingField("Тип", function () {
            var select = document.createElement("select");
            TYPES.forEach(function (type) {
                var option = document.createElement("option");
                option.value = type.id;
                option.textContent = type.label;
                if (type.id === field.type) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
            select.addEventListener("change", function () {
                setType(field, select.value);
                scheduleSave();
                render();
            });
            return select;
        }));

        panel.appendChild(settingField("Цвет", function () {
            var row = el("div", "nc-colors");
            PALETTE.forEach(function (item) {
                var button = document.createElement("button");
                button.type = "button";
                button.style.background = item.header;
                button.title = item.id;
                if (item.id === field.color) {
                    button.className = "is-on";
                }
                button.addEventListener("click", function () {
                    field.color = item.id;
                    scheduleSave();
                    render();
                });
                row.appendChild(button);
            });
            return row;
        }));

        panel.appendChild(settingField("Значок в заголовке", function () {
            var select = document.createElement("select");
            [["index", "Номер"], ["swatch", "Цвет"]].forEach(function (pair) {
                var option = document.createElement("option");
                option.value = pair[0];
                option.textContent = pair[1];
                option.selected = field.headerSlot === pair[0];
                select.appendChild(option);
            });
            select.addEventListener("change", function () {
                field.headerSlot = select.value;
                scheduleSave();
                render();
            });
            return select;
        }));

        var req = el("label", "nc-check");
        var reqInput = document.createElement("input");
        reqInput.type = "checkbox";
        reqInput.checked = !!field.required;
        req.appendChild(reqInput);
        req.appendChild(document.createTextNode("Обязательное поле"));
        reqInput.addEventListener("change", function () {
            field.required = reqInput.checked;
            scheduleSave();
            render();
        });
        var reqWrap = el("div", "nc-field");
        reqWrap.appendChild(req);
        panel.appendChild(reqWrap);

        panel.appendChild(settingField("Подсказка", function () {
            var area = document.createElement("textarea");
            area.value = field.hint || "";
            area.addEventListener("input", function () {
                field.hint = area.value;
                scheduleSave();
            });
            area.addEventListener("change", function () {
                render();
            });
            return area;
        }));

        var actions = el("div", "nc-settings-actions");
        var done = el("button", "nc-btn nc-btn-primary", "Готово");
        done.type = "button";
        done.addEventListener("click", function () {
            state.selectedId = null;
            render();
        });
        actions.appendChild(done);
        panel.appendChild(actions);
        host.appendChild(panel);
        panel.style.borderTop = "3px solid " + color.header;
    }

    function settingField(label, builder) {
        var wrap = el("div", "nc-field");
        wrap.appendChild(el("span", null, label));
        wrap.appendChild(builder());
        return wrap;
    }

    function setType(field, type) {
        field.type = type;
        if (!field.options.length) {
            field.options.push({ id: uid("o"), label: "" });
        }
        if (!isChoice(type)) {
            var keep = field.options[0].id;
            state.links = state.links.filter(function (link) {
                return link.fromFieldId !== field.id || link.fromOptionId === keep;
            });
        }
    }

    function refreshChipLabels() {
        document.querySelectorAll(".nc-chip").forEach(function (chip) {
            var link = null;
            state.links.forEach(function (item) {
                if (item.id === chip.dataset.linkId) {
                    link = item;
                }
            });
            if (!link) {
                return;
            }
            var target = fieldById(link.toFieldId);
            var label = chip.querySelector(".nc-chip-label");
            if (label) {
                label.textContent = "Поле: " + (target ? displayTitle(target) : "удалено");
            }
        });
        document.querySelectorAll(".nc-node").forEach(function (node) {
            var field = fieldById(node.dataset.id);
            var cond = node.querySelector(".nc-cond");
            if (field && cond) {
                cond.textContent = conditionText(field);
            }
        });
    }

    function drawWires() {
        var svg = document.getElementById("nc-wires");
        var canvas = document.getElementById("nc-canvas");
        if (!svg || !canvas) {
            return;
        }
        var width = canvas.offsetWidth;
        var height = canvas.offsetHeight;
        svg.setAttribute("width", width);
        svg.setAttribute("height", height);
        svg.setAttribute("viewBox", "0 0 " + width + " " + height);
        while (svg.firstChild) {
            svg.removeChild(svg.firstChild);
        }
        state.links.forEach(function (link) {
            var from = portCenter(link.fromFieldId, link.fromOptionId);
            var to = inPortCenter(link.toFieldId);
            if (!from || !to) {
                return;
            }
            var src = fieldById(link.fromFieldId);
            var color = palette(src ? src.color : "blue").header;
            var path = curve(from.x, from.y, to.x, to.y);
            var hit = svgPath("nc-hit", path);
            hit.dataset.linkId = link.id;
            hit.style.stroke = "transparent";
            var line = svgPath("nc-line", path);
            line.setAttribute("stroke", color);
            svg.appendChild(hit);
            svg.appendChild(line);
        });
        if (drag && drag.type === "link") {
            var temp = svgPath("nc-temp", curve(drag.x1, drag.y1, drag.x2, drag.y2));
            svg.appendChild(temp);
        }
    }

    function svgPath(className, d) {
        var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("class", className);
        path.setAttribute("d", d);
        return path;
    }

    function curve(x1, y1, x2, y2) {
        var dx = Math.max(72, Math.abs(x2 - x1) * 0.45);
        if (x2 < x1 - 12) {
            var bow = Math.max(80, Math.min(160, (x1 - x2) * 0.45));
            var midY = y1 + Math.max(36, (y2 - y1) * 0.45);
            return "M " + x1 + " " + y1 +
                " C " + (x1 + bow * 0.35) + " " + midY +
                ", " + (x2 - 48) + " " + y2 +
                ", " + x2 + " " + y2;
        }
        return "M " + x1 + " " + y1 + " C " + (x1 + dx) + " " + y1 + ", " + (x2 - dx) + " " + y2 + ", " + x2 + " " + y2;
    }

    function canvasPoint(clientX, clientY) {
        var canvas = document.getElementById("nc-canvas");
        var rect = canvas.getBoundingClientRect();
        return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function centerOf(element) {
        if (!element) {
            return null;
        }
        var canvas = document.getElementById("nc-canvas");
        var c = canvas.getBoundingClientRect();
        var r = element.getBoundingClientRect();
        return { x: r.left - c.left + r.width / 2, y: r.top - c.top + r.height / 2 };
    }

    function portCenter(fieldId, optionId) {
        var node = document.querySelector('.nc-node[data-id="' + fieldId + '"]');
        if (!node) {
            return null;
        }
        var ports = node.querySelectorAll(".nc-port-out");
        for (var i = 0; i < ports.length; i++) {
            if (ports[i].dataset.optionId === optionId) {
                return centerOf(ports[i]);
            }
        }
        return null;
    }

    function inPortCenter(fieldId) {
        var node = document.querySelector('.nc-node[data-id="' + fieldId + '"]');
        if (!node) {
            return null;
        }
        return centerOf(node.querySelector(".nc-port-in"));
    }

    function addField(x, y) {
        var field = {
            id: uid("f"),
            index: nextIndex(),
            title: "",
            type: "flags",
            color: PALETTE[state.fields.length % PALETTE.length].id,
            headerSlot: "index",
            x: Math.max(8, x),
            y: Math.max(8, y),
            required: false,
            hint: "",
            options: [{ id: uid("o"), label: "" }]
        };
        state.fields.push(field);
        state.selectedId = field.id;
        scheduleSave();
        render();
    }

    function removeField(id) {
        state.fields = state.fields.filter(function (field) {
            return field.id !== id;
        });
        state.links = state.links.filter(function (link) {
            return link.fromFieldId !== id && link.toFieldId !== id;
        });
        if (state.selectedId === id) {
            state.selectedId = null;
        }
        if (armed && armed.fromFieldId === id) {
            armed = null;
        }
        scheduleSave();
        render();
    }

    function addOption(field, afterId) {
        var option = { id: uid("o"), label: "" };
        var index = 0;
        field.options.forEach(function (item, i) {
            if (item.id === afterId) {
                index = i + 1;
            }
        });
        field.options.splice(index, 0, option);
        scheduleSave();
        render();
        var input = document.querySelector('.nc-node[data-id="' + field.id + '"] input[data-option-id="' + option.id + '"]');
        if (input) {
            input.focus();
        }
    }

    function addLink(fromFieldId, fromOptionId, toFieldId) {
        if (!fromFieldId || !toFieldId || fromFieldId === toFieldId) {
            return false;
        }
        var exists = state.links.some(function (link) {
            return link.fromFieldId === fromFieldId && link.fromOptionId === fromOptionId && link.toFieldId === toFieldId;
        });
        if (exists) {
            return false;
        }
        state.links.push({
            id: uid("l"),
            fromFieldId: fromFieldId,
            fromOptionId: fromOptionId,
            toFieldId: toFieldId
        });
        scheduleSave();
        return true;
    }

    function removeLink(id) {
        state.links = state.links.filter(function (link) {
            return link.id !== id;
        });
        scheduleSave();
        render();
    }

    function onPointerDown(event) {
        if (!document.body.classList.contains("nc-nodes")) {
            return;
        }
        if (event.button !== 0) {
            return;
        }
        var actionEl = closest(event.target, "[data-action]");
        if (actionEl) {
            event.preventDefault();
            event.stopPropagation();
            handleAction(actionEl);
            return;
        }
        var hit = closest(event.target, ".nc-hit");
        if (hit) {
            event.preventDefault();
            removeLink(hit.dataset.linkId);
            return;
        }
        var port = closest(event.target, ".nc-port-out");
        if (port) {
            event.preventDefault();
            var node = closest(port, ".nc-node");
            var center = centerOf(port);
            drag = {
                type: "link",
                fromFieldId: node.dataset.id,
                fromOptionId: port.dataset.optionId,
                x1: center.x,
                y1: center.y,
                x2: center.x,
                y2: center.y,
                moved: false,
                sx: event.clientX,
                sy: event.clientY
            };
            return;
        }
        if (closest(event.target, ".nc-settings") || closest(event.target, "input, textarea, select, .nc-btn, .nc-check")) {
            return;
        }
        var head = closest(event.target, ".nc-head");
        if (head) {
            event.preventDefault();
            var card = closest(head, ".nc-node");
            var field = fieldById(card.dataset.id);
            var point = canvasPoint(event.clientX, event.clientY);
            drag = {
                type: "node",
                id: field.id,
                ox: point.x - field.x,
                oy: point.y - field.y,
                moved: false,
                sx: event.clientX,
                sy: event.clientY
            };
            return;
        }
        if (closest(event.target, ".nc-canvas") && !closest(event.target, ".nc-node")) {
            state.selectedId = null;
            armed = null;
            render();
        }
    }

    function handleAction(actionEl) {
        var action = actionEl.dataset.action;
        var node = closest(actionEl, ".nc-node");
        var field = node ? fieldById(node.dataset.id) : null;
        if (action === "delete" && field) {
            removeField(field.id);
            return;
        }
        if (action === "add-option" && field) {
            addOption(field, actionEl.dataset.optionId);
            return;
        }
        if (action === "unlink") {
            removeLink(actionEl.dataset.linkId);
            return;
        }
        if (action === "swatch" && field) {
            state.selectedId = field.id;
            render();
        }
    }

    function onPointerMove(event) {
        if (!drag) {
            return;
        }
        if (Math.abs(event.clientX - drag.sx) + Math.abs(event.clientY - drag.sy) > 4) {
            drag.moved = true;
        }
        if (drag.type === "node" && drag.moved) {
            var field = fieldById(drag.id);
            var point = canvasPoint(event.clientX, event.clientY);
            field.x = Math.max(0, point.x - drag.ox);
            field.y = Math.max(0, point.y - drag.oy);
            var node = document.querySelector('.nc-node[data-id="' + field.id + '"]');
            if (node) {
                node.style.left = field.x + "px";
                node.style.top = field.y + "px";
            }
            var panel = document.getElementById("nc-settings");
            if (panel && state.selectedId === field.id) {
                panel.style.left = (field.x + 248) + "px";
                panel.style.top = field.y + "px";
            }
            drawWires();
        } else if (drag.type === "link") {
            var point = canvasPoint(event.clientX, event.clientY);
            drag.x2 = point.x;
            drag.y2 = point.y;
            var under = document.elementFromPoint(event.clientX, event.clientY);
            document.querySelectorAll(".nc-node").forEach(function (node) {
                node.classList.remove("is-target");
            });
            var target = closest(under, ".nc-node");
            if (target && target.dataset.id !== drag.fromFieldId) {
                target.classList.add("is-target");
            }
            drawWires();
        }
    }

    function onPointerUp(event) {
        if (!drag) {
            return;
        }
        var info = drag;
        drag = null;
        document.querySelectorAll(".nc-node.is-target").forEach(function (node) {
            node.classList.remove("is-target");
        });
        if (info.type === "node") {
            if (!info.moved) {
                state.selectedId = info.id;
                armed = null;
            }
            scheduleSave();
            render();
            return;
        }
        if (info.type === "link") {
            var under = document.elementFromPoint(event.clientX, event.clientY);
            var target = closest(under, ".nc-node");
            if (info.moved && target && target.dataset.id !== info.fromFieldId) {
                armed = null;
                addLink(info.fromFieldId, info.fromOptionId, target.dataset.id);
                render();
                return;
            }
            if (!info.moved) {
                if (armed && armed.fromFieldId === info.fromFieldId && armed.fromOptionId === info.fromOptionId) {
                    armed = null;
                } else {
                    armed = { fromFieldId: info.fromFieldId, fromOptionId: info.fromOptionId };
                }
                render();
            } else {
                render();
            }
        }
    }

    function onClick(event) {
        if (!document.body.classList.contains("nc-nodes") || !armed) {
            return;
        }
        var node = closest(event.target, ".nc-node");
        if (!node || closest(event.target, ".nc-port-out")) {
            return;
        }
        if (node.dataset.id === armed.fromFieldId) {
            return;
        }
        addLink(armed.fromFieldId, armed.fromOptionId, node.dataset.id);
        armed = null;
        render();
    }

    function onContextMenu(event) {
        if (!document.body.classList.contains("nc-nodes")) {
            return;
        }
        if (!closest(event.target, ".nc-canvas")) {
            return;
        }
        if (closest(event.target, ".nc-node") || closest(event.target, ".nc-settings")) {
            return;
        }
        event.preventDefault();
        var point = canvasPoint(event.clientX, event.clientY);
        addField(point.x, point.y);
    }

    function onKeyDown(event) {
        if (!document.body.classList.contains("nc-nodes")) {
            return;
        }
        if (event.key === "Escape") {
            state.selectedId = null;
            armed = null;
            drag = null;
            render();
        }
    }

    function onInput(event) {
        var input = event.target;
        if (!input || !input.dataset || !input.dataset.optionId) {
            return;
        }
        var node = closest(input, ".nc-node");
        if (!node) {
            return;
        }
        var field = fieldById(node.dataset.id);
        if (!field) {
            return;
        }
        field.options.forEach(function (opt) {
            if (opt.id === input.dataset.optionId) {
                opt.label = input.value;
            }
        });
        refreshChipLabels();
        scheduleSave();
    }

    function onWireClick(event) {
        var path = closest(event.target, ".nc-hit");
        if (!path) {
            return;
        }
        removeLink(path.dataset.linkId);
    }

    function boot() {
        if (!document.body) {
            return;
        }
        state = loadLocal() || seed();
        ensureShell();
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("pointermove", onPointerMove);
        document.addEventListener("pointerup", onPointerUp);
        document.addEventListener("click", onClick);
        document.addEventListener("contextmenu", onContextMenu);
        document.addEventListener("keydown", onKeyDown);
        document.addEventListener("input", onInput);
        document.getElementById("nc-wires").addEventListener("click", onWireClick);
        var openMatch = /[?&]settings=([^&]+)/.exec(location.search);
        if (openMatch) {
            state.selectedId = decodeURIComponent(openMatch[1]);
        }
        render();
        fetchServer();
        window.__nc = {
            getState: function () {
                return JSON.parse(JSON.stringify(state));
            },
            resetDemo: function () {
                try {
                    localStorage.removeItem(STORAGE_KEY);
                } catch (e) { /* ignore */ }
                state = seed();
                armed = null;
                dirty = false;
                render();
            },
            addLink: function (fromFieldId, fromOptionId, toFieldId) {
                addLink(fromFieldId, fromOptionId, toFieldId);
                render();
            }
        };
        if (/autotest=1/.test(location.search)) {
            window.addEventListener("load", runAutotest);
            if (document.readyState === "complete") {
                runAutotest();
            }
        }
    }

    function runAutotest() {
        var errors = [];
        function assert(cond, message) {
            if (!cond) {
                errors.push(message);
            }
        }
        try {
            window.__nc.resetDemo();
            assert(document.querySelectorAll(".nc-node").length === 5, "ожидалось 5 нод примера");
            assert(document.querySelectorAll(".nc-wires .nc-line").length === 4, "ожидалось 4 линии");
            var conds = Array.prototype.map.call(document.querySelectorAll(".nc-cond"), function (node) { return node.textContent; }).join(" | ");
            assert(conds.indexOf("если field1") !== -1, "условие field1: " + conds);
            document.getElementById("nc-add").click();
            assert(document.querySelectorAll(".nc-node").length === 6, "кнопка добавляет поле");
            var added = state.fields[state.fields.length - 1];
            removeField(added.id);
            assert(state.fields.length === 5, "удаление поля");

            var blue = document.querySelector('.nc-node[data-id="f-blue"] .nc-head');
            var rect = blue.getBoundingClientRect();
            var startX = rect.left + 20;
            var startY = rect.top + 10;
            blue.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: startX, clientY: startY, pointerId: 1, button: 0 }));
            document.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: startX + 48, clientY: startY + 30, pointerId: 1, button: 0 }));
            document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: startX + 48, clientY: startY + 30, pointerId: 1, button: 0 }));
            var moved = fieldById("f-blue");
            assert(moved.x > 50 && moved.y > 40, "перетаскивание ноды, x=" + moved.x + " y=" + moved.y);

            var head = document.querySelector('.nc-node[data-id="f-orange"] .nc-head');
            var hr = head.getBoundingClientRect();
            head.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: hr.left + 12, clientY: hr.top + 12, pointerId: 1, button: 0 }));
            document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: hr.left + 12, clientY: hr.top + 12, pointerId: 1, button: 0 }));
            assert(document.getElementById("nc-settings"), "клик открывает настройки");
            var titleInput = document.querySelector("#nc-settings input[type='text']");
            titleInput.value = "Основная специальность";
            titleInput.dispatchEvent(new Event("input", { bubbles: true }));
            assert(fieldById("f-orange").title === "Основная специальность", "текст вопроса");

            var canvas = document.getElementById("nc-canvas");
            var cr = canvas.getBoundingClientRect();
            canvas.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: cr.left + 8, clientY: cr.top + 8, pointerId: 1, button: 0 }));
            assert(!state.selectedId, "клик по пустому месту закрывает окно");

            canvas.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: cr.left + 300, clientY: cr.top + 500 }));
            assert(state.fields.length === 6, "правый клик добавляет поле");

            document.getElementById("nc-clear").click();
            assert(state.clearWhenHidden === false, "флажок очистки");
            document.getElementById("nc-block-title").value = "Кадры";
            document.getElementById("nc-block-title").dispatchEvent(new Event("input", { bubbles: true }));
            assert(state.blockTitle === "Кадры", "заголовок блока");

            var before = state.links.length;
            window.__nc.addLink("f-green", "o-head", "f-teal");
            assert(state.links.length === before + 1, "привязка линии");
            assert(document.querySelectorAll(".nc-chip").length >= 4, "чип связанного поля");
            var hit = document.querySelector('.nc-hit[data-link-id="' + state.links[state.links.length - 1].id + '"]');
            hit.dispatchEvent(new MouseEvent("click", { bubbles: true }));
            assert(state.links.length === before, "клик по линии отвязывает");

            var port = document.querySelector('.nc-node[data-id="f-green"] .nc-port-out');
            var pr = port.getBoundingClientRect();
            port.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: pr.left + 4, clientY: pr.top + 4, pointerId: 1, button: 0 }));
            document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: pr.left + 4, clientY: pr.top + 4, pointerId: 1, button: 0 }));
            assert(armed && armed.fromFieldId === "f-green", "клик по точке готовит привязку");
        } catch (err) {
            errors.push(String(err && err.stack || err));
        }
        var report = el("pre", "nc-test-report");
        report.id = "nc-test-report";
        report.textContent = errors.length ? errors.join("\n") : "ok";
        document.body.appendChild(report);
        document.documentElement.dataset.test = errors.length ? "fail" : "pass";
        window.__nc.resetDemo();
    }

    if (document.body) {
        boot();
    } else {
        document.addEventListener("DOMContentLoaded", boot);
    }
})();
