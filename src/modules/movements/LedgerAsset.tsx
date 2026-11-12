import AssetTypeIcon from '../../components/assets/AssetTypeIcon';
import type {AssetKind} from '../../types/domain';

/** The Set or instrument of a history row: its icon, its name, and its barcode under it (as in the lists). */
export default function LedgerAsset({kind, barcode, name}: {kind: AssetKind; barcode: string; name?: string}) {
  return (
    <span className="ledger-asset with-icon">
      <AssetTypeIcon kind={kind} framed size={14} />
      <span>
        <b>{name && name !== barcode ? name : barcode}</b>
        {name && name !== barcode && <small className="mono registry-row-barcode">{barcode}</small>}
      </span>
    </span>
  );
}
