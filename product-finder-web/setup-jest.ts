// The app runs without zone.js (zoneless change detection), so the tests do too.
import { setupZonelessTestEnv } from 'jest-preset-angular/setup-env/zoneless';

setupZonelessTestEnv();
