import DefaultTheme from 'vitepress/theme';
import DemoCompare from './DemoCompare.vue';
import './custom.css';

/** @type {import('vitepress').Theme} */
export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('DemoCompare', DemoCompare);
  },
};
