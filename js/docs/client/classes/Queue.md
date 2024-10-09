[**langsmith**](../../README.md) • **Docs**

***

[langsmith](../../README.md) / [client](../README.md) / Queue

# Class: Queue\<T\>

## Type Parameters

• **T**

## Constructors

### new Queue()

> **new Queue**\<`T`\>(): [`Queue`](Queue.md)\<`T`\>

#### Returns

[`Queue`](Queue.md)\<`T`\>

## Properties

### items

> **items**: [`T`, () => `void`][] = `[]`

#### Defined in

[src/client.ts:360](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L360)

## Accessors

### size

> `get` **size**(): `number`

#### Returns

`number`

#### Defined in

[src/client.ts:362](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L362)

## Methods

### pop()

> **pop**(`upToN`): [`T`[], () => `void`]

#### Parameters

• **upToN**: `number`

#### Returns

[`T`[], () => `void`]

#### Defined in

[src/client.ts:374](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L374)

***

### push()

> **push**(`item`): `Promise`\<`void`\>

#### Parameters

• **item**: `T`

#### Returns

`Promise`\<`void`\>

#### Defined in

[src/client.ts:366](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/client.ts#L366)
