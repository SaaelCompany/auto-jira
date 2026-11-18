package com.saael.nodeforms;

import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * Страница редактора. Классы Jira вызываются через загрузчик бандла,
 * без обязательного Import-Package: на Jira 8.21 пакет javax.servlet
 * уже отдан платформе, и жёсткий импорт не даёт бандлу включиться.
 */
public class NodeCanvasServlet extends HttpServlet {
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String projectKey = request.getParameter("projectKey");
        Object project = null;
        if (projectKey != null && projectKey.length() > 0) {
            project = findProject(projectKey);
            if (project == null && apiVisible()) {
                response.sendError(HttpServletResponse.SC_NOT_FOUND);
                return;
            }
        }
        Boolean allowed = allowed(project);
        if (allowed != null && !allowed.booleanValue()) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN);
            return;
        }
        String context = request.getContextPath() == null ? "" : request.getContextPath();
        String css = context + "/download/resources/com.saael.nodeforms:node-canvas/node-canvas.css";
        String script = context + "/download/resources/com.saael.nodeforms:node-canvas/node-canvas.js";
        String classic = context + "/secure/AutomationGlobalAdminAction!default.jspa";
        String source = context + "/rest/cb-automation/latest/project/GLOBAL/rule/export";
        response.setCharacterEncoding("UTF-8");
        response.setContentType("text/html; charset=UTF-8");
        response.getWriter().write(page(css, script, classic, source, project, projectKey));
    }

    private static String page(String css, String script, String classic, String source, Object project, String projectKey) {
        String projectId = text(project, "getId");
        String key = text(project, "getKey");
        if (key.length() == 0 && projectKey != null) {
            key = projectKey;
        }
        String name = text(project, "getName");
        String type = "software";
        if (project != null) {
            try {
                Object typeKey = project.getClass().getMethod("getProjectTypeKey").invoke(project);
                if (typeKey != null) {
                    Object value = typeKey.getClass().getMethod("getKey").invoke(typeKey);
                    if (value != null && String.valueOf(value).length() > 0) {
                        type = String.valueOf(value);
                    }
                }
            } catch (Exception ignored) {
                type = "software";
            }
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
                + " data-project-key=\"" + escape(key) + "\""
                + " data-project-name=\"" + escape(name) + "\""
                + " data-project-type=\"" + escape(type) + "\"></div>\n"
                + "<script src=\"" + escape(script) + "\"></script>\n"
                + "</body>\n"
                + "</html>\n";
    }

    private static boolean apiVisible() {
        try {
            Class.forName("com.atlassian.jira.component.ComponentAccessor");
            return true;
        } catch (Throwable ignored) {
            return false;
        }
    }

    private static Object findProject(String projectKey) {
        try {
            Object manager = component("com.atlassian.jira.project.ProjectManager");
            if (manager == null) {
                return null;
            }
            return manager.getClass().getMethod("getProjectByCurrentKey", String.class).invoke(manager, projectKey);
        } catch (Throwable ignored) {
            return null;
        }
    }

    /**
     * @return TRUE/FALSE when Jira answered, null when the API could not be called
     */
    private static Boolean allowed(Object project) {
        try {
            Object auth = component("com.atlassian.jira.security.JiraAuthenticationContext");
            if (auth == null) {
                return null;
            }
            Object user = auth.getClass().getMethod("getLoggedInUser").invoke(auth);
            if (user == null) {
                return Boolean.FALSE;
            }
            Class<?> userType = Class.forName("com.atlassian.jira.user.ApplicationUser");
            Object global = component("com.atlassian.jira.security.GlobalPermissionManager");
            Class<?> globalKey = Class.forName("com.atlassian.jira.permission.GlobalPermissionKey");
            if (global != null && (has(global, globalKey, globalKey.getField("ADMINISTER").get(null), userType, user)
                    || has(global, globalKey, globalKey.getField("SYSTEM_ADMIN").get(null), userType, user))) {
                return Boolean.TRUE;
            }
            if (project == null) {
                return Boolean.FALSE;
            }
            Object projects = component("com.atlassian.jira.security.PermissionManager");
            Class<?> projectKeyType = Class.forName("com.atlassian.jira.permission.ProjectPermissionKey");
            Class<?> projectType = Class.forName("com.atlassian.jira.project.Project");
            Object administer = Class.forName("com.atlassian.jira.permission.ProjectPermissions")
                    .getField("ADMINISTER_PROJECTS").get(null);
            if (projects == null) {
                return null;
            }
            Object result = projects.getClass()
                    .getMethod("hasPermission", projectKeyType, projectType, userType)
                    .invoke(projects, administer, project, user);
            return Boolean.TRUE.equals(result) ? Boolean.TRUE : Boolean.FALSE;
        } catch (Throwable ignored) {
            return null;
        }
    }

    private static boolean has(Object manager, Class<?> keyType, Object key, Class<?> userType, Object user) throws Exception {
        Object result = manager.getClass().getMethod("hasPermission", keyType, userType).invoke(manager, key, user);
        return Boolean.TRUE.equals(result);
    }

    private static Object component(String className) throws Exception {
        Class<?> accessor = Class.forName("com.atlassian.jira.component.ComponentAccessor");
        Class<?> type = Class.forName(className);
        return accessor.getMethod("getComponent", Class.class).invoke(null, type);
    }

    private static String text(Object target, String method) {
        if (target == null) {
            return "";
        }
        try {
            Object value = target.getClass().getMethod(method).invoke(target);
            return value == null ? "" : String.valueOf(value);
        } catch (Exception ignored) {
            return "";
        }
    }

    private static String escape(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("&", "&amp;").replace("\"", "&quot;").replace("<", "&lt;");
    }
}
