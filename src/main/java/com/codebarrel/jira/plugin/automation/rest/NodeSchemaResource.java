package com.codebarrel.jira.plugin.automation.rest;

import com.atlassian.plugin.spring.scanner.annotation.component.Scanned;
import com.atlassian.plugin.spring.scanner.annotation.imports.ComponentImport;
import com.atlassian.sal.api.pluginsettings.PluginSettings;
import com.atlassian.sal.api.pluginsettings.PluginSettingsFactory;

import javax.inject.Inject;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.PUT;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Хранит схему нод (вопросы, варианты и связи) в настройках плагина.
 * Значение режется на части: в Jira 8 строка propertystring ограничена 255 символами.
 */
@Path("/node-schema")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@Scanned
public class NodeSchemaResource {
    static final String KEY = "com.codebarrel.automation.node.schema";
    static final int CHUNK = 180;
    static final int MAX = 400000;

    private final PluginSettingsFactory pluginSettingsFactory;
    private final CurrentUserPermissionHelper permissionHelper;

    @Inject
    public NodeSchemaResource(@ComponentImport PluginSettingsFactory pluginSettingsFactory,
                              CurrentUserPermissionHelper permissionHelper) {
        this.pluginSettingsFactory = pluginSettingsFactory;
        this.permissionHelper = permissionHelper;
    }

    @GET
    public Response get() {
        if (!allowed()) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        String json = read(settings());
        if (json == null || json.trim().isEmpty()) {
            json = "{}";
        }
        return Response.ok(json, MediaType.APPLICATION_JSON_TYPE).build();
    }

    @PUT
    public Response put(InputStream body) {
        if (!allowed()) {
            return Response.status(Response.Status.FORBIDDEN).build();
        }
        final String json;
        try {
            json = readStream(body);
        } catch (Exception ex) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("{\"error\":\"read\"}")
                    .type(MediaType.APPLICATION_JSON)
                    .build();
        }
        if (!looksLikeObject(json)) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("{\"error\":\"invalid\"}")
                    .type(MediaType.APPLICATION_JSON)
                    .build();
        }
        write(settings(), json);
        return Response.ok(json, MediaType.APPLICATION_JSON_TYPE).build();
    }

    private boolean allowed() {
        return permissionHelper.isJiraAdmin() || permissionHelper.isAnyProjectAdmin();
    }

    private PluginSettings settings() {
        return pluginSettingsFactory.createGlobalSettings();
    }

    static String read(PluginSettings settings) {
        int count = parseCount(settings.get(KEY + ".n"));
        if (count <= 0) {
            return "";
        }
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < count; i++) {
            Object part = settings.get(KEY + "." + i);
            if (part != null) {
                builder.append(String.valueOf(part));
            }
        }
        return builder.toString();
    }

    static void write(PluginSettings settings, String json) {
        int previous = parseCount(settings.get(KEY + ".n"));
        int count = json.isEmpty() ? 0 : (json.length() + CHUNK - 1) / CHUNK;
        for (int i = 0; i < count; i++) {
            int start = i * CHUNK;
            int end = Math.min(json.length(), start + CHUNK);
            settings.put(KEY + "." + i, json.substring(start, end));
        }
        for (int i = count; i < previous; i++) {
            settings.remove(KEY + "." + i);
        }
        settings.put(KEY + ".n", String.valueOf(count));
    }

    private static int parseCount(Object value) {
        if (value == null) {
            return 0;
        }
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return 0;
        }
    }

    private static String readStream(InputStream in) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[4096];
        int total = 0;
        int read;
        while ((read = in.read(buffer)) >= 0) {
            total += read;
            if (total > MAX) {
                throw new IllegalArgumentException("too big");
            }
            out.write(buffer, 0, read);
        }
        return new String(out.toByteArray(), StandardCharsets.UTF_8).trim();
    }

    private static boolean looksLikeObject(String json) {
        return json.length() >= 2 && json.charAt(0) == '{' && json.charAt(json.length() - 1) == '}';
    }
}
