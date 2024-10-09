[**langsmith**](../../../README.md) • **Docs**

***

[langsmith](../../../README.md) / [wrappers/openai](../README.md) / wrapOpenAI

# Function: wrapOpenAI()

> **wrapOpenAI**\<`T`\>(`openai`, `options`?): `PatchedOpenAIClient`\<`T`\>

Wraps an OpenAI client's completion methods, enabling automatic LangSmith
tracing. Method signatures are unchanged, with the exception that you can pass
an additional and optional "langsmithExtra" field within the second parameter.

## Type Parameters

• **T** *extends* `OpenAIType`

## Parameters

• **openai**: `T`

An OpenAI client instance.

• **options?**: `Partial`\<[`RunTreeConfig`](../../../run_trees/interfaces/RunTreeConfig.md)\>

LangSmith options.

## Returns

`PatchedOpenAIClient`\<`T`\>

## Example

```ts
const patchedStream = await patchedClient.chat.completions.create(
  {
    messages: [{ role: "user", content: `Say 'foo'` }],
    model: "gpt-3.5-turbo",
    stream: true,
  },
  {
    langsmithExtra: {
      metadata: {
        additional_data: "bar",
      },
    },
  },
);
```

## Defined in

[src/wrappers/openai.ts:206](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/wrappers/openai.ts#L206)
