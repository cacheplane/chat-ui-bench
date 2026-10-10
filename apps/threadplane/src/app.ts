import { Component } from '@angular/core';
import { ChatComponent } from '@threadplane/chat';
import { injectAgent } from '@threadplane/langgraph';
@Component({ selector: 'bench-app', standalone: true, imports: [ChatComponent], template: '<chat [agent]="agent" />' })
export class App {
    readonly agent = injectAgent();
}
