/* Редактор нод: те же карточки, порты и связи, но шаги правила автоматизации. */
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

    var CATALOG = [
        { type: "jira.issue.event.trigger:created", component: "TRIGGER", label: "Задача создана", kind: "Триггер", color: "blue", value: { eventKey: "jira:issue_created", issueEvent: "issue_created" } },
        { type: "jira.issue.event.trigger:updated", component: "TRIGGER", label: "Задача обновлена", kind: "Триггер", color: "blue", value: { eventKey: "jira:issue_updated", issueEvent: "issue_updated" } },
        { type: "jira.issue.event.trigger:deleted", component: "TRIGGER", label: "Задача удалена", kind: "Триггер", color: "blue", value: { eventKey: "jira:issue_deleted", issueEvent: "issue_deleted" } },
        { type: "jira.issue.event.trigger:commented", component: "TRIGGER", label: "Комментарий добавлен", kind: "Триггер", color: "blue", value: { eventKey: "jira:issue_updated", issueEvent: "issue_commented" } },
        { type: "jira.jql.condition", component: "CONDITION", label: "Условие JQL", kind: "Условие", color: "purple", value: { jql: "" } },
        { type: "jira.issue.condition", component: "CONDITION", label: "Условие задачи", kind: "Условие", color: "purple", value: { selectedField: { type: "FIELDS", value: "issuetype" }, selectedFieldType: "issuetype", comparison: "EQUALS", compareValue: { type: "ID", value: "" } } },
        { type: "jira.user.condition", component: "CONDITION", label: "Условие пользователя", kind: "Условие", color: "purple", value: {} },
        { type: "jira.condition.container.block", component: "CONDITION", label: "Если / иначе", kind: "Условие", color: "purple", value: { summary: "условие ветки" } },
        { type: "jira.condition.if.block", component: "CONDITION", label: "Если", kind: "Условие", color: "orange", value: {} },
        { type: "jira.condition.else.block", component: "CONDITION", label: "Иначе", kind: "Условие", color: "green", value: {} },
        { type: "jira.issue.comment", component: "ACTION", label: "Комментарий к задаче", kind: "Действие", color: "teal", value: { comment: "", publicComment: true, sendNotifications: true } },
        { type: "jira.issue.assign", component: "ACTION", label: "Назначить задачу", kind: "Действие", color: "orange", value: { assignType: "SPECIFY_USER", assignee: "" } },
        { type: "jira.issue.transition", component: "ACTION", label: "Перевести задачу", kind: "Действие", color: "green", value: { statusName: "" } },
        { type: "jira.issue.edit", component: "ACTION", label: "Редактировать задачу", kind: "Действие", color: "teal", value: {} },
        { type: "jira.issue.create", component: "ACTION", label: "Создать задачу", kind: "Действие", color: "teal", value: {} },
        { type: "codebarrel.action.log", component: "ACTION", label: "Запись в журнал", kind: "Действие", color: "teal", value: { message: "" } },
        { type: "jira.issue.related", component: "BRANCH", label: "Связанные задачи", kind: "Ветвление", color: "green", value: { relatedType: "linked", jql: "" } }
    ];

    var HELP = "Нажмите шаг, чтобы открыть настройки. Нажмите пустое место, чтобы закрыть окно. Правый клик по канвасу добавляет действие. Нажмите точку или перетащите её на шаг, чтобы связать. Нажмите линию, чтобы отвязать. Перетащите шаг, чтобы переместить.";
    var STORAGE_KEY = "saael-nodeforms-rule-v1";
    var EMPTY_TITLE = "Без названия";

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

    function findCatalog(type) {
        for (var i = 0; i < CATALOG.length; i++) {
            if (CATALOG[i].type === type) {
                return CATALOG[i];
            }
        }
        return null;
    }

    function kindLabel(field) {
        var spec = findCatalog(field.componentType);
        if (spec) {
            return spec.kind;
        }
        if (field.component === "TRIGGER") {
            return "Триггер";
        }
        if (field.component === "CONDITION") {
            return "Условие";
        }
        if (field.component === "BRANCH") {
            return "Ветвление";
        }
        return "Действие";
    }

    function uid(prefix) {
        return prefix + "-" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
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
        state.fields.forEach(function (field) {
            if (field.index > max) {
                max = field.index;
            }
        });
        return max + 1;
    }

    function displayTitle(field) {
        var title = (field.title || "").trim();
        return title || EMPTY_TITLE;
    }

    function colorFor(component) {
        if (component === "TRIGGER") {
            return "blue";
        }
        if (component === "CONDITION") {
            return "purple";
        }
        if (component === "BRANCH") {
            return "green";
        }
        return "teal";
    }

    function conditionText(field) {
        var value = field.value || {};
        var type = field.componentType || "";
        if (type === "jira.jql.condition") {
            var jql = typeof value === "string" ? value : (value.jql || "");
            return "если JQL: " + (jql || "…");
        }
        if (type === "jira.issue.condition") {
            var selected = value.selectedField || {};
            var name = selected.name || selected.value || "поле";
            var compared = "";
            if (value.compareValue && value.compareValue.value) {
                compared = String(value.compareValue.value);
            }
            return "если " + name + (compared ? ": " + compared : "");
        }
        if (type === "jira.condition.container.block" || type === "jira.condition.if.block") {
            return "если " + (value.summary || "условие ветки");
        }
        if (type === "jira.condition.else.block") {
            return "иначе";
        }
        if (type.indexOf("trigger") !== -1) {
            return "событие: " + displayTitle(field);
        }
        if (type === "jira.issue.comment") {
            return "комментарий: " + ((value.comment || "").trim() || "пустой");
        }
        if (type === "jira.issue.assign") {
            return "назначить: " + (value.assignee || "исполнителя");
        }
        if (type === "jira.issue.transition") {
            return "статус: " + (value.statusName || value.transitionName || "следующий");
        }
        if (type === "jira.issue.related") {
            return "ветка: " + (value.relatedType || "связанные");
        }
        if (type === "codebarrel.action.log") {
            return "журнал: " + (value.message || "запись");
        }
        return kindLabel(field) + ": " + displayTitle(field);
    }

    function seed() {
        return {
            name: "Назначение ошибки",
            description: "",
            canOtherRuleTrigger: true,
            originalId: null,
            selectedId: null,
            rule: { state: "ENABLED", notifyOnError: "FIRSTERROR", projects: [], labels: [] },
            fields: [
                {
                    id: "f-blue", index: 1, title: "Задача создана",
                    componentType: "jira.issue.event.trigger:created", component: "TRIGGER", schemaVersion: 1,
                    color: "blue", headerSlot: "index", x: 36, y: 36,
                    value: { eventKey: "jira:issue_created", issueEvent: "issue_created" },
                    conditions: [],
                    options: [{ id: "o-med", label: "Создана", kind: "next" }]
                },
                {
                    id: "f-purple", index: 2, title: "Если / иначе",
                    componentType: "jira.condition.container.block", component: "CONDITION", schemaVersion: 1,
                    color: "purple", headerSlot: "index", x: 56, y: 220,
                    value: { summary: "тип задачи: Ошибка" },
                    conditions: [],
                    options: [
                        { id: "o-main", label: "Если: тип = Ошибка", kind: "child" },
                        { id: "o-extra", label: "Иначе", kind: "child" }
                    ]
                },
                {
                    id: "f-orange", index: 4, title: "Назначить задачу",
                    componentType: "jira.issue.assign", component: "ACTION", schemaVersion: 1,
                    color: "orange", headerSlot: "swatch", x: 400, y: 40,
                    value: { assignType: "SPECIFY_USER", assignee: "автор правила" },
                    conditions: [],
                    options: [
                        { id: "o-doc", label: "Исполнителю", kind: "next" },
                        { id: "o-nurse", label: "Дальше", kind: "next" }
                    ]
                },
                {
                    id: "f-teal", index: 3, title: "Комментарий",
                    componentType: "jira.issue.comment", component: "ACTION", schemaVersion: 1,
                    color: "teal", headerSlot: "index", x: 690, y: 86,
                    value: { comment: "Ошибка назначена", publicComment: true, sendNotifications: true },
                    conditions: [],
                    options: [{ id: "o-1", label: "Дальше", kind: "next" }]
                },
                {
                    id: "f-green", index: 5, title: "Перевести задачу",
                    componentType: "jira.issue.transition", component: "ACTION", schemaVersion: 1,
                    color: "green", headerSlot: "swatch", x: 530, y: 310,
                    value: { statusName: "Готово" },
                    conditions: [],
                    options: [
                        { id: "o-zam", label: "Готово", kind: "next" },
                        { id: "o-head", label: "Отменено", kind: "next" }
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
        if (!raw.fields[0].componentType && !raw.fields[0].component) {
            return null;
        }
        raw.links = raw.links || [];
        raw.name = raw.name || "Правило";
        raw.description = raw.description || "";
        raw.canOtherRuleTrigger = raw.canOtherRuleTrigger !== false;
        raw.rule = raw.rule || { state: "ENABLED", notifyOnError: "FIRSTERROR", projects: [], labels: [] };
        raw.selectedId = null;
        raw.fields.forEach(function (field) {
            field.options = field.options || [];
            if (!field.options.length) {
                field.options.push({ id: uid("o"), label: "Дальше", kind: "next" });
            }
            field.options.forEach(function (opt) {
                if (!opt.kind) {
                    opt.kind = "next";
                }
            });
            if (!field.color) {
                field.color = colorFor(field.component);
            }
            if (!field.headerSlot) {
                field.headerSlot = "index";
            }
            if (!field.component) {
                field.component = "ACTION";
            }
            if (field.value == null) {
                field.value = {};
            }
            field.conditions = field.conditions || [];
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
            description: state.description,
            canOtherRuleTrigger: state.canOtherRuleTrigger,
            originalId: state.originalId,
            rule: state.rule,
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
            dirty = false;
            return;
        }
        var xhr = new XMLHttpRequest();
        xhr.open("PUT", url);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.setRequestHeader("X-Atlassian-Token", "no-check");
        xhr.onload = function () {
            statusText = xhr.status >= 200 && xhr.status < 300 ? "Сохранено" : "Только в браузере";
            paintStatus();
            dirty = false;
        };
        xhr.onerror = function () {
            statusText = "Только в браузере";
            paintStatus();
        };
        xhr.send(json);
    }

    function restUrl() {
        var root = document.getElementById("node-canvas-root");
        if (!root) {
            return "";
        }
        return root.getAttribute("data-rest") || "";
    }

    function importUrl() {
        var root = document.getElementById("node-canvas-root");
        if (!root) {
            return "";
        }
        return root.getAttribute("data-import") || "";
    }

    function fetchServer() {
        var url = restUrl();
        if (!url || serverTried) {
            return;
        }
        serverTried = true;
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url);
        xhr.setRequestHeader("X-Atlassian-Token", "no-check");
        xhr.onload = function () {
            if (xhr.status < 200 || xhr.status >= 300 || dirty) {
                return;
            }
            try {
                var loaded = normalize(JSON.parse(xhr.responseText));
                if (loaded) {
                    state = loaded;
                    render();
                }
            } catch (e) {
                /* пустая схема */
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
        name.setAttribute("aria-label", "Название правила");
        name.id = "nc-name";
        var actions = el("div", "nc-top-actions");
        var classic = el("button", "nc-btn", "Классический редактор");
        classic.type = "button";
        classic.id = "nc-classic";
        var importer = el("button", "nc-btn", "Импорт");
        importer.type = "button";
        importer.id = "nc-import-open";
        var add = el("button", "nc-btn", "Добавить шаг");
        add.type = "button";
        add.id = "nc-add";
        actions.appendChild(classic);
        actions.appendChild(importer);
        actions.appendChild(add);
        top.appendChild(name);
        top.appendChild(actions);

        var sub = el("div", "nc-sub");
        var blockLabel = el("label", null, "Описание");
        blockLabel.setAttribute("for", "nc-block-title");
        var block = el("input", "nc-block-title");
        block.type = "text";
        block.id = "nc-block-title";
        var checkLabel = el("label", "nc-check");
        var check = document.createElement("input");
        check.type = "checkbox";
        check.id = "nc-clear";
        checkLabel.appendChild(check);
        checkLabel.appendChild(document.createTextNode("Разрешить запуск из другого правила"));
        var status = el("div", "nc-status");
        sub.appendChild(blockLabel);
        sub.appendChild(block);
        sub.appendChild(checkLabel);
        sub.appendChild(status);

        var help = el("p", "nc-help", HELP);
        var note = el("p", "nc-note", "Копия правила хранится отдельно. Импорт только читает Automation for Jira и не меняет его правила.");
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

        name.addEventListener("input", function () {
            state.name = name.value;
            scheduleSave();
        });
        block.addEventListener("input", function () {
            state.description = block.value;
            scheduleSave();
        });
        check.addEventListener("change", function () {
            state.canOtherRuleTrigger = check.checked;
            scheduleSave();
        });
        add.addEventListener("click", function () {
            addField(80 + (state.fields.length % 5) * 28, 48 + (state.fields.length % 6) * 36);
        });
        importer.addEventListener("click", function () {
            toggleImport(true);
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
        if (text != null) {
            node.textContent = text;
        }
        return node;
    }

    function paintStatus() {
        var status = document.querySelector(".nc-status");
        if (status) {
            status.textContent = statusText;
        }
    }

    function resizeCanvas() {
        var canvas = document.getElementById("nc-canvas");
        var maxX = 1400;
        var maxY = 860;
        state.fields.forEach(function (field) {
            maxX = Math.max(maxX, field.x + 520);
            maxY = Math.max(maxY, field.y + 420);
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
            block.value = state.description || "";
        }
        check.checked = !!state.canOtherRuleTrigger;
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
            host.appendChild(el("div", "nc-empty", "Правый клик или кнопка «Добавить шаг», чтобы создать первое действие."));
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
        text.appendChild(el("div", "nc-head-title", displayTitle(field)));
        text.appendChild(el("div", "nc-head-type", kindLabel(field)));
        head.appendChild(text);
        if (field.headerSlot === "swatch") {
            var swatch = el("button", "nc-swatch");
            swatch.type = "button";
            swatch.style.background = color.swatch;
            swatch.title = "Цвет шага";
            swatch.dataset.action = "swatch";
            head.appendChild(swatch);
        } else {
            head.appendChild(el("div", "nc-badge", String(field.index)));
        }
        var close = el("button", "nc-x", "×");
        close.type = "button";
        close.title = "Удалить шаг";
        close.dataset.action = "delete";
        head.appendChild(close);

        var portIn = el("button", "nc-port nc-port-in");
        portIn.type = "button";
        portIn.style.background = color.header;
        portIn.style.color = color.header;
        portIn.dataset.role = "in";
        portIn.title = "Вход шага";
        portIn.setAttribute("aria-label", "Вход шага");

        var body = el("div", "nc-body");
        var cond = el("div", "nc-cond");
        cond.dataset.role = "cond";
        cond.textContent = conditionText(field);
        body.appendChild(cond);
        field.options.forEach(function (opt) {
            body.appendChild(renderOption(field, opt, color));
        });
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
        input.placeholder = "Выход";
        input.dataset.optionId = opt.id;
        input.setAttribute("aria-label", "Выход шага");
        var plus = el("button", "nc-plus", "+");
        plus.type = "button";
        plus.title = "Добавить ветку";
        plus.dataset.action = "add-option";
        plus.dataset.optionId = opt.id;
        var port = el("button", "nc-port nc-port-out");
        port.type = "button";
        port.style.background = color.header;
        port.style.color = color.header;
        port.dataset.role = "out";
        port.dataset.optionId = opt.id;
        port.title = "Перетащите на шаг, чтобы связать";
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
        var label = el("span", "nc-chip-label", "Шаг: " + (target ? displayTitle(target) : "удалён"));
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
        panel.appendChild(el("h3", null, "Настройки шага"));
        panel.appendChild(settingField("Название", function () {
            var input = document.createElement("input");
            input.type = "text";
            input.value = field.title;
            input.placeholder = EMPTY_TITLE;
            input.addEventListener("input", function () {
                field.title = input.value;
                var node = document.querySelector('.nc-node[data-id="' + field.id + '"] .nc-head-title');
                if (node) {
                    node.textContent = displayTitle(field);
                }
                refreshChipLabels();
                scheduleSave();
            });
            return input;
        }));
        panel.appendChild(settingField("Компонент", function () {
            var select = document.createElement("select");
            CATALOG.forEach(function (spec) {
                var option = document.createElement("option");
                option.value = spec.type;
                option.textContent = spec.kind + ": " + spec.label;
                option.selected = spec.type === field.componentType;
                select.appendChild(option);
            });
            if (!findCatalog(field.componentType)) {
                var current = document.createElement("option");
                current.value = field.componentType;
                current.textContent = field.componentType || "Неизвестный компонент";
                current.selected = true;
                select.appendChild(current);
            }
            select.addEventListener("change", function () {
                applyCatalog(field, select.value);
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
        appendValueFields(panel, field);
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

    function appendValueFields(panel, field) {
        var type = field.componentType;
        var value = field.value;
        if (value == null || typeof value !== "object") {
            panel.appendChild(settingField("Значение", function () {
                var area = document.createElement("textarea");
                area.value = value == null ? "" : String(value);
                area.addEventListener("input", function () {
                    field.value = area.value;
                    scheduleSave();
                });
                return area;
            }));
            return;
        }
        if (type === "jira.jql.condition" || type === "jira.issue.related") {
            panel.appendChild(settingField("JQL", function () {
                var area = document.createElement("textarea");
                area.value = value.jql || "";
                area.addEventListener("input", function () {
                    value.jql = area.value;
                    scheduleSave();
                });
                return area;
            }));
        }
        if (type === "jira.issue.condition" || type === "jira.condition.container.block" || type === "jira.condition.if.block") {
            panel.appendChild(settingField("Условие", function () {
                var input = document.createElement("input");
                input.type = "text";
                input.value = value.summary || "";
                input.placeholder = "тип задачи: Ошибка";
                input.addEventListener("input", function () {
                    value.summary = input.value;
                    var cond = document.querySelector('.nc-node[data-id="' + field.id + '"] .nc-cond');
                    if (cond) {
                        cond.textContent = conditionText(field);
                    }
                    scheduleSave();
                });
                return input;
            }));
        }
        if (type === "jira.issue.comment" || type === "codebarrel.action.log") {
            panel.appendChild(settingField(type === "jira.issue.comment" ? "Текст комментария" : "Сообщение", function () {
                var area = document.createElement("textarea");
                area.value = type === "jira.issue.comment" ? (value.comment || "") : (value.message || "");
                area.addEventListener("input", function () {
                    if (type === "jira.issue.comment") {
                        value.comment = area.value;
                    } else {
                        value.message = area.value;
                    }
                    scheduleSave();
                });
                return area;
            }));
        }
        if (type === "jira.issue.comment") {
            var pub = el("label", "nc-check");
            var pubInput = document.createElement("input");
            pubInput.type = "checkbox";
            pubInput.checked = value.publicComment !== false;
            pub.appendChild(pubInput);
            pub.appendChild(document.createTextNode("Публичный комментарий"));
            pubInput.addEventListener("change", function () {
                value.publicComment = pubInput.checked;
                scheduleSave();
            });
            var wrap = el("div", "nc-field");
            wrap.appendChild(pub);
            panel.appendChild(wrap);
        }
        if (type === "jira.issue.assign") {
            panel.appendChild(settingField("Исполнитель", function () {
                var input = document.createElement("input");
                input.type = "text";
                input.value = value.assignee || "";
                input.addEventListener("input", function () {
                    value.assignee = input.value;
                    scheduleSave();
                });
                return input;
            }));
        }
        if (type === "jira.issue.transition") {
            panel.appendChild(settingField("Статус", function () {
                var input = document.createElement("input");
                input.type = "text";
                input.value = value.statusName || "";
                input.addEventListener("input", function () {
                    value.statusName = input.value;
                    scheduleSave();
                });
                return input;
            }));
        }
        if (type.indexOf("trigger") !== -1) {
            panel.appendChild(settingField("Ключ события", function () {
                var input = document.createElement("input");
                input.type = "text";
                input.value = value.issueEvent || value.eventKey || "";
                input.addEventListener("input", function () {
                    value.issueEvent = input.value;
                    scheduleSave();
                });
                return input;
            }));
        }
    }

    function settingField(label, builder) {
        var wrap = el("div", "nc-field");
        wrap.appendChild(el("span", null, label));
        wrap.appendChild(builder());
        return wrap;
    }

    function applyCatalog(field, type) {
        var spec = findCatalog(type);
        if (!spec) {
            field.componentType = type;
            return;
        }
        field.componentType = spec.type;
        field.component = spec.component;
        field.title = spec.label;
        field.color = spec.color;
        field.value = clone(spec.value || {});
        field.headerSlot = spec.component === "BRANCH" ? "swatch" : field.headerSlot;
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
                label.textContent = "Шаг: " + (target ? displayTitle(target) : "удалён");
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
            svg.appendChild(svgPath("nc-temp", curve(drag.x1, drag.y1, drag.x2, drag.y2)));
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
        var spec = findCatalog("jira.issue.comment");
        var field = {
            id: uid("f"),
            index: nextIndex(),
            title: spec.label,
            componentType: spec.type,
            component: spec.component,
            schemaVersion: 1,
            color: PALETTE[state.fields.length % PALETTE.length].id,
            headerSlot: "index",
            x: Math.max(8, x),
            y: Math.max(8, y),
            value: clone(spec.value),
            conditions: [],
            options: [{ id: uid("o"), label: "Дальше", kind: "next" }]
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
        var option = { id: uid("o"), label: "Ветка", kind: "child" };
        var index = field.options.length;
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

    function firstTarget(field, option) {
        if (!option) {
            return null;
        }
        var links = linksFrom(field.id, option.id);
        return links.length ? fieldById(links[0].toFieldId) : null;
    }

    function nextOption(field) {
        var i;
        for (i = 0; i < field.options.length; i++) {
            if (field.options[i].kind === "next" && linksFrom(field.id, field.options[i].id).length) {
                return field.options[i];
            }
        }
        for (i = 0; i < field.options.length; i++) {
            if (field.options[i].kind === "next") {
                return field.options[i];
            }
        }
        return null;
    }

    function componentFrom(field, seen) {
        var comp = {
            id: field.id,
            component: field.component,
            type: field.componentType,
            schemaVersion: field.schemaVersion || 1,
            value: field.value,
            conditions: field.conditions || [],
            children: []
        };
        field.options.forEach(function (opt) {
            if (opt.kind === "next") {
                return;
            }
            var child = firstTarget(field, opt);
            if (!child || seen[child.id]) {
                return;
            }
            buildChain(child, seen).forEach(function (item) {
                comp.children.push(item);
            });
        });
        return comp;
    }

    function buildChain(start, seen) {
        var list = [];
        var node = start;
        var guard = 0;
        while (node && guard < 200) {
            guard += 1;
            if (seen[node.id]) {
                break;
            }
            seen[node.id] = true;
            list.push(componentFrom(node, seen));
            var opt = nextOption(node);
            var linked = opt && linksFrom(node.id, opt.id).length ? firstTarget(node, opt) : null;
            node = linked;
        }
        return list;
    }

    function exportRules() {
        var incoming = {};
        state.links.forEach(function (link) {
            incoming[link.toFieldId] = true;
        });
        var roots = state.fields.filter(function (field) {
            return !incoming[field.id];
        });
        var trigger = null;
        roots.forEach(function (field) {
            if (!trigger && field.component === "TRIGGER") {
                trigger = field;
            }
        });
        if (!trigger) {
            trigger = roots[0] || state.fields[0];
        }
        var chain = trigger ? buildChain(trigger, {}) : [];
        var rule = clone(state.rule || {});
        delete rule.id;
        rule.name = state.name;
        rule.description = state.description || "";
        rule.canOtherRuleTrigger = !!state.canOtherRuleTrigger;
        rule.trigger = chain[0] || null;
        rule.components = chain.slice(1);
        return { cloud: false, rules: [rule] };
    }

    function childLabel(comp) {
        if (comp.type === "jira.condition.else.block") {
            return "Иначе";
        }
        if (comp.type === "jira.condition.if.block") {
            var summary = comp.value && comp.value.summary;
            return summary ? "Если: " + summary : "Если";
        }
        var spec = findCatalog(comp.type);
        return spec ? spec.label : "Дальше";
    }

    function makeNode(comp, x, y, index) {
        var spec = findCatalog(comp.type);
        var value = comp.value == null ? {} : clone(comp.value);
        return {
            id: comp.id || uid("f"),
            index: index,
            title: (spec && spec.label) || comp.type || "Шаг",
            componentType: comp.type || "",
            component: comp.component || (spec && spec.component) || "ACTION",
            schemaVersion: comp.schemaVersion || 1,
            color: (spec && spec.color) || colorFor(comp.component),
            headerSlot: comp.component === "BRANCH" || comp.type === "jira.condition.else.block" ? "swatch" : "index",
            x: x,
            y: y,
            value: value,
            conditions: clone(comp.conditions || []),
            options: []
        };
    }

    function placeList(list, x, y, bag) {
        var first = null;
        var prev = null;
        var prevOpt = null;
        var yPos = y;
        (list || []).forEach(function (comp) {
            var node = makeNode(comp, x, yPos, bag.index);
            bag.index += 1;
            bag.fields.push(node);
            if (!first) {
                first = node;
            }
            if (prev && prevOpt) {
                bag.links.push({ id: uid("l"), fromFieldId: prev.id, fromOptionId: prevOpt.id, toFieldId: node.id });
            }
            var kids = comp.children || [];
            var childY = yPos;
            kids.forEach(function (child) {
                var opt = { id: uid("o"), label: childLabel(child), kind: "child" };
                node.options.push(opt);
                var placed = placeList([child], x + 360, childY, bag);
                if (placed.first) {
                    bag.links.push({ id: uid("l"), fromFieldId: node.id, fromOptionId: opt.id, toFieldId: placed.first.id });
                }
                childY = Math.max(childY + 160, placed.bottom + 24);
            });
            var nextOpt = { id: uid("o"), label: "Дальше", kind: "next" };
            node.options.push(nextOpt);
            prev = node;
            prevOpt = nextOpt;
            yPos = Math.max(yPos + 170, childY);
        });
        return { first: first, bottom: yPos };
    }

    function applyRule(rule) {
        var bag = { fields: [], links: [], index: 1 };
        var chain = [];
        if (rule.trigger) {
            chain.push(rule.trigger);
        }
        (rule.components || []).forEach(function (comp) {
            chain.push(comp);
        });
        placeList(chain, 36, 36, bag);
        var kept = clone(rule);
        delete kept.trigger;
        delete kept.components;
        delete kept.id;
        state = {
            name: rule.name || "Импортированное правило",
            description: rule.description || "",
            canOtherRuleTrigger: rule.canOtherRuleTrigger !== false,
            originalId: rule.id || null,
            selectedId: null,
            rule: kept,
            fields: bag.fields,
            links: bag.links
        };
        statusText = "Импортирована копия. Правило в Automation for Jira не изменено.";
        scheduleSave();
        render();
    }

    function rulesFromPayload(data) {
        if (!data) {
            return [];
        }
        if (data.rules && data.rules.length) {
            return data.rules;
        }
        if (data.trigger || data.components) {
            return [data];
        }
        if (Object.prototype.toString.call(data) === "[object Array]") {
            return data;
        }
        return [];
    }

    function importRules(data) {
        var rules = rulesFromPayload(data);
        if (!rules.length) {
            statusText = "В файле нет правил";
            paintStatus();
            return false;
        }
        if (rules.length === 1) {
            applyRule(rules[0]);
            closeImport();
            return true;
        }
        showRulePicker(rules);
        return true;
    }

    function showRulePicker(rules) {
        var panel = ensureImport();
        var list = panel.querySelector(".nc-import-list");
        list.innerHTML = "";
        rules.forEach(function (rule, index) {
            var button = el("button", "nc-btn", (rule.name || "Правило " + (index + 1)));
            button.type = "button";
            button.addEventListener("click", function () {
                applyRule(rule);
                closeImport();
            });
            list.appendChild(button);
        });
    }

    function ensureImport() {
        var panel = document.getElementById("nc-import");
        if (panel) {
            panel.style.display = "block";
            return panel;
        }
        panel = el("div", "nc-import");
        panel.id = "nc-import";
        panel.appendChild(el("h3", null, "Импорт правил"));
        panel.appendChild(el("p", null, "Читает экспорт Automation for Jira. Существующие правила не изменяются и не удаляются: на канвас попадает копия."));
        var actions = el("div", "nc-import-actions");
        var fromPlugin = el("button", "nc-btn nc-btn-primary", "Из Automation for Jira");
        fromPlugin.type = "button";
        fromPlugin.addEventListener("click", fetchOriginal);
        var file = document.createElement("input");
        file.type = "file";
        file.accept = "application/json,.json";
        file.id = "nc-import-file";
        file.addEventListener("change", function () {
            var picked = file.files && file.files[0];
            if (!picked) {
                return;
            }
            var reader = new FileReader();
            reader.onload = function () {
                try {
                    importRules(JSON.parse(String(reader.result)));
                } catch (e) {
                    statusText = "Файл не является JSON экспорта";
                    paintStatus();
                }
            };
            reader.readAsText(picked);
        });
        var download = el("button", "nc-btn", "Скачать JSON");
        download.type = "button";
        download.addEventListener("click", downloadCopy);
        var close = el("button", "nc-btn", "Закрыть");
        close.type = "button";
        close.addEventListener("click", closeImport);
        actions.appendChild(fromPlugin);
        actions.appendChild(download);
        actions.appendChild(close);
        panel.appendChild(actions);
        panel.appendChild(file);
        panel.appendChild(el("div", "nc-import-list"));
        document.body.appendChild(panel);
        return panel;
    }

    function toggleImport(force) {
        var panel = document.getElementById("nc-import");
        if (panel && panel.style.display !== "none" && !force) {
            closeImport();
            return;
        }
        ensureImport();
    }

    function closeImport() {
        var panel = document.getElementById("nc-import");
        if (panel) {
            panel.style.display = "none";
        }
    }

    function fetchOriginal() {
        var url = importUrl();
        if (!url) {
            statusText = "Адрес экспорта оригинального плагина не задан. Выберите файл JSON.";
            paintStatus();
            return;
        }
        statusText = "Чтение правил…";
        paintStatus();
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url);
        xhr.setRequestHeader("Accept", "application/json");
        xhr.setRequestHeader("X-Atlassian-Token", "no-check");
        xhr.onload = function () {
            if (xhr.status < 200 || xhr.status >= 300) {
                statusText = "Automation for Jira не отдал экспорт (" + xhr.status + "). Можно выбрать файл JSON.";
                paintStatus();
                return;
            }
            try {
                importRules(JSON.parse(xhr.responseText));
            } catch (e) {
                statusText = "Ответ экспорта не разобран";
                paintStatus();
            }
        };
        xhr.onerror = function () {
            statusText = "Не удалось прочитать Automation for Jira. Можно выбрать файл JSON.";
            paintStatus();
        };
        xhr.send();
    }

    function downloadCopy() {
        var payload = exportRules();
        var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        var link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "automation-rule-copy.json";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        statusText = "Скачана копия без идентификатора. Импорт в оригинале создаст новое правило.";
        paintStatus();
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
        if (closest(event.target, ".nc-settings") || closest(event.target, ".nc-import") || closest(event.target, "input, textarea, select, .nc-btn, .nc-check")) {
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
            },
            importRules: importRules,
            exportRules: exportRules
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
            assert(document.querySelectorAll(".nc-node").length === 5, "ожидалось 5 шагов примера");
            assert(document.querySelectorAll(".nc-wires .nc-line").length === 4, "ожидалось 4 линии");
            var conds = Array.prototype.map.call(document.querySelectorAll(".nc-cond"), function (node) { return node.textContent; }).join(" | ");
            assert(conds.indexOf("если тип задачи") !== -1, "условие правила: " + conds);
            assert(conds.indexOf("Медицин") === -1, "на канвасе не должно остаться полей формы");
            document.getElementById("nc-add").click();
            assert(document.querySelectorAll(".nc-node").length === 6, "кнопка добавляет шаг");
            var added = state.fields[state.fields.length - 1];
            assert(added.componentType === "jira.issue.comment", "новый шаг — комментарий");
            removeField(added.id);
            assert(state.fields.length === 5, "удаление шага");

            var blue = document.querySelector('.nc-node[data-id="f-blue"] .nc-head');
            var rect = blue.getBoundingClientRect();
            var startX = rect.left + 20;
            var startY = rect.top + 10;
            blue.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: startX, clientY: startY, pointerId: 1, button: 0 }));
            document.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: startX + 48, clientY: startY + 30, pointerId: 1, button: 0 }));
            document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: startX + 48, clientY: startY + 30, pointerId: 1, button: 0 }));
            var moved = fieldById("f-blue");
            assert(moved.x > 50 && moved.y > 40, "перетаскивание шага, x=" + moved.x + " y=" + moved.y);

            var head = document.querySelector('.nc-node[data-id="f-orange"] .nc-head');
            var hr = head.getBoundingClientRect();
            head.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: hr.left + 12, clientY: hr.top + 12, pointerId: 1, button: 0 }));
            document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: hr.left + 12, clientY: hr.top + 12, pointerId: 1, button: 0 }));
            assert(document.getElementById("nc-settings"), "клик открывает настройки");
            var titleInput = document.querySelector("#nc-settings input[type='text']");
            titleInput.value = "Назначить на автора";
            titleInput.dispatchEvent(new Event("input", { bubbles: true }));
            assert(fieldById("f-orange").title === "Назначить на автора", "название шага");

            var canvas = document.getElementById("nc-canvas");
            var cr = canvas.getBoundingClientRect();
            canvas.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: cr.left + 8, clientY: cr.top + 8, pointerId: 1, button: 0 }));
            assert(!state.selectedId, "клик по пустому месту закрывает окно");

            canvas.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: cr.left + 300, clientY: cr.top + 500 }));
            assert(state.fields.length === 6, "правый клик добавляет шаг");

            document.getElementById("nc-clear").click();
            assert(state.canOtherRuleTrigger === false, "флажок запуска из другого правила");
            document.getElementById("nc-block-title").value = "Служебное";
            document.getElementById("nc-block-title").dispatchEvent(new Event("input", { bubbles: true }));
            assert(state.description === "Служебное", "описание правила");

            var before = state.links.length;
            window.__nc.addLink("f-green", "o-head", "f-teal");
            assert(state.links.length === before + 1, "привязка линии");
            assert(document.querySelectorAll(".nc-chip").length >= 4, "чип следующего шага");
            var hit = document.querySelector('.nc-hit[data-link-id="' + state.links[state.links.length - 1].id + '"]');
            hit.dispatchEvent(new MouseEvent("click", { bubbles: true }));
            assert(state.links.length === before, "клик по линии отвязывает");

            window.__nc.importRules({
                cloud: false,
                rules: [{
                    id: 42,
                    name: "Импортированное",
                    description: "из оригинала",
                    canOtherRuleTrigger: false,
                    trigger: {
                        id: "t1",
                        component: "TRIGGER",
                        type: "jira.issue.event.trigger:created",
                        value: { eventKey: "jira:issue_created", issueEvent: "issue_created" },
                        children: [],
                        conditions: []
                    },
                    components: [{
                        id: "b1",
                        component: "CONDITION",
                        type: "jira.condition.container.block",
                        value: { summary: "тип задачи: Ошибка" },
                        conditions: [],
                        children: [
                            {
                                id: "if1",
                                component: "CONDITION",
                                type: "jira.condition.if.block",
                                value: { summary: "тип задачи: Ошибка" },
                                conditions: [],
                                children: [{
                                    id: "c1",
                                    component: "ACTION",
                                    type: "jira.issue.comment",
                                    value: { comment: "если ошибка" },
                                    children: [],
                                    conditions: []
                                }]
                            },
                            {
                                id: "el1",
                                component: "CONDITION",
                                type: "jira.condition.else.block",
                                value: {},
                                conditions: [],
                                children: [{
                                    id: "tr1",
                                    component: "ACTION",
                                    type: "jira.issue.transition",
                                    value: { statusName: "Готово" },
                                    children: [],
                                    conditions: []
                                }]
                            }
                        ]
                    }]
                }]
            });
            assert(state.name === "Импортированное", "имя импорта");
            assert(state.originalId === 42, "исходный id запомнен отдельно");
            assert(state.fields.length === 6, "импорт раскладывает шаги, сейчас " + state.fields.length);
            var exported = window.__nc.exportRules();
            assert(!exported.rules[0].id, "копия без id");
            assert(exported.rules[0].trigger.type === "jira.issue.event.trigger:created", "триггер сохранён");
            assert(exported.rules[0].components[0].type === "jira.condition.container.block", "блок если/иначе");
            assert(exported.rules[0].components[0].children.length === 2, "две ветки");
            assert(exported.rules[0].components[0].children[0].children[0].value.comment === "если ошибка", "комментарий ветки");
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
