package com.saael.nodeforms;

import com.atlassian.jira.component.ComponentAccessor;
import com.atlassian.jira.project.Project;
import com.atlassian.jira.project.ProjectManager;
import com.atlassian.jira.project.type.ProjectTypeKey;
import com.atlassian.jira.security.GlobalPermissionManager;
import com.atlassian.jira.security.JiraAuthenticationContext;
import com.atlassian.jira.security.PermissionManager;
import com.atlassian.plugin.webresource.UrlMode;
import com.atlassian.plugin.webresource.WebResourceUrlProvider;

import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * Страница редактора. Плагин первой версии грузится загрузчиком Jira,
 * поэтому классы платформы видны без OSGi Import-Package.
 */
public class NodeCanvasServlet extends HttpServlet {
    static final String MODULE = "com.saael.nodeforms:node-canvas";

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws IOException {
        JiraAuthenticationContext auth = ComponentAccessor.getComponent(JiraAuthenticationContext.class);
        GlobalPermissionManager global = ComponentAccessor.getComponent(GlobalPermissionManager.class);
        PermissionManager projects = ComponentAccessor.getComponent(PermissionManager.class);
        String projectKey = request.getParameter("projectKey");
        Project project = null;
        if (projectKey != null && projectKey.length() > 0) {
            ProjectManager manager = ComponentAccessor.getComponent(ProjectManager.class);
            project = manager == null ? null : manager.getProjectByCurrentKey(projectKey);
            if (project == null) {
                response.sendError(HttpServletResponse.SC_NOT_FOUND);
                return;
            }
        }
        if (!Access.allowed(auth, global, projects, project)) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN);
            return;
        }
        WebResourceUrlProvider urls = ComponentAccessor.getComponent(WebResourceUrlProvider.class);
        String context = request.getContextPath() == null ? "" : request.getContextPath();
        String css = resource(urls, context, "node-canvas.css");
        String script = resource(urls, context, "node-canvas.js");
        String classic = context + "/secure/AutomationGlobalAdminAction!default.jspa";
        String source = context + "/rest/cb-automation/latest/project/GLOBAL/rule/export";
        response.setCharacterEncoding("UTF-8");
        response.setContentType("text/html; charset=UTF-8");
        response.getWriter().write(page(css, script, classic, source, project));
    }

    private static String page(String css, String script, String classic, String source, Project project) {
        String projectId = "";
        String projectKey = "";
        String projectName = "";
        String projectType = "";
        if (project != null) {
            projectId = project.getId() == null ? "" : String.valueOf(project.getId());
            projectKey = project.getKey() == null ? "" : project.getKey();
            projectName = project.getName() == null ? "" : project.getName();
            ProjectTypeKey type = project.getProjectTypeKey();
            projectType = type == null || type.getKey() == null ? "" : type.getKey();
        }
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
                + " data-project=\"" + escape(projectId) + "\""
                + " data-project-key=\"" + escape(projectKey) + "\""
                + " data-project-name=\"" + escape(projectName) + "\""
                + " data-project-type=\"" + escape(projectType) + "\"></div>\n"
                + "<script src=\"" + escape(script) + "\"></script>\n"
                + "</body>\n"
                + "</html>\n";
    }

    private static String resource(WebResourceUrlProvider urls, String context, String name) {
        String url = null;
        if (urls != null) {
            try {
                url = urls.getStaticPluginResourceUrl(MODULE, name, UrlMode.RELATIVE);
            } catch (RuntimeException ignored) {
                url = null;
            }
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
        if (value == null) {
            return "";
        }
        return value.replace("&", "&amp;").replace("\"", "&quot;").replace("<", "&lt;");
    }
}
