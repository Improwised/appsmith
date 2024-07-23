import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { ZoneContextManager } from "@opentelemetry/context-zone";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { getAppsmithConfigs } from "@appsmith/configs";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import {
  AggregationTemporalityPreference,
  OTLPMetricExporter,
} from "@opentelemetry/exporter-metrics-otlp-http";
import { metrics } from "@opentelemetry/api";

const { newRelic } = getAppsmithConfigs();
const { applicationId, otlpEndpoint, otlpLicenseKey, otlpServiceName } =
  newRelic;

const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: otlpServiceName,
  [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: applicationId,
  [SemanticResourceAttributes.SERVICE_VERSION]: "1.0.0",
});
const provider = new WebTracerProvider({
  resource,
});

const newRelicExporter = new OTLPTraceExporter({
  url: `${otlpEndpoint}/v1/traces`,
  headers: {
    "api-key": otlpLicenseKey,
  },
});

const processor = new BatchSpanProcessor(
  newRelicExporter,
  //Optional BatchSpanProcessor Configurations
  {
    // The maximum queue size. After the size is reached spans are dropped.
    maxQueueSize: 100,
    // The maximum batch size of every export. It must be smaller or equal to maxQueueSize.
    maxExportBatchSize: 50,
    // The interval between two consecutive exports
    scheduledDelayMillis: 500,
    // How long the export can run before it is cancelled
    exportTimeoutMillis: 30000,
  },
);

const metricExporter = new OTLPMetricExporter({
  // compression: "gzip",
  temporalityPreference: AggregationTemporalityPreference.DELTA,
  url: `${otlpEndpoint}/v1/metrics`,
  headers: {
    "api-key": otlpLicenseKey,
  },
  // ... other options
});
// metricExporter.selectAggregationTemporality("HISTOGRAM");
// Create a meter provider and register the exporter
export const meterProvider = new MeterProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: otlpServiceName,
    [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: applicationId,
    [SemanticResourceAttributes.SERVICE_VERSION]: "1.0.0",
  }),
  readers: [
    new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 10000,
    }),
  ],
});
// Register the MeterProvider globally
metrics.setGlobalMeterProvider(meterProvider);
// https://metric-api.newrelic.com/metric/v1

const W3C_OTLP_TRACE_HEADER = "traceparent";
const CUSTOM_OTLP_TRACE_HEADER = "traceparent-otlp";
//We are overriding the default header "traceparent" used for trace context because the browser
// agent shares the same header's distributed tracing
class CustomW3CTraceContextPropagator extends W3CTraceContextPropagator {
  inject(context, carrier, setter) {
    // Call the original inject method to get the default traceparent header
    super.inject(context, carrier, setter);

    // Modify the carrier to use a different header
    if (carrier[W3C_OTLP_TRACE_HEADER]) {
      carrier[CUSTOM_OTLP_TRACE_HEADER] = carrier[W3C_OTLP_TRACE_HEADER];
      delete carrier[W3C_OTLP_TRACE_HEADER]; // Remove the original traceparent header
    }
  }
}

provider.addSpanProcessor(processor);
provider.register({
  contextManager: new ZoneContextManager(),
  propagator: new CustomW3CTraceContextPropagator(),
});

registerInstrumentations({
  instrumentations: [],
});
