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
import {getI18nLang, loadEnglish, setI18nLang} from './i18n';
import {loadDemoRepository} from './data/repositories';

installChunkRecovery();
installEscapeClosesDialogs();
installTabletViewport();
const root = document.getElementById('root');
const runtimeDataMode = getRuntimeDataMode();
if (!root) throw new Error('SurgiTrack: root element was not found.');
// An emailed invitation or password-reset link opens its own page first (see EmailLinkPage).
const link = emailLink();
const render = () =>
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
// English users get their dictionary before the first paint; if it cannot be downloaded the app opens in Greek.
const english =
  getI18nLang() === 'en'
    ? loadEnglish().catch(() => {
        setI18nLang('el');
      })
    : undefined;
// Demo mode needs the sample hospital before the stores start.
const demo = runtimeDataMode === 'DEMO' ? loadDemoRepository() : undefined;
void Promise.all([english, demo]).then(render, render);
