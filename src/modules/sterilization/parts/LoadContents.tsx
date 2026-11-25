import {Link} from 'react-router-dom';
import AssetTypeIcon from '../../../components/assets/AssetTypeIcon';
import {useSurgi} from '../../../store/SurgiStore';
import type {ProcessLoadRecord} from '../../../types/domain';
import {tr, trData} from '../../../i18n';
import CycleMonitor from './CycleMonitor';

/** What a load holds: its cycle (live for a simulated one, else what was measured) and its Sets and instruments. */
export default function LoadContents({load}: {load: ProcessLoadRecord}) {
  const {tools} = useSurgi();
  const data = load.cycleData;
  const sets = load.items.filter(item => item.assetKind === 'SET').length;
  const instruments = load.items.length - sets;
  return (
    <>
      {load.status === 'OPEN' && <CycleMonitor load={load} />}
      {data && load.status !== 'OPEN' && (
        <p className={`cycle-verdict ${data.result === 'PASS' ? 'ok' : 'bad'}`}>
          {data.maxTemperature.toFixed(1)} °C · {(data.minHoldPressure ?? data.maxPressure).toFixed(2)} bar ·{' '}
          {data.holdMinutes}′ ·{' '}
          {data.result === 'PASS'
            ? tr('Οι παράμετροι του κύκλου τηρήθηκαν.')
            : tr('Οι παράμετροι του κύκλου δεν τηρήθηκαν.')}
          {data.source === 'SIMULATION' ? ` · ${tr('Προσομοίωση')}` : ''}
        </p>
      )}
      {load.kind === 'WASHING' && (
        <p className={`cycle-verdict ${load.status === 'FAILED' ? 'bad' : 'ok'}`}>
          {[
            load.washTemperature !== undefined && `${load.washTemperature} °C`,
            load.washA0 !== undefined && `A0 ${load.washA0}`,
          ]
            .filter(Boolean)
            .concat(load.status === 'FAILED' ? tr('Αποτυχία πλύσης') : tr('Επιτυχής πλύση'))
            .join(' · ')}
        </p>
      )}
      {/* The cycle in one line (number, program, when it went in, who loaded it), then what it holds. */}
      <p className="load-details-cycle">
        {[load.cycleNumber && `${tr('Κύκλος')} ${load.cycleNumber}`, load.program, load.createdAt, load.createdByName]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <h4 className="load-details-count">
        {tr('Περιεχόμενο φορτίου')} · {load.items.length}
        {sets > 0 && instruments > 0 && (
          <small>
            {' '}
            ({sets} {tr('Σετ')} · {instruments} {tr('εργαλεία')})
          </small>
        )}
      </h4>
      <ul className={`load-details-items${load.items.length > 6 ? ' many' : ''}`}>
        {load.items.map(item => {
          const inside = item.assetKind === 'SET' ? tools.filter(t => t.setId === item.assetId) : [];
          return (
            <li key={`${item.assetKind}:${item.assetId}`}>
              <div className="load-details-item">
                <AssetTypeIcon kind={item.assetKind} size={16} />
                <Link
                  className="mono"
                  to={item.assetKind === 'SET' ? `/sets/${item.assetId}` : `/tools/${item.assetId}`}
                >
                  {item.barcode}
                </Link>
                <b>{item.assetName}</b>
                <small>{trData(item.department)}</small>
              </div>
              {inside.length > 0 && (
                <details>
                  <summary>{tr('{0} εργαλεία μέσα στο σετ', inside.length)}</summary>
                  <ul>
                    {inside.map(tool => (
                      <li key={tool.id}>
                        <span className="mono">{tool.barcode}</span> {tool.name}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
