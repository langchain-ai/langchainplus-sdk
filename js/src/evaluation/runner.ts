import { Client, RunTree, RunTreeConfig } from "../index.js";
import { BaseRun, Example, KVMap, Run, TracerSession } from "../schemas.js";
import { wrapFunctionAndEnsureTraceable, traceable } from "../traceable.js";
import { getGitInfo } from "../utils/_git.js";
import { isUUIDv4 } from "../utils/_uuid.js";
import { AsyncCaller } from "../utils/async_caller.js";
import { getLangChainEnvVarsMetadata } from "../utils/env.js";
import { randomName } from "./_random_name.js";
import {
  EvaluationResult,
  EvaluationResults,
  RunEvaluator,
  runEvaluator,
} from "./evaluator.js";
import { v4 as uuidv4 } from "uuid";

type TargetT = (input: Record<string, any>) => Record<string, any>;
// Data format: dataset-name, dataset_id, or examples
type DataT = string | AsyncIterable<Example>;
// Summary evaluator runs over the whole dataset
// and reports aggregate metric(s)
type SummaryEvaluatorT =
  | ((
      runs: Array<Run>,
      examples: Array<Example>
    ) => Promise<EvaluationResult | EvaluationResults>)
  | ((
      runs: Array<Run>,
      examples: Array<Example>
    ) => EvaluationResult | EvaluationResults);
// Row-level evaluator
type EvaluatorT =
  | RunEvaluator
  | ((run: Run, example?: Example) => EvaluationResult);

interface _ForwardResults {
  run: Run;
  example: Example;
}

interface _ExperimentManagerArgs {
  data: DataT;
  experiment?: TracerSession | string;
  metadata?: Record<string, any>;
  client?: Client;
  runs?: AsyncIterable<Run>;
  evaluationResults?: AsyncIterable<EvaluationResults>;
  summaryResults?: AsyncIterable<EvaluationResults>;
}

interface EvaluateOptions {
  /**
   * The dataset to evaluate on. Can be a dataset name, a list of
   * examples, or a generator of examples.
   */
  data: DataT;
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
   * Metadata to attach to the experiment.
   * @default undefined
   */
  metadata?: Record<string, any>;
  /**
   * A prefix to provide for your experiment name.
   * @default undefined
   */
  experimentPrefix?: string;
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
   * Whether to block until the evaluation is complete.
   * @default true
   */
  blocking?: boolean;
}

export function evaluate(
  /**
   * The target system or function to evaluate.
   */
  target: TargetT,
  options: EvaluateOptions
): Promise<ExperimentResults> {
  return _evaluate(target, options);
}

interface ExperimentResultRow {
  run: Run;
  example: Example;
  evaluationResults: EvaluationResults;
}

class _ExperimentManagerMixin {
  client: Client;

  _experiment?: TracerSession;

  _experimentName: string;

  _metadata: Record<string, any>;

  get experimentName(): string {
    if (this._experimentName) {
      return this._experimentName;
    } else {
      throw new Error(
        "Experiment name not provided, and experiment not yet started."
      );
    }
  }

  constructor(args: {
    experiment?: TracerSession | string;
    metadata?: Record<string, any>;
    client?: Client;
  }) {
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
  }

  _getExperiment(): TracerSession {
    if (!this._experiment) {
      throw new Error("Experiment not yet started.");
    }
    return this._experiment;
  }

  async _getExperimentMetadata(): Promise<Record<string, any>> {
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

  async _getProject(firstExample: Example): Promise<TracerSession> {
    let project: TracerSession;
    if (!this._experiment) {
      try {
        const projectMetadata = await this._getExperimentMetadata();
        project = await this.client.createProject({
          projectName: this.experimentName,
          referenceDatasetId: firstExample.dataset_id,
          metadata: projectMetadata,
        });
      } catch (e: any) {
        if (String(e).includes("already exists")) {
          throw e;
        }
        throw new Error(
          `Experiment ${this._experimentName} already exists. Please use a different name.`
        );
      }
    } else {
      project = this._experiment;
    }
    return project;
  }

  _printExperimentStart(): void {
    // @TODO log with experiment URL
    console.log(`Starting evaluation of experiment: ${this.experimentName}`);
  }
}

/**
 * Manage the execution of experiments.
 *
 * Supports lazily running predictions and evaluations in parallel to facilitate
 * result streaming and early debugging.
 */
class _ExperimentManager extends _ExperimentManagerMixin {
  _data: DataT;

  _examples?: AsyncIterable<Example>;

  _runs?: AsyncIterable<Run>;

  _evaluationResults?: AsyncIterable<EvaluationResults>;

  _summaryResults?: AsyncIterable<EvaluationResults>;

  constructor(args: _ExperimentManagerArgs) {
    super({
      experiment: args.experiment,
      metadata: args.metadata,
      client: args.client,
    });
    this._data = args.data;
    this._runs = args.runs;
    this._evaluationResults = args.evaluationResults;
    this._summaryResults = args.summaryResults;
  }

  get examples(): AsyncIterable<Example> {
    if (this._examples === undefined) {
      return _resolveData(this._data, { client: this.client });
    } else {
      return this._examples;
    }
  }

  get datasetId(): Promise<string> {
    if (!this._experiment || !this._experiment.reference_dataset_id) {
      const examplesIterator = this.examples[Symbol.asyncIterator]();
      return examplesIterator.next().then((result) => {
        if (result.done) {
          throw new Error("No examples found in the dataset.");
        }
        return result.value.dataset_id;
      });
    }
    return Promise.resolve(this._experiment.reference_dataset_id);
  }

  get evaluationResults(): AsyncIterable<EvaluationResults> {
    if (this._evaluationResults === undefined) {
      return async function* (this: _ExperimentManager) {
        // In this case, we need evaluationResults to have the same
        // number of items as examples. Make a copy of this.examples
        // with `asyncTee` and yield empty results for each example.
        const examplesResults: AsyncIterable<Example>[] = [];
        for await (const item of asyncTee(this.examples)) {
          examplesResults.push(item);
        }
        const [examplesClone, examplesOriginal] = examplesResults;
        this._examples = examplesOriginal;

        for await (const _ of examplesClone) {
          yield { results: [] };
        }
      }.call(this);
    } else {
      return this._evaluationResults;
    }
  }

  get runs(): AsyncIterable<Run> {
    if (this._runs === undefined) {
      throw new Error(
        "Runs not provided in this experiment. Please predict first."
      );
    } else {
      return this._runs;
    }
  }

  async start(): Promise<_ExperimentManager> {
    const examplesIterator = this.examples[Symbol.asyncIterator]();
    const firstExample = (await examplesIterator.next()).value;
    const project = await this._getProject(firstExample);
    this._printExperimentStart();
    return new _ExperimentManager({
      data: this.examples,
      experiment: project,
      metadata: this._metadata,
      client: this.client,
      runs: this._runs,
      evaluationResults: this._evaluationResults,
      summaryResults: this._summaryResults,
    });
  }

  async withPredictions(
    target: TargetT,
    options?: {
      maxConcurrency?: number;
    }
  ): Promise<_ExperimentManager> {
    const experimentResults = this._predict(target, options);

    const results: AsyncIterable<any>[] = [];
    for await (const item of asyncTee(experimentResults)) {
      results.push(item);
    }
    const [r1, r2] = results;

    return new _ExperimentManager({
      data: (async function* (): AsyncIterable<Example> {
        for await (const pred of r1) {
          yield pred.example;
        }
      })(),
      experiment: this._experiment,
      metadata: this._metadata,
      client: this.client,
      runs: (async function* (): AsyncIterable<Run> {
        for await (const pred of r2) {
          yield pred.run;
        }
      })(),
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

    const results: AsyncIterable<ExperimentResultRow>[] = [];
    for await (const item of asyncTee(experimentResults, 3)) {
      results.push(item);
    }
    const [r1, r2, r3] = results;

    return new _ExperimentManager({
      data: (async function* (): AsyncIterable<Example> {
        for await (const result of r1) {
          yield result.example;
        }
      })(),
      experiment: this._experiment,
      metadata: this._metadata,
      client: this.client,
      runs: (async function* (): AsyncIterable<Run> {
        for await (const result of r2) {
          yield result.run;
        }
      })(),
      evaluationResults: (async function* (): AsyncIterable<EvaluationResults> {
        for await (const result of r3) {
          yield result.evaluationResults;
        }
      })(),
      summaryResults: this._summaryResults,
    });
  }

  async withSummaryEvaluators(
    summaryEvaluators: Array<SummaryEvaluatorT>
  ): Promise<_ExperimentManager> {
    const aggregateFeedbackGen =
      this._applySummaryEvaluators(summaryEvaluators);
    return new _ExperimentManager({
      data: this.examples,
      experiment: this._experiment,
      metadata: this._metadata,
      client: this.client,
      runs: this.runs,
      evaluationResults: this._evaluationResults,
      summaryResults: aggregateFeedbackGen,
    });
  }

  async *getResults(): AsyncIterable<ExperimentResultRow> {
    const runs: Run[] = [];
    const examples: Example[] = [];
    const evaluationResults: EvaluationResults[] = [];

    const examplesResults: AsyncIterable<Example>[] = [];
    for await (const item of asyncTee(this.examples)) {
      examplesResults.push(item);
    }
    const [examplesClone, examplesOriginal] = examplesResults;
    this._examples = examplesOriginal;

    const runsResults: AsyncIterable<Run>[] = [];
    for await (const item of asyncTee(this.runs)) {
      runsResults.push(item);
    }
    const [runsClone, runsOriginal] = runsResults;
    this._runs = runsOriginal;

    for await (const example of examplesClone) {
      examples.push(example);
      evaluationResults.push(
        (await (this.evaluationResults as AsyncGenerator).next()).value
      );
      runs.push((await (runsClone as AsyncGenerator).next()).value);
    }
    for (let i = 0; i < runs.length; i++) {
      console.log("get results yielding!!");
      yield {
        run: runs[i],
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
    for await (const evaluationResults of this._summaryResults) {
      console.log("Trying here ig", evaluationResults);
      results.push(...evaluationResults.results);
    }

    return { results };
  }

  // Private methods

  /**
   * Run the target function on the examples.
   * @param {TargetT} target The target function to evaluate.
   * @param options
   * @returns {AsyncGenerator<_ForwardResults>} An async generator of the results.
   */
  async *_predict(
    target: TargetT,
    options?: {
      maxConcurrency?: number;
    }
  ): AsyncGenerator<_ForwardResults> {
    const maxConcurrency = options?.maxConcurrency ?? 0;

    if (maxConcurrency === 0) {
      for await (const example of this.examples) {
        yield await _forward(
          target,
          example,
          this.experimentName,
          this._metadata,
          this.client
        );
      }
    } else {
      const caller = new AsyncCaller({
        maxConcurrency,
      });

      const futures: Array<Promise<_ForwardResults>> = [];

      for await (const example of this.examples) {
        futures.push(
          caller.call(
            _forward,
            target,
            example,
            this.experimentName,
            this._metadata,
            this.client
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
    currentResults: ExperimentResultRow
  ): Promise<ExperimentResultRow> {
    const { run, example, evaluationResults } = currentResults;
    for (const evaluator of evaluators) {
      try {
        const options = {
          reference_example_id: example.id,
          project_name: this.experimentName,
          metadata: {
            example_version: example.modified_at
              ? new Date(example.modified_at).toISOString()
              : new Date(example.created_at).toISOString(),
          },
          client: this.client,
        };
        const evaluatorResponse = await evaluator.evaluateRun(
          run,
          example,
          options
        );
        evaluationResults.results.push(
          ...(await this.client.logEvaluationFeedback(evaluatorResponse, run))
        );
      } catch (e) {
        console.error(
          `Error running evaluator ${evaluator.evaluateRun.name} on run ${run.id}: ${e}`
        );
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
  ): AsyncIterable<ExperimentResultRow> {
    const { maxConcurrency = 0 } = options || {};

    if (maxConcurrency === 0) {
      for await (const currentResults of this.getResults()) {
        yield this._runEvaluators(evaluators, currentResults);
      }
    } else {
      const caller = new AsyncCaller({
        maxConcurrency,
      });
      const futures: Promise<ExperimentResultRow>[] = [];
      for await (const currentResults of this.getResults()) {
        futures.push(
          caller.call(this._runEvaluators, evaluators, currentResults)
        );
      }

      for (const result of futures) {
        yield result;
      }
    }
  }

  async *_applySummaryEvaluators(
    summaryEvaluators: Array<SummaryEvaluatorT>
  ): AsyncGenerator<EvaluationResults> {
    const runs: Array<Run> = [];
    const examples: Array<Example> = [];

    for await (const example of this.examples) {
      console.log("examples inside _applySummaryEvaluators", example.id);
      examples.push(example);
      runs.push((await (this.runs as AsyncGenerator).next()).value);
    }

    const aggregateFeedback = [];
    const projectId = this._getExperiment().id;

    // how da hell does py do this?
    // issue -> reference example id passed at call time?
    // experiment name, experiment id (project id), project name ("evaluators") shall be passed in here!
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

    // @TODO: implement later
    // const futures: Promise<unknown>[] = [];
    // const caller = new AsyncCaller({ maxConcurrency: 1 });
    for (const evaluator of wrappedEvaluators) {
      try {
        console.log("Before running evaluator", runs.length, examples.length);
        const summaryEvalResult = await evaluator(runs, examples);
        const flattenedResults =
          this.client._selectEvalResults(summaryEvalResult);
        aggregateFeedback.push(...flattenedResults);
        for (const result of flattenedResults) {
          const { targetRunId, ...feedback } = result;
          const evaluatorInfo = feedback.evaluatorInfo;
          delete feedback.evaluatorInfo;

          await this.client.createFeedback(null, "key", {
            ...feedback,
            projectId: projectId,
            sourceInfo: evaluatorInfo,
          });

          // futures.push(
          //   caller.call(this.client.createFeedback, null, "key", {
          //     ...feedback,
          //     projectId: projectId,
          //     sourceInfo: evaluatorInfo,
          //   })
          // );
        }
      } catch (e) {
        console.error(
          `Error running summary evaluator ${evaluator.name}: ${JSON.stringify(
            e,
            null,
            2
          )}`
        );
      }
    }

    // await Promise.all(futures);

    yield {
      results: aggregateFeedback,
    };
  }

  async _getDatasetVersion(): Promise<string | undefined> {
    const examples: Example[] = [];
    for await (const example of this.examples) {
      examples.push(example);
    }

    const modifiedAt = examples.map((ex) => ex.modified_at);

    const maxModifiedAt =
      modifiedAt.length > 0
        ? new Date(
            Math.max(...modifiedAt.map((date) => new Date(date).getTime()))
          )
        : undefined;

    return maxModifiedAt?.toISOString();
  }

  async _end(): Promise<void> {
    const experiment = this._experiment;
    if (!experiment) {
      throw new Error("Experiment not yet started.");
    }
    const projectMetadata = await this._getExperimentMetadata();
    projectMetadata["dataset_version"] = this._getDatasetVersion();

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

  [Symbol.asyncIterator](): AsyncIterableIterator<ExperimentResultRow> {
    return this;
  }

  async next(): Promise<IteratorResult<ExperimentResultRow>> {
    if (this.processedCount < this.results.length) {
      const result = this.results[this.processedCount];
      this.processedCount++;
      return { value: result, done: false };
    } else {
      return { value: undefined, done: true };
    }
  }

  async processData(manager: _ExperimentManager): Promise<void> {
    for await (const item of manager.getResults()) {
      this.results.push(item);
    }
    console.log("Trying to get summaries");
    this.summaryResults = await manager.getSummaryScores();
  }

  get length(): number {
    return this.results.length;
  }

  toString(): string {
    return `<ExperimentResults ${this.experimentName}>`;
  }

  async wait(): Promise<void> {
    // No need to wait in TypeScript since there are no threads
    // The processData method is already asynchronous
  }
}

const _isCallable = (target: TargetT | AsyncIterable<Run>): boolean =>
  Boolean(
    typeof target === "function" ||
      ("invoke" in target && typeof target.invoke === "function")
  );

async function _evaluate(
  target: TargetT | AsyncIterable<Run>,
  fields: EvaluateOptions & {
    experiment?: TracerSession;
  }
): Promise<ExperimentResults> {
  const client = fields.client ?? new Client();
  const runs = _isCallable(target) ? null : (target as AsyncIterable<Run>);
  const [experiment_, newRuns] = await _resolveExperiment(
    fields.experiment ?? null,
    runs,
    client
  );

  let manager = await new _ExperimentManager({
    data: fields.data,
    client,
    metadata: fields.metadata,
    experiment: experiment_ ?? fields.experimentPrefix,
    runs: newRuns ?? undefined,
  }).start();

  if (_isCallable(target)) {
    manager = await manager.withPredictions(target as TargetT, {
      maxConcurrency: fields.maxConcurrency,
    });
  }
  if (fields.evaluators) {
    manager = await manager.withEvaluators(fields.evaluators, {
      maxConcurrency: fields.maxConcurrency,
    });
  }
  if (fields.summaryEvaluators) {
    manager = await manager.withSummaryEvaluators(fields.summaryEvaluators);
  }
  // Start consuming the results.
  const results = new ExperimentResults(manager);
  await results.processData(manager);
  return results;
}

async function _forward(
  fn: (...args: any[]) => Promise<any> | any, // TODO fix this type. What is `rh.SupportsLangsmithExtra`?
  example: Example,
  experimentName: string,
  metadata: Record<string, any>,
  client: Client
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
  };

  const wrappedFn = wrapFunctionAndEnsureTraceable(fn, options) as ReturnType<
    typeof traceable
  >;

  try {
    await wrappedFn(example.inputs);
  } catch (e) {
    console.error(
      `Error running target function: ${JSON.stringify(e, null, 2)}`
    );
  }

  if (!run) {
    throw new Error("Run not created by target function.");
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
  }
): AsyncIterable<Example> {
  if (typeof data === "string" && isUUIDv4(data)) {
    return options.client.listExamples({ datasetId: data });
  }
  if (typeof data === "string") {
    return options.client.listExamples({ datasetName: data });
  }
  return data;
}

async function wrapSummaryEvaluators(
  evaluators: SummaryEvaluatorT[],
  optionsArray?: Partial<RunTreeConfig>[]
): Promise<SummaryEvaluatorT[]> {
  async function _wrap(
    evaluator: SummaryEvaluatorT
  ): Promise<SummaryEvaluatorT> {
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
          return Promise.resolve(evaluator(runs, examples));
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

  const results: SummaryEvaluatorT[] = [];
  for (let i = 0; i < evaluators.length; i++) {
    results.push(await _wrap(evaluators[i]));
  }
  return results;
}

async function* asyncTee<T>(
  iterable: AsyncIterable<T>,
  n = 2
): AsyncGenerator<AsyncIterable<T>, void, undefined> {
  const iterators: Array<AsyncIterable<T>> = [];
  const cache: T[][] = Array.from({ length: n }, () => []);

  const iterator = iterable[Symbol.asyncIterator]();

  async function* createIterator(
    index: number
  ): AsyncGenerator<T, void, unknown> {
    let item: IteratorResult<T>;
    let i = 0;

    while (i < cache[index].length) {
      yield cache[index][i];
      i++;
    }

    while (!(item = await iterator.next()).done) {
      cache.forEach((arr) => arr.push(item.value));
      yield item.value;
    }
  }

  for (let i = 0; i < n; i++) {
    iterators.push(createIterator(i));
  }

  yield* iterators;
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
  runs: AsyncIterable<Run> | null,
  client: Client
): Promise<
  [TracerSession | string | undefined, AsyncIterable<Run> | undefined]
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
    const results: AsyncIterable<Run>[] = [];
    for await (const item of asyncTee(runs)) {
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

export function atee<T>(
  iter: AsyncGenerator<T>,
  length = 2
): AsyncGenerator<T>[] {
  const buffers = Array.from(
    { length },
    () => [] as Array<IteratorResult<T> | IteratorReturnResult<T>>
  );
  return buffers.map(async function* makeIter(buffer) {
    while (true) {
      if (buffer.length === 0) {
        const result = await iter.next();
        for (const buffer of buffers) {
          buffer.push(result);
        }
      } else if (buffer[0].done) {
        return;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        yield buffer.shift()!.value;
      }
    }
  });
}
