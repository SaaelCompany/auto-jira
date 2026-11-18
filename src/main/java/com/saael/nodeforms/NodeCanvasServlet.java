package com.saael.nodeforms;

import com.atlassian.jira.component.ComponentAccessor;
import com.atlassian.jira.security.GlobalPermissionManager;
import com.atlassian.jira.security.JiraAuthenticationContext;
import com.atlassian.plugin.webresource.UrlMode;
import com.atlassian.plugin.webresource.WebResourceUrlProvider;

import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * Отдельная страница редактора. Не использует действия Automation for Jira,
 * поэтому адреса AutomationProjectAdminAction и AutomationGlobalAdminAction остаются у оригинала.
 */
public class NodeCanvasServlet extends HttpServlet {
    static final String MODULE = "com.saael.nodeforms:node-canvas";

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws IOException {
        JiraAuthenticationContext auth = ComponentAccessor.getComponent(JiraAuthenticationContext.class);
        GlobalPermissionManager permissions = ComponentAccessor.getComponent(GlobalPermissionManager.class);
        if (!Access.allowed(auth, permissions)) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN);
            return;
        }
        WebResourceUrlProvider urls = ComponentAccessor.getComponent(WebResourceUrlProvider.class);
        String context = request.getContextPath() == null ? "" : request.getContextPath();
        String css = resource(urls, context, "node-canvas.css");
        String script = resource(urls, context, "node-canvas.js");
        String rest = context + "/rest/node-forms/1.0/node-schema";
        String classic = context + "/secure/AutomationGlobalAdminAction!default.jspa";

        response.setCharacterEncoding("UTF-8");
        response.setContentType("text/html; charset=UTF-8");
        response.getWriter().write(page(css, script, rest, classic));
    }

    private static String page(String css, String script, String rest, String classic) {
        return "<!DOCTYPE html>\n"
                + "<html lang=\"ru\">\n"
                + "<head>\n"
                + "<meta charset=\"utf-8\">\n"
                + "<title>\u0420\u0435\u0434\u0430\u043a\u0442\u043e\u0440 \u043d\u043e\u0434</title>\n"
                + "<link rel=\"stylesheet\" href=\"" + escape(css) + "\">\n"
                + "</head>\n"
                + "<body class=\"nc-nodes\">\n"
                + "<div id=\"node-canvas-root\" data-rest=\"" + escape(rest) + "\" data-classic=\"" + escape(classic) + "\"></div>\n"
                + "<script src=\"" + escape(script) + "\"></script>\n"
                + "</body>\n"
                + "</html>\n";
    }

    private static String resource(WebResourceUrlProvider urls, String context, String name) {
        String url = null;
        if (urls != null) {
            url = urls.getStaticPluginResourceUrl(MODULE, name, UrlMode.RELATIVE);
        }
        if (url == null || url.length() == 0) {
            url = "/download/resources/" + MODULE + "/" + name;
        }
        if (url.startsWith("/") && context.length() > 0 && !url.startsWith(context + "/")) {
            return context + url;
        }
        return url;
    }

    private static String escape(String value) {
        return value.replace("&", "&amp;").replace("\"", "&quot;").replace("<", "&lt;");
    }
}
