import{extractKernelSource}from'./source-inputs.mjs';
const source=extractKernelSource();
const kernel=Function(source.replace('export{calculateRangeImpl,defaultRangeExtractor};','return{calculateRangeImpl,defaultRangeExtractor};'))();
export const calculateRangeImpl=kernel.calculateRangeImpl,defaultRangeExtractor=kernel.defaultRangeExtractor;
