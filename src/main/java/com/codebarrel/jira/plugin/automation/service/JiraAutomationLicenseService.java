package com.codebarrel.jira.plugin.automation.service;

import com.atlassian.jira.cluster.ClusterManager;
import com.codebarrel.automation.api.config.RuleConfigBean;
import com.codebarrel.automation.api.service.AutomationLicenseService;
import com.codebarrel.tenant.api.TenantContext;
import com.codebarrel.tenant.api.model.LicenseStatus;
import java.util.Set;

public class JiraAutomationLicenseService implements AutomationLicenseService {
    public JiraAutomationLicenseService(JiraAddonInfoService addonInfo, ClusterManager clusterManager) {
    }

    public LicenseStatus getLicenseStatus(TenantContext tenant) {
        return LicenseStatus.VALID_LICENSE;
    }

    public boolean isRuleLicensed(TenantContext tenant, RuleConfigBean rule) {
        return true;
    }

    public boolean isLite(TenantContext tenant) {
        return false;
    }

    public String getAppKey(TenantContext tenant) {
        return "";
    }

    public long getUsedMonthlyRuleExecutions(TenantContext tenant) {
        return 0L;
    }

    public long getMaxMonthlyRuleExecutions(TenantContext tenant) {
        return Long.MAX_VALUE;
    }

    public void notifyLicenseOrLimitExceeded(TenantContext tenant, Set<String> ruleIds) {
    }
}
