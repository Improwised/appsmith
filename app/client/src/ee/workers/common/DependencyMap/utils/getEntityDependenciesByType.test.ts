import { getModuleInputsDependencies } from "@appsmith/workers/common/DependencyMap/utils/getEntityDependenciesByType";
import {
  ENTITY_TYPE_VALUE,
  EvaluationSubstitutionType,
} from "entities/DataTree/dataTreeFactory";

describe("get dependencies for module inputs", () => {
  it("getModuleInputsDependencies", () => {
    const entity = {
      ENTITY_TYPE: ENTITY_TYPE_VALUE.MODULE_INPUT,
      username: "{{appsmith.user.name}}",
      email: "{{appsmith.user.email}}",
    };

    const entityConfig = {
      name: "inputs",
      ENTITY_TYPE: ENTITY_TYPE_VALUE.MODULE_INPUT,
      bindingPaths: {
        username: EvaluationSubstitutionType.TEMPLATE,
        email: EvaluationSubstitutionType.TEMPLATE,
      },
      reactivePaths: {
        username: EvaluationSubstitutionType.TEMPLATE,
        email: EvaluationSubstitutionType.TEMPLATE,
      },
      dynamicBindingPathList: [{ key: "username" }, { key: "email" }],
    };
    const resultData = {
      "inputs.username": ["appsmith.user.name"],
      "inputs.email": ["appsmith.user.email"],
    };

    const dependencies = getModuleInputsDependencies(entity, entityConfig);
    expect(resultData).toStrictEqual(dependencies);
  });
});
