import { ReduxActionTypes } from "@appsmith/constants/ReduxActionConstants";
import urlBuilder from "@appsmith/entities/URLRedirect/URLAssembly";
import type { CreateApiActionDefaultsParams } from "entities/Action";
import type { Saga } from "redux-saga";
import { runSaga, stdChannel } from "redux-saga";
import {
  createDefaultApiActionPayload,
  handleDatasourceCreatedSaga,
} from "sagas/ApiPaneSagas";
import { testStore } from "store";
import MockPluginsState, { PluginIDs } from "test/factories/MockPluginsState";
import history from "utils/history";

describe("tests the sagas in ApiPaneSagas", () => {
  const inputPayload: CreateApiActionDefaultsParams = {
    apiType: "graphql-plugin",
    newActionName: "newName",
  };

  it("1. Bug 27941: Tests createDefaultApiActionPayload to return prepopulated empty array for autoGeneratedHeaders", function () {
    const outputPayloadGenerator: Generator =
      createDefaultApiActionPayload(inputPayload);

    // Mocking getCurrentWorkspaceId selector
    const workspaceIdSelectorEffect = outputPayloadGenerator.next().value;
    workspaceIdSelectorEffect.payload.selector = jest.fn();
    workspaceIdSelectorEffect.payload.selector.mockReturnValue(
      "testWorkspaceId",
    );

    // Mock getPluginIdOfPackageName selector
    const pluginIdSelectorEffect = outputPayloadGenerator.next().value;
    pluginIdSelectorEffect.payload.selector = jest.fn();
    pluginIdSelectorEffect.payload.selector.mockReturnValue("pluginId");

    // Get actionconfig value now
    const outputPayload = outputPayloadGenerator.next().value;
    expect(outputPayload?.actionConfiguration.autoGeneratedHeaders).toEqual([]);
  });

  it("2. Bug 27941: Tests createDefaultApiActionPayload to return prepopulated empty array for autoGeneratedHeaders", function () {
    inputPayload.apiType = "restapi-plugin";
    const outputPayloadGenerator: Generator =
      createDefaultApiActionPayload(inputPayload);

    // Mocking getCurrentWorkspaceId selector
    const workspaceIdSelectorEffect = outputPayloadGenerator.next().value;
    workspaceIdSelectorEffect.payload.selector = jest.fn();
    workspaceIdSelectorEffect.payload.selector.mockReturnValue(
      "testWorkspaceId",
    );

    // Mock getPluginIdOfPackageName selector
    const pluginIdSelectorEffect = outputPayloadGenerator.next().value;
    pluginIdSelectorEffect.payload.selector = jest.fn();
    pluginIdSelectorEffect.payload.selector.mockReturnValue("pluginId");

    // Get actionconfig value now
    const outputPayload = outputPayloadGenerator.next().value;
    expect(outputPayload?.actionConfiguration.autoGeneratedHeaders).toEqual([]);
  });
});

describe("handleDatasourceCreatedSaga", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("should pass parentEntityId to apiEditorIdURL and redirect to correct url when in app", async () => {
    const applicationId = "app-id";
    const pageId = "669e868199b66f0d2176fc1d";
    const store = testStore({
      entities: {
        ...({} as any),
        plugins: MockPluginsState,
      },
      ui: {
        ...({} as any),
        datasourcePane: {
          actionRouteInfo: {
            apiId: "api-id",
            applicationId,
            datasourceId: "ds-id",
            parentEntityId: pageId,
          },
        },
      },
    });

    const dispatched: any[] = [];
    const spy = jest.spyOn(history, "push").mockImplementation(jest.fn());
    const channel = stdChannel();
    const appParams = {
      applicationId,
      applicationSlug: "app-slug",
      ApplicationVersion: "1",
    };

    const pageParams = [
      {
        pageId,
        pageSlug: "page-slug",
      },
    ];

    urlBuilder.updateURLParams(appParams, pageParams);

    runSaga(
      {
        dispatch: (action: any) => {
          dispatched.push(action);
          channel.put(action);
        },
        getState: () => store.getState(),
        channel,
      },
      handleDatasourceCreatedSaga as Saga,
      {
        redirect: true,
        payload: {
          pluginId: PluginIDs["restapi-plugin"],
        },
      },
    ).toPromise();

    // Simulate the dispatch of UPDATE_ACTION_SUCCESS action with delay
    setTimeout(() => {
      channel.put({ type: ReduxActionTypes.UPDATE_ACTION_SUCCESS });
    }, 2000);

    // Wait for saga to process the action
    await new Promise((resolve) => setTimeout(resolve, 3000));

    expect(history.push).toHaveBeenCalledWith(
      `/app/app-slug/page-slug-${pageId}/edit/api/api-id`,
    );

    spy.mockReset();
  });
});
