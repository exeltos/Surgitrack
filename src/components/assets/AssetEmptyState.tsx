import {PackageOpen} from 'lucide-react';
export default function AssetEmptyState({children}: {children: string}) {
  return (
    <div className="asset-empty">
      <PackageOpen size={20} />
      <span>{children}</span>
    </div>
  );
}
