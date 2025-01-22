import { Client } from "../client.js";
import * as uuid from "uuid";
import {
  RunTree,
  RunTreeConfig,
  convertToDottedOrderFormat,
} from "../run_trees.js";
import {
  toArray,
  waitUntil,
  pollRunsUntilCount,
  sanitizePresignedUrls,
} from "./utils.js";

test.concurrent(
  "Test post and patch run",
  async () => {
    const projectName = `__test_run_tree_js ${uuid.v4()}`;
    const langchainClient = new Client({ timeout_ms: 30_000 });
    const parentRunConfig: RunTreeConfig = {
      name: "parent_run",
      run_type: "chain",
      inputs: { text: "hello world" },
      project_name: projectName,
      serialized: {},
      client: langchainClient,
    };

    const parent_run = new RunTree(parentRunConfig);
    expect(parent_run.trace_id).toEqual(parent_run.id);
    expect(parent_run.dotted_order).toEqual(
      convertToDottedOrderFormat(parent_run.start_time, parent_run.id)
    );
    await parent_run.postRun();

    const child_llm_run = parent_run.createChild({
      name: "child_run",
      run_type: "llm",
      inputs: { text: "hello world" },
    });
    expect(child_llm_run.dotted_order).toEqual(
      parent_run.dotted_order +
        "." +
        convertToDottedOrderFormat(
          child_llm_run.start_time,
          child_llm_run.id,
          2
        )
    );
    expect(child_llm_run.trace_id).toEqual(parent_run.trace_id);
    await child_llm_run.postRun();

    const child_chain_run = await parent_run.createChild({
      name: "child_chain_run",
      run_type: "chain",
      inputs: { text: "hello world" },
    });
    await child_chain_run.postRun();

    const grandchild_chain_run = await child_chain_run.createChild({
      name: "grandchild_chain_run",
      run_type: "chain",
      inputs: { text: "hello world" },
    });
    await grandchild_chain_run.postRun();
    await grandchild_chain_run.end({ output: ["Hi"] });
    await grandchild_chain_run.patchRun();
    await child_chain_run.end(undefined, "AN ERROR");
    await child_chain_run.patchRun();
    const child_tool_run = await parent_run.createChild({
      name: "child_tool_run",
      run_type: "tool",
      inputs: { text: "hello world" },
    });
    await child_tool_run.postRun();
    await child_tool_run.end({ output: ["Hi"] });
    await child_tool_run.patchRun();
    await child_llm_run.end({ prompts: ["hello world"] });
    await child_llm_run.patchRun();
    await parent_run.end({ output: ["Hi"] });
    await parent_run.patchRun();

    await waitUntil(
      async () => {
        try {
          const runs = await toArray(langchainClient.listRuns({ projectName }));
          return runs.length === 5;
        } catch (e) {
          return false;
        }
      },
      30_000, // Wait up to 30 seconds
      3000 // every 3 second
    );
    const runs = await toArray(langchainClient.listRuns({ projectName }));
    expect(runs.length).toEqual(5);
    const runMap = new Map(runs.map((run) => [run.name, run]));
    expect(runMap.get("child_run")?.parent_run_id).toEqual(
      runMap.get("parent_run")?.id
    );
    expect(runMap.get("child_chain_run")?.parent_run_id).toEqual(
      runMap.get("parent_run")?.id
    );
    expect(runMap.get("grandchild_chain_run")?.parent_run_id).toEqual(
      runMap.get("child_chain_run")?.id
    );
    expect(runMap.get("child_tool_run")?.parent_run_id).toEqual(
      runMap.get("parent_run")?.id
    );
    expect(runMap.get("parent_run")?.parent_run_id).toBeNull();
    await waitUntil(
      async () => {
        try {
          const runs_ = await toArray(
            langchainClient.listRuns({ traceId: runs[0].trace_id })
          );
          return runs_.length === 5;
        } catch (e) {
          return false;
        }
      },
      30_000, // Wait up to 30 seconds
      3000 // every 3 second
    );

    const traceRunsIter = langchainClient.listRuns({
      traceId: runs[0].trace_id,
    });
    const traceRuns = await toArray(traceRunsIter);
    expect(traceRuns.length).toEqual(5);
    // Sort by dotted order and assert runs lists are equal
    const sortedRuns = sanitizePresignedUrls(
      runs.sort((a, b) =>
        (a?.dotted_order ?? "").localeCompare(b?.dotted_order ?? "")
      )
    );
    const sortedTraceRuns = sanitizePresignedUrls(
      traceRuns.sort((a, b) =>
        (a?.dotted_order ?? "").localeCompare(b?.dotted_order ?? "")
      )
    );
    expect(sortedRuns).toEqual(sortedTraceRuns);
    await langchainClient.deleteProject({ projectName });
  },
  120_000
);

test.concurrent(
  "Test list runs multi project",
  async () => {
    const projectNames = [
      `__My JS Tracer Project - test_list_runs_multi_project_${uuid.v4()}`,
      `__My JS Tracer Project - test_list_runs_multi_project2_${uuid.v4()}`,
    ];

    try {
      const langchainClient = new Client({ timeout_ms: 30000 });

      for (const project of projectNames) {
        if (await langchainClient.hasProject({ projectName: project })) {
          await langchainClient.deleteProject({ projectName: project });
        }
      }

      const parentRunConfig: RunTreeConfig = {
        name: "parent_run",
        inputs: { text: "hello world" },
        project_name: projectNames[0],
        client: langchainClient,
      };

      const parent_run = new RunTree(parentRunConfig);
      await parent_run.postRun();
      await parent_run.end({ output: "Completed: foo" });
      await parent_run.patchRun();

      const parentRunConfig2: RunTreeConfig = {
        name: "parent_run",
        inputs: { text: "hello world" },
        project_name: projectNames[1],
        client: langchainClient,
      };

      const parent_run2 = new RunTree(parentRunConfig2);
      await parent_run2.postRun();
      await parent_run2.end({ output: "Completed: foo" });
      await parent_run2.patchRun();
      await pollRunsUntilCount(langchainClient, projectNames[0], 1);
      await pollRunsUntilCount(langchainClient, projectNames[1], 1);

      const runsIter = langchainClient.listRuns({
        projectName: projectNames,
      });
      const runs = await toArray(runsIter);

      expect(runs.length).toBe(2);
      expect(
        runs.every((run) => run?.outputs?.["output"] === "Completed: foo")
      ).toBe(true);
      expect(runs[0].session_id).not.toBe(runs[1].session_id);
    } finally {
      const langchainClient = new Client();

      for (const project of projectNames) {
        if (await langchainClient.hasProject({ projectName: project })) {
          try {
            await langchainClient.deleteProject({ projectName: project });
          } catch (e) {
            // Pass
          }
        }
      }
    }
  },
  120_000
);

test.concurrent(
  "Test end() write to metadata",
  async () => {
    const runId = uuid.v4();
    const projectName = `__test_end_metadata_run_tree_js ${runId}`;
    const langchainClient = new Client({ timeout_ms: 30_000 });
    const parentRunConfig: RunTreeConfig = {
      name: "parent_run",
      id: runId,
      run_type: "chain",
      project_name: projectName,
      client: langchainClient,
    };

    const parentRun = new RunTree(parentRunConfig);
    await parentRun.end({ output: ["Hi"] }, undefined, undefined, {
      final_metadata: runId,
    });
    await parentRun.postRun();

    await pollRunsUntilCount(langchainClient, projectName, 1);
    const runs = await toArray(langchainClient.listRuns({ id: [runId] }));
    expect(runs.length).toEqual(1);
    expect(runs[0].extra);
    await langchainClient.deleteProject({ projectName });
  },
  120_000
);
