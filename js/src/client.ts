import * as uuid from "uuid";

import * as bindings from "langsmith-nodejs";

import { AsyncCaller, AsyncCallerParams } from "./utils/async_caller.js";
import {
  ComparativeExperiment,
  DataType,
  Dataset,
  DatasetDiffInfo,
  DatasetShareSchema,
  Example,
  ExampleCreate,
  ExampleUpdate,
  ExampleUpdateWithId,
  Feedback,
  FeedbackConfig,
  FeedbackIngestToken,
  KVMap,
  LangChainBaseMessage,
  LangSmithSettings,
  LikePromptResponse,
  ListCommitsResponse,
  ListPromptsResponse,
  Prompt,
  PromptCommit,
  PromptSortField,
  Run,
  RunCreate,
  RunUpdate,
  ScoreType,
  ExampleSearch,
  TimeDelta,
  TracerSession,
  TracerSessionResult,
  ValueType,
  AnnotationQueue,
  RunWithAnnotationQueueInfo,
  Attachments,
  ExampleUploadWithAttachments,
  UploadExamplesResponse,
  ExampleUpdateWithAttachments,
  UpdateExamplesResponse,
  RawExample,
  AttachmentInfo,
  AttachmentData,
} from "./schemas.js";
import {
  convertLangChainMessageToExample,
  isLangChainMessage,
} from "./utils/messages.js";
import {
  getEnvironmentVariable,
  getLangChainEnvVars,
  getLangChainEnvVarsMetadata,
  getLangSmithEnvironmentVariable,
  getRuntimeEnvironment,
} from "./utils/env.js";

import {
  EvaluationResult,
  EvaluationResults,
  RunEvaluator,
} from "./evaluation/evaluator.js";
import { __version__ } from "./index.js";
import { assertUuid } from "./utils/_uuid.js";
import { warnOnce } from "./utils/warn.js";
import { parsePromptIdentifier } from "./utils/prompts.js";
import { raiseForStatus } from "./utils/error.js";
import { _getFetchImplementation } from "./singletons/fetch.js";

import { stringify as stringifyForTracing } from "./utils/fast-safe-stringify/index.js";

export interface ClientConfig {
  apiUrl?: string;
  apiKey?: string;
  callerOptions?: AsyncCallerParams;
  timeout_ms?: number;
  webUrl?: string;
  anonymizer?: (values: KVMap) => KVMap;
  hideInputs?: boolean | ((inputs: KVMap) => KVMap);
  hideOutputs?: boolean | ((outputs: KVMap) => KVMap);
  autoBatchTracing?: boolean;
  batchSizeBytesLimit?: number;
  blockOnRootRunFinalization?: boolean;
  traceBatchConcurrency?: number;
  fetchOptions?: RequestInit;
}

/**
 * Represents the parameters for listing runs (spans) from the Langsmith server.
 */
interface ListRunsParams {
  /**
   * The ID or IDs of the project(s) to filter by.
   */
  projectId?: string | string[];

  /**
   * The name or names of the project(s) to filter by.
   */
  projectName?: string | string[];

  /**
   * The ID of the trace to filter by.
   */
  traceId?: string;
  /**
   * isRoot - Whether to only include root runs.
   *  */
  isRoot?: boolean;

  /**
   * The execution order to filter by.
   */
  executionOrder?: number;

  /**
   * The ID of the parent run to filter by.
   */
  parentRunId?: string;

  /**
   * The ID of the reference example to filter by.
   */
  referenceExampleId?: string;

  /**
   * The start time to filter by.
   */
  startTime?: Date;

  /**
   * The run type to filter by.
   */
  runType?: string;

  /**
   * Indicates whether to filter by error runs.
   */
  error?: boolean;

  /**
   * The ID or IDs of the runs to filter by.
   */
  id?: string[];

  /**
   * The maximum number of runs to retrieve.
   */
  limit?: number;

  /**
   * The query string to filter by.
   */
  query?: string;

  /**
   * The filter string to apply.
   *
   * Run Filtering:
   * Listing runs with query params is useful for simple queries, but doesn't support many common needs, such as filtering by metadata, tags, or other fields.
   * LangSmith supports a filter query language to permit more complex filtering operations when fetching runs. This guide will provide a high level overview of the grammar as well as a few examples of when it can be useful.
   * If you'd prefer a more visual guide, you can get a taste of the language by viewing the table of runs on any of your projects' pages. We provide some recommended filters to get you started that you can copy and use the SDK.
   *
   * Grammar:
   * The filtering grammar is based on common comparators on fields in the run object. Supported comparators include:
   * - gte (greater than or equal to)
   * - gt (greater than)
   * - lte (less than or equal to)
   * - lt (less than)
   * - eq (equal to)
   * - neq (not equal to)
   * - has (check if run contains a tag or metadata json blob)
   * - search (search for a substring in a string field)
   */
  filter?: string;

  /**
   * Filter to apply to the ROOT run in the trace tree. This is meant to be used in conjunction with the regular
   *  `filter` parameter to let you filter runs by attributes of the root run within a trace. Example is filtering by
   * feedback assigned to the trace.
   */
  traceFilter?: string;

  /**
   * Filter to apply to OTHER runs in the trace tree, including sibling and child runs. This is meant to be used in
   * conjunction with the regular `filter` parameter to let you filter runs by attributes of any run within a trace.
   */
  treeFilter?: string;
  /**
   * The values to include in the response.
   */
  select?: string[];
}

interface UploadCSVParams {
  csvFile: Blob;
  fileName: string;
  inputKeys: string[];
  outputKeys: string[];
  description?: string;
  dataType?: DataType;
  name?: string;
}

interface feedback_source {
  type: string;
  metadata?: KVMap;
}

interface FeedbackCreate {
  id: string;
  run_id: string | null;
  key: string;
  score?: ScoreType;
  value?: ValueType;
  correction?: object | null;
  comment?: string | null;
  feedback_source?: feedback_source | KVMap | null;
  feedbackConfig?: FeedbackConfig;
  session_id?: string;
  comparative_experiment_id?: string;
}

interface FeedbackUpdate {
  score?: ScoreType;
  value?: ValueType;
  correction?: object | null;
  comment?: string | null;
}

interface CreateRunParams {
  name: string;
  inputs: KVMap;
  run_type: string;
  id?: string;
  start_time?: number;
  end_time?: number;
  extra?: KVMap;
  error?: string;
  serialized?: object;
  outputs?: KVMap;
  reference_example_id?: string;
  child_runs?: RunCreate[];
  parent_run_id?: string;
  project_name?: string;
  revision_id?: string;
  trace_id?: string;
  dotted_order?: string;
  attachments?: Attachments;
}

interface UpdateRunParams extends RunUpdate {
  id?: string;
}

interface ProjectOptions {
  projectName?: string;
  projectId?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RecordStringAny = Record<string, any>;

export type FeedbackSourceType = "model" | "api" | "app";

export type CreateExampleOptions = {
  /** The ID of the dataset to create the example in. */
  datasetId?: string;
  /** The name of the dataset to create the example in (if dataset ID is not provided). */
  datasetName?: string;
  /** The creation date of the example. */
  createdAt?: Date;
  /** A unique identifier for the example. */
  exampleId?: string;
  /** Additional metadata associated with the example. */
  metadata?: KVMap;
  /** The split(s) to assign the example to. */
  split?: string | string[];
  /** The ID of the source run associated with this example. */
  sourceRunId?: string;
};

type AutoBatchQueueItem = {
  action: "create" | "update";
  item: RunCreate | RunUpdate;
};

type MultipartPart = {
  name: string;
  payload: Blob;
};

export function mergeRuntimeEnvIntoRunCreate(run: RunCreate) {
  const runtimeEnv = getRuntimeEnvironment();
  const envVars = getLangChainEnvVarsMetadata();
  const extra = run.extra ?? {};
  const metadata = extra.metadata;
  run.extra = {
    ...extra,
    runtime: {
      ...runtimeEnv,
      ...extra?.runtime,
    },
    metadata: {
      ...envVars,
      ...(envVars.revision_id || run.revision_id
        ? { revision_id: run.revision_id ?? envVars.revision_id }
        : {}),
      ...metadata,
    },
  };
  return run;
}

const getTracingSamplingRate = () => {
  const samplingRateStr = getLangSmithEnvironmentVariable(
    "TRACING_SAMPLING_RATE"
  );
  if (samplingRateStr === undefined) {
    return undefined;
  }
  const samplingRate = parseFloat(samplingRateStr);
  if (samplingRate < 0 || samplingRate > 1) {
    throw new Error(
      `LANGSMITH_TRACING_SAMPLING_RATE must be between 0 and 1 if set. Got: ${samplingRate}`
    );
  }
  return samplingRate;
};

// utility functions
const isLocalhost = (url: string): boolean => {
  const strippedUrl = url.replace("http://", "").replace("https://", "");
  const hostname = strippedUrl.split("/")[0].split(":")[0];
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  );
};

async function toArray<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of iterable) {
    result.push(item);
  }
  return result;
}

function trimQuotes(str?: string): string | undefined {
  if (str === undefined) {
    return undefined;
  }
  return str
    .trim()
    .replace(/^"(.*)"$/, "$1")
    .replace(/^'(.*)'$/, "$1");
}

const handle429 = async (response?: Response) => {
  if (response?.status === 429) {
    const retryAfter =
      parseInt(response.headers.get("retry-after") ?? "30", 10) * 1000;
    if (retryAfter > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryAfter));
      // Return directly after calling this check
      return true;
    }
  }
  // Fall back to existing status checks
  return false;
};

export class AutoBatchQueue {
  items: {
    action: "create" | "update";
    payload: RunCreate | RunUpdate;
    itemPromiseResolve: () => void;
    itemPromise: Promise<void>;
    size: number;
  }[] = [];

  sizeBytes = 0;

  peek() {
    return this.items[0];
  }

  push(item: AutoBatchQueueItem): Promise<void> {
    let itemPromiseResolve;
    const itemPromise = new Promise<void>((resolve) => {
      // Setting itemPromiseResolve is synchronous with promise creation:
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/Promise
      itemPromiseResolve = resolve;
    });
    const size = stringifyForTracing(item.item).length;
    this.items.push({
      action: item.action,
      payload: item.item,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      itemPromiseResolve: itemPromiseResolve!,
      itemPromise,
      size,
    });
    this.sizeBytes += size;
    return itemPromise;
  }

  pop(upToSizeBytes: number): [AutoBatchQueueItem[], () => void] {
    if (upToSizeBytes < 1) {
      throw new Error("Number of bytes to pop off may not be less than 1.");
    }
    const popped: typeof this.items = [];
    let poppedSizeBytes = 0;
    // Pop items until we reach or exceed the size limit
    while (
      poppedSizeBytes + (this.peek()?.size ?? 0) < upToSizeBytes &&
      this.items.length > 0
    ) {
      const item = this.items.shift();
      if (item) {
        popped.push(item);
        poppedSizeBytes += item.size;
        this.sizeBytes -= item.size;
      }
    }
    // If there is an item on the queue we were unable to pop,
    // just return it as a single batch.
    if (popped.length === 0 && this.items.length > 0) {
      const item = this.items.shift()!;
      popped.push(item);
      poppedSizeBytes += item.size;
      this.sizeBytes -= item.size;
    }
    return [
      popped.map((it) => ({ action: it.action, item: it.payload })),
      () => popped.forEach((it) => it.itemPromiseResolve()),
    ];
  }
}

// 20 MB
export const DEFAULT_BATCH_SIZE_LIMIT_BYTES = 20_971_520;

const SERVER_INFO_REQUEST_TIMEOUT = 2500;

export class Client implements LangSmithTracingClientInterface {
  private apiKey?: string;

  private apiUrl: string;

  private webUrl?: string;

  private caller: AsyncCaller;

  private batchIngestCaller: AsyncCaller;

  private timeout_ms: number;

  private _tenantId: string | null = null;

  private hideInputs?: boolean | ((inputs: KVMap) => KVMap);

  private hideOutputs?: boolean | ((outputs: KVMap) => KVMap);

  private tracingSampleRate?: number;

  private filteredPostUuids = new Set();

  private autoBatchTracing = true;

  private autoBatchQueue = new AutoBatchQueue();

  private autoBatchTimeout: ReturnType<typeof setTimeout> | undefined;

  private autoBatchAggregationDelayMs = 250;

  private batchSizeBytesLimit?: number;

  private fetchOptions: RequestInit;

  private settings: Promise<LangSmithSettings> | null;

  private blockOnRootRunFinalization =
    getEnvironmentVariable("LANGSMITH_TRACING_BACKGROUND") === "false";

  private traceBatchConcurrency = 5;

  private _serverInfo: RecordStringAny | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _getServerInfoPromise?: Promise<Record<string, any>>;

  private _rustClient: bindings.TracingClient | null;

  constructor(config: ClientConfig = {}) {
    const defaultConfig = Client.getDefaultClientConfig();

    this.tracingSampleRate = getTracingSamplingRate();
    this.apiUrl = trimQuotes(config.apiUrl ?? defaultConfig.apiUrl) ?? "";
    if (this.apiUrl.endsWith("/")) {
      this.apiUrl = this.apiUrl.slice(0, -1);
    }
    this.apiKey = trimQuotes(config.apiKey ?? defaultConfig.apiKey);
    this.webUrl = trimQuotes(config.webUrl ?? defaultConfig.webUrl);
    if (this.webUrl?.endsWith("/")) {
      this.webUrl = this.webUrl.slice(0, -1);
    }
    this.timeout_ms = config.timeout_ms ?? 90_000;
    this.caller = new AsyncCaller(config.callerOptions ?? {});
    this.traceBatchConcurrency =
      config.traceBatchConcurrency ?? this.traceBatchConcurrency;
    if (this.traceBatchConcurrency < 1) {
      throw new Error("Trace batch concurrency must be positive.");
    }
    this.batchIngestCaller = new AsyncCaller({
      maxRetries: 2,
      maxConcurrency: this.traceBatchConcurrency,
      ...(config.callerOptions ?? {}),
      onFailedResponseHook: handle429,
    });

    this.hideInputs =
      config.hideInputs ?? config.anonymizer ?? defaultConfig.hideInputs;
    this.hideOutputs =
      config.hideOutputs ?? config.anonymizer ?? defaultConfig.hideOutputs;

    this.autoBatchTracing = config.autoBatchTracing ?? this.autoBatchTracing;
    this.blockOnRootRunFinalization =
      config.blockOnRootRunFinalization ?? this.blockOnRootRunFinalization;
    this.batchSizeBytesLimit = config.batchSizeBytesLimit;
    this.fetchOptions = config.fetchOptions || {};

    // TODO: Do we care about syncing up the env var names between the JS and Python bindings?
    //       The Python bindings use `LANGSMITH_USE_PYO3_CLIENT` as an env var,
    //       but JS seems to prefer the `LANGCHAIN` prefix instead.
    if ("LANGCHAIN_USE_RUST_CLIENT" in getLangChainEnvVars()) {
      // TODO: tweak these constants as needed -- these are the defaults that Python uses
      const queueCapacity = 1000000;
      const batchSize = 100;
      const batchTimeoutMillis = 1000;
      const workerThreads = 1;
      this._rustClient = new bindings.TracingClient(
        `${this.apiUrl}/runs`,
        this.apiKey || "", // TODO: the Rust code *requires* an API key, is that inappropriate?
        queueCapacity,
        batchSize,
        batchTimeoutMillis,
        workerThreads
      );
    } else {
      this._rustClient = null;
    }
  }

  public static getDefaultClientConfig(): {
    apiUrl: string;
    apiKey?: string;
    webUrl?: string;
    hideInputs?: boolean;
    hideOutputs?: boolean;
  } {
    const apiKey = getLangSmithEnvironmentVariable("API_KEY");
    const apiUrl =
      getLangSmithEnvironmentVariable("ENDPOINT") ??
      "https://api.smith.langchain.com";
    const hideInputs =
      getLangSmithEnvironmentVariable("HIDE_INPUTS") === "true";
    const hideOutputs =
      getLangSmithEnvironmentVariable("HIDE_OUTPUTS") === "true";
    return {
      apiUrl: apiUrl,
      apiKey: apiKey,
      webUrl: undefined,
      hideInputs: hideInputs,
      hideOutputs: hideOutputs,
    };
  }

  public getHostUrl(): string {
    if (this.webUrl) {
      return this.webUrl;
    } else if (isLocalhost(this.apiUrl)) {
      this.webUrl = "http://localhost:3000";
      return this.webUrl;
    } else if (
      this.apiUrl.includes("/api") &&
      !this.apiUrl.split(".", 1)[0].endsWith("api")
    ) {
      this.webUrl = this.apiUrl.replace("/api", "");
      return this.webUrl;
    } else if (this.apiUrl.split(".", 1)[0].includes("dev")) {
      this.webUrl = "https://dev.smith.langchain.com";
      return this.webUrl;
    } else if (this.apiUrl.split(".", 1)[0].includes("eu")) {
      this.webUrl = "https://eu.smith.langchain.com";
      return this.webUrl;
    } else {
      this.webUrl = "https://smith.langchain.com";
      return this.webUrl;
    }
  }

  private get headers(): { [header: string]: string } {
    const headers: { [header: string]: string } = {
      "User-Agent": `langsmith-js/${__version__}`,
    };
    if (this.apiKey) {
      headers["x-api-key"] = `${this.apiKey}`;
    }
    return headers;
  }

  private processInputs(inputs: KVMap): KVMap {
    if (this.hideInputs === false) {
      return inputs;
    }
    if (this.hideInputs === true) {
      return {};
    }
    if (typeof this.hideInputs === "function") {
      return this.hideInputs(inputs);
    }
    return inputs;
  }

  private processOutputs(outputs: KVMap): KVMap {
    if (this.hideOutputs === false) {
      return outputs;
    }
    if (this.hideOutputs === true) {
      return {};
    }
    if (typeof this.hideOutputs === "function") {
      return this.hideOutputs(outputs);
    }
    return outputs;
  }

  private prepareRunCreateOrUpdateInputs(run: RunUpdate): RunUpdate;
  private prepareRunCreateOrUpdateInputs(run: RunCreate): RunCreate;
  private prepareRunCreateOrUpdateInputs(
    run: RunCreate | RunUpdate
  ): RunCreate | RunUpdate {
    const runParams = { ...run };
    if (runParams.inputs !== undefined) {
      runParams.inputs = this.processInputs(runParams.inputs);
    }
    if (runParams.outputs !== undefined) {
      runParams.outputs = this.processOutputs(runParams.outputs);
    }
    return runParams;
  }

  private async _getResponse(
    path: string,
    queryParams?: URLSearchParams
  ): Promise<Response> {
    const paramsString = queryParams?.toString() ?? "";
    const url = `${this.apiUrl}${path}?${paramsString}`;
    const response = await this.caller.call(_getFetchImplementation(), url, {
      method: "GET",
      headers: this.headers,
      signal: AbortSignal.timeout(this.timeout_ms),
      ...this.fetchOptions,
    });
    await raiseForStatus(response, `Failed to fetch ${path}`);
    return response;
  }

  private async _get<T>(
    path: string,
    queryParams?: URLSearchParams
  ): Promise<T> {
    const response = await this._getResponse(path, queryParams);
    return response.json() as T;
  }

  private async *_getPaginated<T, TResponse = unknown>(
    path: string,
    queryParams: URLSearchParams = new URLSearchParams(),
    transform?: (data: TResponse) => T[]
  ): AsyncIterable<T[]> {
    let offset = Number(queryParams.get("offset")) || 0;
    const limit = Number(queryParams.get("limit")) || 100;
    while (true) {
      queryParams.set("offset", String(offset));
      queryParams.set("limit", String(limit));

      const url = `${this.apiUrl}${path}?${queryParams}`;
      const response = await this.caller.call(_getFetchImplementation(), url, {
        method: "GET",
        headers: this.headers,
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      });
      await raiseForStatus(response, `Failed to fetch ${path}`);
      const items: T[] = transform
        ? transform(await response.json())
        : await response.json();

      if (items.length === 0) {
        break;
      }
      yield items;

      if (items.length < limit) {
        break;
      }
      offset += items.length;
    }
  }

  private async *_getCursorPaginatedList<T>(
    path: string,
    body: RecordStringAny | null = null,
    requestMethod = "POST",
    dataKey = "runs"
  ): AsyncIterable<T[]> {
    const bodyParams = body ? { ...body } : {};
    while (true) {
      const response = await this.caller.call(
        _getFetchImplementation(),
        `${this.apiUrl}${path}`,
        {
          method: requestMethod,
          headers: { ...this.headers, "Content-Type": "application/json" },
          signal: AbortSignal.timeout(this.timeout_ms),
          ...this.fetchOptions,
          body: JSON.stringify(bodyParams),
        }
      );
      const responseBody = await response.json();
      if (!responseBody) {
        break;
      }
      if (!responseBody[dataKey]) {
        break;
      }
      yield responseBody[dataKey];
      const cursors = responseBody.cursors;
      if (!cursors) {
        break;
      }
      if (!cursors.next) {
        break;
      }
      bodyParams.cursor = cursors.next;
    }
  }

  private _filterForSampling(
    runs: CreateRunParams[] | UpdateRunParams[],
    patch = false
  ) {
    if (this.tracingSampleRate === undefined) {
      return runs;
    }

    if (patch) {
      const sampled = [];
      for (const run of runs) {
        if (!this.filteredPostUuids.has(run.id)) {
          sampled.push(run);
        } else {
          this.filteredPostUuids.delete(run.id);
        }
      }
      return sampled;
    } else {
      const sampled = [];
      for (const run of runs) {
        if (
          (run.id !== run.trace_id &&
            !this.filteredPostUuids.has(run.trace_id)) ||
          Math.random() < this.tracingSampleRate
        ) {
          sampled.push(run);
        } else {
          this.filteredPostUuids.add(run.id);
        }
      }
      return sampled;
    }
  }

  private async _getBatchSizeLimitBytes(): Promise<number> {
    const serverInfo = await this._ensureServerInfo();
    return (
      this.batchSizeBytesLimit ??
      serverInfo.batch_ingest_config?.size_limit_bytes ??
      DEFAULT_BATCH_SIZE_LIMIT_BYTES
    );
  }

  private async _getMultiPartSupport(): Promise<boolean> {
    const serverInfo = await this._ensureServerInfo();
    return (
      serverInfo.instance_flags?.dataset_examples_multipart_enabled ?? false
    );
  }

  private drainAutoBatchQueue(batchSizeLimit: number) {
    while (this.autoBatchQueue.items.length > 0) {
      const [batch, done] = this.autoBatchQueue.pop(batchSizeLimit);
      if (!batch.length) {
        done();
        break;
      }
      void this._processBatch(batch, done).catch(console.error);
    }
  }

  private async _processBatch(batch: AutoBatchQueueItem[], done: () => void) {
    if (!batch.length) {
      done();
      return;
    }
    try {
      const ingestParams = {
        runCreates: batch
          .filter((item) => item.action === "create")
          .map((item) => item.item) as RunCreate[],
        runUpdates: batch
          .filter((item) => item.action === "update")
          .map((item) => item.item) as RunUpdate[],
      };
      const serverInfo = await this._ensureServerInfo();
      if (serverInfo?.batch_ingest_config?.use_multipart_endpoint) {
        await this.multipartIngestRuns(ingestParams);
      } else {
        await this.batchIngestRuns(ingestParams);
      }
    } finally {
      done();
    }
  }

  private async processRunOperation(item: AutoBatchQueueItem) {
    clearTimeout(this.autoBatchTimeout);
    this.autoBatchTimeout = undefined;
    if (item.action === "create") {
      item.item = mergeRuntimeEnvIntoRunCreate(item.item as RunCreate);
    }
    const itemPromise = this.autoBatchQueue.push(item);
    const sizeLimitBytes = await this._getBatchSizeLimitBytes();
    if (this.autoBatchQueue.sizeBytes > sizeLimitBytes) {
      this.drainAutoBatchQueue(sizeLimitBytes);
    }
    if (this.autoBatchQueue.items.length > 0) {
      this.autoBatchTimeout = setTimeout(() => {
        this.autoBatchTimeout = undefined;
        this.drainAutoBatchQueue(sizeLimitBytes);
      }, this.autoBatchAggregationDelayMs);
    }
    return itemPromise;
  }

  protected async _getServerInfo() {
    const response = await _getFetchImplementation()(`${this.apiUrl}/info`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(SERVER_INFO_REQUEST_TIMEOUT),
      ...this.fetchOptions,
    });
    await raiseForStatus(response, "get server info");
    return response.json();
  }

  protected async _ensureServerInfo() {
    if (this._getServerInfoPromise === undefined) {
      this._getServerInfoPromise = (async () => {
        if (this._serverInfo === undefined) {
          try {
            this._serverInfo = await this._getServerInfo();
          } catch (e) {
            console.warn(
              `[WARNING]: LangSmith failed to fetch info on supported operations. Falling back to batch operations and default limits.`
            );
          }
        }
        return this._serverInfo ?? {};
      })();
    }
    return this._getServerInfoPromise.then((serverInfo) => {
      if (this._serverInfo === undefined) {
        this._getServerInfoPromise = undefined;
      }
      return serverInfo;
    });
  }

  protected async _getSettings() {
    if (!this.settings) {
      this.settings = this._get("/settings");
    }

    return await this.settings;
  }

  public async createRun(run: CreateRunParams): Promise<void> {
    if (!this._filterForSampling([run]).length) {
      return;
    }
    const headers = { ...this.headers, "Content-Type": "application/json" };
    const session_name = run.project_name;
    delete run.project_name;

    const runCreate: RunCreate = this.prepareRunCreateOrUpdateInputs({
      session_name,
      ...run,
      start_time: run.start_time ?? Date.now(),
    });

    if (
      runCreate.trace_id !== undefined &&
      runCreate.dotted_order !== undefined
    ) {
      if (this._rustClient) {
        const mergedRunCreateParam = mergeRuntimeEnvIntoRunCreate(runCreate);

        // We need to massage the data shape into what Rust expects and will accept,
        // and we also need to take care of possible cyclic data structures.
        //
        // TODO: Clean up and/or move more of this logic into Rust. This is just an MVP for testing.
        //       But be careful of cyclic data structures with serde! They might not work properly.

        // Corresponds to a Rust `Vec<Attachment>` value.
        const attachments = Object.entries(
          mergedRunCreateParam.attachments ?? {}
        ).map(([filename, [mimeType, contents]]) => {
          const attachment = {
            filename,
            ref_name: filename,
            data: contents,
            content_type: mimeType,
          };
          return attachment;
        });

        // Corresponds to Rust's `RunIO` struct.
        const io = {
          inputs: mergedRunCreateParam.inputs
            ? stringifyForTracing(mergedRunCreateParam.inputs)
            : null,
          outputs: mergedRunCreateParam.outputs
            ? stringifyForTracing(mergedRunCreateParam.outputs)
            : null,
        };

        // TODO: Use a concrete TS type here for type safety. We don't currently have a TS definition
        //       because the type comes from a different crate than the Node.js bindings,
        //       so the binding generator isn't generating an entry for it in the .d.ts file.
        //       This corresponds to Rust's `RunCreateExtended` type.
        const data = {
          run_create: mergedRunCreateParam,
          io,
          attachments: mergedRunCreateParam.attachments ? attachments : null,
        };

        // TODO: The Rust code currently offers no way to track what happened to the submitted data.
        //       It's completely "fire and forget." The JS code path will instead raise errors
        //       if submitting data fails. Is that something we want to mirror in Rust?
        //       It's possible but will require significant refactoring of the Rust APIs.
        try {
          this._rustClient.createRun(data);
        } catch (e) {
          console.error(e);
        }
        return;
      } else if (this.autoBatchTracing) {
        void this.processRunOperation({
          action: "create",
          item: runCreate,
        }).catch(console.error);
        return;
      }
    }

    const mergedRunCreateParam = mergeRuntimeEnvIntoRunCreate(runCreate);
    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/runs`,
      {
        method: "POST",
        headers,
        body: stringifyForTracing(mergedRunCreateParam),
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    await raiseForStatus(response, "create run", true);
  }

  /**
   * Batch ingest/upsert multiple runs in the Langsmith system.
   * @param runs
   */
  public async batchIngestRuns({
    runCreates,
    runUpdates,
  }: {
    runCreates?: RunCreate[];
    runUpdates?: RunUpdate[];
  }) {
    if (runCreates === undefined && runUpdates === undefined) {
      return;
    }
    let preparedCreateParams =
      runCreates?.map((create) =>
        this.prepareRunCreateOrUpdateInputs(create)
      ) ?? [];
    let preparedUpdateParams =
      runUpdates?.map((update) =>
        this.prepareRunCreateOrUpdateInputs(update)
      ) ?? [];

    if (preparedCreateParams.length > 0 && preparedUpdateParams.length > 0) {
      const createById = preparedCreateParams.reduce(
        (params: Record<string, RunCreate>, run) => {
          if (!run.id) {
            return params;
          }
          params[run.id] = run;
          return params;
        },
        {}
      );
      const standaloneUpdates = [];
      for (const updateParam of preparedUpdateParams) {
        if (updateParam.id !== undefined && createById[updateParam.id]) {
          createById[updateParam.id] = {
            ...createById[updateParam.id],
            ...updateParam,
          };
        } else {
          standaloneUpdates.push(updateParam);
        }
      }
      preparedCreateParams = Object.values(createById);
      preparedUpdateParams = standaloneUpdates;
    }
    const rawBatch = {
      post: this._filterForSampling(preparedCreateParams),
      patch: this._filterForSampling(preparedUpdateParams, true),
    };
    if (!rawBatch.post.length && !rawBatch.patch.length) {
      return;
    }
    const batchChunks = {
      post: [] as (typeof rawBatch)["post"],
      patch: [] as (typeof rawBatch)["patch"],
    };
    for (const k of ["post", "patch"]) {
      const key = k as keyof typeof rawBatch;
      const batchItems = rawBatch[key].reverse();
      let batchItem = batchItems.pop();
      while (batchItem !== undefined) {
        batchChunks[key].push(batchItem);
        batchItem = batchItems.pop();
      }
    }
    if (batchChunks.post.length > 0 || batchChunks.patch.length > 0) {
      await this._postBatchIngestRuns(stringifyForTracing(batchChunks));
    }
  }

  private async _postBatchIngestRuns(body: string) {
    const headers = {
      ...this.headers,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    const response = await this.batchIngestCaller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/runs/batch`,
      {
        method: "POST",
        headers,
        body: body,
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    await raiseForStatus(response, "batch create run", true);
  }

  /**
   * Batch ingest/upsert multiple runs in the Langsmith system.
   * @param runs
   */
  public async multipartIngestRuns({
    runCreates,
    runUpdates,
  }: {
    runCreates?: RunCreate[];
    runUpdates?: RunUpdate[];
  }) {
    if (runCreates === undefined && runUpdates === undefined) {
      return;
    }
    // transform and convert to dicts
    const allAttachments: Record<string, Attachments> = {};
    let preparedCreateParams = [];
    for (const create of runCreates ?? []) {
      const preparedCreate = this.prepareRunCreateOrUpdateInputs(create);
      if (
        preparedCreate.id !== undefined &&
        preparedCreate.attachments !== undefined
      ) {
        allAttachments[preparedCreate.id] = preparedCreate.attachments;
      }
      delete preparedCreate.attachments;
      preparedCreateParams.push(preparedCreate);
    }
    let preparedUpdateParams = [];
    for (const update of runUpdates ?? []) {
      preparedUpdateParams.push(this.prepareRunCreateOrUpdateInputs(update));
    }

    // require trace_id and dotted_order
    const invalidRunCreate = preparedCreateParams.find((runCreate) => {
      return (
        runCreate.trace_id === undefined || runCreate.dotted_order === undefined
      );
    });
    if (invalidRunCreate !== undefined) {
      throw new Error(
        `Multipart ingest requires "trace_id" and "dotted_order" to be set when creating a run`
      );
    }
    const invalidRunUpdate = preparedUpdateParams.find((runUpdate) => {
      return (
        runUpdate.trace_id === undefined || runUpdate.dotted_order === undefined
      );
    });
    if (invalidRunUpdate !== undefined) {
      throw new Error(
        `Multipart ingest requires "trace_id" and "dotted_order" to be set when updating a run`
      );
    }
    // combine post and patch dicts where possible
    if (preparedCreateParams.length > 0 && preparedUpdateParams.length > 0) {
      const createById = preparedCreateParams.reduce(
        (params: Record<string, RunCreate>, run) => {
          if (!run.id) {
            return params;
          }
          params[run.id] = run;
          return params;
        },
        {}
      );
      const standaloneUpdates = [];
      for (const updateParam of preparedUpdateParams) {
        if (updateParam.id !== undefined && createById[updateParam.id]) {
          createById[updateParam.id] = {
            ...createById[updateParam.id],
            ...updateParam,
          };
        } else {
          standaloneUpdates.push(updateParam);
        }
      }
      preparedCreateParams = Object.values(createById);
      preparedUpdateParams = standaloneUpdates;
    }
    if (
      preparedCreateParams.length === 0 &&
      preparedUpdateParams.length === 0
    ) {
      return;
    }
    // send the runs in multipart requests
    const accumulatedContext: string[] = [];
    const accumulatedParts: MultipartPart[] = [];
    for (const [method, payloads] of [
      ["post", preparedCreateParams] as const,
      ["patch", preparedUpdateParams] as const,
    ]) {
      for (const originalPayload of payloads) {
        // collect fields to be sent as separate parts
        const { inputs, outputs, events, attachments, ...payload } =
          originalPayload;
        const fields = { inputs, outputs, events };
        // encode the main run payload
        const stringifiedPayload = stringifyForTracing(payload);
        accumulatedParts.push({
          name: `${method}.${payload.id}`,
          payload: new Blob([stringifiedPayload], {
            type: `application/json; length=${stringifiedPayload.length}`, // encoding=gzip
          }),
        });
        // encode the fields we collected
        for (const [key, value] of Object.entries(fields)) {
          if (value === undefined) {
            continue;
          }
          const stringifiedValue = stringifyForTracing(value);
          accumulatedParts.push({
            name: `${method}.${payload.id}.${key}`,
            payload: new Blob([stringifiedValue], {
              type: `application/json; length=${stringifiedValue.length}`,
            }),
          });
        }
        // encode the attachments
        if (payload.id !== undefined) {
          const attachments = allAttachments[payload.id];
          if (attachments) {
            delete allAttachments[payload.id];
            for (const [name, attachment] of Object.entries(attachments)) {
              let contentType: string;
              let content: AttachmentData;

              if (Array.isArray(attachment)) {
                [contentType, content] = attachment;
              } else {
                contentType = attachment.mimeType;
                content = attachment.data;
              }

              // Validate that the attachment name doesn't contain a '.'
              if (name.includes(".")) {
                console.warn(
                  `Skipping attachment '${name}' for run ${payload.id}: Invalid attachment name. ` +
                    `Attachment names must not contain periods ('.'). Please rename the attachment and try again.`
                );
                continue;
              }
              accumulatedParts.push({
                name: `attachment.${payload.id}.${name}`,
                payload: new Blob([content], {
                  type: `${contentType}; length=${content.byteLength}`,
                }),
              });
            }
          }
        }
        // compute context
        accumulatedContext.push(`trace=${payload.trace_id},id=${payload.id}`);
      }
    }
    await this._sendMultipartRequest(
      accumulatedParts,
      accumulatedContext.join("; ")
    );
  }

  private async _sendMultipartRequest(parts: MultipartPart[], context: string) {
    try {
      // Create multipart form data manually using Blobs
      const boundary =
        "----LangSmithFormBoundary" + Math.random().toString(36).slice(2);
      const chunks: Blob[] = [];

      for (const part of parts) {
        // Add field boundary
        chunks.push(new Blob([`--${boundary}\r\n`]));
        chunks.push(
          new Blob([
            `Content-Disposition: form-data; name="${part.name}"\r\n`,
            `Content-Type: ${part.payload.type}\r\n\r\n`,
          ])
        );
        chunks.push(part.payload);
        chunks.push(new Blob(["\r\n"]));
      }

      // Add final boundary
      chunks.push(new Blob([`--${boundary}--\r\n`]));

      // Combine all chunks into a single Blob
      const body = new Blob(chunks);

      // Convert Blob to ArrayBuffer for compatibility
      const arrayBuffer = await body.arrayBuffer();

      const res = await this.batchIngestCaller.call(
        _getFetchImplementation(),
        `${this.apiUrl}/runs/multipart`,
        {
          method: "POST",
          headers: {
            ...this.headers,
            "Content-Type": `multipart/form-data; boundary=${boundary}`,
          },
          body: arrayBuffer,
          signal: AbortSignal.timeout(this.timeout_ms),
          ...this.fetchOptions,
        }
      );
      await raiseForStatus(res, "ingest multipart runs", true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      console.warn(`${e.message.trim()}\n\nContext: ${context}`);
    }
  }

  public async updateRun(runId: string, run: RunUpdate): Promise<void> {
    assertUuid(runId);
    if (run.inputs) {
      run.inputs = this.processInputs(run.inputs);
    }

    if (run.outputs) {
      run.outputs = this.processOutputs(run.outputs);
    }
    // TODO: Untangle types
    const data: UpdateRunParams = { ...run, id: runId };
    if (!this._filterForSampling([data], true).length) {
      return;
    }
    if (
      this.autoBatchTracing &&
      data.trace_id !== undefined &&
      data.dotted_order !== undefined
    ) {
      if (
        run.end_time !== undefined &&
        data.parent_run_id === undefined &&
        this.blockOnRootRunFinalization
      ) {
        // Trigger batches as soon as a root trace ends and wait to ensure trace finishes
        // in serverless environments.
        await this.processRunOperation({ action: "update", item: data }).catch(
          console.error
        );
        return;
      } else {
        void this.processRunOperation({ action: "update", item: data }).catch(
          console.error
        );
      }
      return;
    }
    const headers = { ...this.headers, "Content-Type": "application/json" };
    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/runs/${runId}`,
      {
        method: "PATCH",
        headers,
        body: stringifyForTracing(run),
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    await raiseForStatus(response, "update run", true);
  }

  public async readRun(
    runId: string,
    { loadChildRuns }: { loadChildRuns: boolean } = { loadChildRuns: false }
  ): Promise<Run> {
    assertUuid(runId);
    let run = await this._get<Run>(`/runs/${runId}`);
    if (loadChildRuns && run.child_run_ids) {
      run = await this._loadChildRuns(run);
    }
    return run;
  }

  public async getRunUrl({
    runId,
    run,
    projectOpts,
  }: {
    runId?: string;
    run?: Run;
    projectOpts?: ProjectOptions;
  }): Promise<string> {
    if (run !== undefined) {
      let sessionId: string;
      if (run.session_id) {
        sessionId = run.session_id;
      } else if (projectOpts?.projectName) {
        sessionId = (
          await this.readProject({ projectName: projectOpts?.projectName })
        ).id;
      } else if (projectOpts?.projectId) {
        sessionId = projectOpts?.projectId;
      } else {
        const project = await this.readProject({
          projectName: getLangSmithEnvironmentVariable("PROJECT") || "default",
        });
        sessionId = project.id;
      }
      const tenantId = await this._getTenantId();
      return `${this.getHostUrl()}/o/${tenantId}/projects/p/${sessionId}/r/${
        run.id
      }?poll=true`;
    } else if (runId !== undefined) {
      const run_ = await this.readRun(runId);
      if (!run_.app_path) {
        throw new Error(`Run ${runId} has no app_path`);
      }
      const baseUrl = this.getHostUrl();
      return `${baseUrl}${run_.app_path}`;
    } else {
      throw new Error("Must provide either runId or run");
    }
  }

  private async _loadChildRuns(run: Run): Promise<Run> {
    const childRuns = await toArray(this.listRuns({ id: run.child_run_ids }));
    const treemap: { [key: string]: Run[] } = {};
    const runs: { [key: string]: Run } = {};
    // TODO: make dotted order required when the migration finishes
    childRuns.sort((a, b) =>
      (a?.dotted_order ?? "").localeCompare(b?.dotted_order ?? "")
    );
    for (const childRun of childRuns) {
      if (
        childRun.parent_run_id === null ||
        childRun.parent_run_id === undefined
      ) {
        throw new Error(`Child run ${childRun.id} has no parent`);
      }
      if (!(childRun.parent_run_id in treemap)) {
        treemap[childRun.parent_run_id] = [];
      }
      treemap[childRun.parent_run_id].push(childRun);
      runs[childRun.id] = childRun;
    }
    run.child_runs = treemap[run.id] || [];
    for (const runId in treemap) {
      if (runId !== run.id) {
        runs[runId].child_runs = treemap[runId];
      }
    }
    return run;
  }

  /**
   * List runs from the LangSmith server.
   * @param projectId - The ID of the project to filter by.
   * @param projectName - The name of the project to filter by.
   * @param parentRunId - The ID of the parent run to filter by.
   * @param traceId - The ID of the trace to filter by.
   * @param referenceExampleId - The ID of the reference example to filter by.
   * @param startTime - The start time to filter by.
   * @param isRoot - Indicates whether to only return root runs.
   * @param runType - The run type to filter by.
   * @param error - Indicates whether to filter by error runs.
   * @param id - The ID of the run to filter by.
   * @param query - The query string to filter by.
   * @param filter - The filter string to apply to the run spans.
   * @param traceFilter - The filter string to apply on the root run of the trace.
   * @param limit - The maximum number of runs to retrieve.
   * @returns {AsyncIterable<Run>} - The runs.
   *
   * @example
   * // List all runs in a project
   * const projectRuns = client.listRuns({ projectName: "<your_project>" });
   *
   * @example
   * // List LLM and Chat runs in the last 24 hours
   * const todaysLLMRuns = client.listRuns({
   *   projectName: "<your_project>",
   *   start_time: new Date(Date.now() - 24 * 60 * 60 * 1000),
   *   run_type: "llm",
   * });
   *
   * @example
   * // List traces in a project
   * const rootRuns = client.listRuns({
   *   projectName: "<your_project>",
   *   execution_order: 1,
   * });
   *
   * @example
   * // List runs without errors
   * const correctRuns = client.listRuns({
   *   projectName: "<your_project>",
   *   error: false,
   * });
   *
   * @example
   * // List runs by run ID
   * const runIds = [
   *   "a36092d2-4ad5-4fb4-9c0d-0dba9a2ed836",
   *   "9398e6be-964f-4aa4-8ae9-ad78cd4b7074",
   * ];
   * const selectedRuns = client.listRuns({ run_ids: runIds });
   *
   * @example
   * // List all "chain" type runs that took more than 10 seconds and had `total_tokens` greater than 5000
   * const chainRuns = client.listRuns({
   *   projectName: "<your_project>",
   *   filter: 'and(eq(run_type, "chain"), gt(latency, 10), gt(total_tokens, 5000))',
   * });
   *
   * @example
   * // List all runs called "extractor" whose root of the trace was assigned feedback "user_score" score of 1
   * const goodExtractorRuns = client.listRuns({
   *   projectName: "<your_project>",
   *   filter: 'eq(name, "extractor")',
   *   traceFilter: 'and(eq(feedback_key, "user_score"), eq(feedback_score, 1))',
   * });
   *
   * @example
   * // List all runs that started after a specific timestamp and either have "error" not equal to null or a "Correctness" feedback score equal to 0
   * const complexRuns = client.listRuns({
   *   projectName: "<your_project>",
   *   filter: 'and(gt(start_time, "2023-07-15T12:34:56Z"), or(neq(error, null), and(eq(feedback_key, "Correctness"), eq(feedback_score, 0.0))))',
   * });
   *
   * @example
   * // List all runs where `tags` include "experimental" or "beta" and `latency` is greater than 2 seconds
   * const taggedRuns = client.listRuns({
   *   projectName: "<your_project>",
   *   filter: 'and(or(has(tags, "experimental"), has(tags, "beta")), gt(latency, 2))',
   * });
   */
  public async *listRuns(props: ListRunsParams): AsyncIterable<Run> {
    const {
      projectId,
      projectName,
      parentRunId,
      traceId,
      referenceExampleId,
      startTime,
      executionOrder,
      isRoot,
      runType,
      error,
      id,
      query,
      filter,
      traceFilter,
      treeFilter,
      limit,
      select,
    } = props;
    let projectIds: string[] = [];
    if (projectId) {
      projectIds = Array.isArray(projectId) ? projectId : [projectId];
    }
    if (projectName) {
      const projectNames = Array.isArray(projectName)
        ? projectName
        : [projectName];
      const projectIds_ = await Promise.all(
        projectNames.map((name) =>
          this.readProject({ projectName: name }).then((project) => project.id)
        )
      );
      projectIds.push(...projectIds_);
    }
    const default_select = [
      "app_path",
      "child_run_ids",
      "completion_cost",
      "completion_tokens",
      "dotted_order",
      "end_time",
      "error",
      "events",
      "extra",
      "feedback_stats",
      "first_token_time",
      "id",
      "inputs",
      "name",
      "outputs",
      "parent_run_id",
      "parent_run_ids",
      "prompt_cost",
      "prompt_tokens",
      "reference_example_id",
      "run_type",
      "session_id",
      "start_time",
      "status",
      "tags",
      "total_cost",
      "total_tokens",
      "trace_id",
    ];
    const body = {
      session: projectIds.length ? projectIds : null,
      run_type: runType,
      reference_example: referenceExampleId,
      query,
      filter,
      trace_filter: traceFilter,
      tree_filter: treeFilter,
      execution_order: executionOrder,
      parent_run: parentRunId,
      start_time: startTime ? startTime.toISOString() : null,
      error,
      id,
      limit,
      trace: traceId,
      select: select ? select : default_select,
      is_root: isRoot,
    };

    let runsYielded = 0;
    for await (const runs of this._getCursorPaginatedList<Run>(
      "/runs/query",
      body
    )) {
      if (limit) {
        if (runsYielded >= limit) {
          break;
        }
        if (runs.length + runsYielded > limit) {
          const newRuns = runs.slice(0, limit - runsYielded);
          yield* newRuns;
          break;
        }
        runsYielded += runs.length;
        yield* runs;
      } else {
        yield* runs;
      }
    }
  }

  public async getRunStats({
    id,
    trace,
    parentRun,
    runType,
    projectNames,
    projectIds,
    referenceExampleIds,
    startTime,
    endTime,
    error,
    query,
    filter,
    traceFilter,
    treeFilter,
    isRoot,
    dataSourceType,
  }: {
    id?: string[];
    trace?: string;
    parentRun?: string;
    runType?: string;
    projectNames?: string[];
    projectIds?: string[];
    referenceExampleIds?: string[];
    startTime?: string;
    endTime?: string;
    error?: boolean;
    query?: string;
    filter?: string;
    traceFilter?: string;
    treeFilter?: string;
    isRoot?: boolean;
    dataSourceType?: string;
  }): Promise<any> {
    let projectIds_ = projectIds || [];
    if (projectNames) {
      projectIds_ = [
        ...(projectIds || []),
        ...(await Promise.all(
          projectNames.map((name) =>
            this.readProject({ projectName: name }).then(
              (project) => project.id
            )
          )
        )),
      ];
    }

    const payload = {
      id,
      trace,
      parent_run: parentRun,
      run_type: runType,
      session: projectIds_,
      reference_example: referenceExampleIds,
      start_time: startTime,
      end_time: endTime,
      error,
      query,
      filter,
      trace_filter: traceFilter,
      tree_filter: treeFilter,
      is_root: isRoot,
      data_source_type: dataSourceType,
    };

    // Remove undefined values from the payload
    const filteredPayload = Object.fromEntries(
      Object.entries(payload).filter(([_, value]) => value !== undefined)
    );

    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/runs/stats`,
      {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(filteredPayload),
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );

    const result = await response.json();
    return result;
  }

  public async shareRun(
    runId: string,
    { shareId }: { shareId?: string } = {}
  ): Promise<string> {
    const data = {
      run_id: runId,
      share_token: shareId || uuid.v4(),
    };
    assertUuid(runId);
    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/runs/${runId}/share`,
      {
        method: "PUT",
        headers: this.headers,
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    const result = await response.json();
    if (result === null || !("share_token" in result)) {
      throw new Error("Invalid response from server");
    }
    return `${this.getHostUrl()}/public/${result["share_token"]}/r`;
  }

  public async unshareRun(runId: string): Promise<void> {
    assertUuid(runId);
    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/runs/${runId}/share`,
      {
        method: "DELETE",
        headers: this.headers,
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    await raiseForStatus(response, "unshare run", true);
  }

  public async readRunSharedLink(runId: string): Promise<string | undefined> {
    assertUuid(runId);
    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/runs/${runId}/share`,
      {
        method: "GET",
        headers: this.headers,
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    const result = await response.json();
    if (result === null || !("share_token" in result)) {
      return undefined;
    }
    return `${this.getHostUrl()}/public/${result["share_token"]}/r`;
  }

  public async listSharedRuns(
    shareToken: string,
    {
      runIds,
    }: {
      runIds?: string[];
    } = {}
  ): Promise<Run[]> {
    const queryParams = new URLSearchParams({
      share_token: shareToken,
    });
    if (runIds !== undefined) {
      for (const runId of runIds) {
        queryParams.append("id", runId);
      }
    }
    assertUuid(shareToken);
    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/public/${shareToken}/runs${queryParams}`,
      {
        method: "GET",
        headers: this.headers,
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    const runs = await response.json();
    return runs as Run[];
  }

  public async readDatasetSharedSchema(
    datasetId?: string,
    datasetName?: string
  ): Promise<DatasetShareSchema> {
    if (!datasetId && !datasetName) {
      throw new Error("Either datasetId or datasetName must be given");
    }
    if (!datasetId) {
      const dataset = await this.readDataset({ datasetName });
      datasetId = dataset.id;
    }
    assertUuid(datasetId);
    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/datasets/${datasetId}/share`,
      {
        method: "GET",
        headers: this.headers,
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    const shareSchema = await response.json();
    shareSchema.url = `${this.getHostUrl()}/public/${
      shareSchema.share_token
    }/d`;
    return shareSchema as DatasetShareSchema;
  }

  public async shareDataset(
    datasetId?: string,
    datasetName?: string
  ): Promise<DatasetShareSchema> {
    if (!datasetId && !datasetName) {
      throw new Error("Either datasetId or datasetName must be given");
    }
    if (!datasetId) {
      const dataset = await this.readDataset({ datasetName });
      datasetId = dataset.id;
    }
    const data = {
      dataset_id: datasetId,
    };
    assertUuid(datasetId);
    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/datasets/${datasetId}/share`,
      {
        method: "PUT",
        headers: this.headers,
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    const shareSchema = await response.json();
    shareSchema.url = `${this.getHostUrl()}/public/${
      shareSchema.share_token
    }/d`;
    return shareSchema as DatasetShareSchema;
  }

  public async unshareDataset(datasetId: string): Promise<void> {
    assertUuid(datasetId);
    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/datasets/${datasetId}/share`,
      {
        method: "DELETE",
        headers: this.headers,
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    await raiseForStatus(response, "unshare dataset", true);
  }

  public async readSharedDataset(shareToken: string): Promise<Dataset> {
    assertUuid(shareToken);
    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/public/${shareToken}/datasets`,
      {
        method: "GET",
        headers: this.headers,
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    const dataset = await response.json();
    return dataset as Dataset;
  }

  /**
   * Get shared examples.
   *
   * @param {string} shareToken The share token to get examples for. A share token is the UUID (or LangSmith URL, including UUID) generated when explicitly marking an example as public.
   * @param {Object} [options] Additional options for listing the examples.
   * @param {string[] | undefined} [options.exampleIds] A list of example IDs to filter by.
   * @returns {Promise<Example[]>} The shared examples.
   */
  public async listSharedExamples(
    shareToken: string,
    options?: { exampleIds?: string[] }
  ): Promise<Example[]> {
    const params: Record<string, string | string[]> = {};
    if (options?.exampleIds) {
      params.id = options.exampleIds;
    }

    const urlParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((v) => urlParams.append(key, v));
      } else {
        urlParams.append(key, value);
      }
    });

    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/public/${shareToken}/examples?${urlParams.toString()}`,
      {
        method: "GET",
        headers: this.headers,
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    const result = await response.json();
    if (!response.ok) {
      if ("detail" in result) {
        throw new Error(
          `Failed to list shared examples.\nStatus: ${
            response.status
          }\nMessage: ${result.detail.join("\n")}`
        );
      }
      throw new Error(
        `Failed to list shared examples: ${response.status} ${response.statusText}`
      );
    }
    return result.map((example: any) => ({
      ...example,
      _hostUrl: this.getHostUrl(),
    }));
  }

  public async createProject({
    projectName,
    description = null,
    metadata = null,
    upsert = false,
    projectExtra = null,
    referenceDatasetId = null,
  }: {
    projectName: string;
    description?: string | null;
    metadata?: RecordStringAny | null;
    upsert?: boolean;
    projectExtra?: RecordStringAny | null;
    referenceDatasetId?: string | null;
  }): Promise<TracerSession> {
    const upsert_ = upsert ? `?upsert=true` : "";
    const endpoint = `${this.apiUrl}/sessions${upsert_}`;
    const extra: RecordStringAny = projectExtra || {};
    if (metadata) {
      extra["metadata"] = metadata;
    }
    const body: RecordStringAny = {
      name: projectName,
      extra,
      description,
    };
    if (referenceDatasetId !== null) {
      body["reference_dataset_id"] = referenceDatasetId;
    }
    const response = await this.caller.call(
      _getFetchImplementation(),
      endpoint,
      {
        method: "POST",
        headers: { ...this.headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    await raiseForStatus(response, "create project");
    const result = await response.json();
    return result as TracerSession;
  }

  public async updateProject(
    projectId: string,
    {
      name = null,
      description = null,
      metadata = null,
      projectExtra = null,
      endTime = null,
    }: {
      name?: string | null;
      description?: string | null;
      metadata?: RecordStringAny | null;
      projectExtra?: RecordStringAny | null;
      endTime?: string | null;
    }
  ): Promise<TracerSession> {
    const endpoint = `${this.apiUrl}/sessions/${projectId}`;
    let extra = projectExtra;
    if (metadata) {
      extra = { ...(extra || {}), metadata };
    }
    const body: RecordStringAny = {
      name,
      extra,
      description,
      end_time: endTime ? new Date(endTime).toISOString() : null,
    };
    const response = await this.caller.call(
      _getFetchImplementation(),
      endpoint,
      {
        method: "PATCH",
        headers: { ...this.headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    await raiseForStatus(response, "update project");
    const result = await response.json();
    return result as TracerSession;
  }

  public async hasProject({
    projectId,
    projectName,
  }: {
    projectId?: string;
    projectName?: string;
  }): Promise<boolean> {
    // TODO: Add a head request
    let path = "/sessions";
    const params = new URLSearchParams();
    if (projectId !== undefined && projectName !== undefined) {
      throw new Error("Must provide either projectName or projectId, not both");
    } else if (projectId !== undefined) {
      assertUuid(projectId);
      path += `/${projectId}`;
    } else if (projectName !== undefined) {
      params.append("name", projectName);
    } else {
      throw new Error("Must provide projectName or projectId");
    }
    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}${path}?${params}`,
      {
        method: "GET",
        headers: this.headers,
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    // consume the response body to release the connection
    // https://undici.nodejs.org/#/?id=garbage-collection
    try {
      const result = await response.json();
      if (!response.ok) {
        return false;
      }
      // If it's OK and we're querying by name, need to check the list is not empty
      if (Array.isArray(result)) {
        return result.length > 0;
      }
      // projectId querying
      return true;
    } catch (e) {
      return false;
    }
  }

  public async readProject({
    projectId,
    projectName,
    includeStats,
  }: {
    projectId?: string;
    projectName?: string;
    includeStats?: boolean;
  }): Promise<TracerSessionResult> {
    let path = "/sessions";
    const params = new URLSearchParams();
    if (projectId !== undefined && projectName !== undefined) {
      throw new Error("Must provide either projectName or projectId, not both");
    } else if (projectId !== undefined) {
      assertUuid(projectId);
      path += `/${projectId}`;
    } else if (projectName !== undefined) {
      params.append("name", projectName);
    } else {
      throw new Error("Must provide projectName or projectId");
    }
    if (includeStats !== undefined) {
      params.append("include_stats", includeStats.toString());
    }

    const response = await this._get<TracerSession | TracerSession[]>(
      path,
      params
    );
    let result: TracerSession;
    if (Array.isArray(response)) {
      if (response.length === 0) {
        throw new Error(
          `Project[id=${projectId}, name=${projectName}] not found`
        );
      }
      result = response[0] as TracerSessionResult;
    } else {
      result = response as TracerSessionResult;
    }
    return result;
  }

  public async getProjectUrl({
    projectId,
    projectName,
  }: {
    projectId?: string;
    projectName?: string;
  }) {
    if (projectId === undefined && projectName === undefined) {
      throw new Error("Must provide either projectName or projectId");
    }
    const project = await this.readProject({ projectId, projectName });
    const tenantId = await this._getTenantId();
    return `${this.getHostUrl()}/o/${tenantId}/projects/p/${project.id}`;
  }

  public async getDatasetUrl({
    datasetId,
    datasetName,
  }: {
    datasetId?: string;
    datasetName?: string;
  }) {
    if (datasetId === undefined && datasetName === undefined) {
      throw new Error("Must provide either datasetName or datasetId");
    }
    const dataset = await this.readDataset({ datasetId, datasetName });
    const tenantId = await this._getTenantId();
    return `${this.getHostUrl()}/o/${tenantId}/datasets/${dataset.id}`;
  }

  private async _getTenantId(): Promise<string> {
    if (this._tenantId !== null) {
      return this._tenantId;
    }
    const queryParams = new URLSearchParams({ limit: "1" });
    for await (const projects of this._getPaginated<TracerSession>(
      "/sessions",
      queryParams
    )) {
      this._tenantId = projects[0].tenant_id;
      return projects[0].tenant_id;
    }
    throw new Error("No projects found to resolve tenant.");
  }

  public async *listProjects({
    projectIds,
    name,
    nameContains,
    referenceDatasetId,
    referenceDatasetName,
    referenceFree,
    metadata,
  }: {
    projectIds?: string[];
    name?: string;
    nameContains?: string;
    referenceDatasetId?: string;
    referenceDatasetName?: string;
    referenceFree?: boolean;
    metadata?: RecordStringAny;
  } = {}): AsyncIterable<TracerSession> {
    const params = new URLSearchParams();
    if (projectIds !== undefined) {
      for (const projectId of projectIds) {
        params.append("id", projectId);
      }
    }
    if (name !== undefined) {
      params.append("name", name);
    }
    if (nameContains !== undefined) {
      params.append("name_contains", nameContains);
    }
    if (referenceDatasetId !== undefined) {
      params.append("reference_dataset", referenceDatasetId);
    } else if (referenceDatasetName !== undefined) {
      const dataset = await this.readDataset({
        datasetName: referenceDatasetName,
      });
      params.append("reference_dataset", dataset.id);
    }
    if (referenceFree !== undefined) {
      params.append("reference_free", referenceFree.toString());
    }
    if (metadata !== undefined) {
      params.append("metadata", JSON.stringify(metadata));
    }
    for await (const projects of this._getPaginated<TracerSession>(
      "/sessions",
      params
    )) {
      yield* projects;
    }
  }

  public async deleteProject({
    projectId,
    projectName,
  }: {
    projectId?: string;
    projectName?: string;
  }): Promise<void> {
    let projectId_: string | undefined;
    if (projectId === undefined && projectName === undefined) {
      throw new Error("Must provide projectName or projectId");
    } else if (projectId !== undefined && projectName !== undefined) {
      throw new Error("Must provide either projectName or projectId, not both");
    } else if (projectId === undefined) {
      projectId_ = (await this.readProject({ projectName })).id;
    } else {
      projectId_ = projectId;
    }
    assertUuid(projectId_);
    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/sessions/${projectId_}`,
      {
        method: "DELETE",
        headers: this.headers,
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    await raiseForStatus(
      response,
      `delete session ${projectId_} (${projectName})`,
      true
    );
  }

  public async uploadCsv({
    csvFile,
    fileName,
    inputKeys,
    outputKeys,
    description,
    dataType,
    name,
  }: UploadCSVParams): Promise<Dataset> {
    const url = `${this.apiUrl}/datasets/upload`;
    const formData = new FormData();
    formData.append("file", csvFile, fileName);
    inputKeys.forEach((key) => {
      formData.append("input_keys", key);
    });

    outputKeys.forEach((key) => {
      formData.append("output_keys", key);
    });
    if (description) {
      formData.append("description", description);
    }
    if (dataType) {
      formData.append("data_type", dataType);
    }
    if (name) {
      formData.append("name", name);
    }

    const response = await this.caller.call(_getFetchImplementation(), url, {
      method: "POST",
      headers: this.headers,
      body: formData,
      signal: AbortSignal.timeout(this.timeout_ms),
      ...this.fetchOptions,
    });
    await raiseForStatus(response, "upload CSV");

    const result = await response.json();
    return result as Dataset;
  }

  public async createDataset(
    name: string,
    {
      description,
      dataType,
      inputsSchema,
      outputsSchema,
      metadata,
    }: {
      description?: string;
      dataType?: DataType;
      inputsSchema?: KVMap;
      outputsSchema?: KVMap;
      metadata?: RecordStringAny;
    } = {}
  ): Promise<Dataset> {
    const body: KVMap = {
      name,
      description,
      extra: metadata ? { metadata } : undefined,
    };
    if (dataType) {
      body.data_type = dataType;
    }
    if (inputsSchema) {
      body.inputs_schema_definition = inputsSchema;
    }
    if (outputsSchema) {
      body.outputs_schema_definition = outputsSchema;
    }
    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/datasets`,
      {
        method: "POST",
        headers: { ...this.headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    await raiseForStatus(response, "create dataset");
    const result = await response.json();
    return result as Dataset;
  }

  public async readDataset({
    datasetId,
    datasetName,
  }: {
    datasetId?: string;
    datasetName?: string;
  }): Promise<Dataset> {
    let path = "/datasets";
    // limit to 1 result
    const params = new URLSearchParams({ limit: "1" });
    if (datasetId !== undefined && datasetName !== undefined) {
      throw new Error("Must provide either datasetName or datasetId, not both");
    } else if (datasetId !== undefined) {
      assertUuid(datasetId);
      path += `/${datasetId}`;
    } else if (datasetName !== undefined) {
      params.append("name", datasetName);
    } else {
      throw new Error("Must provide datasetName or datasetId");
    }
    const response = await this._get<Dataset | Dataset[]>(path, params);
    let result: Dataset;
    if (Array.isArray(response)) {
      if (response.length === 0) {
        throw new Error(
          `Dataset[id=${datasetId}, name=${datasetName}] not found`
        );
      }
      result = response[0] as Dataset;
    } else {
      result = response as Dataset;
    }
    return result;
  }

  public async hasDataset({
    datasetId,
    datasetName,
  }: {
    datasetId?: string;
    datasetName?: string;
  }): Promise<boolean> {
    try {
      await this.readDataset({ datasetId, datasetName });
      return true;
    } catch (e) {
      if (
        // eslint-disable-next-line no-instanceof/no-instanceof
        e instanceof Error &&
        e.message.toLocaleLowerCase().includes("not found")
      ) {
        return false;
      }
      throw e;
    }
  }

  public async diffDatasetVersions({
    datasetId,
    datasetName,
    fromVersion,
    toVersion,
  }: {
    datasetId?: string;
    datasetName?: string;
    fromVersion: string | Date;
    toVersion: string | Date;
  }): Promise<DatasetDiffInfo> {
    let datasetId_ = datasetId;
    if (datasetId_ === undefined && datasetName === undefined) {
      throw new Error("Must provide either datasetName or datasetId");
    } else if (datasetId_ !== undefined && datasetName !== undefined) {
      throw new Error("Must provide either datasetName or datasetId, not both");
    } else if (datasetId_ === undefined) {
      const dataset = await this.readDataset({ datasetName });
      datasetId_ = dataset.id;
    }
    const urlParams = new URLSearchParams({
      from_version:
        typeof fromVersion === "string"
          ? fromVersion
          : fromVersion.toISOString(),
      to_version:
        typeof toVersion === "string" ? toVersion : toVersion.toISOString(),
    });
    const response = await this._get<DatasetDiffInfo>(
      `/datasets/${datasetId_}/versions/diff`,
      urlParams
    );
    return response as DatasetDiffInfo;
  }

  public async readDatasetOpenaiFinetuning({
    datasetId,
    datasetName,
  }: {
    datasetId?: string;
    datasetName?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }): Promise<any[]> {
    const path = "/datasets";
    if (datasetId !== undefined) {
      // do nothing
    } else if (datasetName !== undefined) {
      datasetId = (await this.readDataset({ datasetName })).id;
    } else {
      throw new Error("Must provide datasetName or datasetId");
    }
    const response = await this._getResponse(`${path}/${datasetId}/openai_ft`);
    const datasetText = await response.text();
    const dataset = datasetText
      .trim()
      .split("\n")
      .map((line: string) => JSON.parse(line));
    return dataset;
  }

  public async *listDatasets({
    limit = 100,
    offset = 0,
    datasetIds,
    datasetName,
    datasetNameContains,
    metadata,
  }: {
    limit?: number;
    offset?: number;
    datasetIds?: string[];
    datasetName?: string;
    datasetNameContains?: string;
    metadata?: RecordStringAny;
  } = {}): AsyncIterable<Dataset> {
    const path = "/datasets";
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });
    if (datasetIds !== undefined) {
      for (const id_ of datasetIds) {
        params.append("id", id_);
      }
    }
    if (datasetName !== undefined) {
      params.append("name", datasetName);
    }
    if (datasetNameContains !== undefined) {
      params.append("name_contains", datasetNameContains);
    }
    if (metadata !== undefined) {
      params.append("metadata", JSON.stringify(metadata));
    }
    for await (const datasets of this._getPaginated<Dataset>(path, params)) {
      yield* datasets;
    }
  }

  /**
   * Update a dataset
   * @param props The dataset details to update
   * @returns The updated dataset
   */
  public async updateDataset(props: {
    datasetId?: string;
    datasetName?: string;
    name?: string;
    description?: string;
  }): Promise<Dataset> {
    const { datasetId, datasetName, ...update } = props;

    if (!datasetId && !datasetName) {
      throw new Error("Must provide either datasetName or datasetId");
    }
    const _datasetId =
      datasetId ?? (await this.readDataset({ datasetName })).id;
    assertUuid(_datasetId);

    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/datasets/${_datasetId}`,
      {
        method: "PATCH",
        headers: { ...this.headers, "Content-Type": "application/json" },
        body: JSON.stringify(update),
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    await raiseForStatus(response, "update dataset");
    return (await response.json()) as Dataset;
  }

  public async deleteDataset({
    datasetId,
    datasetName,
  }: {
    datasetId?: string;
    datasetName?: string;
  }): Promise<void> {
    let path = "/datasets";
    let datasetId_ = datasetId;
    if (datasetId !== undefined && datasetName !== undefined) {
      throw new Error("Must provide either datasetName or datasetId, not both");
    } else if (datasetName !== undefined) {
      const dataset = await this.readDataset({ datasetName });
      datasetId_ = dataset.id;
    }
    if (datasetId_ !== undefined) {
      assertUuid(datasetId_);
      path += `/${datasetId_}`;
    } else {
      throw new Error("Must provide datasetName or datasetId");
    }
    const response = await this.caller.call(
      _getFetchImplementation(),
      this.apiUrl + path,
      {
        method: "DELETE",
        headers: this.headers,
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    await raiseForStatus(response, `delete ${path}`);

    await response.json();
  }

  public async indexDataset({
    datasetId,
    datasetName,
    tag,
  }: {
    datasetId?: string;
    datasetName?: string;
    tag?: string;
  }): Promise<void> {
    let datasetId_ = datasetId;
    if (!datasetId_ && !datasetName) {
      throw new Error("Must provide either datasetName or datasetId");
    } else if (datasetId_ && datasetName) {
      throw new Error("Must provide either datasetName or datasetId, not both");
    } else if (!datasetId_) {
      const dataset = await this.readDataset({ datasetName });
      datasetId_ = dataset.id;
    }
    assertUuid(datasetId_);

    const data = {
      tag: tag,
    };
    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/datasets/${datasetId_}/index`,
      {
        method: "POST",
        headers: { ...this.headers, "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    await raiseForStatus(response, "index dataset");
    await response.json();
  }

  /**
   * Lets you run a similarity search query on a dataset.
   *
   * Requires the dataset to be indexed. Please see the `indexDataset` method to set up indexing.
   *
   * @param inputs      The input on which to run the similarity search. Must have the
   *                    same schema as the dataset.
   *
   * @param datasetId   The dataset to search for similar examples.
   *
   * @param limit       The maximum number of examples to return. Will return the top `limit` most
   *                    similar examples in order of most similar to least similar. If no similar
   *                    examples are found, random examples will be returned.
   *
   * @param filter      A filter string to apply to the search. Only examples will be returned that
   *                    match the filter string. Some examples of filters
   *
   *                    - eq(metadata.mykey, "value")
   *                    - and(neq(metadata.my.nested.key, "value"), neq(metadata.mykey, "value"))
   *                    - or(eq(metadata.mykey, "value"), eq(metadata.mykey, "othervalue"))
   *
   * @returns           A list of similar examples.
   *
   *
   * @example
   * dataset_id = "123e4567-e89b-12d3-a456-426614174000"
   * inputs = {"text": "How many people live in Berlin?"}
   * limit = 5
   * examples = await client.similarExamples(inputs, dataset_id, limit)
   */
  public async similarExamples(
    inputs: KVMap,
    datasetId: string,
    limit: number,
    {
      filter,
    }: {
      filter?: string;
    } = {}
  ): Promise<ExampleSearch[]> {
    const data: KVMap = {
      limit: limit,
      inputs: inputs,
    };

    if (filter !== undefined) {
      data["filter"] = filter;
    }

    assertUuid(datasetId);
    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/datasets/${datasetId}/search`,
      {
        method: "POST",
        headers: { ...this.headers, "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    await raiseForStatus(response, "fetch similar examples");
    const result = await response.json();
    return result["examples"] as ExampleSearch[];
  }

  public async createExample(
    inputs: KVMap,
    outputs: KVMap,
    {
      datasetId,
      datasetName,
      createdAt,
      exampleId,
      metadata,
      split,
      sourceRunId,
    }: CreateExampleOptions
  ): Promise<Example> {
    let datasetId_ = datasetId;
    if (datasetId_ === undefined && datasetName === undefined) {
      throw new Error("Must provide either datasetName or datasetId");
    } else if (datasetId_ !== undefined && datasetName !== undefined) {
      throw new Error("Must provide either datasetName or datasetId, not both");
    } else if (datasetId_ === undefined) {
      const dataset = await this.readDataset({ datasetName });
      datasetId_ = dataset.id;
    }

    const createdAt_ = createdAt || new Date();
    const data: ExampleCreate = {
      dataset_id: datasetId_,
      inputs,
      outputs,
      created_at: createdAt_?.toISOString(),
      id: exampleId,
      metadata,
      split,
      source_run_id: sourceRunId,
    };

    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/examples`,
      {
        method: "POST",
        headers: { ...this.headers, "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );

    await raiseForStatus(response, "create example");
    const result = await response.json();
    return result as Example;
  }

  public async createExamples(props: {
    inputs: Array<KVMap>;
    outputs?: Array<KVMap>;
    metadata?: Array<KVMap>;
    splits?: Array<string | Array<string>>;
    sourceRunIds?: Array<string>;
    exampleIds?: Array<string>;
    datasetId?: string;
    datasetName?: string;
  }): Promise<Example[]> {
    const {
      inputs,
      outputs,
      metadata,
      sourceRunIds,
      exampleIds,
      datasetId,
      datasetName,
    } = props;
    let datasetId_ = datasetId;
    if (datasetId_ === undefined && datasetName === undefined) {
      throw new Error("Must provide either datasetName or datasetId");
    } else if (datasetId_ !== undefined && datasetName !== undefined) {
      throw new Error("Must provide either datasetName or datasetId, not both");
    } else if (datasetId_ === undefined) {
      const dataset = await this.readDataset({ datasetName });
      datasetId_ = dataset.id;
    }

    const formattedExamples = inputs.map((input, idx) => {
      return {
        dataset_id: datasetId_,
        inputs: input,
        outputs: outputs ? outputs[idx] : undefined,
        metadata: metadata ? metadata[idx] : undefined,
        split: props.splits ? props.splits[idx] : undefined,
        id: exampleIds ? exampleIds[idx] : undefined,
        source_run_id: sourceRunIds ? sourceRunIds[idx] : undefined,
      };
    });

    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/examples/bulk`,
      {
        method: "POST",
        headers: { ...this.headers, "Content-Type": "application/json" },
        body: JSON.stringify(formattedExamples),
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    await raiseForStatus(response, "create examples");
    const result = await response.json();
    return result as Example[];
  }

  public async createLLMExample(
    input: string,
    generation: string | undefined,
    options: CreateExampleOptions
  ) {
    return this.createExample({ input }, { output: generation }, options);
  }

  public async createChatExample(
    input: KVMap[] | LangChainBaseMessage[],
    generations: KVMap | LangChainBaseMessage | undefined,
    options: CreateExampleOptions
  ) {
    const finalInput = input.map((message) => {
      if (isLangChainMessage(message)) {
        return convertLangChainMessageToExample(message);
      }
      return message;
    });
    const finalOutput = isLangChainMessage(generations)
      ? convertLangChainMessageToExample(generations)
      : generations;
    return this.createExample(
      { input: finalInput },
      { output: finalOutput },
      options
    );
  }

  public async readExample(exampleId: string): Promise<Example> {
    assertUuid(exampleId);
    const path = `/examples/${exampleId}`;
    const rawExample: RawExample = await this._get(path);
    const { attachment_urls, ...rest } = rawExample;
    const example: Example = rest;
    if (attachment_urls) {
      // add attachments back to the example
      example.attachments = Object.entries(attachment_urls).reduce(
        (acc, [key, value]) => {
          acc[key.slice("attachment.".length)] = {
            presigned_url: value.presigned_url,
          };
          return acc;
        },
        {} as Record<string, AttachmentInfo>
      );
    }
    return example;
  }

  public async *listExamples({
    datasetId,
    datasetName,
    exampleIds,
    asOf,
    splits,
    inlineS3Urls,
    metadata,
    limit,
    offset,
    filter,
    includeAttachments,
  }: {
    datasetId?: string;
    datasetName?: string;
    exampleIds?: string[];
    asOf?: string | Date;
    splits?: string[];
    inlineS3Urls?: boolean;
    metadata?: KVMap;
    limit?: number;
    offset?: number;
    filter?: string;
    includeAttachments?: boolean;
  } = {}): AsyncIterable<Example> {
    let datasetId_;
    if (datasetId !== undefined && datasetName !== undefined) {
      throw new Error("Must provide either datasetName or datasetId, not both");
    } else if (datasetId !== undefined) {
      datasetId_ = datasetId;
    } else if (datasetName !== undefined) {
      const dataset = await this.readDataset({ datasetName });
      datasetId_ = dataset.id;
    } else {
      throw new Error("Must provide a datasetName or datasetId");
    }
    const params = new URLSearchParams({ dataset: datasetId_ });
    const dataset_version = asOf
      ? typeof asOf === "string"
        ? asOf
        : asOf?.toISOString()
      : undefined;
    if (dataset_version) {
      params.append("as_of", dataset_version);
    }
    const inlineS3Urls_ = inlineS3Urls ?? true;
    params.append("inline_s3_urls", inlineS3Urls_.toString());
    if (exampleIds !== undefined) {
      for (const id_ of exampleIds) {
        params.append("id", id_);
      }
    }
    if (splits !== undefined) {
      for (const split of splits) {
        params.append("splits", split);
      }
    }
    if (metadata !== undefined) {
      const serializedMetadata = JSON.stringify(metadata);
      params.append("metadata", serializedMetadata);
    }
    if (limit !== undefined) {
      params.append("limit", limit.toString());
    }
    if (offset !== undefined) {
      params.append("offset", offset.toString());
    }
    if (filter !== undefined) {
      params.append("filter", filter);
    }
    if (includeAttachments === true) {
      ["attachment_urls", "outputs", "metadata"].forEach((field) =>
        params.append("select", field)
      );
    }
    let i = 0;
    for await (const rawExamples of this._getPaginated<RawExample>(
      "/examples",
      params
    )) {
      for (const rawExample of rawExamples) {
        const { attachment_urls, ...rest } = rawExample;
        const example: Example = rest;
        if (attachment_urls) {
          example.attachments = Object.entries(attachment_urls).reduce(
            (acc, [key, value]) => {
              acc[key.slice("attachment.".length)] = {
                presigned_url: value.presigned_url,
              };
              return acc;
            },
            {} as Record<string, AttachmentInfo>
          );
        }
        yield example;
        i++;
      }
      if (limit !== undefined && i >= limit) {
        break;
      }
    }
  }

  public async deleteExample(exampleId: string): Promise<void> {
    assertUuid(exampleId);
    const path = `/examples/${exampleId}`;
    const response = await this.caller.call(
      _getFetchImplementation(),
      this.apiUrl + path,
      {
        method: "DELETE",
        headers: this.headers,
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    await raiseForStatus(response, `delete ${path}`);
    await response.json();
  }

  public async updateExample(
    exampleId: string,
    update: ExampleUpdate
  ): Promise<object> {
    assertUuid(exampleId);
    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/examples/${exampleId}`,
      {
        method: "PATCH",
        headers: { ...this.headers, "Content-Type": "application/json" },
        body: JSON.stringify(update),
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    await raiseForStatus(response, "update example");
    const result = await response.json();
    return result;
  }

  public async updateExamples(update: ExampleUpdateWithId[]): Promise<object> {
    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/examples/bulk`,
      {
        method: "PATCH",
        headers: { ...this.headers, "Content-Type": "application/json" },
        body: JSON.stringify(update),
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    await raiseForStatus(response, "update examples");
    const result = await response.json();
    return result;
  }

  public async listDatasetSplits({
    datasetId,
    datasetName,
    asOf,
  }: {
    datasetId?: string;
    datasetName?: string;
    asOf?: string | Date;
  }): Promise<string[]> {
    let datasetId_: string;
    if (datasetId === undefined && datasetName === undefined) {
      throw new Error("Must provide dataset name or ID");
    } else if (datasetId !== undefined && datasetName !== undefined) {
      throw new Error("Must provide either datasetName or datasetId, not both");
    } else if (datasetId === undefined) {
      const dataset = await this.readDataset({ datasetName });
      datasetId_ = dataset.id;
    } else {
      datasetId_ = datasetId;
    }

    assertUuid(datasetId_);

    const params = new URLSearchParams();
    const dataset_version = asOf
      ? typeof asOf === "string"
        ? asOf
        : asOf?.toISOString()
      : undefined;
    if (dataset_version) {
      params.append("as_of", dataset_version);
    }

    const response = await this._get<string[]>(
      `/datasets/${datasetId_}/splits`,
      params
    );
    return response;
  }

  public async updateDatasetSplits({
    datasetId,
    datasetName,
    splitName,
    exampleIds,
    remove = false,
  }: {
    datasetId?: string;
    datasetName?: string;
    splitName: string;
    exampleIds: string[];
    remove?: boolean;
  }): Promise<void> {
    let datasetId_: string;
    if (datasetId === undefined && datasetName === undefined) {
      throw new Error("Must provide dataset name or ID");
    } else if (datasetId !== undefined && datasetName !== undefined) {
      throw new Error("Must provide either datasetName or datasetId, not both");
    } else if (datasetId === undefined) {
      const dataset = await this.readDataset({ datasetName });
      datasetId_ = dataset.id;
    } else {
      datasetId_ = datasetId;
    }

    assertUuid(datasetId_);

    const data = {
      split_name: splitName,
      examples: exampleIds.map((id) => {
        assertUuid(id);
        return id;
      }),
      remove,
    };

    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/datasets/${datasetId_}/splits`,
      {
        method: "PUT",
        headers: { ...this.headers, "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );

    await raiseForStatus(response, "update dataset splits", true);
  }

  /**
   * @deprecated This method is deprecated and will be removed in future LangSmith versions, use `evaluate` from `langsmith/evaluation` instead.
   */
  public async evaluateRun(
    run: Run | string,
    evaluator: RunEvaluator,
    {
      sourceInfo,
      loadChildRuns,
      referenceExample,
    }: {
      sourceInfo?: KVMap;
      loadChildRuns: boolean;
      referenceExample?: Example;
    } = { loadChildRuns: false }
  ): Promise<Feedback> {
    warnOnce(
      "This method is deprecated and will be removed in future LangSmith versions, use `evaluate` from `langsmith/evaluation` instead."
    );
    let run_: Run;
    if (typeof run === "string") {
      run_ = await this.readRun(run, { loadChildRuns });
    } else if (typeof run === "object" && "id" in run) {
      run_ = run as Run;
    } else {
      throw new Error(`Invalid run type: ${typeof run}`);
    }
    if (
      run_.reference_example_id !== null &&
      run_.reference_example_id !== undefined
    ) {
      referenceExample = await this.readExample(run_.reference_example_id);
    }

    const feedbackResult = await evaluator.evaluateRun(run_, referenceExample);
    const [_, feedbacks] = await this._logEvaluationFeedback(
      feedbackResult,
      run_,
      sourceInfo
    );

    return feedbacks[0];
  }

  public async createFeedback(
    runId: string | null,
    key: string,
    {
      score,
      value,
      correction,
      comment,
      sourceInfo,
      feedbackSourceType = "api",
      sourceRunId,
      feedbackId,
      feedbackConfig,
      projectId,
      comparativeExperimentId,
    }: {
      score?: ScoreType;
      value?: ValueType;
      correction?: object;
      comment?: string;
      sourceInfo?: object;
      feedbackSourceType?: FeedbackSourceType;
      feedbackConfig?: FeedbackConfig;
      sourceRunId?: string;
      feedbackId?: string;
      eager?: boolean;
      projectId?: string;
      comparativeExperimentId?: string;
    }
  ): Promise<Feedback> {
    if (!runId && !projectId) {
      throw new Error("One of runId or projectId must be provided");
    }
    if (runId && projectId) {
      throw new Error("Only one of runId or projectId can be provided");
    }
    const feedback_source: feedback_source = {
      type: feedbackSourceType ?? "api",
      metadata: sourceInfo ?? {},
    };
    if (
      sourceRunId !== undefined &&
      feedback_source?.metadata !== undefined &&
      !feedback_source.metadata["__run"]
    ) {
      feedback_source.metadata["__run"] = { run_id: sourceRunId };
    }
    if (
      feedback_source?.metadata !== undefined &&
      feedback_source.metadata["__run"]?.run_id !== undefined
    ) {
      assertUuid(feedback_source.metadata["__run"].run_id);
    }
    const feedback: FeedbackCreate = {
      id: feedbackId ?? uuid.v4(),
      run_id: runId,
      key,
      score,
      value,
      correction,
      comment,
      feedback_source: feedback_source,
      comparative_experiment_id: comparativeExperimentId,
      feedbackConfig,
      session_id: projectId,
    };
    const url = `${this.apiUrl}/feedback`;
    const response = await this.caller.call(_getFetchImplementation(), url, {
      method: "POST",
      headers: { ...this.headers, "Content-Type": "application/json" },
      body: JSON.stringify(feedback),
      signal: AbortSignal.timeout(this.timeout_ms),
      ...this.fetchOptions,
    });
    await raiseForStatus(response, "create feedback", true);
    return feedback as Feedback;
  }

  public async updateFeedback(
    feedbackId: string,
    {
      score,
      value,
      correction,
      comment,
    }: {
      score?: number | boolean | null;
      value?: number | boolean | string | object | null;
      correction?: object | null;
      comment?: string | null;
    }
  ): Promise<void> {
    const feedbackUpdate: FeedbackUpdate = {};
    if (score !== undefined && score !== null) {
      feedbackUpdate["score"] = score;
    }
    if (value !== undefined && value !== null) {
      feedbackUpdate["value"] = value;
    }
    if (correction !== undefined && correction !== null) {
      feedbackUpdate["correction"] = correction;
    }
    if (comment !== undefined && comment !== null) {
      feedbackUpdate["comment"] = comment;
    }
    assertUuid(feedbackId);
    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/feedback/${feedbackId}`,
      {
        method: "PATCH",
        headers: { ...this.headers, "Content-Type": "application/json" },
        body: JSON.stringify(feedbackUpdate),
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    await raiseForStatus(response, "update feedback", true);
  }

  public async readFeedback(feedbackId: string): Promise<Feedback> {
    assertUuid(feedbackId);
    const path = `/feedback/${feedbackId}`;
    const response = await this._get<Feedback>(path);
    return response;
  }

  public async deleteFeedback(feedbackId: string): Promise<void> {
    assertUuid(feedbackId);
    const path = `/feedback/${feedbackId}`;
    const response = await this.caller.call(
      _getFetchImplementation(),
      this.apiUrl + path,
      {
        method: "DELETE",
        headers: this.headers,
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    await raiseForStatus(response, `delete ${path}`);
    await response.json();
  }

  public async *listFeedback({
    runIds,
    feedbackKeys,
    feedbackSourceTypes,
  }: {
    runIds?: string[];
    feedbackKeys?: string[];
    feedbackSourceTypes?: FeedbackSourceType[];
  } = {}): AsyncIterable<Feedback> {
    const queryParams = new URLSearchParams();
    if (runIds) {
      queryParams.append("run", runIds.join(","));
    }
    if (feedbackKeys) {
      for (const key of feedbackKeys) {
        queryParams.append("key", key);
      }
    }
    if (feedbackSourceTypes) {
      for (const type of feedbackSourceTypes) {
        queryParams.append("source", type);
      }
    }
    for await (const feedbacks of this._getPaginated<Feedback>(
      "/feedback",
      queryParams
    )) {
      yield* feedbacks;
    }
  }

  /**
   * Creates a presigned feedback token and URL.
   *
   * The token can be used to authorize feedback metrics without
   * needing an API key. This is useful for giving browser-based
   * applications the ability to submit feedback without needing
   * to expose an API key.
   *
   * @param runId - The ID of the run.
   * @param feedbackKey - The feedback key.
   * @param options - Additional options for the token.
   * @param options.expiration - The expiration time for the token.
   *
   * @returns A promise that resolves to a FeedbackIngestToken.
   */
  public async createPresignedFeedbackToken(
    runId: string,
    feedbackKey: string,
    {
      expiration,
      feedbackConfig,
    }: {
      expiration?: string | TimeDelta;
      feedbackConfig?: FeedbackConfig;
    } = {}
  ): Promise<FeedbackIngestToken> {
    const body: KVMap = {
      run_id: runId,
      feedback_key: feedbackKey,
      feedback_config: feedbackConfig,
    };
    if (expiration) {
      if (typeof expiration === "string") {
        body["expires_at"] = expiration;
      } else if (expiration?.hours || expiration?.minutes || expiration?.days) {
        body["expires_in"] = expiration;
      }
    } else {
      body["expires_in"] = {
        hours: 3,
      };
    }

    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/feedback/tokens`,
      {
        method: "POST",
        headers: { ...this.headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    const result = await response.json();
    return result as FeedbackIngestToken;
  }

  public async createComparativeExperiment({
    name,
    experimentIds,
    referenceDatasetId,
    createdAt,
    description,
    metadata,
    id,
  }: {
    name: string;
    experimentIds: Array<string>;
    referenceDatasetId?: string;
    createdAt?: Date;
    description?: string;
    metadata?: Record<string, unknown>;
    id?: string;
  }): Promise<ComparativeExperiment> {
    if (experimentIds.length === 0) {
      throw new Error("At least one experiment is required");
    }

    if (!referenceDatasetId) {
      referenceDatasetId = (
        await this.readProject({
          projectId: experimentIds[0],
        })
      ).reference_dataset_id;
    }

    if (!referenceDatasetId == null) {
      throw new Error("A reference dataset is required");
    }

    const body = {
      id,
      name,
      experiment_ids: experimentIds,
      reference_dataset_id: referenceDatasetId,
      description,
      created_at: (createdAt ?? new Date())?.toISOString(),
      extra: {} as Record<string, unknown>,
    };

    if (metadata) body.extra["metadata"] = metadata;

    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/datasets/comparative`,
      {
        method: "POST",
        headers: { ...this.headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    return await response.json();
  }

  /**
   * Retrieves a list of presigned feedback tokens for a given run ID.
   * @param runId The ID of the run.
   * @returns An async iterable of FeedbackIngestToken objects.
   */
  public async *listPresignedFeedbackTokens(
    runId: string
  ): AsyncIterable<FeedbackIngestToken> {
    assertUuid(runId);
    const params = new URLSearchParams({ run_id: runId });
    for await (const tokens of this._getPaginated<FeedbackIngestToken>(
      "/feedback/tokens",
      params
    )) {
      yield* tokens;
    }
  }

  _selectEvalResults(
    results: EvaluationResult | EvaluationResults
  ): Array<EvaluationResult> {
    let results_: Array<EvaluationResult>;
    if ("results" in results) {
      results_ = results.results;
    } else {
      results_ = [results];
    }
    return results_;
  }

  async _logEvaluationFeedback(
    evaluatorResponse: EvaluationResult | EvaluationResults,
    run?: Run,
    sourceInfo?: { [key: string]: any }
  ): Promise<[results: EvaluationResult[], feedbacks: Feedback[]]> {
    const evalResults: Array<EvaluationResult> =
      this._selectEvalResults(evaluatorResponse);

    const feedbacks: Feedback[] = [];

    for (const res of evalResults) {
      let sourceInfo_ = sourceInfo || {};
      if (res.evaluatorInfo) {
        sourceInfo_ = { ...res.evaluatorInfo, ...sourceInfo_ };
      }
      let runId_: string | null = null;
      if (res.targetRunId) {
        runId_ = res.targetRunId;
      } else if (run) {
        runId_ = run.id;
      }

      feedbacks.push(
        await this.createFeedback(runId_, res.key, {
          score: res.score,
          value: res.value,
          comment: res.comment,
          correction: res.correction,
          sourceInfo: sourceInfo_,
          sourceRunId: res.sourceRunId,
          feedbackConfig: res.feedbackConfig as FeedbackConfig | undefined,
          feedbackSourceType: "model",
        })
      );
    }

    return [evalResults, feedbacks];
  }

  public async logEvaluationFeedback(
    evaluatorResponse: EvaluationResult | EvaluationResults,
    run?: Run,
    sourceInfo?: { [key: string]: any }
  ): Promise<EvaluationResult[]> {
    const [results] = await this._logEvaluationFeedback(
      evaluatorResponse,
      run,
      sourceInfo
    );
    return results;
  }

  /**
   * API for managing annotation queues
   */

  /**
   * List the annotation queues on the LangSmith API.
   * @param options - The options for listing annotation queues
   * @param options.queueIds - The IDs of the queues to filter by
   * @param options.name - The name of the queue to filter by
   * @param options.nameContains - The substring that the queue name should contain
   * @param options.limit - The maximum number of queues to return
   * @returns An iterator of AnnotationQueue objects
   */
  public async *listAnnotationQueues(
    options: {
      queueIds?: string[];
      name?: string;
      nameContains?: string;
      limit?: number;
    } = {}
  ): AsyncIterableIterator<AnnotationQueue> {
    const { queueIds, name, nameContains, limit } = options;
    const params = new URLSearchParams();
    if (queueIds) {
      queueIds.forEach((id, i) => {
        assertUuid(id, `queueIds[${i}]`);
        params.append("ids", id);
      });
    }
    if (name) params.append("name", name);
    if (nameContains) params.append("name_contains", nameContains);
    params.append(
      "limit",
      (limit !== undefined ? Math.min(limit, 100) : 100).toString()
    );

    let count = 0;
    for await (const queues of this._getPaginated<AnnotationQueue>(
      "/annotation-queues",
      params
    )) {
      yield* queues;
      count++;
      if (limit !== undefined && count >= limit) break;
    }
  }

  /**
   * Create an annotation queue on the LangSmith API.
   * @param options - The options for creating an annotation queue
   * @param options.name - The name of the annotation queue
   * @param options.description - The description of the annotation queue
   * @param options.queueId - The ID of the annotation queue
   * @returns The created AnnotationQueue object
   */
  public async createAnnotationQueue(options: {
    name: string;
    description?: string;
    queueId?: string;
  }): Promise<AnnotationQueue> {
    const { name, description, queueId } = options;
    const body = {
      name,
      description,
      id: queueId || uuid.v4(),
    };

    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/annotation-queues`,
      {
        method: "POST",
        headers: { ...this.headers, "Content-Type": "application/json" },
        body: JSON.stringify(
          Object.fromEntries(
            Object.entries(body).filter(([_, v]) => v !== undefined)
          )
        ),
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    await raiseForStatus(response, "create annotation queue");
    const data = await response.json();
    return data as AnnotationQueue;
  }

  /**
   * Read an annotation queue with the specified queue ID.
   * @param queueId - The ID of the annotation queue to read
   * @returns The AnnotationQueue object
   */
  public async readAnnotationQueue(queueId: string): Promise<AnnotationQueue> {
    // TODO: Replace when actual endpoint is added
    const queueIteratorResult = await this.listAnnotationQueues({
      queueIds: [queueId],
    }).next();
    if (queueIteratorResult.done) {
      throw new Error(`Annotation queue with ID ${queueId} not found`);
    }
    return queueIteratorResult.value;
  }

  /**
   * Update an annotation queue with the specified queue ID.
   * @param queueId - The ID of the annotation queue to update
   * @param options - The options for updating the annotation queue
   * @param options.name - The new name for the annotation queue
   * @param options.description - The new description for the annotation queue
   */
  public async updateAnnotationQueue(
    queueId: string,
    options: {
      name: string;
      description?: string;
    }
  ): Promise<void> {
    const { name, description } = options;
    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/annotation-queues/${assertUuid(queueId, "queueId")}`,
      {
        method: "PATCH",
        headers: { ...this.headers, "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    await raiseForStatus(response, "update annotation queue");
  }

  /**
   * Delete an annotation queue with the specified queue ID.
   * @param queueId - The ID of the annotation queue to delete
   */
  public async deleteAnnotationQueue(queueId: string): Promise<void> {
    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/annotation-queues/${assertUuid(queueId, "queueId")}`,
      {
        method: "DELETE",
        headers: { ...this.headers, Accept: "application/json" },
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    await raiseForStatus(response, "delete annotation queue");
  }

  /**
   * Add runs to an annotation queue with the specified queue ID.
   * @param queueId - The ID of the annotation queue
   * @param runIds - The IDs of the runs to be added to the annotation queue
   */
  public async addRunsToAnnotationQueue(
    queueId: string,
    runIds: string[]
  ): Promise<void> {
    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/annotation-queues/${assertUuid(queueId, "queueId")}/runs`,
      {
        method: "POST",
        headers: { ...this.headers, "Content-Type": "application/json" },
        body: JSON.stringify(
          runIds.map((id, i) => assertUuid(id, `runIds[${i}]`).toString())
        ),
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    await raiseForStatus(response, "add runs to annotation queue");
  }

  /**
   * Get a run from an annotation queue at the specified index.
   * @param queueId - The ID of the annotation queue
   * @param index - The index of the run to retrieve
   * @returns A Promise that resolves to a RunWithAnnotationQueueInfo object
   * @throws {Error} If the run is not found at the given index or for other API-related errors
   */
  public async getRunFromAnnotationQueue(
    queueId: string,
    index: number
  ): Promise<RunWithAnnotationQueueInfo> {
    const baseUrl = `/annotation-queues/${assertUuid(queueId, "queueId")}/run`;
    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}${baseUrl}/${index}`,
      {
        method: "GET",
        headers: this.headers,
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );

    await raiseForStatus(response, "get run from annotation queue");
    return await response.json();
  }

  protected async _currentTenantIsOwner(owner: string): Promise<boolean> {
    const settings = await this._getSettings();
    return owner == "-" || settings.tenant_handle === owner;
  }

  protected async _ownerConflictError(
    action: string,
    owner: string
  ): Promise<Error> {
    const settings = await this._getSettings();
    return new Error(
      `Cannot ${action} for another tenant.\n
      Current tenant: ${settings.tenant_handle}\n
      Requested tenant: ${owner}`
    );
  }

  protected async _getLatestCommitHash(
    promptOwnerAndName: string
  ): Promise<string | undefined> {
    const res = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/commits/${promptOwnerAndName}/?limit=${1}&offset=${0}`,
      {
        method: "GET",
        headers: this.headers,
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );

    const json = await res.json();
    if (!res.ok) {
      const detail =
        typeof json.detail === "string"
          ? json.detail
          : JSON.stringify(json.detail);
      const error = new Error(
        `Error ${res.status}: ${res.statusText}\n${detail}`
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error as any).statusCode = res.status;
      throw error;
    }

    if (json.commits.length === 0) {
      return undefined;
    }

    return json.commits[0].commit_hash;
  }

  protected async _likeOrUnlikePrompt(
    promptIdentifier: string,
    like: boolean
  ): Promise<LikePromptResponse> {
    const [owner, promptName, _] = parsePromptIdentifier(promptIdentifier);
    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/likes/${owner}/${promptName}`,
      {
        method: "POST",
        body: JSON.stringify({ like: like }),
        headers: { ...this.headers, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );
    await raiseForStatus(response, `${like ? "like" : "unlike"} prompt`);

    return await response.json();
  }

  protected async _getPromptUrl(promptIdentifier: string): Promise<string> {
    const [owner, promptName, commitHash] =
      parsePromptIdentifier(promptIdentifier);
    if (!(await this._currentTenantIsOwner(owner))) {
      if (commitHash !== "latest") {
        return `${this.getHostUrl()}/hub/${owner}/${promptName}/${commitHash.substring(
          0,
          8
        )}`;
      } else {
        return `${this.getHostUrl()}/hub/${owner}/${promptName}`;
      }
    } else {
      const settings = await this._getSettings();
      if (commitHash !== "latest") {
        return `${this.getHostUrl()}/prompts/${promptName}/${commitHash.substring(
          0,
          8
        )}?organizationId=${settings.id}`;
      } else {
        return `${this.getHostUrl()}/prompts/${promptName}?organizationId=${
          settings.id
        }`;
      }
    }
  }

  public async promptExists(promptIdentifier: string): Promise<boolean> {
    const prompt = await this.getPrompt(promptIdentifier);
    return !!prompt;
  }

  public async likePrompt(
    promptIdentifier: string
  ): Promise<LikePromptResponse> {
    return this._likeOrUnlikePrompt(promptIdentifier, true);
  }

  public async unlikePrompt(
    promptIdentifier: string
  ): Promise<LikePromptResponse> {
    return this._likeOrUnlikePrompt(promptIdentifier, false);
  }

  public async *listCommits(
    promptOwnerAndName: string
  ): AsyncIterableIterator<PromptCommit> {
    for await (const commits of this._getPaginated<
      PromptCommit,
      ListCommitsResponse
    >(
      `/commits/${promptOwnerAndName}/`,
      new URLSearchParams(),
      (res) => res.commits
    )) {
      yield* commits;
    }
  }

  public async *listPrompts(options?: {
    isPublic?: boolean;
    isArchived?: boolean;
    sortField?: PromptSortField;
    query?: string;
  }): AsyncIterableIterator<Prompt> {
    const params = new URLSearchParams();
    params.append("sort_field", options?.sortField ?? "updated_at");
    params.append("sort_direction", "desc");
    params.append("is_archived", (!!options?.isArchived).toString());

    if (options?.isPublic !== undefined) {
      params.append("is_public", options.isPublic.toString());
    }

    if (options?.query) {
      params.append("query", options.query);
    }

    for await (const prompts of this._getPaginated<Prompt, ListPromptsResponse>(
      "/repos",
      params,
      (res) => res.repos
    )) {
      yield* prompts;
    }
  }

  public async getPrompt(promptIdentifier: string): Promise<Prompt | null> {
    const [owner, promptName, _] = parsePromptIdentifier(promptIdentifier);
    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/repos/${owner}/${promptName}`,
      {
        method: "GET",
        headers: this.headers,
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );

    if (response.status === 404) {
      return null;
    }
    await raiseForStatus(response, "get prompt");

    const result = await response.json();
    if (result.repo) {
      return result.repo as Prompt;
    } else {
      return null;
    }
  }

  public async createPrompt(
    promptIdentifier: string,
    options?: {
      description?: string;
      readme?: string;
      tags?: string[];
      isPublic?: boolean;
    }
  ): Promise<Prompt> {
    const settings = await this._getSettings();
    if (options?.isPublic && !settings.tenant_handle) {
      throw new Error(
        `Cannot create a public prompt without first\n
        creating a LangChain Hub handle.
        You can add a handle by creating a public prompt at:\n
        https://smith.langchain.com/prompts`
      );
    }

    const [owner, promptName, _] = parsePromptIdentifier(promptIdentifier);
    if (!(await this._currentTenantIsOwner(owner))) {
      throw await this._ownerConflictError("create a prompt", owner);
    }

    const data = {
      repo_handle: promptName,
      ...(options?.description && { description: options.description }),
      ...(options?.readme && { readme: options.readme }),
      ...(options?.tags && { tags: options.tags }),
      is_public: !!options?.isPublic,
    };

    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/repos/`,
      {
        method: "POST",
        headers: { ...this.headers, "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );

    await raiseForStatus(response, "create prompt");

    const { repo } = await response.json();
    return repo as Prompt;
  }

  public async createCommit(
    promptIdentifier: string,
    object: any,
    options?: {
      parentCommitHash?: string;
    }
  ): Promise<string> {
    if (!(await this.promptExists(promptIdentifier))) {
      throw new Error("Prompt does not exist, you must create it first.");
    }

    const [owner, promptName, _] = parsePromptIdentifier(promptIdentifier);
    const resolvedParentCommitHash =
      options?.parentCommitHash === "latest" || !options?.parentCommitHash
        ? await this._getLatestCommitHash(`${owner}/${promptName}`)
        : options?.parentCommitHash;

    const payload = {
      manifest: JSON.parse(JSON.stringify(object)),
      parent_commit: resolvedParentCommitHash,
    };

    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/commits/${owner}/${promptName}`,
      {
        method: "POST",
        headers: { ...this.headers, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );

    await raiseForStatus(response, "create commit");

    const result = await response.json();
    return this._getPromptUrl(
      `${owner}/${promptName}${
        result.commit_hash ? `:${result.commit_hash}` : ""
      }`
    );
  }

  /**
   * Update examples with attachments using multipart form data.
   * @param updates List of ExampleUpdateWithAttachments objects to upsert
   * @returns Promise with the update response
   */
  public async updateExamplesMultipart(
    datasetId: string,
    updates: ExampleUpdateWithAttachments[] = []
  ): Promise<UpdateExamplesResponse> {
    if (!(await this._getMultiPartSupport())) {
      throw new Error(
        "Your LangSmith version does not allow using the multipart examples endpoint, please update to the latest version."
      );
    }
    const formData = new FormData();

    for (const example of updates) {
      const exampleId = example.id;

      // Prepare the main example body
      const exampleBody = {
        ...(example.metadata && { metadata: example.metadata }),
        ...(example.split && { split: example.split }),
      };

      // Add main example data
      const stringifiedExample = stringifyForTracing(exampleBody);
      const exampleBlob = new Blob([stringifiedExample], {
        type: "application/json",
      });
      formData.append(exampleId, exampleBlob);

      // Add inputs
      if (example.inputs) {
        const stringifiedInputs = stringifyForTracing(example.inputs);
        const inputsBlob = new Blob([stringifiedInputs], {
          type: "application/json",
        });
        formData.append(`${exampleId}.inputs`, inputsBlob);
      }

      // Add outputs if present
      if (example.outputs) {
        const stringifiedOutputs = stringifyForTracing(example.outputs);
        const outputsBlob = new Blob([stringifiedOutputs], {
          type: "application/json",
        });
        formData.append(`${exampleId}.outputs`, outputsBlob);
      }

      // Add attachments if present
      if (example.attachments) {
        for (const [name, attachment] of Object.entries(example.attachments)) {
          let mimeType: string;
          let data: AttachmentData;

          if (Array.isArray(attachment)) {
            [mimeType, data] = attachment;
          } else {
            mimeType = attachment.mimeType;
            data = attachment.data;
          }
          const attachmentBlob = new Blob([data], {
            type: `${mimeType}; length=${data.byteLength}`,
          });
          formData.append(`${exampleId}.attachment.${name}`, attachmentBlob);
        }
      }

      if (example.attachments_operations) {
        const stringifiedAttachmentsOperations = stringifyForTracing(
          example.attachments_operations
        );
        const attachmentsOperationsBlob = new Blob(
          [stringifiedAttachmentsOperations],
          {
            type: "application/json",
          }
        );
        formData.append(
          `${exampleId}.attachments_operations`,
          attachmentsOperationsBlob
        );
      }
    }

    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/v1/platform/datasets/${datasetId}/examples`,
      {
        method: "PATCH",
        headers: this.headers,
        body: formData,
      }
    );
    const result = await response.json();
    return result;
  }

  /**
   * Upload examples with attachments using multipart form data.
   * @param uploads List of ExampleUploadWithAttachments objects to upload
   * @returns Promise with the upload response
   */
  public async uploadExamplesMultipart(
    datasetId: string,
    uploads: ExampleUploadWithAttachments[] = []
  ): Promise<UploadExamplesResponse> {
    if (!(await this._getMultiPartSupport())) {
      throw new Error(
        "Your LangSmith version does not allow using the multipart examples endpoint, please update to the latest version."
      );
    }
    const formData = new FormData();

    for (const example of uploads) {
      const exampleId = (example.id ?? uuid.v4()).toString();

      // Prepare the main example body
      const exampleBody = {
        created_at: example.created_at,
        ...(example.metadata && { metadata: example.metadata }),
        ...(example.split && { split: example.split }),
      };

      // Add main example data
      const stringifiedExample = stringifyForTracing(exampleBody);
      const exampleBlob = new Blob([stringifiedExample], {
        type: "application/json",
      });
      formData.append(exampleId, exampleBlob);

      // Add inputs
      const stringifiedInputs = stringifyForTracing(example.inputs);
      const inputsBlob = new Blob([stringifiedInputs], {
        type: "application/json",
      });
      formData.append(`${exampleId}.inputs`, inputsBlob);

      // Add outputs if present
      if (example.outputs) {
        const stringifiedOutputs = stringifyForTracing(example.outputs);
        const outputsBlob = new Blob([stringifiedOutputs], {
          type: "application/json",
        });
        formData.append(`${exampleId}.outputs`, outputsBlob);
      }

      // Add attachments if present
      if (example.attachments) {
        for (const [name, attachment] of Object.entries(example.attachments)) {
          let mimeType: string;
          let data: AttachmentData;

          if (Array.isArray(attachment)) {
            [mimeType, data] = attachment;
          } else {
            mimeType = attachment.mimeType;
            data = attachment.data;
          }
          const attachmentBlob = new Blob([data], {
            type: `${mimeType}; length=${data.byteLength}`,
          });
          formData.append(`${exampleId}.attachment.${name}`, attachmentBlob);
        }
      }
    }

    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/v1/platform/datasets/${datasetId}/examples`,
      {
        method: "POST",
        headers: this.headers,
        body: formData,
      }
    );
    const result = await response.json();
    return result;
  }

  public async updatePrompt(
    promptIdentifier: string,
    options?: {
      description?: string;
      readme?: string;
      tags?: string[];
      isPublic?: boolean;
      isArchived?: boolean;
    }
  ): Promise<Record<string, any>> {
    if (!(await this.promptExists(promptIdentifier))) {
      throw new Error("Prompt does not exist, you must create it first.");
    }

    const [owner, promptName] = parsePromptIdentifier(promptIdentifier);

    if (!(await this._currentTenantIsOwner(owner))) {
      throw await this._ownerConflictError("update a prompt", owner);
    }

    const payload: Record<string, any> = {};

    if (options?.description !== undefined)
      payload.description = options.description;
    if (options?.readme !== undefined) payload.readme = options.readme;
    if (options?.tags !== undefined) payload.tags = options.tags;
    if (options?.isPublic !== undefined) payload.is_public = options.isPublic;
    if (options?.isArchived !== undefined)
      payload.is_archived = options.isArchived;

    // Check if payload is empty
    if (Object.keys(payload).length === 0) {
      throw new Error("No valid update options provided");
    }

    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/repos/${owner}/${promptName}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
        headers: {
          ...this.headers,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );

    await raiseForStatus(response, "update prompt");

    return response.json();
  }

  public async deletePrompt(promptIdentifier: string): Promise<void> {
    if (!(await this.promptExists(promptIdentifier))) {
      throw new Error("Prompt does not exist, you must create it first.");
    }

    const [owner, promptName, _] = parsePromptIdentifier(promptIdentifier);

    if (!(await this._currentTenantIsOwner(owner))) {
      throw await this._ownerConflictError("delete a prompt", owner);
    }

    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/repos/${owner}/${promptName}`,
      {
        method: "DELETE",
        headers: this.headers,
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );

    return await response.json();
  }

  public async pullPromptCommit(
    promptIdentifier: string,
    options?: {
      includeModel?: boolean;
    }
  ): Promise<PromptCommit> {
    const [owner, promptName, commitHash] =
      parsePromptIdentifier(promptIdentifier);
    const response = await this.caller.call(
      _getFetchImplementation(),
      `${this.apiUrl}/commits/${owner}/${promptName}/${commitHash}${
        options?.includeModel ? "?include_model=true" : ""
      }`,
      {
        method: "GET",
        headers: this.headers,
        signal: AbortSignal.timeout(this.timeout_ms),
        ...this.fetchOptions,
      }
    );

    await raiseForStatus(response, "pull prompt commit");

    const result = await response.json();

    return {
      owner,
      repo: promptName,
      commit_hash: result.commit_hash,
      manifest: result.manifest,
      examples: result.examples,
    };
  }

  /**
   * This method should not be used directly, use `import { pull } from "langchain/hub"` instead.
   * Using this method directly returns the JSON string of the prompt rather than a LangChain object.
   * @private
   */
  public async _pullPrompt(
    promptIdentifier: string,
    options?: {
      includeModel?: boolean;
    }
  ): Promise<any> {
    const promptObject = await this.pullPromptCommit(promptIdentifier, {
      includeModel: options?.includeModel,
    });
    const prompt = JSON.stringify(promptObject.manifest);
    return prompt;
  }

  public async pushPrompt(
    promptIdentifier: string,
    options?: {
      object?: any;
      parentCommitHash?: string;
      isPublic?: boolean;
      description?: string;
      readme?: string;
      tags?: string[];
    }
  ): Promise<string> {
    // Create or update prompt metadata
    if (await this.promptExists(promptIdentifier)) {
      if (options && Object.keys(options).some((key) => key !== "object")) {
        await this.updatePrompt(promptIdentifier, {
          description: options?.description,
          readme: options?.readme,
          tags: options?.tags,
          isPublic: options?.isPublic,
        });
      }
    } else {
      await this.createPrompt(promptIdentifier, {
        description: options?.description,
        readme: options?.readme,
        tags: options?.tags,
        isPublic: options?.isPublic,
      });
    }

    if (!options?.object) {
      return await this._getPromptUrl(promptIdentifier);
    }

    // Create a commit with the new manifest
    const url = await this.createCommit(promptIdentifier, options?.object, {
      parentCommitHash: options?.parentCommitHash,
    });
    return url;
  }

  /**
   * Clone a public dataset to your own langsmith tenant.
   * This operation is idempotent. If you already have a dataset with the given name,
   * this function will do nothing.

   * @param {string} tokenOrUrl The token of the public dataset to clone.
   * @param {Object} [options] Additional options for cloning the dataset.
   * @param {string} [options.sourceApiUrl] The URL of the langsmith server where the data is hosted. Defaults to the API URL of your current client.
   * @param {string} [options.datasetName] The name of the dataset to create in your tenant. Defaults to the name of the public dataset.
   * @returns {Promise<void>}
   */
  async clonePublicDataset(
    tokenOrUrl: string,
    options: {
      sourceApiUrl?: string;
      datasetName?: string;
    } = {}
  ): Promise<void> {
    const { sourceApiUrl = this.apiUrl, datasetName } = options;
    const [parsedApiUrl, tokenUuid] = this.parseTokenOrUrl(
      tokenOrUrl,
      sourceApiUrl
    );
    const sourceClient = new Client({
      apiUrl: parsedApiUrl,
      // Placeholder API key not needed anymore in most cases, but
      // some private deployments may have API key-based rate limiting
      // that would cause this to fail if we provide no value.
      apiKey: "placeholder",
    });

    const ds = await sourceClient.readSharedDataset(tokenUuid);
    const finalDatasetName = datasetName || ds.name;

    try {
      if (await this.hasDataset({ datasetId: finalDatasetName })) {
        console.log(
          `Dataset ${finalDatasetName} already exists in your tenant. Skipping.`
        );
        return;
      }
    } catch (_) {
      // `.hasDataset` will throw an error if the dataset does not exist.
      // no-op in that case
    }

    // Fetch examples first, then create the dataset
    const examples = await sourceClient.listSharedExamples(tokenUuid);
    const dataset = await this.createDataset(finalDatasetName, {
      description: ds.description,
      dataType: ds.data_type || "kv",
      inputsSchema: ds.inputs_schema_definition ?? undefined,
      outputsSchema: ds.outputs_schema_definition ?? undefined,
    });
    try {
      await this.createExamples({
        inputs: examples.map((e) => e.inputs),
        outputs: examples.flatMap((e) => (e.outputs ? [e.outputs] : [])),
        datasetId: dataset.id,
      });
    } catch (e) {
      console.error(
        `An error occurred while creating dataset ${finalDatasetName}. ` +
          "You should delete it manually."
      );
      throw e;
    }
  }

  private parseTokenOrUrl(
    urlOrToken: string,
    apiUrl: string,
    numParts = 2,
    kind = "dataset"
  ): [string, string] {
    // Try parsing as UUID
    try {
      assertUuid(urlOrToken); // Will throw if it's not a UUID.
      return [apiUrl, urlOrToken];
    } catch (_) {
      // no-op if it's not a uuid
    }

    // Parse as URL
    try {
      const parsedUrl = new URL(urlOrToken);
      const pathParts = parsedUrl.pathname
        .split("/")
        .filter((part) => part !== "");

      if (pathParts.length >= numParts) {
        const tokenUuid = pathParts[pathParts.length - numParts];
        return [apiUrl, tokenUuid];
      } else {
        throw new Error(`Invalid public ${kind} URL: ${urlOrToken}`);
      }
    } catch (error) {
      throw new Error(`Invalid public ${kind} URL or token: ${urlOrToken}`);
    }
  }

  /**
   * Awaits all pending trace batches. Useful for environments where
   * you need to be sure that all tracing requests finish before execution ends,
   * such as serverless environments.
   *
   * @example
   * ```
   * import { Client } from "langsmith";
   *
   * const client = new Client();
   *
   * try {
   *   // Tracing happens here
   *   ...
   * } finally {
   *   await client.awaitPendingTraceBatches();
   * }
   * ```
   *
   * @returns A promise that resolves once all currently pending traces have sent.
   */
  public awaitPendingTraceBatches() {
    return Promise.all([
      ...this.autoBatchQueue.items.map(({ itemPromise }) => itemPromise),
      this.batchIngestCaller.queue.onIdle(),
    ]);
  }
}

export interface LangSmithTracingClientInterface {
  createRun: (run: CreateRunParams) => Promise<void>;

  updateRun: (runId: string, run: RunUpdate) => Promise<void>;
}
