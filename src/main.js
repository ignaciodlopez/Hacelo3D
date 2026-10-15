import '@fontsource-variable/geist';
import './styles/tokens.css';
import './styles/app.css';
import { initTheme } from './app/theme.js';
import { startApp } from './app/shell.js';

initTheme();
startApp(document.getElementById('root'));
