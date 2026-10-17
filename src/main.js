import '@fontsource-variable/geist';
import './styles/tokens.css';
import './styles/app.css';
import { initTheme } from './app/theme.js';
import { startApp } from './app/shell.js';
import { initWorkshop } from './app/workshop.js';

initTheme();
// el modo taller necesita la configuración (PIN) antes de la primera pantalla; si falla, arranca igual en modo cliente
initWorkshop()
  .catch(() => {})
  .then(() => startApp(document.getElementById('root')));
