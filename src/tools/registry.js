// Lista de herramientas (activas y "próximamente"). Para agregar una: ver README.md.
import keychain from './keychain/index.js';

const L = (es, en) => ({ es, en });
const soon = (id, icon, name, description) => ({ id, status: 'soon', icon, name, description });

export const tools = [
  keychain,
  soon('sign', 'sign', L('Cartel / placa con texto', 'Text sign / plaque'), L('Para puerta o escritorio, con soporte o agujeros para colgar.', 'For doors or desks, with a stand or hanging holes.')),
  soon('qr', 'qr', L('Llavero o placa con QR', 'QR keychain / plaque'), L('Wi-Fi, enlaces o contacto, en dos colores al ras.', 'Wi-Fi, links or contact info, in two flush colors.')),
  soon('svg', 'shapes', L('SVG a 3D', 'SVG to 3D'), L('Extruí un logo o dibujo, un color por relleno.', 'Extrude a logo or drawing, one color per fill.')),
  soon('cutter', 'cookie', L('Cortante de galletitas', 'Cookie cutter'), L('Desde texto, dibujo SVG o imagen.', 'From text, SVG drawing or image.')),
  soon('stamp', 'stamp', L('Sello', 'Stamp'), L('Texto o ícono espejado con mango.', 'Mirrored text or icon with a handle.')),
  soon('lithophane', 'image', L('Litofanía', 'Lithophane'), L('Foto en relieve: plana, curva o para lámpara.', 'Photo in relief: flat, curved or lamp-shaped.')),
  soon('box', 'box', L('Caja paramétrica', 'Parametric box'), L('Con tapa a presión, corrediza y separadores.', 'With snap lid, sliding lid and dividers.')),
  soon('gridfinity', 'grid', L('Organizador Gridfinity', 'Gridfinity organizer'), L('Bins y baseplates a medida.', 'Custom bins and baseplates.')),
];

export const getTool = (id) => tools.find((t) => t.id === id);
