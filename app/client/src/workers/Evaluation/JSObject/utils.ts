import {
  DataTree,
  DataTreeAppsmith,
  DataTreeJSAction,
  EvaluationSubstitutionType,
} from "entities/DataTree/dataTreeFactory";
import { ParsedBody, ParsedJSSubAction } from "utils/JSPaneUtils";
import { unset, set, get } from "lodash";
import { BatchedJSExecutionData } from "reducers/entityReducers/jsActionsReducer";
import { select } from "redux-saga/effects";
import { AppState } from "@appsmith/reducers";
import { JSAction } from "entities/JSCollection";
import { getJSFunctionFromName } from "selectors/entitiesSelector";
import { isJSAction } from "@appsmith/workers/Evaluation/evaluationUtils";
import { APP_MODE } from "entities/App";

/**
 * here we add/remove the properties (variables and actions) which got added/removed from the JSObject parsedBody.
  NOTE: For other entity below logic is maintained in DataTreeFactory, for JSObject we handle it inside evaluations
 * 
 * @param parsedBody 
 * @param jsCollection 
 * @param unEvalTree 
 * @returns 
 */
export const updateJSCollectionInUnEvalTree = (
  parsedBody: ParsedBody,
  jsCollection: DataTreeJSAction,
  unEvalTree: DataTree,
  configTree: any,
  entityName: string,
) => {
  // jsCollection here means unEvalTree JSObject
  const modifiedUnEvalTree = unEvalTree;
  const functionsList: Array<string> = [];
  const varList: Array<string> = configTree[entityName]?.variables;
  Object.keys(configTree[entityName]?.meta).forEach((action) => {
    functionsList.push(action);
  });

  // const oldConfig = Object.getPrototypeOf(jsCollection) as DataTreeJSAction;
  const oldConfig = configTree[entityName];

  if (parsedBody.actions && parsedBody.actions.length > 0) {
    for (let i = 0; i < parsedBody.actions.length; i++) {
      const action = parsedBody.actions[i];
      if (jsCollection.hasOwnProperty(action.name)) {
        if (jsCollection[action.name] !== action.body) {
          const data = get(
            modifiedUnEvalTree,
            `${entityName}.${action.name}.data`,
            {},
          );
          set(
            modifiedUnEvalTree,
            `${entityName}.${action.name}`,
            new String(action.body),
          );

          set(modifiedUnEvalTree, `${entityName}.${action.name}.data`, data);
        }
      } else {
        const reactivePaths = oldConfig.reactivePaths;

        reactivePaths[action.name] =
          EvaluationSubstitutionType.SMART_SUBSTITUTE;
        reactivePaths[`${action.name}.data`] =
          EvaluationSubstitutionType.TEMPLATE;

        const dynamicBindingPathList = oldConfig.dynamicBindingPathList;
        dynamicBindingPathList.push({ key: action.name });

        const dependencyMap = oldConfig.dependencyMap;
        dependencyMap["body"].push(action.name);

        const meta = oldConfig.meta;
        meta[action.name] = {
          arguments: action.arguments,
          isAsync: false,
          confirmBeforeExecute: false,
        };

        const data = get(
          modifiedUnEvalTree,
          `${entityName}.${action.name}.data`,
          {},
        );
        set(
          modifiedUnEvalTree,
          `${entityName}.${action.name}`,
          new String(action.body.toString()),
        );
        set(modifiedUnEvalTree, `${entityName}.${action.name}.data`, data);
      }
    }
  }
  if (functionsList && functionsList.length > 0) {
    for (let i = 0; i < functionsList.length; i++) {
      const oldActionName = functionsList[i];
      const existed = parsedBody.actions.find(
        (js: ParsedJSSubAction) => js.name === oldActionName,
      );
      if (!existed) {
        const reactivePaths = oldConfig.reactivePaths;
        delete reactivePaths[oldActionName];

        oldConfig.dynamicBindingPathList = oldConfig.dynamicBindingPathList.filter(
          (path: any) => path["key"] !== oldActionName,
        );

        const dependencyMap = oldConfig.dependencyMap["body"];
        const removeIndex = dependencyMap.indexOf(oldActionName);
        if (removeIndex > -1) {
          oldConfig.dependencyMap["body"] = dependencyMap.filter(
            (item: any) => item !== oldActionName,
          );
        }
        const meta = oldConfig.meta;
        delete meta[oldActionName];

        unset(modifiedUnEvalTree[entityName], oldActionName);
        unset(modifiedUnEvalTree[entityName], `${oldActionName}.data`);
      }
    }
  }
  if (parsedBody.variables.length) {
    for (let i = 0; i < parsedBody.variables.length; i++) {
      const newVar = parsedBody.variables[i];
      const existedVar = varList.indexOf(newVar.name);
      if (existedVar > -1) {
        const existedVarVal = jsCollection[newVar.name];
        if (
          (!!existedVarVal && existedVarVal.toString()) !==
            (newVar.value && newVar.value.toString()) ||
          (!existedVarVal && !!newVar)
        ) {
          set(modifiedUnEvalTree, `${entityName}.${newVar.name}`, newVar.value);
        }
      } else {
        varList.push(newVar.name);
        const reactivePaths = oldConfig.reactivePaths;
        reactivePaths[newVar.name] =
          EvaluationSubstitutionType.SMART_SUBSTITUTE;

        const dynamicBindingPathList = oldConfig.dynamicBindingPathList;
        dynamicBindingPathList.push({ key: newVar.name });

        set(modifiedUnEvalTree, `${entityName}.variables`, varList);
        set(modifiedUnEvalTree, `${entityName}.${newVar.name}`, newVar.value);
      }
    }
    let newVarList: Array<string> = varList;
    for (let i = 0; i < varList.length; i++) {
      const varListItem = varList[i];
      const existsInParsed = parsedBody.variables.find(
        (item) => item.name === varListItem,
      );
      if (!existsInParsed) {
        const reactivePaths = oldConfig.reactivePaths;
        delete reactivePaths[varListItem];

        oldConfig.dynamicBindingPathList = oldConfig.dynamicBindingPathList.filter(
          (path: any) => path["key"] !== varListItem,
        );

        newVarList = newVarList.filter((item) => item !== varListItem);
        unset(modifiedUnEvalTree[entityName], varListItem);
      }
    }
    if (newVarList.length) {
      set(modifiedUnEvalTree, `${entityName}.variables`, newVarList);
    }
  }
  return modifiedUnEvalTree;
};

/**
 * When JSObject parseBody is empty we remove all variables and actions from unEvalTree
 * this will lead to removal of properties from the dataTree
 * @param unEvalTree
 * @param entity
 * @returns
 */
export const removeFunctionsAndVariableJSCollection = (
  unEvalTree: DataTree,
  entity: DataTreeJSAction,
  entityName: string,
  configTree: any,
) => {
  // const oldConfig = Object.getPrototypeOf(entity) as DataTreeJSAction;
  const oldConfig = configTree[entityName];
  const modifiedDataTree: DataTree = unEvalTree;
  const functionsList: Array<string> = [];
  Object.keys(configTree[entityName].meta).forEach((action) => {
    functionsList.push(action);
  });
  //removed variables
  const varList: Array<string> = entity.variables;
  set(modifiedDataTree, `${entityName}.variables`, []);
  for (let i = 0; i < varList.length; i++) {
    const varName = varList[i];
    unset(modifiedDataTree[entityName], varName);
  }
  //remove functions

  const reactivePaths = entity.reactivePaths;
  const meta = entity.meta;

  for (let i = 0; i < functionsList.length; i++) {
    const actionName = functionsList[i];
    delete reactivePaths[actionName];
    delete meta[actionName];
    unset(modifiedDataTree[entityName], actionName);

    oldConfig.dynamicBindingPathList = oldConfig.dynamicBindingPathList.filter(
      (path: any) => path["key"] !== actionName,
    );

    oldConfig.dependencyMap["body"] = entity.dependencyMap["body"].filter(
      (item: any) => item !== actionName,
    );
  }

  return modifiedDataTree;
};

export function isJSObjectFunction(
  dataTree: DataTree,
  jsObjectName: string,
  key: string,
  configTree: any,
) {
  const entity = configTree[jsObjectName];
  if (isJSAction(entity)) {
    return entity.meta.hasOwnProperty(key);
  }
  return false;
}

export function getAppMode(dataTree: DataTree) {
  const appsmithObj = dataTree.appsmith as DataTreeAppsmith;
  return appsmithObj.mode as APP_MODE;
}

export function isPromise(value: any): value is Promise<unknown> {
  return Boolean(value && typeof value.then === "function");
}

export function* sortJSExecutionDataByCollectionId(
  data: Record<string, unknown>,
) {
  // Sorted data by collectionId
  const sortedData: BatchedJSExecutionData = {};
  for (const jsfuncFullName of Object.keys(data)) {
    const jsAction: JSAction | undefined = yield select((state: AppState) =>
      getJSFunctionFromName(state, jsfuncFullName),
    );

    if (jsAction && jsAction.collectionId) {
      if (sortedData[jsAction.collectionId]) {
        sortedData[jsAction.collectionId].push({
          data: get(data, jsfuncFullName),
          collectionId: jsAction.collectionId,
          actionId: jsAction.id,
        });
      } else {
        sortedData[jsAction.collectionId] = [
          {
            data: get(data, jsfuncFullName),
            collectionId: jsAction.collectionId,
            actionId: jsAction.id,
          },
        ];
      }
    }
  }

  return sortedData;
}
