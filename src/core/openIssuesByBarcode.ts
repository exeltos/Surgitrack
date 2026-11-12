/**
 * The open issues of every asset, by barcode, built once for a list: looking them up row by row in the whole
 * list of issues costs rows × issues, which at a large hospital's size (thousands of rows and of issues)
 * blocked the screen. An issue names its asset as "<barcode> · <name>"; the same issue is found as the rows
 * found it before (its asset starts with the row's barcode).
 */
export function openIssuesByBarcode<T extends {status: string; asset: string}>(issues: readonly T[]) {
  const byBarcode = new Map<string, T[]>();
  for (const issue of issues) {
    if (issue.status !== 'OPEN') continue;
    const barcode = issue.asset.split(' ')[0];
    const list = byBarcode.get(barcode);
    if (list) list.push(issue);
    else byBarcode.set(barcode, [issue]);
  }
  const none: T[] = [];
  return (barcode: string) => (byBarcode.get(barcode) || none).filter(issue => issue.asset.startsWith(barcode));
}
