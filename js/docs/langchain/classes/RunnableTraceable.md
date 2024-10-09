[**langsmith**](../../README.md) • **Docs**

***

[langsmith](../../README.md) / [langchain](../README.md) / RunnableTraceable

# Class: RunnableTraceable\<RunInput, RunOutput\>

RunnableTraceable is a Runnable that wraps a traceable function.
This allows adding Langsmith traced functions into LangChain sequences.

## Extends

- `Runnable`\<`RunInput`, `RunOutput`\>

## Type Parameters

• **RunInput**

• **RunOutput**

## Constructors

### new RunnableTraceable()

> **new RunnableTraceable**\<`RunInput`, `RunOutput`\>(`fields`): [`RunnableTraceable`](RunnableTraceable.md)\<`RunInput`, `RunOutput`\>

#### Parameters

• **fields**

• **fields.func**: `AnyTraceableFunction`

#### Returns

[`RunnableTraceable`](RunnableTraceable.md)\<`RunInput`, `RunOutput`\>

#### Overrides

`Runnable<
  RunInput,
  RunOutput
>.constructor`

#### Defined in

[src/langchain.ts:122](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/langchain.ts#L122)

## Properties

### lc\_kwargs

> **lc\_kwargs**: `SerializedFields`

#### Inherited from

`Runnable.lc_kwargs`

#### Defined in

node\_modules/@langchain/core/dist/load/serializable.d.ts:27

***

### lc\_namespace

> **lc\_namespace**: `string`[]

A path to the module that contains the class, eg. ["langchain", "llms"]
Usually should be the same as the entrypoint the class is exported from.

#### Overrides

`Runnable.lc_namespace`

#### Defined in

[src/langchain.ts:118](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/langchain.ts#L118)

***

### lc\_serializable

> **lc\_serializable**: `boolean` = `false`

#### Overrides

`Runnable.lc_serializable`

#### Defined in

[src/langchain.ts:116](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/langchain.ts#L116)

***

### name?

> `optional` **name**: `string`

#### Inherited from

`Runnable.name`

#### Defined in

node\_modules/@langchain/core/dist/runnables/base.d.ts:27

## Accessors

### lc\_aliases

> `get` **lc\_aliases**(): `undefined` \| `object`

A map of aliases for constructor args.
Keys are the attribute names, e.g. "foo".
Values are the alias that will replace the key in serialization.
This is used to eg. make argument names match Python.

#### Returns

`undefined` \| `object`

#### Inherited from

`Runnable.lc_aliases`

#### Defined in

node\_modules/@langchain/core/dist/load/serializable.d.ts:65

***

### lc\_attributes

> `get` **lc\_attributes**(): `undefined` \| `SerializedFields`

A map of additional attributes to merge with constructor args.
Keys are the attribute names, e.g. "foo".
Values are the attribute values, which will be serialized.
These attributes need to be accepted by the constructor as arguments.

#### Returns

`undefined` \| `SerializedFields`

#### Inherited from

`Runnable.lc_attributes`

#### Defined in

node\_modules/@langchain/core/dist/load/serializable.d.ts:58

***

### lc\_id

> `get` **lc\_id**(): `string`[]

The final serialized identifier for the module.

#### Returns

`string`[]

#### Inherited from

`Runnable.lc_id`

#### Defined in

node\_modules/@langchain/core/dist/load/serializable.d.ts:43

***

### lc\_secrets

> `get` **lc\_secrets**(): `undefined` \| `object`

A map of secrets, which will be omitted from serialization.
Keys are paths to the secret in constructor args, e.g. "foo.bar.baz".
Values are the secret ids, which will be used when deserializing.

#### Returns

`undefined` \| `object`

#### Inherited from

`Runnable.lc_secrets`

#### Defined in

node\_modules/@langchain/core/dist/load/serializable.d.ts:49

## Methods

### \_batchWithConfig()

> **\_batchWithConfig**\<`T`\>(`func`, `inputs`, `options`?, `batchOptions`?): `Promise`\<(`Error` \| `RunOutput`)[]\>

Internal method that handles batching and configuration for a runnable
It takes a function, input values, and optional configuration, and
returns a promise that resolves to the output values.

#### Type Parameters

• **T**

#### Parameters

• **func**

The function to be executed for each input value.

• **inputs**: `T`[]

• **options?**: `Partial`\<`RunnableConfig` & `object`\> \| `Partial`\<`RunnableConfig` & `object`\>[]

• **batchOptions?**: `RunnableBatchOptions`

#### Returns

`Promise`\<(`Error` \| `RunOutput`)[]\>

A promise that resolves to the output values.

#### Inherited from

`Runnable._batchWithConfig`

#### Defined in

node\_modules/@langchain/core/dist/runnables/base.d.ts:110

***

### \_streamIterator()

> **\_streamIterator**(`input`, `options`?): `AsyncGenerator`\<`RunOutput`, `any`, `unknown`\>

Default streaming implementation.
Subclasses should override this method if they support streaming output.

#### Parameters

• **input**: `RunInput`

• **options?**: `Partial`\<`RunnableConfig`\>

#### Returns

`AsyncGenerator`\<`RunOutput`, `any`, `unknown`\>

#### Overrides

`Runnable._streamIterator`

#### Defined in

[src/langchain.ts:144](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/langchain.ts#L144)

***

### assign()

> **assign**(`mapping`): `Runnable`\<`any`, `any`, `RunnableConfig`\>

Assigns new fields to the dict output of this runnable. Returns a new runnable.

#### Parameters

• **mapping**: `RunnableMapLike`\<`Record`\<`string`, `unknown`\>, `Record`\<`string`, `unknown`\>\>

#### Returns

`Runnable`\<`any`, `any`, `RunnableConfig`\>

#### Inherited from

`Runnable.assign`

#### Defined in

node\_modules/@langchain/core/dist/runnables/base.d.ts:138

***

### asTool()

> **asTool**\<`T`\>(`fields`): `RunnableToolLike`\<`ZodType`\<`ToolCall` \| `T`, `ZodTypeDef`, `ToolCall` \| `T`\>, `RunOutput`\>

Convert a runnable to a tool. Return a new instance of `RunnableToolLike`
which contains the runnable, name, description and schema.

#### Type Parameters

• **T** = `RunInput`

#### Parameters

• **fields**

• **fields.description?**: `string`

The description of the tool. Falls back to the description on the Zod schema if not provided, or undefined if neither are provided.

• **fields.name?**: `string`

The name of the tool. If not provided, it will default to the name of the runnable.

• **fields.schema**: `ZodType`\<`T`, `ZodTypeDef`, `T`\>

The Zod schema for the input of the tool. Infers the Zod type from the input type of the runnable.

#### Returns

`RunnableToolLike`\<`ZodType`\<`ToolCall` \| `T`, `ZodTypeDef`, `ToolCall` \| `T`\>, `RunOutput`\>

An instance of `RunnableToolLike` which is a runnable that can be used as a tool.

#### Inherited from

`Runnable.asTool`

#### Defined in

node\_modules/@langchain/core/dist/runnables/base.d.ts:306

***

### batch()

#### batch(inputs, options, batchOptions)

> **batch**(`inputs`, `options`?, `batchOptions`?): `Promise`\<`RunOutput`[]\>

Default implementation of batch, which calls invoke N times.
Subclasses should override this method if they can batch more efficiently.

##### Parameters

• **inputs**: `RunInput`[]

Array of inputs to each batch call.

• **options?**: `Partial`\<`RunnableConfig`\> \| `Partial`\<`RunnableConfig`\>[]

Either a single call options object to apply to each batch call or an array for each call.

• **batchOptions?**: `RunnableBatchOptions` & `object`

##### Returns

`Promise`\<`RunOutput`[]\>

An array of RunOutputs, or mixed RunOutputs and errors if batchOptions.returnExceptions is set

##### Inherited from

`Runnable.batch`

##### Defined in

node\_modules/@langchain/core/dist/runnables/base.d.ts:76

#### batch(inputs, options, batchOptions)

> **batch**(`inputs`, `options`?, `batchOptions`?): `Promise`\<(`Error` \| `RunOutput`)[]\>

##### Parameters

• **inputs**: `RunInput`[]

• **options?**: `Partial`\<`RunnableConfig`\> \| `Partial`\<`RunnableConfig`\>[]

• **batchOptions?**: `RunnableBatchOptions` & `object`

##### Returns

`Promise`\<(`Error` \| `RunOutput`)[]\>

##### Inherited from

`Runnable.batch`

##### Defined in

node\_modules/@langchain/core/dist/runnables/base.d.ts:79

#### batch(inputs, options, batchOptions)

> **batch**(`inputs`, `options`?, `batchOptions`?): `Promise`\<(`Error` \| `RunOutput`)[]\>

##### Parameters

• **inputs**: `RunInput`[]

• **options?**: `Partial`\<`RunnableConfig`\> \| `Partial`\<`RunnableConfig`\>[]

• **batchOptions?**: `RunnableBatchOptions`

##### Returns

`Promise`\<(`Error` \| `RunOutput`)[]\>

##### Inherited from

`Runnable.batch`

##### Defined in

node\_modules/@langchain/core/dist/runnables/base.d.ts:82

***

### bind()

> **bind**(`kwargs`): `Runnable`\<`RunInput`, `RunOutput`, `RunnableConfig`\>

Bind arguments to a Runnable, returning a new Runnable.

#### Parameters

• **kwargs**: `Partial`\<`RunnableConfig`\>

#### Returns

`Runnable`\<`RunInput`, `RunOutput`, `RunnableConfig`\>

A new RunnableBinding that, when invoked, will apply the bound args.

#### Inherited from

`Runnable.bind`

#### Defined in

node\_modules/@langchain/core/dist/runnables/base.d.ts:35

***

### getGraph()

> **getGraph**(`_`?): `Graph`

#### Parameters

• **\_?**: `RunnableConfig`

#### Returns

`Graph`

#### Inherited from

`Runnable.getGraph`

#### Defined in

node\_modules/@langchain/core/dist/runnables/base.d.ts:123

***

### getName()

> **getName**(`suffix`?): `string`

#### Parameters

• **suffix?**: `string`

#### Returns

`string`

#### Inherited from

`Runnable.getName`

#### Defined in

node\_modules/@langchain/core/dist/runnables/base.d.ts:28

***

### invoke()

> **invoke**(`input`, `options`?): `Promise`\<`RunOutput`\>

#### Parameters

• **input**: `RunInput`

• **options?**: `Partial`\<`RunnableConfig`\>

#### Returns

`Promise`\<`RunOutput`\>

#### Overrides

`Runnable.invoke`

#### Defined in

[src/langchain.ts:134](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/langchain.ts#L134)

***

### map()

> **map**(): `Runnable`\<`RunInput`[], `RunOutput`[], `RunnableConfig`\>

Return a new Runnable that maps a list of inputs to a list of outputs,
by calling invoke() with each input.

#### Returns

`Runnable`\<`RunInput`[], `RunOutput`[], `RunnableConfig`\>

#### Inherited from

`Runnable.map`

#### Defined in

node\_modules/@langchain/core/dist/runnables/base.d.ts:40

***

### pick()

> **pick**(`keys`): `Runnable`\<`any`, `any`, `RunnableConfig`\>

Pick keys from the dict output of this runnable. Returns a new runnable.

#### Parameters

• **keys**: `string` \| `string`[]

#### Returns

`Runnable`\<`any`, `any`, `RunnableConfig`\>

#### Inherited from

`Runnable.pick`

#### Defined in

node\_modules/@langchain/core/dist/runnables/base.d.ts:134

***

### pipe()

> **pipe**\<`NewRunOutput`\>(`coerceable`): `Runnable`\<`RunInput`, `Exclude`\<`NewRunOutput`, `Error`\>, `RunnableConfig`\>

Create a new runnable sequence that runs each individual runnable in series,
piping the output of one runnable into another runnable or runnable-like.

#### Type Parameters

• **NewRunOutput**

#### Parameters

• **coerceable**: `RunnableLike`\<`RunOutput`, `NewRunOutput`\>

A runnable, function, or object whose values are functions or runnables.

#### Returns

`Runnable`\<`RunInput`, `Exclude`\<`NewRunOutput`, `Error`\>, `RunnableConfig`\>

A new runnable sequence.

#### Inherited from

`Runnable.pipe`

#### Defined in

node\_modules/@langchain/core/dist/runnables/base.d.ts:130

***

### stream()

> **stream**(`input`, `options`?): `Promise`\<`IterableReadableStream`\<`RunOutput`\>\>

Stream output in chunks.

#### Parameters

• **input**: `RunInput`

• **options?**: `Partial`\<`RunnableConfig`\>

#### Returns

`Promise`\<`IterableReadableStream`\<`RunOutput`\>\>

A readable stream that is also an iterable.

#### Inherited from

`Runnable.stream`

#### Defined in

node\_modules/@langchain/core/dist/runnables/base.d.ts:96

***

### streamEvents()

#### streamEvents(input, options, streamOptions)

> **streamEvents**(`input`, `options`, `streamOptions`?): `IterableReadableStream`\<`StreamEvent`\>

Generate a stream of events emitted by the internal steps of the runnable.

Use to create an iterator over StreamEvents that provide real-time information
about the progress of the runnable, including StreamEvents from intermediate
results.

A StreamEvent is a dictionary with the following schema:

- `event`: string - Event names are of the format: on_[runnable_type]_(start|stream|end).
- `name`: string - The name of the runnable that generated the event.
- `run_id`: string - Randomly generated ID associated with the given execution of
  the runnable that emitted the event. A child runnable that gets invoked as part of the execution of a
  parent runnable is assigned its own unique ID.
- `tags`: string[] - The tags of the runnable that generated the event.
- `metadata`: Record<string, any> - The metadata of the runnable that generated the event.
- `data`: Record<string, any>

Below is a table that illustrates some events that might be emitted by various
chains. Metadata fields have been omitted from the table for brevity.
Chain definitions have been included after the table.

**ATTENTION** This reference table is for the V2 version of the schema.

```md
+----------------------+-----------------------------+------------------------------------------+
| event                | input                       | output/chunk                             |
+======================+=============================+==========================================+
| on_chat_model_start  | {"messages": BaseMessage[]} |                                          |
+----------------------+-----------------------------+------------------------------------------+
| on_chat_model_stream |                             | AIMessageChunk("hello")                  |
+----------------------+-----------------------------+------------------------------------------+
| on_chat_model_end    | {"messages": BaseMessage[]} | AIMessageChunk("hello world")            |
+----------------------+-----------------------------+------------------------------------------+
| on_llm_start         | {'input': 'hello'}          |                                          |
+----------------------+-----------------------------+------------------------------------------+
| on_llm_stream        |                             | 'Hello'                                  |
+----------------------+-----------------------------+------------------------------------------+
| on_llm_end           | 'Hello human!'              |                                          |
+----------------------+-----------------------------+------------------------------------------+
| on_chain_start       |                             |                                          |
+----------------------+-----------------------------+------------------------------------------+
| on_chain_stream      |                             | "hello world!"                           |
+----------------------+-----------------------------+------------------------------------------+
| on_chain_end         | [Document(...)]             | "hello world!, goodbye world!"           |
+----------------------+-----------------------------+------------------------------------------+
| on_tool_start        | {"x": 1, "y": "2"}          |                                          |
+----------------------+-----------------------------+------------------------------------------+
| on_tool_end          |                             | {"x": 1, "y": "2"}                       |
+----------------------+-----------------------------+------------------------------------------+
| on_retriever_start   | {"query": "hello"}          |                                          |
+----------------------+-----------------------------+------------------------------------------+
| on_retriever_end     | {"query": "hello"}          | [Document(...), ..]                      |
+----------------------+-----------------------------+------------------------------------------+
| on_prompt_start      | {"question": "hello"}       |                                          |
+----------------------+-----------------------------+------------------------------------------+
| on_prompt_end        | {"question": "hello"}       | ChatPromptValue(messages: BaseMessage[]) |
+----------------------+-----------------------------+------------------------------------------+
```

The "on_chain_*" events are the default for Runnables that don't fit one of the above categories.

In addition to the standard events above, users can also dispatch custom events.

Custom events will be only be surfaced with in the `v2` version of the API!

A custom event has following format:

```md
+-----------+------+------------------------------------------------------------+
| Attribute | Type | Description                                                |
+===========+======+============================================================+
| name      | str  | A user defined name for the event.                         |
+-----------+------+------------------------------------------------------------+
| data      | Any  | The data associated with the event. This can be anything.  |
+-----------+------+------------------------------------------------------------+
```

Here's an example:

```ts
import { RunnableLambda } from "@langchain/core/runnables";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
// Use this import for web environments that don't support "async_hooks"
// and manually pass config to child runs.
// import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch/web";

const slowThing = RunnableLambda.from(async (someInput: string) => {
  // Placeholder for some slow operation
  await new Promise((resolve) => setTimeout(resolve, 100));
  await dispatchCustomEvent("progress_event", {
   message: "Finished step 1 of 2",
 });
 await new Promise((resolve) => setTimeout(resolve, 100));
 return "Done";
});

const eventStream = await slowThing.streamEvents("hello world", {
  version: "v2",
});

for await (const event of eventStream) {
 if (event.event === "on_custom_event") {
   console.log(event);
 }
}
```

##### Parameters

• **input**: `RunInput`

• **options**: `Partial`\<`RunnableConfig`\> & `object`

• **streamOptions?**: `Omit`\<`EventStreamCallbackHandlerInput`, `"autoClose"`\>

##### Returns

`IterableReadableStream`\<`StreamEvent`\>

##### Inherited from

`Runnable.streamEvents`

##### Defined in

node\_modules/@langchain/core/dist/runnables/base.d.ts:268

#### streamEvents(input, options, streamOptions)

> **streamEvents**(`input`, `options`, `streamOptions`?): `IterableReadableStream`\<`Uint8Array`\>

##### Parameters

• **input**: `RunInput`

• **options**: `Partial`\<`RunnableConfig`\> & `object`

• **streamOptions?**: `Omit`\<`EventStreamCallbackHandlerInput`, `"autoClose"`\>

##### Returns

`IterableReadableStream`\<`Uint8Array`\>

##### Inherited from

`Runnable.streamEvents`

##### Defined in

node\_modules/@langchain/core/dist/runnables/base.d.ts:271

***

### streamLog()

> **streamLog**(`input`, `options`?, `streamOptions`?): `AsyncGenerator`\<`RunLogPatch`, `any`, `unknown`\>

Stream all output from a runnable, as reported to the callback system.
This includes all inner runs of LLMs, Retrievers, Tools, etc.
Output is streamed as Log objects, which include a list of
jsonpatch ops that describe how the state of the run has changed in each
step, and the final state of the run.
The jsonpatch ops can be applied in order to construct state.

#### Parameters

• **input**: `RunInput`

• **options?**: `Partial`\<`RunnableConfig`\>

• **streamOptions?**: `Omit`\<`LogStreamCallbackHandlerInput`, `"autoClose"`\>

#### Returns

`AsyncGenerator`\<`RunLogPatch`, `any`, `unknown`\>

#### Inherited from

`Runnable.streamLog`

#### Defined in

node\_modules/@langchain/core/dist/runnables/base.d.ts:158

***

### toJSON()

> **toJSON**(): `Serialized`

#### Returns

`Serialized`

#### Inherited from

`Runnable.toJSON`

#### Defined in

node\_modules/@langchain/core/dist/load/serializable.d.ts:69

***

### toJSONNotImplemented()

> **toJSONNotImplemented**(): `SerializedNotImplemented`

#### Returns

`SerializedNotImplemented`

#### Inherited from

`Runnable.toJSONNotImplemented`

#### Defined in

node\_modules/@langchain/core/dist/load/serializable.d.ts:70

***

### transform()

> **transform**(`generator`, `options`): `AsyncGenerator`\<`RunOutput`, `any`, `unknown`\>

Default implementation of transform, which buffers input and then calls stream.
Subclasses should override this method if they can start producing output while
input is still being generated.

#### Parameters

• **generator**: `AsyncGenerator`\<`RunInput`, `any`, `unknown`\>

• **options**: `Partial`\<`RunnableConfig`\>

#### Returns

`AsyncGenerator`\<`RunOutput`, `any`, `unknown`\>

#### Inherited from

`Runnable.transform`

#### Defined in

node\_modules/@langchain/core/dist/runnables/base.d.ts:146

***

### withConfig()

> **withConfig**(`config`): `RunnableBinding`\<`RunInput`, `RunOutput`, `RunnableConfig`\>

Bind config to a Runnable, returning a new Runnable.

#### Parameters

• **config**: `RunnableConfig`

New configuration parameters to attach to the new runnable.

#### Returns

`RunnableBinding`\<`RunInput`, `RunOutput`, `RunnableConfig`\>

A new RunnableBinding with a config matching what's passed.

#### Inherited from

`Runnable.withConfig`

#### Defined in

node\_modules/@langchain/core/dist/runnables/base.d.ts:55

***

### withFallbacks()

> **withFallbacks**(`fields`): `RunnableWithFallbacks`\<`RunInput`, `RunOutput`\>

Create a new runnable from the current one that will try invoking
other passed fallback runnables if the initial invocation fails.

#### Parameters

• **fields**: `object` \| `Runnable`\<`RunInput`, `RunOutput`, `RunnableConfig`\>[]

#### Returns

`RunnableWithFallbacks`\<`RunInput`, `RunOutput`\>

A new RunnableWithFallbacks.

#### Inherited from

`Runnable.withFallbacks`

#### Defined in

node\_modules/@langchain/core/dist/runnables/base.d.ts:62

***

### withListeners()

> **withListeners**(`params`): `Runnable`\<`RunInput`, `RunOutput`, `RunnableConfig`\>

Bind lifecycle listeners to a Runnable, returning a new Runnable.
The Run object contains information about the run, including its id,
type, input, output, error, startTime, endTime, and any tags or metadata
added to the run.

#### Parameters

• **params**

The object containing the callback functions.

• **params.onEnd?**

Called after the runnable finishes running, with the Run object.

• **params.onError?**

Called if the runnable throws an error, with the Run object.

• **params.onStart?**

Called before the runnable starts running, with the Run object.

#### Returns

`Runnable`\<`RunInput`, `RunOutput`, `RunnableConfig`\>

#### Inherited from

`Runnable.withListeners`

#### Defined in

node\_modules/@langchain/core/dist/runnables/base.d.ts:289

***

### withRetry()

> **withRetry**(`fields`?): `RunnableRetry`\<`RunInput`, `RunOutput`, `RunnableConfig`\>

Add retry logic to an existing runnable.

#### Parameters

• **fields?**

• **fields.onFailedAttempt?**: `RunnableRetryFailedAttemptHandler`

• **fields.stopAfterAttempt?**: `number`

#### Returns

`RunnableRetry`\<`RunInput`, `RunOutput`, `RunnableConfig`\>

A new RunnableRetry that, when invoked, will retry according to the parameters.

#### Inherited from

`Runnable.withRetry`

#### Defined in

node\_modules/@langchain/core/dist/runnables/base.d.ts:46

***

### from()

> `static` **from**(`func`): [`RunnableTraceable`](RunnableTraceable.md)\<`unknown`, `unknown`\>

#### Parameters

• **func**: `AnyTraceableFunction`

#### Returns

[`RunnableTraceable`](RunnableTraceable.md)\<`unknown`, `unknown`\>

#### Defined in

[src/langchain.ts:169](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/langchain.ts#L169)

***

### isRunnable()

> `static` **isRunnable**(`thing`): `thing is Runnable<any, any, RunnableConfig>`

#### Parameters

• **thing**: `any`

#### Returns

`thing is Runnable<any, any, RunnableConfig>`

#### Inherited from

`Runnable.isRunnable`

#### Defined in

node\_modules/@langchain/core/dist/runnables/base.d.ts:277

***

### lc\_name()

> `static` **lc\_name**(): `string`

The name of the serializable. Override to provide an alias or
to preserve the serialized module name in minified environments.

Implemented as a static method to support loading logic.

#### Returns

`string`

#### Inherited from

`Runnable.lc_name`

#### Defined in

node\_modules/@langchain/core/dist/load/serializable.d.ts:39
