package com.saael.nodeforms;

import com.atlassian.jira.web.action.JiraWebActionSupport;

/**
 * Страница редактора внутри шапки Jira. Адрес /secure/NodeFormsAction.jspa
 * проходит через декоратор atl.general.
 */
public class NodeFormsAction extends JiraWebActionSupport {
    @Override
    public String doDefault() throws Exception {
        return "success";
    }

    @Override
    public String doExecute() throws Exception {
        return "success";
    }
}
