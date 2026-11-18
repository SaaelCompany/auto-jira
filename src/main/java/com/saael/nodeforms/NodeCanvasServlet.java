package com.saael.nodeforms;

import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * Страница редактора. Класс зависит только от servlet API: остальные пакеты
 * Jira в Import-Package не обязательны, иначе бандл не резолвится и UPM
 * показывает 0 модулей.
 */
public class NodeCanvasServlet extends HttpServlet {
    static final String MODULE = "com.saael.nodeforms:node-canvas";

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String context = request.getContextPath() == null ? "" : request.getContextPath();
        String projectKey = request.getParameter("projectKey");
        if (projectKey == null) {
            projectKey = "";
        }
        String css = context + "/download/resources/" + MODULE + "/node-canvas.css";
        String script = context + "/download/resources/" + MODULE + "/node-canvas.js";
        String classic = context + "/secure/AutomationGlobalAdminAction!default.jspa";
        String source = context + "/rest/cb-automation/latest/project/GLOBAL/rule/export";
        response.setCharacterEncoding("UTF-8");
        response.setContentType("text/html; charset=UTF-8");
        response.getWriter().write(page(css, script, classic, source, projectKey));
    }

    private static String page(String css, String script, String classic, String source, String projectKey) {
        return "<!DOCTYPE html>\n"
                + "<html lang=\"ru\">\n"
                + "<head>\n"
                + "<meta charset=\"utf-8\">\n"
                + "<title>\u0420\u0435\u0434\u0430\u043a\u0442\u043e\u0440 \u043d\u043e\u0434</title>\n"
                + "<link rel=\"stylesheet\" href=\"" + escape(css) + "\">\n"
                + "</head>\n"
                + "<body class=\"nc-nodes\">\n"
                + "<div id=\"node-canvas-root\""
                + " data-classic=\"" + escape(classic) + "\""
                + " data-import=\"" + escape(source) + "\""
                + " data-project=\"\""
                + " data-project-key=\"" + escape(projectKey) + "\""
                + " data-project-name=\"\""
                + " data-project-type=\"\"></div>\n"
                + "<script src=\"" + escape(script) + "\"></script>\n"
                + "</body>\n"
                + "</html>\n";
    }

    private static String escape(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("&", "&amp;").replace("\"", "&quot;").replace("<", "&lt;");
    }
}
