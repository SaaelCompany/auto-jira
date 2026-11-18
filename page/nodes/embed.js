(function () {
    try {
        if (!/[?&]nioutAutomation=1(?:&|$)/.test(window.location.search || "")) {
            return;
        }
        function mount() {
            if (document.getElementById("node-canvas-root") || !document.body) {
                return;
            }
            var content = document.getElementById("content") || document.body;
            document.body.classList.add("nc-embed");
            var root = document.createElement("div");
            root.id = "node-canvas-root";
            content.innerHTML = "";
            content.appendChild(root);
            var meta = document.querySelector("meta[name='ajs-context-path']");
            var ctx = meta ? (meta.getAttribute("content") || "") : "";
            var css = document.createElement("link");
            css.rel = "stylesheet";
            css.href = ctx + "/download/resources/com.saael.nodeforms:node-canvas/node-canvas.css";
            document.head.appendChild(css);
            var script = document.createElement("script");
            script.src = ctx + "/download/resources/com.saael.nodeforms:node-canvas/node-canvas.js";
            document.body.appendChild(script);
        }
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", mount);
        } else {
            mount();
        }
    } catch (e) {
        /* страница Jira остаётся рабочей */
    }
})();
