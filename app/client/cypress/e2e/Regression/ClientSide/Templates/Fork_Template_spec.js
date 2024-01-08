const commonlocators = require("../../../../locators/commonlocators.json");
const templateLocators = require("../../../../locators/TemplatesLocators.json");
import reconnectDatasourceLocators from "../../../../locators/ReconnectLocators.js";
import * as _ from "../../../../support/Objects/ObjectsCore";
import { featureFlagIntercept } from "../../../../support/Objects/FeatureFlags";

describe(
  "Fork a template to an workspace",
  { tags: ["@tag.excludeForAirgap", "@tag.Templates"] },
  () => {
    beforeEach(() => {
      featureFlagIntercept({ ab_create_new_apps_enabled: true });
      cy.generateUUID().then((uid) => {
        cy.Signup(`${uid}@appsmith.com`, uid);
      });
      _.agHelper.GetNClick(templateLocators.startFromTemplateOnboardingCard);
    });

    it("1. Fork a template to an workspace", () => {
      _.agHelper.GetNClick(templateLocators.templateCard);
      _.agHelper.GetNClick(templateLocators.templateViewForkButton);
      _.agHelper.WaitUntilEleAppear(commonlocators.canvas);
    });

    it("2. Update query param on opening fork modal in template detailed view", () => {
      cy.get(templateLocators.templateCard).first().click();
      _.agHelper.CheckForErrorToast("INTERNAL_SERVER_ERROR");
      _.agHelper.GetNClick(templateLocators.templateViewForkButton);
      _.agHelper.WaitUntilEleAppear(commonlocators.canvas);
    });
  },
);
