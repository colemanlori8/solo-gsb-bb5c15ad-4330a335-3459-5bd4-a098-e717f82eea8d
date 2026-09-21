import { ReactFlowProvider } from '@xyflow/react';
import { Toolbar } from './components/Toolbar';
import { FlowCanvas } from './components/FlowCanvas';
import { Inspector } from './components/Inspector';
import { RunSheet } from './components/RunSheet';
import { StatusBar } from './components/StatusBar';
import { Toasts } from './components/Toasts';

export default function App() {
  return (
    <ReactFlowProvider>
      <div className="app">
        <Toolbar />
        <main className="workspace">
          <div className="canvas-wrap">
            <FlowCanvas />
          </div>
          <aside className="side-col">
            <Inspector />
          </aside>
        </main>
        <RunSheet />
        <StatusBar />
        <Toasts />
      </div>
    </ReactFlowProvider>
  );
}
