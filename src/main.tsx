import React from 'react';
import ReactDOM from 'react-dom/client';
import {HashRouter} from 'react-router-dom';
import App from './app/App';
import {SurgiProvider} from './store/SurgiStore';
import {AppPreferencesProvider} from './core/AppPreferences';
import {LibraryStoreProvider} from './core/LibraryStore';
import {getRuntimeDataMode} from './config/dataMode';
import CloudWorkspaceGate from './data/cloud/CloudWorkspaceGate';
import './styles/global.css';
const root = document.getElementById('root');
const runtimeDataMode = getRuntimeDataMode();
if (!root) throw new Error('SurgiTrack: root element was not found.');
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <HashRouter>
      <AppPreferencesProvider>
        <CloudWorkspaceGate>
          {cloud => (
            <LibraryStoreProvider dataMode={runtimeDataMode} cloud={cloud}>
              <SurgiProvider dataMode={runtimeDataMode} cloud={cloud}>
                <App />
              </SurgiProvider>
            </LibraryStoreProvider>
          )}
        </CloudWorkspaceGate>
      </AppPreferencesProvider>
    </HashRouter>
  </React.StrictMode>,
);
