import { ReduxActionTypes } from "@appsmith/constants/ReduxActionConstants";

import type {
  Columns,
  ColumnMeta,
} from "reducers/uiReducers/querySchemaReducer";

export const initQuerySchema = (payload: { id: string; columns: Columns }) => {
  return {
    type: ReduxActionTypes.SET_QUERY_SCHEMA_COLUMNS,
    payload,
  };
};

export const updateQuerySchemaColumn = (payload: {
  id: string;
  columnName: string;
  column: Partial<ColumnMeta>;
}) => {
  return {
    type: ReduxActionTypes.UPDATE_QUERY_SCHEMA_COLUMN,
    payload,
  };
};

export const updateQuerySchemaColumnsBinding = (payload: {
  widgetName: string;
  actionId: string;
}) => {
  return {
    type: ReduxActionTypes.UPDATE_QUERY_SCHEMA_COLUMNS_BINDING,
    payload,
  };
};
