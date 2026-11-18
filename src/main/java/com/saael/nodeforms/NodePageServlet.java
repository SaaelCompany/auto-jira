package com.saael.nodeforms;

import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;

/**
 * Страница редактора по адресу /plugins/servlet/niout-automation.
 * Этот путь Jira декорирует шапкой, в отличие от /download/resources.
 */
public class NodePageServlet extends HttpServlet {
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String context = request.getContextPath();
        if (context == null) {
            context = "";
        }
        response.setCharacterEncoding("UTF-8");
        response.setContentType("text/html; charset=UTF-8");
        PrintWriter writer = response.getWriter();
        writer.write("<!DOCTYPE html>\n<html>\n<head>\n<meta charset=\"utf-8\">\n");
        writer.write("<title>\u0410\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0437\u0430\u0446\u0438\u044f</title>\n");
        writer.write("<meta name=\"decorator\" content=\"atl.general\">\n");
        writer.write("<link rel=\"stylesheet\" href=\"");
        writer.write(context);
        writer.write("/download/resources/com.saael.nodeforms:node-canvas/node-canvas.css\">\n");
        writer.write("</head>\n<body>\n<div id=\"node-canvas-root\"></div>\n<script src=\"");
        writer.write(context);
        writer.write("/download/resources/com.saael.nodeforms:node-canvas/node-canvas.js\"></script>\n");
        writer.write("</body>\n</html>\n");
    }
}
