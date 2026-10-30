import {escapeHtml} from './escapeHtml';

/**
 * The hospital's logo on what it prints (reports, tables, forms, release and composition sheets). It is stored with the
 * hospital's settings (the same small image the labels can use) and kept here for the print templates, which build plain
 * HTML outside React. Without a logo they print as before.
 */
let logo: string | undefined;

const SAFE_IMAGE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

/** Called when the hospital's settings load or change. */
export const setPrintLogo = (value: string | undefined) => {
  logo = value && SAFE_IMAGE.test(value) ? value : undefined;
};

export const printLogo = () => logo;

/** The logo as an image for a print header, or an empty string when there is none. */
export const printLogoHtml = (extraStyle = '') =>
  logo
    ? `<img class="hospital-logo" src="${escapeHtml(logo)}" alt="" style="max-height:15mm;max-width:55mm;object-fit:contain;display:block;margin-bottom:2mm;${extraStyle}">`
    : '';
