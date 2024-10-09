[**langsmith**](../../README.md) • **Docs**

***

[langsmith](../../README.md) / [traceable](../README.md) / TraceableFunction

# Type Alias: TraceableFunction\<Func\>

> **TraceableFunction**\<`Func`\>: `Func` *extends* (...`args`) => `R1`(...`args`) => `R2`(...`args`) => `R3`(...`args`) => `R4`(...`args`) => `R5` ? `UnionToIntersection`\<`WrapArgReturnPair`\<[`A1`, `R1`] \| [`A2`, `R2`] \| [`A3`, `R3`] \| [`A4`, `R4`] \| [`A5`, `R5`]\>\> : `Func` *extends* (...`args`) => `R1`(...`args`) => `R2`(...`args`) => `R3`(...`args`) => `R4` ? `UnionToIntersection`\<`WrapArgReturnPair`\<[`A1`, `R1`] \| [`A2`, `R2`] \| [`A3`, `R3`] \| [`A4`, `R4`]\>\> : `Func` *extends* (...`args`) => `R1`(...`args`) => `R2`(...`args`) => `R3` ? `UnionToIntersection`\<`WrapArgReturnPair`\<[`A1`, `R1`] \| [`A2`, `R2`] \| [`A3`, `R3`]\>\> : `Func` *extends* (...`args`) => `R1`(...`args`) => `R2` ? `UnionToIntersection`\<`WrapArgReturnPair`\<[`A1`, `R1`] \| [`A2`, `R2`]\>\> : `Func` *extends* (...`args`) => `R1` ? `UnionToIntersection`\<`WrapArgReturnPair`\<[`A1`, `R1`]\>\> : `never` & `{ [K in keyof Func]: Func[K] }`

## Type Parameters

• **Func** *extends* (...`args`) => `any`

## Defined in

[src/singletons/types.ts:35](https://github.com/langchain-ai/langsmith-sdk/blob/da3c1bb4f1396b48909bf0abac53fd717458c764/js/src/singletons/types.ts#L35)
