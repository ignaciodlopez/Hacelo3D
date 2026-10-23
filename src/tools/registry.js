// Lista de herramientas (activas y "próximamente"). Para agregar una: ver README.md.
import keychain from './keychain/index.js';
import topper from './topper/index.js';
import qr from './qr/index.js';
import stamp from './stamp/index.js';
import lamp from './lamp/index.js';
import tag from './tag/index.js';
import ornament from './ornament/index.js';
import mate from './mate/index.js';
import plate from './plate/index.js';

const L = (es, en) => ({ es, en });
const soon = (id, icon, name, description) => ({ id, status: 'soon', icon, name, description });

export const tools = [
  keychain,
  topper,
  qr,
  stamp,
  lamp,
  tag,
  ornament,
  mate,
  plate,
  soon('sign', 'sign', L('Cartel / placa con texto', 'Text sign / plaque'), L('Para puerta o escritorio, con soporte o agujeros para colgar.', 'For doors or desks, with a stand or hanging holes.')),
  soon('cutter', 'cookie', L('Cortante de galletitas', 'Cookie cutter'), L('Desde texto, dibujo SVG o imagen.', 'From text, SVG drawing or image.')),
  soon('lithophane', 'image', L('Litofanía', 'Lithophane'), L('Foto en relieve: plana, curva o para lámpara.', 'Photo in relief: flat, curved or lamp-shaped.')),
  soon('box', 'box', L('Caja paramétrica', 'Parametric box'), L('Con tapa a presión, corrediza y separadores.', 'With snap lid, sliding lid and dividers.')),
  soon('gridfinity', 'grid', L('Organizador Gridfinity', 'Gridfinity organizer'), L('Bins y baseplates a medida.', 'Custom bins and baseplates.')),
];

export const getTool = (id) => tools.find((t) => t.id === id);
