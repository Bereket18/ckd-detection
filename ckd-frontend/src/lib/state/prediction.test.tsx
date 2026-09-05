import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { PredictionProvider } from './PredictionProvider';
import { usePrediction } from './prediction-context';
import { toPredictionView } from '../api/views';
import { PREDICTION_FIXTURE } from '../../../tests/fixtures/api';

const VIEW = toPredictionView(PREDICTION_FIXTURE);

/** A page that can set, read, and clear the held prediction. */
function Probe({ label }: { label: string }) {
  const { prediction, receivedAt, setPrediction, clearPrediction } = usePrediction();

  return (
    <div>
      <h1>{label}</h1>
      <p data-testid="band">{prediction === null ? 'none' : prediction.risk_band}</p>
      <p data-testid="stamped">{receivedAt === null ? 'no' : 'yes'}</p>
      <button type="button" onClick={() => setPrediction(VIEW)}>
        set
      </button>
      <button type="button" onClick={clearPrediction}>
        clear
      </button>
      <Link to="/other">go to other</Link>
    </div>
  );
}

function mount() {
  return render(
    <PredictionProvider>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Probe label="first" />} />
          <Route path="/other" element={<Probe label="other" />} />
        </Routes>
      </MemoryRouter>
    </PredictionProvider>
  );
}

describe('prediction context', () => {
  it('throws outside a provider instead of pretending there is no prediction', () => {
    // A neutral default here would let a Results page render "no result" forever
    // while the real cause was a missing provider.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe label="orphan" />)).toThrow(/usePrediction must be used inside/);
    consoleError.mockRestore();
  });

  it('starts empty', () => {
    mount();
    expect(screen.getByTestId('band')).toHaveTextContent('none');
    expect(screen.getByTestId('stamped')).toHaveTextContent('no');
  });

  it('holds a prediction and stamps when it arrived', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'set' }));
    expect(screen.getByTestId('band')).toHaveTextContent('HIGH');
    expect(screen.getByTestId('stamped')).toHaveTextContent('yes');
  });

  it('survives in-app navigation', async () => {
    mount();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'set' }));
    await user.click(screen.getByRole('link', { name: 'go to other' }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('other');
    expect(screen.getByTestId('band')).toHaveTextContent('HIGH');
  });

  it('is gone after a remount, which is what a page reload is', async () => {
    const first = mount();
    await userEvent.click(screen.getByRole('button', { name: 'set' }));
    expect(screen.getByTestId('band')).toHaveTextContent('HIGH');

    first.unmount();
    mount();

    expect(screen.getByTestId('band')).toHaveTextContent('none');
    expect(screen.getByTestId('stamped')).toHaveTextContent('no');
  });

  it('clears on request and drops the timestamp with it', async () => {
    mount();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'set' }));
    await user.click(screen.getByRole('button', { name: 'clear' }));

    expect(screen.getByTestId('band')).toHaveTextContent('none');
    expect(screen.getByTestId('stamped')).toHaveTextContent('no');
  });

  it('persists nothing — no storage write of any kind', async () => {
    // Spying on `Storage.prototype` covers sessionStorage and localStorage at once:
    // both inherit from it, so a write to either would be caught here.
    const write = vi.spyOn(Storage.prototype, 'setItem');
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'set' }));

    expect(write).not.toHaveBeenCalled();
    expect(sessionStorage.length).toBe(0);
    write.mockRestore();
  });

  it('holds a view whose model artifacts carry no filesystem path', () => {
    // The provider's type is PredictionView, so the projection has already run.
    // Asserted here because this is the boundary the guarantee depends on.
    const serialized = JSON.stringify(VIEW);
    expect(serialized).not.toMatch(/[A-Za-z]:\\/);
    expect(serialized).not.toContain('saved_models');
    for (const artifact of Object.values(VIEW.model.artifacts)) {
      expect(artifact).not.toHaveProperty('path');
      expect(artifact.sha256).toEqual(expect.any(String));
    }
  });
});
