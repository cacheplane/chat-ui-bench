import { provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideAgent } from '@threadplane/langgraph';
import { App } from './app.js';
import { ThreadplaneHost } from './host.js';
import { ReplayTransport } from './replay-transport.js';
const omission = new URLSearchParams(location.search).get('conformanceOmitDelta');
const transport = new ReplayTransport(omission === null ? {} : { omitDeltaSequence: Number(omission) });
bootstrapApplication(App, { providers: [provideZonelessChangeDetection(), provideAgent({ assistantId: 'benchmark', transport, threadId: null, telemetry: false })] }).then(app => {
    const component = app.components[0]!;
    const host = new ThreadplaneHost((component.instance as App).agent, transport, () => app.destroy());
    window.benchHost = host;
}).catch(error => { window.benchSetupError = String(error); });
declare global {
    interface Window {
        benchHost: ThreadplaneHost | undefined;
        benchSetupError: string | undefined;
    }
}
