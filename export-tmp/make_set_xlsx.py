"""One Excel per Set: its details at the top and its instruments below, for correcting and reading back.

Usage: python3 make_set_xlsx.py data.json out_dir
data.json: [{"set": {...}, "tools": [[barcode, name, code, manufacturer, serial, max_uses, wear_check, notes], ...]}, ...]
Each Set goes to out_dir/<specialty>/<barcode> <name>.xlsx
"""
import json
import os
import re
import sys

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation

HEAD = ['Α/Α', 'Barcode (μην αλλάζετε)', 'Ονομασία', 'Κωδικός', 'Εταιρεία', 'Σειριακός αριθμός',
        'Τύπος χρήσης', 'Όριο χρήσεων', 'Σημειώσεις']
WIDTHS = [6, 22, 44, 14, 18, 18, 22, 13, 30]
USE_TYPES = ['Χωρίς όριο', 'Με όριο χρήσεων', 'Χρήσεις με έλεγχο φθοράς']

DARK = PatternFill('solid', fgColor='1F4E5F')
LOCKED = PatternFill('solid', fgColor='E8EEF0')
thin = Side(style='thin', color='C9D5DA')
BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)


def safe(name):
    return re.sub(r'[\\/:*?"<>|]+', '-', name).strip()[:90]


def use_type(max_uses, wear):
    if max_uses:
        return USE_TYPES[1]
    if wear:
        return USE_TYPES[2]
    return USE_TYPES[0]


def build(entry, out_dir):
    s = entry['set']
    tools = entry['tools'] or []
    wb = Workbook()
    ws = wb.active
    ws.title = 'Σετ'
    ws['A1'] = 'SurgiTrack · Σύνθεση Σετ για διόρθωση'
    ws['A1'].font = Font(bold=True, size=14, color='1F4E5F')
    info = [
        ('Barcode Σετ', s.get('barcode') or ''),
        ('Ονομασία Σετ', s.get('name') or ''),
        ('Ειδικότητα', s.get('specialty') or ''),
        ('Τμήμα', s.get('department') or ''),
        ('Εργαλεία', len(tools)),
    ]
    for i, (k, v) in enumerate(info, start=3):
        ws.cell(row=i, column=1, value=k).font = Font(bold=True, color='526975')
        ws.cell(row=i, column=3, value=v)
        ws.merge_cells(start_row=i, start_column=1, end_row=i, end_column=2)
    ws['A3'].fill = LOCKED
    ws.cell(row=3, column=3).fill = LOCKED
    ws['E3'] = 'Διορθώστε μόνο τα λευκά κελιά. Το barcode (γκρι) είναι το κλειδί κάθε εργαλείου.'
    ws['E3'].font = Font(italic=True, color='8A5A00')
    ws['E4'] = 'Για εργαλείο που λείπει από τη λίστα, γράψτε το σε νέα γραμμή χωρίς barcode.'
    ws['E4'].font = Font(italic=True, color='8A5A00')

    top = 9
    for c, (h, w) in enumerate(zip(HEAD, WIDTHS), start=1):
        cell = ws.cell(row=top, column=c, value=h)
        cell.font = Font(bold=True, color='FFFFFF')
        cell.fill = DARK
        cell.alignment = Alignment(vertical='center', wrap_text=True)
        cell.border = BORDER
        ws.column_dimensions[cell.column_letter].width = w
    ws.row_dimensions[top].height = 30

    dv = DataValidation(type='list', formula1='"' + ','.join(USE_TYPES) + '"', allow_blank=True)
    ws.add_data_validation(dv)
    for n, t in enumerate(tools, start=1):
        barcode, name, code, manufacturer, serial, max_uses, wear, notes = (t + [None] * 8)[:8]
        row = top + n
        values = [n, barcode, name, code, manufacturer, serial, use_type(max_uses, wear), max_uses, notes]
        for c, v in enumerate(values, start=1):
            cell = ws.cell(row=row, column=c, value=v)
            cell.border = BORDER
            if c in (1, 2):
                cell.fill = LOCKED
                cell.font = Font(color='526975', bold=(c == 2))
        dv.add(ws.cell(row=row, column=7))
    # Room for instruments that are missing from the list.
    for extra in range(1, 11):
        row = top + len(tools) + extra
        for c in range(1, len(HEAD) + 1):
            ws.cell(row=row, column=c).border = BORDER
        dv.add(ws.cell(row=row, column=7))
    ws.freeze_panes = ws.cell(row=top + 1, column=3)
    ws.auto_filter.ref = f'A{top}:{ws.cell(row=top, column=len(HEAD)).column_letter}{top + len(tools)}'
    ws.page_setup.orientation = 'landscape'
    ws.page_setup.fitToWidth = 1
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_setup.fitToHeight = 0

    folder = os.path.join(out_dir, safe(s.get('specialty') or 'Χωρίς ειδικότητα'))
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, safe(f"{s.get('barcode')} {s.get('name')}") + '.xlsx')
    wb.save(path)
    return path


if __name__ == '__main__':
    with open(sys.argv[1], encoding='utf-8') as f:
        data = json.load(f)
    for entry in data:
        print(build(entry, sys.argv[2]))
