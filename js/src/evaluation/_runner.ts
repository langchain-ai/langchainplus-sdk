import { Client, RunTree, RunTreeConfig } from "../index.js";
import {
  AttachmentInfo,
  BaseRun,
  Example,
  KVMap,
  Run,
  TracerSession,
} from "../schemas.js";
import { traceable } from "../traceable.js";
import { getDefaultRevisionId, getGitInfo } from "../utils/_git.js";
import { assertUuid } from "../utils/_uuid.js";
import { AsyncCaller } from "../utils/async_caller.js";
import { atee } from "../utils/atee.js";
import { getLangChainEnvVarsMetadata } from "../utils/env.js";
import { printErrorStackTrace } from "../utils/error.js";
import { randomName } from "./_random_name.js";
import {
  EvaluationResult,
  EvaluationResults,
  RunEvaluator,
  runEvaluator,
} from "./evaluator.js";
import { LangSmithConflictError } from "../utils/error.js";
import { v4 as uuidv4 } from "uuid";
import {
  evaluateComparative,
  ComparisonEvaluationResults,
  ComparativeEvaluator,
} from "./evaluate_comparative.js";

export type TargetConfigT = KVMap & {
  attachments?: Record<string, AttachmentInfo>;
  callbacks?: any;
};
type StandardTargetT<TInput = any, TOutput = KVMap> =
  | ((input: TInput, config?: TargetConfigT) => Promise<TOutput>)
  | ((input: TInput, config?: TargetConfigT) => TOutput)
  | { invoke: (input: TInput, config?: TargetConfigT) => TOutput }
  | { invoke: (input: TInput, config?: TargetConfigT) => Promise<TOutput> };

type ComparativeTargetT =
  | Array<string>
  | Array<Promise<ExperimentResults> | ExperimentResults>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TargetT<TInput = any, TOutput = KVMap> =
  | StandardTargetT<TInput, TOutput>
  | ComparativeTargetT;

// Data format: dataset-name, dataset_id, or examples
export type DataT = string | AsyncIterable<Example> | Example[];

// and reports aggregate metric(s)
/** @deprecated Use object parameter version instead: (args: { runs, examples, inputs, outputs, referenceOutputs }) => ... */
type DeprecatedSyncSummaryEvaluator = (
  runs: Array<Run>,
  examples: Array<Example>
) => EvaluationResult | EvaluationResults;

/** @deprecated Use object parameter version instead: (args: { runs, examples, inputs, outputs, referenceOutputs }) => ... */
type DeprecatedAsyncSummaryEvaluator = (
  runs: Array<Run>,
  examples: Array<Example>
) => Promise<EvaluationResult | EvaluationResults>;

// Summary evaluator runs over the whole dataset
export type SummaryEvaluatorT =
  | DeprecatedSyncSummaryEvaluator
  | DeprecatedAsyncSummaryEvaluator
  | ((args: {
      runs: Array<Run>;
      examples: Array<Example>;
      inputs: Array<Record<string, any>>;
      outputs: Array<Record<string, any>>;
      referenceOutputs?: Array<Record<string, any>>;
    }) => EvaluationResult | EvaluationResults)
  | ((args: {
      runs: Array<Run>;
      examples: Array<Example>;
      inputs: Array<Record<string, any>>;
      outputs: Array<Record<string, any>>;
      referenceOutputs?: Array<Record<string, any>>;
    }) => Promise<EvaluationResult | EvaluationResults>);

/** @deprecated Use object parameter version instead: (args: { run, example, inputs, outputs, referenceOutputs }) => ... */
type DeprecatedRunEvaluator = RunEvaluator;

/** @deprecated Use object parameter version instead: (args: { run, example, inputs, outputs, referenceOutputs }) => ... */
type DeprecatedFunctionEvaluator = (
  run: Run,
  example?: Example
) => EvaluationResult | EvaluationResults;

/** @deprecated Use object parameter version instead: (args: { run, example, inputs, outputs, referenceOutputs }) => ... */
type DeprecatedAsyncFunctionEvaluator = (
  run: Run,
  example?: Example
) => Promise<EvaluationResult | EvaluationResults>;

// Row-level evaluator
export type EvaluatorT =
  | DeprecatedRunEvaluator
  | DeprecatedFunctionEvaluator
  | DeprecatedAsyncFunctionEvaluator
  | ((args: {
      run: Run;
      example: Example;
      inputs: Record<string, any>;
      outputs: Record<string, any>;
      referenceOutputs?: Record<string, any>;
      attachments?: Record<string, any>;
    }) => EvaluationResult | EvaluationResults)
  | ((args: {
      run: Run;
      example: Example;
      inputs: Record<string, any>;
      outputs: Record<string, any>;
      referenceOutputs?: Record<string, any>;
      attachments?: Record<string, any>;
    }) => Promise<EvaluationResult | EvaluationResults>);

interface _ForwardResults {
  run: Run;
  example: Example;
}

interface _ExperimentManagerArgs {
  data?: DataT;
  experiment?: TracerSession | string;
  metadata?: KVMap;
  client?: Client;
  runs?: AsyncGenerator<Run>;
  evaluationResults?: AsyncGenerator<EvaluationResults>;
  summaryResults?: AsyncGenerator<
    (runsArray: Run[]) => AsyncGenerator<EvaluationResults, any, unknown>,
    any,
    unknown
  >;
  examples?: Example[];
  numRepetitions?: number;
  _runsArray?: Run[];
  includeAttachments?: boolean;
}

type BaseEvaluateOptions = {
  /**
   * Metadata to attach to the experiment.
   * @default undefined
   */
  metadata?: KVMap;
  /**
   * A prefix to provide for your experiment name.
   * @default undefined
   */
  experimentPrefix?: string;
  /**
   * A free-form description of the experiment.
   */
  description?: string;
  /**
   * The maximum number of concurrent evaluations to run.
   * @default undefined
   */
  maxConcurrency?: number;
  /**
   * The LangSmith client to use.
   * @default undefined
   */
  client?: Client;
  /**
   * The number of repetitions to perform. Each example
   * will be run this many times.
   * @default 1
   */
  numRepetitions?: number;
};

export interface EvaluateOptions extends BaseEvaluateOptions {
  /**
   * A list of evaluators to run on each example.
   * @default undefined
   */
  evaluators?: Array<EvaluatorT>;
  /**
   * A list of summary evaluators to run on the entire dataset.
   * @default undefined
   */
  summaryEvaluators?: Array<SummaryEvaluatorT>;
  /**
   * The dataset to evaluate on. Can be a dataset name, a list of
   * examples, or a generator of examples.
   */
  data: DataT;
  /**
   * Whether to use attachments for the experiment.
   * @default false
   */
  includeAttachments?: boolean;
}

export interface ComparativeEvaluateOptions extends BaseEvaluateOptions {
  /**
   * A list of evaluators to run on each example.
   */
  evaluators: Array<ComparativeEvaluator>;
  /**
   * Whether to load all child runs for the experiment.
   * @default false
   */
  loadNested?: boolean;
  /**
   * Randomize the order of outputs for each evaluation
   * @default false
   */
  randomizeOrder?: boolean;
}

// Function overloads
export function evaluate(
  target: ComparativeTargetT,
  options: ComparativeEvaluateOptions
): Promise<ComparisonEvaluationResults>;

export function evaluate(
  target: StandardTargetT,
  options: EvaluateOptions
): Promise<ExperimentResults>;

// Implementation signature
export function evaluate(
  target: TargetT,
  options: EvaluateOptions | ComparativeEvaluateOptions
): Promise<ExperimentResults | ComparisonEvaluationResults> {
  return _evaluate(target, options);
}

export interface ExperimentResultRow {
  run: Run;
  example: Example;
  evaluationResults: EvaluationResults;
}

/**
 * Manage the execution of experiments.
 *
 * Supports lazily running predictions and evaluations in parallel to facilitate
 * result streaming and early debugging.
 */
export class _ExperimentManager {
  _data?: DataT;

  _runs?: AsyncGenerator<Run>;

  _evaluationResults?: AsyncGenerator<EvaluationResults>;

  _summaryResults?: AsyncGenerator<
    (runsArray: Run[]) => AsyncGenerator<EvaluationResults, any, unknown>,
    any,
    unknown
  >;

  _examples?: Example[];

  _numRepetitions?: number;

  _runsArray?: Run[];

  client: Client;

  _experiment?: TracerSession;

  _experimentName: string;

  _metadata: KVMap;
  _description?: string;

  _includeAttachments?: boolean;

  get experimentName(): string {
    if (this._experimentName) {
      return this._experimentName;
    } else {
      throw new Error(
        "Experiment name not provided, and experiment not yet started."
      );
    }
  }

  async getExamples(): Promise<Array<Example>> {
    if (!this._examples) {
      if (!this._data) {
        throw new Error("Data not provided in this experiment.");
      }
      const unresolvedData = _resolveData(this._data, {
        client: this.client,
        includeAttachments: this._includeAttachments,
      });
      if (!this._examples) {
        this._examples = [];
      }
      const exs = [];
      for await (const example of unresolvedData) {
        exs.push(example);
      }
      if (this._numRepetitions && this._numRepetitions > 0) {
        const repeatedExamples = [];
        for (let i = 0; i < this._numRepetitions; i++) {
          repeatedExamples.push(...exs);
        }
        this.setExamples(repeatedExamples);
      } else {
        this.setExamples(exs);
      }
    }
    return this._examples;
  }

  setExamples(examples: Example[]): void {
    this._examples = examples;
  }

  get datasetId(): Promise<string> {
    return this.getExamples().then((examples) => {
      if (examples.length === 0) {
        throw new Error("No examples found in the dataset.");
      }
      if (this._experiment && this._experiment.reference_dataset_id) {
        return this._experiment.reference_dataset_id;
      }
      return examples[0].dataset_id;
    });
  }

  get evaluationResults(): AsyncGenerator<EvaluationResults> {
    if (this._evaluationResults === undefined) {
      return async function* (this: _ExperimentManager) {
        for (const _ of await this.getExamples()) {
          yield { results: [] };
        }
      }.call(this);
    } else {
      return this._evaluationResults;
    }
  }

  get runs(): AsyncGenerator<Run> {
    if (this._runsArray && this._runsArray.length > 0) {
      throw new Error("Runs already provided as an array.");
    }
    if (this._runs === undefined) {
      throw new Error(
        "Runs not provided in this experiment. Please predict first."
      );
    } else {
      return this._runs;
    }
  }

  constructor(args: _ExperimentManagerArgs) {
    this.client = args.client ?? new Client();
    if (!args.experiment) {
      this._experimentName = randomName();
    } else if (typeof args.experiment === "string") {
      this._experimentName = `${args.experiment}-${uuidv4().slice(0, 8)}`;
    } else {
      if (!args.experiment.name) {
        throw new Error("Experiment must have a name");
      }
      this._experimentName = args.experiment.name;
      this._experiment = args.experiment;
    }

    let metadata = args.metadata || {};
    if (!("revision_id" in metadata)) {
      metadata = {
        revision_id: getLangChainEnvVarsMetadata().revision_id,
        ...metadata,
      };
    }
    this._metadata = metadata;

    if (args.examples && args.examples.length) {
      this.setExamples(args.examples);
    }
    this._data = args.data;

    if (args._runsArray && args._runsArray.length) {
      this._runsArray = args._runsArray;
    }
    this._runs = args.runs;

    this._evaluationResults = args.evaluationResults;
    this._summaryResults = args.summaryResults;
    this._numRepetitions = args.numRepetitions;
    this._includeAttachments = args.includeAttachments;
  }

  _getExperiment(): TracerSession {
    if (!this._experiment) {
      throw new Error("Experiment not yet started.");
    }
    return this._experiment;
  }

  async _getExperimentMetadata(): Promise<KVMap> {
    let projectMetadata = this._metadata ?? {};
    const gitInfo = await getGitInfo();
    if (gitInfo) {
      projectMetadata = {
        ...projectMetadata,
        git: gitInfo,
      };
    }
    if (this._experiment) {
      const experimentMetadata: KVMap =
        this._experiment.extra && "metadata" in this._experiment.extra
          ? this._experiment.extra.metadata
          : {};
      projectMetadata = {
        ...experimentMetadata,
        ...projectMetadata,
      };
    }
    return projectMetadata;
  }

  async _createProject(firstExample: Example, projectMetadata: KVMap) {
    // Create the project, updating the experimentName until we find a unique one.
    let project: TracerSession;
    const originalExperimentName = this._experimentName;
    for (let i = 0; i < 10; i++) {
      try {
        project = await this.client.createProject({
          projectName: this._experimentName,
          referenceDatasetId: firstExample.dataset_id,
          metadata: projectMetadata,
          description: this._description,
        });
        return project;
      } catch (e) {
        // Naming collision
        if ((e as LangSmithConflictError)?.name === "LangSmithConflictError") {
          const ent = uuidv4().slice(0, 6);
          this._experimentName = `${originalExperimentName}-${ent}`;
        } else {
          throw e;
        }
      }
    }
    throw new Error(
      "Could not generate a unique experiment name within 10 attempts." +
        " Please try again with a different name."
    );
  }

  async _getProject(firstExample: Example): Promise<TracerSession> {
    let project: TracerSession;
    if (!this._experiment) {
      const projectMetadata = await this._getExperimentMetadata();
      project = await this._createProject(firstExample, projectMetadata);
      this._experiment = project;
    }
    return this._experiment;
  }

  protected async _printExperimentStart(): Promise<void> {
    console.log(`Starting evaluation of experiment: ${this.experimentName}`);

    const firstExample = this._examples?.[0];
    const datasetId = firstExample?.dataset_id;
    if (!datasetId || !this._experiment) return;

    const datasetUrl = await this.client.getDatasetUrl({ datasetId });
    const compareUrl = `${datasetUrl}/compare?selectedSessions=${this._experiment.id}`;

    console.log(`View results at ${compareUrl}`);
  }

  async start(): Promise<_ExperimentManager> {
    const examples = await this.getExamples();
    const firstExample = examples[0];
    const project = await this._getProject(firstExample);
    await this._printExperimentStart();
    this._metadata["num_repetitions"] = this._numRepetitions;
    this._metadata["dataset_version"] = await this._getDatasetVersion();
    return new _ExperimentManager({
      examples,
      experiment: project,
      metadata: this._metadata,
      client: this.client,
      evaluationResults: this._evaluationResults,
      summaryResults: this._summaryResults,
      includeAttachments: this._includeAttachments,
    });
  }

  async withPredictions(
    target: StandardTargetT,
    options?: {
      maxConcurrency?: number;
    }
  ): Promise<_ExperimentManager> {
    const experimentResults = this._predict(target, options);
    return new _ExperimentManager({
      examples: await this.getExamples(),
      experiment: this._experiment,
      metadata: this._metadata,
      client: this.client,
      runs: (async function* (): AsyncGenerator<Run> {
        for await (const pred of experimentResults) {
          yield pred.run;
        }
      })(),
      includeAttachments: this._includeAttachments,
    });
  }

  async withEvaluators(
    evaluators: Array<EvaluatorT | RunEvaluator>,
    options?: {
      maxConcurrency?: number;
    }
  ): Promise<_ExperimentManager> {
    const resolvedEvaluators = _resolveEvaluators(evaluators);
    const experimentResults = this._score(resolvedEvaluators, options);
    const [r1, r2] = atee<ExperimentResultRow>(experimentResults);

    return new _ExperimentManager({
      examples: await this.getExamples(),
      experiment: this._experiment,
      metadata: this._metadata,
      client: this.client,
      runs: (async function* (): AsyncGenerator<Run> {
        for await (const result of r1) {
          yield result.run;
        }
      })(),
      evaluationResults:
        (async function* (): AsyncGenerator<EvaluationResults> {
          for await (const result of r2) {
            yield result.evaluationResults;
          }
        })(),
      summaryResults: this._summaryResults,
      includeAttachments: this._includeAttachments,
    });
  }

  async withSummaryEvaluators(
    summaryEvaluators: Array<SummaryEvaluatorT>
  ): Promise<_ExperimentManager> {
    const aggregateFeedbackGen =
      this._applySummaryEvaluators(summaryEvaluators);
    return new _ExperimentManager({
      examples: await this.getExamples(),
      experiment: this._experiment,
      metadata: this._metadata,
      client: this.client,
      runs: this.runs,
      _runsArray: this._runsArray,
      evaluationResults: this._evaluationResults,
      summaryResults: aggregateFeedbackGen,
      includeAttachments: this._includeAttachments,
    });
  }

  async *getResults(): AsyncGenerator<ExperimentResultRow> {
    const examples = await this.getExamples();
    const evaluationResults: EvaluationResults[] = [];

    if (!this._runsArray) {
      this._runsArray = [];
      for await (const run of this.runs) {
        this._runsArray.push(run);
      }
    }

    for await (const evaluationResult of this.evaluationResults) {
      evaluationResults.push(evaluationResult);
    }
    for (let i = 0; i < this._runsArray.length; i++) {
      yield {
        run: this._runsArray[i],
        example: examples[i],
        evaluationResults: evaluationResults[i],
      };
    }
  }

  async getSummaryScores(): Promise<EvaluationResults> {
    if (!this._summaryResults) {
      return { results: [] };
    }

    const results: EvaluationResult[] = [];
    for await (const evaluationResultsGenerator of this._summaryResults) {
      if (typeof evaluationResultsGenerator === "function") {
        // This is because runs array is not available until after this generator
        // is set, so we need to pass it like so.
        for await (const evaluationResults of evaluationResultsGenerator(
          this._runsArray ?? []
        )) {
          results.push(...evaluationResults.results);
        }
      }
    }

    return { results };
  }

  // Private methods

  /**
   * Run the target function or runnable on the examples.
   * @param {StandardTargetT} target The target function or runnable to evaluate.
   * @param options
   * @returns {AsyncGenerator<_ForwardResults>} An async generator of the results.
   */
  async *_predict(
    target: StandardTargetT,
    options?: {
      maxConcurrency?: number;
    }
  ): AsyncGenerator<_ForwardResults> {
    const maxConcurrency = options?.maxConcurrency ?? 0;
    const examples = await this.getExamples();

    if (maxConcurrency === 0) {
      for (const example of examples) {
        yield await _forward(
          target,
          example,
          this.experimentName,
          this._metadata,
          this.client,
          this._includeAttachments
        );
      }
    } else {
      const caller = new AsyncCaller({
        maxConcurrency,
      });

      const futures: Array<Promise<_ForwardResults>> = [];

      for await (const example of examples) {
        futures.push(
          caller.call(
            _forward,
            target,
            example,
            this.experimentName,
            this._metadata,
            this.client,
            this._includeAttachments
          )
        );
      }

      for await (const future of futures) {
        yield future;
      }
    }

    // Close out the project.
    await this._end();
  }

  async _runEvaluators(
    evaluators: Array<RunEvaluator>,
    currentResults: ExperimentResultRow,
    fields: {
      client: Client;
    }
  ): Promise<ExperimentResultRow> {
    const { run, example, evaluationResults } = currentResults;
    for (const evaluator of evaluators) {
      try {
        const options = {
          reference_example_id: example.id,
          project_name: "evaluators",
          metadata: {
            example_version: example.modified_at
              ? new Date(example.modified_at).toISOString()
              : new Date(example.created_at).toISOString(),
          },
          client: fields.client,
          tracingEnabled: true,
        };
        const evaluatorResponse = await evaluator.evaluateRun(
          run,
          example,
          options
        );
        evaluationResults.results.push(
          ...(await fields.client.logEvaluationFeedback(evaluatorResponse, run))
        );
      } catch (e) {
        console.error(
          `Error running evaluator ${evaluator.evaluateRun.name} on run ${run.id}: ${e}`
        );
        printErrorStackTrace(e);
      }
    }

    return {
      run,
      example,
      evaluationResults,
    };
  }

  /**
   * Run the evaluators on the prediction stream.
   * Expects runs to be available in the manager.
   * (e.g. from a previous prediction step)
   * @param {Array<RunEvaluator>} evaluators
   * @param {number} maxConcurrency
   */
  async *_score(
    evaluators: Array<RunEvaluator>,
    options?: {
      maxConcurrency?: number;
    }
  ): AsyncGenerator<ExperimentResultRow> {
    const { maxConcurrency = 0 } = options || {};

    if (maxConcurrency === 0) {
      for await (const currentResults of this.getResults()) {
        yield this._runEvaluators(evaluators, currentResults, {
          client: this.client,
        });
      }
    } else {
      const caller = new AsyncCaller({
        maxConcurrency,
      });
      const futures: Promise<ExperimentResultRow>[] = [];
      for await (const currentResults of this.getResults()) {
        futures.push(
          caller.call(this._runEvaluators, evaluators, currentResults, {
            client: this.client,
          })
        );
      }

      for (const result of futures) {
        yield result;
      }
    }
  }

  async *_applySummaryEvaluators(
    summaryEvaluators: Array<SummaryEvaluatorT>
  ): AsyncGenerator<(runsArray: Run[]) => AsyncGenerator<EvaluationResults>> {
    const projectId = this._getExperiment().id;
    const examples = await this.getExamples();

    const options = Array.from({ length: summaryEvaluators.length }).map(
      () => ({
        project_name: "evaluators",
        experiment: this.experimentName,
        projectId: projectId,
      })
    );
    const wrappedEvaluators = await wrapSummaryEvaluators(
      summaryEvaluators,
      options
    );

    yield async function* (
      this: _ExperimentManager,
      runsArray: Run[]
    ): AsyncGenerator<EvaluationResults> {
      const aggregateFeedback = [];

      for (const evaluator of wrappedEvaluators) {
        try {
          const summaryEvalResult = await evaluator(runsArray, examples);

          const flattenedResults =
            this.client._selectEvalResults(summaryEvalResult);
          aggregateFeedback.push(...flattenedResults);
          for (const result of flattenedResults) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { targetRunId, key, ...feedback } = result;
            const evaluatorInfo = feedback.evaluatorInfo;
            delete feedback.evaluatorInfo;

            await this.client.createFeedback(null, key, {
              ...feedback,
              projectId: projectId,
              sourceInfo: evaluatorInfo,
            });
          }
        } catch (e) {
          console.error(
            `Error running summary evaluator ${
              evaluator.name
            }: ${JSON.stringify(e, null, 2)}`
          );
          printErrorStackTrace(e);
        }
      }

      yield {
        results: aggregateFeedback,
      };
    }.bind(this);
  }

  async _getDatasetVersion(): Promise<string | undefined> {
    const examples = await this.getExamples();
    const modifiedAt = examples.map((ex) => ex.modified_at);

    // Python might return microseconds, which we need
    // to account for when comparing dates.
    const modifiedAtTime = modifiedAt.map((date) => {
      function getMiliseconds(isoString: string) {
        const time = isoString.split("T").at(1);
        if (!time) return "";

        const regex = /[0-9]{2}:[0-9]{2}:[0-9]{2}.([0-9]+)/;
        const strMiliseconds = time.match(regex)?.[1];
        return strMiliseconds ?? "";
      }

      const jsDate = new Date(date!);

      let source = getMiliseconds(date!);
      let parsed = getMiliseconds(jsDate.toISOString());

      const length = Math.max(source.length, parsed.length);
      source = source.padEnd(length, "0");
      parsed = parsed.padEnd(length, "0");

      const microseconds =
        (Number.parseInt(source, 10) - Number.parseInt(parsed, 10)) / 1000;

      const time = jsDate.getTime() + microseconds;
      return { date, time };
    });

    if (modifiedAtTime.length === 0) return undefined;
    return modifiedAtTime.reduce(
      (max, current) => (current.time > max.time ? current : max),
      modifiedAtTime[0]
    ).date;
  }

  async _getDatasetSplits(): Promise<string[] | undefined> {
    const examples = await this.getExamples();
    const allSplits = examples.reduce((acc, ex) => {
      if (ex.metadata && ex.metadata.dataset_split) {
        if (Array.isArray(ex.metadata.dataset_split)) {
          ex.metadata.dataset_split.forEach((split) => acc.add(split));
        } else if (typeof ex.metadata.dataset_split === "string") {
          acc.add(ex.metadata.dataset_split);
        }
      }
      return acc;
    }, new Set<string>());
    return allSplits.size ? Array.from(allSplits) : undefined;
  }

  async _end(): Promise<void> {
    const experiment = this._experiment;
    if (!experiment) {
      throw new Error("Experiment not yet started.");
    }
    const projectMetadata = await this._getExperimentMetadata();
    projectMetadata["dataset_splits"] = await this._getDatasetSplits();
    // Update revision_id if not already set
    if (!projectMetadata["revision_id"]) {
      projectMetadata["revision_id"] = await getDefaultRevisionId();
    }

    await this.client.updateProject(experiment.id, {
      endTime: new Date().toISOString(),
      metadata: projectMetadata,
    });
  }
}

/**
 * Represents the results of an evaluate() call.
 * This class provides an iterator interface to iterate over the experiment results
 * as they become available. It also provides methods to access the experiment name,
 * the number of results, and to wait for the results to be processed.
 */
class ExperimentResults implements AsyncIterableIterator<ExperimentResultRow> {
  private manager: _ExperimentManager;
  results: ExperimentResultRow[] = [];
  processedCount = 0;
  summaryResults: EvaluationResults;

  constructor(experimentManager: _ExperimentManager) {
    this.manager = experimentManager;
  }

  get experimentName(): string {
    return this.manager.experimentName;
  }

  get datasetVersion(): string | undefined {
    return this.manager._metadata?.dataset_version;
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<ExperimentResultRow> {
    return this;
  }

  async next(): Promise<IteratorResult<ExperimentResultRow>> {
    if (this.processedCount < this.results.length) {
      const result = this.results[this.processedCount];
      this.processedCount++;
      return Promise.resolve({ value: result, done: false });
    } else {
      return Promise.resolve({ value: undefined, done: true });
    }
  }

  async processData(manager: _ExperimentManager): Promise<void> {
    for await (const item of manager.getResults()) {
      this.results.push(item);
      this.processedCount++;
    }
    this.summaryResults = await manager.getSummaryScores();
  }

  get length(): number {
    return this.results.length;
  }
}

async function _evaluate(
  target: TargetT | AsyncGenerator<Run>,
  fields: (EvaluateOptions | ComparativeEvaluateOptions) & {
    experiment?: TracerSession;
  }
): Promise<ExperimentResults | ComparisonEvaluationResults> {
  // Add check for comparative evaluation
  if (Array.isArray(target)) {
    const comparativeOptions = fields as ComparativeEvaluateOptions;
    if (!comparativeOptions.evaluators) {
      throw new Error("Evaluators are required for comparative evaluation");
    }

    return evaluateComparative(target, {
      evaluators: comparativeOptions.evaluators,
      client: comparativeOptions.client,
      metadata: comparativeOptions.metadata,
      experimentPrefix: comparativeOptions.experimentPrefix,
      description: comparativeOptions.description,
      maxConcurrency: comparativeOptions.maxConcurrency,
      loadNested: comparativeOptions.loadNested ?? false,
      randomizeOrder: comparativeOptions.randomizeOrder ?? false,
    });
  }

  const client = fields.client ?? new Client();
  const runs = _isCallable(target) ? null : (target as AsyncGenerator<Run>);
  const standardFields = fields as EvaluateOptions;
  const [experiment_, newRuns] = await _resolveExperiment(
    fields.experiment ?? null,
    runs,
    client
  );

  let manager = await new _ExperimentManager({
    data: Array.isArray(standardFields.data) ? undefined : standardFields.data,
    examples: Array.isArray(standardFields.data)
      ? standardFields.data
      : undefined,
    client,
    metadata: fields.metadata,
    experiment: experiment_ ?? fields.experimentPrefix,
    runs: newRuns ?? undefined,
    numRepetitions: fields.numRepetitions ?? 1,
    includeAttachments: standardFields.includeAttachments,
  }).start();

  if (_isCallable(target)) {
    manager = await manager.withPredictions(target, {
      maxConcurrency: fields.maxConcurrency,
    });
  }

  if (standardFields.evaluators) {
    manager = await manager.withEvaluators(standardFields.evaluators, {
      maxConcurrency: fields.maxConcurrency,
    });
  }
  if (standardFields.summaryEvaluators) {
    manager = await manager.withSummaryEvaluators(
      standardFields.summaryEvaluators
    );
  }
  // Start consuming the results.
  const results = new ExperimentResults(manager);
  await results.processData(manager);
  return results;
}

async function _forward(
  fn: StandardTargetT,
  example: Example,
  experimentName: string,
  metadata: KVMap,
  client: Client,
  includeAttachments?: boolean
): Promise<_ForwardResults> {
  let run: BaseRun | null = null;

  const _getRun = (r: RunTree): void => {
    run = r;
  };

  const options = {
    reference_example_id: example.id,
    on_end: _getRun,
    project_name: experimentName,
    metadata: {
      ...metadata,
      example_version: example.modified_at
        ? new Date(example.modified_at).toISOString()
        : new Date(example.created_at).toISOString(),
    },
    client,
    tracingEnabled: true,
  };

  const wrappedFn =
    "invoke" in fn
      ? traceable(async (inputs) => {
          let langChainCallbacks;
          try {
            // TODO: Deprecate this and rely on interop on 0.2 minor bump.
            const { getLangchainCallbacks } = await import("../langchain.js");
            langChainCallbacks = await getLangchainCallbacks();
          } catch {
            // no-op
          }
          // Issue with retrieving LangChain callbacks, rely on interop
          if (langChainCallbacks === undefined && !includeAttachments) {
            return await fn.invoke(inputs);
          } else if (langChainCallbacks === undefined && includeAttachments) {
            return await fn.invoke(inputs, {
              attachments: example.attachments,
            });
          } else if (!includeAttachments) {
            return await fn.invoke(inputs, { callbacks: langChainCallbacks });
          } else {
            return await fn.invoke(inputs, {
              attachments: example.attachments,
              callbacks: langChainCallbacks,
            });
          }
        }, options)
      : traceable(fn, options);

  try {
    if (includeAttachments && !("invoke" in fn)) {
      await wrappedFn(example.inputs, { attachments: example.attachments });
    } else {
      await wrappedFn(example.inputs);
    }
  } catch (e) {
    console.error(`Error running target function: ${e}`);
    printErrorStackTrace(e);
  }

  if (!run) {
    throw new Error(`Run not created by target function.
This is most likely due to tracing not being enabled.\n
Try setting "LANGSMITH_TRACING=true" in your environment.`);
  }

  return {
    run,
    example,
  };
}

function _resolveData(
  data: DataT,
  options: {
    client: Client;
    includeAttachments?: boolean;
  }
): AsyncGenerator<Example> {
  let isUUID = false;
  try {
    if (typeof data === "string") {
      assertUuid(data);
      isUUID = true;
    }
  } catch (_) {
    isUUID = false;
  }

  if (typeof data === "string" && isUUID) {
    return options.client.listExamples({
      datasetId: data,
      includeAttachments: options.includeAttachments,
    }) as AsyncGenerator<Example>;
  }
  if (typeof data === "string") {
    return options.client.listExamples({
      datasetName: data,
      includeAttachments: options.includeAttachments,
    }) as AsyncGenerator<Example>;
  }
  return data as AsyncGenerator<Example>;
}

async function wrapSummaryEvaluators(
  evaluators: SummaryEvaluatorT[],
  optionsArray?: Partial<RunTreeConfig>[]
): Promise<
  Array<DeprecatedAsyncSummaryEvaluator | DeprecatedSyncSummaryEvaluator>
> {
  async function _wrap(
    evaluator: SummaryEvaluatorT
  ): Promise<DeprecatedAsyncSummaryEvaluator | DeprecatedSyncSummaryEvaluator> {
    const evalName = evaluator.name || "BatchEvaluator";

    const wrapperInner = (
      runs: Run[],
      examples: Example[]
    ): Promise<EvaluationResult | EvaluationResults> => {
      const wrapperSuperInner = traceable(
        (
          _runs_: string,
          _examples_: string
        ): Promise<EvaluationResult | EvaluationResults> => {
          // Check if the evaluator expects an object parameter
          if (evaluator.length === 1) {
            const inputs = examples.map((ex) => ex.inputs);
            const outputs = runs.map((run) => run.outputs || {});
            const referenceOutputs = examples.map((ex) => ex.outputs || {});

            return Promise.resolve(
              (
                evaluator as (args: {
                  runs: Run[];
                  examples: Example[];
                  inputs: Record<string, any>[];
                  outputs: Record<string, any>[];
                  referenceOutputs?: Record<string, any>[];
                }) => EvaluationResult | EvaluationResults
              )({
                runs,
                examples,
                inputs,
                outputs,
                referenceOutputs,
              })
            );
          }
          // Otherwise use the traditional (runs, examples) signature
          return Promise.resolve(
            (evaluator as DeprecatedSyncSummaryEvaluator)(runs, examples)
          );
        },
        { ...optionsArray, name: evalName }
      );

      return Promise.resolve(
        wrapperSuperInner(
          `Runs[] (Length=${runs.length})`,
          `Examples[] (Length=${examples.length})`
        )
      );
    };

    return wrapperInner;
  }

  const results: Array<
    DeprecatedAsyncSummaryEvaluator | DeprecatedSyncSummaryEvaluator
  > = [];
  for (let i = 0; i < evaluators.length; i++) {
    results.push(await _wrap(evaluators[i]));
  }
  return results;
}

function _resolveEvaluators(
  evaluators: Array<EvaluatorT>
): Array<RunEvaluator> {
  const results: Array<RunEvaluator> = [];
  for (const evaluator of evaluators) {
    if ("evaluateRun" in evaluator) {
      results.push(evaluator);
      // todo fix this by porting LangChainStringEvaluator to langsmith sdk
    } else if (evaluator.name === "LangChainStringEvaluator") {
      throw new Error("Not yet implemented");
    } else {
      results.push(runEvaluator(evaluator));
    }
  }
  return results;
}

async function _resolveExperiment(
  experiment: TracerSession | null,
  runs: AsyncGenerator<Run> | null,
  client: Client
): Promise<
  [TracerSession | string | undefined, AsyncGenerator<Run> | undefined]
> {
  // TODO: Remove this, handle outside the manager
  if (experiment !== null) {
    if (!experiment.name) {
      throw new Error("Experiment name must be defined if provided.");
    }
    return [experiment, undefined];
  }

  // If we have runs, that means the experiment was already started.
  if (runs !== null) {
    const results: AsyncGenerator<Run>[] = [];
    for await (const item of atee<Run>(runs)) {
      results.push(item);
    }
    const [runsClone, runsOriginal] = results;
    const runsCloneIterator = runsClone[Symbol.asyncIterator]();
    // todo: this is `any`. does it work properly?
    const firstRun = await runsCloneIterator
      .next()
      .then((result) => result.value);
    const retrievedExperiment = await client.readProject(firstRun.sessionId);
    if (!retrievedExperiment.name) {
      throw new Error("Experiment name not found for provided runs.");
    }
    return [retrievedExperiment, runsOriginal];
  }

  return [undefined, undefined];
}

function _isCallable(
  target: StandardTargetT | AsyncGenerator<Run>
): target is StandardTargetT {
  return Boolean(
    typeof target === "function" ||
      ("invoke" in target && typeof target.invoke === "function")
  );
}
