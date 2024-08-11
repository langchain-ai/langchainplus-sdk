/* eslint-disable @typescript-eslint/no-explicit-any */
import { v4 as uuidv4 } from "uuid";
import { OpenAI } from "openai";
// eslint-disable-next-line import/no-extraneous-dependencies
import { FakeStreamingLLM } from "@langchain/core/utils/testing";
import { Client } from "../client.js";
import {
  getCurrentRunTree,
  isTraceableFunction,
  traceable,
} from "../traceable.js";
import { RunTree } from "../run_trees.js";
import { BaseRun } from "../schemas.js";
import { expect } from "@jest/globals";

async function deleteProject(langchainClient: Client, projectName: string) {
  try {
    await langchainClient.readProject({ projectName });
    await langchainClient.deleteProject({ projectName });
  } catch (e) {
    // Pass
  }
}

async function waitUntil(
  condition: () => Promise<boolean>,
  timeout: number,
  interval: number
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error("Timeout");
}

async function waitUntilRunFound(
  client: Client,
  runId: string,
  checkOutputs = false
) {
  return waitUntil(
    async () => {
      try {
        const run = await client.readRun(runId);
        if (checkOutputs) {
          return (
            run.outputs !== null &&
            run.outputs !== undefined &&
            Object.keys(run.outputs).length !== 0
          );
        }
        return true;
      } catch (e) {
        return false;
      }
    },
    30_000,
    5_000
  );
}

test.concurrent("Test traceable wrapper with error thrown", async () => {
  const langchainClient = new Client({
    callerOptions: { maxRetries: 0 },
  });
  const runId = uuidv4();
  const projectName = "__test_traceable_wrapper";
  let collectedRun: BaseRun | null = null;
  const _getRun = (r: RunTree): void => {
    collectedRun = r;
  };
  const addValueTraceable = traceable(
    (_: string, __: number) => {
      throw new Error("I am bad");
    },
    {
      name: "add_value",
      project_name: projectName,
      client: langchainClient,
      id: runId,
      on_end: _getRun,
      tracingEnabled: true,
    }
  );

  expect(isTraceableFunction(addValueTraceable)).toBe(true);
  try {
    expect(await addValueTraceable("testing", 9)).toBe("testing9");
  } catch (e: any) {
    expect(e.message).toEqual("I am bad");
  }
  expect(collectedRun).not.toBeNull();
  expect(collectedRun!.error).toEqual("Error: I am bad");
  await waitUntilRunFound(langchainClient, runId);
  const storedRun = await langchainClient.readRun(runId);
  expect(storedRun.id).toEqual(runId);
  expect(storedRun.status).toEqual("error");
  expect(storedRun.error).toEqual("Error: I am bad");
});

test.concurrent("Test traceable wrapper with async error thrown", async () => {
  const langchainClient = new Client({
    callerOptions: { maxRetries: 0 },
  });
  const runId = uuidv4();
  const projectName = "__test_traceable_wrapper";
  let collectedRun: BaseRun | null = null;
  const _getRun = (r: RunTree): void => {
    collectedRun = r;
  };
  const addValueTraceable = traceable(
    async (_: string, __: number) => {
      throw new Error("I am bad");
    },
    {
      name: "add_value",
      project_name: projectName,
      client: langchainClient,
      id: runId,
      on_end: _getRun,
      tracingEnabled: true,
    }
  );

  expect(isTraceableFunction(addValueTraceable)).toBe(true);
  try {
    expect(await addValueTraceable("testing", 9)).toBe("testing9");
  } catch (e: any) {
    expect(e.message).toEqual("I am bad");
  }

  expect(collectedRun).not.toBeNull();
  expect(collectedRun!.error).toEqual("Error: I am bad");
  expect(collectedRun!.inputs).toEqual({ args: ["testing", 9] });
  await waitUntilRunFound(langchainClient, runId);
  const storedRun = await langchainClient.readRun(runId);
  expect(storedRun.id).toEqual(runId);
  expect(storedRun.status).toEqual("error");
  expect(storedRun.error).toEqual("Error: I am bad");
});

test.concurrent(
  "Test traceable wrapper",
  async () => {
    const langchainClient = new Client({
      callerOptions: { maxRetries: 0 },
    });
    const runId = uuidv4();
    const projectName = "__test_traceable_wrapper";
    let collectedRun: BaseRun | null = null;
    const _getRun = (r: RunTree): void => {
      collectedRun = r;
    };
    const addValueTraceable = traceable(
      (a: string, b: number) => {
        return a + b;
      },
      {
        name: "add_value",
        project_name: projectName,
        client: langchainClient,
        id: runId,
        on_end: _getRun,
        tracingEnabled: true,
      }
    );

    expect(await addValueTraceable("testing", 9)).toBe("testing9");
    expect(isTraceableFunction(addValueTraceable)).toBe(true);

    expect(collectedRun).not.toBeNull();
    expect(collectedRun!.outputs).toEqual({ outputs: "testing9" });
    await waitUntilRunFound(langchainClient, runId, true);
    const storedRun = await langchainClient.readRun(runId);
    expect(storedRun.id).toEqual(runId);

    const runId2 = uuidv4();
    const nestedAddValueTraceable = traceable(
      (a: string, b: number) => {
        return a + b;
      },
      {
        name: "nested_add_value",
        project_name: projectName,
        client: langchainClient,
      }
    );
    const entryTraceable = traceable(
      async (complex: { value: string }) => {
        const result = await nestedAddValueTraceable(complex.value, 1);
        const result2 = await nestedAddValueTraceable(result, 2);
        await nestedAddValueTraceable(
          new RunTree({
            name: "root_nested_add_value",
            project_name: projectName,
            client: langchainClient,
          }),
          result,
          2
        );
        return nestedAddValueTraceable(result2, 3);
      },
      {
        name: "run_with_nesting",
        project_name: projectName,
        client: langchainClient,
        id: runId2,
      }
    );

    expect(await entryTraceable({ value: "testing" })).toBe("testing123");
    expect(isTraceableFunction(entryTraceable)).toBe(true);

    await waitUntilRunFound(langchainClient, runId2, true);
    const storedRun2 = await langchainClient.readRun(runId2);
    expect(storedRun2.id).toEqual(runId2);

    const runId3 = uuidv4();

    const llm = new FakeStreamingLLM({ sleep: 0 });
    collectedRun = null;

    const iterableTraceable = traceable(llm.stream.bind(llm), {
      name: "iterable_traceable",
      project_name: projectName,
      client: langchainClient,
      id: runId3,
      on_end: (r: RunTree): void => {
        collectedRun = r;
      },
      tracingEnabled: true,
    });
    expect(isTraceableFunction(iterableTraceable)).toBe(true);

    const chunks = [];

    for await (const chunk of await iterableTraceable("Hello there")) {
      chunks.push(chunk);
    }
    expect(chunks.join("")).toBe("Hello there");
    expect(collectedRun).not.toBeNull();
    expect(collectedRun!.outputs).not.toBeNull();
    await waitUntilRunFound(langchainClient, runId3, true);
    const storedRun3 = await langchainClient.readRun(runId3);
    expect(storedRun3.id).toEqual(runId3);

    await deleteProject(langchainClient, projectName);

    async function overload(a: string, b: number): Promise<string>;
    async function overload(config: { a: string; b: number }): Promise<string>;
    async function overload(
      ...args: [a: string, b: number] | [config: { a: string; b: number }]
    ): Promise<string> {
      if (args.length === 1) {
        return args[0].a + args[0].b;
      }
      return args[0] + args[1];
    }

    const wrappedOverload = traceable(overload, {
      name: "wrapped_overload",
      project_name: projectName,
      client: langchainClient,
    });

    expect(await wrappedOverload("testing", 123)).toBe("testing123");
    expect(await wrappedOverload({ a: "testing", b: 456 })).toBe("testing456");
    expect(isTraceableFunction(wrappedOverload)).toBe(true);
  },
  180_000
);

test.concurrent("Test get run tree method", async () => {
  const langchainClient = new Client({
    callerOptions: { maxRetries: 0 },
  });
  // Called outside a traceable function
  expect(() => getCurrentRunTree()).toThrowError();
  const runId = uuidv4();
  const projectName = "__test_traceable_wrapper";
  const nestedAddValueTraceable = traceable(
    (a: string, b: number) => {
      const runTree = getCurrentRunTree();
      expect(runTree.id).toBeDefined();
      expect(runTree.id).not.toEqual(runId);
      expect(runTree.dotted_order.includes(`${runId}.`)).toBe(true);
      return a + b;
    },
    {
      name: "nested_add_value",
      project_name: projectName,
      client: langchainClient,
    }
  );
  const addValueTraceable = traceable(
    (a: string, b: number) => {
      const runTree = getCurrentRunTree();
      expect(runTree.id).toBe(runId);
      return nestedAddValueTraceable(a, b);
    },
    {
      name: "add_value",
      project_name: projectName,
      client: langchainClient,
      id: runId,
    }
  );
  expect(await addValueTraceable("testing", 9)).toBe("testing9");
});

test.concurrent("Test traceable wrapper with aggregator", async () => {
  const langchainClient = new Client({
    callerOptions: { maxRetries: 0 },
  });
  const openai = new OpenAI();
  const runId = uuidv4();
  const projectName = "__test_traceable_wrapper_aggregator";

  let collectedRun: BaseRun | null = null;
  const _getRun = (r: RunTree): void => {
    collectedRun = r;
  };
  let tracedOutput;
  const iterableTraceable = traceable(
    openai.chat.completions.create.bind(openai.chat.completions),
    {
      name: "openai_traceable",
      project_name: projectName,
      client: langchainClient,
      id: runId,
      aggregator: (chunks) => {
        tracedOutput = chunks
          .map((chunk) => chunk?.choices[0]?.delta?.content ?? "")
          .join("");
        return tracedOutput;
      },
      on_end: _getRun,
      tracingEnabled: true,
    }
  );
  expect(isTraceableFunction(iterableTraceable)).toBe(true);

  const chunks = [];

  for await (const chunk of await iterableTraceable({
    messages: [{ content: "Hello there", role: "user" }],
    model: "gpt-3.5-turbo",
    stream: true,
  })) {
    chunks.push(chunk);
    // @ts-expect-error Should have typechecking on streamed output
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _test = chunk.invalidProp;
  }
  expect(typeof tracedOutput).toEqual("string");
  expect(collectedRun).not.toBeNull();
  expect(collectedRun!.outputs).toEqual({ outputs: tracedOutput });
  await waitUntilRunFound(langchainClient, runId, true);
  const storedRun3 = await langchainClient.readRun(runId);
  expect(storedRun3.id).toEqual(runId);
});

test.concurrent("Test async generator success", async () => {
  const langchainClient = new Client({
    callerOptions: { maxRetries: 0 },
  });
  const runId = uuidv4();
  const projectName = "__test_traceable_wrapper_aggregator";
  let collectedRun: BaseRun | null = null;
  const _getRun = (r: RunTree): void => {
    collectedRun = r;
  };

  async function* giveMeNumbers() {
    for (let i = 0; i < 5; i++) {
      yield i;
    }
  }

  const iterableTraceable = traceable(giveMeNumbers, {
    name: "i_traceable",
    project_name: projectName,
    client: langchainClient,
    id: runId,
    aggregator: (chunks) => {
      return chunks.join(" ");
    },
    on_end: _getRun,
    tracingEnabled: true,
  });
  expect(isTraceableFunction(iterableTraceable)).toBe(true);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for await (const _ of iterableTraceable()) {
    // Pass
  }
  expect(collectedRun).not.toBeNull();
  expect(collectedRun!.outputs).toEqual({ outputs: "0 1 2 3 4" });
  await waitUntilRunFound(langchainClient, runId);
  const storedRun3 = await langchainClient.readRun(runId);
  expect(storedRun3.id).toEqual(runId);
  expect(storedRun3.status).toEqual("success");
  expect(storedRun3.outputs).toEqual({ outputs: "0 1 2 3 4" });
  expect(storedRun3.error).toBeFalsy();
});

test.concurrent("Test async generator throws error", async () => {
  const langchainClient = new Client({
    callerOptions: { maxRetries: 0 },
  });
  const runId = uuidv4();
  const projectName = "__test_traceable_wrapper_aggregator";
  let collectedRun: BaseRun | null = null;

  const _getRun = (r: RunTree): void => {
    collectedRun = r;
  };

  async function* giveMeNumbers() {
    for (let i = 0; i < 5; i++) {
      yield i;
      if (i == 2) {
        throw new Error("I am bad");
      }
    }
  }

  const iterableTraceable = traceable(giveMeNumbers, {
    name: "i_traceable",
    project_name: projectName,
    client: langchainClient,
    id: runId,
    aggregator: (chunks) => {
      return chunks.join(" ");
    },
    on_end: _getRun,
    tracingEnabled: true,
  });
  expect(isTraceableFunction(iterableTraceable)).toBe(true);

  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of iterableTraceable()) {
      // Pass
    }
  } catch (err: any) {
    expect(err.message).toEqual("I am bad");
  }
  expect(collectedRun).not.toBeNull();
  expect(collectedRun!.outputs).toEqual({ outputs: "0 1 2" });
  await waitUntilRunFound(langchainClient, runId);
  const storedRun3 = await langchainClient.readRun(runId);
  expect(storedRun3.id).toEqual(runId);
  expect(storedRun3.status).toEqual("error");
  expect(storedRun3.outputs).toEqual({ outputs: "0 1 2" });
  expect(storedRun3.error).toEqual("Error: I am bad");
});

test.concurrent("Test async generator break finishes run", async () => {
  const langchainClient = new Client({
    callerOptions: { maxRetries: 0 },
  });
  const runId = uuidv4();
  const projectName = "__test_traceable_wrapper_aggregator";
  let collectedRun: BaseRun | null = null;
  const _getRun = (r: RunTree): void => {
    collectedRun = r;
  };

  async function* giveMeNumbers() {
    for (let i = 0; i < 5; i++) {
      yield i;
    }
  }

  const iterableTraceable = traceable(giveMeNumbers, {
    name: "i_traceable",
    project_name: projectName,
    client: langchainClient,
    id: runId,
    aggregator: (chunks) => {
      return chunks.join(" ");
    },
    on_end: _getRun,
    tracingEnabled: true,
  });
  expect(isTraceableFunction(iterableTraceable)).toBe(true);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for await (const _ of iterableTraceable()) {
    break;
  }
  expect(collectedRun).not.toBeNull();
  expect(collectedRun!.outputs).toEqual({ outputs: "0" });
  expect(collectedRun!.id).toEqual(runId);
  await waitUntilRunFound(langchainClient, runId);
  const storedRun3 = await langchainClient.readRun(runId);
  expect(storedRun3.id).toEqual(runId);
  expect(storedRun3.status).toEqual("error");
  expect(storedRun3.outputs).toEqual({ outputs: "0" });
  expect(storedRun3.error).toEqual("Cancelled");
});

test.concurrent("Test async generator success", async () => {
  const langchainClient = new Client({
    callerOptions: { maxRetries: 0 },
  });
  const runId = uuidv4();
  const projectName = "__test_traceable_wrapper_aggregator";
  let collectedRun: BaseRun | null = null;
  const _getRun = (r: RunTree): void => {
    collectedRun = r;
  };

  async function giveMeGiveMeNumbers() {
    async function* giveMeNumbers() {
      for (let i = 0; i < 5; i++) {
        yield i;
      }
    }
    return giveMeNumbers();
  }

  const iterableTraceable = traceable(giveMeGiveMeNumbers, {
    name: "i_traceable",
    project_name: projectName,
    client: langchainClient,
    id: runId,
    aggregator: (chunks) => {
      return chunks.join(" ");
    },
    on_end: _getRun,
    tracingEnabled: true,
  });
  expect(isTraceableFunction(iterableTraceable)).toBe(true);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for await (const _ of await iterableTraceable()) {
    // Pass
  }
  expect(collectedRun).not.toBeNull();
  expect(collectedRun!.outputs).toEqual({ outputs: "0 1 2 3 4" });
  expect(collectedRun!.id).toEqual(runId);
  await waitUntilRunFound(langchainClient, runId);
  const storedRun3 = await langchainClient.readRun(runId);
  expect(storedRun3.id).toEqual(runId);
  expect(storedRun3.status).toEqual("success");
  expect(storedRun3.outputs).toEqual({ outputs: "0 1 2 3 4" });
  expect(storedRun3.error).toBeFalsy();
});

test.concurrent("Test promise for async generator success", async () => {
  const langchainClient = new Client({
    callerOptions: { maxRetries: 0 },
  });
  const runId = uuidv4();
  const projectName = "__test_traceable_wrapper_aggregator";
  let collectedRun: BaseRun | null = null;

  async function giveMeGiveMeNumbers() {
    async function* giveMeNumbers() {
      for (let i = 0; i < 5; i++) {
        yield i;
        if (i == 2) {
          throw new Error("I am bad");
        }
      }
    }
    return giveMeNumbers();
  }

  const iterableTraceable = traceable(giveMeGiveMeNumbers, {
    name: "i_traceable",
    project_name: projectName,
    client: langchainClient,
    id: runId,
    aggregator: (chunks) => {
      return chunks.join(" ");
    },
    on_end: (r: RunTree): void => {
      collectedRun = r;
    },
    tracingEnabled: true,
  });
  expect(isTraceableFunction(iterableTraceable)).toBe(true);

  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of await iterableTraceable()) {
      // Pass
    }
  } catch (err: any) {
    expect(err.message).toEqual("I am bad");
  }
  expect(collectedRun).not.toBeNull();
  expect(collectedRun!.outputs).toEqual({ outputs: "0 1 2" });
  expect(collectedRun!.id).toEqual(runId);
  await waitUntilRunFound(langchainClient, runId);
  const storedRun3 = await langchainClient.readRun(runId);
  expect(storedRun3.id).toEqual(runId);
  expect(storedRun3.status).toEqual("error");
  expect(storedRun3.outputs).toEqual({ outputs: "0 1 2" });
  expect(storedRun3.error).toEqual("Error: I am bad");
});

test.concurrent(
  "Test promise for async generator break finishes run",
  async () => {
    const langchainClient = new Client({
      callerOptions: { maxRetries: 0 },
    });
    const runId = uuidv4();
    const projectName = "__test_traceable_wrapper_aggregator";
    let collectedRun: BaseRun | null = null;

    const _getRun = (r: RunTree): void => {
      collectedRun = r;
    };

    async function giveMeGiveMeNumbers() {
      async function* giveMeNumbers() {
        for (let i = 0; i < 5; i++) {
          yield i;
        }
      }
      return giveMeNumbers();
    }

    const iterableTraceable = traceable(giveMeGiveMeNumbers, {
      name: "i_traceable",
      project_name: projectName,
      client: langchainClient,
      id: runId,
      aggregator: (chunks) => {
        return chunks.join(" ");
      },
      on_end: _getRun,
      tracingEnabled: true,
    });
    expect(isTraceableFunction(iterableTraceable)).toBe(true);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of await iterableTraceable()) {
      break;
    }
    expect(collectedRun).not.toBeNull();
    expect(collectedRun!.outputs).toEqual({ outputs: "0" });
    expect(collectedRun!.id).toEqual(runId);
    await waitUntilRunFound(langchainClient, runId);
    const storedRun3 = await langchainClient.readRun(runId);
    expect(storedRun3.id).toEqual(runId);
    expect(storedRun3.status).toEqual("error");
  }
);
