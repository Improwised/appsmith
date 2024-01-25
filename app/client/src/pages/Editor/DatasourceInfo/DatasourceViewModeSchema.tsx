import {
  DATASOURCE_GENERATE_PAGE_BUTTON,
  createMessage,
} from "@appsmith/constants/messages";
import { FEATURE_FLAG } from "@appsmith/entities/FeatureFlag";
import { useEditorType } from "@appsmith/hooks";
import type { ExplorerURLParams } from "@appsmith/pages/Editor/Explorer/helpers";
import type { AppState } from "@appsmith/reducers";
import { getCurrentApplication } from "@appsmith/selectors/applicationSelectors";
import {
  getDatasourceStructureById,
  getIsFetchingDatasourceStructure,
  getNumberOfEntitiesInCurrentPage,
  getSelectedTableName,
} from "@appsmith/selectors/entitiesSelector";
import {
  getHasCreatePagePermission,
  hasCreateDSActionPermissionInApp,
} from "@appsmith/utils/BusinessFeatures/permissionPageHelpers";
import { setDatasourcePreviewSelectedTableName } from "actions/datasourceActions";
import { generateTemplateToUpdatePage } from "actions/pageActions";
import { generateBuildingBlockFromData } from "actions/templateActions";
import { Button } from "design-system";
import type {
  Datasource,
  DatasourceTable,
  QueryTemplate,
} from "entities/Datasource";
import { DatasourceStructureContext } from "entities/Datasource";
import Table from "pages/Editor/QueryEditor/Table";
import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams } from "react-router";
import {
  getCurrentApplicationId,
  getPagePermissions,
} from "selectors/editorSelectors";
import { getIsGeneratingTemplatePage } from "selectors/pageListSelectors";
import AnalyticsUtil from "utils/AnalyticsUtil";
import history from "utils/history";
import { useFeatureFlag } from "utils/hooks/useFeatureFlag";
import { useDatasourceQuery } from "../DataSourceEditor/hooks";
import { GENERATE_PAGE_MODE } from "../GeneratePage/components/GeneratePageForm/GeneratePageForm";
import { DatasourceStructureContainer as DatasourceStructureList } from "./DatasourceStructureContainer";
import DatasourceStructureHeader from "./DatasourceStructureHeader";
import RenderInterimDataState from "./RenderInterimDataState";
import {
  ButtonContainer,
  DataWrapperContainer,
  DatasourceDataContainer,
  DatasourceListContainer,
  StructureContainer,
  TableWrapper,
  ViewModeSchemaContainer,
} from "./SchemaViewModeCSS";

interface Props {
  datasource: Datasource;
  setDatasourceViewModeFlag: (viewMode: boolean) => void;
}

const DatasourceViewModeSchema = (props: Props) => {
  const dispatch = useDispatch();

  const datasourceStructure = useSelector((state) =>
    getDatasourceStructureById(state, props.datasource.id),
  );

  const isDatasourceStructureLoading = useSelector((state: AppState) =>
    getIsFetchingDatasourceStructure(state, props.datasource.id),
  );

  const pagePermissions = useSelector(getPagePermissions);
  const datasourcePermissions = props.datasource?.userPermissions || [];

  const userAppPermissions = useSelector(
    (state: AppState) => getCurrentApplication(state)?.userPermissions ?? [],
  );

  const isFeatureEnabled = useFeatureFlag(FEATURE_FLAG.license_gac_enabled);

  const editorType = useEditorType(history.location.pathname);

  const canCreatePages = getHasCreatePagePermission(
    isFeatureEnabled,
    userAppPermissions,
  );

  const canCreateDatasourceActions = hasCreateDSActionPermissionInApp({
    isEnabled: isFeatureEnabled,
    dsPermissions: datasourcePermissions,
    pagePermissions,
    editorType,
  });

  const applicationId: string = useSelector(getCurrentApplicationId);
  const { pageId: currentPageId } = useParams<ExplorerURLParams>();

  const [previewData, setPreviewData] = useState([]);
  // this error is for when there's an issue with the datasource structure
  const [previewDataError, setPreviewDataError] = useState(false);

  const numberOfEntities = useSelector(getNumberOfEntitiesInCurrentPage);
  const currentMode = useRef(
    numberOfEntities > 0
      ? GENERATE_PAGE_MODE.NEW
      : GENERATE_PAGE_MODE.REPLACE_EMPTY,
  );

  const tableName: string = useSelector(getSelectedTableName);

  const { failedFetchingPreviewData, fetchPreviewData, isLoading } =
    useDatasourceQuery({ setPreviewData, setPreviewDataError });

  const isGeneratePageLoading = useSelector(getIsGeneratingTemplatePage);

  // default table name to first table
  useEffect(() => {
    if (
      datasourceStructure &&
      !!datasourceStructure.tables &&
      datasourceStructure.tables?.length > 0
    ) {
      dispatch(
        setDatasourcePreviewSelectedTableName(
          datasourceStructure.tables[0].name,
        ),
      );
    }

    // if the datasource structure is loading or undefined or if there's an error in the structure
    // reset the preview data states
    if (
      isDatasourceStructureLoading ||
      !datasourceStructure ||
      !datasourceStructure.tables ||
      (datasourceStructure && datasourceStructure?.error)
    ) {
      setPreviewData([]);
      setPreviewDataError(true);
      dispatch(setDatasourcePreviewSelectedTableName(""));
    }
  }, [datasourceStructure, isDatasourceStructureLoading]);

  // this fetches the preview data when the table name changes
  useEffect(() => {
    if (
      !isDatasourceStructureLoading &&
      tableName &&
      datasourceStructure &&
      datasourceStructure.tables
    ) {
      const templates: QueryTemplate[] | undefined =
        datasourceStructure.tables.find(
          (structure: DatasourceTable) => structure.name === tableName,
        )?.templates;

      if (templates) {
        let suggestedTemPlate: QueryTemplate | undefined = templates?.find(
          (template) => template.suggested,
        );

        // if no suggested template exists, default to first template.
        if (!suggestedTemPlate) {
          suggestedTemPlate = templates[0];
        }

        fetchPreviewData({
          datasourceId: props.datasource.id,
          template: suggestedTemPlate,
        });
      }
    }
  }, [tableName, isDatasourceStructureLoading]);

  useEffect(() => {
    if (previewData && previewData.length > 0) {
      AnalyticsUtil.logEvent("DATASOURCE_PREVIEW_DATA_SHOWN", {
        datasourceId: props.datasource.id,
        pluginId: props.datasource.pluginId,
      });
    }
  }, [previewData]);

  useEffect(() => {
    setPreviewData([]);
  }, [props.datasource.id]);

  const onEntityTableClick = (table: string) => {
    AnalyticsUtil.logEvent("DATASOURCE_PREVIEW_TABLE_CHANGE", {
      datasourceId: props.datasource.id,
      pluginId: props.datasource.pluginId,
    });
    // This sets table name in redux state to be used to create appropriate query
    dispatch(setDatasourcePreviewSelectedTableName(table));
  };

  const generatePageAction = () => {
    if (
      datasourceStructure &&
      datasourceStructure?.tables &&
      datasourceStructure?.tables?.length > 0
    ) {
      const payload = {
        applicationId: applicationId || "",
        pageId:
          currentMode.current === GENERATE_PAGE_MODE.NEW
            ? ""
            : currentPageId || "",
        columns: [],
        searchColumn: "",
        tableName: tableName,
        datasourceId: props.datasource.id || "",
      };

      AnalyticsUtil.logEvent("DATASOURCE_GENERATE_PAGE_BUTTON_CLICKED", {
        datasourceId: props.datasource.id,
        pluginId: props.datasource.pluginId,
      });

      dispatch(generateTemplateToUpdatePage(payload));
    }
  };

  const generateRecordEditBlockAction = () => {
    if (
      datasourceStructure &&
      datasourceStructure?.tables &&
      datasourceStructure?.tables?.length > 0
    ) {
      // console.log(
      //   "🚀 ~ generateRecordEditBlockAction ~ datasource:",
      //   datasourceStructure.tables.filter((table) => table.name === tableName),
      // );

      dispatch(generateBuildingBlockFromData(props.datasource.id));
    }
  };

  // custom edit datasource function
  const customEditDatasourceFn = () => {
    props.setDatasourceViewModeFlag(false);
  };

  // only show generate button if schema is not being fetched, if the preview data is not being fetched
  // if there was a failure in the fetching of the data
  // if tableName from schema is availble
  // if the user has permissions
  const showGeneratePageBtn =
    !isDatasourceStructureLoading &&
    !isLoading &&
    !failedFetchingPreviewData &&
    tableName &&
    canCreateDatasourceActions &&
    canCreatePages;

  return (
    <ViewModeSchemaContainer>
      <DataWrapperContainer data-testId="datasource-schema-container">
        <StructureContainer>
          {props.datasource && (
            <DatasourceStructureHeader
              datasource={props.datasource}
              paddingBottom
            />
          )}
          <DatasourceListContainer>
            <DatasourceStructureList
              context={DatasourceStructureContext.DATASOURCE_VIEW_MODE}
              customEditDatasourceFn={customEditDatasourceFn}
              datasourceId={props.datasource.id}
              datasourceStructure={datasourceStructure}
              onEntityTableClick={onEntityTableClick}
              step={0}
              tableName={tableName}
            />
          </DatasourceListContainer>
        </StructureContainer>
        <DatasourceDataContainer>
          <TableWrapper>
            {(isLoading || isDatasourceStructureLoading) && (
              <RenderInterimDataState state="LOADING" />
            )}
            {(!isLoading || !isDatasourceStructureLoading) &&
              (failedFetchingPreviewData || previewDataError) && (
                <RenderInterimDataState state="FAILED" />
              )}
            {!isLoading &&
              !isDatasourceStructureLoading &&
              !failedFetchingPreviewData &&
              !previewDataError &&
              previewData?.length > 0 && (
                <Table data={previewData} shouldResize={false} />
              )}
            {!isLoading &&
              !isDatasourceStructureLoading &&
              !failedFetchingPreviewData &&
              !previewDataError &&
              !previewData?.length && <RenderInterimDataState state="NODATA" />}
          </TableWrapper>
        </DatasourceDataContainer>
      </DataWrapperContainer>
      {showGeneratePageBtn && (
        <ButtonContainer>
          <Button
            className="t--datasource-generate-page"
            isLoading={isGeneratePageLoading}
            key="datasource-generate-page"
            kind="primary"
            onClick={generatePageAction}
            size="md"
          >
            {createMessage(DATASOURCE_GENERATE_PAGE_BUTTON)}
          </Button>

          <Button
            className="t--datasource-generate-page"
            isLoading={isGeneratePageLoading}
            key="datasource-generate-page"
            kind="secondary"
            onClick={generateRecordEditBlockAction}
            size="md"
            style={{ marginLeft: "10px" }}
          >
            Generate Record Edit Block
          </Button>
        </ButtonContainer>
      )}
    </ViewModeSchemaContainer>
  );
};

export default DatasourceViewModeSchema;
