// Fixed reviewed d7d profile source and published lock identities.
// Source pins cover each OWN isolated manifest/lock, never the global root lock.
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
const profiles=freeze([
  {
    "schema": "competitor-stock-source-pins-v1",
    "profile": "copilotkit",
    "sources": {
      "competitors/copilotkit/README.md": "b31a3fac671477bf234ad5fc2ccef42d3c415d317fd20438426a41550badf1eb",
      "competitors/copilotkit/build-isolation.d.mts": "31ddd1834af86b7f8357cfc651bcd70480868eac2eb24f275b000253ec38dc4e",
      "competitors/copilotkit/build-isolation.mjs": "bc8f6d39c082627b3ea0b4d0cf79161370c82ea6d28773bddca3882fced50048",
      "competitors/copilotkit/index.html": "9f8df4901dab6b36d16cdfcbf18a9fac534f9b65010f9b48e15bc707e62f939e",
      "competitors/copilotkit/package-lock.json": "fe7f474a22f9eb2d3d6c6879919d13f13d0a51993860cc4946cd119299c79ee0",
      "competitors/copilotkit/package.json": "9ebaf53f52e4ff001b883c072cd7534de1bec17a0103a2c0b355a21b2d112356",
      "competitors/copilotkit/server.mjs": "b011111e7d41ac822ac6277850866f57e152d4b589b28f2c8a70bd555cd4447b",
      "competitors/copilotkit/src/lifecycle.ts": "cba34ac01728f0f38fc5fd89127c9651e69131d469586c34f124a1ab935703dd",
      "competitors/copilotkit/src/main.tsx": "a891a958ffab85badbd731a250435ea33babdbfeaf58ba5c68cbc4e0fd5b3e32",
      "competitors/copilotkit/src/messages.ts": "f8a7c41dde699d3844f0928319f90eb5e03a27f2e971035903c711355381b02f",
      "competitors/copilotkit/src/server.ts": "b2118046b2cf97550b6f4de7f6af03436a8c98ad0b4d99dea221683d3feb634b",
      "competitors/copilotkit/src/styles.css": "feaf9a7756f287c45d21d9db6adc6183c37d74592eec37aa3f78227ea11a01a1",
      "competitors/copilotkit/tests/isolation.node.mjs": "9a1f0da382346dfb6928dce7100149cc212db4f7b6dac376d2dc685fbe1d5000",
      "competitors/copilotkit/tests/lifecycle.node.mjs": "5090639c29cf817aa3b6e41c98c0fcf475856e02f863173f9a1b253b0a8330f7",
      "competitors/copilotkit/tests/messages.node.mjs": "f1fac0beb9970ad81e67950875c73cad8024fb627cfb2f4b0a408dbde6326808",
      "competitors/copilotkit/tests/server.node.mjs": "4f2ed6e3e33028b218117e9be35222cbe2d074e572ae7156bdb7e624fdfceb0e",
      "competitors/copilotkit/tsconfig.json": "6cfb2286d10b7bfc5a7df12f61777a73c309c1a849f7ba76ea7deb60e41b5888",
      "competitors/copilotkit/vite.config.ts": "72c9e460602bdf5ca92d6ef7551b1bad1719a2b4a923fff9c3820b31e00c4d9d",
      "competitors/shared/context.mjs": "d803b39bbc54d79e0a25aed7a702b2f84e8ebaf12beb258900be77bb5e1a7f57",
      "competitors/shared/protocol.ts": "d76886a0c4f617669fbcf57de98ff9eb6cf99e6e33de1145707a8958f73c31e2"
    },
    "packages": [
      {
        "name": "@ag-ui/client",
        "version": "1.0.2",
        "resolved": "https://registry.npmjs.org/@ag-ui/client/-/client-1.0.2.tgz",
        "integrity": "sha512-BPxcQBPxJZi7XiQI8eBpiE6KBcySjD6hV7XWQhezYbLeK9WJkcUZ6RhX5dngWw+VgfapxPdJdEDTV/JxF21Duw==",
        "resolutionPath": "node_modules/@ag-ui/client",
        "entries": [
          "@ag-ui/client"
        ]
      },
      {
        "name": "@ag-ui/core",
        "version": "1.0.2",
        "resolved": "https://registry.npmjs.org/@ag-ui/core/-/core-1.0.2.tgz",
        "integrity": "sha512-lb0YfvHY4eTHcXthTWzXjsElLqycGWDhaXGTejwMkUV5TtJVZircRS12/tMpqzd32sL+WZ2PWQ4m0+ThKrGF8A==",
        "resolutionPath": "node_modules/@ag-ui/core",
        "entries": [
          "@ag-ui/core"
        ]
      },
      {
        "name": "@copilotkit/core",
        "version": "1.83.0",
        "resolved": "https://registry.npmjs.org/@copilotkit/core/-/core-1.83.0.tgz",
        "integrity": "sha512-2isj3o6XgqFq1gNIU70GqFC+PTOf8ZJuuIXO1nsyFlBYyEc91BENmshtiCuOev60xSm4uuukprDhJN3NK2XVNw==",
        "resolutionPath": "node_modules/@copilotkit/core",
        "entries": [
          "@copilotkit/core"
        ]
      },
      {
        "name": "@copilotkit/react-core",
        "version": "1.83.0",
        "resolved": "https://registry.npmjs.org/@copilotkit/react-core/-/react-core-1.83.0.tgz",
        "integrity": "sha512-nhP/tUi0/SANXJ93M1Y2LD6XZsGLojS5lVV80SfQBGT8n4XvEMRC/sbhJrEeofZit/lPn92WH6h+fq3UZ8kW2A==",
        "resolutionPath": "node_modules/@copilotkit/react-core",
        "entries": [
          "@copilotkit/react-core/v2",
          "@copilotkit/react-core/v2/styles.css"
        ]
      },
      {
        "name": "@copilotkit/runtime",
        "version": "1.83.0",
        "resolved": "https://registry.npmjs.org/@copilotkit/runtime/-/runtime-1.83.0.tgz",
        "integrity": "sha512-5BAR2AXLBoz2jtByCPMUm1TO6MNJXhOEAa7OfUwy7lsXSMZmYqAUZO/hqLFAOByX32e1yZbH8WYQwquHh7Yx+g==",
        "resolutionPath": "node_modules/@copilotkit/runtime",
        "entries": [
          "@copilotkit/runtime/v2",
          "@copilotkit/runtime/v2/hono"
        ]
      },
      {
        "name": "@types/node",
        "version": "24.10.1",
        "resolved": "https://registry.npmjs.org/@types/node/-/node-24.10.1.tgz",
        "integrity": "sha512-GNWcUTRBgIRJD5zj+Tq0fKOJ5XZajIiBroOF0yvj2bSU1WvNdYS/dn9UxwsujGW4JX06dnHyjV2y9rRaybH0iQ==",
        "resolutionPath": "node_modules/@types/node",
        "entries": []
      },
      {
        "name": "@types/react",
        "version": "19.3.0",
        "resolved": "https://registry.npmjs.org/@types/react/-/react-19.3.0.tgz",
        "integrity": "sha512-N0rFCuH9YoxG9/m61l9MfpJKfmLOVU0em7ipIz6TRgSSkvReLB9vL85GB+yr8Bs5leqpvg96JSwF4ZS1s4viQg==",
        "resolutionPath": "node_modules/@types/react",
        "entries": []
      },
      {
        "name": "@types/react-dom",
        "version": "19.3.0",
        "resolved": "https://registry.npmjs.org/@types/react-dom/-/react-dom-19.3.0.tgz",
        "integrity": "sha512-ZI7bU42mZXXKHn/qNLEw2IrbiINU7X5+vfgdixBHkCNpYWXjKgfQ/P+uyGb5CjOLB9UcnTeg3rylQtV2hym44Q==",
        "resolutionPath": "node_modules/@types/react-dom",
        "entries": []
      },
      {
        "name": "react",
        "version": "19.3.1",
        "resolved": "https://registry.npmjs.org/react/-/react-19.3.1.tgz",
        "integrity": "sha512-QNhWdt7nrgVWWQG58QuGsAR3jv3Hbe4mb4vz7w2csnHavciZJgda1CPNaldF6eVxv90ud3jUXpKlHL69gO38yw==",
        "resolutionPath": "node_modules/react",
        "entries": [
          "react"
        ]
      },
      {
        "name": "react-dom",
        "version": "19.3.1",
        "resolved": "https://registry.npmjs.org/react-dom/-/react-dom-19.3.1.tgz",
        "integrity": "sha512-Y0bARz53lhEC1NMCASs0/j+faB/zqt3R8hpvg1e8+61ZVJ4UL0UdC4cBbXfZMcIuhrfgeILTLe+ZeBCavQPtKQ==",
        "resolutionPath": "node_modules/react-dom",
        "entries": [
          "react-dom/client"
        ]
      },
      {
        "name": "rxjs",
        "version": "7.8.1",
        "resolved": "https://registry.npmjs.org/rxjs/-/rxjs-7.8.1.tgz",
        "integrity": "sha512-AA3TVj+0A2iuIoQkWEK/tqFjBq2j+6PO6Y0zJcvzLAFhEFIO3HL0vls9hWLncZbAAbK0mar7oZ4V079I/qPMxg==",
        "resolutionPath": "node_modules/rxjs",
        "entries": [
          "rxjs"
        ]
      },
      {
        "name": "typescript",
        "version": "7.0.2",
        "resolved": "https://registry.npmjs.org/typescript/-/typescript-7.0.2.tgz",
        "integrity": "sha512-8FYau96o3NKOhbjKi/qNvG/W5jhzxkbdm5sj9AbZ/5T5sWqn3hJgLfGx27sRKZWTvyzCP8dLRBTf5tBTSRVUNA==",
        "resolutionPath": "node_modules/typescript",
        "entries": [
          "typescript"
        ]
      },
      {
        "name": "vite",
        "version": "8.3.4",
        "resolved": "https://registry.npmjs.org/vite/-/vite-8.3.4.tgz",
        "integrity": "sha512-IftLE8phJhdNRIGNEV4JCCvfNScoZQVfcXaN8TQropWGJtOHcu+iAB9pHcuGvmEb/kddw0LBe/jS8ztdC6xdiQ==",
        "resolutionPath": "node_modules/vite",
        "entries": [
          "vite"
        ],
        "witnessFiles": [
          {"path":"dist/node/chunks/node.js","sha256":"dab5039168ce4526f98058d84e31bf79eeed8eba558a9a27db570df893326364"}
        ]
      },
      {
        "name": "zod",
        "version": "4.6.6",
        "resolved": "https://registry.npmjs.org/zod/-/zod-4.6.6.tgz",
        "integrity": "sha512-4UmzQUF5fxvfcYHlbjBmejU+w+hbDnWFx4aS8kBx7nPBHcO2SqPbpAG8snbdg+Xse4pRefR98hgjFgIMCI/UhA==",
        "resolutionPath": "node_modules/zod",
        "entries": []
      }
    ],
    "buildCommand": [
      "npm",
      "run",
      "build",
      "--workspaces=false"
    ],
    "sourceMaps": false,
    "explicitTarget": null,
    "renderer": "shipped default CopilotKit v2 Chat with native virtualization/bottom follow"
  },
  {
    "schema": "competitor-stock-source-pins-v1",
    "profile": "assistant-ui",
    "sources": {
      "competitors/assistant-ui/.gitignore": "790e3169bc19b046fe55ba1da6d13b976c28363c8c00462a2195fe5faf260910",
      "competitors/assistant-ui/LICENSE.assistant-ui": "eafb05991a572efa34097474b31fef45b14a8879ed1d1a8fd77de62e6fa7d275",
      "competitors/assistant-ui/README.md": "a2a34771fd1ead5ac476ff46fb004cf51f0d4f8b76490abaa0c9bbc091cb5cea",
      "competitors/assistant-ui/index.html": "79cf3b661ab2830ca642269347a53e16268427a71312ce5b09281e1a964efebc",
      "competitors/assistant-ui/package-lock.json": "784efd9d6c0710b5fff4a3fa241898173edb92aa78b755d9492cad997e7807f8",
      "competitors/assistant-ui/package.json": "b972c4704085fb1dc8c41728e0d1cb642c5280409ba754a049b87bce0c5f2bc6",
      "competitors/assistant-ui/scripts/verify-isolation.mjs": "54cb22b9990cd8df2bce0f49784df3b29dbfcd0252f3a47b7c760370365a7593",
      "competitors/assistant-ui/source-manifest.json": "ad207f5b4f318c30f9cc62b2eba591f886d75d11415f70781841f82e2add89b3",
      "competitors/assistant-ui/src/adapter.ts": "3f14c9d166a1b48b4611069b4c786451892b270351033bc2f290d33b749c42b9",
      "competitors/assistant-ui/src/bridge.ts": "fc118d577ac86944f453b2cfa2ab8c43f151c579a9ad5d6c85f6df0c691153a8",
      "competitors/assistant-ui/src/components/assistant-ui/elements/attachment-state.ts": "8718cfac67e6afff2cc21981ebd934ea40c02abcf96c6d74be441a11dc37709d",
      "competitors/assistant-ui/src/components/assistant-ui/elements/attachment.aui.tsx": "42865c61b99ff9f4fa13294c3baa090f6afd54dc7c0bbbb4283b993119271446",
      "competitors/assistant-ui/src/components/assistant-ui/elements/collapsible-root.tsx": "6d3e6d9a776ac9db13448606627c2ef51e5605cacb2f805379ada9b58abe4565",
      "competitors/assistant-ui/src/components/assistant-ui/elements/file.tsx": "af6c5c38b0409f168e1bcebacffa9efaf7ff17ecc3cc0b5fab8d4770df0454a0",
      "competitors/assistant-ui/src/components/assistant-ui/elements/follow-up-suggestions.aui.tsx": "f0db1e9cfc5f648adeb57c8ac61fbeca4ebbb4d55267a9c107709af01b73abb4",
      "competitors/assistant-ui/src/components/assistant-ui/elements/image.tsx": "916b2ca0f1097a2eb22e6e5c3ffd39a918dec71abff424b6b8795939733d53fb",
      "competitors/assistant-ui/src/components/assistant-ui/elements/markdown-text.tsx": "7d20bd8fe709a1a6aeee24ba82531309e374740ba6181e092592275ffd6ff8ac",
      "competitors/assistant-ui/src/components/assistant-ui/elements/media-player.tsx": "64a43a3554e9a3de056bcc756dd022a342a45450fa1b41a87836896d0c86dd55",
      "competitors/assistant-ui/src/components/assistant-ui/elements/reasoning.aui.tsx": "3ae8bcf0d84fcb9ac37a40c2046abbf46d7b8f3967b482eec84f0a743aefce65",
      "competitors/assistant-ui/src/components/assistant-ui/elements/reasoning.tsx": "02c42a1cad5fd56f4479fe65c779e9f9934c03a6e935ac92ebf98cbb46ef3cc7",
      "competitors/assistant-ui/src/components/assistant-ui/elements/surfaces.tsx": "5d81fbb669e67ae20026cd30ed57efc51a5e3ee0f4f5d265e1723de75359b8fa",
      "competitors/assistant-ui/src/components/assistant-ui/elements/thread.aui.tsx": "a3bffd8e670e51a48eedb6cf0a5ea884ffc1d212cc28e2a8bf31f7a7961399da",
      "competitors/assistant-ui/src/components/assistant-ui/elements/tool-fallback.aui.tsx": "31720ad79fe332a5999cc1873108da740e63c05f4b8f322bde75f8d495cbf853",
      "competitors/assistant-ui/src/components/assistant-ui/elements/tool-group.aui.tsx": "757caf28ee232d4f500c8af7d6837fe7d6d2b144774a6a0bcdaff8c0c517bd9e",
      "competitors/assistant-ui/src/components/assistant-ui/elements/tooltip-icon-button.tsx": "98580531a6f5a213cccd6964c0c75fd097d97b77bcca05f904df562512273363",
      "competitors/assistant-ui/src/components/assistant-ui/utils/href.ts": "3a8038d038b1918ae3f58a61dcd30933633131dda341eb5bea5b6a650b31a912",
      "competitors/assistant-ui/src/components/assistant-ui/utils/useIsomorphicLayoutEffect.ts": "8db117d730e640655e5099e086af4e00d545c283839d9ef5885ca93419d51893",
      "competitors/assistant-ui/src/components/ui/avatar.tsx": "56acc1c16834672164b7d1d920ef939bc4d5330640059bf0ec0f81cbdc7c168e",
      "competitors/assistant-ui/src/components/ui/button.tsx": "de5e06ef482e702cc56abe8fbe0b1dfcfee9c30db4eafad24a38b5360188c42f",
      "competitors/assistant-ui/src/components/ui/dialog.tsx": "662c25e6d4873ba41c12db62a378a1cb873d6c3846e855fc85039793823cd903",
      "competitors/assistant-ui/src/components/ui/skeleton.tsx": "a61009cda0a56be88eb94bfecad0fdeb7a895611e87049ee1f2617fc25cd6620",
      "competitors/assistant-ui/src/components/ui/textarea.tsx": "abab274474743d7b6d30e67848e4341c2fbd491a8a300010e5da1176c7f9624f",
      "competitors/assistant-ui/src/components/ui/tooltip.tsx": "43cf8405ec5856165c2e7543d9e07c7bdf186c0b9f39270141a42de3dc11d0cc",
      "competitors/assistant-ui/src/context.ts": "94078579abe49e46bed67ec30c8d63d50c08a5f1f0115afaf68427395a57537c",
      "competitors/assistant-ui/src/hooks/use-attachment-src.ts": "dfb621f1a18f4013994aa29815beddb436020105164526ab7c86b0b0a32040a1",
      "competitors/assistant-ui/src/hooks/use-copy-to-clipboard.ts": "1f3b8a1bab79cef961f62eb25d6b58a0d16c957d63ba1faf086ad09c99712c0a",
      "competitors/assistant-ui/src/lib/utils.ts": "55bbdc94cef3e0c8a8bba386e94f97228dd2c967fe61466fc565378890550c08",
      "competitors/assistant-ui/src/lifecycle.ts": "fe19c7b6eec6c16cc446e7b0ce9967c56da53355d9cf08eb9c98d0e95dafe100",
      "competitors/assistant-ui/src/main.tsx": "dae0f06392c6080c8fce9f76b7776bd901765adb6e85d3ea3aad99f0859f1b14",
      "competitors/assistant-ui/src/matrix.ts": "95c396f016367143e5dcefb661cd543be38d4c1c66e0b4d6af6e7eff2327ce98",
      "competitors/assistant-ui/src/official-globals.css": "42070e0b45bb201b2b838a52aaaa6e965f964e0b542d97f1fe517fe59c4b75a8",
      "competitors/assistant-ui/src/official-theme.css": "34214c9521d2177014f34e84469096de13848a77b8dd0c3470734270c697040b",
      "competitors/assistant-ui/src/shell.css": "9ae12d9d88b2a12d2d18d677cf09d2d44281ca7691a611335a5b129d958ddf70",
      "competitors/assistant-ui/src/stream.ts": "6bfb4e2585d1da4d9cc3037cb39f8f5e6d262cbafc581fa3928daa12e7959bf3",
      "competitors/assistant-ui/test/adapter.test.ts": "edd3a7d4f09871fe962b52386431cd2ff1029124bbd329fff5bd47809457aaa2",
      "competitors/assistant-ui/test/bridge.test.ts": "0419bb3c528e3aca286323fa2269c5c22326858b6b8c52730913e6038d04c31c",
      "competitors/assistant-ui/test/context.test.ts": "7b42134ce373c7649527f8904db380a28324c1525dd71dc0a4bdda8f4f39d50b",
      "competitors/assistant-ui/test/isolation.test.ts": "3672eb26ad16b3837966c8d3967a6ffe43c137e469946d1ebfec8ad41d368a95",
      "competitors/assistant-ui/test/lifecycle.test.ts": "d970320e649c896d81a554df04cb2c0dc0db0942642e4daf5744692610482e7d",
      "competitors/assistant-ui/test/matrix.test.ts": "28587170a9d0385fa5225b80b6162a48e77152cf33fd13b5fdbf29f29cc82737",
      "competitors/assistant-ui/test/sdk.test.ts": "4a412b21609b4d353cf9025e9e912afd38606298b099e249a4071a170924abc1",
      "competitors/assistant-ui/test/source.test.ts": "97f286a194505f54cbcc855f49588745d2ca72eb5c11b02a8ec60b54dd361105",
      "competitors/assistant-ui/test/stream.test.ts": "418262c99587c00da6e51511e67075bbaaeae535235f705fd936175d08ff5db1",
      "competitors/assistant-ui/tsconfig.json": "388eb7e9c706424c2be50ae78e60a3867cef65e4a02c213d5998da0d83854c94",
      "competitors/assistant-ui/vite.config.ts": "556b438cb79b3e7fcbb6d5289033442752cb29e2ab6c1be43062089d6f9e6bd5",
      "competitors/shared/context.mjs": "d803b39bbc54d79e0a25aed7a702b2f84e8ebaf12beb258900be77bb5e1a7f57",
      "competitors/shared/protocol.ts": "d76886a0c4f617669fbcf57de98ff9eb6cf99e6e33de1145707a8958f73c31e2"
    },
    "packages": [
      {
        "name": "@assistant-ui/react",
        "version": "0.15.32",
        "resolved": "https://registry.npmjs.org/@assistant-ui/react/-/react-0.15.32.tgz",
        "integrity": "sha512-cw+8UQRnJocyHEaNc3+S+ulZaFp4UoVnbjyRmVFZcq8XSHpe4onz7ZkXkBl7L8IZftgvNdHS9ZEujnqohwzibw==",
        "resolutionPath": "node_modules/@assistant-ui/react",
        "entries": [
          "@assistant-ui/react"
        ]
      },
      {
        "name": "@assistant-ui/react-markdown",
        "version": "0.14.24",
        "resolved": "https://registry.npmjs.org/@assistant-ui/react-markdown/-/react-markdown-0.14.24.tgz",
        "integrity": "sha512-iAWOvnqCEOEH3LlWI/NJzMYRGtfTkBtjrxXHq/i/YjkXsC8l35DHOOJ8QrgMFGNDuG6/N7OkbwU5nlLlaRHERA==",
        "resolutionPath": "node_modules/@assistant-ui/react-markdown",
        "entries": [
          "@assistant-ui/react-markdown"
        ]
      },
      {
        "name": "@base-ui/react",
        "version": "1.9.0",
        "resolved": "https://registry.npmjs.org/@base-ui/react/-/react-1.9.0.tgz",
        "integrity": "sha512-S8CSYosASBKtpL8SWUfS78rFElfLijiCgA7oHOK22jCJ95FULsYyKwBNFOgudt0RA+/7yNc7F81bOvQnRgbBiQ==",
        "resolutionPath": "node_modules/@base-ui/react",
        "entries": [
          "@base-ui/react/tooltip",
          "@base-ui/react/dialog",
          "@base-ui/react/popover"
        ]
      },
      {
        "name": "@tailwindcss/vite",
        "version": "4.3.3",
        "resolved": "https://registry.npmjs.org/@tailwindcss/vite/-/vite-4.3.3.tgz",
        "integrity": "sha512-yYU8cogLeSh/ms2jh8Fj7jaba/EWa7Ja6GoUqYZaraEuCI5YS6ms6ObZgjjedm+jm6XZjdNRWBpPP6Z86oOxcw==",
        "resolutionPath": "node_modules/@tailwindcss/vite",
        "entries": []
      },
      {
        "name": "@types/node",
        "version": "26.6.6",
        "resolved": "https://registry.npmjs.org/@types/node/-/node-26.6.6.tgz",
        "integrity": "sha512-MzQj+8Kx3XI40OmUAE6Qoh58ZMNstNNMwn2nfd3qWsfe7nDNSqJNzes4njhz6AHwrSHOffSLwXU6yb474Q4aog==",
        "resolutionPath": "node_modules/@types/node",
        "entries": []
      },
      {
        "name": "@types/react",
        "version": "19.3.0",
        "resolved": "https://registry.npmjs.org/@types/react/-/react-19.3.0.tgz",
        "integrity": "sha512-N0rFCuH9YoxG9/m61l9MfpJKfmLOVU0em7ipIz6TRgSSkvReLB9vL85GB+yr8Bs5leqpvg96JSwF4ZS1s4viQg==",
        "resolutionPath": "node_modules/@types/react",
        "entries": []
      },
      {
        "name": "@types/react-dom",
        "version": "19.3.0",
        "resolved": "https://registry.npmjs.org/@types/react-dom/-/react-dom-19.3.0.tgz",
        "integrity": "sha512-ZI7bU42mZXXKHn/qNLEw2IrbiINU7X5+vfgdixBHkCNpYWXjKgfQ/P+uyGb5CjOLB9UcnTeg3rylQtV2hym44Q==",
        "resolutionPath": "node_modules/@types/react-dom",
        "entries": []
      },
      {
        "name": "@vitejs/plugin-react",
        "version": "6.1.2",
        "resolved": "https://registry.npmjs.org/@vitejs/plugin-react/-/plugin-react-6.1.2.tgz",
        "integrity": "sha512-fhJNGUdscQa4HkI0xFxwonWyhnVReCPDbXI7FH7jmzpnVCrFQI7PRrhWecO263610vOrs9tr2Y4xcf8uAdFxbw==",
        "resolutionPath": "node_modules/@vitejs/plugin-react",
        "entries": []
      },
      {
        "name": "class-variance-authority",
        "version": "0.7.1",
        "resolved": "https://registry.npmjs.org/class-variance-authority/-/class-variance-authority-0.7.1.tgz",
        "integrity": "sha512-Ka+9Trutv7G8M6WT6SeiRWz792K5qEqIGEGzXKhAE6xOWAY6pPH8U+9IY3oCMv6kqTmLsv7Xh/2w2RigkePMsg==",
        "resolutionPath": "node_modules/class-variance-authority",
        "entries": []
      },
      {
        "name": "cn",
        "version": "0.5.0",
        "resolved": "https://registry.npmjs.org/cn/-/cn-0.5.0.tgz",
        "integrity": "sha512-JGEixZEpfFXm1P5uXwvEobOFLlHwIWi5v4tjd1ZwfiYmcEilkuD2l+054rvJcYCR1B+uVThHeUbgmNz1FwuxuA==",
        "resolutionPath": "node_modules/cn",
        "entries": []
      },
      {
        "name": "jsdom",
        "version": "30.1.3",
        "resolved": "https://registry.npmjs.org/jsdom/-/jsdom-30.1.3.tgz",
        "integrity": "sha512-hQMUPvRgN7KxsfIytDQji7bimuJeRQa6Qo5+iuiZQk5CafeRxLIA10/cG5YCBFNpD9RO3oqIiN4CO1Y44kxqXg==",
        "resolutionPath": "node_modules/jsdom",
        "entries": []
      },
      {
        "name": "lucide-react",
        "version": "1.61.0",
        "resolved": "https://registry.npmjs.org/lucide-react/-/lucide-react-1.61.0.tgz",
        "integrity": "sha512-v2SQPPPNjnr+BlhL9Spuzmo5yR+hLkftfuE4E3jaxdNPgSH0hJKPcLJBP7yAta87jQNPsSERS59PJjCJ/CorBA==",
        "resolutionPath": "node_modules/lucide-react",
        "entries": []
      },
      {
        "name": "react",
        "version": "19.3.1",
        "resolved": "https://registry.npmjs.org/react/-/react-19.3.1.tgz",
        "integrity": "sha512-QNhWdt7nrgVWWQG58QuGsAR3jv3Hbe4mb4vz7w2csnHavciZJgda1CPNaldF6eVxv90ud3jUXpKlHL69gO38yw==",
        "resolutionPath": "node_modules/react",
        "entries": [
          "react"
        ]
      },
      {
        "name": "react-dom",
        "version": "19.3.1",
        "resolved": "https://registry.npmjs.org/react-dom/-/react-dom-19.3.1.tgz",
        "integrity": "sha512-Y0bARz53lhEC1NMCASs0/j+faB/zqt3R8hpvg1e8+61ZVJ4UL0UdC4cBbXfZMcIuhrfgeILTLe+ZeBCavQPtKQ==",
        "resolutionPath": "node_modules/react-dom",
        "entries": [
          "react-dom/client"
        ]
      },
      {
        "name": "remark-gfm",
        "version": "4.0.1",
        "resolved": "https://registry.npmjs.org/remark-gfm/-/remark-gfm-4.0.1.tgz",
        "integrity": "sha512-1quofZ2RQ9EWdeN34S79+KExV1764+wCUGop5CPL1WGdD0ocPpu91lzPGbwWMECpEpd42kJGQwzRfyov9j4yNg==",
        "resolutionPath": "node_modules/remark-gfm",
        "entries": []
      },
      {
        "name": "tailwindcss",
        "version": "4.3.3",
        "resolved": "https://registry.npmjs.org/tailwindcss/-/tailwindcss-4.3.3.tgz",
        "integrity": "sha512-gOhV3P7ufE62QDGg1zVaTgCR+EtPv92k2nIhVcVKcLmxT1sUBsQGhnZj175j+MqRt4zLF7ic+sCYjfhxMxj7YQ==",
        "resolutionPath": "node_modules/tailwindcss",
        "entries": []
      },
      {
        "name": "tw-animate-css",
        "version": "1.4.0",
        "resolved": "https://registry.npmjs.org/tw-animate-css/-/tw-animate-css-1.4.0.tgz",
        "integrity": "sha512-7bziOlRqH0hJx80h/3mbicLW7o8qLsH5+RaLR2t+OHM3D0JlWGODQKQ4cxbK7WlvmUxpcj6Kgu6EKqjrGFe3QQ==",
        "resolutionPath": "node_modules/tw-animate-css",
        "entries": []
      },
      {
        "name": "tw-shimmer",
        "version": "0.4.14",
        "resolved": "https://registry.npmjs.org/tw-shimmer/-/tw-shimmer-0.4.14.tgz",
        "integrity": "sha512-Df4Mhpxa/b/YYvwCxhe6M/C0pZ1bYxFkAUrMjgmRO2vimu+QYi1gNHxV+9ZNTMpBtLJHEq9p6zuSzC7wiPeYYA==",
        "resolutionPath": "node_modules/tw-shimmer",
        "entries": []
      },
      {
        "name": "typescript",
        "version": "7.0.2",
        "resolved": "https://registry.npmjs.org/typescript/-/typescript-7.0.2.tgz",
        "integrity": "sha512-8FYau96o3NKOhbjKi/qNvG/W5jhzxkbdm5sj9AbZ/5T5sWqn3hJgLfGx27sRKZWTvyzCP8dLRBTf5tBTSRVUNA==",
        "resolutionPath": "node_modules/typescript",
        "entries": [
          "typescript"
        ]
      },
      {
        "name": "vite",
        "version": "8.3.4",
        "resolved": "https://registry.npmjs.org/vite/-/vite-8.3.4.tgz",
        "integrity": "sha512-IftLE8phJhdNRIGNEV4JCCvfNScoZQVfcXaN8TQropWGJtOHcu+iAB9pHcuGvmEb/kddw0LBe/jS8ztdC6xdiQ==",
        "resolutionPath": "node_modules/vite",
        "entries": [
          "vite"
        ],
        "witnessFiles": [
          {"path":"dist/node/chunks/node.js","sha256":"dab5039168ce4526f98058d84e31bf79eeed8eba558a9a27db570df893326364"}
        ]
      },
      {
        "name": "zustand",
        "version": "5.0.16",
        "resolved": "https://registry.npmjs.org/zustand/-/zustand-5.0.16.tgz",
        "integrity": "sha512-Uv7e327ihlCfayfja3hDc0M64Upev1LWBKpRobdK4NyovDDPeeX4imWXc/wzC1yc6fkYPoAY/ncKVPAs2jrtQw==",
        "resolutionPath": "node_modules/zustand",
        "entries": []
      }
    ],
    "buildCommand": [
      "npm",
      "run",
      "build",
      "--workspaces=false"
    ],
    "sourceMaps": false,
    "explicitTarget": null,
    "renderer": "complete pinned official Thread/theme with content-visibility and top turn anchoring"
  },
  {
    "schema": "competitor-stock-source-pins-v1",
    "profile": "vercel-ai-sdk",
    "sources": {
      "competitors/shared/context.mjs": "d803b39bbc54d79e0a25aed7a702b2f84e8ebaf12beb258900be77bb5e1a7f57",
      "competitors/shared/protocol.ts": "d76886a0c4f617669fbcf57de98ff9eb6cf99e6e33de1145707a8958f73c31e2",
      "competitors/vercel-ai-sdk/README.md": "dd19898a44377f79c3c1d6b7e75baf3b3523eb6d25bc6bb343d194d9b31e1997",
      "competitors/vercel-ai-sdk/index.html": "9e3cd908b722836184d6851a898d9ecad96622e8c098e73574f80b2ef7920400",
      "competitors/vercel-ai-sdk/package-lock.json": "14500be4750acfed4568cc6c53b7ec3976310e3fa46dd4061e39fc0eceb30877",
      "competitors/vercel-ai-sdk/package.json": "c8bef2535e4866a1c5336e709eb45313b74f9a0dc70b6431aa51a4433d493461",
      "competitors/vercel-ai-sdk/scripts/verify-isolation.mjs": "453f30d37f82aa1ea590497fa32ac739c3160b865af50881a6222ccc2342b028",
      "competitors/vercel-ai-sdk/src/app.ts": "8e0b471249acfc9aeb900495f0ddfd8b08227c57c83ac8a44af70fff3d61c96d",
      "competitors/vercel-ai-sdk/src/isolation.node.mjs": "87f9468125920d94f75b68b5c96434e5514a7ff1bd095ae654f3cfa3c4991378",
      "competitors/vercel-ai-sdk/src/main.ts": "3dd513b610d8c6f6eb6f1461ff350c4339cddc91fcb9482f9796f8de5388c2e9",
      "competitors/vercel-ai-sdk/src/operation.d.mts": "5cba7284ddec76d0b7e0fc06ede0de0a2b69386f7a2fd0aa3042dd3f2a00e746",
      "competitors/vercel-ai-sdk/src/operation.mjs": "ac4feccde9f3785ff34ce5c6fcdfc0081b551f100011a2e59cd4bf0536cd6a8a",
      "competitors/vercel-ai-sdk/src/operation.node.mjs": "355494048673057b9e94be0cee7ec34bc3dda6979ca6873fd215f55229077226",
      "competitors/vercel-ai-sdk/src/projection.ts": "4eea8ff876beb68c924f59effd8629c860aa608b25fb14c72bb9c7ef516de44f",
      "competitors/vercel-ai-sdk/src/sdk.node.mjs": "61cd21c84bc9ced8c20c35c9f9be5a443a73b158357ef0397487a6bbdca38144",
      "competitors/vercel-ai-sdk/src/styles.css": "6c55614e8e60fe750c6e7eb7bf203d3c94a19b7f62f8503ab1e17fa54703f81e",
      "competitors/vercel-ai-sdk/src/vite-env.d.ts": "65996936fbb042915f7b74a200fcdde7e410f32a669b1ab9597cfaa4b0faddb5",
      "competitors/vercel-ai-sdk/tsconfig.json": "192f208f6f93b85f8d0bc2a1a264ddd59f5fd816e65d0835511d02bece8db770",
      "competitors/vercel-ai-sdk/vite.config.mjs": "0a65fb2cea4afcb824c494b29cfa0f320b490b768d2d33889fcf42119ede2e54"
    },
    "packages": [
      {
        "name": "@ai-sdk/react",
        "version": "4.0.163",
        "resolved": "https://registry.npmjs.org/@ai-sdk/react/-/react-4.0.163.tgz",
        "integrity": "sha512-7BPOUcSEuVy9Q9Y53nxyEd6E6tcqnUZ8WstsNUleGWik0W5oLYAyjFeUUpednW69zlkPwdrVrqVbQx3ZUqrAXQ==",
        "resolutionPath": "node_modules/@ai-sdk/react",
        "entries": [
          "@ai-sdk/react"
        ]
      },
      {
        "name": "@types/node",
        "version": "24.10.1",
        "resolved": "https://registry.npmjs.org/@types/node/-/node-24.10.1.tgz",
        "integrity": "sha512-GNWcUTRBgIRJD5zj+Tq0fKOJ5XZajIiBroOF0yvj2bSU1WvNdYS/dn9UxwsujGW4JX06dnHyjV2y9rRaybH0iQ==",
        "resolutionPath": "node_modules/@types/node",
        "entries": []
      },
      {
        "name": "@types/react",
        "version": "19.3.0",
        "resolved": "https://registry.npmjs.org/@types/react/-/react-19.3.0.tgz",
        "integrity": "sha512-N0rFCuH9YoxG9/m61l9MfpJKfmLOVU0em7ipIz6TRgSSkvReLB9vL85GB+yr8Bs5leqpvg96JSwF4ZS1s4viQg==",
        "resolutionPath": "node_modules/@types/react",
        "entries": []
      },
      {
        "name": "@types/react-dom",
        "version": "19.3.0",
        "resolved": "https://registry.npmjs.org/@types/react-dom/-/react-dom-19.3.0.tgz",
        "integrity": "sha512-ZI7bU42mZXXKHn/qNLEw2IrbiINU7X5+vfgdixBHkCNpYWXjKgfQ/P+uyGb5CjOLB9UcnTeg3rylQtV2hym44Q==",
        "resolutionPath": "node_modules/@types/react-dom",
        "entries": []
      },
      {
        "name": "ai",
        "version": "7.0.159",
        "resolved": "https://registry.npmjs.org/ai/-/ai-7.0.159.tgz",
        "integrity": "sha512-4e/BwDoKJlMNYZaqERcTbGte+4TwroN9qKnCprog/XVfD9InzVPlhCviDhN452JIRrRsYg9BT0WsQ2C3Ds2mVQ==",
        "resolutionPath": "node_modules/ai",
        "entries": [
          "ai"
        ]
      },
      {
        "name": "jsdom",
        "version": "30.1.3",
        "resolved": "https://registry.npmjs.org/jsdom/-/jsdom-30.1.3.tgz",
        "integrity": "sha512-hQMUPvRgN7KxsfIytDQji7bimuJeRQa6Qo5+iuiZQk5CafeRxLIA10/cG5YCBFNpD9RO3oqIiN4CO1Y44kxqXg==",
        "resolutionPath": "node_modules/jsdom",
        "entries": []
      },
      {
        "name": "react",
        "version": "19.3.1",
        "resolved": "https://registry.npmjs.org/react/-/react-19.3.1.tgz",
        "integrity": "sha512-QNhWdt7nrgVWWQG58QuGsAR3jv3Hbe4mb4vz7w2csnHavciZJgda1CPNaldF6eVxv90ud3jUXpKlHL69gO38yw==",
        "resolutionPath": "node_modules/react",
        "entries": [
          "react"
        ]
      },
      {
        "name": "react-dom",
        "version": "19.3.1",
        "resolved": "https://registry.npmjs.org/react-dom/-/react-dom-19.3.1.tgz",
        "integrity": "sha512-Y0bARz53lhEC1NMCASs0/j+faB/zqt3R8hpvg1e8+61ZVJ4UL0UdC4cBbXfZMcIuhrfgeILTLe+ZeBCavQPtKQ==",
        "resolutionPath": "node_modules/react-dom",
        "entries": [
          "react-dom/client"
        ]
      },
      {
        "name": "typescript",
        "version": "7.0.2",
        "resolved": "https://registry.npmjs.org/typescript/-/typescript-7.0.2.tgz",
        "integrity": "sha512-8FYau96o3NKOhbjKi/qNvG/W5jhzxkbdm5sj9AbZ/5T5sWqn3hJgLfGx27sRKZWTvyzCP8dLRBTf5tBTSRVUNA==",
        "resolutionPath": "node_modules/typescript",
        "entries": [
          "typescript"
        ]
      },
      {
        "name": "vite",
        "version": "8.3.4",
        "resolved": "https://registry.npmjs.org/vite/-/vite-8.3.4.tgz",
        "integrity": "sha512-IftLE8phJhdNRIGNEV4JCCvfNScoZQVfcXaN8TQropWGJtOHcu+iAB9pHcuGvmEb/kddw0LBe/jS8ztdC6xdiQ==",
        "resolutionPath": "node_modules/vite",
        "entries": [
          "vite"
        ],
        "witnessFiles": [
          {"path":"dist/node/chunks/node.js","sha256":"dab5039168ce4526f98058d84e31bf79eeed8eba558a9a27db570df893326364"}
        ]
      }
    ],
    "buildCommand": [
      "npm",
      "run",
      "build",
      "--workspaces=false"
    ],
    "sourceMaps": false,
    "explicitTarget": "es2022",
    "renderer": "benchmark-owned plain-text renderer/bottom follow using public AI SDK UI hooks"
  }
]);
export const COMPETITOR_STOCK_PROFILES_V1=Object.freeze(profiles.map(row=>row.profile));
export function competitorStockProfileV1(name){const profile=profiles.find(row=>row.profile===name);if(!profile)throw Error('competitor-stock-profile');return profile;}
