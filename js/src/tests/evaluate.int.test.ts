import {
  EvaluationResult,
  EvaluationResults,
} from "../evaluation/evaluator.js";
import { evaluate } from "../evaluation/_runner.js";
import { Example, Run, TracerSession } from "../schemas.js";
import { Client } from "../index.js";
import { afterAll, beforeAll } from "@jest/globals";
import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";

const TESTING_DATASET_NAME = `test_dataset_js_evaluate_${new Date().toISOString()}`;
const SPLITS_DATASET_NAME = `my_splits_ds2_${new Date().toISOString()}`;
const client = new Client();

type InputsType = { input: number };
type OutputsType = { output: number };

beforeAll(async () => {
  if (!(await client.hasDataset({ datasetName: TESTING_DATASET_NAME }))) {
    console.log(`Creating dataset ${TESTING_DATASET_NAME}`);

    // create a new dataset
    await client.createDataset(TESTING_DATASET_NAME, {
      description:
        "For testing purposed. Is created & deleted for each test run.",
    });

    const res = await client.createExamples({
      inputs: [{ input: 1 }, { input: 2 }] satisfies InputsType[],
      outputs: [{ output: 2 }, { output: 3 }] satisfies OutputsType[],
      datasetName: TESTING_DATASET_NAME,
    });

    if (res.length !== 2)
      throw new Error(`Failed to create examples for ${TESTING_DATASET_NAME}`);
  }

  if (!(await client.hasDataset({ datasetName: SPLITS_DATASET_NAME }))) {
    console.log(`Creating dataset ${SPLITS_DATASET_NAME}`);

    await client.createDataset(SPLITS_DATASET_NAME, {
      description:
        "For testing purposed. Is created & deleted for each test run.",
    });

    const res = await client.createExamples({
      inputs: [{ input: 1 }, { input: 2 }, { input: 3 }] satisfies InputsType[],
      outputs: [
        { output: 2 },
        { output: 3 },
        { output: 4 },
      ] satisfies OutputsType[],
      splits: [["test"], ["train"], ["validation", "test"]],
      datasetName: SPLITS_DATASET_NAME,
    });

    if (res.length !== 3)
      throw new Error(`Failed to create examples for ${SPLITS_DATASET_NAME}`);
  }
});

afterAll(async () => {
  await Promise.allSettled([
    (() => {
      console.log(`Deleting dataset ${TESTING_DATASET_NAME}`);
      return client.deleteDataset({ datasetName: TESTING_DATASET_NAME });
    })(),
    (() => {
      console.log(`Deleting dataset ${SPLITS_DATASET_NAME}`);
      return client.deleteDataset({ datasetName: SPLITS_DATASET_NAME });
    })(),
  ]);
});

test("evaluate can evaluate", async () => {
  const targetFunc = (input: InputsType) => ({ foo: input.input + 1 });

  const evalRes = await evaluate(targetFunc, {
    data: TESTING_DATASET_NAME,
    description: "Experiment from evaluate can evaluate integration test",
  });

  expect(evalRes.results).toHaveLength(2);

  expect(evalRes.results[0].run).toBeDefined();
  expect(evalRes.results[0].example).toBeDefined();
  expect(evalRes.results[0].evaluationResults).toBeDefined();

  const firstRun = evalRes.results[0].run;
  // The examples are not always in the same order, so it should always be 2 or 3
  expect(firstRun.outputs?.foo).toBeGreaterThanOrEqual(2);
  expect(firstRun.outputs?.foo).toBeLessThanOrEqual(3);

  const firstRunResults = evalRes.results[0].evaluationResults;
  expect(firstRunResults.results).toHaveLength(0);

  expect(evalRes.results[1].run).toBeDefined();
  expect(evalRes.results[1].example).toBeDefined();
  expect(evalRes.results[1].evaluationResults).toBeDefined();

  const secondRun = evalRes.results[1].run;
  // The examples are not always in the same order, so it should always be 2 or 3
  expect(secondRun.outputs?.foo).toBeGreaterThanOrEqual(2);
  expect(secondRun.outputs?.foo).toBeLessThanOrEqual(3);

  const secondRunResults = evalRes.results[1].evaluationResults;
  expect(secondRunResults.results).toHaveLength(0);
});

test("evaluate can repeat", async () => {
  const targetFunc = (input: InputsType) => ({ foo: input.input + 1 });

  const evalRes = await evaluate(targetFunc, {
    data: TESTING_DATASET_NAME,
    description: "Experiment from evaluate can evaluate integration test",
    numRepetitions: 3,
  });
  expect(evalRes.results).toHaveLength(6);

  for (let i = 0; i < 6; i++) {
    expect(evalRes.results[i].run).toBeDefined();
    expect(evalRes.results[i].example).toBeDefined();
    expect(evalRes.results[i].evaluationResults).toBeDefined();
    const currRun = evalRes.results[i].run;
    // The examples are not always in the same order, so it should always be 2 or 3
    expect(currRun.outputs?.foo).toBeGreaterThanOrEqual(2);
    expect(currRun.outputs?.foo).toBeLessThanOrEqual(3);

    const firstRunResults = evalRes.results[i].evaluationResults;
    expect(firstRunResults.results).toHaveLength(0);
  }
});

test("evaluate can evaluate with RunEvaluator evaluators", async () => {
  const targetFunc = (input: { input: number }) => {
    return { foo: input.input + 1 };
  };

  const customEvaluator = async (run: Run, example?: Example) => {
    return Promise.resolve({
      key: "key",
      score: 1,
      comment: `Run: ${run.id} Example: ${example?.id}`,
    });
  };
  const evaluator = {
    evaluateRun: customEvaluator,
  };
  const evalRes = await evaluate(targetFunc, {
    data: TESTING_DATASET_NAME,
    evaluators: [evaluator],
    description: "evaluate can evaluate with RunEvaluator evaluators",
  });

  expect(evalRes.results).toHaveLength(2);

  expect(evalRes.results[0].run).toBeDefined();
  expect(evalRes.results[0].example).toBeDefined();
  expect(evalRes.results[0].evaluationResults).toBeDefined();

  const firstRun = evalRes.results[0].run;
  // The examples are not always in the same order, so it should always be 2 or 3
  expect(firstRun.outputs?.foo).toBeGreaterThanOrEqual(2);
  expect(firstRun.outputs?.foo).toBeLessThanOrEqual(3);

  const firstExample = evalRes.results[0].example;
  expect(firstExample).toBeDefined();

  const firstEvalResults = evalRes.results[0].evaluationResults;
  expect(firstEvalResults.results).toHaveLength(1);
  expect(firstEvalResults.results[0].key).toEqual("key");
  expect(firstEvalResults.results[0].score).toEqual(1);

  expect(evalRes.results[1].run).toBeDefined();
  expect(evalRes.results[1].example).toBeDefined();
  expect(evalRes.results[1].evaluationResults).toBeDefined();

  const secondRun = evalRes.results[1].run;
  // The examples are not always in the same order, so it should always be 2 or 3
  expect(secondRun.outputs?.foo).toBeGreaterThanOrEqual(2);
  expect(secondRun.outputs?.foo).toBeLessThanOrEqual(3);

  const secondExample = evalRes.results[1].example;
  expect(secondExample).toBeDefined();

  const secondEvalResults = evalRes.results[1].evaluationResults;
  expect(secondEvalResults.results).toHaveLength(1);
  expect(secondEvalResults.results[0].key).toEqual("key");
  expect(secondEvalResults.results[0].score).toEqual(1);

  // Test runs & examples were passed to customEvaluator
  const expectedCommentStrings = [
    `Run: ${secondRun.id} Example: ${secondExample?.id}`,
    `Run: ${firstRun.id} Example: ${firstExample?.id}`,
  ];
  const receivedCommentStrings = evalRes.results
    .map(({ evaluationResults }) => evaluationResults.results[0].comment)
    .filter((c): c is string => !!c);
  expect(receivedCommentStrings.length).toBe(2);
  expect(receivedCommentStrings).toEqual(
    expect.arrayContaining(expectedCommentStrings)
  );
});

test("evaluate can evaluate with custom evaluators", async () => {
  const targetFunc = (input: InputsType) => ({ foo: input.input + 1 });

  const customEvaluator = (run: Run, example?: Example) => {
    return Promise.resolve({
      key: "key",
      score: 1,
      comment: `Run: ${run.id} Example: ${example?.id}`,
    });
  };

  const evalRes = await evaluate(targetFunc, {
    data: TESTING_DATASET_NAME,
    evaluators: [customEvaluator],
    description: "evaluate can evaluate with custom evaluators",
  });

  expect(evalRes.results).toHaveLength(2);

  expect(evalRes.results[0].run).toBeDefined();
  expect(evalRes.results[0].example).toBeDefined();
  expect(evalRes.results[0].evaluationResults).toBeDefined();

  const firstRun = evalRes.results[0].run;
  // The examples are not always in the same order, so it should always be 2 or 3
  expect(firstRun.outputs?.foo).toBeGreaterThanOrEqual(2);
  expect(firstRun.outputs?.foo).toBeLessThanOrEqual(3);

  const firstExample = evalRes.results[0].example;
  expect(firstExample).toBeDefined();

  const firstEvalResults = evalRes.results[0].evaluationResults;
  expect(firstEvalResults.results).toHaveLength(1);
  expect(firstEvalResults.results[0].key).toEqual("key");
  expect(firstEvalResults.results[0].score).toEqual(1);

  expect(evalRes.results[1].run).toBeDefined();
  expect(evalRes.results[1].example).toBeDefined();
  expect(evalRes.results[1].evaluationResults).toBeDefined();

  const secondRun = evalRes.results[1].run;
  // The examples are not always in the same order, so it should always be 2 or 3
  expect(secondRun.outputs?.foo).toBeGreaterThanOrEqual(2);
  expect(secondRun.outputs?.foo).toBeLessThanOrEqual(3);

  const secondExample = evalRes.results[1].example;
  expect(secondExample).toBeDefined();

  const secondEvalResults = evalRes.results[1].evaluationResults;
  expect(secondEvalResults.results).toHaveLength(1);
  expect(secondEvalResults.results[0].key).toEqual("key");
  expect(secondEvalResults.results[0].score).toEqual(1);

  // Test runs & examples were passed to customEvaluator
  const expectedCommentStrings = [
    `Run: ${secondRun.id} Example: ${secondExample?.id}`,
    `Run: ${firstRun.id} Example: ${firstExample?.id}`,
  ];
  const receivedCommentStrings = evalRes.results
    .map(({ evaluationResults }) => evaluationResults.results[0].comment)
    .filter((c): c is string => !!c);
  expect(receivedCommentStrings.length).toBe(2);
  expect(receivedCommentStrings).toEqual(
    expect.arrayContaining(expectedCommentStrings)
  );
});

test("evaluate can evaluate with summary evaluators", async () => {
  const targetFunc = (input: InputsType) => ({ foo: input.input + 1 });

  const customSummaryEvaluator = (
    runs: Run[],
    examples?: Example[]
  ): Promise<EvaluationResult> => {
    const runIds = runs.map(({ id }) => id).join(", ");
    const exampleIds = examples?.map(({ id }) => id).join(", ");
    return Promise.resolve({
      key: "key",
      score: 1,
      comment: `Runs: ${runIds} Examples: ${exampleIds}`,
    });
  };

  const evalRes = await evaluate(targetFunc, {
    data: TESTING_DATASET_NAME,
    summaryEvaluators: [customSummaryEvaluator],
    description: "evaluate can evaluate with summary evaluators",
  });

  expect(evalRes.summaryResults.results).toHaveLength(1);
  expect(evalRes.summaryResults.results[0].key).toBe("key");
  expect(evalRes.summaryResults.results[0].score).toBe(1);
  const allRuns = evalRes.results.map(({ run }) => run);
  const allExamples = evalRes.results.map(({ example }) => example);
  const runIds = allRuns.map(({ id }) => id).join(", ");
  const exampleIds = allExamples.map(({ id }) => id).join(", ");
  expect(evalRes.summaryResults.results[0].comment).toBe(
    `Runs: ${runIds} Examples: ${exampleIds}`
  );
  expect(evalRes.results).toHaveLength(2);

  expect(evalRes.results[0].run).toBeDefined();
  expect(evalRes.results[0].example).toBeDefined();
  expect(evalRes.results[0].evaluationResults).toBeDefined();

  const firstRun = evalRes.results[0].run;
  // The examples are not always in the same order, so it should always be 2 or 3
  expect(firstRun.outputs?.foo).toBeGreaterThanOrEqual(2);
  expect(firstRun.outputs?.foo).toBeLessThanOrEqual(3);

  expect(evalRes.results[1].run).toBeDefined();
  expect(evalRes.results[1].example).toBeDefined();
  expect(evalRes.results[1].evaluationResults).toBeDefined();

  const secondRun = evalRes.results[1].run;
  // The examples are not always in the same order, so it should always be 2 or 3
  expect(secondRun.outputs?.foo).toBeGreaterThanOrEqual(2);
  expect(secondRun.outputs?.foo).toBeLessThanOrEqual(3);
});

test.skip("can iterate over evaluate results", async () => {
  const targetFunc = (input: InputsType) => ({ foo: input.input + 1 });
  const customEvaluator = async (run: Run, example?: Example) => {
    return Promise.resolve({
      key: "key",
      score: 1,
      comment: `Run: ${run.id} Example: ${example?.id}`,
    });
  };
  const evaluator = {
    evaluateRun: customEvaluator,
  };
  const evalRes = await evaluate(targetFunc, {
    data: TESTING_DATASET_NAME,
    evaluators: [evaluator],
    description: "can iterate over evaluate results",
  });

  for await (const item of evalRes) {
    console.log("item", item);
  }
});

test("can pass multiple evaluators", async () => {
  const targetFunc = (input: InputsType) => ({ foo: input.input + 1 });

  const customEvaluatorOne = async (run: Run, example?: Example) => {
    return Promise.resolve({
      key: "key",
      score: 1,
      comment: `Run: ${run.id} Example: ${example?.id}`,
    });
  };
  const customEvaluatorTwo = async (run: Run, example?: Example) => {
    return Promise.resolve({
      key: "key",
      score: 1,
      comment: `Run: ${run.id} Example: ${example?.id}`,
    });
  };
  const evaluators = [
    { evaluateRun: customEvaluatorOne },
    { evaluateRun: customEvaluatorTwo },
  ];
  const evalRes = await evaluate(targetFunc, {
    data: TESTING_DATASET_NAME,
    evaluators: evaluators,
    description: "can pass multiple evaluators",
  });
  expect(evalRes.results).toHaveLength(2);
  const firstEvalResults = evalRes.results[0];
  expect(firstEvalResults.evaluationResults.results).toHaveLength(2);

  const firstRun = firstEvalResults.run;
  const firstExample = firstEvalResults.example;
  const receivedCommentStrings = firstEvalResults.evaluationResults.results
    .map(({ comment }) => comment)
    .filter((c): c is string => !!c);
  const expectedCommentStrings = `Run: ${firstRun.id} Example: ${firstExample?.id}`;
  // Checks that both evaluators were called with the expected run and example
  expect(receivedCommentStrings).toEqual(
    expect.arrayContaining([expectedCommentStrings, expectedCommentStrings])
  );
});

test("split info saved correctly", async () => {
  const targetFunc = (input: InputsType) => ({ foo: input.input + 1 });

  await evaluate(targetFunc, {
    data: client.listExamples({ datasetName: SPLITS_DATASET_NAME }),
    description: "splits info saved correctly",
  });

  const exp = client.listProjects({
    referenceDatasetName: SPLITS_DATASET_NAME,
  });
  let myExp: TracerSession | null = null;
  for await (const session of exp) {
    myExp = session;
  }
  expect(myExp?.extra?.metadata?.dataset_splits.sort()).toEqual(
    ["test", "train", "validation"].sort()
  );

  await evaluate(targetFunc, {
    data: client.listExamples({
      datasetName: SPLITS_DATASET_NAME,
      splits: ["test"],
    }),
    description: "splits info saved correctly",
  });

  const exp2 = client.listProjects({
    referenceDatasetName: SPLITS_DATASET_NAME,
  });
  let myExp2: TracerSession | null = null;
  for await (const session of exp2) {
    if (myExp2 === null || session.start_time > myExp2.start_time) {
      myExp2 = session;
    }
  }

  expect(myExp2?.extra?.metadata?.dataset_splits.sort()).toEqual(
    ["test", "validation"].sort()
  );

  await evaluate(targetFunc, {
    data: client.listExamples({
      datasetName: SPLITS_DATASET_NAME,
      splits: ["train"],
    }),
    description: "splits info saved correctly",
  });

  const exp3 = client.listProjects({
    referenceDatasetName: SPLITS_DATASET_NAME,
  });
  let myExp3: TracerSession | null = null;
  for await (const session of exp3) {
    if (myExp3 === null || session.start_time > myExp3.start_time) {
      myExp3 = session;
    }
  }

  expect(myExp3?.extra?.metadata?.dataset_splits.sort()).toEqual(
    ["train"].sort()
  );
});

test("can pass multiple summary evaluators", async () => {
  const targetFunc = (input: InputsType) => ({ foo: input.input + 1 });

  const customSummaryEvaluator = (
    runs: Run[],
    examples?: Example[]
  ): Promise<EvaluationResult> => {
    const runIds = runs.map(({ id }) => id).join(", ");
    const exampleIds = examples?.map(({ id }) => id).join(", ");
    return Promise.resolve({
      key: "key",
      score: 1,
      comment: `Runs: ${runIds} Examples: ${exampleIds}`,
    });
  };
  const summaryEvaluators = [customSummaryEvaluator, customSummaryEvaluator];
  const evalRes = await evaluate(targetFunc, {
    data: TESTING_DATASET_NAME,
    summaryEvaluators,
    description: "can pass multiple summary evaluators",
  });
  expect(evalRes.results).toHaveLength(2);

  const allRuns = evalRes.results.map(({ run }) => run);
  const allExamples = evalRes.results.map(({ example }) => example);
  const runIds = allRuns.map(({ id }) => id).join(", ");
  const exampleIds = allExamples.map(({ id }) => id).join(", ");

  const summaryResults = evalRes.summaryResults.results;
  expect(summaryResults).toHaveLength(2);

  const receivedCommentStrings = summaryResults
    .map(({ comment }) => comment)
    .filter((c): c is string => !!c);
  const expectedCommentString = `Runs: ${runIds} Examples: ${exampleIds}`;
  // Checks that both evaluators were called with the expected run and example
  expect(receivedCommentStrings).toEqual(
    expect.arrayContaining([expectedCommentString, expectedCommentString])
  );
});

test("can pass AsyncIterable of Example's to evaluator instead of dataset name", async () => {
  const examplesIterator = client.listExamples({
    datasetName: TESTING_DATASET_NAME,
  });

  const targetFunc = (input: InputsType) => ({ foo: input.input + 1 });

  const customEvaluator = (run: Run, example?: Example) => {
    return Promise.resolve({
      key: "key",
      score: 1,
      comment: `Run: ${run.id} Example: ${example?.id}`,
    });
  };

  const evalRes = await evaluate(targetFunc, {
    data: examplesIterator,
    evaluators: [customEvaluator],
    description: "can pass AsyncIterable of Example's to evaluator",
  });

  const firstEvalResults = evalRes.results[0];
  const runId = firstEvalResults.run.id;
  const exampleId = firstEvalResults.example.id;
  const expectedCommentStrings = `Run: ${runId} Example: ${exampleId}`;
  const receivedCommentStrings =
    firstEvalResults.evaluationResults.results[0].comment;

  expect(evalRes.results).toHaveLength(2);
  expect(firstEvalResults.evaluationResults.results).toHaveLength(1);
  expect(receivedCommentStrings).toEqual(expectedCommentStrings);
});

test("max concurrency works with custom evaluators", async () => {
  const targetFunc = (input: InputsType) => ({ foo: input.input + 1 });

  const customEvaluator = (run: Run, example?: Example) => {
    return Promise.resolve({
      key: "key",
      score: 1,
      comment: `Run: ${run.id} Example: ${example?.id}`,
    });
  };

  const evalRes = await evaluate(targetFunc, {
    data: TESTING_DATASET_NAME,
    evaluators: [customEvaluator],
    maxConcurrency: 1,
    description: "max concurrency works with custom evaluators",
  });

  expect(evalRes.results).toHaveLength(2);
  const firstEvalResults = evalRes.results[0];
  const runId = firstEvalResults.run.id;
  const exampleId = firstEvalResults.example.id;
  const expectedCommentStrings = `Run: ${runId} Example: ${exampleId}`;
  const receivedCommentStrings =
    firstEvalResults.evaluationResults.results[0].comment;

  expect(evalRes.results).toHaveLength(2);
  expect(firstEvalResults.evaluationResults.results).toHaveLength(1);
  expect(receivedCommentStrings).toEqual(expectedCommentStrings);
});

test("max concurrency works with summary evaluators", async () => {
  const targetFunc = (input: InputsType) => ({ foo: input.input + 1 });

  const customSummaryEvaluator = (
    runs: Run[],
    examples?: Example[]
  ): Promise<EvaluationResult> => {
    const runIds = runs.map(({ id }) => id).join(", ");
    const exampleIds = examples?.map(({ id }) => id).join(", ");
    return Promise.resolve({
      key: "key",
      score: 1,
      comment: `Runs: ${runIds} Examples: ${exampleIds}`,
    });
  };

  const evalRes = await evaluate(targetFunc, {
    data: TESTING_DATASET_NAME,
    summaryEvaluators: [customSummaryEvaluator],
    maxConcurrency: 1,
    description: "max concurrency works with summary evaluators",
  });

  expect(evalRes.results).toHaveLength(2);

  const allRuns = evalRes.results.map(({ run }) => run);
  const allExamples = evalRes.results.map(({ example }) => example);
  const runIds = allRuns.map(({ id }) => id).join(", ");
  const exampleIds = allExamples.map(({ id }) => id).join(", ");

  const summaryResults = evalRes.summaryResults.results;
  expect(summaryResults).toHaveLength(1);

  const receivedCommentStrings = summaryResults[0].comment;
  const expectedCommentString = `Runs: ${runIds} Examples: ${exampleIds}`;
  // Checks that both evaluators were called with the expected run and example
  expect(receivedCommentStrings).toEqual(expectedCommentString);
});

test("Target func can be a runnable", async () => {
  const targetFunc = RunnableSequence.from([
    RunnableLambda.from((input: InputsType) => ({
      foo: input.input + 1,
    })).withConfig({ runName: "First Step" }),
    RunnableLambda.from((input: { foo: number }) => ({
      foo: input.foo + 1,
    })).withConfig({ runName: "Second Step" }),
  ]);

  const customEvaluator = async (run: Run, example?: Example) => {
    return Promise.resolve({
      key: "key",
      score: 1,
      comment: `Run: ${run.id} Example: ${example?.id}`,
    });
  };
  const evaluator = {
    evaluateRun: customEvaluator,
  };
  const evalRes = await evaluate(targetFunc, {
    data: TESTING_DATASET_NAME,
    evaluators: [evaluator],
    description: "Target func can be a runnable",
  });

  expect(evalRes.results).toHaveLength(2);

  expect(evalRes.results[0].run).toBeDefined();
  expect(evalRes.results[0].example).toBeDefined();
  expect(evalRes.results[0].evaluationResults).toBeDefined();

  const firstRun = evalRes.results[0].run;
  // The examples are not always in the same order, so it should always be 2 or 3
  expect(firstRun.outputs?.foo).toBeGreaterThanOrEqual(2);
  expect(firstRun.outputs?.foo).toBeLessThanOrEqual(3);

  const firstExample = evalRes.results[0].example;
  expect(firstExample).toBeDefined();

  const firstEvalResults = evalRes.results[0].evaluationResults;
  expect(firstEvalResults.results).toHaveLength(1);
  expect(firstEvalResults.results[0].key).toEqual("key");
  expect(firstEvalResults.results[0].score).toEqual(1);

  // check if the evaluated function has valid children
  const gatheredChildRunNames = [];
  const queue = [firstRun];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current.id)) continue;
    visited.add(current.id);
    if (current.child_runs) {
      gatheredChildRunNames.push(...current.child_runs.map((run) => run.name));
      queue.push(...current.child_runs);
    }
  }

  expect(gatheredChildRunNames).toEqual(
    expect.arrayContaining(["RunnableSequence", "First Step", "Second Step"])
  );
});

test("evaluate can accept array of examples", async () => {
  const examplesIterator = client.listExamples({
    datasetName: TESTING_DATASET_NAME,
  });
  const examples: Example[] = [];
  for await (const example of examplesIterator) {
    examples.push(example);
  }

  const targetFunc = (input: InputsType) => ({ foo: input.input + 1 });
  const customEvaluator = (run: Run, example?: Example) => {
    return Promise.resolve({
      key: "key",
      score: 1,
      comment: `Run: ${run.id} Example: ${example?.id}`,
    });
  };

  const evalRes = await evaluate(targetFunc, {
    data: examples,
    evaluators: [customEvaluator],
    description: "evaluate can accept array of examples",
  });

  const firstEvalResults = evalRes.results[0];
  const runId = firstEvalResults.run.id;
  const exampleId = firstEvalResults.example.id;
  const expectedCommentStrings = `Run: ${runId} Example: ${exampleId}`;
  const receivedCommentStrings =
    firstEvalResults.evaluationResults.results[0].comment;

  expect(evalRes.results).toHaveLength(2);
  expect(firstEvalResults.evaluationResults.results).toHaveLength(1);
  expect(receivedCommentStrings).toEqual(expectedCommentStrings);
});

test("evaluate accepts evaluators which return multiple feedback keys", async () => {
  const targetFunc = (input: InputsType) => ({ foo: input.input + 1 });
  const customEvaluator = (
    run: Run,
    example?: Example
  ): Promise<EvaluationResults> => {
    return Promise.resolve({
      results: [
        {
          key: "first-key",
          score: 1,
          comment: `Run: ${run.id} Example: ${example?.id}`,
        },
        {
          key: "second-key",
          score: 2,
          comment: `Run: ${run.id} Example: ${example?.id}`,
        },
      ],
    });
  };

  const evalRes = await evaluate(targetFunc, {
    data: TESTING_DATASET_NAME,
    evaluators: [customEvaluator],
    description: "evaluate can evaluate with custom evaluators",
  });

  expect(evalRes.results).toHaveLength(2);

  const comment = `Run: ${evalRes.results[0].run.id} Example: ${evalRes.results[0].example.id}`;
  expect(evalRes.results[0].evaluationResults.results).toMatchObject([
    { key: "first-key", score: 1, comment },
    { key: "second-key", score: 2, comment },
  ]);
});
