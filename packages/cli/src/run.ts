import { runMain } from 'citty';
import { main } from './main';

// pnpm `run … -- --flag` forwards a bare `--`; citty then treats flags after it as positionals.
process.argv = process.argv.filter((arg) => arg !== '--');

runMain(main);
