package com.saael.nodeforms;

import com.atlassian.event.api.EventListener;
import com.atlassian.event.api.EventPublisher;
import com.atlassian.jira.component.ComponentAccessor;
import com.atlassian.jira.event.ProjectDeletedEvent;
import com.atlassian.jira.event.issue.commit.OnCommitIssueEventBundle;
import com.atlassian.jira.event.issue.link.IssueLinkCreatedEvent;
import com.atlassian.jira.event.issue.link.IssueLinkDeletedEvent;
import com.atlassian.jira.event.issue.property.IssuePropertySetEvent;
import com.atlassian.jira.event.project.VersionCreateEvent;
import com.atlassian.jira.event.project.VersionReleaseEvent;
import com.atlassian.jira.event.project.VersionUnreleaseEvent;
import com.atlassian.jira.event.project.VersionUpdatedEvent;
import com.atlassian.jira.event.worklog.WorklogCreatedEvent;
import com.atlassian.jira.event.worklog.WorklogDeletedEvent;
import com.atlassian.jira.event.worklog.WorklogUpdatedEvent;
import org.osgi.framework.Bundle;
import org.osgi.framework.BundleContext;
import org.osgi.framework.FrameworkUtil;
import org.osgi.framework.ServiceReference;

import java.lang.reflect.Method;

/**
 * Второе срабатывание тех же правил. Слушатель Automation for Jira уже получает
 * событие от Jira; здесь то же событие передаётся ему ещё раз.
 */
public final class RuleReplay {
    private static final String LISTENER =
            "com.codebarrel.jira.plugin.automation.event.JiraIssueEventListener";
    private static final String IMPL =
            "com.codebarrel.jira.plugin.automation.event.JiraIssueEventListenerImpl";
    private static final RuleReplay INSTANCE = new RuleReplay();
    private static volatile boolean registered;
    private volatile Object cached;
    private volatile long cachedAt;

    private RuleReplay() {
    }

    static void start() {
        if (registered) {
            return;
        }
        synchronized (RuleReplay.class) {
            if (registered) {
                return;
            }
            try {
                EventPublisher publisher = ComponentAccessor.getComponent(EventPublisher.class);
                if (publisher == null) {
                    return;
                }
                publisher.register(INSTANCE);
                registered = true;
            } catch (Throwable ignored) {
                registered = false;
            }
        }
    }

    static void stop() {
        synchronized (RuleReplay.class) {
            if (!registered) {
                return;
            }
            try {
                EventPublisher publisher = ComponentAccessor.getComponent(EventPublisher.class);
                if (publisher != null) {
                    publisher.unregister(INSTANCE);
                }
            } catch (Throwable ignored) {
                /* страница всё равно должна выключаться */
            }
            registered = false;
            INSTANCE.cached = null;
        }
    }

    @EventListener
    public void onCommit(OnCommitIssueEventBundle event) {
        replay(event);
    }

    @EventListener
    public void onVersionCreate(VersionCreateEvent event) {
        replay(event);
    }

    @EventListener
    public void onVersionUpdate(VersionUpdatedEvent event) {
        replay(event);
    }

    @EventListener
    public void onVersionRelease(VersionReleaseEvent event) {
        replay(event);
    }

    @EventListener
    public void onVersionUnrelease(VersionUnreleaseEvent event) {
        replay(event);
    }

    @EventListener
    public void onIssueProperty(IssuePropertySetEvent event) {
        replay(event);
    }

    @EventListener
    public void onWorklogCreate(WorklogCreatedEvent event) {
        replay(event);
    }

    @EventListener
    public void onWorklogUpdate(WorklogUpdatedEvent event) {
        replay(event);
    }

    @EventListener
    public void onWorklogDelete(WorklogDeletedEvent event) {
        replay(event);
    }

    @EventListener
    public void onProjectDelete(ProjectDeletedEvent event) {
        replay(event);
    }

    @EventListener
    public void onLinkCreate(IssueLinkCreatedEvent event) {
        replay(event);
    }

    @EventListener
    public void onLinkDelete(IssueLinkDeletedEvent event) {
        replay(event);
    }

    private void replay(Object event) {
        if (event == null) {
            return;
        }
        Object listener = listener();
        if (listener == null) {
            return;
        }
        Method match = null;
        for (Method method : listener.getClass().getMethods()) {
            Class<?>[] params = method.getParameterTypes();
            if (params.length != 1 || params[0] == Object.class || !params[0].isInstance(event)) {
                continue;
            }
            String name = method.getName();
            if (!name.equals("handleEvent") && !name.startsWith("handle")) {
                continue;
            }
            if (match == null || match.getParameterTypes()[0].isAssignableFrom(params[0])) {
                match = method;
            }
        }
        if (match == null) {
            return;
        }
        try {
            match.invoke(listener, event);
        } catch (Throwable ignored) {
            cached = null;
        }
    }

    private Object listener() {
        Object current = cached;
        long now = System.currentTimeMillis();
        if (current != null && now - cachedAt < 60000L) {
            return current;
        }
        current = findListener();
        cached = current;
        cachedAt = now;
        return current;
    }

    private static Object findListener() {
        Bundle bundle = FrameworkUtil.getBundle(RuleReplay.class);
        if (bundle == null) {
            return null;
        }
        BundleContext context = bundle.getBundleContext();
        if (context == null) {
            return null;
        }
        Object found = first(context, "(objectClass=" + LISTENER + ")");
        if (found != null) {
            return found;
        }
        return first(context, "(objectClass=" + IMPL + ")");
    }

    private static Object first(BundleContext context, String filter) {
        ServiceReference<?>[] refs;
        try {
            refs = context.getAllServiceReferences(null, filter);
        } catch (Throwable ignored) {
            return null;
        }
        if (refs == null) {
            return null;
        }
        for (int i = 0; i < refs.length; i++) {
            Object service = context.getService(refs[i]);
            if (service != null) {
                return service;
            }
        }
        return null;
    }
}
