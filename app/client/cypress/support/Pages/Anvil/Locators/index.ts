import { MAIN_CONTAINER_WIDGET_ID } from "../../../../../src/constants/WidgetConstants";
import { getAnvilCanvasId } from "../../../../../src/layoutSystems/anvil/viewer/canvas/utils";
import { AnvilDataAttributes } from "../../../../../src/widgets/anvil/constants";

// anvil widget based selectors
const anvilWidgetSelector = "[data-testid=t--anvil-widget-wrapper]";
const anvilWidgetBasedSelectors = {
  anvilWidgetSelector,
  anvilWidgetNameSelector: (widgetName: string) => {
    return `[${AnvilDataAttributes.WIDGET_NAME}="${widgetName}"]`;
  },
  anvilModalWidgetNameSelector: (widgetName: string) => {
    return `.t--widget-${widgetName.toLowerCase()}`;
  },
  anvilModalCloseIconButtonSelector: (widgetName: string) => {
    return `.t--widget-${widgetName.toLowerCase()} > div > button[data-icon-button]`;
  },
  anvilModalFooterCloseButtonSelector: (widgetName: string) => {
    return `.t--widget-${widgetName.toLowerCase()} > div:last-child > button[data-button]:first-child`;
  },
  anvilModalFooterSubmitButtonSelector: (widgetName: string) => {
    return `.t--widget-${widgetName.toLowerCase()} > div:last-child > button[data-button]:last-child`;
  },
  anvilModalOverlay: 'div[data-floating-ui-portal] > div[data-status="open"]',
  anvilSelectedWidget: `${anvilWidgetSelector}[data-selected=true]`,
  anvilWidgetTypeSelector: (widgetType: string) => {
    return `.t--widget-${widgetType}`;
  },
};

// sections and zones based selectors
const anvilSectionAndZonesBasedSelectors = {
  anvilZoneDistributionValue: "[data-testid=t--anvil-zone-distribution-value]",
  anvilSectionDistributionHandle: "[data-testid=t--anvil-distribution-handle]",
  anvilZoneStepperControlInputValue:
    ".t--property-control-zones .ads-v2-input__input-section-input",
  anvilZoneStepperControlSelector: (type: "add" | "remove") =>
    ".t--property-control-zones .ads-v2-input__input-section-icon-" +
    (type === "add" ? "end" : "start"),
};

// dnd based selectors
const anvilDnDBasedSelectors = {
  anvilDnDListener: "[data-type=anvil-dnd-listener]",
  anvilDetachedWidgetsDropArena:
    "[data-testid=t--anvil-detached-widgets-drop-arena]",
  mainCanvasSelector: `#${getAnvilCanvasId(MAIN_CONTAINER_WIDGET_ID)}`,
};

// wds and layout based widgets
const anvilWidgetsLocators = {
  WDSBUTTON: "wdsbuttonwidget",
  WDSTABLE: "wdstablewidget",
  WDSINPUT: "wdsinputwidget",
  WDSSWITCH: "wdsswitchwidget",
  WDSCHECKBOX: "wdscheckboxwidget",
  WDSMODAL: "wdsmodalwidget",
  SECTION: "sectionwidget",
  ZONE: "zonewidget",
};

export const anvilLocators = {
  ...anvilWidgetBasedSelectors,
  ...anvilWidgetsLocators,
  ...anvilSectionAndZonesBasedSelectors,
  ...anvilDnDBasedSelectors,
};
