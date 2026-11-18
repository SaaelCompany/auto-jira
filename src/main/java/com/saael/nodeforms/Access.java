package com.saael.nodeforms;

import com.atlassian.jira.permission.GlobalPermissionKey;
import com.atlassian.jira.permission.ProjectPermissions;
import com.atlassian.jira.project.Project;
import com.atlassian.jira.security.GlobalPermissionManager;
import com.atlassian.jira.security.JiraAuthenticationContext;
import com.atlassian.jira.security.PermissionManager;
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

    static boolean allowed(JiraAuthenticationContext auth, GlobalPermissionManager global,
                           PermissionManager projects, Project project) {
        if (allowed(auth, global)) {
            return true;
        }
        if (auth == null || projects == null || project == null) {
            return false;
        }
        ApplicationUser user = auth.getLoggedInUser();
        return user != null && projects.hasPermission(ProjectPermissions.ADMINISTER_PROJECTS, project, user);
    }
}
