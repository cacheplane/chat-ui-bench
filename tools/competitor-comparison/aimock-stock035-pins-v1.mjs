// Fixed reviewed npm registry identity for the five benchmark-consumed packages.
// All six 0.3.5 releases were verified against source 1c22d08bca079f01519e3177fd6cc588ffc90411.
// Selected source hashes come from the unchanged canonical034 pure derivation.
// Selection alone is not installed-package, production-build or native evidence.
const published = {
  "schema": "threadplane-published-stock035-pins-v1",
  "version": "0.3.5",
  "selectedSourceHashes": {
    "package.json": "cd13748fd683ee4f4d80e2244f210c4597164d4813c381855c2cd2242bf70579",
    "apps/threadplane/package.json": "cf85196041b4980dc7741e9f334a69a7e377a4de617823058487edf36d486adf",
    "package-lock.json": "ea4ce43b1a1c5841cbed79ebe501016bf604836a1a6ca3f1ad1116b09e740087"
  },
  "packages": [
    {
      "name": "@threadplane/a2ui",
      "version": "0.3.5",
      "resolved": "https://registry.npmjs.org/@threadplane/a2ui/-/a2ui-0.3.5.tgz",
      "integrity": "sha512-3YWL0cJKGGAcRNolRfMofVV48GkwHmrdCOfyrpK1hxQ9wqKUziyouxa/be8MvSwU06dvst8j2os1H3B7nSDfxQ=="
    },
    {
      "name": "@threadplane/chat",
      "version": "0.3.5",
      "resolved": "https://registry.npmjs.org/@threadplane/chat/-/chat-0.3.5.tgz",
      "integrity": "sha512-R2bk+POjxe+hfzuSXBwbsKbD+Lmlvv+DyLoahkpQrgMOQ9Xytk7QoC9xUkA4wWoUBBJiQpTsSZRJKR/7Zxw1bw=="
    },
    {
      "name": "@threadplane/langgraph",
      "version": "0.3.5",
      "resolved": "https://registry.npmjs.org/@threadplane/langgraph/-/langgraph-0.3.5.tgz",
      "integrity": "sha512-VbMjilQLXFAd3risBAJ4DWhOoHwncwlkq7OkWcmOv3pVXv0qqn0gcsDBwTGSz7v01SoY1JZ4eAOoiqNmMbEaaQ=="
    },
    {
      "name": "@threadplane/render",
      "version": "0.3.5",
      "resolved": "https://registry.npmjs.org/@threadplane/render/-/render-0.3.5.tgz",
      "integrity": "sha512-ptEizKF1/10F6Ub4jjFM/p2bYZc5Zm4hY20KnmeRlgoFoAyHT7IN3VoocetBJ1wVFyHln9W1PlNGAMByRSCRDA=="
    },
    {
      "name": "@threadplane/telemetry",
      "version": "0.3.5",
      "resolved": "https://registry.npmjs.org/@threadplane/telemetry/-/telemetry-0.3.5.tgz",
      "integrity": "sha512-scq5oO4m7YJevOK6h2ESADjJVAK+TiQ4xfqscfTNATJorVVLCN4CZJRHmepFKJq2B+NxfNeqbtFvUg6mqz2png=="
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
export const STOCK035_PUBLISHED_PINS_V1 = deepFreeze(published);
