import * as uuid from "uuid";
import { AsyncCaller, AsyncCallerParams } from "./utils/async_caller.js";
import { BaseRun, KVMap, RunCreate, RunType, RunUpdate } from "./schemas.js";
import { getEnvironmentVariable, getRuntimeEnvironment } from "./utils/env.js";

export interface RunTreeConfig {
  name: string;
  run_type: RunType;
  id?: string;
  callerOptions?: AsyncCallerParams;
  apiUrl?: string;
  apiKey?: string;
  session_name?: string;
  execution_order?: number;
  child_execution_order?: number;
  parentRun?: RunTree;
  child_runs?: RunTree[];
  start_time?: number;
  end_time?: number;
  extra?: KVMap;
  error?: string;
  serialized?: object;
  inputs?: KVMap;
  outputs?: KVMap;
  reference_example_id?: string;
}

export class RunTree implements BaseRun {
  id: string;
  name: RunTreeConfig["name"];
  run_type: RunTreeConfig["run_type"];
  session_name: string;
  parentRun?: RunTree;
  child_runs: RunTree[];
  execution_order: number;
  child_execution_order: number;
  apiUrl: string;
  apiKey?: string;
  callerOptions: AsyncCallerParams;
  caller: AsyncCaller;
  start_time: number;
  end_time: number;
  extra?: KVMap;
  error?: string;
  serialized: object;
  inputs: KVMap;
  outputs?: KVMap;
  reference_example_id?: string;

  constructor(config: RunTreeConfig) {
    const defaultConfig = RunTree.getDefaultConfig();
    Object.assign(this, { ...defaultConfig, ...config });
    this.caller = new AsyncCaller(this.callerOptions);
  }
  private static getDefaultConfig(): object {
    return {
      id: uuid.v4(),
      session_name: "default",
      child_runs: [],
      execution_order: 1,
      child_execution_order: 1,
      apiUrl:
        getEnvironmentVariable("LANGCHAIN_ENDPOINT") ?? "http://localhost:1984",
      apiKey: getEnvironmentVariable("LANGCHAIN_API_KEY"),
      callerOptions: {},
      start_time: Date.now(),
      end_time: Date.now(),
      serialized: {},
      inputs: {},
    };
  }

  public async createChild(config: RunTreeConfig): Promise<RunTree> {
    const child = new RunTree({
      ...config,
      parentRun: this,
      session_name: this.session_name,
      apiUrl: this.apiUrl,
      apiKey: this.apiKey,
      callerOptions: this.callerOptions,
      execution_order: this.child_execution_order + 1,
      child_execution_order: this.child_execution_order + 1,
    });

    this.child_runs.push(child);
    return child;
  }

  async end(
    outputs?: KVMap,
    error?: string,
    end_time = Date.now()
  ): Promise<void> {
    this.outputs = outputs;
    this.error = error;
    this.end_time = end_time;

    if (this.parentRun) {
      this.parentRun.child_execution_order = Math.max(
        this.parentRun.child_execution_order,
        this.child_execution_order
      );
    }
  }

  private get headers(): Headers {
    const headers = new Headers({ "Content-Type": "application/json" });
    if (this.apiKey) {
      headers.append("x-api-key", this.apiKey);
    }
    return headers;
  }

  private async post(data: string): Promise<void> {
    const url = `${this.apiUrl}/runs`;
    await this.caller.call(fetch, url, {
      method: "POST",
      body: data,
      headers: this.headers,
    });
  }

  private async _convertToCreate(
    run: RunTree,
    excludeChildRuns = true
  ): Promise<RunCreate> {
    const runExtra = run.extra ?? {};
    runExtra.runtime = await getRuntimeEnvironment();
    let child_runs: RunCreate[];
    let parent_run_id: string | undefined;
    if (!excludeChildRuns) {
      child_runs = await Promise.all(
        run.child_runs.map((child_run) =>
          this._convertToCreate(child_run, excludeChildRuns)
        )
      );
      parent_run_id = undefined;
    } else {
      parent_run_id = run.parentRun?.id;
      child_runs = [];
    }
    const persistedRun: RunCreate = {
      id: run.id,
      name: run.name,
      start_time: run.start_time,
      end_time: run.end_time,
      run_type: run.run_type,
      reference_example_id: run.reference_example_id,
      extra: runExtra,
      execution_order: run.execution_order,
      serialized: run.serialized,
      error: run.error,
      inputs: run.inputs,
      outputs: run.outputs,
      session_name: run.session_name,
      child_runs: child_runs,
      parent_run_id: parent_run_id,
    };
    return persistedRun;
  }

  async postRun(excludeChildRuns = true): Promise<void> {
    const runCreate = await this._convertToCreate(this, excludeChildRuns);
    const data = JSON.stringify(runCreate);
    await this.post(data);
  }

  private async patch(data: string): Promise<void> {
    const url = `${this.apiUrl}/runs/${this.id}`;
    await this.caller.call(fetch, url, {
      method: "PATCH",
      body: data,
      headers: this.headers,
    });
  }

  async patchRun(): Promise<void> {
    const runUpdate: RunUpdate = {
      end_time: this.end_time,
      error: this.error,
      outputs: this.outputs,
      parent_run_id: this.parentRun?.id,
      reference_example_id: this.reference_example_id,
    };

    const data = JSON.stringify(runUpdate);
    await this.patch(data);
  }
}
