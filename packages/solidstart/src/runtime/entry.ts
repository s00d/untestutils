import { afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { registerEntry } from '../marker';

registerEntry({ vi, beforeAll, afterEach, beforeEach });
