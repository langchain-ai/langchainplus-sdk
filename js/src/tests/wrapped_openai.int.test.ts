/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-process-env */
import { jest } from "@jest/globals";
import { OpenAI } from "openai";
import { wrapOpenAI } from "../wrappers/index.js";
import { Client } from "../client.js";
import { mockClient } from "./utils/mock_client.js";
import { getAssumedTreeFromCalls } from "./utils/tree.js";

test("wrapOpenAI should return type compatible with OpenAI", async () => {
  let originalClient = new OpenAI();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  originalClient = wrapOpenAI(originalClient);

  expect(true).toBe(true);
});

test.concurrent("chat.completions", async () => {
  const client = new Client({ autoBatchTracing: false });
  const callSpy = jest
    .spyOn((client as any).caller, "call")
    .mockResolvedValue({ ok: true, text: () => "" });

  const originalClient = new OpenAI();
  const patchedClient = wrapOpenAI(new OpenAI(), { client });

  // invoke
  const original = await originalClient.chat.completions.create({
    messages: [{ role: "user", content: `Say 'foo'` }],
    temperature: 0,
    seed: 42,
    model: "gpt-3.5-turbo",
  });

  const patched = await patchedClient.chat.completions.create({
    messages: [{ role: "user", content: `Say 'foo'` }],
    temperature: 0,
    seed: 42,
    model: "gpt-3.5-turbo",
  });

  expect(patched.choices).toEqual(original.choices);

  const response = await patchedClient.chat.completions
    .create({
      messages: [{ role: "user", content: `Say 'foo'` }],
      temperature: 0,
      seed: 42,
      model: "gpt-3.5-turbo",
    })
    .asResponse();

  expect(response.ok).toBe(true);

  // stream
  const originalStream = await originalClient.chat.completions.create({
    messages: [{ role: "user", content: `Say 'foo'` }],
    temperature: 0,
    seed: 42,
    model: "gpt-3.5-turbo",
    stream: true,
  });

  const originalChoices: unknown[] = [];
  for await (const chunk of originalStream) {
    originalChoices.push(chunk.choices);
  }

  const patchedStream = await patchedClient.chat.completions.create({
    messages: [{ role: "user", content: `Say 'foo'` }],
    temperature: 0,
    seed: 42,
    model: "gpt-3.5-turbo",
    stream: true,
  });

  const patchedChoices: unknown[] = [];
  for await (const chunk of patchedStream) {
    patchedChoices.push(chunk.choices);
    // @ts-expect-error Should type check streamed output
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _test = chunk.invalidPrompt;
  }

  expect(patchedChoices).toEqual(originalChoices);
  expect(callSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
  for (const call of callSpy.mock.calls) {
    expect(["POST", "PATCH"]).toContain((call[2] as any)["method"]);
  }
  callSpy.mockClear();

  const patchedStreamToBreak = await patchedClient.chat.completions.create({
    messages: [{ role: "user", content: `Say 'hello world hello again'` }],
    temperature: 0,
    seed: 42,
    model: "gpt-3.5-turbo",
    stream: true,
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for await (const _ of patchedStreamToBreak) {
    break;
  }

  expect(callSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
  for (const call of callSpy.mock.calls) {
    expect(["POST", "PATCH"]).toContain((call[2] as any)["method"]);
  }
  callSpy.mockClear();

  const patchedStreamWithMetadata = await patchedClient.chat.completions.create(
    {
      messages: [{ role: "user", content: `Say 'foo'` }],
      temperature: 0,
      seed: 42,
      model: "gpt-3.5-turbo",
      stream: true,
    },
    {
      langsmithExtra: {
        metadata: {
          thing1: "thing2",
        },
      },
    }
  );

  const patchedChoices2: unknown[] = [];
  for await (const chunk of patchedStreamWithMetadata) {
    patchedChoices2.push(chunk.choices);
    // @ts-expect-error Should type check streamed output
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _test = chunk.invalidPrompt;
  }

  expect(patchedChoices2).toEqual(originalChoices);
  expect(callSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
  for (const call of callSpy.mock.calls) {
    expect(["POST", "PATCH"]).toContain((call[2] as any)["method"]);
  }
  callSpy.mockClear();
});

test.concurrent("chat completions with tool calling", async () => {
  const client = new Client({ autoBatchTracing: false });
  const callSpy = jest
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .spyOn((client as any).caller, "call")
    .mockResolvedValue({ ok: true, text: () => "" });

  const originalClient = new OpenAI();
  const patchedClient = wrapOpenAI(new OpenAI(), { client });
  const removeToolCallId = (
    choices:
      | OpenAI.ChatCompletion.Choice[]
      | OpenAI.ChatCompletionChunk.Choice[][]
  ) => {
    if (Array.isArray(choices[0])) {
      return (choices as OpenAI.ChatCompletionChunk.Choice[][]).map(
        (choices) => {
          return choices.map((choice) => {
            choice.delta.tool_calls = choice.delta.tool_calls?.map(
              (toolCall) => {
                const { id, ...rest } = toolCall;
                return rest;
              }
            ) as any;
            return choice;
          });
        }
      );
    } else {
      return (choices as OpenAI.ChatCompletion.Choice[]).map((choice) => {
        choice.message.tool_calls = choice.message.tool_calls?.map(
          (toolCall) => {
            const { id, ...rest } = toolCall;
            return rest;
          }
        ) as any;
        return choice;
      });
    }
  };

  const toolDefinition = [
    {
      type: "function" as const,
      function: {
        name: "get_current_weather",
        description: "Get the current weather in a given location",
        parameters: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "The city and only the city, e.g. San Francisco",
            },
          },
          required: ["location"],
        },
      },
    },
  ];

  // invoke
  const original = await originalClient.chat.completions.create({
    messages: [{ role: "user", content: `What is the current weather in SF?` }],
    temperature: 0,
    seed: 42,
    model: "gpt-3.5-turbo",
    tools: toolDefinition,
    tool_choice: {
      type: "function",
      function: { name: "get_current_weather" },
    },
  });

  const patched = await patchedClient.chat.completions.create({
    messages: [{ role: "user", content: `What is the current weather in SF?` }],
    temperature: 0,
    seed: 42,
    model: "gpt-3.5-turbo",
    tools: toolDefinition,
    tool_choice: {
      type: "function",
      function: { name: "get_current_weather" },
    },
  });

  expect(removeToolCallId(patched.choices)).toEqual(
    removeToolCallId(original.choices)
  );

  // stream
  const originalStream = await originalClient.chat.completions.create({
    messages: [{ role: "user", content: `What is the current weather in SF?` }],
    temperature: 0,
    seed: 42,
    model: "gpt-3.5-turbo",
    tools: toolDefinition,
    tool_choice: {
      type: "function",
      function: { name: "get_current_weather" },
    },
    stream: true,
  });

  const originalChoices: any[] = [];
  for await (const chunk of originalStream) {
    originalChoices.push(chunk.choices);
  }

  const patchedStream = await patchedClient.chat.completions.create({
    messages: [{ role: "user", content: `What is the current weather in SF?` }],
    temperature: 0,
    seed: 42,
    model: "gpt-3.5-turbo",
    tools: toolDefinition,
    tool_choice: {
      type: "function",
      function: { name: "get_current_weather" },
    },
    stream: true,
  });

  const patchedChoices: any[] = [];
  for await (const chunk of patchedStream) {
    patchedChoices.push(chunk.choices);
    // @ts-expect-error Should type check streamed output
    const _test = chunk.invalidPrompt;
  }

  expect(removeToolCallId(patchedChoices)).toEqual(
    removeToolCallId(originalChoices)
  );
  expect(callSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
  for (const call of callSpy.mock.calls) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(["POST", "PATCH"]).toContain((call[2] as any)["method"]);
  }
  callSpy.mockClear();

  const patchedStream2 = await patchedClient.chat.completions.create(
    {
      messages: [
        { role: "user", content: `What is the current weather in SF?` },
      ],
      temperature: 0,
      seed: 42,
      model: "gpt-3.5-turbo",
      tools: toolDefinition,
      tool_choice: {
        type: "function",
        function: { name: "get_current_weather" },
      },
      stream: true,
    },
    {
      langsmithExtra: {
        metadata: {
          thing1: "thing2",
        },
      },
    }
  );

  const patchedChoices2: any[] = [];
  for await (const chunk of patchedStream2) {
    patchedChoices2.push(chunk.choices);
    // @ts-expect-error Should type check streamed output
    const _test = chunk.invalidPrompt;
  }

  expect(removeToolCallId(patchedChoices2)).toEqual(
    removeToolCallId(originalChoices)
  );
  expect(callSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
  for (const call of callSpy.mock.calls) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(["POST", "PATCH"]).toContain((call[2] as any)["method"]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(JSON.parse((call[2] as any).body).extra.metadata).toEqual({
      thing1: "thing2",
      ls_model_name: "gpt-3.5-turbo",
      ls_model_type: "chat",
      ls_provider: "openai",
      ls_temperature: 0,
    });
  }
  callSpy.mockClear();
});

test.concurrent("completions", async () => {
  const client = new Client({ autoBatchTracing: false });
  const callSpy = jest
    .spyOn((client as any).caller, "call")
    .mockResolvedValue({ ok: true, text: () => "" });

  const originalClient = new OpenAI();
  const patchedClient = wrapOpenAI(new OpenAI(), { client });

  const prompt = `Say 'Hi I'm ChatGPT' then stop.`;

  // invoke
  const original = await originalClient.completions.create({
    prompt,
    temperature: 0,
    seed: 42,
    model: "gpt-3.5-turbo-instruct",
  });

  const patched = await patchedClient.completions.create({
    prompt,
    temperature: 0,
    seed: 42,
    model: "gpt-3.5-turbo-instruct",
  });

  expect(patched.choices).toEqual(original.choices);

  // stream
  const originalStream = await originalClient.completions.create({
    prompt,
    temperature: 0,
    seed: 42,
    model: "gpt-3.5-turbo-instruct",
    stream: true,
  });

  const originalChoices: unknown[] = [];
  for await (const chunk of originalStream) {
    originalChoices.push(chunk.choices);
    // @ts-expect-error Should type check streamed output
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _test = chunk.invalidPrompt;
  }

  const patchedStream = await patchedClient.completions.create({
    prompt,
    temperature: 0,
    seed: 42,
    model: "gpt-3.5-turbo-instruct",
    stream: true,
  });

  const patchedChoices: unknown[] = [];
  for await (const chunk of patchedStream) {
    patchedChoices.push(chunk.choices);
    // @ts-expect-error Should type check streamed output
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _test = chunk.invalidPrompt;
  }

  expect(patchedChoices).toEqual(originalChoices);
  expect(callSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
  for (const call of callSpy.mock.calls) {
    expect(["POST", "PATCH"]).toContain((call[2] as any)["method"]);
  }

  const patchedStream2 = await patchedClient.completions.create(
    {
      prompt,
      temperature: 0,
      seed: 42,
      model: "gpt-3.5-turbo-instruct",
      stream: true,
    },
    {
      langsmithExtra: {
        metadata: {
          thing1: "thing2",
        },
      },
    }
  );

  const patchedChoices2: unknown[] = [];
  for await (const chunk of patchedStream2) {
    patchedChoices2.push(chunk.choices);
    // @ts-expect-error Should type check streamed output
    const _test = chunk.invalidPrompt;
  }

  expect(patchedChoices2).toEqual(originalChoices);
  expect(callSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
  for (const call of callSpy.mock.calls) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(["POST", "PATCH"]).toContain((call[2] as any)["method"]);
  }
});

test.skip("with initialization time config", async () => {
  const patchedClient = wrapOpenAI(new OpenAI(), {
    project_name: "alternate_project",
    metadata: {
      customKey: "customVal",
    },
  });
  const patchedStream = await patchedClient.chat.completions.create({
    messages: [{ role: "user", content: `What is the current weather in SF?` }],
    temperature: 0,
    seed: 42,
    model: "gpt-3.5-turbo",
    stream: true,
  });

  const patchedChoices: unknown[] = [];
  for await (const chunk of patchedStream) {
    patchedChoices.push(chunk.choices);
    // @ts-expect-error Should type check streamed output
    const _test = chunk.invalidPrompt;
  }
});

test.skip("no tracing with env var unset", async () => {
  process.env.LANGCHAIN_TRACING_V2 = undefined;
  process.env.LANGSMITH_TRACING_V2 = undefined;
  const patchedClient = wrapOpenAI(new OpenAI());
  const patched = await patchedClient.chat.completions.create({
    messages: [{ role: "user", content: `Say 'bazqux'` }],
    temperature: 0,
    seed: 42,
    model: "gpt-3.5-turbo",
  });
  expect(patched).toBeDefined();
});

test("wrapping same instance", async () => {
  const wrapped = wrapOpenAI(new OpenAI());
  expect(() => wrapOpenAI(wrapped)).toThrowError(
    "This instance of OpenAI client has been already wrapped once."
  );
});

test("chat.concurrent extra name", async () => {
  const { client, callSpy } = mockClient();

  const openai = wrapOpenAI(new OpenAI(), {
    client,
  });

  await openai.chat.completions.create(
    {
      messages: [{ role: "user", content: `Say 'red'` }],
      temperature: 0,
      seed: 42,
      model: "gpt-3.5-turbo",
    },
    { langsmithExtra: { name: "red", metadata: { customKey: "red" } } }
  );

  const stream = await openai.chat.completions.create(
    {
      messages: [{ role: "user", content: `Say 'green'` }],
      temperature: 0,
      seed: 42,
      model: "gpt-3.5-turbo",
      stream: true,
    },
    { langsmithExtra: { name: "green", metadata: { customKey: "green" } } }
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for await (const _ of stream) {
    // pass
  }

  expect(getAssumedTreeFromCalls(callSpy.mock.calls)).toMatchObject({
    nodes: ["red:0", "green:1"],
    edges: [],
    data: {
      "red:0": {
        name: "red",
        extra: { metadata: { customKey: "red" } },
        outputs: {
          choices: [
            { index: 0, message: { role: "assistant", content: "Red" } },
          ],
        },
      },
      "green:1": {
        name: "green",
        extra: { metadata: { customKey: "green" } },
        outputs: {
          choices: [
            { index: 0, message: { role: "assistant", content: "Green" } },
          ],
        },
      },
    },
  });
});
