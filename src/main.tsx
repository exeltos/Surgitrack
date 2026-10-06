import React from 'react';
import ReactDOM from 'react-dom/client';
import {HashRouter} from 'react-router-dom';
import App from './app/App';
import {SurgiProvider} from './store/SurgiStore';
import {AppPreferencesProvider} from './core/AppPreferences';
import {LibraryStoreProvider} from './core/LibraryStore';
import {getRuntimeDataMode} from './config/dataMode';
import CloudWorkspaceGate from './data/cloud/CloudWorkspaceGate';
import EmailLinkPage from './modules/auth/EmailLinkPage';
import {emailLink} from './modules/auth/emailLink';
import './styles/global.css';
import {installChunkRecovery, installEscapeClosesDialogs} from './core/resilience';
import {installTabletViewport} from './core/tabletViewport';

installChunkRecovery();
installEscapeClosesDialogs();
installTabletViewport();
const root = document.getElementById('root');
const runtimeDataMode = getRuntimeDataMode();
if (!root) throw new Error('SurgiTrack: root element was not found.');
// An emailed invitation or password-reset link opens its own page first (see EmailLinkPage).
const link = emailLink();
ReactDOM.createRoot(root).render(
  link ? (
    <React.StrictMode>
      <EmailLinkPage token={link.token} type={link.type} />
    </React.StrictMode>
  ) : (
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
    </React.StrictMode>
  ),
);
