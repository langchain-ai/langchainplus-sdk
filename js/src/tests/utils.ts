import { Client } from "../client.js";
import { v4 as uuidv4 } from "uuid";
// eslint-disable-next-line import/no-extraneous-dependencies
import { faker } from "@faker-js/faker";
import { RunCreate } from "../schemas.js";

export async function toArray<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of iterable) {
    result.push(item);
  }
  return result;
}

export async function waitUntil(
  condition: () => Promise<boolean>,
  timeout: number,
  interval: number,
  prefix?: string
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      if (await condition()) {
        return;
      }
    } catch (e) {
      // Pass
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  const elapsed = Date.now() - start;
  throw new Error(
    [prefix, `Timeout after ${elapsed / 1000}s`].filter(Boolean).join(": ")
  );
}

export async function pollRunsUntilCount(
  client: Client,
  projectName: string,
  count: number,
  timeout?: number,
  filter?: string
): Promise<void> {
  await waitUntil(
    async () => {
      try {
        const runs = await toArray(client.listRuns({ projectName, filter }));
        return runs.length === count;
      } catch (e) {
        return false;
      }
    },
    timeout ?? 120_000, // Wait up to 120 seconds
    5000 // every 5 second
  );
}

export async function deleteProject(
  langchainClient: Client,
  projectName: string
) {
  try {
    await langchainClient.readProject({ projectName });
    await langchainClient.deleteProject({ projectName });
  } catch (e) {
    // Pass
  }
}
export async function deleteDataset(
  langchainClient: Client,
  datasetName: string
) {
  try {
    const existingDataset = await langchainClient.readDataset({ datasetName });
    await langchainClient.deleteDataset({ datasetId: existingDataset.id });
  } catch (e) {
    // Pass
  }
}

export async function waitUntilRunFound(
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
    5_000,
    `Waiting for run "${runId}"`
  );
}

export async function waitUntilProjectFound(
  client: Client,
  projectName: string
) {
  return waitUntil(
    async () => {
      try {
        await client.readProject({ projectName });
        return true;
      } catch (e) {
        return false;
      }
    },
    10_000,
    5_000,
    `Waiting for project "${projectName}"`
  );
}

export function sanitizePresignedUrls(payload: unknown) {
  return JSON.parse(JSON.stringify(payload), (key, value) => {
    if (key === "presigned_url") {
      try {
        const url = new URL(value);
        url.searchParams.set("Signature", "[SIGNATURE]");
        url.searchParams.set("Expires", "[EXPIRES]");
        return url.toString();
      } catch {
        return value;
      }
    }
    return value;
  });
}

/**
 * Factory which returns a list of `RunCreate` objects.
 * @param {number} count Number of runs to create (default: 10)
 * @returns {Array<RunCreate>} List of `RunCreate` objects
 */
export function createRunsFactory(
  projectName: string,
  count = 10
): Array<RunCreate> {
  return Array.from({ length: count }).map((_, idx) => ({
    id: uuidv4(),
    name: `${idx}-${faker.lorem.words()}`,
    run_type: faker.helpers.arrayElement(["tool", "chain", "llm", "retriever"]),
    inputs: {
      question: faker.lorem.sentence(),
    },
    outputs: {
      answer: faker.lorem.sentence(),
    },
    project_name: projectName,
  }));
}
