import {Link} from 'react-router-dom';
import {PackageCheck, TriangleAlert, Sparkles, ArrowRight, Warehouse, PackageSearch} from 'lucide-react';
import {useSurgi} from '../../store/SurgiStore';
import StatusBadge from '../../components/ui/StatusBadge';

export default function Dashboard() {
  const {role, sets, tools, issues, movements} = useSurgi();
  const dept = 'Αίθουσα Τοκετών';
  if (role === 'DEPARTMENT') {
    const mine = [
      ...sets.filter(s => s.department === dept),
      ...tools.filter(t => t.department === dept && t.mode === 'STANDALONE'),
    ];
    const atDept = mine.filter(x => x.state === 'IN_DEPARTMENT').length,
      pending = mine.filter(x =>
        [
          'PENDING_STERILIZATION',
          'IN_WASHING',
          'IN_PREPARATION',
          'IN_PACKAGING',
          'IN_STERILIZATION',
          'AWAITING_RELEASE',
          'IN_STORAGE',
        ].includes(x.state),
      ).length,
      ready = mine.filter(x => x.state === 'READY_FOR_PICKUP').length,
      open = issues.filter(i => i.department === dept && i.status === 'OPEN').length;
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Αίθουσα Τοκετών</h1>
            <p>Ό,τι χρειάζεται το τμήμα σήμερα — χωρίς λειτουργίες της Αποστείρωσης που δεν σας αφορούν.</p>
          </div>
          <Link className="primary" to="/department">
            <PackageSearch size={16} /> Σετ & Εργαλεία
          </Link>
        </div>
        <div className="kpis">
          <div>
            <small>Στο τμήμα</small>
            <strong>{atDept}</strong>
          </div>
          <div>
            <small>Προς Αποστείρωση</small>
            <strong>{pending}</strong>
          </div>
          <div>
            <small>Έτοιμα για παραλαβή</small>
            <strong>{ready}</strong>
          </div>
          <div>
            <small>Ανοικτές εκκρεμότητες</small>
            <strong>{open}</strong>
          </div>
        </div>
        {ready > 0 && (
          <div className="notice">
            <PackageCheck />
            <div>
              <strong>{ready} αντικείμενο έτοιμο στην Αποστείρωση</strong>
              <span>Πηγαίνετε στην Αποστείρωση και ολοκληρώστε τη φυσική παραλαβή.</span>
            </div>
            <Link to="/department">
              Προβολή <ArrowRight size={15} />
            </Link>
          </div>
        )}
        <div className="dashboard-grid">
          <div className="panel">
            <h3>Τρέχουσα κατάσταση</h3>
            {mine.map(x => (
              <div className="quick" key={x.id}>
                <span className="mono">{x.barcode}</span>
                <div>
                  <strong>{x.name}</strong>
                  <span>{x.specialty}</span>
                </div>
                <StatusBadge value={x.state} />
              </div>
            ))}
          </div>
          <div className="panel">
            <h3>Τελευταίες κινήσεις του τμήματος</h3>
            {movements
              .filter(m => m.from === dept || m.to === dept)
              .slice(0, 5)
              .map(m => (
                <div className="quick" key={m.id}>
                  <div>
                    <strong>{m.asset}</strong>
                    <span>
                      {m.status} · {m.at}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </>
    );
  }
  if (role === 'STERILIZATION') {
    const all = [...sets, ...tools.filter(t => t.mode === 'STANDALONE')];
    const incoming = all.filter(x => x.state === 'PENDING_STERILIZATION').length,
      processing = all.filter(x => ['IN_PREPARATION', 'IN_STERILIZATION', 'AWAITING_RELEASE'].includes(x.state)).length,
      ready = all.filter(x => x.state === 'READY_FOR_PICKUP').length,
      stock = tools.filter(t => t.mode === 'STOCK').length;
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Κέντρο Αποστείρωσης</h1>
            <p>Η επιχειρησιακή ουρά όλων των τμημάτων.</p>
          </div>
          <Link className="primary" to="/sterilization">
            <Sparkles size={16} /> Άνοιγμα ροής
          </Link>
        </div>
        <div className="kpis">
          <div>
            <small>Αναμονή φυσικής παραλαβής</small>
            <strong>{incoming}</strong>
          </div>
          <div>
            <small>Υπό επεξεργασία</small>
            <strong>{processing}</strong>
          </div>
          <div>
            <small>Έτοιμα προς παράδοση</small>
            <strong>{ready}</strong>
          </div>
          <div>
            <small>Διαθέσιμα στο Stock</small>
            <strong>{stock}</strong>
          </div>
        </div>
        <div className="dashboard-grid">
          <div className="panel">
            <h3>Προτεραιότητες</h3>
            {all
              .filter(x => x.state !== 'IN_DEPARTMENT' && x.state !== 'IN_STOCK')
              .map(x => (
                <div className="quick" key={x.id}>
                  <span className="mono">{x.barcode}</span>
                  <div>
                    <strong>{x.name}</strong>
                    <span>{x.department || '—'}</span>
                  </div>
                  <StatusBadge value={x.state} />
                </div>
              ))}
          </div>
          <div className="panel">
            <h3>Απαιτούν προσοχή</h3>
            {issues
              .filter(i => i.status === 'OPEN')
              .map(i => (
                <div className="quick" key={i.id}>
                  <TriangleAlert size={17} />
                  <div>
                    <strong>{i.asset}</strong>
                    <span>
                      {i.type} · {i.note}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="page-head">
        <div>
          <h1>SurgiTrack · Διαχείριση</h1>
          <p>Συνολική εικόνα του συστήματος, εξοπλισμού και ρυθμίσεων.</p>
        </div>
      </div>
      <div className="kpis">
        <div>
          <PackageSearch />
          <small>Set</small>
          <strong>{sets.length}</strong>
        </div>
        <div>
          <Warehouse />
          <small>Εργαλεία</small>
          <strong>{tools.length}</strong>
        </div>
        <div>
          <Sparkles />
          <small>Στην Αποστείρωση</small>
          <strong>
            {
              [...sets, ...tools].filter(x =>
                [
                  'PENDING_STERILIZATION',
                  'IN_WASHING',
                  'IN_PREPARATION',
                  'IN_PACKAGING',
                  'IN_STERILIZATION',
                  'AWAITING_RELEASE',
                  'IN_STORAGE',
                ].includes(x.state),
              ).length
            }
          </strong>
        </div>
        <div>
          <TriangleAlert />
          <small>Εκκρεμότητες</small>
          <strong>{issues.filter(i => i.status === 'OPEN').length}</strong>
        </div>
      </div>
    </>
  );
}
