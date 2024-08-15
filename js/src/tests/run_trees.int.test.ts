import { Client } from "../client.js";
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
import { v4 as uuidv4 } from "uuid";

test.concurrent(
  "Test post and patch run",
  async () => {
    const projectName = `__test_run_tree`;
    const langchainClient = new Client({ timeout_ms: 30000 });
    const runMeta = uuidv4();

    const parentRunConfig: RunTreeConfig = {
      name: "parent_run",
      run_type: "chain",
      inputs: { text: "hello world" },
      project_name: projectName,
      serialized: {},
      client: langchainClient,
      metadata: { test_run: runMeta },
    };

    const parent_run = new RunTree(parentRunConfig);
    expect(parent_run.trace_id).toEqual(parent_run.id);
    expect(parent_run.dotted_order).toEqual(
      convertToDottedOrderFormat(parent_run.start_time, parent_run.id)
    );
    await parent_run.postRun();

    const child_llm_run = await parent_run.createChild({
      name: "child_run",
      run_type: "llm",
      inputs: { text: "hello world" },
      metadata: { test_run: runMeta },
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
      metadata: { test_run: runMeta },
    });
    await child_chain_run.postRun();

    const grandchild_chain_run = await child_chain_run.createChild({
      name: "grandchild_chain_run",
      run_type: "chain",
      inputs: { text: "hello world" },
      metadata: { test_run: runMeta },
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
      metadata: { test_run: runMeta },
    });
    await child_tool_run.postRun();
    await child_tool_run.end({ output: ["Hi"] });
    await child_tool_run.patchRun();
    await child_llm_run.end({ prompts: ["hello world"] });
    await child_llm_run.patchRun();
    await parent_run.end({ output: ["Hi"] });
    await parent_run.patchRun();

    const filter = `and(eq(metadata_key, "test_run"), eq(metadata_value, "${runMeta}"))`;
    await waitUntil(
      async () => {
        try {
          const runs = await toArray(
            langchainClient.listRuns({ projectName, filter })
          );
          return runs.length === 5;
        } catch (e) {
          return false;
        }
      },
      30_000, // Wait up to 30 seconds
      3000 // every 3 second
    );
    const runs = await toArray(
      langchainClient.listRuns({ projectName, filter })
    );
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

    const traceRunsIter = langchainClient.listRuns({
      traceId: runs[0].trace_id,
      filter,
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
  },
  120_000
);

test.concurrent(
  "Test list runs multi project",
  async () => {
    const projectNames = [
      "__My JS Tracer Project - test_list_runs_multi_project",
      "__My JS Tracer Project - test_list_runs_multi_project2",
    ];
    const runMeta = uuidv4();
    const langchainClient = new Client({ timeout_ms: 30000 });

    const parentRunConfig: RunTreeConfig = {
      name: "parent_run",
      inputs: { text: "hello world" },
      project_name: projectNames[0],
      client: langchainClient,
      metadata: { test_run: runMeta },
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
      metadata: { test_run: runMeta },
    };

    const parent_run2 = new RunTree(parentRunConfig2);
    await parent_run2.postRun();
    await parent_run2.end({ output: "Completed: foo" });
    await parent_run2.patchRun();

    const filter = `and(eq(metadata_key, "test_run"), eq(metadata_value, "${runMeta}"))`;
    await pollRunsUntilCount(
      langchainClient,
      projectNames[0],
      1,
      undefined,
      filter
    );
    await pollRunsUntilCount(
      langchainClient,
      projectNames[1],
      1,
      undefined,
      filter
    );

    const runsIter = langchainClient.listRuns({
      projectName: projectNames,
      filter,
    });
    const runs = await toArray(runsIter);

    expect(runs.length).toBe(2);
    expect(
      runs.every((run) => run?.outputs?.["output"] === "Completed: foo")
    ).toBe(true);
    expect(runs[0].session_id).not.toBe(runs[1].session_id);
  },
  120_000
);
