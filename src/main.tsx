import React from 'react';
import ReactDOM from 'react-dom/client';
import {HashRouter} from 'react-router-dom';
import App from './app/App';
import {SurgiProvider} from './store/SurgiStore';
import {AppPreferencesProvider} from './core/AppPreferences';
import {LibraryStoreProvider} from './core/LibraryStore';
import {SURGITRACK_DATA_MODE} from './config/dataMode';
import './styles/global.css';
const root = document.getElementById('root');
if (!root) throw new Error('SurgiTrack: root element was not found.');
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <HashRouter>
      <AppPreferencesProvider>
        <LibraryStoreProvider dataMode={SURGITRACK_DATA_MODE}>
          <SurgiProvider dataMode={SURGITRACK_DATA_MODE}>
            <App />
          </SurgiProvider>
        </LibraryStoreProvider>
      </AppPreferencesProvider>
    </HashRouter>
  </React.StrictMode>,
);
