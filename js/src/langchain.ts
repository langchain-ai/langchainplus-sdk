// These `@langchain/core` imports are intentionally not peer dependencies
// to avoid package manager issues around circular dependencies.
// eslint-disable-next-line import/no-extraneous-dependencies
import { CallbackManager } from "@langchain/core/callbacks/manager";
// eslint-disable-next-line import/no-extraneous-dependencies
import { LangChainTracer } from "@langchain/core/tracers/tracer_langchain";
// eslint-disable-next-line import/no-extraneous-dependencies
import {
  Runnable,
  RunnableConfig,
  patchConfig,
  getCallbackManagerForConfig,
} from "@langchain/core/runnables";

import { RunTree } from "./run_trees.js";
import { Run } from "./schemas.js";
import {
  TraceableFunction,
  getCurrentRunTree,
  isTraceableFunction,
} from "./traceable.js";
import { isAsyncIterable, isIteratorLike } from "./utils/asserts.js";

/**
 * Converts the current run tree active within a traceable-wrapped function
 * into a LangChain compatible callback manager. This is useful to handoff tracing
 * from LangSmith to LangChain Runnables and LLMs.
 *
 * @param {RunTree | undefined} currentRunTree Current RunTree from within a traceable-wrapped function. If not provided, the current run tree will be inferred from AsyncLocalStorage.
 * @returns {CallbackManager | undefined} Callback manager used by LangChain Runnable objects.
 */
export async function getLangchainCallbacks(
  currentRunTree?: RunTree | undefined
) {
  const runTree: RunTree | undefined = currentRunTree ?? getCurrentRunTree();
  if (!runTree) return undefined;

  // TODO: CallbackManager.configure() is only async due to LangChainTracer
  // factory being unnecessarily async.
  let callbacks = await CallbackManager.configure();
  if (!callbacks && runTree.tracingEnabled) {
    callbacks = new CallbackManager();
  }

  let langChainTracer = callbacks?.handlers.find(
    (handler): handler is LangChainTracer =>
      handler?.name === "langchain_tracer"
  );

  if (!langChainTracer && runTree.tracingEnabled) {
    langChainTracer = new LangChainTracer();
    callbacks?.addHandler(langChainTracer);
  }

  const runMap = new Map<string, Run>();

  // find upward root run
  let rootRun = runTree;
  const rootVisited = new Set<string>();
  while (rootRun.parent_run) {
    if (rootVisited.has(rootRun.id)) break;
    rootVisited.add(rootRun.id);
    rootRun = rootRun.parent_run;
  }

  const queue = [rootRun];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current.id)) continue;
    visited.add(current.id);

    runMap.set(current.id, current as Run);
    if (current.child_runs) {
      queue.push(...current.child_runs);
    }
  }

  if (callbacks != null) {
    Object.assign(callbacks, { _parentRunId: runTree.id });
  }

  if (langChainTracer != null) {
    if (
      "updateFromRunTree" in langChainTracer &&
      typeof langChainTracer === "function"
    ) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore @langchain/core can use a different version of LangSmith
      langChainTracer.updateFromRunTree(runTree);
    } else {
      Object.assign(langChainTracer, {
        runMap,
        client: runTree.client,
        projectName: runTree.project_name || langChainTracer.projectName,
        exampleId: runTree.reference_example_id || langChainTracer.exampleId,
      });
    }
  }

  return callbacks;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTraceableFunction = TraceableFunction<(...any: any[]) => any>;

/**
 * RunnableTraceable is a Runnable that wraps a traceable function.
 * This allows adding Langsmith traced functions into LangChain sequences.
 */
export class RunnableTraceable<RunInput, RunOutput> extends Runnable<
  RunInput,
  RunOutput
> {
  lc_serializable = false;

  lc_namespace = ["langchain_core", "runnables"];

  protected func: AnyTraceableFunction;

  constructor(fields: { func: AnyTraceableFunction }) {
    super(fields);

    if (!isTraceableFunction(fields.func)) {
      throw new Error(
        "RunnableTraceable requires a function that is wrapped in traceable higher-order function"
      );
    }

    this.func = fields.func;
  }

  async invoke(input: RunInput, options?: Partial<RunnableConfig>) {
    const [config] = this._getOptionsList(options ?? {}, 1);
    const callbacks = await getCallbackManagerForConfig(config);

    return (await this.func(
      patchConfig(config, { callbacks }),
      input
    )) as RunOutput;
  }

  async *_streamIterator(
    input: RunInput,
    options?: Partial<RunnableConfig>
  ): AsyncGenerator<RunOutput> {
    const result = await this.invoke(input, options);

    if (isAsyncIterable(result)) {
      for await (const item of result) {
        yield item as RunOutput;
      }
      return;
    }

    if (isIteratorLike(result)) {
      while (true) {
        const state: IteratorResult<unknown> = result.next();
        if (state.done) break;
        yield state.value as RunOutput;
      }
      return;
    }

    yield result;
  }

  static from(func: AnyTraceableFunction) {
    return new RunnableTraceable({ func });
  }
}
