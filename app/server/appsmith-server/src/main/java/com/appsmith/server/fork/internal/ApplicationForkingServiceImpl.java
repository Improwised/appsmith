package com.appsmith.server.fork.internal;

import com.appsmith.external.models.Datasource;
import com.appsmith.server.actioncollections.base.ActionCollectionService;
import com.appsmith.server.fork.forkable.ForkableService;
import com.appsmith.server.helpers.ResponseUtils;
import com.appsmith.server.imports.internal.ImportApplicationService;
import com.appsmith.server.newactions.base.NewActionService;
import com.appsmith.server.repositories.ActionCollectionRepositoryCake;
import com.appsmith.server.repositories.NewActionRepository;
import com.appsmith.server.repositories.NewPageRepository;
import com.appsmith.server.repositories.WorkspaceRepositoryCake;
import com.appsmith.server.services.AnalyticsService;
import com.appsmith.server.services.ApplicationPageService;
import com.appsmith.server.services.ApplicationService;
import com.appsmith.server.services.LayoutActionService;
import com.appsmith.server.services.PermissionGroupService;
import com.appsmith.server.services.SessionUserService;
import com.appsmith.server.services.WorkspaceService;
import com.appsmith.server.solutions.ActionPermission;
import com.appsmith.server.solutions.ApplicationPermission;
import com.appsmith.server.solutions.PagePermission;
import com.appsmith.server.solutions.WorkspacePermission;
import com.appsmith.server.themes.base.ThemeService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class ApplicationForkingServiceImpl extends ApplicationForkingServiceCEImpl
        implements ApplicationForkingService {

    public ApplicationForkingServiceImpl(
            ApplicationService applicationService,
            WorkspaceService workspaceService,
            SessionUserService sessionUserService,
            AnalyticsService analyticsService,
            ResponseUtils responseUtils,
            WorkspacePermission workspacePermission,
            ApplicationPermission applicationPermission,
            ImportApplicationService importApplicationService,
            ApplicationPageService applicationPageService,
            NewPageRepository newPageRepository,
            NewActionService newActionService,
            LayoutActionService layoutActionService,
            ActionCollectionService actionCollectionService,
            ThemeService themeService,
            PagePermission pagePermission,
            ActionPermission actionPermission,
            PermissionGroupService permissionGroupService,
            ActionCollectionRepositoryCake actionCollectionRepository,
            NewActionRepository newActionRepository,
            WorkspaceRepositoryCake workspaceRepository,
            ForkableService<Datasource> datasourceForkableService) {
        super(
                applicationService,
                workspaceService,
                sessionUserService,
                analyticsService,
                responseUtils,
                workspacePermission,
                applicationPermission,
                importApplicationService,
                applicationPageService,
                newPageRepository,
                newActionService,
                layoutActionService,
                actionCollectionService,
                themeService,
                pagePermission,
                actionPermission,
                permissionGroupService,
                actionCollectionRepository,
                newActionRepository,
                workspaceRepository,
                datasourceForkableService);
    }
}
