import {Component, type ReactNode} from 'react';
import {RefreshCcw} from 'lucide-react';
import {isChunkLoadError} from '../../core/resilience';
import {tr} from '../../i18n';

type State = {error: unknown};

/**
 * Keeps a failing page from taking the whole app down: the menu stays usable and the user can
 * reload. A page file that is gone (a new version was published) gets its own message.
 */
export default class RouteErrorBoundary extends Component<{children: ReactNode}, State> {
  state: State = {error: null};
  private path = window.location.hash;
  private onHashChange = () => {
    if (window.location.hash !== this.path && this.state.error) this.setState({error: null});
    this.path = window.location.hash;
  };

  static getDerivedStateFromError(error: unknown): State {
    return {error};
  }

  componentDidMount() {
    window.addEventListener('hashchange', this.onHashChange);
  }

  componentWillUnmount() {
    window.removeEventListener('hashchange', this.onHashChange);
  }

  componentDidCatch(error: unknown) {
    console.error('SurgiTrack page error', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const newVersion = isChunkLoadError(this.state.error);
    return (
      <div className="route-error" role="alert">
        <h2>{newVersion ? tr('Υπάρχει νέα έκδοση της εφαρμογής') : tr('Η σελίδα δεν μπόρεσε να ανοίξει')}</h2>
        <p>
          {newVersion
            ? tr('Ανανεώστε για να φορτώσει η τελευταία έκδοση. Τα δεδομένα σας είναι αποθηκευμένα.')
            : tr('Δοκιμάστε ξανά ή ανανεώστε τη σελίδα. Τα δεδομένα σας είναι αποθηκευμένα.')}
        </p>
        <div>
          {!newVersion && (
            <button
              type="button"
              className="app-button app-button-secondary app-button-md"
              onClick={() => this.setState({error: null})}
            >
              {tr('Δοκιμή ξανά')}
            </button>
          )}
          <button
            type="button"
            className="app-button app-button-primary app-button-md"
            onClick={() => window.location.reload()}
          >
            <RefreshCcw size={16} /> {tr('Ανανέωση')}
          </button>
        </div>
      </div>
    );
  }
}
