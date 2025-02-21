import {
  Dataset,
  Example,
  ExampleUpdateWithAttachments,
  Run,
  TracerSession,
} from "../schemas.js";
import {
  FunctionMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";

import { Client } from "../client.js";
import { v4 as uuidv4 } from "uuid";
import { ExampleCreate } from "../schemas.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRunsFactory,
  deleteDataset,
  deleteProject,
  toArray,
  waitUntil,
} from "./utils.js";
import { ChatPromptTemplate, PromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { RunnableSequence } from "@langchain/core/runnables";
import { load } from "langchain/load";
import { _getFetchImplementation } from "../singletons/fetch.js";

type CheckOutputsType = boolean | ((run: Run) => boolean);
async function waitUntilRunFound(
  client: Client,
  runId: string,
  checkOutputs: CheckOutputsType = false
) {
  return waitUntil(
    async () => {
      try {
        const run = await client.readRun(runId);
        if (checkOutputs) {
          const hasOutputs = run.outputs !== null && run.outputs !== undefined;
          if (typeof checkOutputs === "boolean") {
            return hasOutputs;
          } else if (typeof checkOutputs === "function") {
            return hasOutputs && checkOutputs(run);
          }
        }
        return true;
      } catch (e) {
        return false;
      }
    },
    210_000,
    5_000
  );
}

// Test Dataset Creation, List, Read, Delete + upload CSV
// Test Example Creation, List, Read, Update, Delete
test.concurrent("Test LangSmith Client Dataset CRD", async () => {
  const client = new Client({ autoBatchTracing: false });

  const csvContent = `col1,col2,col3,col4\nval1,val2,val3,val4`;
  const blobData = new Blob([Buffer.from(csvContent)]);

  const description = "Test Dataset";
  const inputKeys = ["col1", "col3"];
  const outputKeys = ["col2", "col4"];
  const fileName = "__some_file.int.csv";
  await deleteDataset(client, fileName);
  const newDataset = await client.uploadCsv({
    csvFile: blobData,
    fileName: fileName,
    description,
    inputKeys,
    outputKeys,
  });
  expect(newDataset).toHaveProperty("id");
  expect(newDataset.description).toBe(description);

  const dataset = await client.readDataset({ datasetId: newDataset.id });
  const datasetId = dataset.id;
  const dataset2 = await client.readDataset({ datasetId });
  expect(dataset.id).toBe(dataset2.id);

  const datasets = await toArray(
    client.listDatasets({ datasetName: fileName })
  );
  expect(datasets.length).toBeGreaterThan(0);
  expect(datasets.map((d) => d.id)).toContain(datasetId);

  const example = await client.createExample(
    { col1: "addedExampleCol1" },
    { col2: "addedExampleCol2" },
    { datasetId: newDataset.id, split: "my_split" }
  );
  const exampleValue = await client.readExample(example.id);
  expect(exampleValue.inputs.col1).toBe("addedExampleCol1");
  expect(exampleValue.outputs?.col2).toBe("addedExampleCol2");

  const examples = await toArray(
    client.listExamples({ datasetId: newDataset.id })
  );
  expect(examples.length).toBe(2);
  expect(examples.map((e) => e.id)).toContain(example.id);

  const _examples = await toArray(
    client.listExamples({ datasetId: newDataset.id, splits: ["my_split"] })
  );
  expect(_examples.length).toBe(1);
  expect(_examples.map((e) => e.id)).toContain(example.id);

  await client.updateExample(example.id, {
    inputs: { col1: "updatedExampleCol1" },
    outputs: { col2: "updatedExampleCol2" },
    split: ["my_split2"],
  });
  // Says 'example updated' or something similar
  const newExampleValue = await client.readExample(example.id);
  expect(newExampleValue.inputs.col1).toBe("updatedExampleCol1");
  expect(newExampleValue.metadata?.dataset_split).toStrictEqual(["my_split2"]);

  await client.updateExample(example.id, {
    inputs: { col1: "updatedExampleCol3" },
    outputs: { col2: "updatedExampleCol4" },
    split: "my_split3",
  });
  // Says 'example updated' or something similar
  const newExampleValue2 = await client.readExample(example.id);
  expect(newExampleValue2.inputs.col1).toBe("updatedExampleCol3");
  expect(newExampleValue2.metadata?.dataset_split).toStrictEqual(["my_split3"]);

  const newExample = await client.createExample(
    { col1: "newAddedExampleCol1" },
    { col2: "newAddedExampleCol2" },
    { datasetId: newDataset.id }
  );
  const newExampleValue_ = await client.readExample(newExample.id);
  expect(newExampleValue_.inputs.col1).toBe("newAddedExampleCol1");
  expect(newExampleValue_.outputs?.col2).toBe("newAddedExampleCol2");

  await client.updateExamples([
    {
      id: newExample.id,
      inputs: { col1: "newUpdatedExampleCol1" },
      outputs: { col2: "newUpdatedExampleCol2" },
      metadata: { foo: "baz" },
    },
    {
      id: example.id,
      inputs: { col1: "newNewUpdatedExampleCol" },
      outputs: { col2: "newNewUpdatedExampleCol2" },
      metadata: { foo: "qux" },
    },
  ]);
  const updatedExample = await client.readExample(newExample.id);
  expect(updatedExample.inputs.col1).toBe("newUpdatedExampleCol1");
  expect(updatedExample.outputs?.col2).toBe("newUpdatedExampleCol2");
  expect(updatedExample.metadata?.foo).toBe("baz");

  const updatedExample2 = await client.readExample(example.id);
  expect(updatedExample2.inputs.col1).toBe("newNewUpdatedExampleCol");
  expect(updatedExample2.outputs?.col2).toBe("newNewUpdatedExampleCol2");
  expect(updatedExample2.metadata?.foo).toBe("qux");

  await client.deleteExample(example.id);
  const examples2 = await toArray(
    client.listExamples({ datasetId: newDataset.id })
  );
  expect(examples2.length).toBe(2);

  await client.deleteDataset({ datasetId });
  const rawDataset = await client.createDataset(fileName, {
    description: "Test Dataset",
  });
  await client.deleteDataset({ datasetId: rawDataset.id });
});

test.concurrent(
  "test create dataset",
  async () => {
    const langchainClient = new Client({ autoBatchTracing: false });
    const datasetName = "__test_create_dataset JS";
    const datasets = await toArray(
      langchainClient.listDatasets({ datasetName })
    );
    datasets.map(async (dataset: Dataset) => {
      if (dataset.name === datasetName) {
        await langchainClient.deleteDataset({ datasetName });
      }
    });
    const dataset = await langchainClient.createDataset(datasetName, {
      dataType: "llm",
      metadata: { key: "valuefoo" },
    });
    await langchainClient.createExample(
      { input: "hello world" },
      { output: "hi there" },
      {
        datasetId: dataset.id,
      }
    );
    const loadedDataset = await langchainClient.readDataset({ datasetName });
    expect(loadedDataset.data_type).toEqual("llm");

    const datasetsByMetadata = await toArray(
      langchainClient.listDatasets({ metadata: { key: "valuefoo" } })
    );
    expect(datasetsByMetadata.length).toEqual(1);
    expect(datasetsByMetadata.map((d) => d.id)).toContain(dataset.id);
    await langchainClient.deleteDataset({ datasetName });
  },
  180_000
);

test.concurrent(
  "Test share and unshare run",
  async () => {
    const langchainClient = new Client({ autoBatchTracing: false });

    // Create a new run
    const runId = uuidv4();
    await langchainClient.createRun({
      name: "Test run",
      inputs: { input: "hello world" },
      run_type: "chain",
      id: runId,
    });

    await waitUntilRunFound(langchainClient, runId);
    const sharedUrl = await langchainClient.shareRun(runId);
    const response = await _getFetchImplementation()(sharedUrl);
    expect(response.status).toEqual(200);
    expect(await langchainClient.readRunSharedLink(runId)).toEqual(sharedUrl);

    await langchainClient.unshareRun(runId);
    const sharedLink = await langchainClient.readRunSharedLink(runId);
    expect(sharedLink).toBe(undefined);
  },
  180_000
);

test.concurrent(
  "Test list datasets",
  async () => {
    const langchainClient = new Client({ autoBatchTracing: false });
    const datasetName1 = "___TEST dataset1 JS";
    const datasetName2 = "___TEST dataset2 JS";
    await deleteDataset(langchainClient, datasetName1);
    await deleteDataset(langchainClient, datasetName2);
    // Create two new datasets
    const dataset1 = await langchainClient.createDataset(datasetName1, {
      dataType: "llm",
    });
    const dataset2 = await langchainClient.createDataset(datasetName2, {
      dataType: "kv",
    });

    // List datasets by ID
    const datasetsById: Dataset[] = [];
    const datasetsByIdIterable = langchainClient.listDatasets({
      datasetIds: [dataset1.id, dataset2.id],
    });
    for await (const dataset of datasetsByIdIterable) {
      datasetsById.push(dataset);
    }
    expect(datasetsById).toHaveLength(2);
    expect(datasetsById.map((dataset) => dataset.id)).toContain(dataset1.id);
    expect(datasetsById.map((dataset) => dataset.id)).toContain(dataset2.id);

    // List datasets by name
    const datasetsByNameIterable = langchainClient.listDatasets({
      datasetName: datasetName1,
    });
    const datasetsByName = [];
    for await (const dataset of datasetsByNameIterable) {
      datasetsByName.push(dataset);
    }
    expect(datasetsByName).toHaveLength(1);
    expect(datasetsByName.map((dataset) => dataset.id)).toContain(dataset1.id);

    await langchainClient.deleteDataset({ datasetId: dataset1.id });
    await langchainClient.deleteDataset({ datasetId: dataset2.id });
  },
  180_000
);

test.concurrent(
  "Test create feedback with source run",
  async () => {
    const langchainClient = new Client({ autoBatchTracing: false });
    const projectName = "__test_create_feedback_with_source_run JS";
    await deleteProject(langchainClient, projectName);
    const runId = uuidv4();
    await langchainClient.createRun({
      id: runId,
      project_name: projectName,
      name: "test_run",
      run_type: "llm",
      inputs: { prompt: "hello world" },
      outputs: { generation: "hi there" },
      start_time: new Date().getTime(),
      end_time: new Date().getTime(),
    });

    const runId2 = uuidv4();
    await langchainClient.createRun({
      id: runId2,
      project_name: projectName,
      name: "test_run_2",
      run_type: "llm",
      inputs: { prompt: "hello world 2" },
      outputs: { generation: "hi there 2" },
      start_time: new Date().getTime(),
      end_time: new Date().getTime(),
    });

    await langchainClient.createFeedback(runId, "test_feedback", {
      score: 0.5,
      sourceRunId: runId2,
      feedbackSourceType: "app",
    });
  },
  180_000
);

test.concurrent(
  "Test create run with masked inputs/outputs",
  async () => {
    const langchainClient = new Client({
      hideInputs: true,
      hideOutputs: true,
      autoBatchTracing: false,
    });
    const projectName = "__test_create_run_with_masked_inputs_outputs JS";
    await deleteProject(langchainClient, projectName);
    const runId = uuidv4();
    await langchainClient.createRun({
      id: runId,
      project_name: projectName,
      name: "test_run",
      run_type: "llm",
      inputs: { prompt: "hello world" },
      outputs: { generation: "hi there" },
      start_time: new Date().getTime(),
      end_time: new Date().getTime(),
    });

    const runId2 = uuidv4();
    await langchainClient.createRun({
      id: runId2,
      project_name: projectName,
      name: "test_run_2",
      run_type: "llm",
      inputs: { messages: "hello world 2" },
      start_time: new Date().getTime(),
    });

    await langchainClient.updateRun(runId2, {
      outputs: { generation: "hi there 2" },
      end_time: new Date().getTime(),
    });
    await waitUntilRunFound(langchainClient, runId, false);
    const run1 = await langchainClient.readRun(runId);
    expect(Object.keys(run1.inputs ?? {})).toHaveLength(0);
    expect(Object.keys(run1.outputs ?? {})).toHaveLength(0);
    await waitUntilRunFound(langchainClient, runId2, false);
    const run2 = await langchainClient.readRun(runId2);
    expect(Object.keys(run2.inputs ?? {})).toHaveLength(0);
    expect(Object.keys(run2.outputs ?? {})).toHaveLength(0);
  },
  240_000
);

test.concurrent(
  "Test create run with revision id",
  async () => {
    const langchainClient = new Client({ autoBatchTracing: false });
    // eslint-disable-next-line no-process-env
    process.env.LANGCHAIN_REVISION_ID = "test_revision_id";
    // eslint-disable-next-line no-process-env
    process.env.LANGCHAIN_OTHER_FIELD = "test_other_field";
    // eslint-disable-next-line no-process-env
    process.env.LANGCHAIN_OTHER_KEY = "test_other_key";
    const projectName = "__test_create_run_with_revision_id JS";
    await deleteProject(langchainClient, projectName);
    const runId = uuidv4();
    await langchainClient.createRun({
      id: runId,
      project_name: projectName,
      name: "test_run_with_revision",
      run_type: "llm",
      inputs: { prompt: "hello world" },
      outputs: { generation: "hi there" },
      start_time: new Date().getTime(),
      end_time: new Date().getTime(),
    });

    const runId2 = uuidv4();
    await langchainClient.createRun({
      id: runId2,
      project_name: projectName,
      name: "test_run_2_with_revision",
      run_type: "llm",
      inputs: { messages: "hello world 2" },
      start_time: new Date().getTime(),
      revision_id: "different_revision_id",
    });
    await waitUntilRunFound(
      langchainClient,
      runId,
      (run: Run | undefined) => Object.keys(run?.outputs || {}).length !== 0
    );
    const run1 = await langchainClient.readRun(runId);
    expect(run1.extra?.metadata?.revision_id).toEqual("test_revision_id");
    expect(run1.extra?.metadata.LANGCHAIN_OTHER_FIELD).toEqual(
      "test_other_field"
    );
    expect(run1.extra?.metadata.LANGCHAIN_OTHER_KEY).toBeUndefined();
    expect(run1.extra?.metadata).not.toHaveProperty("LANGCHAIN_API_KEY");
    await waitUntilRunFound(langchainClient, runId2);
    const run2 = await langchainClient.readRun(runId2);
    expect(run2.extra?.metadata?.revision_id).toEqual("different_revision_id");
    expect(run2.extra?.metadata.LANGCHAIN_OTHER_FIELD).toEqual(
      "test_other_field"
    );
    expect(run2.extra?.metadata.LANGCHAIN_OTHER_KEY).toBeUndefined();
    expect(run2.extra?.metadata).not.toHaveProperty("LANGCHAIN_API_KEY");
  },
  180_000
);

describe("createChatExample", () => {
  it("should convert LangChainBaseMessage objects to examples", async () => {
    const langchainClient = new Client({
      autoBatchTracing: false,
      // Test the fetch options option
      fetchOptions: { cache: "no-store" },
    });

    const datasetName = "__createChatExample-test-dataset JS";
    await deleteDataset(langchainClient, datasetName);
    const dataset = await langchainClient.createDataset(datasetName);

    const input = [new HumanMessage({ content: "Hello, world!" })];
    const generation = new FunctionMessage({
      name: "foo",
      content: "",
      additional_kwargs: {
        function_call: { arguments: "args", name: "foo" },
      },
    });
    const options = { datasetId: dataset.id };

    // Create the example from messages
    await langchainClient.createChatExample(input, generation, options);

    // Read the example
    const examples = [];
    for await (const example of langchainClient.listExamples({
      datasetId: dataset.id,
    })) {
      examples.push(example);
    }
    expect(examples.length).toBe(1);
    expect(examples[0].inputs).toEqual({
      input: [
        {
          type: "human",
          data: { content: "Hello, world!" },
        },
      ],
    });
    expect(examples[0].outputs).toEqual({
      output: {
        type: "function",
        data: {
          content: "",
          additional_kwargs: {
            function_call: { arguments: "args", name: "foo" },
          },
        },
      },
    });

    // Delete dataset
    await langchainClient.deleteDataset({ datasetId: dataset.id });
  }, 180_000);
});

test.concurrent(
  "Test getRunUrl with run",
  async () => {
    const client = new Client({ autoBatchTracing: false });
    const runId = uuidv4();
    const run: Run = {
      id: runId,
      name: "foo",
      run_type: "llm",
      inputs: { input: "hello world" },
      outputs: { output: "hi there" },
    };
    await client.createRun({ project_name: "foo", ...run });
    await waitUntilRunFound(
      client,
      runId,
      (run: Run | undefined) => Object.keys(run?.outputs || {}).length !== 0
    );
    const result = await client.getRunUrl({
      run,
      projectOpts: { projectName: "foo" },
    });
    expect(result).toContain(runId);
  },
  180_000
);

test.concurrent(
  "Examples CRUD",
  async () => {
    const client = new Client({ autoBatchTracing: false });
    const datasetName = "__test_examples_crud JS" + Date.now();
    await deleteDataset(client, datasetName);
    const dataset = await client.createDataset(datasetName);
    const example = await client.createExample(
      { input: "hello world" },
      { output: "hi there" },
      {
        datasetId: dataset.id,
        metadata: { key: "value" },
      }
    );
    const exampleValue = await client.readExample(example.id);
    const initialVersion = exampleValue.modified_at;
    expect(exampleValue.inputs.input).toEqual("hello world");
    expect(exampleValue?.outputs?.output).toEqual("hi there");
    expect(exampleValue?.metadata?.key).toEqual("value");

    // Update the example by modifying the metadata
    await client.updateExample(example.id, {
      metadata: { key: "new value" },
    });
    const updatedExampleValue = await client.readExample(example.id);
    expect(updatedExampleValue?.metadata?.key).toEqual("new value");

    // Create multiple
    await client.createExamples({
      inputs: [
        { input: "hello world 1" },
        { input: "hello world 2" },
        { input: "hello world 3" },
      ],
      outputs: [
        { output: "hi there 1" },
        { output: "hi there 2" },
        { output: "hi there 3" },
      ],
      metadata: [{ key: "value 1" }, { key: "value 2" }, { key: "value 3" }],
      splits: ["train", "test", ["train", "validation"]],
      datasetId: dataset.id,
    });
    const initialExamplesList = await toArray(
      client.listExamples({ datasetId: dataset.id, asOf: initialVersion })
    );
    expect(initialExamplesList.length).toEqual(1);
    const examplesList = await toArray(
      client.listExamples({ datasetId: dataset.id })
    );
    expect(examplesList.length).toEqual(4);

    const examplesListLimited = await toArray(
      client.listExamples({ datasetId: dataset.id, limit: 2 })
    );
    expect(examplesListLimited.length).toEqual(2);

    const examplesListOffset = await toArray(
      client.listExamples({ datasetId: dataset.id, offset: 2 })
    );
    expect(examplesListOffset.length).toEqual(2);

    const examplesListLimitedOffset = await toArray(
      client.listExamples({ datasetId: dataset.id, limit: 1, offset: 2 })
    );
    expect(examplesListLimitedOffset.length).toEqual(1);

    await client.deleteExample(example.id);
    const examplesList2 = await toArray(
      client.listExamples({ datasetId: dataset.id })
    );
    expect(examplesList2.length).toEqual(3);
    const datasetDiff = await client.diffDatasetVersions({
      datasetId: dataset.id,
      fromVersion: initialVersion!,
      toVersion: "latest",
    });
    expect(datasetDiff.examples_added.length).toEqual(3);
    expect(datasetDiff.examples_modified.length).toEqual(0);
    expect(datasetDiff.examples_removed.length).toEqual(1);

    // verify the example inputs, outputs, and metadata
    const example1 = examplesList2.find(
      (e) => e.inputs.input === "hello world 1"
    );
    expect(example1?.outputs?.output).toEqual("hi there 1");
    expect(example1?.metadata?.key).toEqual("value 1");
    expect(example1?.metadata?.dataset_split).toEqual(["train"]);
    const example2 = examplesList2.find(
      (e) => e.inputs.input === "hello world 2"
    );
    expect(example2?.outputs?.output).toEqual("hi there 2");
    expect(example2?.metadata?.key).toEqual("value 2");
    expect(example2?.metadata?.dataset_split).toEqual(["test"]);
    const example3 = examplesList2.find(
      (e) => e.inputs.input === "hello world 3"
    );
    expect(example3?.outputs?.output).toEqual("hi there 3");
    expect(example3?.metadata?.key).toEqual("value 3");
    expect(example3?.metadata?.dataset_split).toContain("train");
    expect(example3?.metadata?.dataset_split).toContain("validation");

    await client.createExample(
      { input: "hello world" },
      { output: "hi there" },
      {
        datasetId: dataset.id,
        metadata: { foo: "bar", baz: "qux" },
      }
    );
    let examplesList3 = await toArray(
      client.listExamples({ datasetId: dataset.id, metadata: { foo: "bar" } })
    );
    expect(examplesList3.length).toEqual(1);
    expect(examplesList3[0].metadata?.foo).toEqual("bar");
    expect(examplesList3[0].metadata?.baz).toEqual("qux");

    examplesList3 = await toArray(
      client.listExamples({ datasetId: dataset.id, metadata: { foo: "qux" } })
    );
    expect(examplesList3.length).toEqual(0);

    examplesList3 = await toArray(
      client.listExamples({ datasetId: dataset.id, metadata: { baz: "qux" } })
    );
    expect(examplesList3.length).toEqual(1);

    expect(examplesList3[0].metadata?.foo).toEqual("bar");
    expect(examplesList3[0].metadata?.baz).toEqual("qux");

    examplesList3 = await toArray(
      client.listExamples({
        datasetId: dataset.id,
        metadata: { foo: "bar", baz: "qux" },
      })
    );
    expect(examplesList3.length).toEqual(1);
    expect(examplesList3[0].metadata?.foo).toEqual("bar");
    expect(examplesList3[0].metadata?.baz).toEqual("qux");

    examplesList3 = await toArray(
      client.listExamples({
        datasetId: dataset.id,
        filter: 'exists(metadata, "baz")',
      })
    );
    expect(examplesList3.length).toEqual(1);
    expect(examplesList3[0].metadata?.foo).toEqual("bar");
    expect(examplesList3[0].metadata?.baz).toEqual("qux");

    examplesList3 = await toArray(
      client.listExamples({
        datasetId: dataset.id,
        filter: 'has("metadata", \'{"foo": "bar"}\')',
      })
    );
    expect(examplesList3.length).toEqual(1);
    expect(examplesList3[0].metadata?.foo).toEqual("bar");
    expect(examplesList3[0].metadata?.baz).toEqual("qux");

    examplesList3 = await toArray(
      client.listExamples({
        datasetId: dataset.id,
        filter: 'exists(metadata, "bazzz")',
      })
    );
    expect(examplesList3.length).toEqual(0);

    examplesList3 = await toArray(
      client.listExamples({
        datasetId: dataset.id,
        splits: ["train"],
      })
    );
    expect(examplesList3.length).toEqual(2);

    examplesList3 = await toArray(
      client.listExamples({
        datasetId: dataset.id,
        splits: ["test"],
      })
    );
    expect(examplesList3.length).toEqual(1);

    examplesList3 = await toArray(
      client.listExamples({
        datasetId: dataset.id,
        splits: ["train", "test"],
      })
    );
    expect(examplesList3.length).toEqual(3);

    await client.deleteDataset({ datasetId: dataset.id });
  },
  180_000
);

test.concurrent("list runs limit arg works", async () => {
  const client = new Client();

  const projectName = `test-limit-runs-${uuidv4().substring(0, 4)}`;
  const limit = 6;

  // delete the project just in case
  if (await client.hasProject({ projectName })) {
    await client.deleteProject({ projectName });
  }

  try {
    const runsArr: Array<Run> = [];
    // create a fresh project with 10 runs --default amount created by createRunsFactory
    await client.createProject({ projectName });
    await Promise.all(
      createRunsFactory(projectName).map(async (payload) => {
        if (!payload.id) payload.id = uuidv4();
        await client.createRun(payload);
        await waitUntilRunFound(client, payload.id);
      })
    );

    let iters = 0;
    for await (const run of client.listRuns({ limit, projectName })) {
      expect(run).toBeDefined();
      runsArr.push(run);
      iters += 1;
      if (iters > limit) {
        throw new Error(
          `More runs returned than expected.\nExpected: ${limit}\nReceived: ${iters}`
        );
      }
    }

    expect(runsArr.length).toBe(limit);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    if (e.message.startsWith("More runs returned than expected.")) {
      throw e;
    } else {
      console.error(e);
    }
  } finally {
    if (await client.hasProject({ projectName })) {
      await client.deleteProject({ projectName });
    }
  }
});

test.concurrent("Test run stats", async () => {
  const client = new Client();
  const stats = await client.getRunStats({
    projectNames: ["default"],
    runType: "llm",
  });
  expect(stats).toBeDefined();
});

test("Test createProject raises LangSmithConflictError on duplicate name", async () => {
  const client = new Client();
  const projectName = `test_project_${uuidv4()}`;

  try {
    // Create the project for the first time
    await client.createProject({ projectName });

    // Attempt to create the project with the same name again
    await expect(client.createProject({ projectName })).rejects.toThrow(
      expect.objectContaining({
        name: "LangSmithConflictError",
      })
    );
  } finally {
    try {
      // Clean up: delete the project
      if (await client.hasProject({ projectName })) {
        await client.deleteProject({ projectName });
      }
    } catch (e) {
      // Everyone has those days.
    }
  }
});

test("Test list prompts", async () => {
  const client = new Client();
  const uid = uuidv4();
  // push 3 prompts
  const promptName1 = `test_prompt_${uid}__0`;
  const promptName2 = `test_prompt_${uid}__1`;
  const promptName3 = `test_prompt_${uid}__2`;

  await client.pushPrompt(promptName1, {
    object: ChatPromptTemplate.fromMessages(
      [
        new SystemMessage({ content: "System message" }),
        new HumanMessage({ content: "{{question}}" }),
      ],
      { templateFormat: "mustache" }
    ),
    isPublic: true,
  });
  await client.pushPrompt(promptName2, {
    object: ChatPromptTemplate.fromMessages(
      [
        new SystemMessage({ content: "System message" }),
        new HumanMessage({ content: "{{question}}" }),
      ],
      { templateFormat: "mustache" }
    ),
  });
  await client.pushPrompt(promptName3, {
    object: ChatPromptTemplate.fromMessages(
      [
        new SystemMessage({ content: "System message" }),
        new HumanMessage({ content: "{{question}}" }),
      ],
      { templateFormat: "mustache" }
    ),
  });

  // expect at least one of the prompts to have promptName1
  const response = client.listPrompts({ isPublic: true, query: uid });
  let found = false;
  expect(response).toBeDefined();
  for await (const prompt of response) {
    expect(prompt).toBeDefined();
    if (prompt.repo_handle === promptName1) {
      found = true;
    }
  }
  expect(found).toBe(true);

  // expect the prompts to be sorted by updated_at
  const response2 = client.listPrompts({ sortField: "updated_at", query: uid });
  expect(response2).toBeDefined();
  let lastUpdatedAt: number | undefined;
  for await (const prompt of response2) {
    expect(prompt.updated_at).toBeDefined();
    const currentUpdatedAt = new Date(prompt.updated_at).getTime();
    if (lastUpdatedAt !== undefined) {
      expect(currentUpdatedAt).toBeLessThanOrEqual(lastUpdatedAt);
    }
    lastUpdatedAt = currentUpdatedAt;
  }
  expect(lastUpdatedAt).toBeDefined();
});

test("Test get prompt", async () => {
  const client = new Client();
  const promptName = `test_prompt_${uuidv4().slice(0, 8)}`;
  const promptTemplate = ChatPromptTemplate.fromMessages(
    [
      new SystemMessage({ content: "System message" }),
      new HumanMessage({ content: "{{question}}" }),
    ],
    { templateFormat: "mustache" }
  );

  const url = await client.pushPrompt(promptName, { object: promptTemplate });
  expect(url).toBeDefined();

  const prompt = await client.getPrompt(promptName);
  expect(prompt).toBeDefined();
  expect(prompt?.repo_handle).toBe(promptName);

  await client.deletePrompt(promptName);
});

test("Test prompt exists", async () => {
  const client = new Client();
  const nonExistentPrompt = `non_existent_${uuidv4().slice(0, 8)}`;
  expect(await client.promptExists(nonExistentPrompt)).toBe(false);

  const existentPrompt = `existent_${uuidv4().slice(0, 8)}`;
  await client.pushPrompt(existentPrompt, {
    object: ChatPromptTemplate.fromMessages(
      [
        new SystemMessage({ content: "System message" }),
        new HumanMessage({ content: "{{question}}" }),
      ],
      { templateFormat: "mustache" }
    ),
  });
  expect(await client.promptExists(existentPrompt)).toBe(true);

  await client.deletePrompt(existentPrompt);
});

test("Test update prompt", async () => {
  const client = new Client();

  const promptName = `test_update_prompt_${uuidv4().slice(0, 8)}`;
  await client.pushPrompt(promptName, {
    object: ChatPromptTemplate.fromMessages(
      [
        new SystemMessage({ content: "System message" }),
        new HumanMessage({ content: "{{question}}" }),
      ],
      { templateFormat: "mustache" }
    ),
  });

  const updatedData = await client.updatePrompt(promptName, {
    description: "Updated description",
    isPublic: true,
    tags: ["test", "update"],
  });

  expect(updatedData).toBeDefined();

  const updatedPrompt = await client.getPrompt(promptName);
  expect(updatedPrompt?.description).toBe("Updated description");
  expect(updatedPrompt?.is_public).toBe(true);
  expect(updatedPrompt?.tags).toEqual(
    expect.arrayContaining(["test", "update"])
  );

  await client.deletePrompt(promptName);
});

test("Test delete prompt", async () => {
  const client = new Client();

  const promptName = `test_delete_prompt_${uuidv4().slice(0, 8)}`;
  await client.pushPrompt(promptName, {
    object: ChatPromptTemplate.fromMessages(
      [
        new SystemMessage({ content: "System message" }),
        new HumanMessage({ content: "{{question}}" }),
      ],
      { templateFormat: "mustache" }
    ),
  });

  expect(await client.promptExists(promptName)).toBe(true);
  await client.deletePrompt(promptName);
  expect(await client.promptExists(promptName)).toBe(false);
});

test("test listing projects by metadata", async () => {
  const client = new Client();
  const uid = uuidv4();
  const projectName = `my_metadata_project_${uid}`;

  await client.createProject({
    projectName: projectName,
    metadata: {
      foobar: uid,
      baz: "barfooqux",
    },
  });

  const projects = await client.listProjects({ metadata: { foobar: uid } });

  let myProject: TracerSession | null = null;
  for await (const project of projects) {
    myProject = project;
  }
  expect(myProject?.name).toEqual(projectName);

  await client.deleteProject({ projectName: projectName });
});

test("Test create commit", async () => {
  const client = new Client();

  const promptName = `test_create_commit_${uuidv4().slice(0, 8)}`;
  await client.pushPrompt(promptName, {
    object: ChatPromptTemplate.fromMessages(
      [
        new SystemMessage({ content: "System message" }),
        new HumanMessage({ content: "{{question}}" }),
      ],
      { templateFormat: "mustache" }
    ),
  });

  const newTemplate = ChatPromptTemplate.fromMessages(
    [
      new SystemMessage({ content: "System message" }),
      new HumanMessage({ content: "My question is: {{question}}" }),
    ],
    { templateFormat: "mustache" }
  );
  const commitUrl = await client.createCommit(promptName, newTemplate);

  expect(commitUrl).toBeDefined();
  expect(commitUrl).toContain(promptName);

  await client.deletePrompt(promptName);
});

test("Test like and unlike prompt", async () => {
  const client = new Client();

  const promptName = `test_like_prompt_${uuidv4().slice(0, 8)}`;
  await client.pushPrompt(promptName, {
    object: ChatPromptTemplate.fromMessages(
      [
        new SystemMessage({ content: "System message" }),
        new HumanMessage({ content: "{{question}}" }),
      ],
      { templateFormat: "mustache" }
    ),
  });

  await client.likePrompt(promptName);
  let prompt = await client.getPrompt(promptName);
  expect(prompt?.num_likes).toBe(1);

  await client.unlikePrompt(promptName);
  prompt = await client.getPrompt(promptName);
  expect(prompt?.num_likes).toBe(0);

  await client.deletePrompt(promptName);
});

test("Test pull prompt commit", async () => {
  const client = new Client();

  const promptName = `test_pull_commit_${uuidv4().slice(0, 8)}`;
  const initialTemplate = ChatPromptTemplate.fromMessages(
    [
      new SystemMessage({ content: "System message" }),
      new HumanMessage({ content: "{{question}}" }),
    ],
    { templateFormat: "mustache" }
  );
  await client.pushPrompt(promptName, { object: initialTemplate });

  const promptCommit = await client.pullPromptCommit(promptName);
  expect(promptCommit).toBeDefined();
  expect(promptCommit.repo).toBe(promptName);

  await client.deletePrompt(promptName);
});

test("Test push and pull prompt", async () => {
  const client = new Client();

  const promptName = `test_push_pull_${uuidv4().slice(0, 8)}`;
  const template = ChatPromptTemplate.fromMessages(
    [
      new SystemMessage({ content: "System message" }),
      new HumanMessage({ content: "{{question}}" }),
    ],
    { templateFormat: "mustache" }
  );
  const template2 = ChatPromptTemplate.fromMessages(
    [
      new SystemMessage({ content: "System message" }),
      new HumanMessage({ content: "My question is: {{question}}" }),
    ],
    { templateFormat: "mustache" }
  );

  await client.pushPrompt(promptName, {
    object: template,
    description: "Test description",
    readme: "Test readme",
    tags: ["test", "tag"],
  });

  // test you can push an updated manifest without any other options
  await client.pushPrompt(promptName, {
    object: template2,
  });

  const pulledPrompt = await client._pullPrompt(promptName);
  expect(pulledPrompt).toBeDefined();

  const promptInfo = await client.getPrompt(promptName);
  expect(promptInfo?.description).toBe("Test description");
  expect(promptInfo?.readme).toBe("Test readme");
  expect(promptInfo?.tags).toEqual(expect.arrayContaining(["test", "tag"]));
  expect(promptInfo?.is_public).toBe(false);

  await client.deletePrompt(promptName);
});

test("Test pull prompt include model", async () => {
  const client = new Client();
  const model = new ChatOpenAI({});
  const promptTemplate = PromptTemplate.fromTemplate(
    "Tell me a joke about {topic}"
  );
  const promptWithModel = promptTemplate.pipe(model);

  const promptName = `test_prompt_with_model_${uuidv4().slice(0, 8)}`;
  await client.pushPrompt(promptName, { object: promptWithModel });

  const pulledPrompt = await client._pullPrompt(promptName, {
    includeModel: true,
  });
  const rs: RunnableSequence = await load(pulledPrompt);
  expect(rs).toBeDefined();
  expect(rs).toBeInstanceOf(RunnableSequence);

  await client.deletePrompt(promptName);
});

test("list shared examples can list shared examples", async () => {
  const client = new Client();
  const multiverseMathPublicDatasetShareToken =
    "cce9c8a9-761a-4756-b159-58ed2640e274";
  const sharedExamples = await client.listSharedExamples(
    multiverseMathPublicDatasetShareToken
  );
  expect(sharedExamples.length).toBeGreaterThan(0);
});

test("clonePublicDataset method can clone a dataset", async () => {
  const client = new Client();
  const datasetName = "multiverse_math_public_testing";
  const multiverseMathPublicDatasetURL =
    "https://beta.smith.langchain.com/public/cce9c8a9-761a-4756-b159-58ed2640e274/d";

  try {
    await client.clonePublicDataset(multiverseMathPublicDatasetURL, {
      datasetName,
    });

    const clonedDataset = await client.hasDataset({ datasetName });
    expect(clonedDataset).toBe(true);

    const examples: Example[] = [];
    for await (const ex of client.listExamples({ datasetName })) {
      examples.push(ex);
    }
    expect(examples.length).toBeGreaterThan(0);
  } finally {
    try {
      // Attempt to remove the newly created dataset if successful.
      await client.deleteDataset({ datasetName });
    } catch (_) {
      // no-op if failure
    }
  }
});

test("annotationqueue crud", async () => {
  const client = new Client();
  const queueName = `test-queue-${uuidv4().substring(0, 8)}`;
  const projectName = `test-project-${uuidv4().substring(0, 8)}`;
  const queueId = uuidv4();

  try {
    // 1. Create an annotation queue
    const queue = await client.createAnnotationQueue({
      name: queueName,
      description: "Initial description",
      queueId,
    });
    expect(queue).toBeDefined();
    expect(queue.name).toBe(queueName);

    // 1a. Get the annotation queue
    const fetchedQueue = await client.readAnnotationQueue(queue.id);
    expect(fetchedQueue).toBeDefined();
    expect(fetchedQueue.name).toBe(queueName);

    // 1b. List annotation queues and check nameContains
    const listedQueues = await toArray(
      client.listAnnotationQueues({ nameContains: queueName })
    );
    expect(listedQueues.length).toBeGreaterThan(0);
    expect(listedQueues.some((q) => q.id === queue.id)).toBe(true);

    // 2. Create a run in a random project
    await client.createProject({ projectName });
    const runId = uuidv4();
    await client.createRun({
      id: runId,
      name: "Test Run",
      run_type: "chain",
      inputs: { foo: "bar" },
      outputs: { baz: "qux" },
      project_name: projectName,
    });

    // Wait for run to be found in the db
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();
    let foundRun = null;

    while (Date.now() - startTime < maxWaitTime) {
      try {
        foundRun = await client.readRun(runId);
        if (foundRun) break;
      } catch (error) {
        // If run is not found, getRun might throw an error
        // We'll ignore it and keep trying
      }
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for 1 second before trying again
    }

    if (!foundRun) {
      throw new Error(
        `Run with ID ${runId} not found after ${maxWaitTime / 1000} seconds`
      );
    }

    // 3. Add the run to the annotation queue
    await client.addRunsToAnnotationQueue(fetchedQueue.id, [runId]);

    // 4. Update the annotation queue description and check that it is updated
    const newDescription = "Updated description";
    await client.updateAnnotationQueue(queue.id, {
      name: queueName,
      description: newDescription,
    });
    const updatedQueue = await client.readAnnotationQueue(queue.id);
    expect(updatedQueue.description).toBe(newDescription);

    // Get the run from the annotation queue
    const run = await client.getRunFromAnnotationQueue(queueId, 0);
    expect(run).toBeDefined();
    expect(run.id).toBe(runId);
    expect(run.name).toBe("Test Run");
    expect(run.run_type).toBe("chain");
    expect(run.inputs).toEqual({ foo: "bar" });
    expect(run.outputs).toEqual({ baz: "qux" });
  } finally {
    // 6. Delete the annotation queue
    await client.deleteAnnotationQueue(queueId);

    // Clean up the project
    if (await client.hasProject({ projectName })) {
      await client.deleteProject({ projectName });
    }
  }
});

test("upload examples multipart", async () => {
  const client = new Client();
  const datasetName = `__test_upload_examples_multipart${uuidv4().slice(0, 4)}`;

  // Clean up existing dataset if it exists
  if (await client.hasDataset({ datasetName })) {
    await client.deleteDataset({ datasetName });
  }

  // Create actual dataset
  const dataset = await client.createDataset(datasetName, {
    description: "Test dataset for multipart example upload",
    dataType: "kv",
  });

  const pathname = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "test_data",
    "parrot-icon.png"
  );
  // Create test examples
  const exampleId = uuidv4();
  const example1: ExampleCreate = {
    id: exampleId,
    inputs: { text: "hello world" },
    // check that passing no outputs works fine
    attachments: {
      test_file: {
        mimeType: "image/png",
        data: fs.readFileSync(pathname),
      },
    },
  };

  const example2: ExampleCreate = {
    inputs: { text: "foo bar" },
    outputs: { response: "baz" },
    attachments: {
      my_file: ["image/png", fs.readFileSync(pathname)],
    },
  };

  // Test creating examples
  const createdExamples = await client.uploadExamplesMultipart(dataset.id, [
    example1,
    example2,
  ]);

  expect(createdExamples.count).toBe(2);

  const createdExample1 = await client.readExample(exampleId);
  expect(createdExample1.inputs["text"]).toBe("hello world");

  const createdExample2 = await client.readExample(
    createdExamples.example_ids.find((id) => id !== exampleId)!
  );
  expect(createdExample2.inputs["text"]).toBe("foo bar");
  expect(createdExample2.outputs?.["response"]).toBe("baz");

  // Test examples were sent to correct dataset
  const allExamplesInDataset = [];
  for await (const example of client.listExamples({
    datasetId: dataset.id,
  })) {
    allExamplesInDataset.push(example);
  }
  expect(allExamplesInDataset.length).toBe(2);

  // Test invalid example fails
  const example3: ExampleCreate = {
    inputs: { text: "foo bar" },
    outputs: { response: "baz" },
    attachments: {
      my_file: ["image/png", fs.readFileSync(pathname)],
    },
  };

  const errorResponse = await client.uploadExamplesMultipart(uuidv4(), [
    example3,
  ]);
  expect(errorResponse).toHaveProperty("error");

  // Clean up
  await client.deleteDataset({ datasetName });
});

test("update examples multipart", async () => {
  const client = new Client();
  const datasetName = `__test_update_examples_multipart${uuidv4().slice(0, 4)}`;

  // Clean up existing dataset if it exists
  if (await client.hasDataset({ datasetName })) {
    await client.deleteDataset({ datasetName });
  }

  // Create actual dataset
  const dataset = await client.createDataset(datasetName, {
    description: "Test dataset for multipart example upload",
    dataType: "kv",
  });

  const pathname = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "test_data",
    "parrot-icon.png"
  );
  // Create test examples
  const exampleId = uuidv4();
  const example: ExampleCreate = {
    id: exampleId,
    metadata: { bar: "foo" },
    inputs: { text: "hello world" },
    // check that passing no outputs works fine
    attachments: {
      test_file: ["image/png", fs.readFileSync(pathname)],
      foo: ["image/png", fs.readFileSync(pathname)],
    },
  };

  // Create examples
  await client.uploadExamplesMultipart(dataset.id, [example]);

  const exampleUpdate1: ExampleUpdateWithAttachments = {
    id: exampleId,
    inputs: { text: "hello world" },
    attachments_operations: {
      retain: ["test_file"],
      rename: { foo: "test_file" },
    },
  };

  let response = await client.updateExamplesMultipart(dataset.id, [
    exampleUpdate1,
  ]);
  expect(response).toHaveProperty("error");

  const exampleUpdate2: ExampleUpdateWithAttachments = {
    id: exampleId,
    inputs: { text: "hello world" },
    attachments_operations: {
      retain: ["test_file"],
      rename: { test_file: "test_file2" },
    },
  };

  response = await client.updateExamplesMultipart(dataset.id, [exampleUpdate2]);
  expect(response).toHaveProperty("error");

  const exampleUpdate3: ExampleUpdateWithAttachments = {
    id: exampleId,
    inputs: { text: "hello world2" },
    attachments_operations: {
      retain: ["test_file"],
      rename: { foo: "bar" },
    },
  };

  await client.updateExamplesMultipart(dataset.id, [exampleUpdate3]);

  let updatedExample = await client.readExample(exampleId);
  expect(updatedExample.inputs.text).toEqual("hello world2");
  expect(Object.keys(updatedExample.attachments ?? {}).sort()).toEqual(
    ["bar", "test_file"].sort()
  );
  expect(updatedExample.metadata).toEqual({ bar: "foo" });
  let attachmentData: Uint8Array | undefined = updatedExample.attachments?.[
    "test_file"
  ].presigned_url
    ? new Uint8Array(
        (await fetch(
          updatedExample.attachments?.["test_file"].presigned_url
        ).then((res) => res.arrayBuffer())) as ArrayBuffer
      )
    : undefined;
  expect(attachmentData).toEqual(new Uint8Array(fs.readFileSync(pathname)));
  attachmentData = updatedExample.attachments?.["bar"].presigned_url
    ? new Uint8Array(
        (await fetch(updatedExample.attachments?.["bar"].presigned_url).then(
          (res) => res.arrayBuffer()
        )) as ArrayBuffer
      )
    : undefined;
  expect(attachmentData).toEqual(new Uint8Array(fs.readFileSync(pathname)));

  const exampleUpdate4: ExampleUpdateWithAttachments = {
    id: exampleId,
    metadata: { foo: "bar" },
    attachments: {
      test_file2: ["image/png", fs.readFileSync(pathname)],
    },
  };

  await client.updateExamplesMultipart(dataset.id, [exampleUpdate4]);
  updatedExample = await client.readExample(exampleId);
  expect(updatedExample.metadata).toEqual({ foo: "bar" });
  expect(Object.keys(updatedExample.attachments ?? {})).toEqual(["test_file2"]);
  attachmentData = updatedExample.attachments?.["test_file2"].presigned_url
    ? new Uint8Array(
        (await fetch(
          updatedExample.attachments?.["test_file2"].presigned_url
        ).then((res) => res.arrayBuffer())) as ArrayBuffer
      )
    : undefined;
  expect(attachmentData).toEqual(new Uint8Array(fs.readFileSync(pathname)));

  const exampleUpdate5: ExampleUpdateWithAttachments = {
    id: exampleId,
    split: ["foo", "bar"],
    attachments: {
      test_file: ["image/png", fs.readFileSync(pathname)],
    },
  };

  await client.updateExamplesMultipart(dataset.id, [exampleUpdate5]);

  updatedExample = await client.readExample(exampleId);
  expect(updatedExample.metadata).toEqual({
    foo: "bar",
    dataset_split: ["foo", "bar"],
  });
  expect(Object.keys(updatedExample.attachments ?? {})).toEqual(["test_file"]);
  attachmentData = updatedExample.attachments?.["test_file"].presigned_url
    ? new Uint8Array(
        (await fetch(
          updatedExample.attachments?.["test_file"].presigned_url
        ).then((res) => res.arrayBuffer())) as ArrayBuffer
      )
    : undefined;
  expect(attachmentData).toEqual(new Uint8Array(fs.readFileSync(pathname)));

  // Clean up
  await client.deleteDataset({ datasetName });
});

test("create example go backend", async () => {
  const client = new Client();
  const datasetName = `__test_create_examples_go_backend${uuidv4().slice(
    0,
    4
  )}`;

  // Clean up existing dataset if it exists
  if (await client.hasDataset({ datasetName })) {
    await client.deleteDataset({ datasetName });
  }

  // Create actual dataset
  const dataset = await client.createDataset(datasetName, {
    description: "Test dataset for multipart example upload",
    dataType: "kv",
  });

  const pathname = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "test_data",
    "parrot-icon.png"
  );

  // Create test examples
  const exampleId = uuidv4();
  const example: ExampleCreate = {
    id: exampleId,
    dataset_id: dataset.id,
    inputs: { text: "hello world" },
    attachments: {
      test_file: ["image/png", fs.readFileSync(pathname)],
    },
  };

  let createdExample = await client.createExample(example);
  expect(createdExample.id).toEqual(exampleId);
  expect(createdExample.inputs.text).toEqual("hello world");
  expect(Object.keys(createdExample.attachments ?? {})).toEqual(["test_file"]);
  let attachmentData: Uint8Array | undefined = createdExample.attachments?.[
    "test_file"
  ].presigned_url
    ? new Uint8Array(
        (await fetch(
          createdExample.attachments?.["test_file"].presigned_url
        ).then((res) => res.arrayBuffer())) as ArrayBuffer
      )
    : undefined;
  expect(attachmentData).toEqual(new Uint8Array(fs.readFileSync(pathname)));

  createdExample = await client.createExample(
    { text: "hello world" },
    {
      foo: "bar",
    },
    {
      attachments: {
        test_file: ["image/png", fs.readFileSync(pathname)],
      },
      datasetName: datasetName,
    }
  );
  expect(createdExample.inputs.text).toEqual("hello world");
  expect(createdExample.outputs?.foo).toEqual("bar");
  expect(Object.keys(createdExample.attachments ?? {})).toEqual(["test_file"]);
  attachmentData = createdExample.attachments?.["test_file"].presigned_url
    ? new Uint8Array(
        (await fetch(
          createdExample.attachments?.["test_file"].presigned_url
        ).then((res) => res.arrayBuffer())) as ArrayBuffer
      )
    : undefined;
  expect(attachmentData).toEqual(new Uint8Array(fs.readFileSync(pathname)));

  // Clean up
  await client.deleteDataset({ datasetName });
});

// Backend changes for go endpoint using runs still needs to land
test.skip("test use source run io multiple examples", async () => {
  const client = new Client({ autoBatchTracing: false });

  const datasetName = `__test_use_source_run_io${uuidv4().slice(0, 4)}`;
  const dataset = await client.createDataset(datasetName, {
    description: "Test dataset for creating dataset with description",
  });

  const runId = uuidv4();
  await client.createRun({
    name: "foo",
    run_type: "llm",
    inputs: { foo: "bar" },
    outputs: { foo: "bar" },
    id: runId,
    attachments: {
      test_file: { data: Buffer.from("test content"), mimeType: "text/plain" },
      real_file: { data: Buffer.from("real content"), mimeType: "text/plain" },
    },
  });

  const exampleIds = [uuidv4(), uuidv4(), uuidv4()];
  await client.createExamples([
    {
      id: exampleIds[0],
      inputs: { bar: "baz" },
      outputs: { bar: "baz" },
      attachments: {
        test_file2: {
          data: Buffer.from("test content"),
          mimeType: "text/plain",
        },
      },
      use_source_run_io: true,
      use_source_run_attachments: [],
      source_run_id: runId,
      dataset_id: dataset.id,
    },
    {
      id: exampleIds[1],
      inputs: { bar: "baz" },
      outputs: { bar: "baz" },
      attachments: {
        test_file2: {
          data: Buffer.from("test content"),
          mimeType: "text/plain",
        },
      },
      use_source_run_io: false,
      use_source_run_attachments: ["test_file"],
      source_run_id: runId,
      dataset_id: dataset.id,
    },
    {
      id: exampleIds[2],
      inputs: { bar: "baz" },
      outputs: { bar: "baz" },
      attachments: {
        test_file2: {
          data: Buffer.from("test content"),
          mimeType: "text/plain",
        },
      },
      use_source_run_io: true,
      use_source_run_attachments: ["test_file"],
      source_run_id: runId,
      dataset_id: dataset.id,
    },
  ]);

  const example1 = await client.readExample(exampleIds[0]);
  const example2 = await client.readExample(exampleIds[1]);
  const example3 = await client.readExample(exampleIds[2]);

  expect(example1.dataset_id).toBe(dataset.id);
  expect(example1.inputs).toEqual({ foo: "bar" });
  expect(example1.outputs).toEqual({ foo: "bar" });
  expect(Object.keys(example1.attachments ?? {}).sort()).toEqual([
    "real_file",
    "test_file",
  ]);

  expect(example2.dataset_id).toBe(dataset.id);
  expect(example2.inputs).toEqual({ bar: "baz" });
  expect(example2.outputs).toEqual({ bar: "baz" });
  expect(Object.keys(example2.attachments ?? {}).sort()).toEqual(["test_file"]);

  expect(example3.dataset_id).toBe(dataset.id);
  expect(example3.inputs).toEqual({ foo: "bar" });
  expect(example3.outputs).toEqual({ foo: "bar" });
  expect(Object.keys(example3.attachments ?? {}).sort()).toEqual([
    "real_file",
    "test_file",
  ]);

  // Clean up
  await client.deleteDataset({ datasetName });
});

// Backend changes for go endpoint using runs still needs to land
test.skip("test use source run io single example", async () => {
  const client = new Client();
  const datasetName = `__test_create_examples_go_backend${uuidv4().slice(
    0,
    4
  )}`;

  // Clean up existing dataset if it exists
  if (await client.hasDataset({ datasetName })) {
    await client.deleteDataset({ datasetName });
  }

  // Create actual dataset
  const dataset = await client.createDataset(datasetName, {
    description: "Test dataset for multipart example upload",
    dataType: "kv",
  });

  const runId = uuidv4();
  await client.createRun({
    name: "foo",
    run_type: "llm",
    inputs: { foo: "bar" },
    outputs: { foo: "bar" },
    id: runId,
    attachments: {
      test_file: { data: Buffer.from("test content"), mimeType: "text/plain" },
      real_file: { data: Buffer.from("real content"), mimeType: "text/plain" },
    },
  });

  const pathname = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "test_data",
    "parrot-icon.png"
  );

  // Create test examples
  const exampleId = uuidv4();
  const example: ExampleCreate = {
    id: exampleId,
    dataset_id: dataset.id,
    inputs: { text: "hello world" },
    attachments: {
      test_file2: ["image/png", fs.readFileSync(pathname)],
    },
    use_source_run_io: true,
    use_source_run_attachments: [],
    source_run_id: runId,
  };

  let createdExample = await client.createExample(example);
  expect(createdExample.id).toEqual(exampleId);
  expect(createdExample.inputs.text).toEqual("hello world");
  // using source run io overrides everything else with regards to attachments
  expect(Object.keys(createdExample.attachments ?? {})).toEqual([
    "real_file",
    "test_file",
  ]);

  createdExample = await client.createExample(
    { text: "hello world" },
    {
      foo: "bar",
    },
    {
      attachments: {
        test_file2: ["image/png", fs.readFileSync(pathname)],
      },
      datasetName: datasetName,
      useSourceRunIO: true,
      useSourceRunAttachments: [],
      sourceRunId: runId,
    }
  );
  expect(createdExample.inputs.text).toEqual("hello world");
  expect(createdExample.outputs?.foo).toEqual("bar");
  // using source run io overrides everything else with regards to attachments
  expect(Object.keys(createdExample.attachments ?? {})).toEqual([
    "real_file",
    "test_file",
  ]);

  // Clean up
  await client.deleteDataset({ datasetName });
});

test("update example go backend", async () => {
  const client = new Client();
  const datasetName = `__test_create_examples_go_backend${uuidv4().slice(
    0,
    4
  )}`;

  // Clean up existing dataset if it exists
  if (await client.hasDataset({ datasetName })) {
    await client.deleteDataset({ datasetName });
  }

  // Create actual dataset
  const dataset = await client.createDataset(datasetName, {
    description: "Test dataset for multipart example upload",
    dataType: "kv",
  });

  const pathname = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "test_data",
    "parrot-icon.png"
  );

  // Create test examples
  const exampleId = uuidv4();
  const example: ExampleCreate = {
    id: exampleId,
    dataset_id: dataset.id,
    inputs: { text: "hello world" },
    attachments: {
      test_file: ["image/png", fs.readFileSync(pathname)],
    },
  };

  await client.createExample(example);

  // Update old way
  await client.updateExample(exampleId, {
    attachments: {
      test_file3: ["image/png", fs.readFileSync(pathname)],
    },
    attachments_operations: {
      rename: { test_file: "test_file2" },
    },
  });

  let retrievedExample = await client.readExample(exampleId);
  expect(retrievedExample.inputs.text).toEqual("hello world");
  expect(Object.keys(retrievedExample.attachments ?? {}).sort()).toEqual(
    ["test_file2", "test_file3"].sort()
  );

  // Update new way
  await client.updateExample({
    id: exampleId,
    attachments: {
      test_file4: ["image/png", fs.readFileSync(pathname)],
    },
    attachments_operations: {
      rename: { test_file3: "test_file5" },
    },
  });
  retrievedExample = await client.readExample(exampleId);
  expect(retrievedExample.inputs.text).toEqual("hello world");
  expect(Object.keys(retrievedExample.attachments ?? {}).sort()).toEqual(
    ["test_file4", "test_file5"].sort()
  );

  // Clean up
  await client.deleteDataset({ datasetName });
});

test("create examples go backend", async () => {
  const client = new Client();
  const datasetName = `__test_create_examples_go_backend${uuidv4().slice(
    0,
    4
  )}`;

  // Clean up existing dataset if it exists
  if (await client.hasDataset({ datasetName })) {
    await client.deleteDataset({ datasetName });
  }

  // Create actual dataset
  const dataset = await client.createDataset(datasetName, {
    description: "Test dataset for multipart example upload",
    dataType: "kv",
  });

  const pathname = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "test_data",
    "parrot-icon.png"
  );

  // Create test examples
  const exampleId = uuidv4();
  const example: ExampleCreate = {
    id: exampleId,
    dataset_id: dataset.id,
    inputs: { text: "hello world" },
    attachments: {
      test_file: ["image/png", fs.readFileSync(pathname)],
    },
  };

  let createdExample = (await client.createExamples([example]))[0];
  expect(createdExample.id).toEqual(exampleId);
  expect(createdExample.inputs.text).toEqual("hello world");
  expect(Object.keys(createdExample.attachments ?? {})).toEqual(["test_file"]);
  let attachmentData: Uint8Array | undefined = createdExample.attachments?.[
    "test_file"
  ].presigned_url
    ? new Uint8Array(
        (await fetch(
          createdExample.attachments?.["test_file"].presigned_url
        ).then((res) => res.arrayBuffer())) as ArrayBuffer
      )
    : undefined;
  expect(attachmentData).toEqual(new Uint8Array(fs.readFileSync(pathname)));

  createdExample = (
    await client.createExamples({
      inputs: [{ text: "hello world" }],
      outputs: [
        {
          foo: "bar",
        },
      ],
      attachments: [
        {
          test_file: ["image/png", fs.readFileSync(pathname)],
        },
      ],
      datasetName: datasetName,
    })
  )[0];
  expect(createdExample.inputs.text).toEqual("hello world");
  expect(createdExample.outputs?.foo).toEqual("bar");
  expect(Object.keys(createdExample.attachments ?? {})).toEqual(["test_file"]);
  attachmentData = createdExample.attachments?.["test_file"].presigned_url
    ? new Uint8Array(
        (await fetch(
          createdExample.attachments?.["test_file"].presigned_url
        ).then((res) => res.arrayBuffer())) as ArrayBuffer
      )
    : undefined;
  expect(attachmentData).toEqual(new Uint8Array(fs.readFileSync(pathname)));

  // Clean up
  await client.deleteDataset({ datasetName });
});

test("update examples go backend", async () => {
  const client = new Client();
  const datasetName = `__test_create_examples_go_backend${uuidv4().slice(
    0,
    4
  )}`;

  // Clean up existing dataset if it exists
  if (await client.hasDataset({ datasetName })) {
    await client.deleteDataset({ datasetName });
  }

  // Create actual dataset
  const dataset = await client.createDataset(datasetName, {
    description: "Test dataset for multipart example upload",
    dataType: "kv",
  });

  const pathname = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "test_data",
    "parrot-icon.png"
  );

  // Create test examples
  const exampleId = uuidv4();
  const example: ExampleCreate = {
    id: exampleId,
    dataset_id: dataset.id,
    inputs: { text: "hello world" },
    attachments: {
      test_file: ["image/png", fs.readFileSync(pathname)],
    },
  };

  await client.createExample(example);

  // Update
  await client.updateExamples([
    {
      id: exampleId,
      attachments: {
        test_file3: ["image/png", fs.readFileSync(pathname)],
      },
      attachments_operations: {
        rename: { test_file: "test_file2" },
      },
    },
  ]);

  const retrievedExample = await client.readExample(exampleId);
  expect(retrievedExample.inputs.text).toEqual("hello world");
  expect(Object.keys(retrievedExample.attachments ?? {}).sort()).toEqual(
    ["test_file2", "test_file3"].sort()
  );

  // Clean up
  await client.deleteDataset({ datasetName });
});

test("create example errors", async () => {
  const client = new Client();
  const datasetName = `__test_create_examples_go_backend${uuidv4().slice(
    0,
    4
  )}`;

  // Clean up existing dataset if it exists
  if (await client.hasDataset({ datasetName })) {
    await client.deleteDataset({ datasetName });
  }

  // Create actual dataset
  const dataset = await client.createDataset(datasetName, {
    description: "Test dataset for multipart example upload",
    dataType: "kv",
  });

  const exampleId = uuidv4();
  const example: ExampleCreate = {
    id: exampleId,
    dataset_id: dataset.id,
    inputs: { text: "hello world" },
    attachments: {
      test_file: ["plain/txt", Buffer.from("data")],
    },
  };

  const invalidExample: ExampleCreate = {
    id: exampleId,
    inputs: { text: "hello world" },
    attachments: {
      test_file: ["plain/txt", Buffer.from("data")],
    },
  };

  const invalidExample2: ExampleCreate = {
    id: exampleId,
    dataset_id: dataset.id,
    dataset_name: datasetName,
    inputs: { text: "hello world" },
    attachments: {
      test_file: ["plain/txt", Buffer.from("data")],
    },
  };

  await expect(
    client.createExample(example, { foo: "bar" }, {})
  ).rejects.toThrow(
    "Cannot provide outputs or options when using ExampleCreate object"
  );

  await expect(client.createExample(invalidExample)).rejects.toThrow(
    "Must provide either datasetName or datasetId"
  );

  await expect(client.createExample(invalidExample2)).rejects.toThrow(
    "Must provide either datasetName or datasetId, not both"
  );

  await expect(client.createExample({ foo: "bar" }, {}, {})).rejects.toThrow(
    "Must provide either datasetName or datasetId"
  );

  await expect(
    client.createExample(
      { foo: "bar" },
      {},
      { datasetId: dataset.id, datasetName: datasetName }
    )
  ).rejects.toThrow("Must provide either datasetName or datasetId, not both");

  // Clean up
  await client.deleteDataset({ datasetName });
});
