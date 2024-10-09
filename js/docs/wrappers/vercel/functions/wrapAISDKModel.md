[**langsmith**](../../../README.md) • **Docs**

***

[langsmith](../../../README.md) / [wrappers/vercel](../README.md) / wrapAISDKModel

# Function: wrapAISDKModel()

> **wrapAISDKModel**\<`T`\>(`model`, `options`?): `T`

Wrap a Vercel AI SDK model, enabling automatic LangSmith tracing.
After wrapping a model, you can use it with the Vercel AI SDK Core
methods as normal.

## Type Parameters

• **T** *extends* `object`

## Parameters

• **model**: `T`

An AI SDK model instance.

• **options?**: `Partial`\<[`RunTreeConfig`](../../../run_trees/interfaces/RunTreeConfig.md)\>

LangSmith options.

## Returns

`T`

## Example

```ts
import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { wrapAISDKModel } from "langsmith/wrappers/vercel";

const anthropicModel = anthropic("claude-3-haiku-20240307");

const modelWithTracing = wrapAISDKModel(anthropicModel);

const { textStream } = await streamText({
  model: modelWithTracing,
  prompt: "Write a vegetarian lasagna recipe for 4 people.",
});

for await (const chunk of textStream) {
  console.log(chunk);
}
```

## Defined in

[src/wrappers/vercel.ts:33](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/wrappers/vercel.ts#L33)
