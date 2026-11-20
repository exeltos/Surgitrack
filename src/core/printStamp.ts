/**
 * What every printed A4 page says about itself: the hospital, who printed it and when, and the page («Σελίδα 2 / 5»).
 * The store keeps the hospital and the signed-in person here; the prints read them without being handed them.
 */
import {formatDateTime} from './displayDate';
import {tr, trData} from '../i18n';

let stamp: {hospital?: string; user?: string} = {};

export const setPrintStamp = (next: {hospital?: string; user?: string}) => {
  stamp = next;
};

/** The hospital's name for a print's head, or SurgiTrack where none is known (Demo before sign-in). */
export const printHospital = (hospital?: string) => trData(hospital || stamp.hospital || '') || 'SurgiTrack';

/** «Εκτυπώθηκε 20/11/2026 18:40 · Νίκος Παππάς». */
export const printedLine = () => [tr('Εκτυπώθηκε {0}', formatDateTime()), stamp.user].filter(Boolean).join(' · ');

const cssText = (text: string) => `"${text.replace(/[\\"]/g, '\\$&').replace(/[\r\n]+/g, ' ')}"`;

/**
 * The page's foot for an A4 print: hospital, printed when and by whom on the left, «Σελίδα X / Y» on the right,
 * on every page. A label (its own small page size) gets nothing.
 */
export const printFrameCss = () => {
  const left = [printHospital(), printedLine()].join(' · ');
  return (
    `<style>@page{@bottom-left{content:${cssText(left)};font:7pt Arial,sans-serif;color:#667}` +
    `@bottom-right{content:${cssText(tr('Σελίδα'))} " " counter(page) " / " counter(pages);font:7pt Arial,sans-serif;color:#667}}</style>`
  );
};
