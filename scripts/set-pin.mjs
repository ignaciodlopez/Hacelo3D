// Elige (o quita) el PIN del modo taller.
//
//   npm run pin                 pide el PIN dos veces (sin mostrarlo) y guarda el verificador en public/config.json
//   npm run pin -- --remove     quita el PIN (el modo taller vuelve a activarse sin pedirlo)
//   npm run pin -- --config ruta/config.json   usa otro archivo (para pruebas)
//
// El PIN NO se guarda: solo queda { salt, iterations, check } (ver src/app/workshopPin.js). Para cambiarlo, volvé a correr el comando.
// Ojo: después hay que volver a publicar el sitio para que el cambio llegue a la web.

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createPinConfig, PIN_PATTERN, DEFAULT_ITERATIONS } from '../src/app/workshopPin.js';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const configArg = args.indexOf('--config');
const CONFIG = configArg >= 0 ? path.resolve(args[configArg + 1]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/config.json');
// las vueltas de PBKDF2 se pueden bajar solo para pruebas (--iterations N); en producción se usan las por defecto
const itArg = args.indexOf('--iterations');
const ITERATIONS = itArg >= 0 ? Number(args[itArg + 1]) : DEFAULT_ITERATIONS;

const lines = [];
let lineWaiters = [];
let rlClosed = false;

/** Lee una línea sin mostrarla (terminal) o de la entrada redirigida (pruebas y automatización). */
function ask(question) {
  if (!process.stdin.isTTY) {
    if (!lines.rl) {
      lines.rl = readline.createInterface({ input: process.stdin });
      lines.rl.on('line', (l) => (lineWaiters.length ? lineWaiters.shift()(l) : lines.push(l)));
      lines.rl.on('close', () => {
        rlClosed = true;
        lineWaiters.forEach((w) => w(''));
      });
    }
    process.stdout.write(question + '\n');
    if (lines.length) return Promise.resolve(lines.shift());
    if (rlClosed) return Promise.resolve('');
    return new Promise((resolve) => lineWaiters.push(resolve));
  }
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let buf = '';
    const done = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', onData);
      process.stdout.write('\n');
    };
    const onData = (chunk) => {
      for (const c of chunk) {
        if (c === '\r' || c === '\n') {
          done();
          return resolve(buf);
        }
        if (c === '\u0003') {
          done();
          process.exit(130);
        }
        if (c === '\u007f' || c === '\b') buf = buf.slice(0, -1);
        else buf += c;
      }
    };
    stdin.on('data', onData);
  });
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  } catch {
    return {};
  }
}

function writeConfig(cfg) {
  fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2) + '\n');
}

async function main() {
  const cfg = readConfig();

  if (flag('--remove')) {
    delete cfg.workshop;
    writeConfig(cfg);
    console.log('Listo: se quitó el PIN. El modo taller se activa sin pedirlo. (Volvé a publicar el sitio para que llegue a la web.)');
    return;
  }

  const pin = (await ask('PIN nuevo (4 a 12 dígitos; mejor 6 o más): ')).trim();
  if (!PIN_PATTERN.test(pin)) {
    console.error('El PIN debe tener entre 4 y 12 dígitos, solo números.');
    process.exit(1);
  }
  if (pin !== (await ask('Repetilo: ')).trim()) {
    console.error('No coinciden. No se cambió nada.');
    process.exit(1);
  }
  if (pin.length < 6) console.warn('Aviso: un PIN de 4 o 5 dígitos tiene pocas combinaciones y se puede adivinar probando. Mejor 6 o más.');

  cfg.workshop = await createPinConfig(pin, { iterations: ITERATIONS });
  writeConfig(cfg);
  console.log(`Listo: PIN guardado en ${path.relative(process.cwd(), CONFIG)} (solo el verificador, no el PIN). Volvé a publicar el sitio para que llegue a la web.`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err?.message ?? err);
    process.exit(1);
  },
);
