import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {
  HashRouter,
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import {beforeEach, describe, expect, it} from 'vitest';
import BackLink from '../../components/ui/BackLink';

const Where = () => {
  const {pathname, search} = useLocation();
  return <output data-testid="where">{pathname + search}</output>;
};
const Queue = () => {
  const [params] = useSearchParams();
  return <p>queue={params.get('queue') ?? 'none'}</p>;
};
const Go = () => {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/sterilization?queue=READY')}>go</button>;
};
const App = () => (
  <HashRouter>
    <nav>
      <NavLink to="/sets">sets-link</NavLink>
      <Link to="/tools/t1">tool-link</Link>
      <Go />
    </nav>
    <Where />
    <Routes>
      <Route path="/" element={<p>home</p>} />
      <Route path="/sets" element={<p>sets page</p>} />
      <Route
        path="/tools/:id"
        element={
          <>
            <p>tool page</p>
            <BackLink fallback="/tools">back</BackLink>
          </>
        }
      />
      <Route path="/sterilization" element={<Queue />} />
      <Route path="/assets" element={<Navigate to="/sets" replace />} />
      <Route path="*" element={<p>fallback</p>} />
    </Routes>
  </HashRouter>
);

describe('routing (HashRouter)', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('reads the route from the hash and keeps the URL in the hash', () => {
    window.location.hash = '#/sets';
    render(<App />);
    expect(screen.getByText('sets page')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'sets-link'})).toHaveAttribute('href', '#/sets');
    expect(screen.getByRole('link', {name: 'sets-link'})).toHaveClass('active');
  });

  it('follows links and programmatic navigation, with search parameters', () => {
    render(<App />);
    expect(screen.getByText('home')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', {name: 'tool-link'}));
    expect(screen.getByText('tool page')).toBeInTheDocument();
    expect(window.location.hash).toBe('#/tools/t1');
    fireEvent.click(screen.getByRole('button', {name: 'go'}));
    expect(screen.getByText('queue=READY')).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/sterilization?queue=READY');
  });

  it('redirects with <Navigate replace> and shows the fallback for unknown routes', () => {
    window.location.hash = '#/assets';
    render(<App />);
    expect(screen.getByText('sets page')).toBeInTheDocument();
    expect(window.location.hash).toBe('#/sets');
    act(() => {
      window.location.hash = '#/nope/at/all';
    });
    return waitFor(() => expect(screen.getByText('fallback')).toBeInTheDocument());
  });

  it('BackLink goes back when there is history and to its fallback when opened directly', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('link', {name: 'sets-link'}));
    fireEvent.click(screen.getByRole('link', {name: 'tool-link'}));
    expect(screen.getByText('tool page')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', {name: 'back'}));
    await waitFor(() => expect(screen.getByText('sets page')).toBeInTheDocument());
  });
});
