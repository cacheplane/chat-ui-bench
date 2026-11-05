// Fixed actual npm registry identity for the five benchmark-consumed packages.
// All six 0.3.6 releases verified against source f34eca5f57fade29d39bcf2bf2511af8e304b04a.
// Selected hashes derive from unchanged canonical034 inputs; no installed/native claim.
const published = {
  "schema": "threadplane-published-stock036-pins-v1",
  "version": "0.3.6",
  "selectedSourceHashes": {
    "package.json": "cd13748fd683ee4f4d80e2244f210c4597164d4813c381855c2cd2242bf70579",
    "apps/threadplane/package.json": "833cef36b2b938f69313eea2e65e9cc809f82b8c2d8a71555638165efdd57e3c",
    "package-lock.json": "7d8fc85f09e34a00c1ff098d4ef3ce0b65eec46ec23ecd52a1033983161879ad"
  },
  "packages": [
    {
      "name": "@threadplane/a2ui",
      "version": "0.3.6",
      "resolved": "https://registry.npmjs.org/@threadplane/a2ui/-/a2ui-0.3.6.tgz",
      "integrity": "sha512-sAjuLdKOkZxBhYbNEN++4IzZUJqpHVoFjd88AxHPk7AO8YNoU848G442fdXOWxbpr/vGgJlT1LAQi3YwHKfWSA=="
    },
    {
      "name": "@threadplane/chat",
      "version": "0.3.6",
      "resolved": "https://registry.npmjs.org/@threadplane/chat/-/chat-0.3.6.tgz",
      "integrity": "sha512-n0yfc4p2fguVXHtU51n6qGrx+wUqLdq/S43cPPH60d3rprHV9HQzqSTb4f76rddiQ9vCtlsgI3L6RN4RSuYjvQ=="
    },
    {
      "name": "@threadplane/langgraph",
      "version": "0.3.6",
      "resolved": "https://registry.npmjs.org/@threadplane/langgraph/-/langgraph-0.3.6.tgz",
      "integrity": "sha512-faszpOg+3+mjpDU9xnYFnJVG7l83biFx8+idMXi2XL5AgpjFzJ2h/hrt/pBX5wOYRQsy4Xey0zGBUJEHaWiLyg=="
    },
    {
      "name": "@threadplane/render",
      "version": "0.3.6",
      "resolved": "https://registry.npmjs.org/@threadplane/render/-/render-0.3.6.tgz",
      "integrity": "sha512-Q6tjlmfG3lHj8pUFvjdz2v2sA0Djl1Mj5fCqa41qh3u0sSQQiSrldydyJvkTElqSrPhS0yAFX3Zbd5GB7IEIkg=="
    },
    {
      "name": "@threadplane/telemetry",
      "version": "0.3.6",
      "resolved": "https://registry.npmjs.org/@threadplane/telemetry/-/telemetry-0.3.6.tgz",
      "integrity": "sha512-ZhdEa9GX0MN10kma1/i3XQuZzrPgMzvCXvOxDIW0P2hRTFSwawuP9p4TBbhZIjTAe+1c40RQe+Co4L7fV6z/gw=="
    }
  ]
};
const deepFreeze = value => {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};
export const STOCK036_PUBLISHED_PINS_V1 = deepFreeze(published);
