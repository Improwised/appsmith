package com.appsmith.server.services.ce;

import com.appsmith.external.models.ActionDTO;
import com.appsmith.external.models.CreatorContextType;
import com.appsmith.external.models.DefaultResources;
import com.appsmith.server.actioncollections.base.ActionCollectionService;
import com.appsmith.server.constants.FieldName;
import com.appsmith.server.domains.ActionCollection;
import com.appsmith.server.domains.Layout;
import com.appsmith.server.domains.NewPage;
import com.appsmith.server.dtos.ActionCollectionDTO;
import com.appsmith.server.dtos.ActionCollectionMoveDTO;
import com.appsmith.server.exceptions.AppsmithError;
import com.appsmith.server.exceptions.AppsmithException;
import com.appsmith.server.helpers.ContextTypeUtils;
import com.appsmith.server.helpers.ReactiveContextUtils;
import com.appsmith.server.helpers.ResponseUtils;
import com.appsmith.server.helpers.ce.bridge.Bridge;
import com.appsmith.server.helpers.ce.bridge.BridgeUpdate;
import com.appsmith.server.layouts.UpdateLayoutService;
import com.appsmith.server.newactions.base.NewActionService;
import com.appsmith.server.newpages.base.NewPageService;
import com.appsmith.server.refactors.applications.RefactoringService;
import com.appsmith.server.repositories.ActionCollectionRepository;
import com.appsmith.server.services.AnalyticsService;
import com.appsmith.server.services.LayoutActionService;
import com.appsmith.server.solutions.ActionPermission;
import com.appsmith.server.solutions.PagePermission;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import static com.appsmith.external.helpers.AppsmithBeanUtils.copyNewFieldValuesIntoOldObject;
import static com.appsmith.server.helpers.ContextTypeUtils.isPageContext;
import static java.util.stream.Collectors.toMap;
import static java.util.stream.Collectors.toSet;

@Slf4j
@RequiredArgsConstructor
public class LayoutCollectionServiceCEImpl implements LayoutCollectionServiceCE {

    private final NewPageService newPageService;
    private final LayoutActionService layoutActionService;
    private final UpdateLayoutService updateLayoutService;
    protected final RefactoringService refactoringService;
    protected final ActionCollectionService actionCollectionService;
    private final NewActionService newActionService;
    private final AnalyticsService analyticsService;
    private final ResponseUtils responseUtils;
    private final ActionCollectionRepository actionCollectionRepository;
    private final PagePermission pagePermission;
    private final ActionPermission actionPermission;

    /**
     * Called by ActionCollection controller to create ActionCollection
     */
    @Override
    public Mono<ActionCollectionDTO> createCollection(ActionCollection actionCollection) {
        ActionCollectionDTO collectionDTO = actionCollection.getUnpublishedCollection();
        if (collectionDTO.getId() != null) {
            return Mono.error(new AppsmithException(AppsmithError.INVALID_PARAMETER, FieldName.ID));
        }

        validateApplicationId(collectionDTO);

        // First check if the collection name is allowed
        // If the collection name is unique, the action name will be guaranteed to be unique within that collection
        return checkIfNameAllowedBasedOnContext(collectionDTO)
                .flatMap(isNameAllowed -> {
                    // If the name is allowed, return list of actionDTOs for further processing
                    if (Boolean.TRUE.equals(isNameAllowed)) {
                        return actionCollectionService.validateAndSaveCollection(actionCollection);
                    }
                    // Throw an error since the new action collection's name matches an existing action, widget or
                    // collection name.
                    return Mono.error(new AppsmithException(
                            AppsmithError.DUPLICATE_KEY_USER_ERROR, collectionDTO.getName(), FieldName.NAME));
                })
                .flatMap(collectionDTO1 -> {
                    List<ActionDTO> actions = collectionDTO1.getActions();

                    if (actions == null || actions.isEmpty()) {
                        return Mono.just(collectionDTO1);
                    }

                    return Flux.fromIterable(actions)
                            .flatMap(action -> layoutActionService.updateSingleAction(action.getId(), action))
                            .then(Mono.just(collectionDTO1));
                })
                .flatMap(updatedCollection -> updateLayoutService
                        .updatePageLayoutsByPageId(updatedCollection.getPageId())
                        .thenReturn(updatedCollection));
    }

    private void validateApplicationId(ActionCollectionDTO collectionDTO) {
        if (isPageContext(collectionDTO.getContextType())) {
            String applicationId = collectionDTO.getApplicationId();
            if (StringUtils.isEmpty(applicationId)) {
                throw new AppsmithException(AppsmithError.INVALID_PARAMETER, FieldName.APPLICATION_ID);
            }
        }
    }

    protected Mono<Boolean> checkIfNameAllowedBasedOnContext(ActionCollectionDTO collectionDTO) {
        final String pageId = collectionDTO.getPageId();
        Mono<NewPage> pageMono = newPageService
                .findById(pageId, pagePermission.getActionCreatePermission())
                .switchIfEmpty(
                        Mono.error(new AppsmithException(AppsmithError.ACL_NO_RESOURCE_FOUND, FieldName.PAGE, pageId)))
                .cache();
        return pageMono.flatMap(page -> {
            Layout layout = page.getUnpublishedPage().getLayouts().get(0);
            CreatorContextType contextType = ContextTypeUtils.getDefaultContextIfNull(collectionDTO.getContextType());
            // Check against widget names and action names
            return refactoringService.isNameAllowed(page.getId(), contextType, layout.getId(), collectionDTO.getName());
        });
    }

    @Override
    public Mono<ActionCollectionDTO> createCollection(ActionCollectionDTO collectionDTO, String branchName) {
        if (collectionDTO.getId() != null) {
            return Mono.error(new AppsmithException(AppsmithError.INVALID_PARAMETER, FieldName.ID));
        }

        return validateAndCreateActionCollectionDomain(collectionDTO, branchName)
                .flatMap(actionCollection -> createCollection(actionCollection)
                        .flatMap(actionCollectionDTO -> actionCollectionService
                                .saveLastEditInformationInParent(actionCollectionDTO)
                                .thenReturn(actionCollectionDTO)))
                .map(actionCollectionDTO -> responseUtils.updateCollectionDTOWithDefaultResources(actionCollectionDTO));
    }

    protected Mono<ActionCollection> validateAndCreateActionCollectionDomain(
            ActionCollectionDTO collectionDTO, String branchName) {
        if (StringUtils.isEmpty(collectionDTO.getPageId())) {
            return Mono.error(new AppsmithException(AppsmithError.INVALID_PARAMETER, FieldName.PAGE_ID));
        }

        if (StringUtils.isEmpty(collectionDTO.getApplicationId())) {
            return Mono.error(new AppsmithException(AppsmithError.INVALID_PARAMETER, FieldName.APPLICATION_ID));
        }

        ActionCollection actionCollection = new ActionCollection();
        actionCollection.setUnpublishedCollection(collectionDTO);

        return newPageService
                .findByBranchNameAndDefaultPageId(
                        branchName, collectionDTO.getPageId(), pagePermission.getActionCreatePermission())
                .map(branchedPage -> {
                    // Insert defaultPageId and defaultAppId from page
                    DefaultResources defaultResources = branchedPage.getDefaultResources();
                    defaultResources.setBranchName(branchName);
                    collectionDTO.setDefaultResources(defaultResources);
                    actionCollection.setDefaultResources(defaultResources);
                    actionCollectionService.generateAndSetPolicies(branchedPage, actionCollection);
                    actionCollection.setUnpublishedCollection(collectionDTO);

                    // Update the page and application id with branched resource
                    collectionDTO.setApplicationId(branchedPage.getApplicationId());
                    collectionDTO.setPageId(branchedPage.getId());

                    actionCollection.setWorkspaceId(collectionDTO.getWorkspaceId());
                    actionCollection.setApplicationId(branchedPage.getApplicationId());

                    return actionCollection;
                });
    }

    @Override
    public Mono<ActionCollectionDTO> moveCollection(ActionCollectionMoveDTO actionCollectionMoveDTO) {
        final String collectionId = actionCollectionMoveDTO.getCollectionId();
        final String destinationPageId = actionCollectionMoveDTO.getDestinationPageId();

        Mono<NewPage> destinationPageMono = newPageService
                .findById(actionCollectionMoveDTO.getDestinationPageId(), pagePermission.getActionCreatePermission())
                .switchIfEmpty(Mono.error(
                        new AppsmithException(AppsmithError.ACL_NO_RESOURCE_FOUND, FieldName.PAGE, destinationPageId)))
                .cache();

        return Mono.zip(
                        destinationPageMono,
                        actionCollectionService.findActionCollectionDTObyIdAndViewMode(
                                collectionId, false, actionPermission.getEditPermission()))
                .flatMap(tuple -> {
                    NewPage destinationPage = tuple.getT1();
                    ActionCollectionDTO actionCollectionDTO = tuple.getT2();

                    final Flux<ActionDTO> actionUpdatesFlux = newActionService
                            .findByCollectionIdAndViewMode(
                                    actionCollectionDTO.getId(), false, actionPermission.getEditPermission())
                            .map(newAction -> newActionService.generateActionByViewMode(newAction, false))
                            .flatMap(actionDTO -> {
                                actionDTO.setPageId(destinationPageId);
                                // Update default page ID in actions as per destination page object
                                actionDTO
                                        .getDefaultResources()
                                        .setPageId(destinationPage
                                                .getDefaultResources()
                                                .getPageId());
                                return newActionService
                                        .updateUnpublishedAction(actionDTO.getId(), actionDTO)
                                        .onErrorResume(throwable -> {
                                            log.debug(
                                                    "Failed to update collection name for action {} for collection with id: {}",
                                                    actionDTO.getName(),
                                                    actionDTO.getCollectionId());
                                            log.error(throwable.getMessage());
                                            return Mono.empty();
                                        });
                            });

                    final String oldPageId = actionCollectionDTO.getPageId();
                    actionCollectionDTO.setPageId(destinationPageId);
                    DefaultResources defaultResources = new DefaultResources();
                    defaultResources.setPageId(
                            destinationPage.getDefaultResources().getPageId());
                    actionCollectionDTO.setDefaultResources(defaultResources);
                    actionCollectionDTO.setName(actionCollectionMoveDTO.getName());

                    return actionUpdatesFlux
                            .collectList()
                            .flatMap(actionDTOs -> actionCollectionService.update(collectionId, actionCollectionDTO))
                            .zipWith(Mono.just(oldPageId));
                })
                .flatMap(tuple -> {
                    final ActionCollectionDTO savedCollection = tuple.getT1();
                    final String oldPageId = tuple.getT2();

                    return newPageService
                            .findPageById(oldPageId, pagePermission.getEditPermission(), false)
                            .flatMap(page -> {
                                if (page.getLayouts() == null) {
                                    return Mono.empty();
                                }

                                // 2. Run updateLayout on the old page
                                return Flux.fromIterable(page.getLayouts())
                                        .flatMap(layout -> {
                                            layout.setDsl(updateLayoutService.unescapeMongoSpecialCharacters(layout));
                                            return updateLayoutService.updateLayout(
                                                    page.getId(), page.getApplicationId(), layout.getId(), layout);
                                        })
                                        .collect(toSet());
                            })
                            // fetch the unpublished destination page
                            .then(newPageService.findPageById(
                                    actionCollectionMoveDTO.getDestinationPageId(),
                                    pagePermission.getActionCreatePermission(),
                                    false))
                            .flatMap(page -> {
                                if (page.getLayouts() == null) {
                                    return Mono.empty();
                                }

                                // 3. Run updateLayout on the new page.
                                return Flux.fromIterable(page.getLayouts())
                                        .flatMap(layout -> {
                                            layout.setDsl(updateLayoutService.unescapeMongoSpecialCharacters(layout));
                                            return updateLayoutService.updateLayout(
                                                    page.getId(), page.getApplicationId(), layout.getId(), layout);
                                        })
                                        .collect(toSet());
                            })
                            // 4. Return the saved action.
                            .thenReturn(savedCollection);
                });
    }

    @Override
    public Mono<ActionCollectionDTO> moveCollection(
            ActionCollectionMoveDTO actionCollectionMoveDTO, String branchName) {

        Mono<String> destinationPageMono = newPageService
                .findByBranchNameAndDefaultPageId(
                        branchName,
                        actionCollectionMoveDTO.getDestinationPageId(),
                        pagePermission.getActionCreatePermission())
                .map(NewPage::getId);

        Mono<String> branchedCollectionMono = actionCollectionService
                .findByBranchNameAndDefaultCollectionId(
                        branchName, actionCollectionMoveDTO.getCollectionId(), actionPermission.getEditPermission())
                .map(ActionCollection::getId);

        return Mono.zip(destinationPageMono, branchedCollectionMono)
                .flatMap(tuple -> {
                    String destinationPageId = tuple.getT1();
                    String branchedCollectionId = tuple.getT2();
                    actionCollectionMoveDTO.setDestinationPageId(destinationPageId);
                    actionCollectionMoveDTO.setCollectionId(branchedCollectionId);
                    return this.moveCollection(actionCollectionMoveDTO);
                })
                .map(responseUtils::updateCollectionDTOWithDefaultResources);
    }

    @Override
    public Mono<Integer> updateUnpublishedActionCollectionBody(
            String id, ActionCollectionDTO actionCollectionDTO, String branchName) {

        if (id == null) {
            return Mono.error(new AppsmithException(AppsmithError.INVALID_PARAMETER, FieldName.ID));
        }

        if (actionCollectionDTO == null) {
            return Mono.error(new AppsmithException(AppsmithError.INVALID_PARAMETER, FieldName.ACTION_COLLECTION));
        }

        if (actionCollectionDTO.getBody() == null) {
            return Mono.error(new AppsmithException(AppsmithError.INVALID_PARAMETER, FieldName.BODY));
        }

        Mono<ActionCollection> branchedActionCollectionMono = actionCollectionService
                .findByBranchNameAndDefaultCollectionId(branchName, id, actionPermission.getEditPermission())
                .cache();

        return branchedActionCollectionMono.flatMap(dbActionCollection -> {
            BridgeUpdate updateObj = Bridge.update();
            String path = ActionCollection.Fields.unpublishedCollection + "." + ActionCollectionDTO.Fields.body;

            updateObj.set(path, actionCollectionDTO.getBody());

            return actionCollectionRepository.updateByIdWithoutPermissionCheck(dbActionCollection.getId(), updateObj);
        });
    }

    @Override
    public Mono<ActionCollectionDTO> updateUnpublishedActionCollection(
            String id, ActionCollectionDTO actionCollectionDTO, String branchName) {
        // new actions without ids are to be created
        // new actions with ids are to be updated and added to collection
        // old actions that are now missing are to be archived
        // rest are to be updated
        if (id == null) {
            return Mono.error(new AppsmithException(AppsmithError.INVALID_PARAMETER, FieldName.ID));
        }

        Mono<ActionCollection> branchedActionCollectionMono = actionCollectionService
                .findByBranchNameAndDefaultCollectionId(branchName, id, actionPermission.getEditPermission())
                .cache();

        // It is expected that client will be aware of defaultActionIds and not the branched (actual) action ID
        final Set<String> validDefaultActionIds = actionCollectionDTO.getActions().stream()
                .map(ActionDTO::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toUnmodifiableSet());
        final Set<String> defaultActionIds = new HashSet<>();
        defaultActionIds.addAll(validDefaultActionIds);

        final Mono<Map<String, String>> newValidActionIdsMono = branchedActionCollectionMono.flatMap(
                branchedActionCollection -> Flux.fromIterable(actionCollectionDTO.getActions())
                        .flatMap(actionDTO -> {
                            actionDTO.setDeletedAt(null);
                            setContextId(branchedActionCollection, actionDTO);
                            actionDTO.setContextType(actionCollectionDTO.getContextType());
                            actionDTO.setApplicationId(branchedActionCollection.getApplicationId());
                            if (actionDTO.getId() == null) {
                                actionDTO.setCollectionId(branchedActionCollection.getId());
                                if (actionDTO.getDatasource() == null) {
                                    actionDTO.autoGenerateDatasource();
                                }
                                actionDTO.getDatasource().setWorkspaceId(actionCollectionDTO.getWorkspaceId());
                                actionDTO.getDatasource().setPluginId(actionCollectionDTO.getPluginId());
                                actionDTO.getDatasource().setName(FieldName.UNUSED_DATASOURCE);
                                actionDTO.setFullyQualifiedName(
                                        actionCollectionDTO.getName() + "." + actionDTO.getName());
                                actionDTO.setPluginType(actionCollectionDTO.getPluginType());
                                actionDTO.setPluginId(actionCollectionDTO.getPluginId());
                                actionDTO.setDefaultResources(branchedActionCollection.getDefaultResources());
                                actionDTO.getDefaultResources().setBranchName(branchName);
                                final String defaultPageId = branchedActionCollection
                                        .getUnpublishedCollection()
                                        .getDefaultResources()
                                        .getPageId();
                                actionDTO.getDefaultResources().setPageId(defaultPageId);
                                // actionCollectionService is a new action, we need to create one
                                return layoutActionService.createSingleAction(actionDTO, Boolean.TRUE);
                            } else {
                                actionDTO.setCollectionId(null);
                                // Client only knows about the default action ID, fetch branched action id to update the
                                // action
                                String defaultActionId = actionDTO.getId();
                                actionDTO.setId(null);
                                return layoutActionService.updateSingleActionWithBranchName(
                                        defaultActionId, actionDTO, branchName);
                            }
                        })
                        .collect(toMap(
                                actionDTO -> actionDTO.getDefaultResources().getActionId(), ActionDTO::getId)));

        // First collect all valid action ids from before, and diff against incoming action ids
        Mono<List<ActionDTO>> deleteNonExistingActionMono = newActionService
                .findByCollectionIdAndViewMode(actionCollectionDTO.getId(), false, actionPermission.getEditPermission())
                .filter(newAction -> !defaultActionIds.contains(
                        newAction.getDefaultResources().getActionId()))
                .flatMap(x -> newActionService
                        .deleteGivenNewAction(x)
                        // return an empty action so that the filter can remove it from the list
                        .onErrorResume(throwable -> {
                            log.debug(
                                    "Failed to delete action with id {}, branch {} for collection: {}",
                                    x.getDefaultResources().getActionId(),
                                    branchName,
                                    actionCollectionDTO.getName());
                            log.error(throwable.getMessage());
                            return Mono.empty();
                        }))
                .collectList();

        return deleteNonExistingActionMono
                .then(newValidActionIdsMono)
                .flatMap(tuple -> {
                    return branchedActionCollectionMono.map(dbActionCollection -> {
                        actionCollectionDTO.setId(null);
                        resetContextId(actionCollectionDTO);
                        // Since we have a different endpoint to update the body, we need to remove it from the DTO
                        actionCollectionDTO.setBody(null);

                        copyNewFieldValuesIntoOldObject(
                                actionCollectionDTO, dbActionCollection.getUnpublishedCollection());

                        return dbActionCollection;
                    });
                })
                .flatMap(actionCollection -> actionCollectionService.update(actionCollection.getId(), actionCollection))
                .zipWith(ReactiveContextUtils.getCurrentUser())
                .flatMap(tuple -> actionCollectionRepository.setUserPermissionsInObject(tuple.getT1(), tuple.getT2()))
                .flatMap(savedActionCollection ->
                        updateLayoutBasedOnContext(savedActionCollection).thenReturn(savedActionCollection))
                .flatMap(savedActionCollection -> analyticsService.sendUpdateEvent(
                        savedActionCollection, actionCollectionService.getAnalyticsProperties(savedActionCollection)))
                .flatMap(actionCollection -> actionCollectionService
                        .generateActionCollectionByViewMode(actionCollection, false)
                        .flatMap(actionCollectionDTO1 -> actionCollectionService
                                .populateActionCollectionByViewMode(actionCollection.getUnpublishedCollection(), false)
                                .flatMap(actionCollectionDTO2 -> actionCollectionService
                                        .saveLastEditInformationInParent(actionCollectionDTO2)
                                        .thenReturn(actionCollectionDTO2))))
                .flatMap(branchedActionCollection -> sendErrorReportsFromPageToCollection(branchedActionCollection))
                .map(responseUtils::updateCollectionDTOWithDefaultResources);
    }

    private Mono<ActionCollectionDTO> sendErrorReportsFromPageToCollection(
            ActionCollectionDTO branchedActionCollection) {
        if (isPageContext(branchedActionCollection.getContextType())) {
            final String pageId = branchedActionCollection.getPageId();
            return newPageService
                    .findById(pageId, pagePermission.getEditPermission())
                    .flatMap(newPage -> {
                        // Your conditional check
                        if (newPage.getUnpublishedPage().getLayouts().size() > 0) {
                            // redundant check as the collection lies inside a layout. Maybe required for
                            // testcases
                            branchedActionCollection.setErrorReports(newPage.getUnpublishedPage()
                                    .getLayouts()
                                    .get(0)
                                    .getLayoutOnLoadActionErrors());

                            // Continue processing or return a different observable if needed
                            return Mono.just(branchedActionCollection);
                        } else {
                            // Return the original branchedActionCollection
                            return Mono.just(branchedActionCollection);
                        }
                    })
                    .map(updatedBranchedActionCollection -> {
                        // Additional mapping or processing if needed
                        return updatedBranchedActionCollection;
                    });
        } else {
            // Handle the case where contextType is not PAGE
            // You might want to return the original branchedActionCollection or handle it as needed
            return Mono.just(branchedActionCollection);
        }
    }

    protected Mono<String> updateLayoutBasedOnContext(ActionCollection savedActionCollection) {
        if (isPageContext(savedActionCollection.getUnpublishedCollection().getContextType())) {
            return updateLayoutService.updatePageLayoutsByPageId(
                    savedActionCollection.getUnpublishedCollection().getPageId());
        }
        return Mono.empty();
    }

    protected void resetContextId(ActionCollectionDTO actionCollectionDTO) {
        if (isPageContext(actionCollectionDTO.getContextType())) {
            actionCollectionDTO.setPageId(null);
        }
    }

    protected void setContextId(ActionCollection branchedActionCollection, ActionDTO actionDTO) {
        if (isPageContext(branchedActionCollection.getUnpublishedCollection().getContextType())) {
            actionDTO.setPageId(
                    branchedActionCollection.getUnpublishedCollection().getPageId());
        }
    }
}
