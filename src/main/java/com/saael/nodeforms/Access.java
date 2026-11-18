package com.saael.nodeforms;

import com.atlassian.jira.permission.GlobalPermissionKey;
import com.atlassian.jira.security.GlobalPermissionManager;
import com.atlassian.jira.security.JiraAuthenticationContext;
import com.atlassian.jira.user.ApplicationUser;

final class Access {
    private Access() {
    }

    static boolean allowed(JiraAuthenticationContext auth, GlobalPermissionManager permissions) {
        if (auth == null || permissions == null) {
            return false;
        }
        ApplicationUser user = auth.getLoggedInUser();
        if (user == null) {
            return false;
        }
        return permissions.hasPermission(GlobalPermissionKey.ADMINISTER, user)
                || permissions.hasPermission(GlobalPermissionKey.SYSTEM_ADMIN, user);
    }
}
