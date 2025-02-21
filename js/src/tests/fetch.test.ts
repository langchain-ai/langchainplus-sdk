/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from "@jest/globals";
import { Client } from "../client.js";
import { overrideFetchImplementation } from "../singletons/fetch.js";
import { traceable } from "../traceable.js";

describe.each([[""], ["mocked"]])("Client uses %s fetch", (description) => {
  let globalFetchMock: jest.Mock;
  let overriddenFetch: jest.Mock;
  let expectedFetchMock: jest.Mock;
  let unexpectedFetchMock: jest.Mock;

  beforeEach(() => {
    globalFetchMock = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            batch_ingest_config: {
              use_multipart_endpoint: true,
            },
          }),
        text: () => Promise.resolve(""),
      })
    );
    overriddenFetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            batch_ingest_config: {
              use_multipart_endpoint: true,
            },
          }),
        text: () => Promise.resolve(""),
      })
    );
    expectedFetchMock =
      description === "mocked" ? overriddenFetch : globalFetchMock;
    unexpectedFetchMock =
      description === "mocked" ? globalFetchMock : overriddenFetch;

    if (description === "mocked") {
      overrideFetchImplementation(overriddenFetch);
    } else {
      overrideFetchImplementation(globalFetchMock);
    }
    // Mock global fetch
    (globalThis as any).fetch = globalFetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("createLLMExample", () => {
    it("should create an example with the given input and generation", async () => {
      const client = new Client({ apiKey: "test-api-key" });
      jest.spyOn(client as any, "_getServerInfo").mockImplementation(() => {
        return {
          version: "foo",
          instance_flags: { dataset_examples_multipart_enabled: true },
        };
      });
      const input = "Hello, world!";
      const generation = "Bonjour, monde!";
      const options = { datasetName: "test-dataset" };

      await client.createLLMExample(input, generation, options);
      expect(expectedFetchMock).toHaveBeenCalled();
      expect(unexpectedFetchMock).not.toHaveBeenCalled();
    });
  });

  describe("createChatExample", () => {
    it("should convert LangChainBaseMessage objects to examples", async () => {
      const client = new Client({ apiKey: "test-api-key" });
      jest.spyOn(client as any, "_getServerInfo").mockImplementation(() => {
        return {
          version: "foo",
          instance_flags: { dataset_examples_multipart_enabled: true },
        };
      });
      const input = [
        { text: "Hello", sender: "user" },
        { text: "Hi there", sender: "bot" },
      ];
      const generations = {
        type: "langchain",
        data: { text: "Bonjour", sender: "bot" },
      };
      const options = { datasetName: "test-dataset" };

      await client.createChatExample(input, generations, options);

      expect(expectedFetchMock).toHaveBeenCalled();
      expect(unexpectedFetchMock).not.toHaveBeenCalled();
    });
  });

  test("basic traceable implementation", async () => {
    process.env.LANGSMITH_TRACING_BACKGROUND = "false";
    const llm = traceable(
      async function* llm(input: string) {
        const response = input.repeat(2).split("");
        for (const char of response) {
          yield char;
        }
      },
      { tracingEnabled: true }
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of llm("Hello world")) {
      // pass
    }
    expect(expectedFetchMock).toHaveBeenCalled();
    expect(unexpectedFetchMock).not.toHaveBeenCalled();
  });
});
